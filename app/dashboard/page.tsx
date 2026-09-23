"use client"

import { onValue, ref } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, realtimeDb } from "../../lib/firebase"
import type { Medication } from "../../lib/medications"
import { getMedicationTime, markExpiredPendingDoses } from "../../lib/medications"

type DoseStatus = "pending" | "taken" | "missed"
type UserInfo = { uid: string; name: string; email: string }
type StatusNode = { status?: DoseStatus; updatedAt?: number }

function Icon({ type, size = 25 }: { type: "pill" | "check" | "clock" | "trend" | "home" | "calendar" | "history" | "profile"; size?: number }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (type === "pill") return <svg {...c}><rect x="7" y="2.8" width="10" height="18.4" rx="5"/><path d="M7 12h10"/></svg>
  if (type === "check") return <svg {...c}><path d="m5 12 4 4 10-10"/></svg>
  if (type === "clock") return <svg {...c}><circle cx="12" cy="12" r="8.7"/><path d="M12 7v5l3 2"/></svg>
  if (type === "trend") return <svg {...c}><path d="M4 16 9 11l3 3 7-8"/><path d="M14 6h5v5"/></svg>
  if (type === "home") return <svg {...c}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>
  if (type === "calendar") return <svg {...c}><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18"/></svg>
  if (type === "history") return <svg {...c}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 5v5h5"/><path d="M12 7v5l3 2"/></svg>
  return <svg {...c}><circle cx="12" cy="8" r="3.2"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>
}

function formatTime(t: string) { return t || "--:--" }
function mins(t: string) { if (!t || !t.includes(":")) return 9999; const [h, m] = t.split(":").map(Number); return h * 60 + m }
function todayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [statusTree, setStatusTree] = useState<Record<string, Record<string, Record<string, StatusNode>>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [now, setNow] = useState(new Date())

  useEffect(() => onAuthStateChanged(auth, u => {
    if (!u) { setUser(null); return }
    setUser({ uid: u.uid, name: u.displayName || u.email?.split("@")[0] || "there", email: u.email || "" })
  }), [])

  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(t) }, [])

  useEffect(() => {
    if (!user) { setMedications([]); setLoading(false); return }
    setLoading(true)
    return onValue(ref(realtimeDb, `medications/${user.uid}`), s => {
      const value = s.val() as Record<string, Medication> | null
      setMedications(value ? Object.entries(value).map(([id, m]) => ({ ...m, id })) : [])
      setLoading(false)
    }, e => { setError(e.message); setLoading(false) })
  }, [user])

  useEffect(() => {
    if (!user) { setStatusTree({}); return }
    const statusRef = ref(realtimeDb, `doseStatus/${user.uid}`)
    return onValue(statusRef, s => {
      setStatusTree((s.val() as typeof statusTree) || {})
    }, e => setError(e.message))
  }, [user])

  // Fallback when the ESP32 is powered off or disconnected.
  // Any pending dose that is at least 10 minutes past its scheduled time
  // is recorded as missed by the web app.
  useEffect(() => {
    if (!user || medications.length === 0) return

    let cancelled = false
    const run = async () => {
      if (cancelled) return
      try {
        await markExpiredPendingDoses(user.uid, medications, statusTree)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to update expired doses.")
      }
    }

    void run()
    const timer = window.setInterval(() => void run(), 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user, medications, statusTree])

  const todayDate = todayKey(now)
  const todayAll = useMemo(() => medications
    .filter(m => m.active !== false && (!m.startDate || m.startDate <= todayDate))
    .map(m => {
      const time = getMedicationTime(m)
      const status = statusTree[m.id]?.[todayDate]?.[time]?.status ?? "pending"
      return { medication: m, time, status }
    })
    .filter(d => !!d.time)
    .sort((a, b) => mins(a.time) - mins(b.time)), [medications, statusTree, todayDate])

  const pendingToday = useMemo(() => todayAll.filter(d => d.status === "pending"), [todayAll])

  const taken = todayAll.filter(d => d.status === "taken").length
  const missed = todayAll.filter(d => d.status === "missed").length
  const adherence = missed === 0 ? 100 : Math.round(taken / (taken + missed) * 100)
  const current = now.getHours() * 60 + now.getMinutes()
  const next = pendingToday.find(d => mins(d.time) >= current) || pendingToday[0]

  const countdown = useMemo(() => {
    if (!next) return "0h 00m"
    const target = new Date(now)
    const [h, m] = next.time.split(":").map(Number)
    target.setHours(h, m, 0, 0)
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
    const total = Math.floor((target.getTime() - now.getTime()) / 60000)
    return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`
  }, [next, now])

  if (!user) return null
  const first = user.name.split(" ")[0] || "there"

  return <main style={{ minHeight: "100vh", background: "#edf5f2", color: "#142234", paddingBottom: 82, fontFamily: "Arial,Helvetica,sans-serif" }}>
    <style>{`*{box-sizing:border-box}@media(max-width:600px){.mt-content{padding-left:16px!important;padding-right:16px!important}.mt-header{padding-top:42px!important;padding-bottom:30px!important}.mt-title{font-size:36px!important}.mt-subtitle{font-size:19px!important}.mt-next{padding:28px 22px 22px!important}.mt-count{font-size:54px!important}.mt-stat{padding:17px 14px!important}.mt-stat-value{font-size:32px!important}.mt-dose{padding:15px 14px!important}.mt-dose-name{font-size:18px!important}.mt-bottom{height:76px!important}}`}</style>
    <header style={{ background: "#fff", borderBottom: "1px solid #dce8e4" }}><div className="mt-content mt-header" style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "48px 22px 34px" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}><div><h1 className="mt-title" style={{ margin: 0, fontSize: 42, lineHeight: 1.05, letterSpacing: -1.2, fontWeight: 800 }}>Hi, {first}</h1><p className="mt-subtitle" style={{ margin: "12px 0 0", color: "#71808e", fontSize: 20 }}>Here's your plan for today</p></div><button onClick={() => router.push("/medications")} style={{ width: 68, height: 68, border: 0, borderRadius: "50%", background: "#45b083", color: "white", fontSize: 40, cursor: "pointer" }}>+</button></div></div></header>
    <div className="mt-content" style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "30px 22px 28px" }}>
      {error && <div style={{ background: "#fff1f0", color: "#b42318", padding: 14, borderRadius: 14, marginBottom: 18 }}>{error}</div>}
      <section className="mt-next" style={{ background: "#45ae80", borderRadius: 30, padding: "32px 30px 25px", color: "white", boxShadow: "0 12px 25px rgba(55,145,106,.15)" }}><div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1.1 }}>NEXT DOSE IN</div><div className="mt-count" style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 800, margin: "8px 0 20px" }}>{countdown}</div>{next ? <div style={{ background: "rgba(255,255,255,.19)", borderRadius: 23, padding: "17px 19px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 23, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{next.medication.name}</div><div style={{ marginTop: 4, fontSize: 17 }}>{next.medication.dosage} {next.medication.unit}</div></div><div style={{ background: "rgba(255,255,255,.25)", padding: "9px 15px", borderRadius: 28, fontSize: 18, fontWeight: 800 }}>{formatTime(next.time)}</div></div> : <div style={{ background: "rgba(255,255,255,.17)", borderRadius: 20, padding: 18 }}>No pending doses for today.</div>}</section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 15, marginTop: 24 }}>{[{ icon: "check" as const, value: taken, label: "Taken", color: "#3aa87d" }, { icon: "clock" as const, value: missed, label: "Missed", color: "#df5d64" }, { icon: "trend" as const, value: `${adherence}%`, label: "Adherence", color: "#3c6ea4" }].map(x => <div className="mt-stat" key={x.label} style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 26, padding: "21px 18px", minHeight: 135 }}><div style={{ color: x.color, marginBottom: 11 }}><Icon type={x.icon} size={27} /></div><div className="mt-stat-value" style={{ fontSize: 37, fontWeight: 800 }}>{x.value}</div><div style={{ color: "#73818d", fontSize: 17, marginTop: 9 }}>{x.label}</div></div>)}</section>
      <h2 style={{ margin: "34px 0 17px", fontSize: 27 }}>Today's doses</h2>
      {loading ? <div style={{ background: "white", borderRadius: 23, padding: 26, color: "#71808e" }}>Loading your medications...</div> : pendingToday.length === 0 ? <div style={{ background: "white", borderRadius: 24, padding: 28, textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{todayAll.length > 0 ? "No pending doses for today" : "No medications yet"}</div><p style={{ color: "#71808e" }}>{todayAll.length > 0 ? "Taken and missed doses are kept in History." : "Add your first medication schedule to start tracking doses."}</p>{todayAll.length === 0 && <button onClick={() => router.push("/medications")} style={{ border: 0, background: "#45ae80", color: "white", borderRadius: 18, padding: "12px 20px", fontWeight: 800 }}>Add medication</button>}</div> : <div style={{ display: "grid", gap: 12 }}>{pendingToday.map(({ medication, time }) => <article className="mt-dose" key={medication.id} style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 25, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}><div style={{ width: 57, height: 57, borderRadius: "50%", background: "#e3eef9", color: "#4d79a7", display: "grid", placeItems: "center" }}><Icon type="pill" size={27} /></div><div style={{ minWidth: 0, flex: 1 }}><div className="mt-dose-name" style={{ fontWeight: 800, fontSize: 20 }}>{medication.name}</div><div style={{ color: "#71808e", fontSize: 16, marginTop: 3 }}>{medication.dosage} {medication.unit} · {formatTime(time)}</div></div><div style={{ background: "#eef1f2", color: "#667784", borderRadius: 22, padding: "9px 13px", fontWeight: 800, fontSize: 15 }}>◷ Pending</div></article>)}</div>}
    </div>
    <nav className="mt-bottom" style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 76, background: "rgba(255,255,255,.98)", borderTop: "1px solid #dce7e3", display: "flex", justifyContent: "center", zIndex: 20 }}><div style={{ width: "100%", maxWidth: 760, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>{[{ label: "Home", icon: "home" as const, path: "/dashboard" }, { label: "Schedule", icon: "calendar" as const, path: "/schedule" }, { label: "History", icon: "history" as const, path: "/history" }, { label: "Profile", icon: "profile" as const, path: "/profile" }].map(x => <button key={x.label} onClick={() => router.push(x.path)} style={{ border: 0, background: "transparent", color: x.label === "Home" ? "#3eaa7d" : "#657786", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontWeight: x.label === "Home" ? 800 : 500, cursor: "pointer" }}><Icon type={x.icon} size={27} /><span style={{ fontSize: 13 }}>{x.label}</span></button>)}</div></nav>
  </main>
}