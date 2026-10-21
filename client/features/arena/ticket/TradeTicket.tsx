import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  newOrderKey,
  type GameState,
  type OrderRequest,
  type OrderType,
  type Side,
} from '../../../services/gameService.ts'
import Button from '../../../ui/Button.tsx'
import Icon from '../../../ui/Icon.tsx'
import { formatMoney, formatPct } from '../../../ui/format.ts'
import { errorText } from '../../../ui/useResource.ts'
import {
  availableCash,
  availableShares,
  estimate,
  executionPrice,
  hasCents,
  heldShares,
  maxAffordable,
  positionCapQty,
  riskIfStopped,
} from '../arenaLogic.ts'
import styles from './TradeTicket.module.css'

interface TradeTicketProps {
  state: GameState
  symbol: string
  side: Side
  onSideChange: (side: Side) => void
  /** Increment to move focus to the quantity field. */
  focusSignal: number
  canTrade: boolean
  onPlace: (order: OrderRequest, attachStop: number | null) => Promise<void>
}

const PRESETS = [10, 25, 50] as const

function parse(text: string): number {
  const value = Number(text)
  return Number.isFinite(value) ? value : NaN
}

function roundPrice(value: number): string {
  return value.toFixed(2)
}

export default function TradeTicket({
  state,
  symbol,
  side,
  onSideChange,
  focusSignal,
  canTrade,
  onPlace,
}: TradeTicketProps) {
  const { scenario, me } = state
  const asset = state.assets.find((a) => a.symbol === symbol)
  const last = asset?.price ?? 0
  const [type, setType] = useState<OrderType>('market')
  const [qtyText, setQtyText] = useState('10')
  const [priceText, setPriceText] = useState(roundPrice(last))
  const [attach, setAttach] = useState(false)
  const [stopText, setStopText] = useState(roundPrice(last * 0.95))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  // One idempotency key per draft: a retry after a lost reply reuses it, so
  // the server returns the original order instead of placing a second one.
  const draftKey = useRef<{ draft: string; key: string } | null>(null)
  const id = useId()

  useEffect(() => {
    if (focusSignal) qtyRef.current?.focus()
  }, [focusSignal])

  const types: { id: OrderType; label: string }[] = [
    { id: 'market', label: 'Market' },
    ...(scenario.allow.limit ? [{ id: 'limit' as const, label: 'Limit' }] : []),
    ...(scenario.allow.stop && side === 'sell'
      ? [{ id: 'stop' as const, label: 'Stop-loss' }]
      : []),
  ]
  const activeType = types.some((t) => t.id === type) ? type : 'market'
  const canAttach = side === 'buy' && scenario.allow.stop

  function chooseType(next: OrderType) {
    setType(next)
    setError(null)
    setPriceText(roundPrice(next === 'stop' ? last * 0.95 : last))
  }

  const limit = activeType === 'limit' ? parse(priceText) : undefined
  const stop = activeType === 'stop' ? parse(priceText) : undefined
  const unit = executionPrice(side, activeType, last, scenario, limit, stop)
  const cash = availableCash(me)
  const held = heldShares(me, symbol)
  const sellable = availableShares(me, symbol)
  const affordable = maxAffordable(cash, unit, scenario)
  const capRoom = positionCapQty(me, symbol, last, scenario.max_position_pct)
  const maxQty = side === 'buy' ? Math.min(affordable, capRoom) : sellable
  const qty = Math.floor(parse(qtyText))
  const preview = estimate(side, qty > 0 ? qty : 0, unit, scenario)
  const attachedStop = canAttach && attach ? parse(stopText) : null
  const risk =
    attachedStop && attachedStop > 0 && qty > 0
      ? riskIfStopped(qty, unit, attachedStop, scenario, me.equity)
      : null

  let reason: string | null = null
  if (!canTrade) reason = 'Trading has closed for this match'
  else if (side === 'sell' && held === 0) reason = `You don’t own any ${symbol}`
  else if (side === 'sell' && sellable === 0)
    reason = `Your ${held} ${symbol} are held by open orders. Cancel one under Orders to sell.`
  else if (side === 'buy' && affordable === 0) reason = 'Not enough cash'
  else if (!(qty > 0)) reason = 'Enter how many shares'
  else if (activeType === 'limit' && !(limit! > 0))
    reason = 'Enter a limit price'
  else if (activeType === 'stop' && !(stop! > 0)) reason = 'Enter a stop price'
  else if ((limit ?? stop ?? 0) > 0 && !hasCents((limit ?? stop)!))
    reason = 'Prices use dollars and cents (at most two decimals)'
  else if (activeType === 'stop' && stop! >= last)
    reason = 'A stop-loss goes below the current price'
  else if (side === 'buy' && qty > capRoom)
    reason = `A position can be at most ${scenario.max_position_pct}% of your account`
  else if (side === 'buy' && qty > affordable) reason = 'Not enough cash'
  else if (side === 'sell' && qty > sellable)
    reason = `You can sell up to ${sellable}`
  else if (attachedStop !== null && !(attachedStop > 0 && attachedStop < unit))
    reason = 'The stop-loss must be below your buy price'
  else if (attachedStop !== null && !hasCents(attachedStop))
    reason = 'Prices use dollars and cents (at most two decimals)'

  const verb = side === 'buy' ? 'Buy' : 'Sell'
  const confirm =
    activeType === 'market'
      ? `${verb} ${qty > 0 ? qty : ''} ${symbol} · ≈ ${formatMoney(preview.total)}`
      : `Place ${activeType === 'stop' ? 'stop-loss' : `${side} limit`} · ${qty > 0 ? qty : ''} ${symbol} @ ${formatMoney((limit ?? stop) || 0)}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (reason || busy) return
    setBusy(true)
    setError(null)
    const order: OrderRequest = { symbol, side, type: activeType, qty }
    if (activeType === 'limit') order.limit_price = limit
    if (activeType === 'stop') order.stop_price = stop
    const draft = JSON.stringify(order)
    if (draftKey.current?.draft !== draft)
      draftKey.current = { draft, key: newOrderKey() }
    order.client_order_id = draftKey.current.key
    try {
      await onPlace(order, attachedStop)
      draftKey.current = null
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  const plan = me.plan
  const overPlan = risk && plan && risk.pct > plan.max_loss_pct

  return (
    <form
      className={styles.ticket}
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.head}>
        <h2 id={`${id}-title`} className={styles.title}>
          Order ticket
        </h2>
        <span className={styles.symbol}>
          {symbol} <span className="num">{formatMoney(last)}</span>
        </span>
      </div>

      <fieldset className={styles.sides}>
        <legend className="visually-hidden">Buy or sell</legend>
        {(['buy', 'sell'] as const).map((value) => (
          <label
            key={value}
            className={[
              styles.side,
              value === 'buy' ? styles.sideBuy : styles.sideSell,
            ].join(' ')}
          >
            <input
              type="radio"
              name={`${id}-side`}
              value={value}
              checked={side === value}
              onChange={() => {
                onSideChange(value)
                setError(null)
              }}
            />
            <span>{value === 'buy' ? '▲ Buy' : '▼ Sell'}</span>
          </label>
        ))}
      </fieldset>

      {types.length > 1 && (
        <fieldset className={styles.types}>
          <legend className={styles.label}>Order type</legend>
          <div className={styles.typeRow}>
            {types.map((option) => (
              <label key={option.id} className={styles.type}>
                <input
                  type="radio"
                  name={`${id}-type`}
                  value={option.id}
                  checked={activeType === option.id}
                  onChange={() => chooseType(option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className={styles.field}>
        <label htmlFor={`${id}-qty`} className={styles.label}>
          Shares
          <span className={styles.hint}>
            {side === 'buy' ? `Up to ${maxQty}` : `You own ${held}`}
          </span>
        </label>
        <input
          ref={qtyRef}
          id={`${id}-qty`}
          className={`num ${styles.input}`}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={qtyText}
          onChange={(event) => {
            setQtyText(event.target.value)
            setError(null)
          }}
        />
        <div className={styles.presets}>
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.preset}
              aria-pressed={qty === preset}
              onClick={() => setQtyText(String(preset))}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            className={styles.preset}
            aria-pressed={qty === maxQty && maxQty > 0}
            disabled={maxQty <= 0}
            onClick={() => setQtyText(String(maxQty))}
          >
            Max
          </button>
        </div>
      </div>

      {activeType !== 'market' && (
        <div className={styles.field}>
          <label htmlFor={`${id}-price`} className={styles.label}>
            {activeType === 'limit'
              ? side === 'buy'
                ? 'Buy at or below'
                : 'Sell at or above'
              : 'Sell if the price falls to'}
          </label>
          <input
            id={`${id}-price`}
            className={`num ${styles.input}`}
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.01}
            value={priceText}
            onChange={(event) => setPriceText(event.target.value)}
          />
        </div>
      )}

      {canAttach && (
        <div className={styles.attach}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={attach}
              onChange={(event) => setAttach(event.target.checked)}
            />
            <span>Attach stop-loss</span>
          </label>
          {attach && activeType === 'limit' && (
            <p className={styles.costNote}>
              Your stop-loss will be placed when your buy fills.
            </p>
          )}
          {attach && (
            <div className={styles.field}>
              <label htmlFor={`${id}-stop`} className={styles.label}>
                Sell if the price falls to
              </label>
              <input
                id={`${id}-stop`}
                className={`num ${styles.input}`}
                type="number"
                inputMode="decimal"
                min={0.01}
                step={0.01}
                value={stopText}
                onChange={(event) => setStopText(event.target.value)}
              />
            </div>
          )}
          {risk && (
            <p className={overPlan ? styles.riskOver : styles.risk}>
              <Icon name="shield" size={16} />
              <span>
                Risk if stopped:{' '}
                <span className="num">
                  {formatMoney(risk.amount)} ({formatPct(risk.pct)} of your
                  account)
                </span>
                {overPlan && ` — more than your ${plan.max_loss_pct}% plan`}
              </span>
            </p>
          )}
        </div>
      )}

      <dl className={styles.preview}>
        <div>
          <dt>
            {activeType === 'limit'
              ? 'Limit price'
              : activeType === 'stop'
                ? 'Exit price if hit'
                : side === 'buy'
                  ? 'Price (ask)'
                  : 'Price (bid)'}
          </dt>
          <dd className="num">≈ {formatMoney(unit)}</dd>
        </div>
        <div>
          <dt>Fee</dt>
          <dd className="num">{formatMoney(preview.fee)}</dd>
        </div>
        <div className={styles.total}>
          <dt>{side === 'buy' ? 'Est. cost' : 'Est. proceeds'}</dt>
          <dd className="num">{formatMoney(preview.total)}</dd>
        </div>
      </dl>
      <p className={styles.costNote}>
        Includes the {formatPct(scenario.spread * 100, 2)} spread. Cash
        available <span className="num">{formatMoney(cash)}</span>
      </p>

      {reason && !busy && (
        <p className={styles.reason} id={`${id}-reason`}>
          <Icon name="info" size={16} /> {reason}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant={side === 'buy' ? 'buy' : 'sell'}
        size="lg"
        block
        disabled={!!reason || busy}
        aria-describedby={reason ? `${id}-reason` : undefined}
      >
        {busy ? 'Sending…' : confirm}
      </Button>
    </form>
  )
}
