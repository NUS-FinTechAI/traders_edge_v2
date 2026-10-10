import '../../App.css'
import { useState, useEffect } from 'react'
import authService from '../../services/authService'
import type { UserProfile } from '../../services/authService'

export default function HomePage() {
  const [user, setUser] = useState<string | null>(null)

  useEffect(() => {
    authService.getProfile().then((profile: UserProfile) => setUser(profile.display_name));
  }, [setUser])

  return (
    <main>
      {user === null ? (
        <h1>Welcome!</h1>
      ) : (
        <h1>Welcome, {user}!</h1>
      )}
    </main>
  )
}
