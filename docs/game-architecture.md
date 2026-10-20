# Game architecture

This document is the build contract for the playable game. The
[game design document](game-design.md) governs gameplay; this file records how
the code implements it and the decisions that fill the design document's open
questions (§12).

## Core loop

1. **Learn**: a level opens with 3–6 short lesson cards.
2. **Check**: 3–5 questions with instant feedback and an explanation.
3. **Practise**: a short trading mission (30–60 market days) in a scripted
   market with mission objectives that apply the level's concept.
4. **Earn**: the normal star for the basic missions, the special star for the
   bonus mission, XP, and map rewards.
5. **Prove it**: each chapter ends with a boss: a trading match against AI
   opponents, ranked by total profit. Chapters 2+ also have a gate boss that
   lets experienced players skip ahead.

Daily challenges, practice matches, quizzes and multiplayer reuse the same
trading engine.

## Decisions for open design questions

| Question (GDD §)     | Decision                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profit (§3.3)        | `profit = final equity − starting cash`. Equity = cash + holdings × final close. Fees and spread are included.                                                                                  |
| Ties (§3.3)          | Equal profit (to the cent) shares a rank. A shared first place is not a win against AI.                                                                                                         |
| Early exit (§3.3)    | Leaving a running match forfeits it: the player ranks last and receives no win rewards.                                                                                                         |
| Disconnects (§8.2)   | Matches run on the server clock. A disconnected player keeps their positions and is ranked normally.                                                                                            |
| Duration (§3.3)      | Lessons 30–60 market days, bosses and dailies 60–90. One market day = one candle. Solo speed: 1× = 2 s per day, 2× and 4× available, pause allowed. Multiplayer: fixed 1.5 s per day, no pause. |
| Starting conditions  | $10,000 simulated cash unless a scenario says otherwise. Long-only. No leverage.                                                                                                                |
| Fees                 | 0.1 % of order value, minimum $1, plus the bid/ask spread (default 0.10 %). This makes random clicking lose money.                                                                              |
| Plan before trading  | One game plan per match, chosen in the briefing: a strategy and a maximum loss. Results compare the plan with what happened. Orders are one click.                                              |
| AI difficulty (§5.2) | Chapter bosses rise in difficulty through bot strategy mix, parameters and reaction speed. A Monte-Carlo balance test asserts that idle and random players lose bosses.                         |
| Daily form (§6)      | One scenario per UTC day, the same for everyone. Each attempt gets a fresh random seed, so retries cannot be memorised.                                                                         |
| Daily reset          | 00:00 UTC. A cooldown that crosses the reset still applies.                                                                                                                                     |
| Currencies (§7)      | **Cash** (simulated trading money, `$`), **Stocks** (weekly reward currency, expires each Monday 00:00 UTC), **Gems** (premium currency from ranked play).                                      |
| Premium refresh      | 10 Gems skips the daily cooldown. Ranked win +10 Gems, ranked loss +3 Gems.                                                                                                                     |
| Ranked rating (§9)   | Elo, start 1000, K = 32, pairwise against every other human in the match. Private lobbies never change rating.                                                                                  |
| Lobby size (§8)      | 2–8 humans. The host may add up to 3 AI opponents.                                                                                                                                              |
| XP                   | See [Progression](#progression). Private lobbies give no XP.                                                                                                                                    |
| Unlocks (§4.3)       | Chapter 1 is open. Chapter _n_ unlocks by winning chapter _n−1_'s final boss **or** chapter _n_'s gate boss. The final boss unlocks when every level in its chapter has a normal star.          |
| Multiplayer access   | Private lobbies have no prerequisite (classroom use). Ranked matchmaking unlocks after winning the Chapter 2 final boss.                                                                        |

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
    campaign.json   # chapters → levels → cards, checks, practice missions
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
`random.Random(seed)` is the only randomness source.

**Execution** (`engine.py`). Each tick is processed in order:

1. Resting orders placed before this tick are checked against the bar.
   A buy limit fills when `low ≤ limit` at `min(limit, open)`. A sell limit
   fills when `high ≥ limit` at `max(limit, open)`. A stop-loss (sell) triggers
   when `low ≤ stop` and fills at `min(stop, open) × (1 − spread/2)`.
2. Human market orders placed at this tick fill at `close × (1 ± spread/2)`.
   This is the price the player saw.
3. Bots decide on information up to this tick (closes, news published at or
   before it) and trade with market orders under the same rules.

Every fill pays `max(min_fee, fee_rate × value)`. Buy limits reserve cash and
sells reserve shares when placed, so a fill never fails. An order that breaks
a rule (cash, holdings, `max_position_pct`, disabled order type, finished
match) is rejected with 422 and a plain-language reason.

### Clock

```
games.clock = {anchor_tick, anchor_at (ms epoch), tick_ms, paused}
current_tick = paused ? anchor_tick : min(ticks, anchor_tick + floor((now − anchor_at) / tick_ms))
```

Pause, resume, speed and step re-anchor. Status: `briefing` (created) →
`running` (started) → `ended` (tick == ticks) → `settled` (finish called).
`ended` is derived; `settled` is stored.

### Settlement

`POST /api/games/{id}/finish` settles once per participant: final rank, profit,
missions, stars (campaign), XP, Stocks/Gems, Elo, badges. All writes use
natural unique keys (e.g. `xp_ledger(user, "game:<id>")`), so repeats return
the stored result.

### Research log

`game_events` stores each human command with its observed context: tick,
visible prices, cash, holdings, open orders and the latest headline. It also
stores the plan, the final result, the attempt number and whether a Gem
refresh enabled the attempt. This covers GDD §10.2.

### Tables (migration 11)

- `games`: id, mode, scenario_id, scenario_version, seed, status, clock (JSON),
  host_user_id, lobby_id, chapter_id, level_id, created_at, settled_at.
- `game_participants`: id, game_id, user_id (null for bots), bot_id,
  display_name, plan (JSON), result (JSON), forfeited.
- `game_orders`: id, game_id, participant_id, client_order_id (unique per
  participant), tick, symbol, side, type, qty, limit_price, stop_price,
  cancelled_tick, created_at.
- `game_events`: id, game_id, participant_id, tick, kind, payload (JSON), created_at.
- `campaign_progress`: user_id, level_id, check_best, check_passed,
  normal_star, special_star, best_profit, plays, updated_at.
- `boss_results`: user_id, chapter_id, kind (`gate`|`final`), won, best_profit,
  attempts, first_won_at.
- `quiz_attempts_v2`, `quiz_rooms_v2`, `quiz_room_members_v2`.
- `lobbies`, `lobby_members`, `matchmaking_queue`, `ratings`.

Existing `profiles`, `sessions`, `xp_ledger`, `economy_accounts`,
`economy_events` and `reward_grants` are reused.

## API

All bodies are JSON. Mutations need an allowed `Origin`, as today. Idempotency
uses natural keys (`client_order_id`, unique events), not receipt tables.

### Games

| Method & path                                                                                                                         | Purpose                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/games` `{mode, scenario_id?, level_id?, chapter_id?, boss?: "gate"\|"final", bots?: n}`                                    | Create a match in `briefing`. `mode`: `level`, `boss`, `daily`, `practice`. The server picks the scenario for `daily` and `boss`. |
| `GET /api/games/{id}?since=<tick>`                                                                                                    | Full public state (below). `since` limits the returned bars and news to newer ticks.                                              |
| `POST /api/games/{id}/start` `{plan: {strategy, max_loss_pct}}`                                                                       | Leave the briefing and start the clock.                                                                                           |
| `POST /api/games/{id}/clock` `{action: pause\|resume\|step\|speed, speed?: 1\|2\|4}`                                                  | Solo modes only.                                                                                                                  |
| `POST /api/games/{id}/orders` `{client_order_id, symbol, side: buy\|sell, type: market\|limit\|stop, qty, limit_price?, stop_price?}` | Place an order at the current tick. A repeat `client_order_id` returns the original order.                                        |
| `DELETE /api/games/{id}/orders/{order_id}`                                                                                            | Cancel a resting order.                                                                                                           |
| `POST /api/games/{id}/finish` `{forfeit?: bool, reflection?: string}`                                                                 | Settle; returns the result.                                                                                                       |
| `GET /api/games/{id}/result`                                                                                                          | Stored result.                                                                                                                    |
| `GET /api/games?status=active`                                                                                                        | The player's unfinished matches (resume).                                                                                         |

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
  "debrief": "What happened in this market and the lesson it teaches (scenario-authored).",
  "unlocked": { "chapter_id": "ch3" } }
```

### Campaign, player, quizzes, multiplayer

| Method & path                                                                                                                                                               | Purpose                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/campaign`                                                                                                                                                         | Chapters with lock state, stars earned/available, boss states, next level. Public (signed-out users see chapter 1 open, nothing earned). |
| `GET /api/campaign/chapters/{id}`                                                                                                                                           | Map: ordered nodes (`gate`, `level`, `reward`, `final`) with state `locked\|open\|done` and stars.                                       |
| `GET /api/campaign/levels/{id}`                                                                                                                                             | Level content: cards, check questions (no answers), practice mission summary.                                                            |
| `POST /api/campaign/levels/{id}/check` `{question_id, option_id}`                                                                                                           | Grade one check answer: `{correct, correct_option_id, explanation}`. The first answer per question per level attempt counts.             |
| `POST /api/campaign/levels/{id}/check/complete`                                                                                                                             | Close the check: score and whether it passed (≥ 2/3 correct).                                                                            |
| `GET /api/me`                                                                                                                                                               | Profile, level, XP to next, title, avatar, wallet, streak, today's claim state, unlock flags.                                            |
| `PATCH /api/me` `{display_name?, avatar_id?, title_id?, leaderboard_opt_in?}`                                                                                               | Update profile.                                                                                                                          |
| `POST /api/me/daily-login`                                                                                                                                                  | Claim today's login reward.                                                                                                              |
| `GET /api/me/activity`                                                                                                                                                      | Last 365 days of activity counts (heatmap) and streak days.                                                                              |
| `GET /api/me/collection`                                                                                                                                                    | Badges, avatars and titles with earned/locked and how to unlock.                                                                         |
| `GET /api/shop`, `POST /api/shop/purchase` `{item_id}`                                                                                                                      | Shop.                                                                                                                                    |
| `POST /api/daily/refresh`                                                                                                                                                   | Spend Gems to skip the daily cooldown.                                                                                                   |
| `GET /api/daily`                                                                                                                                                            | Today's daily: scenario summary, opponent, cooldown, won today, weekly Stocks progress.                                                  |
| `GET /api/leaderboards/xp`, `GET /api/leaderboards/ranked`                                                                                                                  | Global leaderboards (opted-in players).                                                                                                  |
| `GET /api/quizzes`                                                                                                                                                          | Quiz topics (per chapter + mixed) with best scores.                                                                                      |
| `POST /api/quizzes/attempts` `{topic_id, room_code?}`                                                                                                                       | Start a 5-question quiz.                                                                                                                 |
| `POST /api/quizzes/attempts/{id}/answers` `{question_id, option_id}`                                                                                                        | Instant feedback; first answer is final.                                                                                                 |
| `GET /api/quizzes/attempts/{id}`                                                                                                                                            | Attempt state / result.                                                                                                                  |
| `POST /api/quizzes/rooms` `{topic_id, title}`; `GET /api/quizzes/rooms/{id}`                                                                                                | Classroom quiz room with join code; the host sees every member's results.                                                                |
| `POST /api/lobbies` `{scenario_id?, bots: 0–3}`; `POST /api/lobbies/join` `{code}`; `GET /api/lobbies/{id}`; `POST /api/lobbies/{id}/start`; `POST /api/lobbies/{id}/leave` | Private lobbies. Starting creates a game; members read `game_id` from the lobby.                                                         |
| `POST /api/matchmaking`, `GET /api/matchmaking`, `DELETE /api/matchmaking`                                                                                                  | Ranked queue: join, poll, leave. Two humans make a match.                                                                                |

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
      "effects": [{ "symbol": "LEAF", "move": 0.08, "ticks": 4, "gap": true }],
    },
  ],
  "bots": ["hodl-hannah"],
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

Fictional companies only. Tickers are 3–5 capital letters.

**Mission types**: `trades_min{n}`, `trades_max{n}`, `use_order{type, n}`,
`hold_at_end{symbol?}`, `end_in_cash`, `profit_min{amount}`,
`profit_pct_min{pct}`, `rank_max{rank}` (1 = beat every bot),
`beat_bot{bot_id}`, `max_drawdown{pct}`, `max_position{pct}`,
`min_holdings{n}` (distinct symbols held at once), `sold_after_news{news_id,
within}`, `bought_after_news{news_id, within}`, `no_buy_between{from, to}`,
`beat_buy_hold{symbol}`, `stop_loss_set`, `kept_plan`.

### Bots (`content/bots.json`)

```jsonc
{
  "id": "momentum-max",
  "name": "Momentum Max",
  "avatar": "bull",
  "style": "Buys strength, sells weakness.",
  "strategy": "momentum",
  "params": { "fast": 5, "slow": 20, "weight": 0.6 },
}
```

Strategies: `buy_hold{weight, at}`, `dca{every, amount}`,
`momentum{fast, slow, weight}`, `mean_reversion{window, band, weight}`,
`breakout{window, weight, trail}`, `news_reactor{delay, weight, overreact}`,
`panic{drawdown, rebuy_after}`, `fomo{streak, weight, stop}`,
`noise{p, weight}`. Bots trade every symbol unless `symbols` is given.

### Campaign (`content/campaign.json`)

```jsonc
{
  "version": "2026-10-20.2",
  "chapters": [
    {
      "id": "ch1",
      "number": 1,
      "title": "Market Basics",
      "tagline": "…",
      "icon": "compass",
      "gate_boss": null,
      "final_boss": "ch1-final",
      "levels": [
        {
          "id": "ch1-l1",
          "title": "What Is a Stock?",
          "summary": "…",
          "objectives": ["…", "…"],
          "xp": 30,
          "cards": [
            {
              "kind": "concept|example|tip|interactive",
              "title": "…",
              "body": "Markdown-lite text",
              "visual": "candle-anatomy|order-book|…|null",
            },
          ],
          "check": [
            {
              "id": "q1",
              "prompt": "…",
              "options": [{ "id": "a", "text": "…" }],
              "answer": "b",
              "explanation": "…",
            },
          ],
          "practice": "ch1-l1-practice",
          "reward": { "kind": "avatar|title|badge", "id": "avatar-compass" },
        },
      ],
    },
  ],
}
```

### Quiz bank (`content/quiz_bank.json`)

Topics map to chapters plus a mixed topic. Questions use the check format.
Quizzes draw 5 questions with shuffled options.

## Progression

| Source                                     | XP                                              |
| ------------------------------------------ | ----------------------------------------------- |
| Level check passed (first time)            | 10                                              |
| Level normal star (first time)             | 20                                              |
| Level special star (first time)            | 15                                              |
| Boss win (first time) / any finished boss  | 60 / 10                                         |
| Daily: finished / first win of the day     | 10 / 20                                         |
| Practice match finished (max 5 per day)    | 10                                              |
| Ranked match: win / loss                   | 25 / 10                                         |
| Quiz passed (first pass per topic per day) | 15                                              |
| Daily login                                | 10 (days 1–5 of the streak week), 20 (days 6–7) |

XP needed to go from level _L_ to _L_+1 is `100 + 25·(L−1)`. Titles by level:
Deckhand (1), Rookie Trader (2), Market Explorer (5), Chart Navigator (10),
Risk Captain (15), Market Legend (20).

Login reward: 20 Stocks plus the XP above. Daily win: 200 Stocks (first win of
the UTC day). Weekly shop item: "Colossal Challenger" title for 1,000 Stocks.

### Module boundaries

`app/game` owns matches and does not know about chapters or currencies. It
calls two hooks registered on `app.state`:

```python
# Resolve what a POST /api/games request may play. Raises HTTPException(403/409) when not allowed.
async def resolve_game(db, profile, request: CreateGame) -> GameSpec
#   GameSpec(scenario_id: str, mode: str, chapter_id: str | None, level_id: str | None,
#            boss: str | None, context: dict)   # context is stored on the game (e.g. daily day, refresh key)

# Settle one human participant after the engine computed `result` (dict, see Result above,
# without "rewards", "stars" and "unlocked"). Returns those three keys. Must be idempotent.
async def settle_game(db, profile, game, participant, result: dict) -> dict
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
