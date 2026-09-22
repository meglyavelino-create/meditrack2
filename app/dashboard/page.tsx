"use client"

import { onValue, ref } from "firebase/database"
import { useEffect, useState } from "react"
import { auth, realtimeDb } from "../../lib/firebase"
import type { Medication } from "../../lib/medications"

export default function DashboardPage() {
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setMedications([])
        setLoading(false)
        return
      }

      const medicationsRef = ref(realtimeDb, `medications/${user.uid}`)
      const unsubscribe = onValue(medicationsRef, (snapshot) => {
        const value = snapshot.val() as Record<string, Medication> | null
        setMedications(value ? Object.values(value) : [])
        setLoading(false)
      })

      return unsubscribe
    })

    return unsubscribeAuth
  }, [])

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
      <header style={{ marginBottom: 28 }}>
        <p style={{ margin: 0, color: "#2563eb", fontWeight: 700 }}>MediTrack</p>
        <h1 style={{ margin: "6px 0", fontSize: 34 }}>Dashboard</h1>
        <p style={{ margin: 0, color: "#667085" }}>Medication schedules and realtime dose monitoring.</p>
      </header>

      {loading ? <p>Loading medications...</p> : medications.length === 0 ? (
        <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 28 }}>
          <h2 style={{ marginTop: 0 }}>No medications yet</h2>
          <p style={{ color: "#667085" }}>Your medication schedules will appear here.</p>
        </section>
      ) : (
        <section style={{ display: "grid", gap: 14 }}>
          {medications.map((medication) => (
            <article key={medication.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0 }}>{medication.name}</h2>
                <p style={{ margin: "7px 0 0", color: "#667085" }}>{medication.dosage} {medication.unit} · {medication.time}</p>
              </div>
              <span style={{ padding: "7px 12px", borderRadius: 999, background: medication.active ? "#ecfdf3" : "#f2f4f7", color: medication.active ? "#027a48" : "#667085", fontWeight: 700 }}>{medication.active ? "Active" : "Inactive"}</span>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
