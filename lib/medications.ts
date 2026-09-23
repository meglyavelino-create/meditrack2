import { push, ref, remove, update } from "firebase/database"
import { realtimeDb } from "./firebase"

export type Medication = {
  id: string
  active: boolean
  createdAt: number
  dosage: string
  form?: string
  frequency?: string
  name: string
  notes?: string
  startDate?: string
  times: Record<string, string>
  unit: string
  updatedAt?: number
  userId?: string
}

export function getMedicationTime(medication: Medication): string {
  return medication.times?.["0"] ?? ""
}

export function getMedicationTimes(medication: Medication): string[] {
  return Object.keys(medication.times ?? {})
    .sort((a, b) => Number(a) - Number(b))
    .map(key => medication.times[key])
    .filter(Boolean)
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function todayKey() {
  return dateKey(new Date())
}

function scheduledTimestamp(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

/**
 * Web fallback for doses that were never handled by the ESP32.
 * A pending dose becomes missed 10 minutes after its scheduled date/time.
 * This also creates missing historical status records for the last 7 days,
 * so an offline device cannot leave an old dose permanently Pending.
 *
 * The current medication model stores one actual time ("times.0").
 * Therefore the web fallback only auto-expires "Once Daily" schedules.
 * Frequencies such as Twice Daily / As Needed need multiple explicit
 * dose times before the web app can safely infer every scheduled dose.
 */
export async function markExpiredPendingDoses(
  uid: string,
  medications: Medication[],
  statusTree: Record<string, Record<string, Record<string, { status?: "pending" | "taken" | "missed" }>>>,
  now = Date.now(),
) {
  const updates: Record<string, unknown> = {}
  const current = new Date(now)
  current.setHours(0, 0, 0, 0)

  for (const medication of medications) {
    if (medication.active === false) continue
    if ((medication.frequency ?? "Once Daily") !== "Once Daily") continue
    const time = getMedicationTime(medication)
    if (!time) continue

    const start = medication.startDate ? new Date(`${medication.startDate}T00:00:00`) : new Date(current)
    start.setHours(0, 0, 0, 0)

    // History is currently seven days, so only backfill that visible period.
    const firstDate = new Date(current)
    firstDate.setDate(firstDate.getDate() - 6)
    const from = start > firstDate ? start : firstDate

    for (const cursor = new Date(from); cursor <= current; cursor.setDate(cursor.getDate() + 1)) {
      const date = dateKey(cursor)
      const existing = statusTree[medication.id]?.[date]?.[time]?.status
      if (existing === "taken" || existing === "missed") continue

      const dueAt = scheduledTimestamp(date, time)
      if (now < dueAt + 10 * 60 * 1000) continue

      updates[`doseStatus/${uid}/${medication.id}/${date}/${time}`] = {
        status: "missed",
        updatedAt: now,
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(realtimeDb), updates)
  }
}

export async function createMedication(
  uid: string,
  medication: {
    name: string
    dosage: string
    unit: string
    time: string
    active: boolean
    form?: string
    frequency?: string
    startDate?: string
    notes?: string
  },
) {
  const medicationRef = push(ref(realtimeDb, `medications/${uid}`))
  const now = Date.now()
  const medicationId = medicationRef.key!
  const startDate = medication.startDate ?? todayKey()
  const time = medication.time

  const record = {
    active: medication.active,
    createdAt: now,
    dosage: medication.dosage,
    form: medication.form ?? "Tablet",
    frequency: medication.frequency ?? "Once Daily",
    name: medication.name,
    notes: medication.notes ?? "",
    startDate,
    times: { "0": time },
    unit: medication.unit,
    updatedAt: now,
    userId: uid,
  }

  await update(ref(realtimeDb), {
    [`medications/${uid}/${medicationId}`]: record,
    [`doseStatus/${uid}/${medicationId}/${startDate}/${time}`]: {
      status: "pending",
      updatedAt: now,
    },
  })

  return { ...record, id: medicationId }
}

export async function updateMedication(
  uid: string,
  medicationId: string,
  medication: {
    name: string
    dosage: string
    unit: string
    time: string
    active: boolean
    form?: string
    frequency?: string
    startDate?: string
    notes?: string
  },
  previousDate: string,
  previousTime: string,
  currentStatus: "pending" | "missed" = "pending",
) {
  const now = Date.now()
  const startDate = medication.startDate ?? todayKey()
  const record = {
    active: medication.active,
    dosage: medication.dosage,
    form: medication.form ?? "Tablet",
    frequency: medication.frequency ?? "Once Daily",
    name: medication.name,
    notes: medication.notes ?? "",
    startDate,
    times: { "0": medication.time },
    unit: medication.unit,
    updatedAt: now,
    userId: uid,
  }

  const updates: Record<string, unknown> = {
    [`medications/${uid}/${medicationId}`]: record,
    [`doseStatus/${uid}/${medicationId}/${previousDate}/${previousTime}`]: null,
    [`doseStatus/${uid}/${medicationId}/${startDate}/${medication.time}`]: {
      status: currentStatus,
      updatedAt: now,
    },
  }

  await update(ref(realtimeDb), updates)
  return { ...record, id: medicationId }
}

export async function deleteMedication(uid: string, id: string) {
  await remove(ref(realtimeDb, `medications/${uid}/${id}`))
  await remove(ref(realtimeDb, `doseStatus/${uid}/${id}`))
}
