"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth"
import { auth } from "../../lib/firebase"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => onAuthStateChanged(auth, user => {
    if (user) router.replace("/dashboard")
  }), [router])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      if (register) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
      router.replace("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed")
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await signOut(auth)
  }

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <section style={{ width: "100%", maxWidth: 430, background: "white", border: "1px solid #e5e7eb", borderRadius: 22, padding: 32 }}>
      <p style={{ margin: 0, color: "#2563eb", fontWeight: 700 }}>MediTrack</p>
      <h1 style={{ marginBottom: 8 }}>{register ? "Create account" : "Welcome back"}</h1>
      <p style={{ color: "#667085" }}>{register ? "Create your MediTrack account." : "Sign in to manage your medication schedules."}</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={{ padding: 13, border: "1px solid #d0d5dd", borderRadius: 10 }} />
        <input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (6+ characters)" style={{ padding: 13, border: "1px solid #d0d5dd", borderRadius: 10 }} />
        <button disabled={busy} style={{ padding: 14, border: 0, borderRadius: 10, background: "#2563eb", color: "white", fontWeight: 700 }}>{busy ? "Please wait..." : register ? "Create account" : "Sign in"}</button>
      </form>
      {error && <p style={{ color: "#b42318", fontSize: 14 }}>{error}</p>}
      <button onClick={() => setRegister(!register)} style={{ marginTop: 14, border: 0, background: "transparent", color: "#2563eb", cursor: "pointer" }}>{register ? "Already have an account? Sign in" : "Need an account? Create one"}</button>
    </section>
  </main>
}
