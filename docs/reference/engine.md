# Trading engine

`server/app/game/` runs every match: a synthetic, long-only market of
fictional companies, not historical data or an exchange emulator. It knows
nothing about chapters or currencies; see
[ARCHITECTURE.md](../../ARCHITECTURE.md#match-data-flow) for the hooks that
supply them. Match modes and settlement are in [matches](matches.md); the
scenario and bot file formats are in the [authoring guide](../content/authoring.md).

| File            | Role                                                          |
| --------------- | ------------------------------------------------------------- |
| `scenario.py`   | Load and validate scenario JSON and the bot catalog           |
| `market.py`     | Seeded price path: factor model plus news effects, OHLCV bars |
| `engine.py`     | Pure replay of orders and bots up to a tick                   |
| `bots.py`       | Deterministic AI strategies                                   |
| `objectives.py` | Mission predicates and live mission states                    |
| `review.py`     | Decision score and key moments                                |
| `balance.py`    | Monte-Carlo gauntlet of synthetic players                     |
| `clock.py`      | Server-owned time                                             |
| `service.py`    | Create, start, order, cancel, finish; calls the hooks         |

## Replay

A match is a pure function of `(scenario, seed, participants, human orders,
current tick)`. Every read regenerates the price path, replays the stored
human orders (`game_orders`) and the deterministic bots up to the current tick,
and returns the public state. Only commands write to the database. Future bars
and news are never sent. A match whose scenario was removed or changed
`version` cannot be read or played (409).

## Price path

`random.Random(seed)` is the only randomness source. For each tick `t` from
`-history` to `ticks-1`:

```
m_t      = regime.market_drift + market.vol · regime.vol_mult · N(0,1)
r_{i,t}  = asset.drift + asset.beta · m_t + asset.vol · regime.vol_mult · N(0,1) + news_{i,t}
close    = prev_close · (1 + r)
open     = prev_close · (1 + gap_{i,t})          # gap only on news with "gap": true
high/low = max/min(open, close) · (1 ± |N(0,1)| · asset.vol · 0.6)
volume   = base_volume · (1 + 4·|r|/asset.vol) · lognormal(0, 0.25)
```

A news effect `{symbol, move, ticks, gap}` spreads a total fractional move over
`ticks` days with weights `ticks, ticks-1, …, 1`; `gap: true` applies the first
share as an opening gap. `asset.price` is the close before the first history
bar. Bar prices are rounded to cents; cash and fees use `Decimal` cents.

## Ticks

One tick is one market day (one candle).

- While `0 ≤ tick < ticks`, bars `0..tick` are processed and bar `tick`'s close
  is the price the player sees and trades at.
- At `tick == ticks` the match has ended: no bar is added, no order or cancel
  is accepted, and equity is valued at the close of bar `ticks − 1`.
- The briefing processes no bars and shows only the history.

## Execution

Each tick is processed in this order:

1. Resting orders placed before this tick are checked against the bar.
   - Buy limit fills when `low ≤ limit`, at `min(limit, open)`.
   - Sell limit fills when `high ≥ limit`, at `max(limit, open)`.
   - Stop-loss (sell only) triggers when `low ≤ stop`, fills at
     `min(stop, open) × (1 − spread/2)`.
2. Cancels at this tick, then new human orders in placement order
   (`game_orders.seq`). Market orders fill at `close × (1 ± spread/2)`, the
   price the player saw. A cancel at tick `c` happens after bar `c`, so the
   order could still fill on bar `c`.
3. Bots decide on bars and news up to this tick and trade at market under the
   same rules. A bot with `delay: d` decides from tick `t − d` and trades at
   tick `t`'s price.

Freeing cash or shares earlier in a tick never invalidates a later order, so a
replay always reproduces the validated state. Equity and drawdown are recorded
at each close.

| Rule             | Value                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Starting cash    | $10,000 unless the scenario says otherwise (every shipped scenario uses $10,000)                           |
| Fee              | `max(min_fee, fee_rate × value)` per fill; 0.1 %, minimum $1 in every shipped scenario                     |
| Spread           | One per scenario; 0.1 % in 61 scenarios, 0.6 % in two, 1 % in one                                          |
| Reservations     | Buy limits reserve cash and sells reserve shares when placed, so a fill never fails                        |
| Sell fee         | Every sell must leave enough available cash to pay its fee at the order's price                            |
| Order types      | Market always; `limit` and `stop` only when the scenario's `allow` enables them                            |
| Position cap     | Optional `max_position_pct` of equity per symbol                                                           |
| Prices           | Whole cents (422 from validation otherwise)                                                                |
| Same-tick cancel | An order cancelled on the tick it was placed counts as never placed for missions, badges and the score     |
| Rejection        | 422 with a plain-language `detail`, logged as a `rejected` event                                           |
| Rejected when    | Not enough cash or shares, cap exceeded, type disabled, stop not a sell or not below price, ended, no plan |
| Order response   | Carries the replayed state, equal to the next `GET`                                                        |

Not modelled: shorting, leverage, margin, buy-stop and stop-limit orders,
partial fills, order-book depth and queue position, per-asset spreads,
slippage beyond the spread, dividends, splits, taxes and settlement periods.

## Clock

```
games.clock  = {anchor_tick, anchor_at (ms epoch), tick_ms, paused, speed}
current_tick = paused ? anchor_tick : min(ticks, anchor_tick + floor((now − anchor_at) / tick_ms))
```

- Solo: `tick_ms = 2000 / speed`, speed 1, 2 or 4. `step` advances exactly one
  tick and is accepted only while paused. A solo forfeit pauses the clock.
- Multiplayer (`private`, `ranked`): fixed `tick_ms = 3000`; clock commands
  return 403.
- Pause, resume, speed and step re-anchor, so the tick never jumps backwards.
- Status: `briefing` (created) → `running` (started) → `ended` (derived, tick
  == ticks) → `settled` (stored, once every human participant has finished).
  Multiplayer matches are created `running`.

The tick counter reads "Day N of M"; there is no countdown timer.

## Bots

Bots publish profit, rank and a one-line style, never their orders. They trade
only at market and see only bars and news up to their observed tick. Every
strategy accepts optional `delay` (0–5 ticks) and `symbols` (default: every
symbol); `weight` is the share of equity spread across the traded symbols.

| Strategy         | Rule                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buy_hold`       | Buys at tick `at`; never sells                                                                                                                                                                                                  |
| `momentum`       | Buys when close > SMA(`sma`) (and the SMA is rising if `rising`, and close is the `high_window`-day high if non-zero); sells when close < SMA(`exit_sma`)                                                                       |
| `mean_reversion` | Buys after `red_candles` red candles or RSI(`rsi_window`) below `rsi_below` (only above `trend_sma` if non-zero); sells at `exit_sma`, `+take_profit` or a `trail` drop from the peak                                           |
| `emotional`      | Buys after `streak` up closes or a positive headline; sells everything on a negative headline or a day down by `drop`                                                                                                           |
| `scalper`        | Buys a green close larger than `min_move`; sells at the next tick                                                                                                                                                               |
| `breakout`       | Buys a close above the prior `window` high with volume ≥ `volume_mult` × average (0 ignores volume); sells below the breakout level × (1 − `buffer`)                                                                            |
| `news_reactor`   | Buys after positive headlines, sells after negative ones, skips kinds in `ignore`; with `fade_gap`, fades rumor/hype gaps larger than it                                                                                        |
| `risk_manager`   | Above `trend_sma`, risks `risk` of equity with a stop under the `stop_window` low, caps exposure at `max_exposure`, sells half at `take_half_r` × R and moves the stop to entry; optional SMA10, hype and volume-climax filters |

Roster (`content/bots.json`, 24 bots): HODL Hannah, Momentum Max, Value Vera,
Panic Pete, Breakout Bea, Newsy Nina and Steady Stella in rookie, pro and elite
tiers (`<name>-rookie|-pro|-elite`; Hannah's pro id is `hodl-hannah`), Scalper
Sam in rookie and pro, and Ironhand Iris (elite only). Bosses use 1–3 bots,
level practices 0–1, dailies one, practice markets three, `mp-*` markets none.

## Missions

Each scenario has 1–5 basic and 0–5 bonus missions. Boss bonus missions are
the chapter's concept checks.

| Type                                                        | Met when                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `trades_min{n}` / `trades_max{n}`                           | At least / at most `n` fills                                        |
| `use_order{type, n}`                                        | `n` orders of that type placed                                      |
| `hold_at_end{symbol?}` / `end_in_cash`                      | Holding (that symbol) / holding nothing at the end                  |
| `profit_min{amount}` / `profit_pct_min{pct}`                | Profit at least the amount / percentage                             |
| `rank_max{rank}`                                            | Rank ≤ `rank` (1 = beat every bot); met when there are no opponents |
| `beat_bot{bot_id}`                                          | Profit above that bot                                               |
| `beat_buy_hold{symbol}`                                     | Profit above buying and holding that symbol                         |
| `max_drawdown{pct}` / `max_position{pct}`                   | Drawdown / largest position never above `pct`                       |
| `min_holdings{n}`                                           | `n` distinct symbols held at once                                   |
| `sold_after_news{news_id, within}` / `bought_after_news{…}` | A sell / buy fill of a headline symbol within `within` days         |
| `no_buy_between{from, to}`                                  | No buy in that tick range                                           |
| `stop_loss_set`                                             | A stop-loss placed                                                  |
| `kept_plan`                                                 | Worst drawdown within the plan's maximum loss                       |
| `max_position_before{tick, pct, symbol?}`                   | No position above `pct` of equity before `tick`                     |
| `held_between{symbol, from, to}`                            | Holding `symbol` throughout the range                               |
| `exited_by{symbol, tick}`                                   | No shares of `symbol` from `tick` on                                |

Live states: milestone missions (`trades_min`, `use_order`, `stop_loss_set`,
`min_holdings`, `sold_after_news`, `bought_after_news`, `held_between`) are
`pending` until met, then `done`. End-judged missions read `on_track` or
`behind`; single-breach rules (`trades_max`, `max_drawdown`, `max_position`,
`no_buy_between`, `max_position_before`, `kept_plan`) become `failed` once
broken. At the end every mission is `done` or `failed`; a forfeit fails all of
them. Final results never say "Not yet": an unmet mission reads "Missed" or a
precise end state such as "Still holding".

## Results

`finish` and `GET /result` return the result; field types are in
[`client/api/api-types.ts`](../../client/api/api-types.ts) (`GameResult`).

- `profit = final equity − starting cash`, equity = cash + holdings × final
  close, after fees and spread. Equal profit to the cent shares a rank.
- `won` needs at least one opponent, rank 1 unshared and no forfeit.
- `plan_review`: strategy, maximum loss, worst drawdown, `kept_loss_limit`.
- `stats`: trades, fees, biggest position %, max drawdown %, `buy_hold_profit`
  (an equal-weight buy of every asset at tick 0's ask).
- `key_moments`: up to five sentences generated from news, fills, stop-loss
  exits and the deepest drawdown. `debrief` is scenario-authored.
- `reflection`: optional text sent with `finish`; it can be added once after
  settlement and is never graded.
- `stars`, `rewards`, `unlocked`: added by settlement (see
  [matches](matches.md#settlement)).

`decision_score` (0–100) is an **unvalidated** process score that never decides
a win (`review.py`):

| Component        | Default points | Share earned                                                                                                        |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Process missions | 40             | Bonus missions met (basic when there are no bonus); `profit_*`, `rank_max`, `beat_bot`, `beat_buy_hold` never count |
| Plan kept        | 25             | Worst drawdown ≤ `max_loss_pct`                                                                                     |
| Risk discipline  | 25             | Buy fills with a stop on that symbol resting within one tick                                                        |
| Low overtrading  | 10             | `1 − min(1, fees / max(1, abs(profit)))`                                                                            |

A component the player could not act on (stops disabled, no process missions)
is left out and the others are rescaled to whole points summing to 100.
`decision_breakdown` holds the points and `decision_max` the points available.

## Balance gauntlet

`balance.gauntlet(scenario, seeds)` plays four synthetic players against the
scenario's bots: `idle`, `random` (trades on about 30 % of days),
`buy_hold_all` and `sensible` (a reference trend follower).
`server/tests/test_game_balance.py` runs every shipped scenario whose
`balance` class has limits over seeds 0–49:

| Class    | Idle win rate | Random win rate | Shipped scenarios       |
| -------- | ------------- | --------------- | ----------------------- |
| `boss`   | ≤ 5 %         | ≤ 10 %          | `ch1-boss` … `ch8-boss` |
| `daily`  | ≤ 10 %        | ≤ 25 %          | the seven `daily-*`     |
| `lesson` | not gated     | not gated       | the 40 level practices  |

`null` (practice and `mp-*` markets) is not gated. A boss needs at least one
bot. Fees and the spread are the designed defence against button-smashing;
the gauntlet checks synthetic players only, not real ones.

## Tests

`server/tests/test_game_market.py`, `test_game_engine.py`,
`test_game_clock.py`, `test_game_bots.py`, `test_game_objectives.py`,
`test_game_scenario.py`, `test_game_api.py` and `test_game_balance.py` cover
determinism, fills and fees, reservations, rejections, the clock, bots,
missions, validation, the API and balance. They do not establish real-market
fidelity or learning outcomes.
