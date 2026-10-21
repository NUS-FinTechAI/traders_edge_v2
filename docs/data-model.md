# Stored data

SQLite stores local development data in `server/data/learning.db`; production
requires PostgreSQL. Authored content (chapters, scenarios, bots, quiz bank,
cosmetics) is JSON in source control, not database data. Match state is not
stored: it is rebuilt on each read from the scenario, the seed and the stored
orders.

## Tables in use

| Table                                        | Migration | Model                              | Purpose                                                                                         |
| -------------------------------------------- | --------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `schema_versions`                            | runner    | `db.SchemaVersion`                 | Applied migration numbers                                                                       |
| `profiles`                                   | 1 (+4)    | `db.Profile`                       | Player id, optional Firebase uid, display name, leaderboard opt-in, equipped avatar and title   |
| `sessions`                                   | 1         | `db.SessionToken`                  | Hashed guest token, owner and expiry                                                            |
| `xp_ledger`                                  | 1         | `db.XPLedger`                      | One row per (player, event key): XP amount and reason                                           |
| `learning_activity`                          | 1         | `db.LearningActivity`              | One row per player per UTC day with activity (heatmap)                                          |
| `reward_grants`                              | 4         | `db.RewardGrant`                   | One row per owned avatar, title, theme or badge, with a snapshot and evidence                   |
| `economy_accounts`                           | 6         | `economy_models.EconomyAccount`    | Wallet: Doubloons and week, Gems, login streak, daily cooldown, pending refresh key             |
| `economy_events`                             | 6         | `economy_models.EconomyEvent`      | One row per (player, event key): currency deltas and context; also settlement and Elo markers   |
| `research_participants`, `research_commands` | 10        | `research_models`                  | Study metadata, consent and withdrawal; command receipts                                        |
| `games`                                      | 11        | `game.models.Game`                 | Mode, scenario id and version, seed, status, clock, context, chapter/level, boss kind, lobby    |
| `game_participants`                          | 11        | `game.models.GameParticipant`      | Humans and bots in a match; plan, stored result, forfeit                                        |
| `game_orders`                                | 11        | `game.models.GameOrder`            | Human orders with tick, type, prices, placement sequence, cancel tick; unique `client_order_id` |
| `game_events`                                | 11        | `game.models.GameEvent`            | Research log of human commands with observed context                                            |
| `campaign_progress`                          | 12        | `campaign.models.CampaignProgress` | Per level (and `<chapter>-boss`): check result, stars, best profit, plays                       |
| `campaign_checks`                            | 12        | `campaign.models.CampaignCheck`    | First answer to each check question and whether it is now solved                                |
| `boss_results`                               | 12        | `campaign.models.BossResult`       | Per chapter and kind (`preview`, `gate`, `boss`): won, best profit, attempts, first win time    |
| `quiz_attempts_v2`                           | 12        | `quiz.models.QuizAttempt`          | Questions and option order, answers with confidence, score, pass, XP                            |
| `quiz_rooms_v2`, `quiz_room_members_v2`      | 12        | `quiz.models`                      | Classroom rooms with join code and their members                                                |
| `lobbies`, `lobby_members`                   | 12        | `multiplayer.models`               | Private lobbies, chosen scenario and bot count, members, started game                           |
| `matchmaking_queue`                          | 12        | `multiplayer.models.QueueEntry`    | Ranked queue entry and matched game                                                             |
| `ratings`                                    | 12        | `multiplayer.models.Rating`        | Elo rating, matches and wins                                                                    |

## Idempotency

Rewards are keyed, not counted: an `xp_ledger` or `economy_events` row with
the same (player, key) is never written twice, and `reward_grants` holds one
row per owned item. Settlement stores the result on `game_participants.result`
and a `game:<id>` event with the hook's response, so a repeated `finish`
returns the same result. Orders are unique per (participant, `client_order_id`).
The key formats are listed in the
[build contract](game-architecture.md#settlement).

## Legacy tables

Migrations 1–10 also created the tables of the removed learning-run system
(for example attempts, lesson completions, review queue, journals, simulation
sessions and commands, learning runs, challenge attempts, the old quiz and
multiplayer tables). They remain in the schema because deployed migrations are
never rewritten, but no code reads or writes them. Earlier learner records were
not converted into campaign progress.

## Migrations

`server/app/migrations.py` applies 1–12 in order, records each in
`schema_versions`, and rejects gaps or future versions. Changing a model does
not change a database; add a new numbered migration. With
`AUTO_MIGRATE=false` run `uv run --project server --locked python -m app.db`
first; the API refuses to start on a version mismatch. `server/tests/test_migrations.py`
checks a fresh migration and that upgrading a populated database to 12 keeps
every existing row.

## Privacy

Every player-owned read is filtered by the authenticated profile. Leaderboards
show only opted-in display names. The research export omits the daily shared
seed. There is no account deletion or retention policy yet.
