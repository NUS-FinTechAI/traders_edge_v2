# API guide

Run the service and open `/docs` for generated schemas. [server/README.md](../server/README.md) is the canonical endpoint, payload and configuration guide; this page explains client workflow. These backend contracts were merged in PRs #24–30; frontend integration and deployment remain unfinished. Check a running service’s revision separately rather than inferring it from edited files or merged commits.

Use one hostname for browser/API guest cookies, include credentials and supply an allowed origin on mutations. Firebase mode requires a verified bearer token. Keep credentials out of URLs/logs; responses use `Cache-Control: no-store`.

## Learning and delayed review

Fetch `/api/me/workflow`, module maps and level briefings for server-owned prerequisites, progress, stars and resume state. Start a diagnostic, required/bonus level or exit run through the [interactive contract](../server/README.md#interactive-learning-runs). Render only `current_step`; submit `acknowledged: true`, `option_id` or a complete `assignments` map on matching tasks. No generic essay is required. Practice/bonus feedback is immediate; diagnostic, exit and review first answers freeze and feedback stays empty until the form completes.

For delayed review, list `/api/reviews` or read `/api/reviews/{id}`. Preserve the review `id`, latest `run_id` and nullable `active_run_id`; use `interactive_required`, `reflection_required`, `due` and `completed` rather than guessing. Start/resume a due, uncompleted, owned review with `POST /api/reviews/{id}/runs` and an idempotency key. Resume its pinned content via `GET /api/learning-runs/{id}`, **not the review list's current-catalog `questions`**. All canonical reviews use runs; new legacy whole-review writes are blocked. Stored legacy replay and supported unversioned fixtures remain compatible. All answers must pass for the once-only 10 XP event; failure completes the run and reschedules using its pinned interval. Familiar review questions are not unseen transfer forms.

Persist each pending key and payload before sending. Retry an uncertain transport result unchanged; changed payload/operation/target under a committed key returns 409. Replay returns the original response, position and XP/profile snapshot before current gates or retired-version resolution. Fetch the owned run and current workflow/profile afterward. A deliberate correction needs a new key. Submitted evidence persists; unsubmitted drafts remain the client's responsibility. Completion-star booleans are state, not award deltas.

Wrong practice answers return 200 and retain the step. Failed exits/reviews return completed runs with `result.passed: false`; a diagnostic has `passed: null`. Malformed input is 422, missing identity 401, ownership/prerequisite failures 403, missing records 404, conflicting keys/skipped steps/incompatible or stale state 409, and unapproved production content 503. Distinguish these from transport failure. New runs retain optional confidence but do not report the legacy Brier summary; neither proves competence.

## Bound simulation

At the final `simulation` step in `m05-l01`, after its knowledge cards, use `POST /api/learning-runs/{id}/simulation` with a key, or GET that route to resume. This is not a normal step-answer payload: finish through `POST /api/learning-runs/{id}/simulation/review` with the dedicated `audit` schema in the [server guide](../server/README.md#bound-m05-l01-simulation). The run's simulation projection identifies its session and policy; the bound-session response supplies the opening-ask unit-price cap.

Use ordinary `/api/simulations/{session_id}` order, advance and cancel commands; they enforce the bound policy too. Every actual order needs a written plan. Orders are optional: this educational case supplies no investment thesis or recommendation. Observe at least ten steps; submit all observed order statuses, filled quantities, limit prices and total fees, reject the fill guarantee, and select a supported reason if there were no orders. Incorrect audits return issue-specific feedback. Echo the latest response’s `observation_token` as well as tick and engine version. Same-tick placement/cancellation changes the token. Missing or stale tokens, stale ticks and incompatible engine versions return 409 before evidence; reload observations and deliberately submit a corrected audit with a new key. Historical committed tokenless audits still replay unchanged. Do not call raw debrief for a bound session (409).

Keep `audited_observation`/`observation_phase: before_finish_cancellation` distinct from finished order states: successful review cancels pending remainders. Fresh post-finish mutations return 409; committed same-key responses still replay. Session-list `learning_run_id` is nullable: use it to return to a bound run instead of treating every session as a sandbox. Never infer rewards from profit, order count or a fill.

Ordinary guided/endless sandbox creation remains `/api/simulations`, gated by modules 1–4/1–9. Render only public observations; seed, source kind and future paths stay private. See [simulation assumptions](simulation-model.md).

## Rewards and activity

Read `GET /api/me/rewards` for `items` with `owned`, `eligible` or `locked` status and current `equipment`. Claim with `POST /api/me/rewards/claims` (`idempotency_key`, `item_id`); equip with `PATCH /api/me/rewards/equipment` (`idempotency_key`, optional `avatar_id`/`title_id`). Omission preserves a slot; explicit null clears it. Only owned items of the matching kind can be equipped. Claims/equipment grant no XP or activity. Reward commands have their own key namespace, separate from learning-run and simulation commands. Replays are original responses, not a request to reapply old equipment. Refresh inventory afterward. Owned retired grants retain their snapshot and evidence.

`GET /api/me/activity` accepts `start_date`/`end_date`: default 30 days, ordered inclusive window at most 366 days. `current_streak_days` and `longest_streak_days` use **all recorded UTC history**, not just displayed days. The basis is rewarded learning days, not logins, bonus completion, claims, equipment or trading. Do not present visual keys as supplied assets or invent a player-level/multiplayer-rank scale.

For changes, update schemas, transport tests and the server guide together. No generated frontend SDK is supplied. Test direct bypass, ownership and replay attempts; browser success alone does not demonstrate server enforcement. Frontend presentation remains the teammate's scope.
