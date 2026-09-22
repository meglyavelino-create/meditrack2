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

  const record = {
    active: medication.active,
    createdAt: now,
    dosage: medication.dosage,
    form: medication.form ?? "Tablet",
    frequency: medication.frequency ?? "Once Daily",
    name: medication.name,
    notes: medication.notes ?? "",
    startDate: medication.startDate ?? "",
    times: {
      "0": medication.time,
    },
    unit: medication.unit,
    updatedAt: now,
    userId: uid,
  }

  await set(medicationRef, record)

  return {
    ...record,
    id: medicationRef.key!,
  }
}

export async function deleteMedication(uid: string, id: string) {
  await remove(ref(realtimeDb, `medications/${uid}/${id}`))
}
