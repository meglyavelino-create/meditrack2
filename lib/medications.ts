import { push, ref, remove, runTransaction, update } from "firebase/database"
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

function validateMedicationInput(medication: {
  name: string
  dosage: string
  unit: string
  time: string
  form?: string
  frequency?: string
  startDate?: string
}) {
  if (!medication.name.trim()) throw new Error("Medication name is required.")
  if (!medication.dosage.trim()) throw new Error("Dosage is required.")

  const dosage = Number(medication.dosage)
  if (!Number.isFinite(dosage) || dosage <= 0) {
    throw new Error("Dosage must be greater than 0.")
  }

  if (!medication.unit.trim()) throw new Error("Unit is required.")
  if (!medication.form?.trim()) throw new Error("Form is required.")
  if (!medication.frequency?.trim()) throw new Error("Frequency is required.")
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(medication.time)) {
    throw new Error("A valid schedule time is required.")
  }
  if (!medication.startDate?.trim()) throw new Error("Start date is required.")
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

      // Do not use the listener snapshot as the final authority here.
      // It can be briefly stale while the ESP32 is writing "taken".
      // The transaction checks Firebase's current value and will retry
      // automatically if another writer changes it at the same time.
      updates[`doseStatus/${uid}/${medication.id}/${date}/${time}`] = {
        status: "missed",
        updatedAt: now,
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await Promise.all(
      Object.entries(updates).map(async ([path, value]) => {
        await runTransaction(ref(realtimeDb, path), current => {
          const currentStatus =
            current && typeof current === "object"
              ? (current as { status?: string }).status
              : undefined

          // ESP32 "taken" and an already-recorded "missed" result are
          // authoritative and must never be overwritten by the web fallback.
          if (currentStatus === "taken" || currentStatus === "missed") {
            return current
          }

          return value
        })
      }),
    )
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
  validateMedicationInput(medication)

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
  validateMedicationInput(medication)

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

  // If a missed dose is rescheduled to a date/time in the future,
  // it becomes a new pending dose. A missed result should remain
  // missed only when the edited schedule is not moved forward.
  const newScheduleAt = scheduledTimestamp(startDate, medication.time)
  const statusAfterEdit =
    currentStatus === "missed" && newScheduleAt > now
      ? "pending"
      : currentStatus

  const updates: Record<string, unknown> = {
    [`medications/${uid}/${medicationId}`]: record,
    [`doseStatus/${uid}/${medicationId}/${previousDate}/${previousTime}`]: null,
    [`doseStatus/${uid}/${medicationId}/${startDate}/${medication.time}`]: {
      status: statusAfterEdit,
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
