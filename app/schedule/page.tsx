"use client"

import { onAuthStateChanged } from "firebase/auth"
import { onValue, ref } from "firebase/database"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, realtimeDb } from "../../lib/firebase"
import { getMedicationTime, type Medication } from "../../lib/medications"

type DoseStatus = "pending" | "taken" | "missed"

type IconType = "pill" | "home" | "calendar" | "history" | "profile" | "plus"
function Icon({ type, size = 25 }: { type: IconType; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (type === "pill") return <svg {...p}><rect x="7" y="2.8" width="10" height="18.4" rx="5"/><path d="M7 12h10"/></svg>
  if (type === "home") return <svg {...p}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>
  if (type === "calendar") return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18"/></svg>
  if (type === "history") return <svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 5v5h5"/><path d="M12 7v5l3 2"/></svg>
  if (type === "plus") return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>
  return <svg {...p}><circle cx="12" cy="8" r="3.2"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>
}

function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
function monthTitle(d: Date) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) }
function timelineTitle(d: Date) { return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) }
function minutes(t: string) { if (!t) return 9999; const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0) }

export default function SchedulePage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [statusTree, setStatusTree] = useState<Record<string, Record<string, Record<string, { status?: DoseStatus }>>>>({})
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [error, setError] = useState("")

  useEffect(() => onAuthStateChanged(auth, user => setUid(user?.uid ?? null)), [])
  useEffect(() => {
    if (!uid) { setMedications([]); return }
    return onValue(ref(realtimeDb, `medications/${uid}`), s => {
      const value = s.val() as Record<string, Medication> | null
      setMedications(value ? Object.entries(value).map(([id, m]) => ({ ...m, id })) : [])
    }, e => setError(e.message))
  }, [uid])
  useEffect(() => {
    if (!uid) { setStatusTree({}); return }
    return onValue(ref(realtimeDb, `doseStatus/${uid}`), s => setStatusTree(s.val() || {}), e => setError(e.message))
  }, [uid])

  const selectedKey = dateKey(selectedDate)
  const active = useMemo(() => medications.filter(m => m.active !== false && (!m.startDate || m.startDate <= selectedKey)).map(m => ({ medication: m, time: getMedicationTime(m) })).filter(x => !!x.time).sort((a, b) => minutes(a.time) - minutes(b.time)), [medications, selectedKey])

  // Schedule is a forward-looking view. A dose that has already been TAKEN
  // is removed from this timeline. Only PENDING and MISSED remain visible.
  // The status itself is always read from Firebase; this page never changes it.
  const timeline = useMemo(() => active.map(({ medication, time }) => {
    const firebaseStatus = statusTree[medication.id]?.[selectedKey]?.[time]?.status
    const status: DoseStatus = firebaseStatus === "missed" ? "missed" : firebaseStatus === "taken" ? "taken" : "pending"
    return { medication, time, status }
  }).filter(item => item.status !== "taken"), [active, selectedKey, statusTree])

  const calendarCells: Array<Date | null> = []
  const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  const last = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
  for (let i = 0; i < first.getDay(); i++) calendarCells.push(null)
  for (let d = 1; d <= last.getDate(); d++) calendarCells.push(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d))

  if (!uid) return null
  return <main style={{ minHeight: "100vh", background: "#edf5f2", color: "#142234", paddingBottom: 82, fontFamily: "Arial,Helvetica,sans-serif" }}>
    <style>{`*{box-sizing:border-box}@media(max-width:600px){.schedule-wrap{padding-left:16px!important;padding-right:16px!important}.schedule-header{padding-top:38px!important;padding-bottom:28px!important}.schedule-title{font-size:34px!important}.calendar-card{padding:22px 14px 20px!important}.day-cell{height:54px!important}.bottom-nav{height:76px!important}}`}</style>
    <header style={{ background: "white", borderBottom: "1px solid #dce8e4" }}><div className="schedule-wrap schedule-header" style={{ maxWidth: 760, margin: "0 auto", padding: "38px 22px 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h1 className="schedule-title" style={{ margin: 0, fontSize: 40, lineHeight: 1.05, fontWeight: 800 }}>Schedule</h1><p style={{ margin: "9px 0 0", color: "#71808e", fontSize: 18 }}>{monthTitle(selectedDate)}</p></div><button onClick={() => router.push("/medications")} style={{ width: 64, height: 64, border: 0, borderRadius: "50%", background: "#45ae80", color: "white", display: "grid", placeItems: "center", cursor: "pointer" }}><Icon type="plus" size={34}/></button></div></header>
    <div className="schedule-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "30px 22px" }}>
      {error && <div style={{ background: "#fff1f0", color: "#b42318", padding: 14, borderRadius: 14, marginBottom: 18 }}>{error}</div>}
      <section className="calendar-card" style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 30, padding: "27px 25px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}><button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))} style={{ border: 0, background: "transparent", color: "#718494", fontSize: 32, cursor: "pointer" }}>‹</button><div style={{ fontSize: 19, fontWeight: 800 }}>{monthTitle(selectedDate)}</div><button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))} style={{ border: 0, background: "transparent", color: "#718494", fontSize: 32, cursor: "pointer" }}>›</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", textAlign: "center", color: "#718494", fontSize: 14, fontWeight: 700 }}>{["S","M","T","W","T","F","S"].map((x,i)=><div key={`${x}-${i}`} style={{ padding: "8px 0" }}>{x}</div>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>{calendarCells.map((d,i) => d ? <button className="day-cell" key={dateKey(d)} onClick={() => setSelectedDate(d)} style={{ height: 64, border: 0, background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}><span style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: dateKey(d) === selectedKey ? "#45ae80" : "transparent", color: dateKey(d) === selectedKey ? "white" : "#142234", fontWeight: dateKey(d) === selectedKey ? 800 : 500 }}>{d.getDate()}</span></button> : <div className="day-cell" key={`empty-${i}`} style={{ height: 64 }}/>)}</div>
      </section>
      <h2 style={{ margin: "27px 0 18px", fontSize: 23 }}>Timeline · {timelineTitle(selectedDate)}</h2>
      {timeline.length === 0 ? <div style={{ background: "white", borderRadius: 25, padding: 28, textAlign: "center", border: "1px solid #dce7e3" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{active.length > 0 ? "No pending doses" : "No medications scheduled"}</div><p style={{ color: "#71808e" }}>{active.length > 0 ? "All scheduled doses for this date have been taken." : "Add a medication to create your schedule."}</p></div> : <div style={{ display: "grid", gap: 12 }}>{timeline.map(({ medication, time, status }) => <article key={`${medication.id}-${selectedKey}-${time}`} style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 25, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}><div style={{ width: 55, height: 55, borderRadius: "50%", background: "#e3eef9", color: "#4d79a7", display: "grid", placeItems: "center" }}><Icon type="pill" size={27}/></div><div style={{ flex: 1 }}><div style={{ fontSize: 19, fontWeight: 800 }}>{medication.name}</div><div style={{ color: "#71808e", marginTop: 3 }}>{medication.dosage} {medication.unit} · {time}</div></div><div style={{ color: status === "missed" ? "#ce555d" : "#657786", background: status === "missed" ? "#fde7e7" : "#eef1f2", padding: "9px 14px", borderRadius: 22, fontWeight: 800 }}>{status === "missed" ? "Missed" : "Pending"}</div></article>)}</div>}
    </div>
    <nav className="bottom-nav" style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 76, background: "rgba(255,255,255,.98)", borderTop: "1px solid #dce7e3", display: "flex", justifyContent: "center", zIndex: 20 }}><div style={{ width: "100%", maxWidth: 760, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>{[{ label: "Home", icon: "home" as const, path: "/dashboard" },{ label: "Schedule", icon: "calendar" as const, path: "/schedule" },{ label: "History", icon: "history" as const, path: "/history" },{ label: "Profile", icon: "profile" as const, path: "/profile" }].map(x=><button key={x.label} onClick={() => router.push(x.path)} style={{ border: 0, background: "transparent", color: x.label === "Schedule" ? "#3eaa7d" : "#657786", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontWeight: x.label === "Schedule" ? 800 : 500 }}><Icon type={x.icon} size={27}/><span style={{ fontSize: 13 }}>{x.label}</span></button>)}</div></nav>
  </main>
}
