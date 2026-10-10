# Backend API

This guide covers the existing authentication, persistence, learning, XP, review, journal and simulation foundations; interactive/review runs, finite learning inventory and one bound lesson simulation from PRs #24–30; shared AI challenges, chapter/daily progression and game economy from #38–40; supplementary/classroom quizzes from #43, shared human multiplayer from #44 and owned evidence/study metadata from #45. Independent content approval, real Firebase sign-in and hosted deployment remain unfinished. Frontend visual design remains the teammate's responsibility.

The FastAPI service stores learning progress locally without Docker. The default SQLite database is `server/data/learning.db`; closing the API does not erase it. Guest credentials are held in an HTTP-only cookie, with only a SHA-256 token hash stored in the database. Guest sessions expire after seven days. Clearing the cookie loses access to that guest profile; this mode is for local development, not account recovery.

## Run and verify

Requires Python 3.12 or newer and uv 0.12.23. From the repository root:

```sh
uv sync --project server --extra test --locked
uv run --project server --locked python -m uvicorn app.main:app --reload
uv run --project server --extra test --locked python -m unittest discover -s server/tests
uv run --project server --extra test --locked python -m unittest app.content.test_catalog
uv run --project server --locked python -m app.content.validate
```

The client must include credentials in requests. State-changing browser requests require an allowed `Origin`; defaults are `http://localhost:5173` and `http://127.0.0.1:5173`. Use the same hostname for client and API, because the guest cookie uses `SameSite=Strict`. No API response is cacheable.

A local command-line request must also include the origin header:

```sh
curl -X POST -H 'Origin: http://localhost:5173' -c /tmp/traders-edge-cookies http://127.0.0.1:8000/api/session
curl -b /tmp/traders-edge-cookies http://127.0.0.1:8000/api/curriculum
```

`GET /health` is unauthenticated liveness. Endpoint schemas are available at `/docs`. Payloads reject unknown fields, duplicate/missing question answers, unknown choices and out-of-range confidence. Legacy whole-lesson/review submissions require a reflection; interactive runs do not require essays. Free-text reflections and journal entries remain private; their quality is not automatically assessed.

## Public frontend configuration

`GET /api/config` is available before sign-in and returns only the public authentication settings of the running app:

```json
{
  "auth": {
    "mode": "guest",
    "firebase_project_id": null
  }
}
```

`auth.mode` follows `Settings.auth_mode`. Firebase mode returns the configured project ID; guest mode returns `null` even if an inactive Firebase project is configured. The endpoint does not create a session and sends `Cache-Control: no-store`. Database URLs, instructor identifiers, cookie settings and research settings are excluded.

The frontend can call `configService.getConfig({ signal })` from `client/services/configService.ts` using the existing HTTP service and API base URL. It fetches without obtaining an authentication token, validates the response and caches successful configuration in memory for the service instance's lifetime (until page reload for the shared instance). Subsequent calls return independent copies of the cached configuration. Failed or cancelled requests are not cached and can be retried; errors never default to guest mode. The service is available for future login integration; the homepage does not yet call it.

These settings describe the current authentication mode, not enabled Google/email providers or complete Firebase web-client configuration. Guest sessions remain disabled in Firebase mode; the endpoint does not change access policy.

## Generate the frontend contract

From the repository root, after installing the locked Node and Python dependencies:

```sh
npm run api:generate
npm run api:check
npm run api:test
```

`api:generate` exports FastAPI OpenAPI in a separate Python process with fixed development settings. It does not start the application lifespan, open a database or initialize Firebase, and does not need a running API. It generates `client/api/api-types.ts` (component object types only), `client/api/api-contract.ts` (operation and route types used by the API wrapper), `client/api/api-endpoints.ts` and `client/api/api-coverage.json`. Frontend scripts can import object types from `api-types.ts`; the wrapper uses `api-contract.ts` to check requests and infer response types. Commit these artifacts together with backend contract changes; do not edit them manually. `api:check` rebuilds the artifacts in memory and fails if committed output is missing or stale, without rewriting it. CI runs the check and generator tests using locked dependencies.

Use the generated operations through `client/api/apiClient.ts`:

```ts
import { api } from './api/apiClient.ts'
import { apiEndpoints } from './api/api-endpoints.ts'
import type { components } from './api/api-types.ts'

type UserProfile = components['schemas']['UserProfile']
const profile: UserProfile = await api.call(apiEndpoints.getProfile)
await api.call(apiEndpoints.updateProfile, {
  body: { display_name: 'Learner' },
})
await api.call(apiEndpoints.getChallenge, {
  path: { attempt_id: 'saved-attempt-id' },
})
```

The wrapper checks operation names, methods, request bodies, path and query parameters at compile time and encodes path values. It uses the existing HTTP service for cookies, bearer tokens, cancellation and `HttpError`. Public operations declare `x-client-auth: none` in their backend OpenAPI metadata; other operations default to authenticated client requests. This metadata controls token acquisition, not server authorization. The auth/config services use generated types and operations; config caching and runtime response checks remain in place.

All 88 operations are generated. This first response-model slice covers guest sessions, profile reads/updates and public configuration; two delete operations have empty responses. The coverage report lists 82 success responses that still lack schemas. Those JSON results remain `unknown`; progressively add public response models before relying on their fields. Existing routes use FastAPI's generated operation IDs unless explicitly named. Set a unique, stable `operation_id` when adopting a route, regenerate, and update callers. TypeScript types do not perform runtime validation or prove a deployed backend matches this checkout.

## Endpoint contract

| Endpoint                                    | Behavior                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/session`                         | Start or reuse a local guest session; disabled in Firebase mode                                                                                                                            |
| `DELETE /api/session`                       | Revoke the guest cookie/session                                                                                                                                                            |
| `GET`, `PATCH /api/me/profile`              | Own pseudonym, privacy settings, total/learning/game XP, derived player level, completed lessons, mastery, learning days and reviews                                                       |
| `GET /api/curriculum`                       | Module/lesson titles, authoritative prerequisite availability, mastery and practice eligibility                                                                                            |
| `GET /api/archive`                          | Glossary definitions and source references                                                                                                                                                 |
| `GET /api/lessons/{id}`                     | Unlocked public lesson cycle and question options; no answer keys                                                                                                                          |
| `POST /api/lessons/{id}/complete`           | Legacy modules only: grade the complete question set and record a private reflection; interactive modules reject new submissions with 403                                                  |
| `GET`, `POST /api/modules/{id}/assessment`  | Legacy assessment read/submit after all lessons pass; interactive modules reject new whole-assessment submissions with 403                                                                 |
| `GET /api/attempts/{id}`                    | Own recorded feedback only                                                                                                                                                                 |
| `GET /api/reviews`, `GET /api/reviews/{id}` | Owned queue/detail: `id`, `lesson_id`, title, due/completion state, public questions when due, `interactive_required`, `reflection_required`, latest `run_id` and nullable `active_run_id` |
| `POST /api/reviews/{id}/runs`               | Start/resume a due, uncompleted canonical review with `idempotency_key`; submit choices through learning-run steps                                                                         |
| `POST /api/reviews/{id}/submit`             | Legacy compatibility only; new canonical whole-review writes return 403, stored replay and supported unversioned fixtures remain                                                           |
| `GET`, `POST /api/journal`                  | Read up to 100 own entries or write a 10–2000-character note                                                                                                                               |
| `DELETE /api/journal/{id}`                  | Delete an owned note                                                                                                                                                                       |
| `GET /api/leaderboard`                      | Opt-in pseudonyms ranked by verified learning XP; no trading outcomes                                                                                                                      |

Legacy lesson/assessment and delayed-review submissions use:

```json
{
  "idempotency_key": "unique-request-identifier",
  "answers": [
    { "question_id": "question-id", "option_id": "option-id", "confidence": 60 }
  ],
  "reflection": "An explanation of what I would consider and why."
}
```

Confidence is optional, 0–100. When supplied, the response reports the mean binary Brier score for that attempt and its sample size: the squared difference between stated probability and observed correctness. This descriptive metric does not establish long-term calibration or change XP. Submit exactly one answer for every server-provided question. Successful HTTP responses include `passed`, `score_percent`, `critical_items_passed`, per-item `feedback`, `xp_awarded` and the updated `profile`. Explanations and correct option IDs are revealed only after the learner submits that complete question set. A failing learning check returns HTTP 200 with `passed: false`; malformed input returns 422, missing authentication 401, ownership/prerequisite violations 403, and conflicting idempotency reuse 409. Retry a transient concurrent-write 409 with the same key and unchanged payload.

`PATCH /api/me/profile` accepts `display_name`, `leaderboard_opt_in` and `analytics_opt_in`. Both consent flags default false. Leaderboard output contains pseudonyms and learning XP, not account IDs. Consented analytics contain only daily aggregate event counts with no user ID, token, answer, plan or reflection. Opting out stops future counting; already anonymous aggregates cannot be attributed for removal.

## Progression and persistence

Learning modules normally unlock sequentially; verified entry/exit boss victories can grant the separate chapter access described in [adventure](../docs/adventure.md). Earned access never fabricates earlier mastery. Lessons still require their preceding required lessons and canonical diagnostic. Every required lesson must pass before its module assessment. Lesson and delayed-review checks require every reasoning item correct. Module assessments require at least 80% correct and every critical risk item correct; the response makes these rules explicit. These are implementation rules proposed for educational review, not a validated measure of real-world financial competence.

The XP ledger grants 20 once per passed lesson, 50 once per mastered module and 10 once per passed delayed review. Repeated passing attempts cannot farm XP. A request key is unique per learner within its command namespace; replay returns the stored result, while changing its payload conflicts. Each first lesson pass schedules a review using `review_after_days` (currently one day for every authored lesson; unversioned fixtures default to one day). Interactive runs pin this interval at creation. A failed legacy review uses the currently authored interval, not a newly invented adaptive schedule. Activity days reflect rewarded learning and use UTC; no trading activity or threatened streak loss is recorded.

General guided simulation requires the first four module checks; bounded endless requires modules 1–9. Private human lobbies require modules 1–4 and public matchmaking requires 1–9; their shared-state routes are distinct from simulation eligibility projections. Boss-earned access follows its own chapter policy, including early entry, and does not unlock these general sandbox modes. Shared AI challenges use their separately reviewed [challenge](../docs/challenges.md) and [adventure](../docs/adventure.md) policies. The existing engine executes planned simulated orders in private versioned snapshots; only `m05-l01` currently binds that engine to a graded lesson audit.

SQLite mutations begin with `BEGIN IMMEDIATE` to serialize writers. PostgreSQL mutation authentication locks the profile row. Unique constraints additionally protect completion, mastery, review scheduling and reward identity. Attempts, progression changes, due reviews and XP commit in one transaction. The API has no request-path market-data download.

Consented daily aggregate counts use an atomic SQLite/PostgreSQL upsert within that same transaction. Different profiles can create the first shared daily counter without an absent-row insert collision; existing counts increment in the database. The existing XP-event gate prevents replay from counting twice, and opting out still records learning without analytics. `test_aggregate_events.py` controls a two-profile interleaving in disposable SQLite to reproduce the former uniqueness failure. That controlled SQLite regression is distinct from the guarded live PostgreSQL suite, which verifies two real concurrent profile transactions incrementing the same counter.

## Interactive learning runs

All ten modules now have canonical interactive decision practice in `app/content/catalog.json`, edition `2026-10-04.4`, with `schema_version: 1` unchanged. Existing module/lesson IDs, source references, Module 1 tasks, 60 legacy practice questions and 50 exit questions are preserved. Every module has three separate entry diagnostic choices with an explicit “not sure” option, three sequential required levels and the existing five-item stepwise exit. All 30 levels have a separately verified optional bonus. New canonical lesson/assessment/review submissions use runs; legacy whole-set writes cannot bypass them. Compatibility for unversioned fixtures, prior commands and historical completion remains as documented below.

| Coverage                              | Module 1 retained | Modules 2–10 added | Total |
| ------------------------------------- | ----------------: | -----------------: | ----: |
| Entry diagnostic choices              |                 3 |                 27 |    30 |
| Required levels                       |                 3 |                 27 |    30 |
| Required instruction steps            |                 6 |                 27 |    33 |
| Required choice decisions             |                 6 |                 30 |    36 |
| Required classification decisions     |                 3 |                 24 |    27 |
| Required simulation audit steps       |                 0 |                  1 |     1 |
| Required steps, including instruction |                15 |                 82 |    97 |
| Optional verified bonus tasks         |                 3 |                 27 |    30 |
| Existing stepwise exit items          |                 5 |                 45 |    50 |

New levels have a short instruction/worked example and two verifiable decisions; `m05-l01` also has a final graded simulation audit. The complete interactive bank contains **157 authored tasks** (30 entry + 97 required + 30 bonus), plus the 50 preserved exit items. Bonus tasks comprise 28 choices and two classifications. Required decisions check role/quote/depth reading, product receipts and risks, allocation and exposure, order/fill risk, evidence, protection, planning constraints and advanced obligations. Instructions are acknowledged, not graded as reasoning. Entries and exits withhold feedback until the form is complete; practice and bonus errors can be corrected immediately. A diagnostic score never blocks teaching. Bonuses give zero XP and never block the next level or module. The older module-level `bonus_mission` reflection descriptions remain `content_only` and do not award stars.

This is not a full v1 scenario-engine port. Modules 1–4 require no execution; choice/classification answers never place orders. Only `m05-l01` now binds a final simulation audit, with optional restricted orders through dedicated simulation commands and a written plan before every actual order. Successful audit finishes the session and cancels pending remainders. Module 9 still checks supplied fictional records and regime-summary cards, not an actual four-scenario mission run. Structured arithmetic and record checks do not grade free-text plan quality or establish personal suitability. All content remains `authored_requires_independent_review`; production publication is still refused.

| Endpoint                                              | Contract                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/me/workflow`                                | `profile`, exact active `resume` run or null, `next_action`, module maps, existing `practice_eligibility`. Profile learning days and due-review count remain UTC. Reading workflow creates no learning day or login claim; game login rewards use a separate economy command.                                                                 |
| `GET /api/modules/{id}/map`                           | `module_id`, `title`, `content_version`, `interactive_available`, `unlocked`, missing `prerequisite_module_ids`, `mastered`, `diagnostic`, ordered `levels`, `assessment_available`. Each level has ID/title/objective, `unlocked`, textual `status`, `standard_star`, `bonus_star`, `completion_source`, `bonus_available`, `active_run_id`. |
| `POST /api/modules/{id}/diagnostic-runs`              | Start/resume the one baseline for this learner/module. Body: `idempotency_key`. A completed diagnostic is returned unchanged even for a new start key; wrong answers still unlock learning.                                                                                                                                                   |
| `GET /api/levels/{id}`                                | Public outcome briefing and availability even when locked; no task solutions. Returns `module_id`, `content_version`, `interactive_available`, and `level` with required/bonus step counts, source references, completion/bonus rules and review interval.                                                                                    |
| `POST /api/levels/{id}/runs`                          | Body: `idempotency_key`, optional `purpose` (`practice`, the default, or `bonus`). Resume an active run of that purpose or start a new one after completion. Bonus requires this level's standard completion, not completion of any other bonus.                                                                                              |
| `GET /api/learning-runs/{id}`                         | Owned pinned run, including saved current step and earned feedback, independent of current catalog retirement.                                                                                                                                                                                                                                |
| `POST /api/learning-runs/{id}/steps/{step_id}/submit` | Body: `idempotency_key`, typed `answer`. Only the current step is accepted. Every decision is graded on the server.                                                                                                                                                                                                                           |
| `POST /api/modules/{id}/assessment-runs`              | Body: `idempotency_key`. Requires diagnostic completion and every required level; bonus never blocks it. Retakes are new runs after completion.                                                                                                                                                                                               |

Core run start/step mutations return this envelope (bound simulation creation returns a public session; its review returns the run):

```json
{
  "id": "<server-issued-run-id>",
  "purpose": "diagnostic",
  "module_id": "m01-money-before-markets",
  "level_id": null,
  "content_version": "2026-10-04.4",
  "status": "active",
  "current_step": {
    "id": "m01-entry-need",
    "type": "choice",
    "prompt": "Before the lessons: Jo needs 250 units for transport to work next week. Which decision keeps that need independent of market prices?",
    "options": [
      { "id": "keep", "text": "Keep the full transport amount available." },
      {
        "id": "grow",
        "text": "Try to grow the amount in a volatile asset first."
      },
      { "id": "unsure", "text": "Not sure yet." }
    ]
  },
  "feedback": [],
  "progress": { "completed_steps": 0, "total_steps": 3 },
  "result": null
}
```

This is the response shape from `POST /api/modules/m01-money-before-markets/diagnostic-runs` with `{"idempotency_key":"entry-start-001"}`. The run ID is generated; do not use the placeholder as an actual identifier. Submit its first choice to `/api/learning-runs/<returned-id>/steps/m01-entry-need/submit`:

```json
{
  "idempotency_key": "entry-answer-001",
  "answer": { "option_id": "unsure", "confidence": 30 }
}
```

The response advances to `m01-entry-capacity`, progress becomes `1 / 3`, and both `feedback: []` and `result: null` remain unchanged. The answer cannot be replaced, even under a new key. On the third submitted answer, status becomes `completed`, `current_step` is null, and feedback for all three items appears. Diagnostic `result.passed` is null, `xp_awarded` is 0, and it grants neither mastery nor stars regardless of score.

After the diagnostic, start `/api/levels/m01-l01/runs` with `{"idempotency_key":"level-start-001"}`. Its first step is `m01-l01-task-brief`, type `instruction`, with authored `prompt` and `text`. The following are the three accepted answer shapes, used only on the matching current task:

```json
{ "idempotency_key": "brief-answer-001", "answer": { "acknowledged": true } }
```

```json
{
  "idempotency_key": "predict-answer-001",
  "answer": { "option_id": "sixty", "confidence": 60 }
}
```

```json
{
  "idempotency_key": "sort-answer-001",
  "answer": {
    "assignments": {
      "rent": "protect",
      "course": "protect",
      "unassigned": "clarify"
    }
  }
}
```

The latter two correspond to `m01-l01-task-predict` and `m01-l01-task-sort`. The intervening `m01-l01-task-example` instruction must also be acknowledged; posting directly to a later step returns 409. Classification requires exactly the presented item IDs and known category IDs. Confidence is optional on graded decisions, 0–100, persisted without a reward; instructions reject confidence. No generic essay, journal entry or simulator order is required.

An incorrect practice or bonus answer keeps the same current step and returns immediate `feedback`, for example `[{"step_id":"m01-l01-task-predict","correct":false,"explanation":"600 multiplied by 0.10 is 60. A future recovery is uncertain and may arrive after the bill."}]`. Use a **new** key for a deliberate retry. A correct answer advances; the returned feedback still refers to the submitted step, while `current_step` describes the next task. The first answer and every retry remain private evidence. Instruction acknowledgement is not assessed as decision quality.

Completed runs return `result` with `attempt_id`, `passed`, `score_percent`, `critical_items_passed`, `standard_star`, `bonus_star`, `xp_awarded`, and the original `profile` snapshot. For a first successful required level, `passed` and `standard_star` are true, `bonus_star` is false, and `xp_awarded` is 20. Optional bonus completion records separately verified bonus evidence and zero XP. `result.bonus_star` describes successful completion of that bonus run, not a newly awarded-star delta: it is true again on a successful repeat, while the map retains one boolean bonus star. Repeating either cannot mint additional lesson XP. Start a bonus with `{"idempotency_key":"bonus-start-001","purpose":"bonus"}` on that level's runs endpoint; skipping it never prevents starting the next required level.

Exit checks advance on each first answer but withhold correctness, explanations and scores until **all** items have been submitted. Passing requires at least 80% and every critical risk item correct. Failure is HTTP 200 with `result.passed: false`, retains all prior level progress and allows a new assessment run. First mastery grants the existing 50 XP once. Run `status` is `active` or `completed`, including failed completed exit checks; read `result.passed`, not status, to determine mastery. Public task projections never include `critical`, `correct_option_id`, `correct_assignments`, private snapshots or first-response evidence. Completed feedback reveals correctness/explanation only at the permitted phase.

Public task projection allowlists nested option/item/category fields to `id` and `text`; private authoring metadata and grading keys stay in the pinned snapshot. Choice IDs must be 1–100 characters and unchanged by whitespace trimming. Classification item/category IDs must also be unchanged by trimming, so the normalized answer round-trips to the authored key. The validator and fresh pinned-run checks enforce this contract.

### Retries, gates and compatibility

- Every **new run mutation** requires a key of 8–100 ASCII letters, digits, underscores or hyphens. All learning-run commands share a per-user key namespace. The canonical operation, target and normalized payload are hashed; object ordering and an omitted default `purpose: practice` are equivalent. Reusing a key for a changed answer, target or operation returns 409. A same-key replay returns the exact committed response, including its original XP delta/profile, before resolving catalog content, prerequisites or rubric versions. Fetch `/api/me/profile` separately for current totals. Persist a pending command and its key across reloads; never silently generate a new key for a lost response.
- Start responses can therefore describe an earlier run position when replayed. After recovering the original response, fetch the owned run for its current position. New starts resume an existing active run, except the baseline which is never retaken or overwritten. Practice and bonus allow within-step retries; diagnostic and exit first answers advance and freeze immediately.
- New run reads/writes require ownership; other learners receive 403. Missing runs return 404, malformed/extra fields and invalid answers 422, missing authentication 401, unmet prerequisites 403, and skipped/completed steps or unsupported run content paths 409. Modules without interactive authorship return 409 on run creation. An unsupported rubric or invalid pinned task content returns an explicit 409 on fresh run reads/writes before evidence, position or rewards change; instruction-only runs and missing or inconsistent grading keys are rejected. Committed replays still work before this validation.
- Lessons are sequential and prior module mastery is still required. Interactive modules require a completed baseline even when every baseline answer is wrong. Legacy lesson reads/assessment reads enforce that baseline; legacy completion/assessment writes cannot bypass interactive steps and return 403 for new submissions. Previously stored legacy commands still replay before content resolution. Unversioned injected test fixtures and modules without `entry_tasks` retain the original legacy path, including their reflection requirement. Session/profile/journal contracts remain; ordinary simulation routes now also enforce bound-session restrictions described below. This is not a claim that all old mutations are idempotent.
- Existing attempts, history, reviews, completion and XP are preserved. Map `completion_source: legacy` distinguishes a retained standard completion without interactive evidence. No diagnostic record or bonus star is synthesized from historical completion; taking the newly offered diagnostic does not revoke existing mastery. A retained lesson completion still suppresses repeat lesson XP. New baseline/bonus evidence lives in owned runs and completed `Attempt` records, not fabricated legacy rows. A diagnostic is the **first recorded diagnostic**, not a guaranteed unexposed baseline: its purpose alone does not establish that the learner has never seen lessons, prior assessments, explanations or external teaching. Existing attempt/completion history and run/attempt timestamps remain available for interpreting recorded prior activity; absence of a record is not proof of no exposure. No unseen history or exposure classification is fabricated.
- Migration **3 adds only `learning_runs` and `learning_run_commands`**. It does not change migrations 1/2 or rewrite old tables. Runs pin tasks, grading keys, rubric version, approval state, review interval and content version in private JSON. Position, first responses, retries and feedback survive a restart. Completion writes run/evidence, `Attempt`, existing lesson/mastery/review rows, XP and command response in one transaction. SQLite writer serialization, the current PostgreSQL profile lock, and composite key/ledger constraints protect concurrent rewards and same-key retries across workers. The populated-v2 upgrade test reconciles retained evidence and verifies exactly these two added tables. Back up before applying migration 3; strict schema checks mean old application binaries are not an automatic rollback strategy.
- Publication review is still pending. Current catalog/module/lesson approval gates apply to new starts and maps. Pinned unapproved runs cannot be read or newly advanced in production. Historical committed commands replay as committed; replay is not new publication approval. Validation and local tests do not establish content accuracy, equivalent pre/post forms, learning gain or production readiness.

### Delayed-review runs

All canonical reviews use the step-run path without a generic essay. `POST /api/reviews/{review_id}/runs` accepts only `idempotency_key`. The review must be owned, due and uncompleted (not due: 403; completed: 409). A fresh run also requires prior module prerequisites and completed lesson evidence. An active run resumes its private pinned questions, rubric, approval state, content edition and `review_after_days`, independent of current catalog retirement. The returned run has `purpose: review`, `review_id` and the usual envelope. Read current state with `GET /api/learning-runs/{run_id}`; list/detail `questions` reflect the current catalog and are **not** the resume source.

Submit the current choice through the normal step route. Each first answer advances and freezes; feedback and result remain withheld until all items are submitted. All answers must be correct. Passing completes the queue item and awards 10 XP once under `review:<lesson_id>`; failure completes this run and reschedules from failure time using the **pinned** interval. Start a new run only when due again. Current authored intervals are one day. Review runs grant no standard/bonus star. Fresh whole-review writes cannot bypass canonical runs (403); stored legacy commands replay before gates, and supported unversioned fixtures retain the old reflection path. Familiar lesson questions remain retrieval practice, not delivered unfamiliar forms.

### Rewards and learning activity

`app/rewards.py` defines a finite code policy, not a new authoring/configuration format. All six items currently use `rule_version: "1"`:

| Item ID                      | Kind   | Recorded criterion                              |
| ---------------------------- | ------ | ----------------------------------------------- |
| `badge-first-lesson`         | badge  | At least one positive `lesson:` XP event        |
| `badge-foundations`          | badge  | Mastery records for all four foundation modules |
| `badge-core`                 | badge  | Mastery records for all nine core modules       |
| `badge-first-review`         | badge  | At least one positive `review:` XP event        |
| `avatar-compass`             | avatar | At least one positive `lesson:` XP event        |
| `title-foundations-complete` | title  | Mastery records for all four foundation modules |

- `GET /api/me/rewards` returns `items` and `equipment`. Each item includes ID, kind, name, `visual_key`, rule version, criteria, `status` (`owned`, `eligible`, `locked`), evidence and creation time (null until owned). Owned grants preserve their public snapshot/evidence even after policy retirement; retired grants remain in inventory.
- `POST /api/me/rewards/claims`: `{"idempotency_key":"reward-claim-001","item_id":"avatar-compass"}`. New grants require a current policy item, the publication gate and qualifying evidence. Unknown item: 404; unmet criteria: 403. An already-owned item is not granted again.
- `PATCH /api/me/rewards/equipment`: key plus optional `avatar_id` and/or `title_id`. Omitted slots are unchanged; explicit null clears the slot. Only owned items may be equipped (403 otherwise), and kind must match the slot (422 otherwise); all validation precedes applying either slot. Owned retired items remain equippable by their saved kind.
- Claim/equip keys are 8–100 ASCII letters, digits, underscores or hyphens in a **separate per-user reward-command namespace**. Same-key unchanged requests return the original response before publication/policy checks; changed operation/target/payload conflicts with 409. Omission versus explicit null is part of the hash. Replay does not reapply old equipment. Fetch inventory for current state.
- Claims/equipment create **zero XP and zero learning activity**. Visual keys do not supply artwork; there is no player-level or multiplayer-rank policy.
- `GET /api/me/activity` accepts ISO `start_date`/`end_date`. The default is the 30-day window ending today UTC; the inclusive ordered window must be 1–366 days (422 otherwise). Response includes `basis: "days with rewarded learning events"`, `timezone: "UTC"`, dates, `{date, active}` days, `current_streak_days` and `longest_streak_days`. Both streaks use **all recorded history**, not the requested window. Current streak runs through today if active, otherwise yesterday. Logins, zero-XP bonuses, claims, equipment and trades do not create activity.

Migration **4 adds only `reward_grants`, `reward_commands`, `profiles.equipped_avatar_id` and `profiles.equipped_title_id`**; both columns are nullable. Migrations 1–3 are untouched. The populated-upgrade regression seeds all 14 prior data tables, including deterministic simulation state and a committed command response, then compares every original column and full rowset after upgrade and repeat migration. Rule snapshots survive policy changes. Back up before upgrading. See `test_rewards.py` and `test_learning_upgrade.py`, rather than interpreting schema changes as deployment validation.

### Bound m05-l01 simulation

Only `m05-l01` currently adds a final required `simulation` step after its instruction/knowledge cards. Its run pins `interactive-2` and `m05-l01-limit-audit-v1` from `app/simulation/bindings.py`; other runs retain their existing rubric. The run's `simulation` projection has nullable `session_id`, a resume URL and public policy. `StepAnswer` is unchanged for command-hash compatibility: do not put an audit into ordinary step submission (409 for a simulation step).

| Endpoint                                         | Contract                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/learning-runs/{id}/simulation`        | Key-only bind/start/resume at the current active simulation step; earlier graded cards must pass and guided prerequisites remain enforced |
| `GET /api/learning-runs/{id}/simulation`         | Owned linked session and observed state; supports completed-run inspection                                                                |
| `POST /api/learning-runs/{id}/simulation/review` | Dedicated `{idempotency_key, audit}` command; grades the current observed audit, not essay length                                         |

Binding returns the ordinary public simulation response plus `bound_policy` and nullable `audited_observation`. It uses the real four-symbol engine (`NORTH`, `HARBOR`, `PLAIN`, `COVE`), not a single-symbol toy engine. The private path has 30 observations, final tick 29. Orders are optional and limited to **NORTH buy limits**, at or below the **opening NORTH ask** unit-price cap, **excluding fees**; quantity at most five, at most two orders including cancelled ones. Advance at most two observations per command; observe at least ten before review. The case supplies **no investment thesis** and is controlled synthetic education, not a recommendation to buy.

Ordinary `/api/simulations/{session_id}` order, advance and cancel routes enforce the reciprocal run/session binding and the same policy. Every actual order still requires its full prior written plan. Raw debrief returns 409; fresh mutations after finish return 409. Ordinary session-list summaries add nullable `learning_run_id` (null for unbound sessions). Source kind, seed and future prices/liquidity remain private; only observed history and public policy are returned.

The dedicated `audit` requires:

- `tick`, `engine_version` and the returned `observation_token` matching current observations; the token changes when orders are placed or cancelled at the same tick and hashes only public observed engine state;
- `orders` (maximum two): each recorded order exactly once with `order_id`, `status` (`open`, `partial`, `filled`, `cancelled`, `expired`, `rejected`), integer `filled_quantity` (0–5), and positive decimal-string `limit_price`;
- decimal-string `session_fees`, boolean `price_limit_guarantees_fill`, and required nullable `no_order_reason`.

Success requires accurate order/status/fill/limit/fee facts, policy compliance and `price_limit_guarantees_fill: false`. With orders, `no_order_reason` must be null. Without orders it must be `no_thesis_supplied` (verified against the case) or `current_ask_above_cap` (verified using the **current ask**, not midpoint or an earlier quote). Merely observing, omitting orders or counting fills is not enough. An incorrect audit returns specific `issues`, including expected/observed facts, and retains the step for a new-key correction. Missing/stale observation tokens, stale tick/engine or insufficient observation return 409 **before evidence is recorded**. Historical committed audits without a token still replay their original responses and request hashes; fresh audits require the token.

Feedback identifies `observation_phase: before_finish_cancellation` and retains `audited_observation`. On success the engine finishes, cancelling pending remainders, and the lesson completes through the existing once-only lesson XP/star path. Distinguish that pre-cancellation audit from the finished session's order states. No trade, fill, count, profit or separate simulation reward is added, and bonus completion stays separate. Audit facts/reasons are structured verification, not semantic plan-quality assessment.

Bind/review commands use the learning-run namespace; ordinary simulation commands use their existing separate namespace. Both replay committed same-key responses **before** fresh gates, binding/engine compatibility or retired-version checks. Fresh reads/writes validate pinned content and reciprocal binding and return 409 for incompatible/corrupt state; production still refuses unapproved pinned content. Module 1 never enters the simulator. Other lesson bindings, unfamiliar review forms, comparable paired evaluation and exports for standalone simulation/quiz/multiplayer remain pending. Shared human matches and the three owned evidence downloads have their separate contracts below.

### Adapted source material and remaining port gaps

The source brief's exact module order is retained. The authoritative teaching contract and assessment model distinguish this decision-practice subset from the full teaching target. The reviewed crosswalk at `docs/v1-audit/learning-inventory.json` and `docs/v1-audit/migration-inventory.md` remains the asset-level authority; its 29 level, 64 question and 89 mission dispositions are not runtime-completion counts. The following describes **concept and context adaptation**, not one-for-one copying of questions, tutorial steps or complete levels. V1 remains read-only. Source references below are to `backend/config/database/init/02-initial_state.sql` at audited v1 commit `2bf6b5930858fdbb61bc388d4554d4657d9ce377`: level contexts at lines 8–556 and quiz rows at 4821–5013.

| Candidate tasks         | V1 concepts actually adapted                                                                                                                                                                                                                                                         | Boundary                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `m02-l02`, `m02-l03`    | `module-1.2`, `module-3.1`; candle/quote distinction from `m1-pre-2`, `m1-post-2`; spread from `m3-pre-1`, `m3-post-1`                                                                                                                                                               | New frozen quote/depth arithmetic, no chart interaction or ticking book. `m02-l01` role cards are new foundational content.                                                                                                                                                           |
| `m03-l01`               | Ownership and uncertain value from `module-1.1`, `m1-pre-1`, `m1-post-1`                                                                                                                                                                                                             | New return receipts; bond and fund tasks are newly authored, not inferred v1 coverage.                                                                                                                                                                                                |
| `m04-l01`–`m04-l03`     | Concentration/crowding, policy-based rebalancing and fair comparison contexts from `module-5.1`, `module-5.3`, `module-5.5`–`module-5.7`; question concepts from `m5-pre-1`–`m5-pre-3`, `m5-pre-6`, `m5-post-1`, `m5-post-2`, `m5-post-7`, `m5-post-8`                               | Paper allocations and supplied constraints, not rebalancing orders. The tick deadline in `m5-post-4` is rejected, not ported; `m04-l03-bonus-band` is a new policy/cost replacement. Outperformance is not a quality criterion.                                                       |
| `m05-l01`–`m05-l03`     | Market/limit/stop tradeoffs from `module-1.3`, `module-3.2`–`module-3.4`, `m1-pre-3`, `m1-post-3`, `m3-pre-2`–`m3-pre-4`, `m3-post-2`–`m3-post-4`                                                                                                                                    | No forced order or price guarantee. Partial-fill, fee and settlement cards are new; settlement uses an explicitly fictional withdrawal rule. Stop-limit is a comparison, not an engine-support claim.                                                                                 |
| `m06-l01`, `m06-l02`    | Adverse price-difference arithmetic replacing `module-1.4` and `m1-pre-4`/`m1-post-4` profit targets; drawdown/constraint concepts from `m4-pre-3`, `m4-pre-4`, `m4-post-3`                                                                                                          | New stress sizing, recovery and payoff-frequency tasks, not profit grading. Beta/volatility tools and `module-5.4` remain mapping-only.                                                                                                                                               |
| `m07-l01`, `m07-l02`    | Earnings-versus-expectations from `module-2.2`, `module-2.3`, `m2-pre-2`, `m2-pre-3`, `m2-post-2`, `m2-post-3`; inflation-surprise comparison from `module-4.2`, `m4-pre-1`, `m4-post-1`; scrutiny of the defensive label in `m5-post-6`                                             | Fictional evidence desk, no company-price prediction or copied news effects. `module-2.1`, `module-4.1` and `module-5.2` have only general source/uncertainty context reused; their full news, rate and multi-ratio activities remain pending. Probability/calibration cards are new. |
| `m08-l01-bonus-chasing` | Alternating-headline pressure from `m4-pre-6`                                                                                                                                                                                                                                        | New bias, conflict and verification tasks, not a whole v1 level port. No fake-news injection or real credential/payment interaction.                                                                                                                                                  |
| `m09-l01`–`m09-l03`     | Conflicting-information and shock-response contexts from `module-4.3`–`module-4.5`; constraint-based abstention, defensive results and adverse-path review from `m4-pre-5`, `m4-post-2`, `m4-post-5`, `m4-post-6`; later reuse of benchmark subtraction from `m5-pre-7`, `m5-post-3` | Provided records only. Portfolio concepts retain Module 4 as their primary destination. Both crisis puzzles (`puzzle-1.1`, `puzzle-1.2`) remain mapping-only, not imported historical scenarios.                                                                                      |
| `m10-l02`               | Borrow/sell/replace/return and adverse short arithmetic from `module-3.5`, `m3-pre-5`–`m3-pre-7`, `m3-post-5`, `m3-post-8`; correction of the squeeze-loss-cap claim in `m3-post-6`                                                                                                  | Obligation cards only, after the core modules. `module-3.6` indicator-confirmation mechanics are not ported. Leverage, futures and option tasks are newly authored from existing catalog teaching/source scope.                                                                       |

Remaining limitations are explicit:

- Beyond the single `m05-l01` bound audit, other lesson/per-tool bindings, broader order-linked mission assessment, hidden-next-step branches and Module 9's full four-regime replay set remain pending. No source mission row's old P&L, trade-count, forced-order or timed-rotation predicate is carried over.
- News replay, historical-data provenance/licensing, macro effects, source ticker/portfolio fixtures and tutorial interactions remain pending. None of the 23 v1 tutorial definitions or 122 steps is claimed as fully ported here. Synthetic crisis names do not establish historical accuracy.
- Advanced instruments are not implemented for execution. MA/EMA definitions, initialized calculations, counterexample branches and source `module-2.4`, `module-2.5`, `module-3.6` remain deferred to Module 10; their technical questions (`m2-pre/post-4`–`6`, `m3-pre-8`, `m3-post-7`) remain mapping-only. No technical strategy or short task appears in Modules 1–9.
- All 110 baseline question objects are unchanged, including keys, critical flags and explanations. The new 30-item entry bank uses different cases and is not a duplicate exit bank, but neither it nor repeated exit attempts are validated parallel forms. Delayed review still reuses the 60 legacy practice questions; unfamiliar delayed forms and a reviewed mastery rubric remain pending.
- Production review, product-specific/localized obligations, semantic plan assessment, research equivalence and independent arithmetic/content approval are not supplied by passing tests. Frontend presentation and design remain separate work.

`test_catalog_api.py` walks every module from an all-“not sure” diagnostic through sequential required tasks, exit and optional bonuses; it checks withheld diagnostic/exit feedback, skipped-step rejection, wrong-answer retry, private-key projection, saved-run reads, command replay, legacy bypass rejection and repeat-run XP suppression. It deliberately passes exits before bonuses to prove the latter do not gate the next module. Coverage is 10 diagnostic runs with 30 items, 97 required steps (including the bound simulation audit), 30 bonus tasks and 50 exit items, with replay and repeat-run checks. The final first-pass total remains 1,100 XP and 30 scheduled reviews; bonuses add no XP. Catalog tests assert exact bank counts, unique task IDs, unhinted entries, unchanged baseline-question digest and pending review. These are contract regressions, not independent pedagogical approval.

## Shared game challenges, economy, quizzes and evidence

`GET /api/adventure` projects chapter/boss access. `POST /api/challenges` starts `practice`, `daily`, `chapter_entry` or `chapter_exit` under server policy; list/owned read, planned order/cancel, advance, complete and abandon routes live under `/api/challenges`. Shared forms and opponent state remain private until the permitted final result. See [challenge](../docs/challenges.md) and [adventure](../docs/adventure.md) payloads, prerequisites, common forms, net-profit accounting and version/replay rules. Profit is a game outcome, not evidence of learning or plan quality.

`GET /api/me/economy` projects Stocks, premium, cooldown and the separate login streak. The economy namespace supplies login claims, cooldown refresh, a finite shop and purchases. Profile `xp` remains the total while `learning_xp`, `game_xp` and `player_level` make the basis explicit; initial level is 1 plus one level per 100 total XP. Learning leaderboard/activity/badge eligibility exclude game events. [Economy policy 1](../docs/economy.md) documents UTC caps, weekly expiry, balances and atomic internal settlement; no HTTP route accepts a claimed win or credit. Registered public ranked completion settles 10 game XP and 10 premium for a unique winner or 5 for another finisher/tie. Private matches and forfeiting players receive no completion award; wallet APIs cannot claim a ranked result.

`/api/quizzes` supplies standalone module forms and attempts, sequential answers, instructor question selection and private classroom rooms with join/start/close and host reports. Instructor authority is server-configured, never a client role. Questions and approval are pinned; first answers persist, feedback waits for the entire form, and private rooms award no XP/currency. See [quiz contract](../docs/quizzes.md) for exact limits, ownership and replay behavior. These familiar questions are not unseen transfer forms.

`/api/multiplayer` supplies private code creation/join, host start, public paired matchmaking, owned lists/detail, planned orders/cancel, readiness, completion/abandonment and a public Elo leaderboard. Private access requires structured mastery of chapters 1–4; public requires 1–9. Profit-derived early chapter access cannot bypass these checks. Orders/cancel/readiness require the last observed `expected_tick`; stale commands return 409 before mutation. Shared row locks and ready barriers synchronize the market, final results/rating freeze once, and committed commands replay before saved approval/version checks. Private matches grant no XP/currency/rating. See [multiplayer contract](../docs/multiplayer.md).

`GET /api/me/research` supplies current policy/digest and owned metadata. Metadata, consent and withdrawal commands use exact receipt replay. Fresh acceptance must echo the configured policy version and SHA-256 digest of the exact text the user read; enrollment defaults off and analytics opt-in is separate. `GET /api/me/research/export/{kind}` provides paginated `learning-runs`, `learning-attempts` and `ai-challenges` downloads, available to their owner without study enrollment. They retain own operational decisions while omitting keys, unseen tasks, hidden market paths and peer plans. Withdrawal stops participation without deleting records; replaying an old acceptance cannot reenroll. Retention/account deletion, researcher cohort access and validated learning rubrics remain unimplemented. See [owned evidence contract](../docs/research.md).

## Configuration and deployment boundary

| Variable                   | Default                                          | Meaning                                                                         |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `APP_ENV`                  | `development`                                    | Set `production` for strict deployment checks                                   |
| `DATABASE_URL`             | Absolute local SQLite URL                        | Use `postgresql+psycopg://...` for PostgreSQL                                   |
| `AUTH_MODE`                | `guest` in development; `firebase` in production | Guest or server-verified Firebase identity                                      |
| `ALLOWED_ORIGINS`          | The two local client origins                     | Comma-separated exact browser origins                                           |
| `FIREBASE_PROJECT_ID`      | Unset                                            | Required when Firebase authentication is enabled                                |
| `AUTO_MIGRATE`             | `true` locally, `false` in production            | Apply ordered pending migrations at startup                                     |
| `INSTRUCTOR_FIREBASE_UIDS` | Empty                                            | Comma-separated verified Firebase UIDs authorized to host quiz rooms            |
| `INSTRUCTOR_PROFILE_IDS`   | Empty                                            | Development-only exact profile IDs; ignored for production instructor authority |
| `RESEARCH_ENABLED`         | `false`                                          | Enable study enrollment only after the required ethics/privacy approval         |
| `RESEARCH_POLICY_VERSION`  | Unset                                            | Required nonblank, unpadded 1–80 character version when enrollment is enabled   |
| `RESEARCH_POLICY_TEXT`     | Unset                                            | Required exact consent text; its UTF-8 SHA-256 digest binds fresh acceptance    |

Firebase mode accepts only a verified bearer ID token. The Firebase Admin SDK checks signature, issuer/audience, expiry and revocation with the configured project. Credentials come from the SDK's application-default credentials; no credentials or project values are invented or stored here. Verification errors fail closed. Production refuses guest auth, SQLite and non-HTTPS allowed origins. Production learning endpoints also refuse content whose catalog, module or lesson `review_status` is not `approved`; authored examples require independent content review before public release.

Run `uv run --project server --locked python -m app.db` before starting with automatic migration disabled. The ordered migration runner in `app/migrations.py` applies every missing supported migration in order (currently versions 1–10); already recorded versions are not reapplied. It does not call `create_all` as a generic upgrade on every startup. It rejects future versions and gaps in migration history. Version 1 creates the frozen tables declared in `app/migration_v1.py`; later model edits do not rewrite that historical schema. Future column changes require an appended explicit migration and regression tests; changing model declarations alone does not upgrade an existing database. Back up the database before later migrations.

Tests cover SQLite restarts, ownership, expiry/origin, grading, prerequisites, exact replay, concurrent submissions, learning/game rewards and privacy. Mutation authentication locks/reloads profiles with `populate_existing=True`; SQLite/mocked-Firebase regressions establish ORM semantics. The guarded live PostgreSQL suite separately verifies actual profile-lock waiting/refresh, populated migrations, cross-profile aggregates and replay across workers/restart. PostgreSQL 16 and local production-configured container startup passed on 6 October 2026; guest and missing-token access fail closed. See [deployment setup and evidence](../docs/deployment.md). Real Firebase sign-in, valid/revoked-token verification and a hosted HTTPS destination remain unverified.

Runtime verification on 6 October 2026 passed 277 backend tests, including 51 live PostgreSQL cases, 22 catalog tests and 14 frontend service tests. The rebuilt production-configured local API runs as user 10001 with migrations 1–10 and matching hashes for all 47 tracked application files. Health and missing-token rejection establish local startup, not hosted release or real Firebase sign-in.

Historical verification on 5 October 2026 passed 131 backend, 22 catalog and five frontend HTTP-service tests plus lint, typecheck and build. Scripted fixture answers drove 1,819 real local HTTP requests against temporary QA data; a 600-read in-process SQLite benchmark measured workflow p95 at 73.14 ms. Those records predate the game/quiz additions and are not current revision, representative load or learner-outcome proof. Check a running preview’s revision separately. Full account export/deletion, approved retention/cohort access and evaluation, independent financial/pedagogical publication approval and frontend integration/design/accessibility/mobile remain separate work.
