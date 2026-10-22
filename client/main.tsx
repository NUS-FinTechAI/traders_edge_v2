import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/global.css'
import App from './App.tsx'
import { reactErrorHandlers, startMonitoring } from './services/monitoring.ts'

startMonitoring()

createRoot(document.getElementById('root')!, reactErrorHandlers()).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
