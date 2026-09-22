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

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
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
