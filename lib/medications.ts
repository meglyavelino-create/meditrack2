import { push, ref, remove, set, update } from "firebase/database"
import { realtimeDb } from "./firebase"

export type Medication = {
  id: string
  name: string
  dosage: string
  unit: string
  time: string
  active: boolean
  createdAt: number
}

export async function createMedication(uid: string, medication: Omit<Medication, "id" | "createdAt">) {
  const medicationRef = push(ref(realtimeDb, `medications/${uid}`))
  const record: Medication = {
    ...medication,
    id: medicationRef.key!,
    createdAt: Date.now(),
  }
  await set(medicationRef, record)
  return record
}

export async function updateMedication(uid: string, id: string, changes: Partial<Omit<Medication, "id" | "createdAt">>) {
  await update(ref(realtimeDb, `medications/${uid}/${id}`), changes)
}

export async function deleteMedication(uid: string, id: string) {
  await remove(ref(realtimeDb, `medications/${uid}/${id}`))
}
