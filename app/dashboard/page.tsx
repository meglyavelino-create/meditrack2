"use client"

import { onValue, ref } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { useEffect, useState } from "react"
import { auth, realtimeDb } from "../../lib/firebase"
import type { Medication } from "../../lib/medications"

type DoseStatus = "pending" | "taken" | "missed"

export default function DashboardPage() {
  const [medications, setMedications] = useState<Medication[]>([])
  const [statuses, setStatuses] = useState<Record<string, DoseStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => onAuthStateChanged(auth, user => setUid(user?.uid ?? null)), [])

  useEffect(() => {
    if (!uid) {
      setMedications([])
      setStatuses({})
      setLoading(false)
      return
    }

    setLoading(true)
    return onValue(ref(realtimeDb, `medications/${uid}`), snapshot => {
      const value = snapshot.val() as Record<string, Medication> | null
      setMedications(value ? Object.entries(value).map(([id, medication]) => ({ ...medication, id })) : [])
      setLoading(false)
    }, e => {
      setError(e.message)
      setLoading(false)
    })
  }, [uid])

  useEffect(() => {
    if (!uid || medications.length === 0) return

    const date = new Date()
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const unsubscribers = medications.map(medication => onValue(
      ref(realtimeDb, `doseStatus/${uid}/${medication.id}/${dateKey}`),
      snapshot => {
        const value = snapshot.val() as Record<string, { status?: DoseStatus }> | null
        setStatuses(previous => {
          const next = { ...previous }
          for (const [time, dose] of Object.entries(value ?? {})) {
            if (dose?.status === "pending" || dose?.status === "taken" || dose?.status === "missed") {
              next[`${medication.id}|${time}`] = dose.status
            }
          }
          return next
        })
      },
      e => setError(e.message)
    ))

    return () => unsubscribers.forEach(unsubscribe => unsubscribe())
  }, [uid, medications])

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
      <header style={{ marginBottom: 28 }}>
        <p style={{ margin: 0, color: "#2563eb", fontWeight: 700 }}>MediTrack</p>
        <h1 style={{ margin: "6px 0", fontSize: 34 }}>Dashboard</h1>
        <p style={{ margin: 0, color: "#667085" }}>Medication schedules and realtime dose monitoring.</p>
      </header>
      {error && <p style={{ color: "#b42318" }}>Firebase error: {error}</p>}
      {loading ? <p>Loading medications...</p> : medications.length === 0 ? (
        <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 28 }}><h2 style={{ marginTop: 0 }}>No medications yet</h2><p style={{ color: "#667085" }}>Your medication schedules will appear here.</p></section>
      ) : (
        <section style={{ display: "grid", gap: 14 }}>
          {medications.map(medication => {
            const time = medication.time ?? "--:--"
            const status = statuses[`${medication.id}|${time}`] ?? "pending"
            return <article key={medication.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h2 style={{ margin: 0 }}>{medication.name}</h2><p style={{ margin: "7px 0 0", color: "#667085" }}>{medication.dosage} {medication.unit} · {time}</p></div>
              <strong style={{ textTransform: "capitalize", color: status === "taken" ? "#027a48" : status === "missed" ? "#b42318" : "#b54708" }}>{status}</strong>
            </article>
          })}
        </section>
      )}
    </main>
  )
}
