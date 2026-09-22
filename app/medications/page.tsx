"use client"

import { FormEvent, useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth, realtimeDb } from "../../lib/firebase"
import { createMedication } from "../../lib/medications"
import { createPendingDose } from "../../lib/dose-status"

export default function MedicationsPage() {
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
      const medicationId = await createMedication(uid, { name: name.trim(), dosage: dosage.trim(), unit, time, active: true })
      await createPendingDose(uid, medicationId, time)
      setName("")
      setDosage("")
      setTime("")
      setMessage("Medication and pending dose created.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save medication.")
    } finally {
      setSaving(false)
    }
  }

  if (!uid) return <main style={{ padding: 40 }}>Please sign in first.</main>

  return <main style={{ maxWidth: 700, margin: "0 auto", padding: 32 }}>
    <h1>Add medication</h1>
    <p style={{ color: "#667085" }}>Create the schedule. The initial dose is pending; ESP32 owns later status changes.</p>
    <form onSubmit={submit} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 24, display: "grid", gap: 16 }}>
      <input required placeholder="Medication name" value={name} onChange={e => setName(e.target.value)} style={{ padding: 13, border: "1px solid #d0d5dd", borderRadius: 10 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <input placeholder="Dosage" value={dosage} onChange={e => setDosage(e.target.value)} style={{ flex: 1, padding: 13, border: "1px solid #d0d5dd", borderRadius: 10 }} />
        <select value={unit} onChange={e => setUnit(e.target.value)} style={{ padding: 13, border: "1px solid #d0d5dd", borderRadius: 10 }}><option>mg</option><option>mL</option><option>tablet</option><option>capsule</option></select>
      </div>
      <label>Schedule time<input required type="time" value={time} onChange={e => setTime(e.target.value)} style={{ display: "block", width: "100%", marginTop: 8, padding: 13, border: "1px solid #d0d5dd", borderRadius: 10 }} /></label>
      <button disabled={saving} style={{ padding: 14, border: 0, borderRadius: 10, background: "#2563eb", color: "white", fontWeight: 700 }}>{saving ? "Saving..." : "Create medication"}</button>
      {message && <p>{message}</p>}
    </form>
  </main>
}
