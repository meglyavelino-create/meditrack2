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

function WifiIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 8.8a15.5 15.5 0 0 1 19 0" />
      <path d="M5.8 12.3a10.5 10.5 0 0 1 12.4 0" />
      <path d="M9.2 15.8a5.5 5.5 0 0 1 5.6 0" />
      <circle cx="12" cy="19.2" r="1" fill="currentColor" stroke="none" />
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
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null)
        router.replace("/login")
        return
      }

      setUser({
        name: u.displayName || "there",
        email: u.email || "",
      })
    })
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
      let missed = 0
      let pending = 0

      if (tree) {
        for (const medication of Object.values(tree)) {
          const doses = medication?.[today]
          if (!doses) continue

          for (const dose of Object.values(doses)) {
            if (dose?.status === "taken") taken += 1
            else if (dose?.status === "missed") missed += 1
            else if (dose?.status === "pending") pending += 1
          }
        }
      }

      setTodayTaken(taken)
      setTodayMissed(missed)
      setTodayPending(pending)
    })

    return () => {
      unsubscribeMedications()
      unsubscribeStatus()
    }
  }, [user])

  if (!user) return null

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
          .profile-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .profile-card { padding: 24px !important; border-radius: 26px !important; }
        }
      `}</style>

      <header style={{ background: "#fff", borderBottom: "1px solid #dce8e4" }}>
        <div className="profile-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "34px 22px 28px" }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1, letterSpacing: -1, fontWeight: 800 }}>
            Profile
          </h1>
          <p style={{ margin: "8px 0 0", color: "#71808e", fontSize: 17 }}>
            Medication overview and device
          </p>
        </div>
      </header>

      <div className="profile-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "28px 22px" }}>
        <section className="profile-card" style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 30, padding: 28 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Medication overview</h2>
          <p style={{ margin: "8px 0 20px", color: "#71808e", fontSize: 15 }}>
            A quick view of your medication activity today.
          </p>

          <div className="profile-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat label="Active" value={count} />
            <Stat label="Taken" value={todayTaken} />
            <Stat label="Pending" value={todayPending} />
            <Stat label="Missed" value={todayMissed} />
          </div>
        </section>

        <section className="profile-card" style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 30, padding: 28, marginTop: 20 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Reminder device</h2>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 58, height: 58, borderRadius: 18, background: "#edf5f2", color: "#3eaa7d", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <WifiIcon size={31} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>ESP32 Medicine Reminder</div>
              <div style={{ marginTop: 5, color: "#71808e", fontSize: 14 }}>
                Wi-Fi connection
              </div>
              <div style={{ marginTop: 3, color: "#71808e", fontSize: 14 }}>
                DS3231 • Firebase Sync
              </div>
            </div>
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
