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
 * Realtime read only. The web app never writes status or updatedAt here.
 * ESP32 is the owner of status transitions after a dose is created.
 */
export function subscribeToDoseStatus(
  uid: string,
  medicationId: string,
  onChange: (records: Record<string, Record<string, DoseStatusRecord>>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const doseRef = ref(realtimeDb, `doseStatus/${uid}/${medicationId}`)

  return onValue(
    doseRef,
    (snapshot) => {
      const value = snapshot.val()
      onChange(value && typeof value === "object" ? value : {})
    },
    (error) => onError?.(error),
  )
}
