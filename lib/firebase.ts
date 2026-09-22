import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getDatabase } from "firebase/database"

// These are Firebase Web SDK configuration values. They identify the Firebase
// project; database/auth security is enforced by Firebase Authentication and RTDB rules.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBeDaQh1L4YQ6utPb4rspvVv56PRAvH2cU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "meditrack-735fa.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "https://meditrack-735fa-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "meditrack-735fa",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "meditrack-735fa.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "811076289572",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:811076289572:web:dbe42987acc43b097544b1",
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const realtimeDb = getDatabase(firebaseApp)
