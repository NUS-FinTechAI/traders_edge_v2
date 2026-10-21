# Multiplayer

`server/app/multiplayer/`. Lobbies and the ranked queue only gather players;
the match runs on the [trading engine](engine.md) through
`app.game.service.create_multiplayer_game`, with the shared rules in
[matches](matches.md).

## Match rules

- The match is created `running`; there is no briefing wait. Each player sets
  a plan once with `POST /api/games/{id}/start` during ticks 0–2.
- The clock is fixed at 3 s per day; pause, step and speed return 403.
- Everyone sees the same seeded market and trades only their own book.
  Players see each other's profit and rank, not their orders.
- A disconnected player keeps their positions and is ranked normally.
  `forfeit: true` ranks them last and cancels their open orders.
- Each player calls `finish` after the last day to settle their own result.

## Private lobbies

- No prerequisite, so a teacher can run a class session.
- `GET /api/lobbies/scenarios` lists the four `mp-*` and five `practice-*`
  markets. With no choice the server picks a random `mp-*` market.
- `POST /api/lobbies {scenario_id?, bots: 0–3}` creates an open lobby with a
  six-character join code (no `0`, `O`, `1` or `I`). AI opponents are the
  scenario's own bots first, then Momentum Max (pro), Value Vera (pro) and
  HODL Hannah, up to the requested count.
- `POST /api/lobbies/join {code}` joins while the lobby is open, up to 30
  members.
- `POST /api/lobbies/{id}/start` (host only, at least 2 humans) creates a
  `private` game and stores its id on the lobby; members poll
  `GET /api/lobbies/{id}` and move to the game when `game_id` appears.
- `POST /api/lobbies/{id}/leave` removes a member; the host leaving an open
  lobby closes it.
- Private matches give no XP, currency, rating, badges or activity day.

## Ranked matchmaking

- Unlocks after winning the Chapter 3 boss; before that `POST /api/matchmaking`
  returns 403 and `GET` reports `locked_reason`.
- Joining pairs the player with the longest-waiting other live search, if
  any, in a `ranked` game on a random `mp-*` market with no AI. Otherwise the
  player waits (`searching`) and polls `GET /api/matchmaking`, which also
  tries to pair.
- Pairing runs under one global lock (a PostgreSQL advisory transaction lock;
  SQLite serialises writers) on both `POST` and `GET`.
- A search older than 2 minutes is never paired and reads as `idle`, so the
  client searches again.
- `DELETE /api/matchmaking` leaves the queue; after the match has started it
  returns 409 "Your match has started".

## Ranked rewards

Settled in `campaign/settlement.py` for a non-forfeited ranked result:

| Reward         | Amount                                                               |
| -------------- | -------------------------------------------------------------------- |
| XP             | Win 20, loss 10                                                      |
| Gems           | Win 15; loss 5 if the player placed an order                         |
| First-win Gems | +10 for the first ranked win of the UTC day                          |
| Daily caps     | Ranked XP and ranked Gems each pay for at most 5 matches per UTC day |

Win rewards need a contested win: at least one human opponent placed an order
and did not forfeit before the last third of the match. Other wins pay the
loss rewards. These rules do not change Elo.

## Elo

`multiplayer/elo.py`. Ratings start at 1000 with K = 32. When the first
non-forfeiting player settles a ranked match, every human in it is rated once,
pairwise against every other human, from that result's ranks; equal profit is
a draw. Changes are rounded to whole numbers, and an `elo:<game>` event
prevents a second rating. Private lobbies never change rating.

| Tier     | Rating      |
| -------- | ----------- |
| Bronze   | below 1100  |
| Silver   | 1100–1299   |
| Gold     | 1300–1499   |
| Platinum | 1500–1699   |
| Diamond  | 1700 and up |

## Limits

Pairing ignores rating, and there is no reconnection timer or abandonment
penalty beyond the forfeit rule. Rating reflects match results only, not
learning. Multiplayer has not been tested on a hosted deployment.
