# API

All routes are under `/api` except `GET /health` (liveness). Run the server and
open `/docs` for the generated OpenAPI schemas. Exact field types are in
[`client/api/api-types.ts`](../../client/api/api-types.ts), generated from the
backend with `npm run api:generate`; CI fails on stale output
(`npm run api:check`). Server configuration and authentication modes are in the
[server guide](../../server/README.md).

## Conventions

- **Session.** Guest mode: `POST /api/session` sets an HTTP-only
  `SameSite=Strict` cookie, so serve client and API from one hostname and send
  credentials. Firebase mode: send `Authorization: Bearer <ID token>`.
  `GET /api/config` tells the client which mode is active.
- **Mutations** need an allowed `Origin` (in Firebase mode a bearer request
  without `Origin` is also accepted). Bodies over 64 KiB return 413. Bodies
  reject unknown fields.
- **Ordering.** Mutating requests run one at a time per identity and lock the
  player's profile row.
- **Idempotency** uses natural keys, not receipt tables: a repeated
  `client_order_id` returns the original order (the same id with different
  fields returns 409), a repeated `finish` returns the stored result, and each
  reward has one key (see [matches](matches.md#settlement)). Research metadata
  commands take an `idempotency_key`.
- **Caching.** Every `/api/` response is `Cache-Control: no-store`. Keep tokens
  out of URLs and logs.
- **Content review gate.** With `APP_ENV=production`, routes marked "gated"
  below return 503 "Game content is awaiting independent review" until
  `server/app/content/review.json` has `"status": "approved"`.

| Status | Meaning                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------- |
| 401    | No valid session                                                                                          |
| 403    | Locked chapter, level, boss, daily or ranked queue; multiplayer clock command; disallowed origin          |
| 404    | Unknown record, or one owned by another player                                                            |
| 409    | State conflict: match not running, cooldown, open daily, first quiz answer already given, reused order id |
| 413    | Body over 64 KiB                                                                                          |
| 422    | Invalid input, or a rejected order with a plain-language `detail`                                         |
| 503    | Content review gate in production                                                                         |

A 409 "A concurrent update completed first" is safe to retry with the same
request.

## Endpoints

Public routes work signed out. Request bodies are shown in braces.

### Games (`app/game/api.py`, gated)

| Route                                                                                                                | Purpose                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `POST /games {mode, scenario_id?, level_id?, chapter_id?, boss?, bots?: 1–7}`                                        | Create a match in `briefing` (201); see [modes](matches.md#modes)        |
| `GET /games?status=active`                                                                                           | Unfinished matches to resume                                             |
| `GET /games/{id}?since=<tick>`                                                                                       | Public state; `since` (−200 to 1000) returns only newer bars and news    |
| `POST /games/{id}/start {plan: {strategy, max_loss_pct}}`                                                            | Solo: start the clock. Multiplayer: record the plan once                 |
| `POST /games/{id}/clock {action: pause\|resume\|step\|speed, speed?: 1\|2\|4}`                                       | Solo clock                                                               |
| `POST /games/{id}/orders {client_order_id, symbol, side, type: market\|limit\|stop, qty, limit_price?, stop_price?}` | Place an order at the current tick; `client_order_id` is 8–64 characters |
| `DELETE /games/{id}/orders/{order_id}`                                                                               | Cancel a resting order                                                   |
| `POST /games/{id}/finish {forfeit?, reflection?}`                                                                    | Settle and return the result                                             |
| `GET /games/{id}/result`                                                                                             | Stored result                                                            |

Start, clock, order and cancel responses carry the full public state.

### Campaign (`app/campaign/api.py`)

| Route                                                       | Purpose                                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /campaign`                                             | Public. Chapter cards (state, stars, gate) and the `next` Continue target                           |
| `GET /campaign/chapters/{id}`                               | Public. Map nodes (`preview`, `level`, `reward`, `boss`) with state, stars, XP, lock reason         |
| `GET /campaign/levels/{id}`                                 | Public, gated. Cards, check questions without answers, practice summary, progress; 403 while locked |
| `POST /campaign/levels/{id}/check {question_id, option_id}` | Gated. Grade one answer: `{correct, correct_option_id, explanation, first_try}`                     |
| `POST /campaign/levels/{id}/check/complete`                 | Gated. Close the check: first-try score, XP, whether practice is open                               |
| `GET /archive`                                              | Public. Glossary terms from unlocked chapters                                                       |
| `GET /bosses`                                               | Public. Gate and chapter bosses for the play hub                                                    |
| `GET /practice`                                             | Public. Practice markets and their bots                                                             |
| `GET /daily`                                                | Gated. Today's scenario, opponent, attempts, cooldown, `active_game_id`, weekly track               |
| `POST /daily/refresh`                                       | Gated. Spend 20 Gems to clear the cooldown                                                          |

### Player (`app/player/api.py`)

| Route                                                                              | Purpose                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET /me`                                                                          | Profile, level, rank, XP, wallet, streak, unlock flags              |
| `PATCH /me {display_name?, avatar_id?, title_id?, badge_id?, leaderboard_opt_in?}` | Update profile and equipment; null `badge_id` removes the badge     |
| `POST /me/daily-login`                                                             | Claim today's login reward                                          |
| `GET /me/activity`                                                                 | 365-day heatmap counts, streak, current 7-day cycle                 |
| `GET /me/collection`                                                               | Badges, avatars, titles with owned/equipped state and how to unlock |
| `GET /shop`, `POST /shop/purchase {item_id}`                                       | Shop                                                                |
| `GET /leaderboards/xp`, `GET /leaderboards/ranked`                                 | Opted-in players, top 50, plus the caller's rank                    |

### Quizzes (`app/quiz/api.py`, gated)

| Route                                                                       | Purpose                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| `GET /quizzes`                                                              | Topics with best scores, plus the player's rooms |
| `POST /quizzes/attempts {topic_id?, room_code?}`                            | Start an attempt (or join a room)                |
| `POST /quizzes/attempts/{id}/answers {question_id, option_id, confidence?}` | Grade one answer; the first answer is final      |
| `GET /quizzes/attempts/{id}`                                                | Attempt state and result                         |
| `POST /quizzes/rooms {topic_id, title}`, `GET /quizzes/rooms/{id}`          | Classroom rooms                                  |

### Multiplayer (`app/multiplayer/api.py`, gated)

| Route                                                                                       | Purpose                         |
| ------------------------------------------------------------------------------------------- | ------------------------------- |
| `GET /lobbies/scenarios`                                                                    | Markets a host can pick         |
| `POST /lobbies {scenario_id?, bots: 0–3}`, `POST /lobbies/join {code}`, `GET /lobbies/{id}` | Create, join, read a lobby      |
| `POST /lobbies/{id}/start`, `POST /lobbies/{id}/leave`                                      | Host start; leave (204)         |
| `POST /matchmaking`, `GET /matchmaking`, `DELETE /matchmaking`                              | Ranked queue: join, poll, leave |

### Research (`app/research.py`)

| Route                                                                     | Purpose                                                                             |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /me/research`                                                        | Policy, digest and the player's metadata                                            |
| `POST /me/research/metadata`, `/consents`, `/withdrawals`                 | Study commands (see [research](research.md))                                        |
| `GET /me/research/export/{game-events\|campaign-progress\|quiz-attempts}` | Owner-scoped exports                                                                |
| `GET /me/research/onboarding`                                             | Whether the prior-knowledge questions are due, with the instrument (no answer keys) |
| `POST /me/research/onboarding/responses`, `/skips`                        | Record the answers or a skip once (consenting participants only)                    |

### Researcher dashboard (`app/study/dashboard.py`)

`GET /research/access` returns `{allowed}` for any signed-in player. Every other
route returns 403 unless the account is on the researcher allow-list, and 409
while study enrollment is off ([research](research.md#researcher-dashboard)).

| Route                                            | Purpose                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GET /research/summary`                          | Participants, onboarding, prior-knowledge groups, matches by mode, completion funnel                       |
| `GET /research/pre-post`                         | Preview Battle against Chapter Boss per chapter and group, first and all attempts                          |
| `GET /research/decision-trends?chapter_id&group` | Mean decision score by attempt number per match kind                                                       |
| `GET /research/checks?chapter_id&group`          | First-try check accuracy per level                                                                         |
| `GET /research/quizzes?group`                    | Chapter quiz scores by first and all attempts, bank answer accuracy                                        |
| `GET /research/exports/{kind}`                   | Streamed CSV: `participants`, `matches`, `game-events`, `check-answers`, `quiz-answers`, `prior-knowledge` |

### Session and config

`POST /session` and `DELETE /session` (guest mode), `GET /config` (public: auth
mode and, in Firebase mode, the project id).

## Game state

`GET /games/{id}` returns `GameState`:

| Field                                                       | Content                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `id`, `mode`, `chapter_id`, `level_id`, `boss`              | Identity                                                                                               |
| `status`, `tick`, `ticks`, `tick_label`                     | Lifecycle and "Day N of M"                                                                             |
| `tick_ms`, `speed`, `paused`, `server_time`, `next_tick_at` | Clock; schedule polls from these, not the device clock                                                 |
| `scenario`                                                  | Title, briefing, objective, difficulty, starting cash, tools, `allow`, `max_position_pct`, fee, spread |
| `assets`                                                    | Symbol, name, sector, blurb, price, change %                                                           |
| `bars`                                                      | Per symbol `{t, o, h, l, c, v}` up to the current tick, including history                              |
| `news`                                                      | Published headlines: id, tick, headline, body, symbols, tone, kind                                     |
| `me`                                                        | Cash, available cash, equity, profit, positions, orders, fills, max drawdown, plan                     |
| `leaderboard`                                               | Name, kind, bot id, avatar, style, tier, profit, rank, forfeited, `is_me`                              |
| `missions`                                                  | Tier, text, `done`, live [state](engine.md#missions), progress text                                    |
| `result`                                                    | Null until finished; see [results](engine.md#results)                                                  |

The client polls this route while a match runs; the cadence is in
[ARCHITECTURE.md](../../ARCHITECTURE.md#client). Lobbies and the ranked queue
are polled every 2 s while waiting.
