import { RouterProvider } from 'react-router-dom'
import WebAnalytics from './app/WebAnalytics.tsx'
import { router } from './router.tsx'

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <WebAnalytics />
    </>
  )
}

export default App
