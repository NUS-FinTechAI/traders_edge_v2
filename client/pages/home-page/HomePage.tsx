import '../../App.css'
import useUser from '../../hooks/useUser.ts'

export default function HomePage() {
  const user = useUser()

  return (
    <main>
      {user === null ? (
        <h1>Welcome!</h1>
      ) : (
        <h1>Welcome, {user.display_name}!</h1>
      )}
    </main>
  )
}
