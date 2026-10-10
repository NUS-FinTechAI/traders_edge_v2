# Owned evidence and study metadata

The supplied game brief requires first attempts, retries and observed decisions to remain distinguishable. Existing learning runs and AI challenges already persist those operational records. The owned evidence API projects them without exposing grading keys, hidden market paths or another player's plans.

These records support later analysis. They do not establish a validated learning rubric, comparable entry and exit forms, participant evaluation, or financial and pedagogical publication approval. Profit is a competition result and does not demonstrate understanding.

## Study participation

Study enrollment is disabled by default. Configuration must explicitly enable it and supply a nonblank policy version and consent text. Enabling configuration does not itself establish ethics or privacy approval; the deployment owner must obtain the required approval before enabling enrollment.

Environment configuration is `RESEARCH_ENABLED=true`, `RESEARCH_POLICY_VERSION` (1–80 characters without surrounding whitespace) and `RESEARCH_POLICY_TEXT`. Missing, blank or padded policy configuration rejects startup when enrollment is enabled. The default container stack leaves enrollment disabled.

- `GET /api/me/research` returns the configured policy, its `policy_digest` (SHA-256 of the exact UTF-8 text), and the authenticated user's participation metadata. Unavailable policies return a null digest.
- `POST /api/me/research/metadata` accepts `prior_knowledge`: `unknown`, `none`, `some` or `experienced`. The first submitted value remains frozen while later self-reports can change. If consent precedes a report, the first report remains null until one is submitted. These categories are self-reported and unvalidated.
- `POST /api/me/research/consents` requires boolean `accepted: true`, the exact current `policy_version`, and the strict 64-character lowercase hexadecimal `policy_digest` returned with the text the user read. Fresh acceptance requires both the current version and digest, including for a first participant. A stale digest returns 409 before creating consent evidence. The accepted version, complete text and UTC timestamp are retained. An unchanged version with changed policy text cannot renew an existing consent. Participation is active only while the configured version and text match the accepted policy and enrollment remains enabled.
- `POST /api/me/research/withdrawals` stops participation, including while enrollment is disabled. Withdrawal retains operational records. Account deletion, retention periods and any removal of already collected study data need a separate approved policy.

Every mutation requires an 8–100 character `idempotency_key`. Its committed response replays exactly; using the same key for another operation or payload returns 409. Replaying an old acceptance after withdrawal returns its historical receipt and does not enroll the user again. Clients must read the current metadata to display current participation. Authentication's existing per-profile mutation lock serializes these changes; receipts and metadata commit together. Analytics opt-in is separate and never implies study consent.

Migration 10 appends `research_participants` and `research_commands`. It does not rewrite migrations, learning evidence, rewards, simulation state or learner data.

## Owned exports

`GET /api/me/research/export/{kind}` downloads JSON with `format_version: 1`, up to 100 records per page, and an opaque `next_cursor` identifying the last returned record. The default page size is 50. Continue with `cursor` and `limit`. Ordering is by creation time and identifier, including when records share a timestamp. Cursors must identify a record owned by the current user; other users' cursors return 404.

The supported kinds are:

| Kind                | Exported evidence                                                                                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `learning-runs`     | Pinned edition and purpose, observed tasks, frozen first answers, numbered retries, structured simulation audits, recorded command times, and completed scalar results.                                                                                                                                                                |
| `learning-attempts` | Existing completed conventional or interactive attempt answers, confidence where recorded, reflection, score and result, with no stored grading feedback or answer keys.                                                                                                                                                               |
| `ai-challenges`     | Challenge identity, scenario policy version, difficulty and objective, attempt number, own event timing and action payloads, observed quotes and market history, own plans, cash, fees, holdings, allocation, realized profit and derived unrealized profit. Completed results include final profit and the public result leaderboard. |

AI daily records also expose the pinned `daily_date`, `premium_retry` flag and `refresh_event_key` receipt reference when present. Older attempts without these fields return an empty retry context; an absent field must not be interpreted as proof of a free retry. The first-attempt flag refers to the challenge's recorded attempt number, not the participant's first experience with that concept.

Run exports include completed and currently observed tasks only. They withhold unseen tasks, grading keys and explanations, and result fields while a run is active. Challenge exports preserve each event's before/after observations and cap price history at the corresponding observation tick. They omit seeds, future prices, opponent strategies and private opponent portfolios. Own submitted rationale is exported as recorded text; it is not scored for reasoning quality. The completed leaderboard contains only the public competition result.

Exports require the user's existing authenticated session, use `Cache-Control: no-store`, and remain available without study enrollment so users can inspect their own operational records. They do not provide instructor or researcher access to another person's records. Withdrawal does not erase owned exports.

Standalone simulation, multiplayer and quiz exports are not part of this slice. Research cohort access, approved retention/export/deletion policies, validated prior-knowledge measurement, unseen transfer forms and a calibrated learning rubric remain outstanding.

## Verification

`server/tests/test_research.py` tests explicit enrollment, policy changes, frozen first reports, withdrawal and historical replay, concurrency, restart, transactional rollback, populated repeatable migration, owned pagination, actual diagnostic submissions, structured audit preservation and AI observation redaction. The same cases run against isolated random PostgreSQL schemas when `TRADERS_EDGE_TEST_POSTGRES_URL` points to the guarded loopback QA database. PostgreSQL tests never reset the database or access learner schemas.
