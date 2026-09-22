import { push, ref, remove, set } from "firebase/database"
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
    times: {
      "0": time,
    },
    unit: medication.unit,
    updatedAt: now,
    userId: uid,
  }

  // Create the medication and its initial dose status together.
  // The web app creates the schedule as PENDING, while the ESP32 changes
  // the status to TAKEN or MISSED after the scheduled dose.
  await set(ref(realtimeDb), {
    [`medications/${uid}/${medicationId}`]: record,
    [`doseStatus/${uid}/${medicationId}/${startDate}/${time}`]: {
      status: "pending",
      updatedAt: now,
    },
  })

  return {
    ...record,
    id: medicationId,
  }
}

export async function deleteMedication(uid: string, id: string) {
  await remove(ref(realtimeDb, `medications/${uid}/${id}`))
}
