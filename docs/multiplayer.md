# Multiplayer

Multiplayer is implemented in `server/app/multiplayer/`. Lobbies and the
ranked queue only gather players; the match itself runs on the trading engine
(`app.game.service.create_multiplayer_game`) like every other mode.

## Shared match rules

- The match starts running as soon as it is created; there is no briefing
  wait. Each player may submit a plan once with `POST /api/games/{id}/start`.
- The clock is fixed at 3 s per market day. Pause, step and speed return 403.
- Every player sees the same seeded market and trades only their own book.
  Players see each other's profit and rank on the leaderboard, not their
  orders.
- A player who disconnects keeps their positions and is ranked normally.
  Leaving with `forfeit: true` ranks them last and cancels their open orders.
- Each player calls `finish` after the last day to settle their own result.

## Private lobbies

- No prerequisite, so a teacher can run a class session.
- `GET /api/lobbies/scenarios` lists the markets a host can choose: the four
  `mp-*` scenarios and the five `practice-*` scenarios. With no choice the
  server picks a random `mp-*` market.
- `POST /api/lobbies {scenario_id?, bots: 0–3}` creates an open lobby with a
  six-character join code. AI opponents come from the chosen scenario's own bot
  list, so `mp-*` markets get none and only `practice-*` markets can add bots.
- `POST /api/lobbies/join {code}` joins while the lobby is open, up to 30
  members.
- `POST /api/lobbies/{id}/start` (host only, at least 2 humans) creates a
  `private` game and stores its id on the lobby. Members poll
  `GET /api/lobbies/{id}` every 2 s and move to the game when `game_id`
  appears.
- `POST /api/lobbies/{id}/leave` removes a member; the host leaving an open
  lobby closes it.
- Private matches give no XP, currency, rating, badges or activity day.

## Ranked matchmaking

- Unlocks after winning the Chapter 3 boss; otherwise `POST /api/matchmaking`
  returns 403 and `GET` reports the `locked_reason`.
- Joining the queue pairs the player with the longest-waiting other player at
  once, if there is one, in a `ranked` game on a random `mp-*` market with no
  AI. Otherwise the player waits (`searching`) and polls `GET /api/matchmaking`
  every 2 s. `DELETE` leaves the queue.
- Rewards on settlement (no forfeit): XP for a win or a loss, and Gems as set
  out in [economy](economy.md#ranked-gems). Private matches pay nothing.

## Elo

Ratings start at 1000 with K = 32. When the first non-forfeiting player
settles a ranked match, `multiplayer/elo.py` rates every human in it once,
pairwise against every other human, using that result's ranks; equal profit is
a draw. The change is rounded to a whole number and an `elo:<game>` event
prevents a second rating. Tiers: Bronze below 1100, Silver below 1300, Gold
below 1500, Platinum below 1700, Diamond from 1700. `GET
/api/leaderboards/ranked` lists opted-in players by rating.

## Limits

Two-player pairing has no rating-based matching, and there is no reconnection
timer or abandonment penalty beyond the forfeit rule. Rating reflects match
results only; it is not a measure of learning. Multiplayer has not been
checked on a hosted deployment.
