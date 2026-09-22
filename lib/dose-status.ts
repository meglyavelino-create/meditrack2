import { onValue, ref, type Unsubscribe } from "firebase/database"
import { realtimeDb } from "./firebase"

export type DoseStatus = "pending" | "taken" | "missed"
export type DoseStatusRecord = {
  status: DoseStatus
  createdAt?: number
  updatedAt?: number
  takenAt?: number
}

/**
 * The web app is read-only for dose results.
 * It listens for records written by the ESP32 and never creates,
 * changes, or timestamps a dose result.
 */
export function subscribeToDoseStatus(
  uid: string,
  medicationId: string,
  onChange: (records: Record<string, Record<string, DoseStatusRecord>>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(realtimeDb, `doseStatus/${uid}/${medicationId}`),
    snapshot => {
      const value = snapshot.val()
      onChange(value && typeof value === "object" ? value : {})
    },
    error => onError?.(error),
  )
}
