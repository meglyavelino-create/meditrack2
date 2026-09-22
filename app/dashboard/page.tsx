"use client"

import { onValue, ref } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, realtimeDb } from "../../lib/firebase"
import type { Medication } from "../../lib/medications"

type DoseStatus = "pending" | "taken" | "missed"

type UserInfo = {
  uid: string
  name: string
  email: string
}

function Icon({ type, size = 25 }: { type: "pill" | "check" | "clock" | "trend" | "home" | "calendar" | "history" | "profile"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (type === "pill") return <svg {...common}><rect x="7" y="2.8" width="10" height="18.4" rx="5"/><path d="M7 12h10"/></svg>
  if (type === "check") return <svg {...common}><path d="m5 12 4 4 10-10"/></svg>
  if (type === "clock") return <svg {...common}><circle cx="12" cy="12" r="8.7"/><path d="M12 7v5l3 2"/></svg>
  if (type === "trend") return <svg {...common}><path d="M4 16 9 11l3 3 7-8"/><path d="M14 6h5v5"/></svg>
  if (type === "home") return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>
  if (type === "calendar") return <svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18"/></svg>
  if (type === "history") return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 5v5h5"/><path d="M12 7v5l3 2"/></svg>
  return <svg {...common}><circle cx="12" cy="8" r="3.2"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>
}

function formatTime(time: string) {
  if (!time || !time.includes(":")) return time
  const [h, m] = time.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

function minutesFromTime(time: string) {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [statuses, setStatuses] = useState<Record<string, DoseStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      if (!currentUser) {
        setUser(null)
        return
      }
      setUser({
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email?.split("@")[0] || "there",
        email: currentUser.email || "",
      })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!user) {
      setMedications([])
      setStatuses({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")
    return onValue(ref(realtimeDb, `medications/${user.uid}`), snapshot => {
      const value = snapshot.val() as Record<string, Medication> | null
      setMedications(value ? Object.entries(value).map(([id, medication]) => ({ ...medication, id })) : [])
      setLoading(false)
    }, e => {
      setError(e.message)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!user || medications.length === 0) return
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const unsubscribers = medications.map(medication => onValue(
      ref(realtimeDb, `doseStatus/${user.uid}/${medication.id}/${dateKey}`),
      snapshot => {
        const value = snapshot.val() as Record<string, { status?: DoseStatus }> | null
        setStatuses(previous => {
          const next = { ...previous }
          for (const [time, dose] of Object.entries(value ?? {})) {
            if (dose?.status === "pending" || dose?.status === "taken" || dose?.status === "missed") {
              next[`${medication.id}|${time}`] = dose.status
            }
          }
          return next
        })
      },
      e => setError(e.message)
    ))
    return () => unsubscribers.forEach(unsubscribe => unsubscribe())
  }, [user, medications, now.getDate(), now.getMonth(), now.getFullYear()])

  const todayDoses = useMemo(() => medications.filter(m => m.active !== false).map(medication => {
    const time = medication.time || "--:--"
    return { medication, time, status: statuses[`${medication.id}|${time}`] ?? "pending" as DoseStatus }
  }).sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time)), [medications, statuses])

  const taken = todayDoses.filter(d => d.status === "taken").length
  const missed = todayDoses.filter(d => d.status === "missed").length
  const completed = taken + missed
  const adherence = completed ? Math.round((taken / completed) * 100) : 0

  const nextDose = todayDoses.find(d => d.status === "pending" && minutesFromTime(d.time) >= now.getHours() * 60 + now.getMinutes()) || todayDoses.find(d => d.status === "pending")

  const countdown = useMemo(() => {
    if (!nextDose) return "All done"
    let target = new Date(now)
    const [h, m] = nextDose.time.split(":").map(Number)
    target.setHours(h, m, 0, 0)
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
    const diff = Math.max(0, target.getTime() - now.getTime())
    const totalMinutes = Math.floor(diff / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h ${String(minutes).padStart(2, "0")}m`
  }, [nextDose, now])

  const firstName = user?.name?.split(" ")[0] || "there"

  if (!user) return null

  return (
    <main style={{ minHeight: "calc(100vh - 1px)", background: "#eef6f3", color: "#142234", paddingBottom: 92 }}>
      <section style={{ background: "white", borderBottom: "1px solid #dfe9e5" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "42px 24px 34px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18 }}>
            <div>
              <div style={{ color: "#43ae82", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>MediTrack</div>
              <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.05, letterSpacing: -1.4 }}>Hi, {firstName}</h1>
              <p style={{ margin: "12px 0 0", color: "#71808e", fontSize: 21 }}>Here's your plan for today</p>
            </div>
            <button onClick={() => router.push("/medications")} aria-label="Add medication" style={{ width: 72, height: 72, border: 0, borderRadius: "50%", background: "#45b083", color: "white", fontSize: 42, lineHeight: 1, cursor: "pointer", boxShadow: "0 8px 18px rgba(57,145,107,.18)" }}>+</button>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "30px 24px" }}>
        {error && <div style={{ background: "#fff1f0", color: "#b42318", padding: 14, borderRadius: 14, marginBottom: 18 }}>Firebase error: {error}</div>}

        <section style={{ background: "#45ae80", borderRadius: 32, padding: "34px 34px 28px", color: "white", boxShadow: "0 14px 30px rgba(55,145,106,.15)" }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 1.1, opacity: .92 }}>NEXT DOSE IN</div>
          <div style={{ fontSize: 66, lineHeight: 1.05, fontWeight: 800, margin: "10px 0 22px", letterSpacing: -2 }}>{countdown}</div>
          {nextDose ? (
            <div style={{ background: "rgba(255,255,255,.18)", borderRadius: 24, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 25, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextDose.medication.name}</div>
                <div style={{ marginTop: 4, fontSize: 18, opacity: .9 }}>{nextDose.medication.dosage} {nextDose.medication.unit}</div>
              </div>
              <div style={{ flexShrink: 0, background: "rgba(255,255,255,.24)", padding: "10px 17px", borderRadius: 30, fontSize: 20, fontWeight: 800 }}>{formatTime(nextDose.time)}</div>
            </div>
          ) : <div style={{ background: "rgba(255,255,255,.16)", borderRadius: 22, padding: 20, fontSize: 18 }}>No pending doses for today.</div>}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 24 }}>
          {[
            { icon: "check" as const, value: taken, label: "Taken", color: "#3aa87d" },
            { icon: "clock" as const, value: missed, label: "Missed", color: "#df5d64" },
            { icon: "trend" as const, value: `${adherence}%`, label: "Adherence", color: "#3c6ea4" },
          ].map(card => <div key={card.label} style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 28, padding: "22px 20px", minHeight: 142 }}>
            <div style={{ color: card.color, marginBottom: 12 }}><Icon type={card.icon} size={28} /></div>
            <div style={{ fontSize: 39, lineHeight: 1, fontWeight: 800 }}>{card.value}</div>
            <div style={{ color: "#73818d", fontSize: 18, marginTop: 9 }}>{card.label}</div>
          </div>)}
        </section>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "36px 2px 18px" }}>
          <h2 style={{ margin: 0, fontSize: 28, letterSpacing: -.5 }}>Today's doses</h2>
          <button onClick={() => router.push("/medications")} style={{ border: 0, background: "transparent", color: "#3ca77b", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>Manage</button>
        </div>

        {loading ? <div style={{ background: "white", borderRadius: 24, padding: 28, color: "#71808e" }}>Loading your medications...</div> : todayDoses.length === 0 ? (
          <div style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 26, padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 21, fontWeight: 800 }}>No medications yet</div>
            <p style={{ color: "#71808e" }}>Add your first medication schedule to start tracking doses.</p>
            <button onClick={() => router.push("/medications")} style={{ border: 0, background: "#45ae80", color: "white", borderRadius: 18, padding: "13px 22px", fontWeight: 800, cursor: "pointer" }}>Add medication</button>
          </div>
        ) : <div style={{ display: "grid", gap: 13 }}>
          {todayDoses.map(({ medication, time, status }) => {
            const takenDose = status === "taken"
            const missedDose = status === "missed"
            return <article key={medication.id} style={{ background: "white", border: "1px solid #dce7e3", borderRadius: 25, padding: "17px 18px", display: "flex", alignItems: "center", gap: 15 }}>
              <div style={{ width: 58, height: 58, flexShrink: 0, borderRadius: "50%", background: "#e5effa", color: "#4b79a8", display: "grid", placeItems: "center" }}><Icon type="pill" size={27} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 21, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{medication.name}</div>
                <div style={{ color: "#71808e", fontSize: 17, marginTop: 3 }}>{medication.dosage} {medication.unit} · {formatTime(time)}</div>
              </div>
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 7, background: takenDose ? "#dff2e9" : missedDose ? "#fde6e6" : "#eef1f2", color: takenDose ? "#3b9f78" : missedDose ? "#cf5058" : "#667784", borderRadius: 22, padding: "10px 15px", fontWeight: 800 }}>
                <Icon type={takenDose ? "check" : "clock"} size={18} /> {takenDose ? "Taken" : missedDose ? "Missed" : "Pending"}
              </div>
            </article>
          })}
        </div>}
      </div>

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 76, background: "rgba(255,255,255,.98)", borderTop: "1px solid #dce7e3", display: "flex", justifyContent: "center", zIndex: 20 }}>
        <div style={{ width: "100%", maxWidth: 820, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
          {[
            { label: "Home", icon: "home" as const, active: true, action: () => router.push("/dashboard") },
            { label: "Schedule", icon: "calendar" as const, active: false, action: () => router.push("/medications") },
            { label: "History", icon: "history" as const, active: false, action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) },
            { label: "Profile", icon: "profile" as const, active: false, action: () => alert(`${user.name}\n${user.email}`) },
          ].map(item => <button key={item.label} onClick={item.action} style={{ border: 0, background: "transparent", color: item.active ? "#3eaa7d" : "#657786", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontWeight: item.active ? 800 : 500, cursor: "pointer" }}>
            <Icon type={item.icon} size={27} />
            <span style={{ fontSize: 13 }}>{item.label}</span>
          </button>)}
        </div>
      </nav>
    </main>
  )
}
