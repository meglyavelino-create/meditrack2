"use client"

import { onAuthStateChanged } from "firebase/auth"
import { onValue, ref } from "firebase/database"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, realtimeDb } from "../../lib/firebase"
import type { Medication } from "../../lib/medications"

type DoseStatus = "pending" | "taken" | "missed"

type IconType = "pill" | "home" | "calendar" | "history" | "profile" | "plus"

function Icon({ type, size = 25 }: { type: IconType; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }

  if (type === "pill") {
    return (
      <svg {...props}>
        <rect x="7" y="2.8" width="10" height="18.4" rx="5" />
        <path d="M7 12h10" />
      </svg>
    )
  }

  if (type === "home") {
    return (
      <svg {...props}>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </svg>
    )
  }

  if (type === "calendar") {
    return (
      <svg {...props}>
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M7 2.5v4M17 2.5v4M3 9h18" />
      </svg>
    )
  }

  if (type === "history") {
    return (
      <svg {...props}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 5v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }

  if (type === "plus") {
    return (
      <svg {...props}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }

  return (
    <svg {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  )
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatTime(time: string) {
  if (!time || !time.includes(":")) return time
  const [hour, minute] = time.split(":").map(Number)
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function monthTitle(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function timelineTitle(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

export default function SchedulePage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [statuses, setStatuses] = useState<Record<string, DoseStatus>>({})
  const [error, setError] = useState("")

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null)
    })
  }, [])

  useEffect(() => {
    if (!uid) {
      setMedications([])
      return
    }

    const medicationsRef = ref(realtimeDb, `medications/${uid}`)

    return onValue(
      medicationsRef,
      (snapshot) => {
        const value = snapshot.val() as Record<string, Medication> | null
        const list = value
          ? Object.entries(value).map(([id, medication]) => ({
              ...medication,
              id,
            }))
          : []

        setMedications(list)
        setError("")
      },
      (firebaseError) => setError(firebaseError.message),
    )
  }, [uid])

  useEffect(() => {
    setStatuses({})

    if (!uid || medications.length === 0) return

    const selectedDay = dateKey(selectedDate)
    const unsubscribers = medications.map((medication) => {
      const statusRef = ref(
        realtimeDb,
        `doseStatus/${uid}/${medication.id}/${selectedDay}`,
      )

      return onValue(
        statusRef,
        (snapshot) => {
          const value = snapshot.val() as
            | Record<string, { status?: DoseStatus }>
            | null

          setStatuses((previous) => {
            const next = { ...previous }

            Object.entries(value ?? {}).forEach(([time, dose]) => {
              if (dose?.status) {
                next[`${medication.id}|${time}`] = dose.status
              }
            })

            return next
          })
        },
        (firebaseError) => setError(firebaseError.message),
      )
    })

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [uid, medications, selectedDate])

  const activeMedications = useMemo(
    () =>
      medications
        .filter((medication) => medication.active !== false)
        .sort((a, b) => minutes(a.time) - minutes(b.time)),
    [medications],
  )

  const firstDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1,
  )
  const lastDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0,
  )

  const calendarCells: Array<Date | null> = []

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    calendarCells.push(null)
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    calendarCells.push(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day),
    )
  }

  const changeMonth = (amount: number) => {
    setSelectedDate(
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth() + amount,
        1,
      ),
    )
  }

  const isSelected = (date: Date) => dateKey(date) === dateKey(selectedDate)
  const isToday = (date: Date) => dateKey(date) === dateKey(new Date())

  if (!uid) return null

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#edf5f2",
        color: "#142234",
        paddingBottom: 82,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        @media (max-width: 600px) {
          .schedule-wrap { padding-left: 16px !important; padding-right: 16px !important; }
          .schedule-header { padding-top: 38px !important; padding-bottom: 28px !important; }
          .schedule-title { font-size: 34px !important; }
          .calendar-card { padding: 22px 14px 20px !important; }
          .day-cell { height: 54px !important; }
          .timeline-card { padding: 15px 14px !important; }
          .timeline-name { font-size: 18px !important; }
          .bottom-nav { height: 76px !important; }
        }
      `}</style>

      <header
        style={{
          background: "white",
          borderBottom: "1px solid #dce8e4",
        }}
      >
        <div
          className="schedule-wrap schedule-header"
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "38px 22px 30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div>
            <h1
              className="schedule-title"
              style={{
                margin: 0,
                fontSize: 40,
                lineHeight: 1.05,
                letterSpacing: -1.1,
                fontWeight: 800,
              }}
            >
              Schedule
            </h1>
            <p
              style={{
                margin: "9px 0 0",
                color: "#71808e",
                fontSize: 18,
              }}
            >
              {monthTitle(selectedDate)}
            </p>
          </div>

          <button
            onClick={() => router.push("/medications")}
            aria-label="Add medication"
            style={{
              width: 64,
              height: 64,
              border: 0,
              borderRadius: "50%",
              background: "#45ae80",
              color: "white",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: "0 7px 18px rgba(57,145,107,.18)",
            }}
          >
            <Icon type="plus" size={34} />
          </button>
        </div>
      </header>

      <div
        className="schedule-wrap"
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "30px 22px",
        }}
      >
        {error && (
          <div
            style={{
              background: "#fff1f0",
              color: "#b42318",
              padding: 14,
              borderRadius: 14,
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        <section
          className="calendar-card"
          style={{
            background: "white",
            border: "1px solid #dce7e3",
            borderRadius: 30,
            padding: "27px 25px 22px",
            boxShadow: "0 4px 14px rgba(20,34,52,.03)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
            <button
              onClick={() => changeMonth(-1)}
              style={{
                border: 0,
                background: "transparent",
                color: "#718494",
                fontSize: 32,
                cursor: "pointer",
              }}
            >
              ‹
            </button>

            <div style={{ fontSize: 19, fontWeight: 800 }}>
              {monthTitle(selectedDate)}
            </div>

            <button
              onClick={() => changeMonth(1)}
              style={{
                border: 0,
                background: "transparent",
                color: "#718494",
                fontSize: 32,
                cursor: "pointer",
              }}
            >
              ›
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              textAlign: "center",
              color: "#718494",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <div key={`${day}-${index}`} style={{ padding: "8px 0" }}>
                {day}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
            }}
          >
            {calendarCells.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="day-cell"
                    style={{ height: 64 }}
                  />
                )
              }

              const selected = isSelected(date)
              const today = isToday(date)

              return (
                <button
                  className="day-cell"
                  key={dateKey(date)}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    height: 64,
                    border: 0,
                    background: "transparent",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    cursor: "pointer",
                    color: "#142234",
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: selected ? "#45ae80" : "transparent",
                      color: selected ? "white" : "#142234",
                      fontSize: 16,
                      fontWeight: selected || today ? 800 : 500,
                    }}
                  >
                    {date.getDate()}
                  </span>

                  {activeMedications.length > 0 && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#4779a8",
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <h2 style={{ margin: "27px 0 18px", fontSize: 23 }}>
          Timeline · {timelineTitle(selectedDate)}
        </h2>

        {activeMedications.length === 0 ? (
          <div
            style={{
              background: "white",
              borderRadius: 25,
              padding: 28,
              textAlign: "center",
              border: "1px solid #dce7e3",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              No medications scheduled
            </div>
            <p style={{ color: "#71808e" }}>
              Add a medication to create your schedule.
            </p>
          </div>
        ) : (
          <div style={{ position: "relative", paddingLeft: 22 }}>
            <div
              style={{
                position: "absolute",
                left: 7,
                top: 15,
                bottom: 18,
                width: 2,
                background: "#dfe9e5",
              }}
            />

            {activeMedications.map((medication, index) => {
              const status =
                statuses[`${medication.id}|${medication.time}`] ?? "pending"
              const statusColor =
                status === "taken"
                  ? "#3da57b"
                  : status === "missed"
                    ? "#d95d63"
                    : "#e19a2f"

              return (
                <article
                  className="timeline-card"
                  key={medication.id}
                  style={{
                    position: "relative",
                    background: "white",
                    border: "1px solid #dce7e3",
                    borderRadius: 25,
                    padding: "15px 17px",
                    marginBottom: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: -20,
                      top: 23,
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: statusColor,
                      border: "2px solid #edf5f2",
                    }}
                  />

                  <div
                    style={{
                      width: 54,
                      height: 54,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: index % 2 === 0 ? "#e4effa" : "#eee4fa",
                      color: index % 2 === 0 ? "#4b79a8" : "#8964c5",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon type="pill" size={25} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      className="timeline-name"
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {medication.name}
                    </div>
                    <div
                      style={{
                        color: "#71808e",
                        fontSize: 15,
                        marginTop: 3,
                      }}
                    >
                      {medication.dosage} {medication.unit} · Once Daily
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                      {formatTime(medication.time)}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        color: statusColor,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <nav
        className="bottom-nav"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 76,
          background: "rgba(255,255,255,.98)",
          borderTop: "1px solid #dce7e3",
          display: "flex",
          justifyContent: "center",
          zIndex: 20,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 760,
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
          }}
        >
          {[
            { label: "Home", icon: "home" as const, path: "/dashboard" },
            {
              label: "Schedule",
              icon: "calendar" as const,
              path: "/schedule",
            },
            { label: "History", icon: "history" as const, path: "/history" },
            { label: "Profile", icon: "profile" as const, path: "/profile" },
          ].map((item) => {
            const active = item.label === "Schedule"

            return (
              <button
                key={item.label}
                onClick={() => router.push(item.path)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: active ? "#3eaa7d" : "#657786",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  fontWeight: active ? 800 : 500,
                  cursor: "pointer",
                }}
              >
                <Icon type={item.icon} size={27} />
                <span style={{ fontSize: 13 }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </main>
  )
}
