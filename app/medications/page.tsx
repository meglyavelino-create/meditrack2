"use client"

import { FormEvent, useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { useRouter } from "next/navigation"
import { auth } from "../../lib/firebase"
import { createMedication } from "../../lib/medications"
import { createPendingDose } from "../../lib/dose-status"

function Icon({ type, size = 26 }: { type: "pill" | "back"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (type === "back") return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>
  return <svg {...common}><rect x="7" y="2.8" width="10" height="18.4" rx="5"/><path d="M7 12h10"/></svg>
}

export default function MedicationsPage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [dosage, setDosage] = useState("")
  const [unit, setUnit] = useState("mg")
  const [time, setTime] = useState("")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => onAuthStateChanged(auth, user => setUid(user?.uid ?? null)), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!uid || !name.trim() || !time) return
    setSaving(true)
    setMessage("")
    try {
      const medication = await createMedication(uid, { name: name.trim(), dosage: dosage.trim(), unit, time, active: true })
      await createPendingDose(uid, medication.id, time)
      setMessage("Medication added successfully.")
      setTimeout(() => router.push("/dashboard"), 500)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save medication.")
    } finally { setSaving(false) }
  }

  if (!uid) return null

  return (
    <main style={{ minHeight: "100vh", background: "#edf5f2", color: "#142234", paddingBottom: 90, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style>{`*{box-sizing:border-box}@media(max-width:600px){.med-wrap{padding-left:16px!important;padding-right:16px!important}.med-title{font-size:34px!important}.med-card{padding:22px 18px!important}.med-grid{grid-template-columns:1fr!important}}`}</style>
      <header style={{ background: "white", borderBottom: "1px solid #dce8e4" }}>
        <div className="med-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "34px 22px 27px", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => router.back()} aria-label="Back" style={{ width: 46, height: 46, border: 0, borderRadius: "50%", background: "#e7f1ed", color: "#5f7382", display: "grid", placeItems: "center", cursor: "pointer" }}><Icon type="back" /></button>
          <div><h1 className="med-title" style={{ margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Add medication</h1><p style={{ margin: "7px 0 0", color: "#71808e", fontSize: 16 }}>Create a dose schedule for your MediTrack.</p></div>
        </div>
      </header>
      <div className="med-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "30px 22px" }}>
        <form onSubmit={submit} className="med-card" style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 30, padding: 28, boxShadow: "0 5px 18px rgba(20,34,52,.04)" }}>
          <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#e3eef9", color: "#4d79a7", display: "grid", placeItems: "center", marginBottom: 24 }}><Icon type="pill" size={31} /></div>
          <label style={{ display: "block", fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Medication name</label>
          <input required placeholder="e.g. Paracetamol" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", height: 52, border: "1px solid #d6e1de", borderRadius: 18, padding: "0 17px", fontSize: 16, outline: "none", background: "#f8fbfa" }} />
          <div className="med-grid" style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 12, marginTop: 20 }}>
            <div><label style={{ display: "block", fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Dosage</label><input placeholder="300" value={dosage} onChange={e => setDosage(e.target.value)} style={{ width: "100%", height: 52, border: "1px solid #d6e1de", borderRadius: 18, padding: "0 17px", fontSize: 16, outline: "none", background: "#f8fbfa" }} /></div>
            <div><label style={{ display: "block", fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Unit</label><select value={unit} onChange={e => setUnit(e.target.value)} style={{ width: "100%", height: 52, border: "1px solid #d6e1de", borderRadius: 18, padding: "0 13px", fontSize: 16, outline: "none", background: "#f8fbfa" }}><option>mg</option><option>mL</option><option>tablet</option><option>capsule</option></select></div>
          </div>
          <div style={{ marginTop: 20 }}><label style={{ display: "block", fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Schedule time</label><input required type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: "100%", height: 52, border: "1px solid #d6e1de", borderRadius: 18, padding: "0 17px", fontSize: 16, outline: "none", background: "#f8fbfa" }} /></div>
          {message && <div style={{ marginTop: 20, padding: "12px 15px", borderRadius: 15, background: message.includes("successfully") ? "#e2f3eb" : "#fff0f0", color: message.includes("successfully") ? "#398f6c" : "#c53f49", fontWeight: 700 }}>{message}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 25 }}>
            <button type="button" onClick={() => router.back()} style={{ height: 52, border: "1px solid #d6e1de", borderRadius: 18, background: "white", color: "#607382", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Cancel</button>
            <button disabled={saving} type="submit" style={{ height: 52, border: 0, borderRadius: 18, background: "#45ae80", color: "white", fontSize: 16, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .7 : 1 }}>{saving ? "Saving..." : "Create medication"}</button>
          </div>
        </form>
      </div>
      <BottomNav router={router} />
    </main>
  )
}

function BottomNav({ router }: { router: ReturnType<typeof useRouter> }) {
  const items = [{label:"Home",path:"/dashboard",icon:"⌂"},{label:"Schedule",path:"/schedule",icon:"□"},{label:"History",path:"/history",icon:"↶"},{label:"Profile",path:"/profile",icon:"♙"}]
  return <nav style={{ position:"fixed",left:0,right:0,bottom:0,height:76,background:"rgba(255,255,255,.98)",borderTop:"1px solid #dce7e3",display:"flex",justifyContent:"center",zIndex:20 }}><div style={{width:"100%",maxWidth:760,display:"grid",gridTemplateColumns:"repeat(4,1fr)"}}>{items.map(item=><button key={item.label} onClick={()=>router.push(item.path)} style={{border:0,background:"transparent",color:"#657786",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,cursor:"pointer",fontWeight:500}}><span style={{fontSize:25,lineHeight:1}}>{item.icon}</span><span style={{fontSize:13}}>{item.label}</span></button>)}</div></nav>
}
