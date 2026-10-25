import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  cancelOrder,
  controlClock,
  createGame,
  findBriefing,
  finishGame,
  getResult,
  listGames,
  placeOrder,
  startGame,
  type ClockAction,
  type ClockSpeed,
  type CreateGameRequest,
  type GameResult,
  type GameState,
  type Order,
  type OrderRequest,
  type Plan,
} from '../../services/gameService.ts'
import { ButtonLink } from '../../ui/Button.tsx'
import { ErrorState, Loading } from '../../ui/States.tsx'
import Icon from '../../ui/Icon.tsx'
import { formatMoney } from '../../ui/format.ts'
import { useToast } from '../../ui/toastContext.ts'
import { errorText } from '../../ui/useResource.ts'
import { chapterOf, isEnded, isMultiplayer, levelOf } from './arenaLogic.ts'
import BriefingScreen from './briefing/BriefingScreen.tsx'
import { MissionNotifications } from './missionNotifications.ts'
import {
  loadPendingStops,
  savePendingStops,
  stopOrderKey,
} from './pendingStops.ts'
import ResultsScreen from './results/ResultsScreen.tsx'
import { isRetryable } from './retry.ts'
import TourLayer from './tour/TourLayer.tsx'
import useArenaTour from './tour/useArenaTour.ts'
import TradingScreen from './trading/TradingScreen.tsx'
import useGame from './useGame.ts'

function placedMessage(
  order: OrderRequest,
  state: GameState | null,
  orderId: string,
  withStop: boolean,
) {
  const fill = state?.me.fills.find((item) => item.order_id === orderId)
  if (fill) {
    return `${fill.side === 'buy' ? 'Bought' : 'Sold'} ${fill.qty} ${fill.symbol} at ${formatMoney(fill.price)}`
  }
  if (order.type === 'limit') {
    const note = withStop ? ' Your stop-loss is placed when it fills.' : ''
    return `${order.side === 'buy' ? 'Buy' : 'Sell'} limit placed: ${order.qty} ${order.symbol} at ${formatMoney(order.limit_price ?? 0)}.${note}`
  }
  if (order.type === 'stop') {
    return `Stop-loss placed: ${order.qty} ${order.symbol} at ${formatMoney(order.stop_price ?? 0)}`
  }
  return `${order.side === 'buy' ? 'Buy' : 'Sell'} order sent: ${order.qty} ${order.symbol}`
}

function replayRequest(state: GameState): CreateGameRequest {
  if (state.mode === 'private' || state.mode === 'ranked') {
    throw new Error('Multiplayer matches must be started from Multiplayer.')
  }
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

/** Where "Back" from a briefing goes: the screen the match was opened from. */
function exitPath(state: GameState): string {
  const chapter = chapterOf(state)
  if ((state.mode === 'level' || state.mode === 'boss') && chapter)
    return `/adventure/${encodeURIComponent(chapter)}`
  if (isMultiplayer(state)) return '/multiplayer'
  return '/play'
}

function Arena({ gameId }: { gameId: string }) {
  const navigate = useNavigate()
  const notify = useToast()
  const { player, refreshPlayer } = usePlayer()
  const { state, loadError, failure, reconnecting, refresh, accept, stop } =
    useGame(gameId)
  const [result, setResult] = useState<GameResult | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [clockBusy, setClockBusy] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const finishing = useRef(false)
  const [missionNotifications] = useState(() => new MissionNotifications())
  // A mutable map held for the component's lifetime; the count drives renders.
  const [stops] = useState(() => loadPendingStops(gameId))
  const placingStops = useRef(new Set<string>())
  const [pendingStopCount, setPendingStopCount] = useState(stops.size)

  const shownResult = result ?? state?.result ?? null
  const ended = state ? isEnded(state) : false
  const needsPlan =
    !!state &&
    isMultiplayer(state) &&
    !state.me.plan &&
    !shownResult &&
    !ended &&
    state.status !== 'briefing'
  const phase = !state
    ? 'loading'
    : shownResult
      ? 'results'
      : state.status === 'briefing' || needsPlan
        ? 'briefing'
        : 'trading'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])

  useEffect(() => {
    if (!state) return
    const notice = missionNotifications.update(
      state.missions,
      phase === 'trading' && !ended,
    )
    if (notice)
      notify(
        notice.message,
        'info',
        <span aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
          {notice.normal && (
            <Icon name="star" filled style={{ color: 'var(--gold)' }} />
          )}
          {notice.bonus && (
            <Icon name="sparkle" filled style={{ color: 'var(--gem-text)' }} />
          )}
        </span>,
      )
  }, [state, phase, ended, missionNotifications, notify])

  const forgetStop = useCallback(
    (orderId: string) => {
      stops.delete(orderId)
      savePendingStops(gameId, stops)
      setPendingStopCount(stops.size)
    },
    [gameId, stops],
  )

  const settle = useCallback(
    (forfeit: boolean) => {
      finishing.current = true
      if (!forfeit) setFinishError(null)
      const request =
        state?.status === 'settled' && !forfeit
          ? getResult(gameId)
          : finishGame(gameId, forfeit ? { forfeit: true } : {})
      return request.then(
        (value) => {
          stop()
          setResult(value)
          void refreshPlayer()
        },
        (error: unknown) => {
          finishing.current = false
          // A failed forfeit must not block settling when the market closes.
          if (!forfeit) setFinishError(errorText(error))
          throw error
        },
      )
    },
    [gameId, state?.status, stop, refreshPlayer],
  )

  useEffect(() => {
    if (!state || shownResult || finishing.current || !ended || finishError)
      return
    settle(false).catch(() => undefined)
  }, [state, shownResult, ended, finishError, settle])

  useEffect(() => {
    if (shownResult) stop()
  }, [shownResult, stop])

  // Place an attached stop-loss once the buy it protects has filled. The
  // stop's idempotency key comes from the buy, so a retry never doubles it.
  useEffect(() => {
    if (!state || ended) return
    const settled: string[] = []
    for (const [orderId, pending] of stops) {
      const key = stopOrderKey(orderId)
      const order = state.me.orders.find((item) => item.id === orderId)
      if (
        order?.status === 'cancelled' ||
        state.me.orders.some((item) => item.client_order_id === key)
      ) {
        settled.push(orderId)
        continue
      }
      if (!state.me.fills.some((fill) => fill.order_id === orderId)) continue
      if (placingStops.current.has(orderId)) continue
      placingStops.current.add(orderId)
      placeOrder(gameId, {
        client_order_id: key,
        symbol: pending.symbol,
        side: 'sell',
        type: 'stop',
        qty: pending.qty,
        stop_price: pending.stop,
      })
        .then(
          (placed) => {
            forgetStop(orderId)
            accept(placed.state)
            notify(
              `Stop-loss set: ${pending.qty} ${pending.symbol} at ${formatMoney(pending.stop)}`,
              'success',
            )
          },
          (error: unknown) => {
            if (isRetryable(error)) return
            forgetStop(orderId)
            notify(`Stop-loss not placed: ${errorText(error)}`, 'error')
          },
        )
        .finally(() => placingStops.current.delete(orderId))
    }
    if (settled.length)
      queueMicrotask(() => settled.forEach((orderId) => forgetStop(orderId)))
  }, [state, ended, gameId, notify, accept, forgetStop, stops])

  const onClock = useCallback(
    (action: ClockAction, speed?: ClockSpeed) => {
      setClockBusy(true)
      controlClock(gameId, action, speed)
        .then(accept)
        .catch((error: unknown) => notify(errorText(error), 'error'))
        .finally(() => setClockBusy(false))
    },
    [gameId, notify, accept],
  )

  const tour = useArenaTour({
    state,
    phase: ended ? 'loading' : phase,
    playerId: player?.id ?? null,
    onClock,
  })

  async function onPlace(order: OrderRequest, attachStop: number | null) {
    const placed = await placeOrder(gameId, order)
    if (attachStop !== null) {
      stops.set(placed.order.id, {
        symbol: order.symbol,
        qty: order.qty,
        stop: attachStop,
      })
      savePendingStops(gameId, stops)
      setPendingStopCount(stops.size)
    }
    const latest = accept(placed.state)
    notify(
      placedMessage(order, latest, placed.order.id, attachStop !== null),
      'success',
    )
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
      const { games } = await listGames().catch(() => ({ games: [] }))
      const existing = findBriefing(
        games,
        state.mode,
        state.scenario.id,
        state.id,
      )
      const next = existing ?? (await createGame(replayRequest(state)))
      void navigate(`/game/${encodeURIComponent(next.id)}`)
    } catch (error) {
      notify(errorText(error), 'error')
    }
  }

  async function onSaveReflection(text: string) {
    setResult(await finishGame(gameId, { reflection: text }))
    notify('Reflection saved', 'success')
  }

  if (failure) {
    const signedOut = failure.status === 401
    return (
      <ErrorState
        title={
          signedOut ? 'Your session has ended' : 'This match isn’t available'
        }
        message={
          signedOut
            ? 'Sign in again to get back to your match.'
            : failure.message
        }
        action={
          signedOut ? (
            <ButtonLink
              to={`/login?returnTo=${encodeURIComponent(`/game/${gameId}`)}`}
              icon="user"
            >
              Sign in
            </ButtonLink>
          ) : (
            <ButtonLink to="/play" icon="swords">
              Back to Play
            </ButtonLink>
          )
        }
      />
    )
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

  if (phase === 'briefing') {
    return (
      <>
        <BriefingScreen
          state={state}
          onStart={onStart}
          onBack={needsPlan ? undefined : () => void navigate(exitPath(state))}
        />
        <TourLayer tour={tour} />
      </>
    )
  }

  return (
    <>
      <TradingScreen
        state={state}
        reconnecting={reconnecting}
        clockBusy={clockBusy}
        cancelling={cancelling}
        pendingStops={pendingStopCount}
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
        tourTab={tour.tab}
        onHowToPlay={tour.replay}
      />
      <TourLayer tour={tour} />
    </>
  )
}

export default function ArenaPage() {
  const { gameId = '' } = useParams()
  return <Arena key={gameId} gameId={gameId} />
}
