# Data model

SQLite locally (`server/data/learning.db`); PostgreSQL in staging and
production. Authored
content (chapters, scenarios, bots, quiz bank, cosmetics) is JSON in source
control, not database data. Match state is not stored: it is rebuilt on each
read from the scenario, the seed and the stored orders
([engine](engine.md#replay)).

## Tables in use

| Table                                        | Migration | Model                           | Holds                                                                                         |
| -------------------------------------------- | --------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `schema_versions`                            | runner    | `db.SchemaVersion`              | Applied migration numbers                                                                     |
| `profiles`                                   | 1 (+4)    | `db.Profile`                    | Player id, optional Firebase uid, display name, leaderboard opt-in, equipped avatar and title |
| `sessions`                                   | 1         | `db.SessionToken`               | Hashed guest token, owner, expiry                                                             |
| `xp_ledger`                                  | 1         | `db.XPLedger`                   | One row per (player, event key): XP and reason                                                |
| `learning_activity`                          | 1         | `db.LearningActivity`           | One row per player per UTC day with activity                                                  |
| `reward_grants`                              | 4         | `db.RewardGrant`                | One row per owned avatar, title, theme or badge, with snapshot and evidence                   |
| `economy_accounts`                           | 6         | `economy_models.EconomyAccount` | Wallet: Doubloons and their week, Gems, login streak, daily cooldown, pending refresh key     |
| `economy_events`                             | 6         | `economy_models.EconomyEvent`   | One row per (player, event key): currency deltas, context; settlement and Elo markers         |
| `research_participants`, `research_commands` | 10        | `research_models`               | Study metadata, consent, withdrawal; command receipts                                         |

Migration 11 (`migration_v11.py`, `game/models.py`):

| Table               | Columns                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `games`             | id, mode, scenario_id, scenario_version, seed, status, clock (JSON), context (JSON), host_user_id, lobby_id, chapter_id, level_id, boss (`preview`\|`gate`\|`final`\|null), created_at, settled_at |
| `game_participants` | id, game_id, user_id (null for bots), bot_id, display_name, plan (JSON), result (JSON), forfeited; unique (game_id, user_id)                                                                       |
| `game_orders`       | id, game_id, participant_id, client_order_id (unique per participant), seq, tick, symbol, side, type, qty, limit_price, stop_price, cancelled_tick, created_at                                     |
| `game_events`       | id, game_id, participant_id, tick, kind, payload (JSON), created_at ([research log](research.md#recorded-data))                                                                                    |

Migration 12 (`migration_v12.py`):

| Table                                   | Columns                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaign_progress`                     | user_id, level_id, check_done, check_first_try, check_total, normal_star, special_star, best_profit, plays, updated_at; boss stars use `<chapter>-boss`       |
| `campaign_checks`                       | user_id, level_id, question_id, first_option_id, first_correct, solved (first-ever answers), run_first_correct, run_solved (current run, reset on completion) |
| `boss_results`                          | user_id, chapter_id, kind (`preview`\|`gate`\|`boss`), won, best_profit, attempts, first_won_at; for the Preview, `won` means played to the end               |
| `daily_seeds`                           | day, seed, created_at                                                                                                                                         |
| `quiz_attempts_v2`                      | id, user_id, topic_id, room_id, bank_version, items (question ids and option order), answers, status, score, total, passed, xp, created_at, completed_at      |
| `quiz_rooms_v2`, `quiz_room_members_v2` | id, code, host_user_id, topic_id, title, created_at; room_id, user_id, joined_at                                                                              |
| `lobbies`, `lobby_members`              | id, code, host_user_id, scenario_id, bots, status, game_id, created_at; lobby_id, user_id, joined_at                                                          |
| `matchmaking_queue`                     | user_id, status (`searching`\|`matched`), game_id, created_at                                                                                                 |
| `ratings`                               | user_id, rating, matches, wins, updated_at                                                                                                                    |

Migration 13 (`migration_v13.py`, `research_models.PriorKnowledgeResponse`):

| Table                       | Columns                                                                                                                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prior_knowledge_responses` | user_id (one row per player), instrument_version, consent_version, status (`completed`\|`skipped`), experience, brokerage_account, market_frequency, confidence (1–5), answers (JSON: item, option or null, correct), score, prior_knowledge_group, elapsed_seconds, recorded_at |
| `campaign_checks` (added)   | first_answered_at: time of the first answer; null for answers recorded before migration 13                                                                                                                                                                                       |

Migration 14 (`migration_v14.py`) adds nullable `profiles.equipped_badge_id`.
Existing profiles start without an equipped badge; earlier rows and equipment
are preserved. The profile update checks that the selected badge is earned.

Migration 15 (`migrations/migration_v15.py`, `player.notifications.UnlockReceipt`)
adds `unlock_receipts`: `(user_id, category, item_id)` is the primary key and
`seen_at` records acknowledgement. New cosmetic notifications are computed
from server-owned cosmetics minus these receipts; receipt rows never award
or revoke ownership. Starter/free cosmetics and the initial rank are excluded.

Rewards are keyed, not counted: an `xp_ledger` or `economy_events` row with
the same (player, key) is never written twice. Key formats are in
[matches](matches.md#settlement).

## Legacy tables

Migrations 1–10 also created the tables of the removed learning-run system
(attempts, lesson completions, review queue, journals, simulation sessions and
commands, learning runs, challenge attempts, the old quiz and multiplayer
tables). They stay because deployed migrations are never rewritten, but no
code reads or writes them. Earlier learner records were not converted.

## Migrations

`server/app/migrations/migrations.py` applies 1–15 in order, records each in
`schema_versions`, and rejects gaps or unknown versions. Changing a model does
not change a database: append a numbered migration. With `AUTO_MIGRATE=false`,
run `uv run --project server --locked python -m app.db` first; the API refuses
to start on a version mismatch. `server/tests/test_migrations.py` checks a
fresh migration and that upgrading a populated database to 12 and to 13 keeps
every row.

## Privacy

Every player-owned read is filtered by the authenticated profile.
Leaderboards show only opted-in display names. Research exports omit the
daily shared seed. Researcher views and exports cover only participants with
active consent, under keyed pseudonyms ([research](research.md#researcher-dashboard)).
There is no account deletion or retention policy.
