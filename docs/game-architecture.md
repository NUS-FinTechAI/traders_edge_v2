# Game architecture

This document is the build contract for the playable game. The
[game design document](game-design.md) governs gameplay; this file records how
the code implements it and the decisions that fill the design document's open
questions (§12). It was checked against the code on `docs/game-overhaul`
(based on `9db44ce`). [ADR 0004](decisions/0004-playable-game-overhaul.md)
records why the game replaced the earlier learning-run backend.

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
Level 1 opens once the Preview has been played. Each locked chapter card offers
a **Gate Boss**: the previous chapter's boss scenario played with a fresh
random seed. Winning it unlocks the chapter early, after a friendly "we
recommend playing in order" message. A separately authored parallel form is
not implemented. Each chapter holds 12 stars: 5 levels × 2 plus the boss × 2. The boss
special star needs a win with every boss bonus mission met.

Daily challenges, practice matches, quizzes and multiplayer reuse the same
trading engine. The full curriculum and AI personalities are in the
[curriculum spec](curriculum/game-spec.md).

## Decisions for open design questions

| Question (GDD §)     | Decision                                                                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profit (§3.3)        | `profit = final equity − starting cash`. Equity = cash + holdings × final close. Fees and spread are included.                                                                                                                                                                                |
| Ties (§3.3)          | Equal profit (to the cent) shares a rank. A shared first place is not a win against AI.                                                                                                                                                                                                       |
| Early exit (§3.3)    | Leaving a running match forfeits it: the player ranks last and receives no win rewards.                                                                                                                                                                                                       |
| Disconnects (§8.2)   | Matches run on the server clock. A disconnected player keeps their positions and is ranked normally.                                                                                                                                                                                          |
| Duration (§3.3)      | Lessons 20–40 market days, bosses 30–45, dailies 30 (shipped content: lessons 25–36, bosses 30–40, dailies and multiplayer 30). One market day = one candle. Solo: 1× = 2 s per day, 2× and 4× available, plus pause and "next day" stepping. Multiplayer: fixed 3 s per day, no pause.       |
| Starting conditions  | $10,000 simulated cash unless a scenario says otherwise. Long-only. No leverage.                                                                                                                                                                                                              |
| Fees                 | 0.1 % of order value, minimum $1, plus the bid/ask spread (default 0.10 %). This makes random clicking lose money.                                                                                                                                                                            |
| Plan before trading  | One game plan per match, chosen in the briefing: a strategy chip and a maximum loss. The order ticket offers an optional stop-loss and shows "risk if stopped: $X (Y %)". Results compare the plan with what happened. Orders are one click.                                                  |
| Order types          | Unlocked as taught. Market from the start, limit after Ch2 L3, stop-loss after Ch2 L4. Each scenario's `allow` field enforces this.                                                                                                                                                           |
| AI difficulty (§5.2) | Chapter bosses rise in difficulty through bot strategy mix, parameters and reaction speed. A Monte-Carlo balance test asserts that idle and random players lose bosses and dailies (dailies use a looser band; see [Scenario](#scenario-contentscenariosidjson)).                             |
| Daily form (§6)      | Weekday rotation of seven daily scenarios against one AI. The first attempt of the day uses the day's shared seed; retries use fresh seeds, so a retry cannot be memorised. Unlocks after the Chapter 1 boss.                                                                                 |
| Daily reset          | 00:00 UTC. The reset clears any cooldown from the previous day.                                                                                                                                                                                                                               |
| Currencies (§7)      | **Sim cash** (`$`, green banknote, exists only inside a match), **Doubloons** (the GDD's "Stocks"; gold coin; weekly, expire Monday 00:00 UTC; internal key `stocks`), **Gems** (purple; premium, from ranked play only; never sold for real money).                                          |
| Premium refresh      | 20 Gems skips the daily cooldown. Ranked: win +15 Gems, loss +5 (if the player placed an order), first ranked win of the day +10.                                                                                                                                                             |
| Ranked rating (§9)   | Elo, start 1000, K = 32, pairwise against every other human in the match, rounded to a whole number. Equal profit is a draw. Tiers: Bronze < 1100, Silver < 1300, Gold < 1500, Platinum < 1700, Diamond. Private lobbies never change rating. Ranked matchmaking pairs two humans with no AI. |
| Lobby size (§8)      | 2–30 humans (classes). The host picks an `mp-*` or `practice-*` scenario and may add up to 3 AI opponents, taken from that scenario's own bot list (`mp-*` scenarios list none, so only `practice-*` markets add AI).                                                                         |
| XP                   | See [Progression](#progression). Private lobbies and classroom quizzes give no XP.                                                                                                                                                                                                            |
| Unlocks (§4.3)       | Chapter 1 is open. Chapter _n_ unlocks by winning chapter _n−1_'s boss **or** chapter _n_'s gate boss. The boss unlocks when every level in its chapter has a normal star. Retries are unlimited and re-seeded.                                                                               |
| Multiplayer access   | Private lobbies have no prerequisite (classroom use). Ranked matchmaking unlocks after winning the Chapter 3 boss.                                                                                                                                                                            |

## Backend

One FastAPI app. Kept infrastructure: `config.py`, `db.py`, `auth.py`,
`migrations.py` (append-only), `public_config.py`, `research.py`, `codes.py`
(six-character join codes) and `economy_models.py` (wallet and event tables
from migration 6, reused).

```
server/app/
  game/
    scenario.py     # load + validate scenario JSON, bots catalog
    market.py       # seeded price path: factor model + news effects → OHLCV bars
    engine.py       # pure replay: (scenario, seed, participants, orders, tick) → state
    bots.py         # deterministic AI strategies
    objectives.py   # mission predicates and live mission states
    review.py       # decision score breakdown and key moments
    balance.py      # Monte-Carlo gauntlet of synthetic players
    clock.py        # server-owned time: anchors, pause, speed
    models.py       # games, game_participants, game_orders, game_events
    service.py      # create/start/order/finish + settlement hooks
    api.py          # /api/games
  campaign/         # chapters, levels, check answers, stars, unlocks, daily, resolve/settle hooks
  player/           # profile, XP/levels, wallet, streak, cosmetics, badges, shop, leaderboards
  quiz/             # quiz bank, attempts, classroom rooms
  multiplayer/      # lobbies, matchmaking, Elo (games run on app/game)
  content/
    campaign/ch1.json … ch8.json   # one chapter each: levels → cards, checks, practice
    scenarios/*.json
    bots.json
    quiz_bank.json
    cosmetics.json  # avatars, titles, themes, badges
    validate.py     # python -m app.content.validate
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
sells reserve shares when placed, so a fill never fails. An order that breaks
a rule (cash, holdings, `max_position_pct`, disabled order type, a stop-loss
that is not a sell or is not below the current price, finished match) is
rejected with 422 and a plain-language reason.

### Clock

```
games.clock = {anchor_tick, anchor_at (ms epoch), tick_ms, paused, speed}
current_tick = paused ? anchor_tick : min(ticks, anchor_tick + floor((now − anchor_at) / tick_ms))
```

Solo: `tick_ms = 2000 / speed` for speed 1, 2 or 4. `step` advances exactly
one tick and is accepted only while paused. Multiplayer (`private`, `ranked`):
fixed `tick_ms = 3000`; clock actions return 403. Pause, resume, speed and step
re-anchor. Status: `briefing` (created) →
`running` (started) → `ended` (tick == ticks) → `settled` (every human
participant has called finish). `ended` is derived; `settled` is stored.
Multiplayer matches are created `running` and skip the briefing. A solo
forfeit pauses the clock.

### Settlement

`POST /api/games/{id}/finish` settles once per participant: final rank, profit,
missions, stars (campaign), XP, Doubloons/Gems, Elo, badges. The engine result
is stored on `game_participants.result`; a repeat call returns it (and only
adds a reflection if none was saved). The settle hook writes an
`economy_events` marker `game:<id>` holding its response, so it never pays
twice. Each reward also has its own natural key:

| Store            | Keys                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xp_ledger`      | `level-check:<level>`, `level-normal:<level>`, `level-special:<level>`, `preview:<chapter>`, `boss-win:<chapter>`, `gate-win:<chapter>`, `daily-finished:<day>`, `daily-won:<day>`, `practice:<game>`, `ranked:<game>`, `login:<day>`, `quiz-pass:<topic>`, `quiz-review:<day>` |
| `economy_events` | `game:<game>` (settlement marker), `daily-win:<day>`, `ranked:<game>`, `ranked-first-win:<day>`, `login:<day>`, `purchase:<item>`, `daily-refresh:<cooldown end>`, `expiry:<week>`, `elo:<game>`                                                                                |
| `reward_grants`  | One row per owned avatar, title, theme or badge id                                                                                                                                                                                                                              |

Private matches settle with no rewards, no activity day and no badges.

### Research log

`game_events` stores each human command with its observed context: tick,
visible prices, cash, available cash, equity, holdings, the number of open
orders and the latest headline id. Event kinds are `start`, `plan`, `clock`,
`order`, `rejected`, `cancel`, `finish` and `reflection`. A solo `start` event
also stores the plan, the attempt number for that scenario, the mode, the
scenario id, version and difficulty, and the game context (for a daily: the
day, attempt and any Gem refresh key). This covers GDD §10.2.

### Tables (migrations 11 and 12)

Migration 11 (`migration_v11.py`):

- `games`: id, mode, scenario_id, scenario_version, seed, status, clock (JSON),
  context (JSON, from `GameSpec`), host_user_id, lobby_id, chapter_id,
  level_id, boss (`preview`|`gate`|`final`|null), created_at, settled_at.
- `game_participants`: id, game_id, user_id (null for bots), bot_id,
  display_name, plan (JSON), result (JSON), forfeited. Unique (game_id, user_id).
- `game_orders`: id, game_id, participant_id, client_order_id (unique per
  participant), seq (placement order per participant), tick, symbol, side,
  type, qty, limit_price, stop_price, cancelled_tick, created_at.
- `game_events`: id, game_id, participant_id, tick, kind, payload (JSON), created_at.

Migration 12 (`migration_v12.py`):

- `campaign_progress`: user_id, level_id, check_done, check_first_try,
  check_total, normal_star, special_star, best_profit, plays, updated_at. Boss
  stars use the row `level_id = <chapter>-boss`.
- `campaign_checks`: user_id, level_id, question_id, first_option_id,
  first_correct, solved.
- `boss_results`: user_id, chapter_id, kind (`preview`|`gate`|`boss`), won,
  best_profit, attempts, first_won_at. A `final` game is stored as `boss`.
- `quiz_rooms_v2`: id, code, host_user_id, topic_id, title, created_at.
- `quiz_room_members_v2`: room_id, user_id, joined_at.
- `quiz_attempts_v2`: id, user_id, topic_id, room_id, bank_version, items
  (question ids and option order), answers, status, score, total, passed, xp,
  created_at, completed_at.
- `lobbies`: id, code, host_user_id, scenario_id, bots, status, game_id,
  created_at.
- `lobby_members`: lobby_id, user_id, joined_at.
- `matchmaking_queue`: user_id, status (`searching`|`matched`), game_id,
  created_at.
- `ratings`: user_id, rating, matches, wins, updated_at.

Existing `profiles`, `sessions`, `xp_ledger`, `learning_activity`,
`economy_accounts`, `economy_events` and `reward_grants` are reused. The other
tables from migrations 1–10 remain in the schema but no code reads them.

## API

All bodies are JSON. Mutations need an allowed `Origin`, as today. Idempotency
uses natural keys (`client_order_id`, unique events), not receipt tables. The
research metadata commands keep their migration-10 receipt table.

### Games

| Method & path                                                                                                                         | Purpose                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/games` `{mode, scenario_id?, level_id?, chapter_id?, boss?: "preview"\|"gate"\|"final", bots?: 1–7}`                       | Create a match in `briefing` (201). `mode`: `level`, `boss`, `daily`, `practice`. The server picks the scenario for `level`, `daily` and `boss`. |
| `GET /api/games/{id}?since=<tick>`                                                                                                    | Full public state (below). `since` (−200 to 1000) limits the returned bars and news to newer ticks.                                              |
| `POST /api/games/{id}/start` `{plan: {strategy, max_loss_pct}}`                                                                       | Solo: leave the briefing and start the clock. Multiplayer (already running): record the player's plan once.                                      |
| `POST /api/games/{id}/clock` `{action: pause\|resume\|step\|speed, speed?: 1\|2\|4}`                                                  | Solo modes only.                                                                                                                                 |
| `POST /api/games/{id}/orders` `{client_order_id, symbol, side: buy\|sell, type: market\|limit\|stop, qty, limit_price?, stop_price?}` | Place an order at the current tick. A repeat `client_order_id` returns the original order.                                                       |
| `DELETE /api/games/{id}/orders/{order_id}`                                                                                            | Cancel a resting order.                                                                                                                          |
| `POST /api/games/{id}/finish` `{forfeit?: bool, reflection?: string}`                                                                 | Settle; returns the result.                                                                                                                      |
| `GET /api/games/{id}/result`                                                                                                          | Stored result.                                                                                                                                   |
| `GET /api/games?status=active`                                                                                                        | The player's unfinished matches (resume).                                                                                                        |

**Game state**:

```jsonc
{
  "id": "…",
  "mode": "boss",
  "chapter_id": "ch2",
  "level_id": null,
  "boss": "final",
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
    "id": "ch2-boss",
    "title": "…",
    "briefing": "…",
    "objective": "…",
    "difficulty": 2,
    "starting_cash": 10000,
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
      "state": "done|pending|on_track|behind|failed",
      "progress": "1/1",
    },
  ],
  "result": null,
}
```

Bots publish profit, rank and a one-line style ("Buys strength"), never their
orders, so the leaderboard is live without revealing strategies. Future bars
and news are never sent.

**Mission states.** Milestone missions (`trades_min`, `use_order`,
`stop_loss_set`, `min_holdings`, `sold_after_news`, `bought_after_news`,
`held_between`) are `pending` until met, then `done`. Missions judged at the
end are `on_track` or `behind` during play; rules that a single breach fails
(`trades_max`, `max_drawdown`, `max_position`, `no_buy_between`,
`max_position_before`, `kept_plan`) become `failed` once broken. At the end
every mission is `done` or `failed`; a forfeit fails all of them.

**Result** (`finish` and `/result`):

```jsonc
{ "won": true, "rank": 1, "of": 3, "profit": 512.3, "profit_pct": 5.1,
  "leaderboard": [...], "missions": [...], "stars": {"normal": true, "special": false},
  "rewards": { "xp": 70, "stocks": 0, "gems": 0, "items": [{"id": "avatar-guide-2", "kind": "avatar", "name": "Bay Guide"}],
               "badges": [{"id": "badge-first-plan", "name": "First Plan"}] },
  "plan_review": { "strategy": "trend", "max_loss_pct": 10, "worst_drawdown_pct": 4.2, "kept_loss_limit": true },
  "stats": { "trades": 6, "fees": 18.4, "biggest_position_pct": 38, "max_drawdown_pct": 4.2, "buy_hold_profit": 310.0 },
  "decision_score": 72,
  "decision_breakdown": { "missions": 27, "plan": 25, "risk": 13, "overtrading": 7 },
  "key_moments": ["Day 18: Leafy Greens wins a contract (+8.0%). You held 40 LEAF and gained $160.00."],
  "forfeited": false,
  "debrief": "What happened in this market and the lesson it teaches (scenario-authored).",
  "reflection": null,
  "unlocked": { "chapter_id": "ch3" } }
```

`won` needs rank 1 unshared and no forfeit. A forfeit marks every mission not
done. `buy_hold_profit` is an equal-weight buy of every asset at tick 0's ask.
`stars` is set for level and final boss matches, otherwise null. `unlocked` is
set when a final or gate boss win opens a chapter that was locked.
`reflection` is the optional text sent with `finish`; it can be added once
after settlement and is never graded.

`decision_score` (0–100) is an **unvalidated** process score that never decides
a win. It is the sum of `decision_breakdown`: `missions` = 40 × share of bonus
missions met (basic missions when there are no bonus missions); `plan` = 25 ×
plan kept (worst drawdown ≤ `max_loss_pct`); `risk` = 25 × risk discipline
(share of buy fills with a stop on that symbol placed by one tick after the
fill; 0.5 when the scenario disables stops); `overtrading` = 10 × (1 −
min(1, fees / max(1, |profit|))). Each part is rounded to a whole number.
`key_moments` holds up to five generated sentences from news, fills, stop-loss
exits and the deepest drawdown.

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
| `GET /api/campaign/levels/{id}`                                                                                                                                             | Level content: cards, check questions (no answers), practice mission summary. Public; 403 while the chapter is locked.                                                  |
| `GET /api/archive`, `GET /api/bosses`, `GET /api/practice`                                                                                                                  | Glossary terms from unlocked chapters; boss and gate list for the play hub; practice scenarios. Public.                                                                 |
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
| `POST /api/quizzes/rooms` `{topic_id, title}`; `GET /api/quizzes/rooms/{id}`                                                                                                | Classroom quiz room with join code; any signed-in player can host. The host sees every member's results. Students join by starting an attempt with `room_code`.         |
| `GET /api/lobbies/scenarios`                                                                                                                                                | Markets a host can pick (`mp-*` and `practice-*`).                                                                                                                      |
| `POST /api/lobbies` `{scenario_id?, bots: 0–3}`; `POST /api/lobbies/join` `{code}`; `GET /api/lobbies/{id}`; `POST /api/lobbies/{id}/start`; `POST /api/lobbies/{id}/leave` | Private lobbies. Starting needs at least 2 humans and creates a game; members read `game_id` from the lobby.                                                            |
| `POST /api/matchmaking`, `GET /api/matchmaking`, `DELETE /api/matchmaking`                                                                                                  | Ranked queue: join, poll, leave. Two humans make a match.                                                                                                               |

The other routes are unchanged infrastructure: `GET /api/config`,
`POST`/`DELETE /api/session` (guest mode), `GET /health`, and the research
routes under `/api/me/research` (metadata, consent, withdrawal and the
`game-events`, `campaign-progress` and `quiz-attempts` exports).

### Response shapes (campaign, player, quizzes, multiplayer)

Field names are exact. The server returns these as Pydantic models.

```ts
type NodeState = 'locked' | 'open' | 'done'
interface Reward {
  kind: 'avatar' | 'title' | 'badge'
  id: string
  name: string
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
    options: { id: string; text: string }[]
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
  first_try: boolean
}
// POST /api/campaign/levels/{id}/check/complete  {}
interface CheckComplete {
  first_try_correct: number
  total: number
  xp: number
  practice_unlocked: boolean
}

// GET /api/me → Player; PATCH /api/me {display_name?, avatar_id?, title_id?, leaderboard_opt_in?} → Player
interface Player {
  id: string
  display_name: string
  avatar_id: string // 'avatar-starter-1' until one is equipped
  title_id: string | null
  title: string // equipped title name, or the rank name
  level: number
  rank_name: string
  xp: number
  xp_into_level: number
  xp_for_next_level: number // 0 at level 50
  wallet: { doubloons: number; doubloons_week_ends_at: string; gems: number }
  streak: { days: number; claimed_today: boolean; cycle_day: number } // cycle_day 1–7
  unlocks: { daily: boolean; ranked: boolean }
  leaderboard_opt_in: boolean
}
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
    owned: boolean
    equipped: boolean
    how: string
  }[]
  titles: {
    id: string
    name: string
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
  "balance": "lesson", // optional: "boss" | "daily" | "lesson" | null
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

Fictional companies only. Tickers are 3–5 capital letters. The file name must
equal the scenario `id`. The validator (`app/game/scenario.py`) rejects
unknown fields and enforces: `ticks` 15–150, `history` 5–120, 1–5 assets,
regimes covering ticks `0..ticks` without gaps, news ticks inside the match
with effects ending by the last tick, effects and missions that name known
symbols, news and bots, 0–7 bots, 1–5 basic and 0–5 bonus missions, and unique
ids. `tools` come from `candles`, `line`, `volume`, `sma`, `ema`, `rsi`,
`macd`, `bollinger`. The arena chart draws candles, volume, SMA(20), EMA(10),
RSI(14) and MACD; `line` and `bollinger` pass validation but are not drawn,
and no shipped scenario uses them. A `use_order` or `stop_loss_set` mission
needs that order type enabled in `allow`.

`balance` puts the scenario in the Monte-Carlo gauntlet
(`app/game/balance.py`, `gauntlet(scenario, seeds)`), which plays four
synthetic players against the scenario's bots: `idle`, `random` (trades on
about 30 % of days at random), `buy_hold_all` and `sensible` (a reference trend
follower). `server/tests/test_game_balance.py` runs every shipped scenario
whose class has limits over seeds 0–49:

| Class    | Idle win rate | Random win rate | Shipped scenarios       |
| -------- | ------------- | --------------- | ----------------------- |
| `boss`   | ≤ 5 %         | ≤ 10 %          | `ch1-boss` … `ch8-boss` |
| `daily`  | ≤ 10 %        | ≤ 25 %          | the seven `daily-*`     |
| `lesson` | not gated     | not gated       | the 40 level practices  |

A boss needs at least one bot. `null` (practice and `mp-*` markets) is not
gated. Fees and the spread are the designed defence against button-smashing;
the gauntlet checks the outcome against synthetic players only, not against
real players.

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
(elite only): 24 bots. Bots trade only at market and see only bars and news up
to their observed tick. Bot avatars come from `bull`, `bear`, `owl`, `fox`,
`eagle`, `whale`, `tortoise`, `hare`, `shark`, `parrot`, `octopus`, `lion`.

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
  "gate": null, // scenario id of the gate boss (chapter 2+: the previous chapter's boss scenario)
  "boss_reward": { "kind": "avatar", "id": "avatar-guide-1" },
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

The loader (`app/campaign/content.py`) rejects unknown fields and requires:
chapter numbers 1, 2, 3, … without gaps; exactly 5 levels per chapter; 1–6
objectives, 0–20 terms, 1–8 cards and 1–8 check questions per level; `mc`
questions with 2–6 options and `true_false` with 2; an `answer` that is one of
the option ids; `boss`, `gate` and `practice` that name existing scenarios;
no gate in chapter 1; rewards whose id exists in `cosmetics.json` with the
same kind; and unique chapter, level and map node ids.

### Quiz bank (`content/quiz_bank.json`)

`{"version": "…", "questions": [...]}`, each in the check format plus
`chapter`, `concepts` (1–10) and `difficulty` (1–3). The validator requires at
least 10 questions per chapter (one chapter quiz) and no questions for missing
chapters; the shipped bank has 20 per chapter. Spread the correct answers
evenly across option positions. Quizzes shuffle options. The validator rejects
a quiz prompt that repeats a lesson check prompt.

### Cosmetics (`content/cosmetics.json`)

`{"version", "avatars", "titles", "themes", "badges"}`. Ids start with
`avatar-`, `title-`, `theme-` or `badge-`. Each avatar, title and theme has a
`source`:

| Section | Sources (shipped ids)                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| avatars | `starter` (exactly 4: `avatar-starter-1…4`), `boss` (`avatar-guide-1…8`), `map` (4), `shop` (12 animals, 120 Gems)                                                                 |
| titles  | `rank` (8, by player level), `boss_special` (one per chapter, for the boss special star), `map` (4), `weekly` (`title-colossal-challenger`, 1,000 Doubloons), `shop` (3, 300 Gems) |
| themes  | `shop` (3 candle themes, 100 Gems), `free` (`theme-palette-colorblind`, `theme-palette-high-contrast`)                                                                             |
| badges  | 16 earned-only badges (below)                                                                                                                                                      |

`shop` and `weekly` items need a `price` (`stocks` or `gems`); `boss`, `map`
and `boss_special` items need a `chapter`; rank titles need a `level`, with
one at level 1. The client does not yet apply themes: owning a candle theme or
palette changes nothing on screen.

`python -m app.content.validate` loads every file above and checks the links
between them: each chapter has a `boss_special` title, each daily rotation
scenario exists and has an opponent, at least one `practice-*` scenario
exists, every chapter has a full chapter quiz, and no quiz item repeats a
lesson check.

## Progression

| Source                                    | XP                   |
| ----------------------------------------- | -------------------- |
| Level check finished (first time)         | 10                   |
| Level normal star (first time)            | 20                   |
| Level special star (first time)           | 10                   |
| Preview Battle (first play)               | 10                   |
| Boss or gate win (first win)              | 50                   |
| Daily: finished / won (each once per day) | 15 / 15              |
| Practice match finished (max 3 per day)   | 10                   |
| Ranked match: loss / win                  | 10 / 20              |
| Chapter quiz ≥ 80 % (first pass)          | 20                   |
| Daily review (once per day)               | 10                   |
| Mixed mastery ≥ 80 % (first pass)         | 50                   |
| Daily login (streak day 1–7)              | 10,10,10,10,20,20,20 |

No XP is ever paid per order, trade count or volume.

XP needed to go from level _L_ to _L_+1 is `100 + 25·(L−1)`. Ranks by level:
Rookie Trader (1–4), Market Explorer (5–9), Chart Reader (10–14), Risk Manager
(15–19), Strategist (20–29), Seasoned Trader (30–39), Market Veteran (40–49),
Captain of the Ledger (50).

Login Doubloons by streak day: 20, 20, 20, 30, 30, 30, 50 (a full week = 200),
repeating after day 7. A missed day resets the streak to day 1. Daily win: 200
Doubloons (first win of the UTC day). Weekly track: 1,000 Doubloons buys the
weekly title "Colossal Challenger". Gem shop: cosmetic avatars (120), titles
(300), candle colour themes (100). Accessibility palettes are free.

Badges are earned only, never sold. Each is based on process, not profit size.
The spec's conditions are in the [curriculum spec](curriculum/game-spec.md)
§B6; `app/player/badges.py` implements them as follows (some are proxies for
data the engine does not keep). Match badges count any non-private match.

| Badge          | Implemented condition                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| First Steps    | Normal star on Chapter 1 Level 1                                                                 |
| First Plan     | Finish a match (no forfeit) with a plan and at least one fill                                    |
| Quick Learner  | 10 level checks with every question right first time                                             |
| Chart Reader   | Win the Chapter 3 boss                                                                           |
| Risk Manager   | Finish a match where every bought symbol had a stop-loss placed and the worst drawdown was ≤ 2 % |
| Sniper         | 5 limit orders placed and not cancelled, across finished matches                                 |
| Fee Fighter    | Win a scenario whose id contains `chop` or `range` with fees under $30                           |
| Cool Head      | At least 3 orders, and every buy after a sale is no larger than the buy before it                |
| Patient Trader | Win with every order placed at or after 40 % of the match                                        |
| Explorer       | Every special star in one chapter (5 levels and the boss)                                        |
| Gatecrasher    | Win any gate boss                                                                                |
| Boss Slayer    | Win every chapter boss                                                                           |
| Streak Master  | A 30-day login streak                                                                            |
| Quiz Master    | 10 standalone quizzes with a perfect score                                                       |
| Ranked Debut   | 5 ranked matches finished without forfeiting                                                     |
| Calibrated     | At least 20 "sure" quiz answers, at least 85 % of them correct                                   |

### Module boundaries

`app/game` owns matches and does not know about chapters or currencies. It
calls two hooks registered on `app.state`:

```python
# Resolve what a POST /api/games request may play. Raises HTTPException(403/409) when not allowed.
async def resolve_game(db, profile, request: CreateGame) -> GameSpec
#   GameSpec(scenario_id: str, mode: str, chapter_id: str | None, level_id: str | None,
#            boss: str | None, context: dict,   # stored on the game (e.g. daily day, refresh key); an int "seed" replaces the random seed
#            bot_ids: list[str] | None)         # None = the scenario's bots

# Settle one human participant after the engine computed `result` (dict, see Result above,
# without "rewards", "stars" and "unlocked"). Returns those three keys. Must be idempotent.
async def settle_game(db, profile, game, participant, result: dict) -> dict
```

The defaults in `app/game/service.py` allow `practice` only and award nothing.
`main.py` replaces them with `app/campaign/games.py` (`resolve_game`) and
`app/campaign/settlement.py` (`settle_game`), which call into `app/player` and
`app/multiplayer/elo.py`. Lobbies and matchmaking call
`app.game.service.create_multiplayer_game(...)`.

Migration 11 holds the game tables. Migration 12 holds the campaign, quiz and
multiplayer tables; the player wallet, XP and owned items reuse earlier tables.

## Client

React 19 + TypeScript + Vite. The kept plumbing is `services/httpService.ts`,
the generated `api/` contract, the auth provider, `authGuard` and the firebase
and config services.

```
client/
  router.tsx  routes; every page is lazy-loaded; play routes use authGuard
  app/        shell (HUD + nav), player provider, route error
  ui/         design system primitives (tokens.css, Button, Card, Modal, Tabs, …)
  features/
    home/ adventure/ level/ arena/ play/ quiz/ multiplayer/ profile/ leaderboard/ archive/ auth/
  services/   one module per API area (game, campaign, daily, player, quiz, lobby, auth, config)
  api/        generated OpenAPI types and endpoint list (npm run api:generate)
```

Services call `httpService.request` with types from `api/api-types.ts`.
`/`, `/login`, `/adventure`, `/adventure/:chapterId` and `/archive` are public;
the other routes require a session.

The arena polls `GET /api/games/{id}?since=` just after the next expected tick
(60 ms after `next_tick_at`, clamped to 250–1,500 ms) while running, and every
4 s in the briefing or while paused. The lobby and the ranked queue poll every
2 s while waiting; a quiz room host's results poll every 5 s. Prices are drawn
with a dependency-free SVG candlestick chart.

### Visual direction

The night-map style is a dark forest-green base with parchment text and brass
accents. The [sample UI](source/Trader_s_Edge_Sample_UI.jpg) fixes the screens
and their content. Surfaces are flat with 1px borders: no glow, neon, glass
gradients or textures. Tokens live in `client/ui/tokens.css`, which is the
source of truth; it also defines `-soft` variants, a cash colour and layout
sizes. The core set is:

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
--font:
  ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, -apple-system, sans-serif;
--font-num:
  ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace; /* tabular prices */
--text-xs: 12px;
--text-sm: 14px;
--text-md: 16px;
--text-lg: 20px;
--text-xl: 24px;
--text-2xl: 32px;
--shadow: 0 1px 0 #0006, 0 8px 24px #0005;
--focus: 0 0 0 3px var(--gold);
```

Gains and losses always carry `+`/`−` signs and ▲/▼ glyphs as well as colour.
Touch targets are at least 44px. Every animation is disabled under
`prefers-reduced-motion`.

Safety framing stays short. One persistent line says "Simulated money ·
fictional companies". There is no leverage, no countdown timer (the tick
counter reads "Day 17 of 60"), no confetti on orders, and news is shown calmly
in a feed. Results say "Profit decides the match; your missions show what you
learned".
