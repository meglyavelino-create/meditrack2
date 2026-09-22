"use client"

import { onAuthStateChanged } from "firebase/auth"
import { onValue, ref } from "firebase/database"
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, realtimeDb } from "../../lib/firebase"
import { deleteMedication, getMedicationTime, markExpiredPendingDoses, type Medication, updateMedication } from "../../lib/medications"

type DoseStatus = "pending" | "taken" | "missed"
type EditableDose = { medication: Medication; time: string; status: "pending" | "missed"; date: string }
type IconType = "pill" | "home" | "calendar" | "history" | "profile" | "plus" | "close"

function Icon({ type, size = 25 }: { type: IconType; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (type === "pill") return <svg {...p}><rect x="7" y="2.8" width="10" height="18.4" rx="5"/><path d="M7 12h10"/></svg>
  if (type === "home") return <svg {...p}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>
  if (type === "calendar") return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18"/></svg>
  if (type === "history") return <svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 5v5h5"/><path d="M12 7v5l3 2"/></svg>
  if (type === "plus") return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>
  if (type === "close") return <svg {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>
  return <svg {...p}><circle cx="12" cy="8" r="3.2"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>
}

function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
function monthTitle(d: Date) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) }
function timelineTitle(d: Date) { return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) }
function minutes(t: string) { if (!t) return 9999; const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0) }
function todayKey() { return dateKey(new Date()) }
function scheduleValidationError(date: string, time: string) {
  if (!date || !time) return "Please select a valid date and time."
  const now = new Date()
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const selected = new Date(year, month - 1, day, hour, minute, 0, 0)
  const today = todayKey()
  if (date < today) return "⚠️ This date has already passed. Please choose today or a future date."
  if (date === today && selected <= now) return "⚠️ This time has already passed today. Please choose a later time."
  return ""
}

export default function SchedulePage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [statusTree, setStatusTree] = useState<Record<string, Record<string, Record<string, { status?: DoseStatus }>>>>({})
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [editing, setEditing] = useState<EditableDose | null>(null)
  const [name, setName] = useState("")
  const [dosage, setDosage] = useState("")
  const [unit, setUnit] = useState("mg")
  const [form, setForm] = useState("Tablet")
  const [frequency, setFrequency] = useState("Once Daily")
  const [time, setTime] = useState("08:00")
  const [startDate, setStartDate] = useState(todayKey())
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  // Fallback when the ESP32 is off: mark doses missed after 10 minutes.
  useEffect(() => {
    if (!uid || medications.length === 0) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      try { await markExpiredPendingDoses(uid, medications, statusTree) }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to update expired doses.") }
    }
    void run()
    const timer = window.setInterval(() => void run(), 30000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [uid, medications, statusTree])

  const selectedKey = dateKey(selectedDate)
  const active = useMemo(() => medications
    .filter(m => m.active !== false && (!m.startDate || m.startDate <= selectedKey))
    .map(m => ({ medication: m, time: getMedicationTime(m) }))
    .filter(x => !!x.time)
    .sort((a, b) => minutes(a.time) - minutes(b.time)), [medications, selectedKey])

  const timeline = useMemo(() => active.map(({ medication, time }) => {
    const firebaseStatus = statusTree[medication.id]?.[selectedKey]?.[time]?.status
    const status: DoseStatus = firebaseStatus === "missed" ? "missed" : firebaseStatus === "taken" ? "taken" : "pending"
    return { medication, time, status }
  }).filter(item => item.status !== "taken"), [active, selectedKey, statusTree])

  const editScheduleWarning = editing ? scheduleValidationError(startDate, time) : ""

  function openEdit(item: { medication: Medication; time: string; status: "pending" | "missed" }) {
    setEditing({ ...item, date: selectedKey })
    setName(item.medication.name ?? "")
    setDosage(item.medication.dosage ?? "")
    setUnit(item.medication.unit ?? "mg")
    setForm(item.medication.form ?? "Tablet")
    setFrequency(item.medication.frequency ?? "Once Daily")
    setTime(item.time)
    setStartDate(item.medication.startDate ?? selectedKey)
    setNotes(item.medication.notes ?? "")
    setError("")
  }

  function closeEdit() {
    if (saving || deleting) return
    setEditing(null)
    setError("")
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!uid || !editing || !name.trim() || !time) return
    const validationError = scheduleValidationError(startDate, time)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError("")
    try {
      await updateMedication(uid, editing.medication.id, {
        name: name.trim(), dosage: dosage.trim(), unit, time, active: true,
        form, frequency, startDate, notes: notes.trim(),
      }, editing.date, editing.time, editing.status)
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes.")
    } finally { setSaving(false) }
  }

  async function removeMedication() {
    if (!uid || !editing) return
    if (!window.confirm(`Delete ${editing.medication.name}?`)) return
    setDeleting(true)
    setError("")
    try {
      await deleteMedication(uid, editing.medication.id)
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete medication.")
    } finally { setDeleting(false) }
  }

  const calendarCells: Array<Date | null> = []
  const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  const last = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
  for (let i = 0; i < first.getDay(); i++) calendarCells.push(null)
  for (let d = 1; d <= last.getDate(); d++) calendarCells.push(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d))

  if (!uid) return null
  return <main style={{ minHeight: "100vh", background: "#edf5f2", color: "#142234", paddingBottom: 82, fontFamily: "Arial,Helvetica,sans-serif" }}>
    <style>{`*{box-sizing:border-box}@media(max-width:600px){.schedule-wrap{padding-left:16px!important;padding-right:16px!important}.schedule-header{padding-top:38px!important;padding-bottom:28px!important}.schedule-title{font-size:34px!important}.calendar-card{padding:22px 14px 20px!important}.day-cell{height:54px!important}.bottom-nav{height:76px!important}.edit-overlay{padding:12px!important}.edit-card{max-height:calc(100vh - 24px)!important;padding:20px 18px!important}}`}</style>
    <header style={{ background: "white", borderBottom: "1px solid #dce8e4" }}><div className="schedule-wrap schedule-header" style={{ maxWidth: 760, margin: "0 auto", padding: "38px 22px 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h1 className="schedule-title" style={{ margin: 0, fontSize: 40, lineHeight: 1.05, fontWeight: 800 }}>Schedule</h1><p style={{ margin: "9px 0 0", color: "#71808e", fontSize: 18 }}>{monthTitle(selectedDate)}</p></div><button onClick={() => router.push("/medications")} style={{ width: 64, height: 64, border: 0, borderRadius: "50%", background: "#45ae80", color: "white", display: "grid", placeItems: "center", cursor: "pointer" }}><Icon type="plus" size={34}/></button></div></header>
    <div className="schedule-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "30px 22px" }}>
      {error && !editing && <div style={{ background: "#fff1f0", color: "#b42318", padding: 14, borderRadius: 14, marginBottom: 18 }}>{error}</div>}
      <section className="calendar-card" style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 30, padding: "27px 25px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}><button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))} style={{ border: 0, background: "transparent", color: "#718494", fontSize: 32, cursor: "pointer" }}>‹</button><div style={{ fontSize: 19, fontWeight: 800 }}>{monthTitle(selectedDate)}</div><button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))} style={{ border: 0, background: "transparent", color: "#718494", fontSize: 32, cursor: "pointer" }}>›</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", textAlign: "center", color: "#718494", fontSize: 14, fontWeight: 700 }}>{["S","M","T","W","T","F","S"].map((x,i)=><div key={`${x}-${i}`} style={{ padding: "8px 0" }}>{x}</div>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>{calendarCells.map((d,i) => d ? <button className="day-cell" key={dateKey(d)} onClick={() => setSelectedDate(d)} style={{ height: 64, border: 0, background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}><span style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: dateKey(d) === selectedKey ? "#45ae80" : "transparent", color: dateKey(d) === selectedKey ? "white" : "#142234", fontWeight: dateKey(d) === selectedKey ? 800 : 500 }}>{d.getDate()}</span></button> : <div className="day-cell" key={`empty-${i}`} style={{ height: 64 }}/>)}</div>
      </section>
      <h2 style={{ margin: "27px 0 18px", fontSize: 23 }}>Timeline · {timelineTitle(selectedDate)}</h2>
      {timeline.length === 0 ? <div style={{ background: "white", borderRadius: 25, padding: 28, textAlign: "center", border: "1px solid #dce7e3" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{active.length > 0 ? "No pending doses" : "No medications scheduled"}</div><p style={{ color: "#71808e" }}>{active.length > 0 ? "All scheduled doses for this date have been taken." : "Add a medication to create your schedule."}</p></div> : <div style={{ display: "grid", gap: 12 }}>{timeline.map(({ medication, time, status }) => <button key={`${medication.id}-${selectedKey}-${time}`} onClick={() => openEdit({ medication, time, status: status as "pending" | "missed" })} style={{ width: "100%", textAlign: "left", border: "1px solid #dce7e3", borderRadius: 25, padding: "16px 18px", background: "white", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", color: "inherit" }} aria-label={`Edit ${medication.name}`}><div style={{ width: 55, height: 55, borderRadius: "50%", background: "#e3eef9", color: "#4d79a7", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon type="pill" size={27}/></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 19, fontWeight: 800 }}>{medication.name}</div><div style={{ color: "#71808e", marginTop: 3 }}>{medication.dosage} {medication.unit} · {time}</div></div><div style={{ color: status === "missed" ? "#ce555d" : "#657786", background: status === "missed" ? "#fde7e7" : "#eef1f2", padding: "9px 14px", borderRadius: 22, fontWeight: 800, flexShrink: 0 }}>{status === "missed" ? "Missed" : "Pending"}</div></button>)}</div>}
    </div>
    <nav className="bottom-nav" style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 76, background: "rgba(255,255,255,.98)", borderTop: "1px solid #dce7e3", display: "flex", justifyContent: "center", zIndex: 20 }}><div style={{ width: "100%", maxWidth: 760, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>{[{ label: "Home", icon: "home" as const, path: "/dashboard" },{ label: "Schedule", icon: "calendar" as const, path: "/schedule" },{ label: "History", icon: "history" as const, path: "/history" },{ label: "Profile", icon: "profile" as const, path: "/profile" }].map(x=><button key={x.label} onClick={() => router.push(x.path)} style={{ border: 0, background: "transparent", color: x.label === "Schedule" ? "#3eaa7d" : "#657786", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontWeight: x.label === "Schedule" ? 800 : 500 }}><Icon type={x.icon} size={27}/><span style={{ fontSize: 13 }}>{x.label}</span></button>)}</div></nav>

    {editing && <div className="edit-overlay" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(83,96,101,.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <section className="edit-card" style={{ width: "min(405px,calc(100vw - 32px))", maxHeight: "calc(100vh - 28px)", overflowY: "auto", background: "white", borderRadius: 28, padding: "22px 22px 20px", boxShadow: "0 24px 60px rgba(20,34,52,.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><h2 style={{ margin: 0, fontSize: 21, lineHeight: 1.15 }}>Edit medication</h2><p style={{ margin: "8px 0 0", color: "#71808e", fontSize: 13 }}>Update the details of this medicine.</p></div><button onClick={closeEdit} style={{ width: 32, height: 32, border: 0, background: "transparent", color: "#71808e", cursor: "pointer" }}><Icon type="close" size={21}/></button></div>
        <form onSubmit={saveEdit}>
          {([['Medication name', <input required className="edit-field" value={name} onChange={e=>setName(e.target.value)} />], ['Dosage', <input className="edit-field" inputMode="decimal" value={dosage} onChange={e=>setDosage(e.target.value)} />]] as Array<[string, ReactNode]>).map(([label, control])=><label key={label} style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 800 }}>{label}{control}</label>)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 800 }}>Unit<select className="edit-field" value={unit} onChange={e=>setUnit(e.target.value)}><option>mg</option><option>g</option><option>mcg</option><option>mL</option><option>IU</option><option>puff</option><option>drop</option><option>unit</option></select></label>
            <label style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 800 }}>Form<select className="edit-field" value={form} onChange={e=>setForm(e.target.value)}><option>Tablet</option><option>Capsule</option><option>Liquid</option><option>Injection</option><option>Drops</option><option>Other</option></select></label>
          </div>
          <label style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 800 }}>Frequency<select className="edit-field" value={frequency} onChange={e=>setFrequency(e.target.value)}><option>Once Daily</option><option>Twice Daily</option><option>Three Times Daily</option><option>Four Times Daily</option><option>As Needed</option></select></label>
          <label style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 800 }}>Time<input className="edit-field" required type="time" value={time} onChange={e=>setTime(e.target.value)} /></label>
          <label style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 800 }}>Start date<input className="edit-field" required type="date" min={todayKey()} value={startDate} onChange={e=>setStartDate(e.target.value)} /></label>
          {editScheduleWarning && <div style={{ marginTop: 12, padding: "11px 12px", borderRadius: 14, background: "#fff7e6", border: "1px solid #f2d39a", color: "#9a5b00", fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{editScheduleWarning}</div>}
          <label style={{ display: "block", marginTop: 14, fontSize: 13, fontWeight: 800 }}>Notes (optional)<textarea className="edit-field edit-textarea" value={notes} onChange={e=>setNotes(e.target.value)} /></label>
          {error && <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "#fff1f0", color: "#b42318", fontSize: 12, fontWeight: 700 }}>{error}</div>}
          <button disabled={saving || deleting || !!editScheduleWarning} type="submit" style={{ width: "100%", height: 48, border: 0, borderRadius: 25, background: "#45ae80", color: "white", fontWeight: 800, fontSize: 15, marginTop: 18, cursor: "pointer", opacity: saving || deleting || !!editScheduleWarning ? .55 : 1 }}>{saving ? "Saving..." : "Save changes"}</button>
          <button disabled={saving || deleting} type="button" onClick={removeMedication} style={{ width: "100%", border: 0, background: "transparent", color: "#e23d45", fontWeight: 800, marginTop: 18, cursor: "pointer", opacity: saving || deleting ? .65 : 1 }}>{deleting ? "Deleting..." : "Delete medication"}</button>
        </form>
      </section>
      <style>{`.edit-field{display:block;width:100%;height:42px;margin-top:7px;border:1px solid #dce7e3;border-radius:22px;padding:0 14px;background:#edf4f1;color:#263847;font-size:14px;outline:none;font-weight:400}.edit-field:focus{border-color:#45ae80;box-shadow:0 0 0 2px rgba(69,174,128,.12)}select.edit-field{cursor:pointer}.edit-textarea{height:72px;padding-top:12px;resize:vertical;border-radius:18px}`}</style>
    </div>}
  </main>
}