import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { scrubEvent } from '../services/analytics.ts'

/**
 * Cookieless Vercel Web Analytics and Speed Insights, production builds only.
 * Reported URLs carry no query string or fragment.
 */
export default function WebAnalytics() {
  if (!import.meta.env.PROD) return null
  return (
    <>
      <Analytics mode="production" beforeSend={scrubEvent} />
      <SpeedInsights beforeSend={scrubEvent} />
    </>
  )
}
