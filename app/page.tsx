"use client"

import { useState } from "react"

export default function HomePage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 420, background: "white", border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, boxShadow: "0 12px 40px rgba(0,0,0,.06)" }}>
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: 0, color: "#2563eb", fontWeight: 700 }}>MediTrack</p>
          <h1 style={{ margin: "8px 0", fontSize: 32 }}>Medication tracking</h1>
          <p style={{ margin: 0, color: "#667085" }}>Manage schedules and monitor ESP32 dose status.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setMessage("Firebase authentication will be connected next.") }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@example.com" style={{ width: "100%", padding: 14, border: "1px solid #d0d5dd", borderRadius: 12, marginBottom: 18 }} />
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="••••••••" style={{ width: "100%", padding: 14, border: "1px solid #d0d5dd", borderRadius: 12, marginBottom: 20 }} />
          <button type="submit" style={{ width: "100%", border: 0, borderRadius: 12, padding: 14, background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" }}>Sign in</button>
        </form>

        {message && <p style={{ marginTop: 18, color: "#667085", fontSize: 14 }}>{message}</p>}
      </section>
    </main>
  )
}
