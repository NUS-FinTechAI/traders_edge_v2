---
name: run-pr-review
description: Review a focused pull request for correctness, contract preservation, exact checks and required independent reviews.
---

# Run PR Review

Use for an independent PR review; review does not authorize edits, commits, pushes or merges. Paths and check commands are repository-relative.

1. Read applicable instructions, the diff and affected contracts; record base/head, owned files and acceptance criteria. Inspect current code instead of stale root guides; keep v1 read-only and the existing git identity unchanged.
2. Trace success, rejection and retry/reload for grading, prerequisites, ownership and private keys/futures. Preserve first responses, pinned runs, exact committed replay and legacy evidence. Verify migrations append: migration 3 adds only two run tables; migration 4 adds only two reward tables and two nullable equipment columns without modifying versions 1–3. Exercise populated upgrades and separate reward-command replay/retirement. The SQLite/mocked-Firebase profile tests establish ORM refresh semantics; `test_postgres_integration.py` separately verifies real lock waiting/refresh. Use the guarded disposable database and record actual results/skips. Check current Docker availability and distinguish local container proof from actual Firebase/hosted deployment.
3. Check source accuracy, narrow scope, dead controls, unused dependencies and truthful docs. Investigate changed catalog counts/digests against source proof rather than accepting regenerated expectations. Read the actual review-run, `server/app/rewards.py`, `server/app/simulation/lesson_api.py`, `server/app/simulation/bindings.py` and ordinary simulation contracts/tests: one `m05-l01` binding and finite inventory exist, but other bindings, unseen reviews, Module 9 multi-scenario assessment and artwork remain pending. Shared AI challenges, chapter bosses/daily forms, economy and derived player level have merged contracts in `docs/challenges.md`, `docs/adventure.md` and `docs/economy.md`. Also inspect `docs/quizzes.md`, `docs/multiplayer.md` and `docs/research.md` for host authorization, shared row locks/observation barriers, once-only public ratings/rewards and owned export redaction. Study enrollment must default off; fresh consent must echo the exact configured text digest, and historical replay must preserve withdrawal rather than reenroll. Keep gameplay profit/rank outcomes separate from learning evidence under ADR 0003; verify internal settlement, immutable server forms, fee accounting, cooldown/expiry and no learning-day/badge contamination. Fresh audits require the public `observation_token`; check same-tick placement/cancellation rejection before evidence and historical tokenless committed replay. Preserve dedicated audit versus unchanged `StepAnswer` hashing, pre-finish audit versus cancellation, ordinary-route policy enforcement and replay before fresh gates/retired versions.
4. Run the checks below from the target checkout root, or cite CI results for the exact head. Use a separate environment per worker; if reusing an interpreter, set `PYTHONPATH="$PWD/server:$PWD/server/tests"` explicitly and verify `app.__file__` belongs to this checkout. Never repoint a shared editable installation. Record command, exit status and failures/skips; never convert unavailable tooling into a pass:
   - `npm test`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `uv run --project server --extra test --locked python -m unittest discover -s server/tests`
   - `uv run --project server --extra test --locked python -m app.content.validate`
   - `uv run --project server --extra test --locked python -m unittest app.content.test_catalog`
5. Require safety review for rewards/simulation/copy, independent financial/pedagogical review for content and design/accessibility review with 390px before/after evidence for UI. Frontend visual work remains the teammate's scope; tests do not approve publication or prove learning outcomes.
6. Report actionable findings with file/line, trigger, consequence, severity and missing regression coverage. Use the approved session handoff when `.coordination/` is absent or inaccessible; do not bypass restrictions or claim logs were updated.
7. Separate observed results from untested deployment/participant claims. State unresolved review and CI dependencies even if the diff has no blocking findings; local checks do not replace hosted CI. Do not change git configuration, add attribution, delete files, commit or push as part of review.
