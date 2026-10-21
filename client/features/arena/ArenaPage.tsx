import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  cancelOrder,
  controlClock,
  createGame,
  finishGame,
  getResult,
  placeOrder,
  startGame,
  type ClockAction,
  type CreateGameRequest,
  type GameResult,
  type GameState,
  type Order,
  type OrderRequest,
  type Plan,
} from '../../services/gameService.ts'
import { ErrorState, Loading } from '../../ui/States.tsx'
import { formatMoney } from '../../ui/format.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'
import { chapterOf, isEnded, levelOf } from './arenaLogic.ts'
import BriefingScreen from './briefing/BriefingScreen.tsx'
import ResultsScreen from './results/ResultsScreen.tsx'
import TradingScreen from './trading/TradingScreen.tsx'
import useGame from './useGame.ts'

interface PendingStop {
  symbol: string
  qty: number
  stop: number
}

function placedMessage(
  order: OrderRequest,
  state: GameState | null,
  orderId: string,
) {
  const fill = state?.me.fills.find((item) => item.order_id === orderId)
  if (fill) {
    return `${fill.side === 'buy' ? 'Bought' : 'Sold'} ${fill.qty} ${fill.symbol} at ${formatMoney(fill.price)}`
  }
  if (order.type === 'limit') {
    return `${order.side === 'buy' ? 'Buy' : 'Sell'} limit placed: ${order.qty} ${order.symbol} at ${formatMoney(order.limit_price ?? 0)}`
  }
  if (order.type === 'stop') {
    return `Stop-loss placed: ${order.qty} ${order.symbol} at ${formatMoney(order.stop_price ?? 0)}`
  }
  return `${order.side === 'buy' ? 'Buy' : 'Sell'} order sent: ${order.qty} ${order.symbol}`
}

function replayRequest(state: GameState): CreateGameRequest {
  const request: CreateGameRequest = { mode: state.mode }
  const level = levelOf(state)
  const chapter = chapterOf(state)
  if (state.mode === 'level' && level) request.level_id = level
  if (state.mode === 'boss' && chapter) request.chapter_id = chapter
  if (state.boss) request.boss = state.boss
  if (state.mode === 'practice' || (state.mode === 'level' && !level)) {
    request.scenario_id = state.scenario.id
  }
  return request
}

function Arena({ gameId }: { gameId: string }) {
  const navigate = useNavigate()
  const notify = useToast()
  const { state, loadError, reconnecting, refresh, accept, stop } =
    useGame(gameId)
  const [result, setResult] = useState<GameResult | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [clockBusy, setClockBusy] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const finishing = useRef(false)
  const pendingStops = useRef(new Map<string, PendingStop>())

  const shownResult = result ?? state?.result ?? null
  const ended = state ? isEnded(state) : false
  const phase = !state
    ? 'loading'
    : shownResult
      ? 'results'
      : state.status === 'briefing'
        ? 'briefing'
        : 'trading'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])

  const settle = useCallback(
    (forfeit: boolean) => {
      finishing.current = true
      setFinishError(null)
      const request =
        state?.status === 'settled' && !forfeit
          ? getResult(gameId)
          : finishGame(gameId, forfeit ? { forfeit: true } : {})
      return request.then(
        (value) => {
          stop()
          setResult(value)
        },
        (error: unknown) => {
          finishing.current = false
          setFinishError(errorText(error))
          throw error
        },
      )
    },
    [gameId, state?.status, stop],
  )

  useEffect(() => {
    if (!state || shownResult || finishing.current || !ended || finishError)
      return
    settle(false).catch(() => undefined)
  }, [state, shownResult, ended, finishError, settle])

  useEffect(() => {
    if (shownResult) stop()
  }, [shownResult, stop])

  // Place an attached stop-loss once the buy it protects has filled.
  useEffect(() => {
    if (!state || ended) return
    for (const [orderId, pending] of pendingStops.current) {
      const order = state.me.orders.find((item) => item.id === orderId)
      if (order?.status === 'cancelled') {
        pendingStops.current.delete(orderId)
        continue
      }
      if (!state.me.fills.some((fill) => fill.order_id === orderId)) continue
      pendingStops.current.delete(orderId)
      placeOrder(gameId, {
        symbol: pending.symbol,
        side: 'sell',
        type: 'stop',
        qty: pending.qty,
        stop_price: pending.stop,
      }).then(
        (placed) => {
          accept(placed.state)
          notify(
            `Stop-loss set: ${pending.qty} ${pending.symbol} at ${formatMoney(pending.stop)}`,
            'success',
          )
        },
        (error: unknown) =>
          notify(`Stop-loss not placed: ${errorText(error)}`, 'error'),
      )
    }
  }, [state, ended, gameId, notify, accept])

  const onClock = useCallback(
    (action: ClockAction, speed?: 1 | 2 | 4) => {
      setClockBusy(true)
      controlClock(gameId, action, speed)
        .then(accept)
        .catch((error: unknown) => notify(errorText(error), 'error'))
        .finally(() => setClockBusy(false))
    },
    [gameId, notify, accept],
  )

  async function onPlace(order: OrderRequest, attachStop: number | null) {
    const placed = await placeOrder(gameId, order)
    if (attachStop !== null) {
      pendingStops.current.set(placed.order.id, {
        symbol: order.symbol,
        qty: order.qty,
        stop: attachStop,
      })
    }
    const latest = accept(placed.state)
    notify(placedMessage(order, latest, placed.order.id), 'success')
  }

  function onCancel(order: Order) {
    setCancelling(order.id)
    cancelOrder(gameId, order.id)
      .then(accept)
      .then(() =>
        notify(`Order cancelled: ${order.qty} ${order.symbol}`, 'info'),
      )
      .catch((error: unknown) => notify(errorText(error), 'error'))
      .finally(() => setCancelling(null))
  }

  async function onStart(plan: Plan) {
    accept(await startGame(gameId, plan))
  }

  async function onTryAgain() {
    if (!state) return
    try {
      const next = await createGame(replayRequest(state))
      navigate(`/game/${encodeURIComponent(next.id)}`)
    } catch (error) {
      notify(errorText(error), 'error')
    }
  }

  async function onSaveReflection(text: string) {
    setResult(await finishGame(gameId, { reflection: text }))
    notify('Reflection saved', 'success')
  }

  if (!state) {
    if (loadError)
      return <ErrorState message={loadError} onRetry={() => void refresh()} />
    return <Loading label="Loading the market…" />
  }

  if (shownResult) {
    return (
      <ResultsScreen
        state={state}
        result={shownResult}
        onSaveReflection={onSaveReflection}
        onTryAgain={onTryAgain}
      />
    )
  }

  if (ended) {
    return finishError ? (
      <ErrorState
        message={finishError}
        onRetry={() => {
          settle(false).catch(() => undefined)
        }}
      />
    ) : (
      <Loading label="The market has closed. Counting the results…" />
    )
  }

  if (state.status === 'briefing') {
    return (
      <BriefingScreen
        state={state}
        onStart={onStart}
        onBack={() =>
          window.history.length > 1 ? navigate(-1) : navigate('/play')
        }
      />
    )
  }

  return (
    <TradingScreen
      state={state}
      reconnecting={reconnecting}
      clockBusy={clockBusy}
      cancelling={cancelling}
      onClock={onClock}
      onPlace={onPlace}
      onCancel={onCancel}
      onForfeit={async () => {
        try {
          await settle(true)
        } catch (error) {
          notify(errorText(error), 'error')
        }
      }}
    />
  )
}

export default function ArenaPage() {
  const { gameId = '' } = useParams()
  return <Arena key={gameId} gameId={gameId} />
}
