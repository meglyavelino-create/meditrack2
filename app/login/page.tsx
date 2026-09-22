"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth"
import { auth } from "../../lib/firebase"

export default function LoginPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => onAuthStateChanged(auth, user => {
    if (user) router.replace("/dashboard")
  }), [router])

  async function signInWithGoogle() {
    setBusy(true)
    setError("")
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      router.replace("/dashboard")
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError("Sign-in was cancelled. Please try again.")
      } else {
        setError("Could not sign in with Google. Please try again.")
      }
    } finally {
      setBusy(false)
    }
  }

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <section style={{ width: "100%", maxWidth: 430, background: "white", border: "1px solid #e5e7eb", borderRadius: 22, padding: 32 }}>
      <p style={{ margin: 0, color: "#2563eb", fontWeight: 700 }}>MediTrack</p>
      <h1 style={{ marginBottom: 8 }}>Welcome back</h1>
      <p style={{ color: "#667085" }}>Sign in to manage your medication schedules.</p>
      <button onClick={signInWithGoogle} disabled={busy} style={{ width: "100%", marginTop: 24, padding: 14, border: 0, borderRadius: 10, background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" }}>
        {busy ? "Signing in..." : "Continue with Google"}
      </button>
      {error && <p role="alert" style={{ color: "#b42318", fontSize: 14 }}>{error}</p>}
    </section>
  </main>
}
