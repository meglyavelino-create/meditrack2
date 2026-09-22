"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthUser } from "../../lib/auth"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuthUser()

  useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, user, router])

  if (loading || !user) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#eef6f3", color: "#52616d", fontFamily: "Arial, Helvetica, sans-serif" }}>Checking login...</main>

  return <>{children}</>
}
