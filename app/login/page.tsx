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

  return (
    <main className="min-h-dvh bg-[#eef6f3]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[380px] flex-col justify-center px-4 py-10">
        <div className="w-full">
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-[#d9efe6] text-[#43ad7e]">
            <HeartPulse className="h-[31px] w-[31px]" strokeWidth={2.1} />
          </div>

          <h1 className="mt-5 text-[34px] font-bold leading-[1.12] tracking-[-0.8px] text-[#142535]">
            MediTrack
          </h1>

          <p className="mt-2 max-w-[330px] text-[15px] leading-[1.55] text-[#61798d]">
            Never miss a dose. Track every intake with confidence.
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="mt-9 flex h-[51px] w-full items-center justify-center gap-2.5 rounded-full bg-[#43ad7e] px-5 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(67,173,126,0.24)] transition hover:bg-[#3ca574] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="flex h-[23px] w-[23px] items-center justify-center rounded-full bg-white">
              <GoogleGlyph />
            </span>
            {busy ? "Signing in…" : "Continue with Google"}
          </button>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <p className="mx-auto mt-7 max-w-[330px] text-center text-[10px] leading-[1.55] text-[#71899b]">
            By continuing you agree to the MediTrack terms of use and privacy policy.
          </p>
        </div>
      </div>
    </main>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
