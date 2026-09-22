"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth"
import { HeartPulse } from "lucide-react"
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

  const styles = {
    main: {
      minHeight: "100dvh",
      width: "100%",
      background: "#eef6f3",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      boxSizing: "border-box" as const,
    },
    card: {
      width: "100%",
      maxWidth: "380px",
      boxSizing: "border-box" as const,
    },
    iconBox: {
      width: "58px",
      height: "58px",
      borderRadius: "18px",
      background: "#d9efe6",
      color: "#43ad7e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      margin: "20px 0 0",
      fontSize: "34px",
      lineHeight: "1.12",
      fontWeight: 700,
      letterSpacing: "-0.8px",
      color: "#142535",
    },
    subtitle: {
      margin: "8px 0 0",
      maxWidth: "330px",
      fontSize: "15px",
      lineHeight: 1.55,
      color: "#61798d",
    },
    button: {
      marginTop: "36px",
      width: "100%",
      height: "51px",
      border: "none",
      borderRadius: "999px",
      background: "#43ad7e",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      padding: "0 20px",
      fontSize: "15px",
      fontWeight: 600,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.7 : 1,
      boxShadow: "0 8px 18px rgba(67,173,126,0.24)",
    },
    googleCircle: {
      width: "23px",
      height: "23px",
      borderRadius: "50%",
      background: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    error: {
      margin: "16px 0 0",
      padding: "10px 14px",
      borderRadius: "12px",
      background: "#fff0f0",
      color: "#dc2626",
      fontSize: "14px",
      fontWeight: 500,
    },
    terms: {
      margin: "28px auto 0",
      maxWidth: "330px",
      textAlign: "center" as const,
      fontSize: "10px",
      lineHeight: 1.55,
      color: "#71899b",
    },
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.iconBox}>
          <HeartPulse style={{ width: 31, height: 31 }} strokeWidth={2.1} />
        </div>

        <h1 style={styles.title}>MediTrack</h1>

        <p style={styles.subtitle}>
          Never miss a dose. Track every intake with confidence.
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          style={styles.button}
        >
          <span style={styles.googleCircle}>
            <GoogleGlyph />
          </span>
          {busy ? "Signing in…" : "Continue with Google"}
        </button>

        {error && (
          <p role="alert" style={styles.error}>
            {error}
          </p>
        )}

        <p style={styles.terms}>
          By continuing you agree to the MediTrack terms of use and privacy policy.
        </p>
      </div>
    </main>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
