/** Pure trading arithmetic used by the lesson visuals. */
export interface Candle {
  o: number
  h: number
  l: number
  c: number
  v?: number
}

export interface Fill {
  day: number
  price: number
}

export function ownershipPct(shares: number, totalShares: number): number {
  return totalShares > 0 ? (shares / totalShares) * 100 : 0
}

/** Gain needed to get back to the start after losing `lossPct` percent. */
export function recoveryGainPct(lossPct: number): number {
  if (lossPct >= 100) return Infinity
  return (1 / (1 - lossPct / 100) - 1) * 100
}

/** Win rate at which a fixed R-multiple system breaks even: 1 / (1 + R). */
export function breakevenWinRate(r: number): number {
  return r > 0 ? 1 / (1 + r) : 1
}

export function rMultiple(entry: number, stop: number, target: number): number {
  const risk = entry - stop
  return risk > 0 ? (target - entry) / risk : 0
}

export interface PositionSize {
  shares: number
  riskBudget: number
  riskPerShare: number
  risk: number
  value: number
  cappedByCash: boolean
}

/** Shares = (account × risk%) ÷ (entry − stop), rounded down and capped by cash. */
export function positionSize(
  account: number,
  riskPct: number,
  entry: number,
  stop: number,
): PositionSize | null {
  const riskPerShare = entry - stop
  if (!(account > 0) || !(entry > 0) || !(riskPerShare > 0) || riskPct <= 0)
    return null
  const riskBudget = (account * riskPct) / 100
  const byRisk = Math.floor(riskBudget / riskPerShare + 1e-9)
  const byCash = Math.floor(account / entry + 1e-9)
  const shares = Math.min(byRisk, byCash)
  return {
    shares,
    riskBudget,
    riskPerShare,
    risk: shares * riskPerShare,
    value: shares * entry,
    cappedByCash: byCash < byRisk,
  }
}

export interface BookLevel {
  price: number
  size: number
}

export interface BookFill {
  filled: number
  cost: number
  average: number
  fills: BookLevel[]
  unfilled: number
}

/** Walk a market buy through the asks (best first). */
export function marketBuy(
  asks: readonly BookLevel[],
  quantity: number,
): BookFill {
  let left = Math.max(0, quantity)
  let cost = 0
  const fills: BookLevel[] = []
  for (const level of asks) {
    if (left <= 0) break
    const size = Math.min(left, level.size)
    fills.push({ price: level.price, size })
    cost += size * level.price
    left -= size
  }
  const filled = quantity - left
  return {
    filled,
    cost,
    average: filled > 0 ? cost / filled : 0,
    fills,
    unfilled: left,
  }
}

/**
 * First day a falling price reaches `level`, for a buy limit or a sell stop.
 * The fill is the level, or the open when the day opens beyond it (a gap).
 */
export function fillOnFall(
  candles: readonly Candle[],
  level: number,
  from = 0,
): Fill | null {
  for (let day = from; day < candles.length; day++) {
    const candle = candles[day]
    if (candle.l <= level) return { day, price: Math.min(candle.o, level) }
  }
  return null
}

/** First day a rising price reaches `level`, for a sell limit or a buy stop. */
export function fillOnRise(
  candles: readonly Candle[],
  level: number,
  from = 0,
): Fill | null {
  for (let day = from; day < candles.length; day++) {
    const candle = candles[day]
    if (candle.h >= level) return { day, price: Math.max(candle.o, level) }
  }
  return null
}

/** Portfolio value after one holding falls by `crashPct`, with equal weights. */
export function portfolioAfterCrash(
  total: number,
  holdings: number,
  crashPct: number,
): number {
  if (holdings <= 0) return total
  const each = total / holdings
  return total - each * (crashPct / 100)
}
