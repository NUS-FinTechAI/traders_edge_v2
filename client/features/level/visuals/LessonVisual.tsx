import {
  Component,
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react'
import s from './visuals.module.css'

type Visual = LazyExoticComponent<ComponentType>

const visuals: Record<string, Visual> = {
  'ownership-slider': lazy(() => import('./items/OwnershipSlider.tsx')),
  'market-cap-compare': lazy(() => import('./items/MarketCapCompare.tsx')),
  'supply-demand': lazy(() => import('./items/SupplyDemand.tsx')),
  'gap-chart': lazy(() => import('./items/GapChart.tsx')),
  'candle-anatomy': lazy(() => import('./items/CandleAnatomy.tsx')),
  'candle-patterns': lazy(() => import('./items/CandlePatterns.tsx')),
  'trend-lines': lazy(() => import('./items/TrendLines.tsx')),
  'support-resistance': lazy(() => import('./items/SupportResistance.tsx')),
  'volume-bars': lazy(() => import('./items/VolumeBars.tsx')),
  'order-book': lazy(() => import('./items/OrderBook.tsx')),
  'bid-ask-spread': lazy(() => import('./items/BidAskSpread.tsx')),
  'order-types': lazy(() => import('./items/OrderTypes.tsx')),
  'limit-vs-market': lazy(() => import('./items/LimitVsMarket.tsx')),
  'stop-loss': lazy(() => import('./items/StopLoss.tsx')),
  'position-size': lazy(() => import('./items/PositionSize.tsx')),
  'risk-reward': lazy(() => import('./items/RiskReward.tsx')),
  diversification: lazy(() => import('./items/Diversification.tsx')),
  'drawdown-recovery': lazy(() => import('./items/DrawdownRecovery.tsx')),
  'moving-average': lazy(() => import('./items/MovingAverage.tsx')),
  rsi: lazy(() => import('./items/Rsi.tsx')),
  macd: lazy(() => import('./items/Macd.tsx')),
  earnings: lazy(() => import('./items/Earnings.tsx')),
  'pe-ratio': lazy(() => import('./items/PeRatio.tsx')),
  'news-impact': lazy(() => import('./items/NewsImpact.tsx')),
  'bubble-cycle': lazy(() => import('./items/BubbleCycle.tsx')),
  'emotion-cycle': lazy(() => import('./items/EmotionCycle.tsx')),
}

/** A visual that fails to load leaves the card's text readable. */
class VisualBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Interactive or illustrative visual for a lesson card, keyed by `card.visual`. */
export default function LessonVisual({ name }: { name?: string | null }) {
  const Visual = name && Object.hasOwn(visuals, name) ? visuals[name] : null
  if (!Visual) return null
  return (
    <VisualBoundary key={name}>
      <Suspense
        fallback={
          <div
            className={s.skeleton}
            role="status"
            aria-label="Loading visual"
          />
        }
      >
        <Visual />
      </Suspense>
    </VisualBoundary>
  )
}
