"use client"

import { FormEvent, useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { useRouter } from "next/navigation"
import { auth } from "../../lib/firebase"
import { createMedication } from "../../lib/medications"

function Icon({ type, size = 26 }: { type: "pill" | "close" | "warning"; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }

  if (type === "close") {
    return <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>
  }

  if (type === "warning") {
    return <svg {...common}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5" /><path d="M12 17.2h.01" /></svg>
  }

  return <svg {...common}><rect x="7" y="2.8" width="10" height="18.4" rx="5" /><path d="M7 12h10" /></svg>
}

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function isPastSchedule(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return false
  const now = new Date()
  const [hours, minutes] = timeValue.split(":").map(Number)
  const scheduled = new Date(`${dateValue}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`)
  return scheduled <= now
}

function scheduleWarning(dateValue: string, timeValue: string) {
  if (!dateValue) return "Please select a start date."
  const today = todayKey()

  if (dateValue < today) {
    return "The start date cannot be in the past. Please choose today or a future date."
  }

  if (dateValue === today && isPastSchedule(dateValue, timeValue)) {
    return "This schedule time has already passed today. Please choose a later time."
  }

  return ""
}

export default function MedicationsPage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [dosage, setDosage] = useState("")
  const [unit, setUnit] = useState("mg")
  const [form, setForm] = useState("Tablet")
  const [frequency, setFrequency] = useState("Once Daily")
  const [time, setTime] = useState("08:00")
  const [startDate, setStartDate] = useState(todayKey())
  const [notes, setNotes] = useState("")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => onAuthStateChanged(auth, user => setUid(user?.uid ?? null)), [])

  const warning = scheduleWarning(startDate, time)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!uid || !name.trim() || !time || warning) return

    setSaving(true)
    setMessage("")

    try {
      await createMedication(uid, {
        name: name.trim(),
        dosage: dosage.trim(),
        unit,
        time,
        active: true,
        form,
        frequency,
        startDate,
        notes: notes.trim(),
      })

      setMessage("Medication added successfully.")
      setTimeout(() => router.push("/dashboard"), 500)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save medication.")
    } finally {
      setSaving(false)
    }
  }

  if (!uid) return null

  return (
    <main className="modal-page">
      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; }
        .modal-page {
          min-height: 100vh;
          background: #edf5f2;
          color: #142234;
          font-family: Arial, Helvetica, sans-serif;
          position: relative;
          overflow: hidden;
        }
        .fake-dashboard {
          position: absolute;
          inset: 0;
          filter: blur(5px);
          opacity: .62;
          pointer-events: none;
        }
        .fake-header {
          height: 144px;
          background: white;
          border-bottom: 1px solid #dce8e4;
          padding: 42px 30px;
        }
        .fake-inner { max-width: 760px; margin: 0 auto; }
        .fake-title { font-size: 38px; font-weight: 800; }
        .fake-subtitle { color: #71808e; margin-top: 8px; }
        .fake-green {
          margin-top: 30px;
          height: 205px;
          border-radius: 30px;
          background: #45ae80;
        }
        .fake-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 24px;
        }
        .fake-stat { height: 135px; background: white; border-radius: 25px; }
        .fake-bottom {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          height: 76px;
          background: white;
        }
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(83, 96, 101, .58);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 24px;
          z-index: 10;
        }
        .modal-card {
          width: min(405px, calc(100vw - 32px));
          max-height: calc(100vh - 28px);
          overflow-y: auto;
          background: #fff;
          border-radius: 28px;
          padding: 22px 22px 20px;
          box-shadow: 0 24px 60px rgba(20, 34, 52, .22);
          position: relative;
        }
        .modal-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .modal-title { margin: 0; font-size: 21px; line-height: 1.15; font-weight: 800; }
        .modal-subtitle { margin: 8px 0 0; color: #71808e; font-size: 13px; line-height: 1.35; }
        .close-button {
          width: 32px;
          height: 32px;
          border: 0;
          background: transparent;
          color: #71808e;
          display: grid;
          place-items: center;
          cursor: pointer;
          margin: -4px -4px 0 8px;
        }
        .field-label { display: block; font-size: 13px; font-weight: 800; margin-bottom: 7px; }
        .field { width: 100%; height: 42px; border: 1px solid #dce7e3; border-radius: 22px; padding: 0 14px; background: #edf4f1; color: #263847; font-size: 14px; outline: none; }
        .field:focus { border-color: #45ae80; box-shadow: 0 0 0 2px rgba(69,174,128,.12); }
        .textarea { height: 72px; padding-top: 12px; resize: vertical; border-radius: 18px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .modal-form { margin-top: 18px; }
        .field-group { margin-top: 13px; }
        .pill-icon {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: #e3eef9;
          color: #4d79a7;
          display: grid;
          place-items: center;
          margin-bottom: 14px;
        }
        .warning-box {
          margin-top: 9px;
          padding: 10px 12px;
          border-radius: 14px;
          background: #fff4e5;
          border: 1px solid #f2c98c;
          color: #9a5b00;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 700;
        }
        .warning-box svg { flex: 0 0 auto; margin-top: 1px; }
        .invalid-field { border-color: #e5a94d !important; background: #fff9ef !important; }
        .create-button {
          width: 100%;
          height: 48px;
          border: 0;
          border-radius: 25px;
          background: #45ae80;
          color: white;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 18px;
          box-shadow: 0 5px 12px rgba(57,145,107,.18);
        }
        .create-button:disabled { opacity: .65; cursor: not-allowed; }
        .message { margin-top: 12px; padding: 10px 12px; border-radius: 14px; font-size: 12px; font-weight: 700; background: #e2f3eb; color: #398f6c; }
        @media (max-width: 600px) {
          .overlay { align-items: center; padding: 12px; }
          .modal-card { width: min(405px, calc(100vw - 24px)); max-height: calc(100vh - 24px); padding: 20px 18px 18px; }
          .modal-title { font-size: 20px; }
          .field { height: 44px; }
        }
      `}</style>

      <div className="fake-dashboard">
        <div className="fake-header">
          <div className="fake-inner">
            <div className="fake-title">Hi, Gly</div>
            <div className="fake-subtitle">Here's your plan for today</div>
          </div>
        </div>
        <div className="fake-inner">
          <div className="fake-green" />
          <div className="fake-stats">
            <div className="fake-stat" />
            <div className="fake-stat" />
            <div className="fake-stat" />
          </div>
        </div>
        <div className="fake-bottom" />
      </div>

      <div className="overlay">
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-medication-title">
          <div className="modal-top">
            <div>
              <h1 id="add-medication-title" className="modal-title">Add medication</h1>
              <p className="modal-subtitle">A few details and your medicine plan is ready.</p>
            </div>
            <button className="close-button" type="button" onClick={() => router.back()} aria-label="Close">
              <Icon type="close" size={21} />
            </button>
          </div>

          <form className="modal-form" onSubmit={submit}>
            <div className="pill-icon"><Icon type="pill" size={28} /></div>

            <div className="field-group" style={{ marginTop: 0 }}>
              <label className="field-label">Medication name</label>
              <input className="field" required placeholder="e.g. Metformin" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="form-grid">
              <div className="field-group">
                <label className="field-label">Dosage</label>
                <input className="field" inputMode="decimal" placeholder="500" value={dosage} onChange={e => setDosage(e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">Unit</label>
                <select className="field" value={unit} onChange={e => setUnit(e.target.value)}>
                  <option>mg</option>
                  <option>g</option>
                  <option>mcg</option>
                  <option>mL</option>
                  <option>IU</option>
                  <option>puff</option>
                  <option>drop</option>
                  <option>unit</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="field-group">
                <label className="field-label">Form</label>
                <select className="field" value={form} onChange={e => setForm(e.target.value)}>
                  <option>Tablet</option>
                  <option>Capsule</option>
                  <option>Liquid</option>
                  <option>Injection</option>
                  <option>Drops</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Frequency</label>
                <select className="field" value={frequency} onChange={e => setFrequency(e.target.value)}>
                  <option>Once Daily</option>
                  <option>Twice Daily</option>
                  <option>Three Times Daily</option>
                  <option>Four Times Daily</option>
                  <option>As Needed</option>
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Times</label>
              <input className={`field ${warning ? "invalid-field" : ""}`} required type="time" value={time} onChange={e => setTime(e.target.value)} />
              {warning && <div className="warning-box"><Icon type="warning" size={17} /><span>{warning}</span></div>}
            </div>

            <div className="field-group">
              <label className="field-label">Start date</label>
              <input className={`field ${warning ? "invalid-field" : ""}`} required type="date" value={startDate} min={todayKey()} onChange={e => setStartDate(e.target.value)} />
              {warning && <div className="warning-box"><Icon type="warning" size={17} /><span>{warning}</span></div>}
            </div>

            <div className="field-group">
              <label className="field-label">Notes (optional)</label>
              <textarea className="field textarea" placeholder="e.g. Take with food" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            {message && <div className="message">{message}</div>}

            <button className="create-button" disabled={saving || !!warning} type="submit">
              {saving ? "Creating..." : "Create medication"}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
