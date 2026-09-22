import { onValue, ref, runTransaction, type Unsubscribe } from "firebase/database"
import { realtimeDb } from "./firebase"

export type DoseStatus = "pending" | "taken" | "missed"
export type DoseStatusRecord = { status: DoseStatus; createdAt?: number; updatedAt?: number; takenAt?: number }

/** Web app reads status in realtime. It never changes an existing status or updatedAt. */
export function subscribeToDoseStatus(uid: string, medicationId: string, onChange: (records: Record<string, Record<string, DoseStatusRecord>>) => void, onError?: (error: Error) => void): Unsubscribe {
  return onValue(ref(realtimeDb, `doseStatus/${uid}/${medicationId}`), snapshot => {
    const value = snapshot.val()
    onChange(value && typeof value === "object" ? value : {})
  }, error => onError?.(error))
}

/** Creates the initial pending record only when that exact dose does not exist. */
export async function createPendingDose(uid: string, medicationId: string, time: string, date = localDateKey()): Promise<void> {
  const doseRef = ref(realtimeDb, `doseStatus/${uid}/${medicationId}/${date}/${time}`)
  await runTransaction(doseRef, current => current ?? { status: "pending", createdAt: Date.now() })
}

function localDateKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
