# Stored data

`server/app/db.py` defines the current SQLAlchemy models. SQLite stores local development data in `server/data/learning.db`; the production configuration requires PostgreSQL. The authored catalog is versioned JSON in source control, not mutable learner data.

| Table                 | Identity and purpose                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `schema_versions`     | Ordered migration number and application time                                                                 |
| `profiles`            | UUID, optional unique Firebase identity, pseudonym and privacy preferences                                    |
| `sessions`            | Hashed guest token, owner and expiry; raw token stays in the cookie                                           |
| `attempts`            | Owner, target, selected answers/confidence, reflection, grade and returned feedback; unique owner/request key |
| `lesson_completions`  | One record per owner/lesson, linked to the passing attempt                                                    |
| `mastered_modules`    | One record per owner/module, linked to the passing check; name does not imply a competence certification      |
| `review_queue`        | One review per owner/lesson, with due and completion timestamps                                               |
| `xp_ledger`           | Unique owner/event key, amount and learning reason                                                            |
| `learning_activity`   | One UTC learning day per owner, recorded when learning XP is awarded                                          |
| `journal_entries`     | Private text and optional lesson reference                                                                    |
| `aggregate_events`    | Consented daily event counts without learner IDs or free text                                                 |
| `simulation_sessions` | Owner, mode, scenario kind and versioned private JSON snapshot                                                |
| `simulation_commands` | Unique owner/command key, target session, request hash and committed public response                          |

Attempts retain the response used at submission, so an idempotent replay returns the original result. Content IDs remain stable; changing an ID’s meaning would break interpretation of stored attempts. Correcting a lesson requires reviewing both the content edition and existing progression semantics.

Ownership filters protect attempts, journal and reviews. The leaderboard exposes only opted-in pseudonyms and learning XP. Reflections are recorded, not automatically assessed. Opting out of analytics stops future counting; already anonymous aggregate counts cannot be attributed for deletion. Account export/deletion and a research retention policy are separate work, not implied by journal deletion.

The ordered migration runner applies frozen numbered migrations in order. Version 1 creates learning and snapshot tables; version 2 adds simulation command idempotency. Future schema changes need a new explicit migration; editing a model does not upgrade a database. Back up persistent data before applying upgrades. Run `uv run --project server --locked python -m app.db`, then start the service with automatic migration disabled to check the expected version. API mutation transactions keep attempt, progression and reward writes together; uniqueness protects against duplicate rewards.
