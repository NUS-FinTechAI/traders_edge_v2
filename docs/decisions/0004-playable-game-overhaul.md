# 0004: Playable game overhaul

Status: accepted and implemented on `feat/game-overhaul` (`9db44ce`). Supersedes the conflicting parts of ADR 0001 and ADR 0003.
Independent content, safety and design/accessibility reviews are still
required before production.

## Context

The owner reviewed the connected app built on the learning-run backend and
reported that the challenges, the flow and the interface did not make sense.
There was no real trading interface: lessons were sequences of choice and
classification steps, the two bound simulations were record-reconciliation
audits, and AI challenges advanced one observation at a time behind written
plans. The owner then supplied the [game design document](../game-design.md)
(GDD) and asked for a playable trading game.

## Options

1. Refactor the existing system in place: keep learning runs, observation
   tokens, the ten-module catalog and the challenge engine, and add a trading
   screen on top.
2. Replace it with a real-time trading engine, but keep turn-based play:
   the player presses "next day" for every candle.
3. Replace it with a real-time engine and keep a written plan for every order.
4. Replace it with a real-time engine, a campaign and one game plan per match
   (chosen).

Option 1 kept the contracts that made the flow hard to follow (pinned runs,
observation tokens, per-order plan essays) and would have needed most screens
rebuilt anyway. Option 2 makes a 30–40 day match slow to play, so the chosen
clock keeps "next day" stepping only as an option while paused. Option 3 makes
every order a form and works against a one-click order ticket.

## Decision

- Replace the learning-run, observation and challenge backend and the old
  client with a real-time trading engine (`server/app/game`), a campaign
  (`server/app/campaign`), a player economy (`server/app/player`), quizzes
  (`server/app/quiz`), multiplayer (`server/app/multiplayer`) and a new React
  client. Migrations 11 and 12 add the new tables.
- The GDD governs gameplay. The curriculum follows the
  [curriculum spec](../content/curriculum-spec.md): 8 chapters × 5 levels, each
  level with lesson cards, a check and a trading mission, plus a Preview
  Battle, a Gate Boss and a Chapter Boss per chapter. Where the spec and the
  [architecture document](../game-architecture.md) differ, the architecture
  document records what was built.
- One game plan per match, chosen in the briefing: a strategy and a maximum
  loss. Orders are one click. The ticket shows the risk if a stop-loss is hit.
  Results compare the plan with what happened.
- Solo matches run on a server-owned real-time clock (2 s per day at 1×, with
  2× and 4×), with pause and single-day stepping. Multiplayer runs at a fixed
  3 s per day with no pause. There are no countdown timers; the counter reads
  "Day N of M". News is shown calmly in a feed.
- Fees (0.1 %, minimum $1) and a bid/ask spread make random clicking lose
  money. An automated Monte-Carlo gauntlet (`server/tests/test_game_balance.py`)
  checks that idle and random players lose every shipped boss and daily.
- Dailies use a looser balance band than bosses (idle ≤ 10 %, random ≤ 25 %
  against ≤ 5 % and ≤ 10 %). Bosses gate chapters; dailies are optional.
- Private lobbies have no prerequisite so a class can play together. Ranked
  matchmaking unlocks after the Chapter 3 boss.
- Any signed-in player can host a classroom quiz room. The server-configured
  instructor allowlist is no longer used.
- The weekly currency is named Doubloons (the GDD's "Stocks"; internal key
  `stocks`) and the premium currency Gems, to avoid confusion with shares.
  Gems come only from ranked play and are never sold for real money.
- Profit decides every match. XP is never paid per order, trade count or
  volume. Badges reward process, not profit size.

## Consequences

- The tables from migrations 1–10 stay in the schema, append-only, but only
  `profiles`, `sessions`, `xp_ledger`, `learning_activity`,
  `economy_accounts`, `economy_events`, `reward_grants` and the research
  tables are still used. Earlier learner records are not migrated into the
  campaign.
- All authored content (chapters, scenarios, quiz bank) needs independent
  financial and pedagogical review before production. The production gate
  that refused unapproved catalog content was removed with the old catalog;
  there is no replacement approval flag yet.
- The decision score is an unvalidated process measure. It never decides a
  win and must not be presented as competence.
- The Preview Battle and Chapter Boss give a pre/post pair on the same
  scenario with different seeds. That pairing is not a validated assessment.
- The engine does not model per-asset spreads, buy-stop or stop-limit orders,
  partial fills, order-book depth, shorting or leverage. Gate bosses reuse
  the previous chapter's boss scenario rather than a separately authored
  parallel form.
- Real Firebase sign-in, hosted deployment and participant evaluation are
  not established by local tests.

## Basis

The owner's feedback and the [game design document](../game-design.md); the
[curriculum spec](../content/curriculum-spec.md); the implementation in
`server/app/game`, `server/app/campaign`, `server/app/player`,
`server/app/quiz`, `server/app/multiplayer` and `client/`; and
`server/tests/test_game_balance.py`.
