# Learning API

The FastAPI service stores learning progress locally without Docker. The default SQLite database is `server/data/learning.db`; closing the API does not erase it. Guest credentials are held in an HTTP-only cookie, with only a SHA-256 token hash stored in the database. Guest sessions expire after seven days. Clearing the cookie loses access to that guest profile; this mode is for local development, not account recovery.

## Run and verify

Requires Python 3.12 or newer and uv 0.12.23. From the repository root:

```sh
uv sync --project server --extra test --locked
uv run --project server --locked python -m uvicorn app.main:app --reload
uv run --project server --extra test --locked python -m unittest discover -s server/tests
```

The client must include credentials in requests. State-changing browser requests require an allowed `Origin`; defaults are `http://localhost:5173` and `http://127.0.0.1:5173`. Use the same hostname for client and API, because the guest cookie uses `SameSite=Strict`. No API response is cacheable.

A local command-line request must also include the origin header:

```sh
curl -X POST -H 'Origin: http://localhost:5173' -c /tmp/traders-edge-cookies http://127.0.0.1:8000/api/session
curl -b /tmp/traders-edge-cookies http://127.0.0.1:8000/api/curriculum
```

`GET /health` is unauthenticated liveness. Interactive endpoint schemas are available at `/docs`. Payloads reject unknown fields, duplicate/missing question answers, unknown choices, short reflections and out-of-range confidence. Free-text reflections and journal entries remain private; their quality is not automatically assessed.

## Endpoint contract

| Endpoint | Behavior |
| --- | --- |
| `POST /api/session` | Start or reuse a local guest session; disabled in Firebase mode |
| `DELETE /api/session` | Revoke the guest cookie/session |
| `GET`, `PATCH /api/me/profile` | Own pseudonym, privacy settings, XP, completed lessons, mastered modules, UTC learning days and review count |
| `GET /api/curriculum` | Module/lesson titles, authoritative prerequisite availability, mastery and practice eligibility |
| `GET /api/archive` | Glossary definitions and source references |
| `GET /api/lessons/{id}` | Unlocked public lesson cycle and question options; no answer keys |
| `POST /api/lessons/{id}/complete` | Grade the complete question set and record a private reflection |
| `GET`, `POST /api/modules/{id}/assessment` | Read and submit the module assessment after all its lessons pass |
| `GET /api/attempts/{id}` | Own recorded feedback only |
| `GET /api/reviews` | Own delayed-review queue; questions appear when due |
| `POST /api/reviews/{id}/submit` | Grade a due review and record completion or another 24-hour delay |
| `GET`, `POST /api/journal` | Read up to 100 own entries or write a 10–2000-character note |
| `DELETE /api/journal/{id}` | Delete an owned note |
| `GET /api/leaderboard` | Opt-in pseudonyms ranked by verified learning XP; no trading outcomes |

Learning submissions use:

```json
{
  "idempotency_key": "unique-request-identifier",
  "answers": [
    {"question_id": "question-id", "option_id": "option-id", "confidence": 60}
  ],
  "reflection": "An explanation of what I would consider and why."
}
```

Confidence is optional, 0–100. When supplied, the response reports the mean binary Brier score for that attempt and its sample size: the squared difference between stated probability and observed correctness. This descriptive metric does not establish long-term calibration or change XP. Submit exactly one answer for every server-provided question. Successful HTTP responses include `passed`, `score_percent`, `critical_items_passed`, per-item `feedback`, `xp_awarded` and the updated `profile`. Explanations and correct option IDs are revealed only after the learner submits that complete question set. A failing learning check returns HTTP 200 with `passed: false`; malformed input returns 422, missing authentication 401, ownership/prerequisite violations 403, and conflicting idempotency reuse 409. Retry a transient concurrent-write 409 with the same key and unchanged payload.

`PATCH /api/me/profile` accepts `display_name`, `leaderboard_opt_in` and `analytics_opt_in`. Both consent flags default false. Leaderboard output contains pseudonyms and learning XP, not account IDs. Consented analytics contain only daily aggregate event counts with no user ID, token, answer, plan or reflection. Opting out stops future counting; already anonymous aggregates cannot be attributed for removal.

## Progression and persistence

Modules unlock sequentially, and lessons require the preceding lessons in their module. Every required lesson must pass before its module assessment. Lesson and delayed-review checks require every reasoning item correct. Module assessments require at least 80% correct and every critical risk item correct; the response makes these rules explicit. These are implementation rules proposed for educational review, not a validated measure of real-world financial competence.

The XP ledger grants 20 once per passed lesson, 50 once per mastered module and 10 once per passed delayed review. Repeated passing attempts cannot farm XP. A request key is unique per learner; replay returns the stored result, while changing its payload conflicts. Each first lesson pass schedules a review 24 hours later. Activity days reflect rewarded learning and use UTC; no trading activity or threatened streak loss is recorded.

The first four modules gate simulated execution. Modules 1–9 gate multiplayer/endless eligibility; optional module 10 requires the earlier nine. These flags are authorization input for separate simulation routes, not an implementation of multiplayer networking. The database includes a versioned private simulation snapshot table; this learning slice does not implement order execution.

SQLite mutations begin with `BEGIN IMMEDIATE` to serialize writers. PostgreSQL mutation authentication locks the profile row. Unique constraints additionally protect completion, mastery, review scheduling and reward identity. Attempts, progression changes, due reviews and XP commit in one transaction. The API has no request-path market-data download.

## Configuration and deployment boundary

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ENV` | `development` | Set `production` for strict deployment checks |
| `DATABASE_URL` | Absolute local SQLite URL | Use `postgresql+psycopg://...` for PostgreSQL |
| `AUTH_MODE` | `guest` in development; `firebase` in production | Guest or server-verified Firebase identity |
| `ALLOWED_ORIGINS` | The two local client origins | Comma-separated exact browser origins |
| `FIREBASE_PROJECT_ID` | Unset | Required when Firebase authentication is enabled |
| `AUTO_MIGRATE` | `true` locally, `false` in production | Apply the initial schema at startup |

Firebase mode accepts only a verified bearer ID token. The Firebase Admin SDK checks signature, issuer/audience, expiry and revocation with the configured project. Credentials come from the SDK's application-default credentials; no credentials or project values are invented or stored here. Verification errors fail closed. Production refuses guest auth, SQLite and non-HTTPS allowed origins. Production learning endpoints also refuse content whose catalog, module or lesson `review_status` is not `approved`; authored examples require independent content review before public release.

Run `uv run --project server --locked python -m app.db` before starting with automatic migration disabled. The ordered migration runner in `app/migrations.py` applies version 1 only to a database without that recorded version; it does not call `create_all` as an upgrade on every startup. It rejects future versions and gaps in migration history. Version 1 creates the frozen tables declared in `app/migration_v1.py`; later model edits do not rewrite that historical schema. Future column changes require an appended explicit migration and regression tests; changing model declarations alone does not upgrade an existing database. Back up the database before later migrations.

Tests exercise local SQLite persistence across app restarts, ownership, session expiry, origin checks, grading, prerequisites, idempotent retries, concurrent same-request submission, reward limits and privacy defaults. Firebase failure behavior is tested with a mocked verifier; no live Firebase project or PostgreSQL server has been integration-tested. Load, deployment, account lifecycle and independent curriculum validation remain separate work. Local test success is not production validation.

## Interactive learning runs

All ten modules use an entry diagnostic, sequential required practice, optional bonus tasks and a module exit check. Start with `POST /api/modules/{id}/diagnostic-runs`, then `POST /api/levels/{id}/runs` (optional `purpose: bonus`) and `POST /api/modules/{id}/assessment-runs`. Read or resume with `GET /api/learning-runs/{id}`; submit only the current step through `POST /api/learning-runs/{id}/steps/{step_id}/submit`. Commands require an 8–100 character idempotency key. Same-key identical commands replay their committed response; changed payloads conflict with 409. Whole-lesson submissions cannot bypass interactive tasks, but stored legacy responses remain replayable. Edition `2026-10-04.3` contains 30 entry items, 96 required steps, 30 optional bonuses and 50 unchanged exit items. All 110 original practice/exit questions remain unchanged.

Runs pin content and rubric snapshots. Instruction steps require acknowledgement; choice steps select an option; classifications assign every item to a known category. Practice retries preserve first responses separately. Wrong diagnostic answers allow teaching. Diagnostic and exit feedback stays hidden until completion. Required completion earns the existing once-only lesson reward; verified optional bonuses earn a bonus star and zero XP. Existing attempts, mastery, XP and review scheduling remain intact. Migration 3 adds only `learning_runs` and `learning_run_commands`.

`GET /api/modules/{id}/map`, `GET /api/levels/{id}` and `GET /api/me/workflow` project prerequisites, standard/bonus stars and resumable runs. Public task projections expose only display fields, including nested option/item/category IDs and text. Authoring requires source basis and objectives; choice IDs must be trim-stable and one to 100 characters. Extend the canonical catalog and validate it rather than inventing a runtime content format. All authored content still awaits independent financial/pedagogical publication review; production refuses it. Local contract tests establish neither learning outcomes nor deployment readiness.

## Resumable delayed reviews

`POST /api/reviews/{review_id}/runs` starts or resumes an owned, due, uncompleted review for a completed lesson. Review list/detail projections include current run identifiers. The run pins its familiar lesson questions and retry interval; it does not implement unseen retention or transfer forms. No essay is required. First answers remain frozen and correctness stays hidden until the entire form ends. Every item must be correct to pass.

Passing completes the review and awards the existing `review:<lesson_id>` reward of 10 XP once. Failure reschedules by the pinned interval and retains prior mastery. Fresh whole-review submissions cannot bypass canonical interactive reviews; historical committed legacy responses still replay. Learning-run commands preserve exact response replay before current due/publication/version gates. Ownership, early/completed checks, rollback, retry and concurrency are covered by `test_review_runs.py`.
