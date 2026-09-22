"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "../../lib/firebase"
import { useAuthUser } from "../../lib/auth"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuthUser()

  useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, user, router])

  if (loading || !user) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Checking login...</main>

  return <>
    <nav style={{ height: 64, background: "white", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px" }}>
      <strong style={{ color: "#2563eb" }}>MediTrack</strong>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <a href="/dashboard">Dashboard</a>
        <a href="/medications">Add medication</a>
        <button onClick={async () => { await signOut(auth); router.replace("/login") }} style={{ border: "1px solid #d0d5dd", background: "white", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Sign out</button>
      </div>
    </nav>
    {children}
  </>
}
