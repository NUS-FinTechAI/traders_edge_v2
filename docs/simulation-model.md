# Engine model

The trading engine is `server/app/game/`. It models a synthetic, long-only
market of fictional companies. It is not historical data or an exchange
emulator. The exact formulas are in the
[build contract](game-architecture.md#engine-model); this page summarises them
and states the limits.

## A match is a replay

A match is a pure function of `(scenario, seed, participants, human orders,
current tick)`. On every read the server regenerates the price path, replays
the stored human orders and the deterministic bots up to the current tick, and
returns the public state. Only commands (start, clock, order, cancel, finish)
write to the database. A scenario whose `version` changed since the match was
created refuses to load (409), so a stored match always replays the same way.

## Market

`market.py` builds daily OHLCV bars for ticks `−history … ticks−1` from
`random.Random(seed)`:

- a market factor per day from the regime's drift and volatility;
- each asset's return = its drift + beta × factor + its own noise + any news
  effect;
- news effects spread a total move over several days, front-loaded, and can
  open with a gap;
- highs, lows and volume are derived from the day's move.

Prices are rounded to cents. Scenarios are authored JSON; there is no live or
downloaded market data.

## Time

The server owns the clock. A tick is one market day. Solo matches run at 2 s
per day at 1× (1 s at 2×, 0.5 s at 4×) and can be paused and stepped one day
at a time while paused. Multiplayer runs at 3 s per day with no pause. The
current tick is derived from the stored anchor and the server time, so a
reconnecting player sees the same state as one who never left. The tick
counter reads "Day N of M"; there is no countdown timer.

## Orders

| Type      | Placement                                           | Fill                                                                                            |
| --------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Market    | Buy or sell at the current day                      | Immediately at the close ± half the spread (the price the player saw)                           |
| Limit     | Buy below or sell above; reserves cash or shares    | On a later day when the bar reaches the limit, at the limit or a better open                    |
| Stop-loss | Sell only, below the current price; reserves shares | On a later day when the low reaches the stop, at the stop or a worse open, less half the spread |

Every fill pays a fee of 0.1 % of the order value, minimum $1, in every
shipped scenario, plus the spread (0.1 % in most scenarios; some lesson and
boss markets use 0.6 % or 1 %). The scenario's `allow` field enables limit
and stop orders only after they are taught. An optional `max_position_pct`
caps the share of equity in one symbol. Cash and holdings never go negative.
Open orders can be cancelled; a cancel at day _c_ happens after that day's bar,
so the order could still fill on day _c_.

Within a day the engine processes, in order: resting orders against the bar,
then cancels, then new human orders in placement order, then bots (market
orders only, deciding on what they could see, optionally with a reaction
delay). Equity and drawdown are recorded at each close.

## Results

At the end, profit is final equity (cash plus holdings at the last close)
minus starting cash. Ranks share equal profits; forfeits rank last. The result
adds the plan review (worst drawdown against the chosen maximum loss),
missions, an equal-weight buy-and-hold comparison, trade and fee stats, up to
five key moments and the unvalidated decision score, a 0–100 process score
with a per-part breakdown (`server/app/game/review.py`; current formula in the
build contract).

## Not modelled

Shorting, leverage, margin, buy-stop and stop-limit orders, partial fills,
order-book depth and queue position, per-asset spreads (one spread per
scenario), slippage beyond the spread, dividends, splits, taxes and
settlement periods. These are deliberate simplifications for a beginner game,
not claims about real markets.

## Verification

`server/tests/test_game_market.py`, `test_game_engine.py`,
`test_game_clock.py`, `test_game_bots.py`, `test_game_objectives.py`,
`test_game_scenario.py`, `test_game_api.py` and `test_game_balance.py` cover
determinism, fills and fees, reservations, rejections, the clock, bots,
missions, validation, the API and balance. They do not establish real-market
fidelity or learning outcomes.
