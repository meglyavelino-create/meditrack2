import { onAuthStateChanged, type User } from "firebase/auth"
import { useEffect, useState } from "react"
import { auth } from "./firebase"

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
