import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type {
  Bar,
  Fill,
  NewsItem,
  Order,
} from '../../../services/gameService.ts'
import { formatCount } from '../../../ui/format.ts'
import { ema, macd, niceTicks, rsi, sma, type Series } from './indicators.ts'
import styles from './PriceChart.module.css'

interface PriceChartProps {
  symbol: string
  bars: Bar[]
  tools: string[]
  fills: Fill[]
  orders: Order[]
  news: NewsItem[]
  /** Height of the price pane in pixels; sub-panes add to it. */
  height: number
}

const AXIS_W = 60
const PAD_L = 6
const PAD_T = 10
const DAY_AXIS_H = 22
const GAP = 8
const VOLUME_H = 48
const OSC_H = 64
const MIN_SLOT = 6

const price = (value: number) => value.toFixed(2)

function linePath(
  values: Series,
  x: (i: number) => number,
  y: (v: number) => number,
) {
  let d = ''
  let open = false
  values.forEach((value, i) => {
    if (value === null) {
      open = false
      return
    }
    d += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)}`
    open = true
  })
  return d
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

interface Pane {
  top: number
  height: number
}

export default function PriceChart({
  symbol,
  bars,
  tools,
  fills,
  orders,
  news,
  height,
}: PriceChartProps) {
  const { ref, width } = useWidth()
  /** Tick of the bar under the pointer or keyboard focus, so it stays on the same day as new bars arrive. */
  const [hover, setHover] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')
  const tableId = useId()
  const clipId = `${tableId.replace(/[^a-zA-Z0-9]/g, '')}-plot`

  const closes = useMemo(() => bars.map((bar) => bar.c), [bars])
  const indicators = useMemo(
    () => ({
      sma: tools.includes('sma') ? sma(closes, 20) : null,
      ema: tools.includes('ema') ? ema(closes, 10) : null,
      rsi: tools.includes('rsi') ? rsi(closes, 14) : null,
      macd: tools.includes('macd') ? macd(closes) : null,
    }),
    [closes, tools],
  )
  const showVolume = tools.includes('volume')

  const plotW = Math.max(0, width - AXIS_W - PAD_L)
  const maxVisible = Math.max(10, Math.floor(plotW / MIN_SLOT) - 2)
  const start = Math.max(0, bars.length - maxVisible)
  const visible = bars.slice(start)
  const slot = plotW / Math.max(1, visible.length + 2)
  const x = (i: number) => PAD_L + slot * (i + 0.5)
  const body = Math.max(1, Math.min(14, slot * 0.64))

  const main: Pane = { top: PAD_T, height }
  const panes: (Pane | null)[] = []
  let bottom = PAD_T + height + DAY_AXIS_H
  for (const [on, h] of [
    [showVolume, VOLUME_H],
    [!!indicators.rsi, OSC_H],
    [!!indicators.macd, OSC_H],
  ] as const) {
    panes.push(on ? { top: bottom + GAP, height: h } : null)
    if (on) bottom += GAP + h
  }
  const [volumePane, rsiPane, macdPane] = panes
  const totalH = bottom + 4

  const openOrders = orders.filter(
    (order) => order.status === 'open' && order.symbol === symbol,
  )
  const orderLevel = (order: Order) =>
    (order.type === 'stop' ? order.stop_price : order.limit_price) ?? null

  let lo = Infinity
  let hi = -Infinity
  for (const bar of visible) {
    lo = Math.min(lo, bar.l)
    hi = Math.max(hi, bar.h)
  }
  for (const order of openOrders) {
    const level = orderLevel(order)
    if (level !== null) {
      lo = Math.min(lo, level)
      hi = Math.max(hi, level)
    }
  }
  const pad = (hi - lo) * 0.08 || hi * 0.02 || 1
  lo -= pad
  hi += pad
  const y = (v: number) => main.top + ((hi - v) / (hi - lo)) * main.height
  const priceTicks = niceTicks(lo, hi, 5).filter((v) => v > lo && v < hi)

  const last = bars[bars.length - 1]
  const previous = bars[bars.length - 2]
  const dayChange =
    last && previous ? ((last.c - previous.c) / previous.c) * 100 : 0
  const up = dayChange >= 0
  const summary = last
    ? `${symbol} last $${price(last.c)}, ${up ? 'up' : 'down'} ${Math.abs(dayChange).toFixed(1)}% today`
    : `${symbol}: no prices yet`

  const hoverIndex =
    hover === null ? -1 : visible.findIndex((bar) => bar.t === hover)
  const index = hoverIndex >= 0 ? hoverIndex : visible.length - 1
  const focus = visible[index]
  const firstT = visible[0]?.t ?? 0
  const startIndex = visible.findIndex((bar) => bar.t === 0)
  const labelEvery = Math.max(1, Math.ceil(36 / Math.max(slot, 1)))
  const indexOfT = (t: number) => t - firstT

  function pick(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const i = Math.floor((event.clientX - rect.left - PAD_L) / slot)
    setHover(i >= 0 && i < visible.length ? visible[i].t : null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!visible.length) return
    const current = index
    let next: number | null = current
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1)
    else if (event.key === 'ArrowRight')
      next = Math.min(visible.length - 1, current + 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = visible.length - 1
    else if (event.key === 'Escape') next = null
    else return
    event.preventDefault()
    const bar = next === null ? null : visible[next]
    setHover(bar ? bar.t : null)
    setAnnounce(
      bar
        ? `${bar.t >= 0 ? `Day ${bar.t}` : `${-bar.t} days before the start`}: open ${price(bar.o)}, high ${price(bar.h)}, low ${price(bar.l)}, close ${price(bar.c)}`
        : '',
    )
  }

  const oscillator = (
    pane: Pane,
    series: Series[],
    range: [number, number],
  ): ((v: number) => number) => {
    let [min, max] = range
    if (!Number.isFinite(min)) {
      min = Infinity
      max = -Infinity
      for (const s of series)
        for (const v of s.slice(start)) {
          if (v === null) continue
          min = Math.min(min, v)
          max = Math.max(max, v)
        }
      const m = Math.max(Math.abs(min), Math.abs(max)) || 1
      min = -m
      max = m
    }
    return (v: number) => pane.top + ((max - v) / (max - min)) * pane.height
  }

  const visibleSeries = (s: Series) => s.slice(start)
  const maxVolume = Math.max(1, ...visible.map((bar) => bar.v))

  return (
    <figure className={styles.figure}>
      <div
        ref={ref}
        className={styles.frame}
        tabIndex={0}
        role="img"
        aria-label={`${summary}. Use the arrow keys to read each day.`}
        aria-describedby={tableId}
        onKeyDown={onKeyDown}
      >
        {focus && (
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendDay}>
              {focus.t >= 0
                ? `Day ${focus.t}`
                : `${-focus.t}d before`}
            </span>
            <span className="num">
              O {price(focus.o)} H {price(focus.h)} L {price(focus.l)}{' '}
              <span className={focus.c >= focus.o ? 'gain' : 'loss'}>
                C {price(focus.c)}
              </span>
            </span>
            {showVolume && (
              <span className={`num ${styles.legendVol}`}>
                Vol {formatCount(focus.v)}
              </span>
            )}
            {indicators.sma && <span className={styles.keySma}>SMA 20</span>}
            {indicators.ema && <span className={styles.keyEma}>EMA 10</span>}
          </div>
        )}
        {width > 0 && (
          <svg
            width={width}
            height={totalH}
            className={styles.svg}
            aria-hidden="true"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') setHover(null)
            }}
          >
            {/* Price grid */}
            {priceTicks.map((v) => (
              <g key={v}>
                <line
                  className={styles.grid}
                  x1={PAD_L}
                  x2={PAD_L + plotW}
                  y1={y(v)}
                  y2={y(v)}
                />
                {!(last && Math.abs(y(v) - y(last.c)) < 14) && (
                  <text
                    className={styles.axisText}
                    x={PAD_L + plotW + 6}
                    y={y(v) + 4}
                  >
                    {price(v)}
                  </text>
                )}
              </g>
            ))}

            {/* History shade and start divider */}
            {startIndex > 0 && (
              <g>
                <rect
                  className={styles.history}
                  x={PAD_L}
                  y={main.top}
                  width={slot * startIndex}
                  height={main.height}
                />
                <line
                  className={styles.divider}
                  x1={PAD_L + slot * startIndex}
                  x2={PAD_L + slot * startIndex}
                  y1={main.top}
                  y2={main.top + main.height + DAY_AXIS_H}
                />
                <text
                  className={styles.dividerText}
                  x={PAD_L + slot * startIndex + 4}
                  y={main.top + 12}
                >
                  Start
                </text>
              </g>
            )}

            <defs>
              <clipPath id={clipId}>
                <rect
                  x={PAD_L}
                  y={main.top}
                  width={plotW}
                  height={main.height}
                />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              {/* Overlays */}
              {indicators.sma && (
                <path
                  className={styles.sma}
                  d={linePath(visibleSeries(indicators.sma), x, y)}
                />
              )}
              {indicators.ema && (
                <path
                  className={styles.ema}
                  d={linePath(visibleSeries(indicators.ema), x, y)}
                />
              )}

              {/* Candles */}
              {visible.map((bar, i) => {
                const rising = bar.c >= bar.o
                const top = y(Math.max(bar.o, bar.c))
                const bottom = y(Math.min(bar.o, bar.c))
                const newest = i === visible.length - 1 && bar.t >= 0
                return (
                  <g
                    key={bar.t}
                    className={[
                      rising ? styles.up : styles.down,
                      bar.t < 0 && styles.dim,
                      newest && styles.grow,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <line x1={x(i)} x2={x(i)} y1={y(bar.h)} y2={y(bar.l)} />
                    <rect
                      x={x(i) - body / 2}
                      y={top}
                      width={body}
                      height={Math.max(1, bottom - top)}
                    />
                  </g>
                )
              })}

              {/* Resting orders */}
              {openOrders.map((order) => {
                const level = orderLevel(order)
                if (level === null || level < lo || level > hi) return null
                const label = `${order.type === 'stop' ? 'Stop' : order.side === 'buy' ? 'Buy limit' : 'Sell limit'} ${order.qty} @ ${price(level)}`
                return (
                  <g
                    key={order.id}
                    className={
                      order.type === 'stop' ? styles.stopLine : styles.limitLine
                    }
                  >
                    <line
                      x1={PAD_L}
                      x2={PAD_L + plotW}
                      y1={y(level)}
                      y2={y(level)}
                    />
                    <rect
                      x={PAD_L + 2}
                      y={y(level) - 9}
                      width={label.length * 6.4 + 10}
                      height={17}
                      rx={4}
                    />
                    <text x={PAD_L + 7} y={y(level) + 3.5}>
                      {label}
                    </text>
                  </g>
                )
              })}

              {/* Fill markers */}
              {fills
                .filter((fill) => fill.symbol === symbol)
                .map((fill, n) => {
                  const i = indexOfT(fill.t)
                  if (i < 0 || i >= visible.length) return null
                  const cx = x(i)
                  const cy = y(fill.price)
                  const d =
                    fill.side === 'buy'
                      ? `M${cx},${cy + 3}l6,10h-12Z`
                      : `M${cx},${cy - 3}l6,-10h-12Z`
                  return (
                    <path
                      key={`${fill.order_id}-${n}`}
                      className={
                        fill.side === 'buy' ? styles.buyMark : styles.sellMark
                      }
                      d={d}
                    />
                  )
                })}
            </g>

            {/* Last price tag */}
            {last && (
              <g className={up ? styles.tagUp : styles.tagDown}>
                <line
                  className={styles.lastLine}
                  x1={PAD_L}
                  x2={PAD_L + plotW}
                  y1={y(last.c)}
                  y2={y(last.c)}
                />
                <rect
                  x={PAD_L + plotW + 2}
                  y={y(last.c) - 10}
                  width={AXIS_W - 4}
                  height={20}
                  rx={4}
                />
                <text x={PAD_L + plotW + 7} y={y(last.c) + 4}>
                  {price(last.c)}
                </text>
              </g>
            )}

            {/* Day axis */}
            <line
              className={styles.axisLine}
              x1={PAD_L}
              x2={PAD_L + plotW}
              y1={main.top + main.height}
              y2={main.top + main.height}
            />
            {visible.map((bar, i) =>
              bar.t >= 0 && bar.t % labelEvery === 0 ? (
                <text
                  key={bar.t}
                  className={styles.axisText}
                  x={x(i)}
                  y={main.top + main.height + 15}
                  textAnchor="middle"
                >
                  {bar.t}
                </text>
              ) : null,
            )}
            {news.map((item) => {
              const i = indexOfT(item.t)
              if (i < 0 || i >= visible.length) return null
              const fx = x(i)
              const fy = main.top + main.height - 12
              return (
                <path
                  key={item.id}
                  className={styles.newsFlag}
                  d={`M${fx},${fy + 12}V${fy}h7l-2,3 2,3h-7`}
                >
                  <title>{item.headline}</title>
                </path>
              )
            })}

            {/* Volume */}
            {volumePane && (
              <g>
                <text
                  className={styles.paneLabel}
                  x={PAD_L + 2}
                  y={volumePane.top + 10}
                >
                  Volume
                </text>
                {visible.map((bar, i) => {
                  const h = (bar.v / maxVolume) * (volumePane.height - 4)
                  return (
                    <rect
                      key={bar.t}
                      className={[
                        bar.c >= bar.o ? styles.volUp : styles.volDown,
                        bar.t < 0 && styles.dim,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      x={x(i) - body / 2}
                      y={volumePane.top + volumePane.height - h}
                      width={body}
                      height={Math.max(1, h)}
                    />
                  )
                })}
              </g>
            )}

            {/* RSI */}
            {rsiPane &&
              indicators.rsi &&
              (() => {
                const ry = oscillator(rsiPane, [indicators.rsi], [0, 100])
                const value = indicators.rsi[start + index]
                return (
                  <g>
                    <rect
                      className={styles.paneBg}
                      x={PAD_L}
                      y={rsiPane.top}
                      width={plotW}
                      height={rsiPane.height}
                    />
                    {[30, 70].map((level) => (
                      <g key={level}>
                        <line
                          className={styles.guide}
                          x1={PAD_L}
                          x2={PAD_L + plotW}
                          y1={ry(level)}
                          y2={ry(level)}
                        />
                        <text
                          className={styles.axisText}
                          x={PAD_L + plotW + 6}
                          y={ry(level) + 4}
                        >
                          {level}
                        </text>
                      </g>
                    ))}
                    <path
                      className={styles.rsi}
                      d={linePath(visibleSeries(indicators.rsi), x, ry)}
                    />
                    <text
                      className={styles.paneLabel}
                      x={PAD_L + 4}
                      y={rsiPane.top + 12}
                    >
                      RSI 14{value != null ? ` · ${value.toFixed(0)}` : ''}
                    </text>
                  </g>
                )
              })()}

            {/* MACD */}
            {macdPane &&
              indicators.macd &&
              (() => {
                const m = indicators.macd
                const my = oscillator(
                  macdPane,
                  [m.macd, m.signal, m.histogram],
                  [NaN, NaN],
                )
                const zero = my(0)
                return (
                  <g>
                    <rect
                      className={styles.paneBg}
                      x={PAD_L}
                      y={macdPane.top}
                      width={plotW}
                      height={macdPane.height}
                    />
                    <line
                      className={styles.guide}
                      x1={PAD_L}
                      x2={PAD_L + plotW}
                      y1={zero}
                      y2={zero}
                    />
                    {visibleSeries(m.histogram).map((v, i) =>
                      v === null ? null : (
                        <rect
                          key={i}
                          className={v >= 0 ? styles.volUp : styles.volDown}
                          x={x(i) - body / 2}
                          y={Math.min(zero, my(v))}
                          width={body}
                          height={Math.max(1, Math.abs(my(v) - zero))}
                        />
                      ),
                    )}
                    <path
                      className={styles.macdLine}
                      d={linePath(visibleSeries(m.macd), x, my)}
                    />
                    <path
                      className={styles.signalLine}
                      d={linePath(visibleSeries(m.signal), x, my)}
                    />
                    <text
                      className={styles.paneLabel}
                      x={PAD_L + 4}
                      y={macdPane.top + 12}
                    >
                      MACD 12·26·9
                    </text>
                  </g>
                )
              })()}

            {/* Crosshair */}
            {hoverIndex >= 0 && focus && (
              <g className={styles.crosshair}>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={main.top}
                  y2={totalH - 4}
                />
                <circle cx={x(index)} cy={y(focus.c)} r={3.5} />
              </g>
            )}
          </svg>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      <table id={tableId} className="visually-hidden">
        <caption>{symbol}: last 10 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Open</th>
            <th scope="col">High</th>
            <th scope="col">Low</th>
            <th scope="col">Close</th>
            <th scope="col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {bars.slice(-10).map((bar) => (
            <tr key={bar.t}>
              <th scope="row">{bar.t}</th>
              <td>{price(bar.o)}</td>
              <td>{price(bar.h)}</td>
              <td>{price(bar.l)}</td>
              <td>{price(bar.c)}</td>
              <td>{formatCount(bar.v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
