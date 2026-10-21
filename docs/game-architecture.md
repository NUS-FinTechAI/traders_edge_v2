# Game architecture

This document is the build contract for the playable game. The
[game design document](game-design.md) governs gameplay; this file records how
the code implements it and the decisions that fill the design document's open
questions (§12).

## Core loop

1. **Learn**: a level opens with 4–5 short lesson cards.
2. **Check**: 4–5 questions with instant feedback and an explanation. A
   question answered wrongly comes back at the end of the set until it is
   right. First-try accuracy is recorded.
3. **Practise**: a short trading mission (20–40 market days) in the trading
   arena. A scripted market and mission objectives apply the level's concept.
4. **Earn**: the normal star for finishing the check and the basic missions,
   the special star for the bonus missions, XP, and map rewards.
5. **Prove it**: each chapter ends with a boss, a trading match against named
   AI opponents ranked by total profit.

The chapter map is `Preview Battle → L1 … L5 → Chapter Boss`. The Preview
Battle runs the boss scenario with a fresh seed before the lessons. It cannot
be failed. It is the research pre-measure, and the boss is the post-measure.
Level 1 opens once the Preview has been played to its last day; a Preview left
early records an attempt but pays no XP and keeps Level 1 locked. Each locked
chapter card offers
a **Gate Boss**, a parallel form of the previous chapter's boss: winning it
unlocks the chapter early, after a friendly "we recommend playing in order"
message. A gate boss is refused (409) once its chapter is open. Each chapter holds 12 stars: 5 levels × 2 plus the boss × 2. The boss
special star needs a win with every boss bonus mission met.

Daily challenges, practice matches, quizzes and multiplayer reuse the same
trading engine. The full curriculum and AI personalities are in the
[curriculum spec](curriculum/game-spec.md).

## Decisions for open design questions

| Question (GDD §)     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profit (§3.3)        | `profit = final equity − starting cash`. Equity = cash + holdings × final close. Fees and spread are included.                                                                                                                                                                                                                                                                                                                                                          |
| Ties (§3.3)          | Equal profit (to the cent) shares a rank. A shared first place is not a win against AI. A match without opponents is never a win; a `rank_max` mission still counts as met there, because there is no one to beat.                                                                                                                                                                                                                                                      |
| Early exit (§3.3)    | Leaving a running match forfeits it: the player ranks last and receives no win rewards. Leaving after the last day finishes the match normally.                                                                                                                                                                                                                                                                                                                         |
| Stale matches        | A match whose scenario was removed or changed version is left out of `GET /api/games`, cannot be read or played (409), and `finish` closes it as a forfeit with no rewards. It never counts as an open daily.                                                                                                                                                                                                                                                           |
| Disconnects (§8.2)   | Matches run on the server clock. A disconnected player keeps their positions and is ranked normally.                                                                                                                                                                                                                                                                                                                                                                    |
| Duration (§3.3)      | Lessons 20–40 market days, bosses 30–45, dailies 30. One market day = one candle. Solo: 1× = 2 s per day, 2× and 4× available, plus pause and "next day" stepping. Multiplayer: fixed 3 s per day, no pause.                                                                                                                                                                                                                                                            |
| Starting conditions  | $10,000 simulated cash unless a scenario says otherwise. Long-only. No leverage.                                                                                                                                                                                                                                                                                                                                                                                        |
| Fees                 | 0.1 % of order value, minimum $1, plus the bid/ask spread (default 0.10 %). This makes random clicking lose money.                                                                                                                                                                                                                                                                                                                                                      |
| Plan before trading  | One game plan per match, chosen in the briefing: a strategy chip and a maximum loss. The order ticket offers an optional stop-loss and shows "risk if stopped: $X (Y %)". Results compare the plan with what happened. Orders are one click. Every order needs a plan (422 "Choose your game plan before trading."). Multiplayer matches start running, so each player sets the plan once during the first 3 days (ticks 0–2); later, `POST /start` returns 409.        |
| Order types          | Unlocked as taught. Market from the start, limit after Ch2 L3, stop-loss after Ch2 L4. Each scenario's `allow` field enforces this.                                                                                                                                                                                                                                                                                                                                     |
| AI difficulty (§5.2) | Chapter bosses rise in difficulty through bot strategy mix, parameters and reaction speed. A Monte-Carlo balance test asserts that idle and random players lose bosses.                                                                                                                                                                                                                                                                                                 |
| Daily form (§6)      | Weekday rotation of seven daily scenarios against one AI. The first attempt of the day uses the day's shared seed, drawn at random on first use and stored in `daily_seeds`; retries use fresh seeds, so a retry cannot be memorised. Unlocks after the Chapter 1 boss.                                                                                                                                                                                                 |
| Open daily           | One daily at a time: while today's daily is in the briefing, running or ended but not finished, a new daily returns 409 "Finish your current daily challenge first" and `GET /api/daily` names it in `active_game_id`. A daily that ended unfinished is settled with its result on the next daily request, so a loss starts the 2-hour cooldown. A daily starts only on the UTC day it was created for (409 "This daily challenge has expired") and outside a cooldown. |
| Daily reset          | 00:00 UTC. The reset clears any cooldown from the previous day, and settling an earlier day's daily never starts today's cooldown.                                                                                                                                                                                                                                                                                                                                      |
| Currencies (§7)      | **Sim cash** (`$`, green banknote, exists only inside a match), **Doubloons** (the GDD's "Stocks"; gold coin; weekly, expire Monday 00:00 UTC; internal key `stocks`), **Gems** (purple; premium, from ranked play only; never sold for real money).                                                                                                                                                                                                                    |
| Premium refresh      | 20 Gems skips the daily cooldown. Ranked: win +15 Gems, loss +5 (if the player placed an order), first ranked win of the day +10.                                                                                                                                                                                                                                                                                                                                       |
| Ranked rewards       | Win rewards (XP, Gems, first-win bonus) need a contested win: at least one human opponent placed an order and did not forfeit before the last third of the match. Other wins pay the loss rewards. Ranked XP and ranked Gems each pay for at most 5 matches per UTC day. Elo is unchanged by these rules.                                                                                                                                                               |
| Ranked rating (§9)   | Elo, start 1000, K = 32, pairwise against every other human in the match. Equal profit is a draw. Tiers: Bronze < 1100, Silver < 1300, Gold < 1500, Platinum < 1700, Diamond. Private lobbies never change rating.                                                                                                                                                                                                                                                      |
| Lobby size (§8)      | 2–30 humans (classes). The host picks the scenario and may add up to 3 AI opponents: the scenario's bots first, then Momentum Max (pro), Value Vera (pro) and HODL Hannah.                                                                                                                                                                                                                                                                                              |
| XP                   | See [Progression](#progression). Private lobbies and classroom quizzes give no XP.                                                                                                                                                                                                                                                                                                                                                                                      |
| Unlocks (§4.3)       | Chapter 1 is open. Chapter _n_ unlocks by winning chapter _n−1_'s boss **or** chapter _n_'s gate boss. The boss unlocks when every level in its chapter has a normal star. Retries are unlimited and re-seeded.                                                                                                                                                                                                                                                         |
| Multiplayer access   | Private lobbies have no prerequisite (classroom use). Ranked matchmaking unlocks after winning the Chapter 3 boss.                                                                                                                                                                                                                                                                                                                                                      |
| Matchmaking          | Pairing runs under one global lock (a PostgreSQL advisory transaction lock; SQLite serialises writers) on both `POST` and `GET /api/matchmaking`. A search older than 2 minutes is never paired and reads as `idle`, so the client searches again. `DELETE` after a match started returns 409 "Your match has started".                                                                                                                                                 |
| Content approval     | `content/review.json` records the independent financial and pedagogical review. In production, level content and checks, the daily, games, quizzes, lobbies and matchmaking return 503 "Game content is awaiting independent review" until its status is `approved`. Development serves authored content.                                                                                                                                                               |

## Backend

One FastAPI app. Kept infrastructure: `config.py`, `db.py`, `auth.py`,
`migrations.py` (append-only), `public_config.py`, `research.py`.

```
server/app/
  game/
    scenario.py     # load + validate scenario JSON, bots catalog
    market.py       # seeded price path: factor model + news effects → OHLCV bars
    engine.py       # pure replay: (scenario, seed, participants, orders, tick) → state
    bots.py         # deterministic AI strategies
    objectives.py   # mission predicates evaluated on engine state
    clock.py        # server-owned time: anchors, pause, speed
    models.py       # games, game_participants, game_orders, game_events
    service.py      # create/start/order/finish + settlement hooks
    api.py          # /api/games
  campaign/         # chapters, levels, check answers, stars, unlocks
  player/           # profile, XP/levels, wallet, streak, cosmetics, badges, shop, leaderboards
  quiz/             # quiz bank, attempts, classroom rooms
  multiplayer/      # lobbies, matchmaking, Elo (games run on app/game)
  content/
    campaign/ch1.json … ch8.json   # one chapter each: levels → cards, checks, practice
    scenarios/*.json
    bots.json
    quiz_bank.json
    cosmetics.json  # avatars, titles, badges
```

### Engine model

A match is a pure function of `(scenario, seed, participants, human orders,
current tick)`. Bots are deterministic, so state is rebuilt on each read.
Only commands write to the database.

**Price path** (`market.py`). For each tick `t` from `-history` to `ticks-1`:

```
m_t      = regime.market_drift + market.vol · regime.vol_mult · N(0,1)
r_{i,t}  = asset.drift + asset.beta · m_t + asset.vol · regime.vol_mult · N(0,1) + news_{i,t}
close    = prev_close · (1 + r)
open     = prev_close · (1 + gap_{i,t})          # gap only on news with "gap": true
high/low = max/min(open, close) · (1 ± |N(0,1)| · asset.vol · 0.6)
volume   = base_volume · (1 + 4·|r|/asset.vol) · lognormal(0, 0.25)
```

A news effect `{symbol, move, ticks, gap}` spreads a total fractional move
over `ticks` days, front-loaded with weights proportional to
`ticks, ticks-1, …, 1`. `gap: true` applies the first share as an opening gap.
`random.Random(seed)` is the only randomness source. `asset.price` is the close
before the first history bar. Bar prices are rounded to cents; cash and fees
use `Decimal` cents.

**Ticks.** While `0 ≤ tick < ticks`, bar `tick` is the current day: bars
`0..tick` are processed and its close is the price the player sees and trades
at. At `tick == ticks` the match has ended: no bar is added, no order or cancel
is accepted, and equity is valued at the close of bar `ticks − 1`. The
briefing processes no bars and shows only the history. A cancel at tick `c`
happens after bar `c`, so the order could still fill on bar `c`.

**Execution** (`engine.py`). Each tick is processed in order:

1. Resting orders placed before this tick are checked against the bar.
   A buy limit fills when `low ≤ limit` at `min(limit, open)`. A sell limit
   fills when `high ≥ limit` at `max(limit, open)`. A stop-loss (sell) triggers
   when `low ≤ stop` and fills at `min(stop, open) × (1 − spread/2)`.
2. Human market orders placed at this tick fill at `close × (1 ± spread/2)`.
   This is the price the player saw.
3. Bots decide on information up to this tick (closes, news published at or
   before it) and trade with market orders under the same rules. A bot with
   `delay: d` decides from the market as it was at tick `t − d` and trades at
   tick `t`'s price.

Within a tick, cancels are applied before new orders, then new orders in
placement order (`game_orders.seq`). Freeing cash or shares earlier never
invalidates a later order, so a replay always reproduces the validated state.

Every fill pays `max(min_fee, fee_rate × value)`. Buy limits reserve cash and
sells reserve shares when placed, so a fill never fails. Every sell (market,
limit or stop) must leave enough available cash to pay its fee at the order's
price. An order that breaks a rule (cash, holdings, `max_position_pct`,
disabled order type, finished match, no plan) is rejected with 422 and a
plain-language reason. Prices must be whole cents (422 from validation). An
order cancelled on the tick it was placed counts as never placed for missions,
badges and the discipline score. The order response carries the replayed
state, so it equals the next `GET`.

### Clock

```
games.clock = {anchor_tick, anchor_at (ms epoch), tick_ms, paused, speed}
current_tick = paused ? anchor_tick : min(ticks, anchor_tick + floor((now − anchor_at) / tick_ms))
```

Solo: `tick_ms = 2000 / speed` for speed 1, 2 or 4. `step` advances exactly
one tick and is accepted only while paused. Multiplayer (`private`, `ranked`):
fixed `tick_ms = 3000`; clock actions return 403. Pause, resume, speed and step
re-anchor. Status: `briefing` (created) →
`running` (started) → `ended` (tick == ticks) → `settled` (finish called).
`ended` is derived; `settled` is stored.

### Settlement

`POST /api/games/{id}/finish` settles once per participant: final rank, profit,
missions, stars (campaign), XP, Doubloons/Gems, Elo, badges. All writes use
natural unique keys (e.g. `xp_ledger(user, "game:<id>")`), so repeats return
the stored result.

### Research log

`game_events` stores each human command with its observed context: tick,
visible prices, cash, holdings, open orders and the latest headline. It also
stores the plan, the final result, the attempt number and whether a Gem
refresh enabled the attempt. This covers GDD §10.2.

### Tables (migration 11)

- `games`: id, mode, scenario_id, scenario_version, seed, status, clock (JSON),
  context (JSON, from `GameSpec`), host_user_id, lobby_id, chapter_id,
  level_id, boss (`gate`|`final`|null), created_at, settled_at.
- `game_participants`: id, game_id, user_id (null for bots), bot_id,
  display_name, plan (JSON), result (JSON), forfeited.
- `game_orders`: id, game_id, participant_id, client_order_id (unique per
  participant), seq (placement order per participant), tick, symbol, side,
  type, qty, limit_price, stop_price, cancelled_tick, created_at.
- `game_events`: id, game_id, participant_id, tick, kind, payload (JSON), created_at.
- `campaign_progress`: user_id, level_id, check_best, check_passed,
  normal_star, special_star, best_profit, plays, updated_at.
- `campaign_checks`: user_id, level_id, question_id, first_option_id,
  first_correct, solved (first-ever answers, for research), run_first_correct,
  run_solved (the current run of the check; reset when it completes).
- `boss_results`: user_id, chapter_id, kind (`gate`|`boss`|`preview`), won,
  best_profit, attempts, first_won_at. For the Preview Battle, `won` records
  that it was played to the last day.
- `daily_seeds`: day, seed, created_at.
- `quiz_attempts_v2`, `quiz_rooms_v2`, `quiz_room_members_v2`.
- `lobbies`, `lobby_members`, `matchmaking_queue`, `ratings`.

Existing `profiles`, `sessions`, `xp_ledger`, `economy_accounts`,
`economy_events` and `reward_grants` are reused.

## API

All bodies are JSON. Mutations need an allowed `Origin`, as today. Idempotency
uses natural keys (`client_order_id`, unique events), not receipt tables.

### Games

| Method & path                                                                                                                         | Purpose                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/games` `{mode, scenario_id?, level_id?, chapter_id?, boss?: "gate"\|"final", bots?: n}`                                    | Create a match in `briefing`. `mode`: `level`, `boss`, `daily`, `practice`. The server picks the scenario for `daily` and `boss`. A daily that cannot start now returns 409 `{detail}`. |
| `GET /api/games/{id}?since=<tick>`                                                                                                    | Full public state (below). `since` limits the returned bars and news to newer ticks.                                                                                                    |
| `POST /api/games/{id}/start` `{plan: {strategy, max_loss_pct}}`                                                                       | Leave the briefing and start the clock.                                                                                                                                                 |
| `POST /api/games/{id}/clock` `{action: pause\|resume\|step\|speed, speed?: 1\|2\|4}`                                                  | Solo modes only.                                                                                                                                                                        |
| `POST /api/games/{id}/orders` `{client_order_id, symbol, side: buy\|sell, type: market\|limit\|stop, qty, limit_price?, stop_price?}` | Place an order at the current tick. A repeat `client_order_id` returns the original order.                                                                                              |
| `DELETE /api/games/{id}/orders/{order_id}`                                                                                            | Cancel a resting order.                                                                                                                                                                 |
| `POST /api/games/{id}/finish` `{forfeit?: bool, reflection?: string}`                                                                 | Settle; returns the result.                                                                                                                                                             |
| `GET /api/games/{id}/result`                                                                                                          | Stored result.                                                                                                                                                                          |
| `GET /api/games?status=active`                                                                                                        | The player's unfinished matches (resume).                                                                                                                                               |

**Game state**:

```jsonc
{
  "id": "…",
  "mode": "boss",
  "status": "running",
  "tick": 17,
  "ticks": 60,
  "tick_label": "Day",
  "tick_ms": 2000,
  "speed": 1,
  "paused": false,
  "server_time": 1792500000000,
  "next_tick_at": 1792500001200,
  "scenario": {
    "id": "ch2-final",
    "title": "…",
    "briefing": "…",
    "objective": "…",
    "tools": ["candles", "volume", "sma"],
    "allow": { "limit": true, "stop": true },
    "max_position_pct": null,
    "fee": { "rate": 0.001, "min": 1 },
    "spread": 0.001,
  },
  "assets": [
    {
      "symbol": "LEAF",
      "name": "Leafy Greens Co.",
      "sector": "Consumer",
      "blurb": "…",
      "price": 51.2,
      "change_pct": 1.4,
    },
  ],
  "bars": {
    "LEAF": [
      { "t": -20, "o": 50, "h": 50.6, "l": 49.8, "c": 50.3, "v": 12000 },
    ],
  },
  "news": [
    {
      "id": "n1",
      "t": 12,
      "headline": "…",
      "body": "…",
      "symbols": ["LEAF"],
      "tone": "positive|negative|neutral",
    },
  ],
  "me": {
    "participant_id": "…",
    "cash": 7421.1,
    "equity": 10180.4,
    "profit": 180.4,
    "profit_pct": 1.8,
    "positions": [
      {
        "symbol": "LEAF",
        "qty": 50,
        "avg_price": 51.5,
        "value": 2560,
        "unrealized": -15,
      },
    ],
    "orders": [
      {
        "id": "…",
        "symbol": "LEAF",
        "side": "buy",
        "type": "limit",
        "qty": 10,
        "limit_price": 49,
        "status": "open|filled|cancelled",
        "tick": 15,
      },
    ],
    "fills": [
      {
        "order_id": "…",
        "t": 15,
        "symbol": "LEAF",
        "side": "buy",
        "qty": 50,
        "price": 51.5,
        "fee": 2.58,
      },
    ],
    "max_drawdown_pct": 2.1,
    "plan": { "strategy": "trend", "max_loss_pct": 10 },
  },
  "leaderboard": [
    {
      "participant_id": "…",
      "name": "Momentum Max",
      "kind": "bot|human",
      "bot_id": "momentum-max",
      "avatar": "bull",
      "profit": 210.5,
      "rank": 1,
      "is_me": false,
    },
  ],
  "missions": [
    {
      "id": "m1",
      "tier": "basic|bonus",
      "text": "Place a limit order below the market",
      "done": true,
      "progress": "1/1",
    },
  ],
  "result": null,
}
```

Bots publish profit, rank and a one-line style ("Buys strength"), never their
orders, so the leaderboard is live without revealing strategies. Future bars
and news are never sent.

**Result** (`finish` and `/result`):

```jsonc
{ "won": true, "rank": 1, "of": 3, "profit": 512.3, "profit_pct": 5.1,
  "leaderboard": [...], "missions": [...], "stars": {"normal": true, "special": false},
  "rewards": { "xp": 70, "stocks": 200, "gems": 0, "items": [{"id": "avatar-bull", "kind": "avatar", "name": "Bull"}],
               "badges": [{"id": "first-profit", "name": "In the green"}] },
  "plan_review": { "strategy": "trend", "max_loss_pct": 10, "worst_drawdown_pct": 4.2, "kept_loss_limit": true },
  "stats": { "trades": 6, "fees": 18.4, "biggest_position_pct": 38, "max_drawdown_pct": 4.2, "buy_hold_profit": 310.0 },
  "decision_score": 72,
  "key_moments": ["Day 18: Leafy Greens wins a contract (+8.0%). You held 40 LEAF and gained $160.00."],
  "forfeited": false,
  "debrief": "What happened in this market and the lesson it teaches (scenario-authored).",
  "unlocked": { "chapter_id": "ch3" } }
```

`won` needs at least one opponent, rank 1 unshared and no forfeit. A forfeit
marks every mission not done. In final results an unmet mission never reads
"Not yet"; it says "Missed" or a precise end state such as "Still holding".
`buy_hold_profit` is an equal-weight buy of every asset at tick 0's ask.

`decision_score` (0–100) is an **unvalidated** process score that never decides
a win. Its components and default weights are: process missions 40 (share of
bonus missions met, basic missions when there are no bonus missions; profit
and rank missions — `profit_min`, `profit_pct_min`, `rank_max`, `beat_bot`,
`beat_buy_hold` — never count), plan kept 25 (worst drawdown ≤
`max_loss_pct`), risk discipline 25 (share of buy fills with a stop on that
symbol resting within one tick after the fill) and low overtrading 10 (1 −
min(1, fees / max(1, |profit|))). A component the player could not act on —
risk when the scenario disables stops, missions when it has no process
missions — is left out and the others are rescaled to whole points that sum to 100. `decision_breakdown` holds the points and `decision_max` the points
available per component (0 for a component left out). `key_moments` holds up
to five generated sentences from news, fills, stop-loss exits and the deepest
drawdown.

The game state also carries `me.available_cash` (cash minus reserved cash),
each order's `client_order_id` and `stop_price`, news `kind`, and leaderboard
`style`, `tier` and `forfeited`. Plan strategies are `trend`, `dip`,
`breakout`, `news`, `hold` and `cautious`; `max_loss_pct` is 1–50. A rejected
order returns 422 `{detail}` and is logged as a `rejected` event.

### Campaign, player, quizzes, multiplayer

| Method & path                                                                                                                                                               | Purpose                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/campaign`                                                                                                                                                         | Chapters with lock state, stars earned/available, boss states, next level. Public (signed-out users see chapter 1 open, nothing earned).                                |
| `GET /api/campaign/chapters/{id}`                                                                                                                                           | Map: ordered nodes (`preview`, `level`, `reward`, `boss`) with state `locked\|open\|done`, stars and reward items; plus the gate boss state for skipping ahead.         |
| `GET /api/campaign/levels/{id}`                                                                                                                                             | Level content: cards, check questions (no answers), practice mission summary.                                                                                           |
| `POST /api/campaign/levels/{id}/check` `{question_id, option_id}`                                                                                                           | Grade one check answer: `{correct, correct_option_id, explanation}`. A wrong answer re-queues the question; the first answer per question counts as first-try accuracy. |
| `POST /api/campaign/levels/{id}/check/complete`                                                                                                                             | Close the check once every question has a correct answer: first-try score, check XP, and whether the practice mission is open.                                          |
| `GET /api/me`                                                                                                                                                               | Profile, level, XP to next, title, avatar, wallet, streak, today's claim state, unlock flags.                                                                           |
| `PATCH /api/me` `{display_name?, avatar_id?, title_id?, leaderboard_opt_in?}`                                                                                               | Update profile.                                                                                                                                                         |
| `POST /api/me/daily-login`                                                                                                                                                  | Claim today's login reward.                                                                                                                                             |
| `GET /api/me/activity`                                                                                                                                                      | Last 365 days of activity counts (heatmap) and streak days.                                                                                                             |
| `GET /api/me/collection`                                                                                                                                                    | Badges, avatars and titles with earned/locked and how to unlock.                                                                                                        |
| `GET /api/shop`, `POST /api/shop/purchase` `{item_id}`                                                                                                                      | Shop.                                                                                                                                                                   |
| `POST /api/daily/refresh`                                                                                                                                                   | Spend Gems to skip the daily cooldown.                                                                                                                                  |
| `GET /api/daily`                                                                                                                                                            | Today's daily: scenario summary, opponent, cooldown, won today, weekly Doubloon progress.                                                                               |
| `GET /api/leaderboards/xp`, `GET /api/leaderboards/ranked`                                                                                                                  | Global leaderboards (opted-in players).                                                                                                                                 |
| `GET /api/quizzes`                                                                                                                                                          | Quiz topics (per chapter + mixed) with best scores.                                                                                                                     |
| `POST /api/quizzes/attempts` `{topic_id, room_code?}`                                                                                                                       | Start a quiz: chapter quiz (10 items, pass ≥ 80 %), daily review (5 items) or mixed mastery (20 items). Options are shuffled.                                           |
| `POST /api/quizzes/attempts/{id}/answers` `{question_id, option_id}`                                                                                                        | Instant feedback with explanation; first answer is final. Optional confidence: `sure\|think\|guess`.                                                                    |
| `GET /api/quizzes/attempts/{id}`                                                                                                                                            | Attempt state / result.                                                                                                                                                 |
| `POST /api/quizzes/rooms` `{topic_id, title}`; `GET /api/quizzes/rooms/{id}`                                                                                                | Classroom quiz room with join code; the host sees every member's results.                                                                                               |
| `POST /api/lobbies` `{scenario_id?, bots: 0–3}`; `POST /api/lobbies/join` `{code}`; `GET /api/lobbies/{id}`; `POST /api/lobbies/{id}/start`; `POST /api/lobbies/{id}/leave` | Private lobbies. Starting creates a game; members read `game_id` from the lobby.                                                                                        |
| `POST /api/matchmaking`, `GET /api/matchmaking`, `DELETE /api/matchmaking`                                                                                                  | Ranked queue: join, poll, leave. Two humans make a match.                                                                                                               |

### Response shapes (campaign, player, quizzes, multiplayer)

Field names are exact. The server returns these as Pydantic models.

```ts
type NodeState = 'locked' | 'open' | 'done'
interface Reward {
  kind: 'avatar' | 'title' | 'badge'
  id: string
  name: string
  image: string | null // art key, e.g. 'parrot'; also on game result reward items
}

// GET /api/campaign
interface Campaign {
  chapters: ChapterCard[]
  next: { chapter_id: string; node_id: string; label: string } | null // "Continue" target
}
interface ChapterCard {
  id: string
  number: number
  title: string
  region: string
  tagline: string
  icon: string
  state: 'locked' | 'open' | 'complete' // complete = boss won
  unlocked_by: 'start' | 'boss' | 'gate' | null
  stars: number
  stars_total: number // 12 per chapter
  levels_done: number
  levels_total: number
  gate: { scenario_id: string; won: boolean; attempts: number } | null // offered while locked (chapter 2+)
}

// GET /api/campaign/chapters/{id}
interface ChapterMap {
  chapter: ChapterCard
  nodes: MapNode[] // in path order: preview, level×5 (+ reward nodes after their level), boss
}
interface MapNode {
  id: string // 'ch1-preview' | 'ch1-l1' | 'ch1-l3-reward' | 'ch1-boss'
  kind: 'preview' | 'level' | 'reward' | 'boss'
  title: string
  summary: string
  state: NodeState
  stars: { normal: boolean; special: boolean } | null // levels and boss
  objectives: string[] // levels: "In this lesson you will learn"
  xp: number // XP available on first completion
  reward: Reward | null // reward nodes and boss reward
  scenario_id: string | null // preview / boss
  best_profit: number | null
  attempts: number
  locked_reason: string | null // e.g. "Finish Level 2 first"
}

// GET /api/campaign/levels/{id}
interface Level {
  id: string
  chapter_id: string
  number: number
  title: string
  summary: string
  objectives: string[]
  terms: { term: string; definition: string }[]
  cards: { title: string; body: string; visual: string | null }[]
  check: {
    id: string
    kind: 'mc' | 'true_false'
    prompt: string
    options: { id: string; text: string }[] // mc: stable shuffled order per player, level and question; true_false: authored order
  }[]
  practice: {
    scenario_id: string
    title: string
    briefing: string
    missions: { tier: 'basic' | 'bonus'; text: string }[]
  }
  progress: {
    check_done: boolean
    check_best: number | null
    normal_star: boolean
    special_star: boolean
    plays: number
  }
}
// POST /api/campaign/levels/{id}/check  {question_id, option_id}
interface CheckAnswer {
  correct: boolean
  correct_option_id: string
  explanation: string
  first_try: boolean // first answer to this question in the current run
}
// POST /api/campaign/levels/{id}/check/complete  {} — a replayed check must be answered again first
interface CheckComplete {
  first_try_correct: number // this run
  first_ever_correct: number // the player's first-ever run (research; also Level.progress.check_best)
  total: number
  xp: number
  practice_unlocked: boolean
}

// GET /api/me → Player (see client/services/playerService.ts; includes avatar_image: string | null, the equipped avatar's art key); PATCH /api/me {display_name?, avatar_id?, title_id?, leaderboard_opt_in?} → Player
// POST /api/me/daily-login → { day: number; doubloons: number; xp: number; already_claimed: boolean; player: Player }
// GET /api/me/activity → { days: { date: string; count: number }[]; streak_days: number; week: { date: string; claimed: boolean; xp: number; doubloons: number }[] } // week = current 7-day cycle
// GET /api/me/collection
interface Collection {
  badges: {
    id: string
    name: string
    description: string
    earned: boolean
    earned_at: string | null
    progress: string | null
  }[]
  avatars: {
    id: string
    name: string
    image: string | null
    owned: boolean
    equipped: boolean
    how: string
  }[]
  titles: {
    id: string
    name: string
    image: string | null
    owned: boolean
    equipped: boolean
    how: string
  }[]
  stats: {
    levels_done: number
    stars: number
    bosses_won: number
    quizzes_passed: number
    matches_played: number
    best_profit: number | null
  }
}
// GET /api/shop → { items: { id: string; kind: 'avatar' | 'title' | 'theme'; name: string; description: string; currency: 'stocks' | 'gems'; price: number; owned: boolean; weekly: boolean }[] }
// POST /api/shop/purchase {item_id} → { item_id: string; player: Player }
// GET /api/daily
interface Daily {
  date: string
  unlocked: boolean
  locked_reason: string | null
  scenario: { id: string; title: string; briefing: string; ticks: number }
  opponent: {
    bot_id: string
    name: string
    avatar: string
    tier: string
    style: string
  }
  won_today: boolean
  attempts_today: number
  cooldown_until: string | null
  refresh_cost_gems: number
  active_game_id: string | null // today's unfinished daily to resume; a new daily is refused while it is open
  week: {
    doubloons: number
    target: number
    resets_at: string
    wins_this_week: number
  }
}
// POST /api/daily/refresh → Daily
// GET /api/leaderboards/xp | /ranked → { entries: { rank: number; name: string; avatar_id: string; level: number; value: number; tier?: string; is_me: boolean }[]; me: { rank: number | null; value: number } }
// GET /api/practice → { scenarios: { id: string; title: string; briefing: string; difficulty: number; bots: { bot_id: string; name: string; avatar: string; tier: string }[] }[] }
// GET /api/bosses → { bosses: { chapter_id: string; kind: 'boss' | 'gate'; scenario_id: string; title: string; state: NodeState; won: boolean }[] } // play-hub list

// Quizzes
// GET /api/quizzes → { topics: { id: string; kind: 'chapter' | 'review' | 'mixed'; title: string; questions: number; best: number | null; passed: boolean; locked: boolean }[]; rooms: QuizRoomSummary[] }
// POST /api/quizzes/attempts {topic_id?, room_code?} → QuizAttempt
interface QuizAttempt {
  id: string
  title: string
  room_id: string | null
  status: 'active' | 'complete'
  questions: {
    id: string
    prompt: string
    options: { id: string; text: string }[]
    answered: null | {
      option_id: string
      correct: boolean
      correct_option_id: string
      explanation: string
    }
  }[]
  score: number
  total: number
  passed: boolean | null
  xp: number
}
// POST /api/quizzes/attempts/{id}/answers {question_id, option_id, confidence?: 'sure'|'think'|'guess'} → QuizAttempt
// GET /api/quizzes/attempts/{id} → QuizAttempt
// POST /api/quizzes/rooms {topic_id, title} → QuizRoom ; GET /api/quizzes/rooms/{id} → QuizRoom
interface QuizRoomSummary {
  id: string
  title: string
  code: string
  is_host: boolean
  members: number
}
interface QuizRoom extends QuizRoomSummary {
  topic_title: string
  results: {
    name: string
    score: number | null
    total: number
    finished: boolean
  }[] // host sees all; members see only their own row
  my_attempt_id: string | null
}

// Multiplayer
interface Lobby {
  id: string
  code: string
  host_id: string
  is_host: boolean
  status: 'open' | 'started' | 'closed'
  scenario: { id: string; title: string; ticks: number }
  members: {
    user_id: string
    name: string
    avatar_id: string
    is_host: boolean
  }[]
  bots: number
  game_id: string | null
  max_members: number
}
// POST /api/lobbies {scenario_id?, bots} → Lobby; POST /api/lobbies/join {code} → Lobby; GET /api/lobbies/{id} → Lobby
// POST /api/lobbies/{id}/start → Lobby (game_id set); POST /api/lobbies/{id}/leave → 204
// GET /api/lobbies/scenarios → { scenarios: { id: string; title: string; briefing: string; ticks: number }[] }
// POST /api/matchmaking → Match; GET /api/matchmaking → Match; DELETE /api/matchmaking → 204
interface Match {
  status: 'idle' | 'searching' | 'matched'
  game_id: string | null
  rating: number
  tier: string
  waiting_since: string | null
  locked_reason: string | null
}
```

## Content formats

### Scenario (`content/scenarios/<id>.json`)

```jsonc
{
  "id": "ch1-l2-practice",
  "version": 1,
  "title": "First Buy",
  "briefing": "One or two sentences the player reads before starting.",
  "objective": "The concept this market tests.",
  "debrief": "What happened and why — shown on the results screen.",
  "difficulty": 1,
  "ticks": 40,
  "history": 20,
  "tick_label": "Day",
  "starting_cash": 10000,
  "fee": { "rate": 0.001, "min": 1 },
  "spread": 0.001,
  "allow": { "limit": false, "stop": false },
  "max_position_pct": null,
  "tools": ["candles"],
  "market": { "vol": 0.006 },
  "regimes": [{ "from": 0, "to": 40, "market_drift": 0.0015, "vol_mult": 1.0 }],
  "assets": [
    {
      "symbol": "LEAF",
      "name": "Leafy Greens Co.",
      "sector": "Consumer staples",
      "blurb": "Sells salad kits to supermarkets.",
      "price": 50,
      "drift": 0.0005,
      "beta": 1.0,
      "vol": 0.012,
      "base_volume": 10000,
    },
  ],
  "news": [
    {
      "id": "n1",
      "tick": 18,
      "headline": "Leafy Greens wins a national supermarket contract",
      "body": "…",
      "tone": "positive",
      "symbols": ["LEAF"],
      "kind": "company", // optional: earnings|macro|rumor|company|hype (default company)
      "effects": [{ "symbol": "LEAF", "move": 0.08, "ticks": 4, "gap": true }],
    },
  ],
  "bots": ["hodl-hannah"],
  "balance": "lesson", // optional: "boss" | "lesson" | null
  "missions": {
    "basic": [
      {
        "id": "m1",
        "type": "trades_min",
        "params": { "n": 1 },
        "text": "Buy at least one share",
      },
    ],
    "bonus": [
      {
        "id": "b1",
        "type": "profit_min",
        "params": { "amount": 1 },
        "text": "Finish with a profit",
      },
    ],
  },
}
```

Fictional companies only. Tickers are 3–5 capital letters. The validator
(`app/game/scenario.py`) rejects unknown fields and enforces: `ticks` 15–150,
`history` 5–120, 1–5 assets, regimes covering ticks `0..ticks` without gaps,
news ticks inside the match with effects ending by the last tick, effects and
missions that name known symbols, news and bots, 0–7 bots, 1–5 basic and 0–5
bonus missions, and unique ids. `tools` come from `candles`, `line`, `volume`,
`sma`, `ema`, `rsi`, `bollinger`. A `use_order` or `stop_loss_set` mission
needs that order type enabled in `allow`.

`balance: "boss"` puts the scenario in the Monte-Carlo gauntlet
(`app/game/balance.py`, `gauntlet(scenario, seeds)`): over 50 seeds an idle
player may win at most 5 % and a random clicker at most 10 %. A boss needs at
least one bot. `"lesson"` and `null` are not gated.

**Mission types**: `trades_min{n}`, `trades_max{n}`, `use_order{type, n}`,
`hold_at_end{symbol?}`, `end_in_cash`, `profit_min{amount}`,
`profit_pct_min{pct}`, `rank_max{rank}` (1 = beat every bot),
`beat_bot{bot_id}`, `max_drawdown{pct}`, `max_position{pct}`,
`min_holdings{n}` (distinct symbols held at once), `sold_after_news{news_id,
within}`, `bought_after_news{news_id, within}`, `no_buy_between{from, to}`,
`beat_buy_hold{symbol}`, `stop_loss_set`, `kept_plan`,
`max_position_before{tick, pct, symbol?}` (no position above `pct` of equity
at any tick before `tick`), `held_between{symbol, from, to}`,
`exited_by{symbol, tick}` (no shares of `symbol` held from `tick` on).
Boss bonus missions are the chapter's concept checks.

### Bots (`content/bots.json`)

```jsonc
{
  "id": "momentum-max-pro",
  "name": "Momentum Max",
  "tier": "pro", // optional: rookie|pro|elite
  "avatar": "bull",
  "style": "Buys strength, sells weakness.",
  "strategy": "momentum",
  "params": {
    "sma": 10,
    "exit_sma": 10,
    "rising": true,
    "high_window": 0,
    "weight": 0.5,
    "delay": 1,
  },
}
```

Every strategy accepts optional `delay` (0–5 ticks of reaction delay) and
`symbols`; bots trade every symbol unless `symbols` is given. `weight` is the
share of equity spread equally across the traded symbols.

| Strategy         | Parameters                                                                                                                       | Rule                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buy_hold`       | `weight, at`                                                                                                                     | Buys at tick `at`; never sells.                                                                                                                                                                                                                      |
| `momentum`       | `sma, exit_sma, rising, high_window, weight`                                                                                     | Buys when close > SMA (and the SMA is rising if `rising`, and close is the `high_window`-day high if non-zero); sells when close < `exit_sma`.                                                                                                       |
| `mean_reversion` | `entry` (`red_candles` or `rsi`), `red_candles` or `rsi_window` + `rsi_below`, `exit_sma, take_profit, trend_sma, trail, weight` | Buys after N red candles or RSI below the level (only above `trend_sma` if non-zero); sells at `exit_sma`, `+take_profit` or a `trail` drop from the peak (0 = no stop).                                                                             |
| `emotional`      | `streak, drop, weight`                                                                                                           | Buys after `streak` up closes or a positive headline on the symbol; sells everything on any negative headline or a day down by `drop`.                                                                                                               |
| `scalper`        | `min_move, weight`                                                                                                               | Buys a green close larger than `min_move`; sells it at the next tick.                                                                                                                                                                                |
| `breakout`       | `window, volume_mult, volume_window, buffer, weight`                                                                             | Buys a close above the prior `window` high with volume ≥ `volume_mult` × average (0 = ignore volume); sells below the breakout level × (1 − `buffer`).                                                                                               |
| `news_reactor`   | `weight, ignore, fade_gap`                                                                                                       | Buys after positive headlines, sells after negative ones, skips kinds in `ignore`; with `fade_gap`, fades rumor/hype gaps larger than it (sells up-gaps, buys down-gaps).                                                                            |
| `risk_manager`   | `trend_sma, risk, stop_window, take_half_r, max_exposure, momentum_filter, avoid_hype, climax_volume`                            | Above `trend_sma`, risks `risk` of equity with a stop under the `stop_window` low, caps exposure, sells half at `take_half_r` × R and moves the stop to entry. Optional SMA10 trend filter, rumor/hype filter (last 2 ticks) and volume-climax exit. |

The roster follows the [curriculum spec](curriculum/game-spec.md) §B3: HODL
Hannah, Momentum Max, Value Vera, Panic Pete, Breakout Bea, Newsy Nina and
Steady Stella in rookie/pro/elite tiers (`<name>-rookie`, `-pro`, `-elite`;
Hannah's pro id is `hodl-hannah`), Scalper Sam in rookie/pro, and Ironhand Iris
(elite only). Bots trade only at market and see only bars and news up to their
observed tick.

### Campaign (`content/campaign/ch<N>.json`, one file per chapter)

```jsonc
{
  "id": "ch1",
  "number": 1,
  "title": "Market Basics",
  "region": "Harbor of Basics",
  "tagline": "What a stock is, how prices move, and your first trades.",
  "icon": "compass",
  "boss": "ch1-boss", // scenario id; also used for this chapter's Preview Battle
  "gate": null, // scenario id of the gate boss (chapter 2+: the previous chapter's boss form)
  "boss_reward": { "kind": "avatar", "id": "avatar-guide-harbor" },
  "levels": [
    {
      "id": "ch1-l1",
      "title": "What Is a Stock?",
      "summary": "One sentence shown on the map popup.",
      "objectives": ["…", "…", "…"], // "In this lesson you will learn"
      "terms": [{ "term": "Share", "definition": "…" }], // Trading Archive
      "cards": [
        {
          "title": "A slice of the company",
          "body": "Plain text. **bold** allowed.",
          "visual": "ownership-slider", // optional interactive/visual key, see below
        },
      ],
      "check": [
        {
          "id": "q1",
          "kind": "mc|true_false",
          "prompt": "…",
          "options": [{ "id": "a", "text": "…" }],
          "answer": "b",
          "explanation": "One line shown after answering.",
        },
      ],
      "practice": "ch1-l1-practice", // scenario id
      "reward": { "kind": "avatar|title", "id": "…" }, // optional map reward node after this level
    },
  ],
}
```

Card `visual` keys the client renders: `ownership-slider`, `market-cap-compare`,
`supply-demand`, `gap-chart`, `candle-anatomy`, `candle-patterns`,
`trend-lines`, `support-resistance`, `volume-bars`, `order-book`,
`bid-ask-spread`, `order-types`, `limit-vs-market`, `stop-loss`,
`position-size`, `risk-reward`, `diversification`, `drawdown-recovery`,
`moving-average`, `rsi`, `macd`, `earnings`, `pe-ratio`, `news-impact`,
`bubble-cycle`, `emotion-cycle`. A missing or unknown key renders text only.

### Quiz bank (`content/quiz_bank.json`)

`{"questions": [...]}`, each in the check format plus `chapter` (1–8),
`concepts` and `difficulty` (1–3). Write at least 15 per chapter, and spread the
correct answers evenly across option positions. Quizzes shuffle options.
Lesson check questions are never reused as quiz items.

## Progression

| Source                                    | XP                   |
| ----------------------------------------- | -------------------- |
| Level check finished (first time)         | 10                   |
| Level normal star (first time)            | 20                   |
| Level special star (first time)           | 10                   |
| Preview Battle (first play to the end)    | 10                   |
| Boss or gate win (first win)              | 50                   |
| Daily: finished / won (each once per day) | 15 / 15              |
| Practice match finished (max 3 per day)   | 10                   |
| Ranked match: loss / win (max 5 per day)  | 10 / 20              |
| Chapter quiz ≥ 80 % (first pass)          | 20                   |
| Daily review (once per day)               | 10                   |
| Mixed mastery ≥ 80 % (first pass)         | 50                   |
| Daily login (streak day 1–7)              | 10,10,10,10,20,20,20 |

No XP is ever paid per order, trade count or volume.

XP needed to go from level _L_ to _L_+1 is `100 + 25·(L−1)`. Ranks by level
are nautical, so they never claim trading skill or repeat a badge name:
Deckhand (1–4), Able Seaman (5–9), Navigator (10–14), Quartermaster (15–19),
First Mate (20–29), Captain (30–39), Commodore (40–49), Admiral (50). Each rank
is also a title (`title-rank-<name>`). Starter avatars use other crew names
(Shipwright, Sailmaker, Cartographer, Lamplighter).

Login Doubloons by streak day: 20, 20, 20, 30, 30, 30, 50 (a full week = 200),
repeating after day 7. A missed day resets the streak to day 1. Daily win: 200
Doubloons (first win of the UTC day). Weekly track: 1,000 Doubloons buys the
weekly title "Colossal Challenger". Gem shop: cosmetic avatars (120), titles
(300), candle colour themes (100). Accessibility palettes are free.

Badges are earned only, never sold. Each is based on process, not profit size:
First Steps, First Plan, Quick Learner, Chart Reader, Risk Manager, Sniper, Fee
Fighter, Cool Head, Patient Trader, Explorer, Gatecrasher, Boss Slayer, Streak
Master, Quiz Master, Ranked Debut, Calibrated. Conditions are in the
[curriculum spec](curriculum/game-spec.md) §B6; the player-facing text in
`cosmetics.json` states the implemented rule. No badge needs a profit-ranked
win: Fee Fighter needs a finished choppy or range-bound market with at least 3
trades and under $30 in fees, and Patient Trader a finished match within the
loss limit with at least one order and none before 40% of the days.

### Module boundaries

`app/game` owns matches and does not know about chapters or currencies. It
calls three hooks registered on `app.state`:

```python
# Resolve what a POST /api/games request may play. Raises HTTPException(403/409) when not allowed,
# or service.Refused(status, detail) to refuse while keeping writes made first (e.g. settling an ended daily).
async def resolve_game(db, profile, request: CreateGame) -> GameSpec
#   GameSpec(scenario_id: str, mode: str, chapter_id: str | None, level_id: str | None,
#            boss: str | None, context: dict,   # stored on the game (e.g. daily day, refresh key); an int "seed" replaces the random seed
#            bot_ids: list[str] | None)         # None = the scenario's bots

# Settle one human participant after the engine computed `result` (dict, see Result above,
# without "rewards", "stars" and "unlocked"). Returns those three keys. Must be idempotent.
async def settle_game(db, profile, game, participant, result: dict) -> dict

# Called before a solo briefing starts. Raises HTTPException to refuse (e.g. an expired daily).
async def before_start(db, profile, game) -> None
```

The defaults in `app/game/service.py` allow `practice` only and award nothing.
`app/campaign` and `app/player` replace them in `main.py`. Lobbies and
matchmaking call `app.game.service.create_multiplayer_game(...)`.

Migration 11 holds the game tables. Migration 12 holds the campaign, player,
quiz and multiplayer tables.

## Client

React 19 + TypeScript + Vite. The kept plumbing is `services/httpService.ts`,
the generated `api/` contract, the auth provider, `authGuard` and the firebase
and config services.

```
client/
  app/        router, providers, shell (HUD + nav)
  ui/         design system primitives (tokens.css, Button, Card, Modal, Tabs, …)
  features/
    home/ adventure/ level/ arena/ play/ quiz/ multiplayer/ profile/ leaderboard/ auth/
```

The arena polls `GET /api/games/{id}?since=` about every 500 ms while running,
or once every 4 s while paused. Prices are drawn with a dependency-free SVG
candlestick chart.

### Visual direction

The night-map style is a dark forest-green base with parchment text and brass
accents. The [sample UI](source/Trader_s_Edge_Sample_UI.jpg) fixes the screens
and their content. Surfaces are flat with 1px borders: no glow, neon, glass
gradients or textures. Tokens live in `client/ui/tokens.css`:

```css
--bg: #0d1714;
--bg-elev: #12201b;
--surface: #172821;
--surface-2: #1e3329;
--surface-3: #26402f;
--border: #2c4638;
--border-strong: #3e5e4c;
--text: #f2ead3;
--text-muted: #a9b8a9;
--text-dim: #7d8f80;
--primary: #1f7a52;
--primary-hover: #248c5e;
--on-primary: #ffffff;
--gold: #e0b654;
--gold-soft: #3a3220;
--gem: #8e72d6;
--gem-soft: #2a2440;
--gain: #46c384;
--loss: #f0705f;
--info: #5ba8c8;
--warning: #e8a23a;
--radius-sm: 8px;
--radius: 12px;
--radius-lg: 16px;
--radius-pill: 999px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--font: ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, sans-serif;
--font-num:
  ui-monospace, 'SF Mono', 'Cascadia Mono', monospace; /* tabular prices */
--text-xs: 12px;
--text-sm: 14px;
--text-md: 16px;
--text-lg: 20px;
--text-xl: 24px;
--text-2xl: 32px;
--shadow: 0 1px 0 #0006, 0 8px 24px #0005;
--focus: 0 0 0 3px #e0b654;
```

Gains and losses always carry `+`/`−` signs and ▲/▼ glyphs as well as colour.
Touch targets are at least 44px. Every animation is disabled under
`prefers-reduced-motion`.

Safety framing stays short. One persistent line says "Simulated money ·
fictional companies". There is no leverage, no countdown timer (the tick
counter reads "Day 17 of 60"), no confetti on orders, and news is shown calmly
in a feed. Results say "Profit decides the match; your missions show what you
learned".
