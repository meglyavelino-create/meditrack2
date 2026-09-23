"use client"

import { onAuthStateChanged } from "firebase/auth"
import { onValue, ref } from "firebase/database"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, realtimeDb } from "../../lib/firebase"
import type { Medication } from "../../lib/medications"

type IconType = "home" | "calendar" | "history" | "profile"

function Icon({ type, size = 27 }: { type: IconType; size?: number }) {
  if (type === "home") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </svg>
    )
  }

  if (type === "calendar") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M7 2.5v4M17 2.5v4M3 9h18" />
      </svg>
    )
  }

  if (type === "history") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 5v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }


  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [count, setCount] = useState(0)
  const [todayTaken, setTodayTaken] = useState(0)
  const [todayMissed, setTodayMissed] = useState(0)
  const [todayPending, setTodayPending] = useState(0)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null)
        router.replace("/login")
        return
      }

      const displayName = u.displayName || "there"
      setUser({ name: displayName, email: u.email || "" })
    })

    return unsubscribe
  }, [router])

  useEffect(() => {
    if (!user) return

    const uid = auth.currentUser?.uid
    if (!uid) return

    const unsubscribeMedications = onValue(ref(realtimeDb, `medications/${uid}`), (snapshot) => {
      const value = snapshot.val() as Record<string, Medication> | null
      const activeCount = value
        ? Object.values(value).filter((medication) => medication.active !== false).length
        : 0
      setCount(activeCount)
    })

    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

    const unsubscribeStatus = onValue(ref(realtimeDb, `doseStatus/${uid}`), (snapshot) => {
      const tree = snapshot.val() as Record<string, Record<string, Record<string, { status?: string }>>> | null
      let taken = 0
      let missedCount = 0
      let pending = 0

      if (tree) {
        for (const medication of Object.values(tree)) {
          const doses = medication?.[today]
          if (!doses) continue
          for (const dose of Object.values(doses)) {
            if (dose?.status === "taken") taken += 1
            else if (dose?.status === "missed") missedCount += 1
            else if (dose?.status === "pending") pending += 1
          }
        }
      }

      setTodayTaken(taken)
      setTodayMissed(missedCount)
      setTodayPending(pending)
    })

    return () => {
      unsubscribeMedications()
      unsubscribeStatus()
    }
  }, [user])


  if (!user) return null

  const initial = (user.name || "G").trim().charAt(0).toUpperCase()

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#edf5f2",
        color: "#142234",
        paddingBottom: 92,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        @media (max-width: 600px) {
          .profile-wrap { padding-left: 16px !important; padding-right: 16px !important; }
          .profile-title { font-size: 32px !important; }
          .profile-card { padding: 24px !important; border-radius: 30px !important; }
          .account-card { padding: 24px !important; }
          .account-avatar { width: 76px !important; height: 76px !important; font-size: 38px !important; }
          .account-name { font-size: 23px !important; }
          .account-email { font-size: 16px !important; }
          .section-title { font-size: 23px !important; }
          .field { height: 56px !important; }
          .setting-title { font-size: 18px !important; }
          .profile-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <header style={{ background: "#fff", borderBottom: "1px solid #dce8e4" }}>
        <div className="profile-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "30px 22px" }}>
        <section className="profile-card" style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 30, padding: 28 }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Medication overview</h2>
          <p style={{ margin: "8px 0 20px", color: "#71808e", fontSize: 15 }}>A quick view of your medication activity today.</p>
          <div className="profile-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat label="Active" value={count} />
            <Stat label="Taken" value={todayTaken} />
            <Stat label="Pending" value={todayPending} />
            <Stat label="Missed" value={todayMissed} />
          </div>
        </section>

        <div style={{ textAlign: "center", padding: "22px 0 8px", color: "#71808e" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#142234" }}>MediTrack</div>
          <div style={{ marginTop: 4, fontSize: 13 }}>Medication Reminder System · v1.0</div>
        </div>
      </div>

      <BottomNav onNavigate={(path) => router.push(path)} />
    </main>
  )
}

function Toggle({ title, subtitle, value, setValue }: { title: string; subtitle: string; value: boolean; setValue: (value: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, padding: "20px 0", borderTop: "1px solid #e5ece9", marginTop: 17 }}>
      <div style={{ minWidth: 0 }}>
        <div className="setting-title" style={{ fontSize: 19, fontWeight: 800 }}>{title}</div>
        <div className="setting-subtitle" style={{ fontSize: 15, color: "#71808e", marginTop: 5 }}>{subtitle}</div>
      </div>
      <button
        onClick={() => setValue(!value)}
        aria-label={title}
        style={{ width: 59, height: 34, border: 0, borderRadius: 20, background: value ? "#45ae80" : "#d5dfdc", padding: 3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: value ? "flex-end" : "flex-start", flexShrink: 0 }}
      >
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "white", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,.12)" }} />
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: 0, padding: "16px 10px", borderRadius: 18, background: "#edf5f2", textAlign: "center" }}>
      <div style={{ fontSize: 25, fontWeight: 800, color: "#142234" }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "#71808e", fontWeight: 700 }}>{label}</div>
    </div>
  )
}

function BottomNav({ onNavigate }: { onNavigate: (path: string) => void }) {
  const items: Array<{ label: string; path: string; icon: IconType }> = [
    { label: "Home", path: "/dashboard", icon: "home" },
    { label: "Schedule", path: "/schedule", icon: "calendar" },
    { label: "History", path: "/history", icon: "history" },
    { label: "Profile", path: "/profile", icon: "profile" },
  ]

  return (
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 76, background: "rgba(255,255,255,.98)", borderTop: "1px solid #dce7e3", display: "flex", justifyContent: "center", zIndex: 20 }}>
      <div style={{ width: "100%", maxWidth: 760, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
        {items.map((item) => {
          const active = item.label === "Profile"
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.path)}
              style={{ border: 0, background: "transparent", color: active ? "#3eaa7d" : "#657786", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontWeight: active ? 800 : 500, cursor: "pointer" }}
            >
              <Icon type={item.icon} size={27} />
              <span style={{ fontSize: 13 }}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
