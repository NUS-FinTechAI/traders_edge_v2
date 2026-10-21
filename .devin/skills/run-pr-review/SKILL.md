---
name: run-pr-review
description: Review a focused pull request for correctness, contract preservation, exact checks and required independent reviews.
---

# Run PR Review

Use for an independent PR review; review does not authorize edits, commits, pushes or merges. Paths and check commands are repository-relative.

1. Read applicable instructions, the diff and affected contracts; record base/head, owned files and acceptance criteria. Inspect current code instead of stale root guides; keep v1 read-only and the existing git identity unchanged.
2. Trace success, rejection and retry/reload for unlocks, ownership, settlement and hidden future bars/news. Check that repeated `finish` returns the stored result, that each reward uses a natural unique key, that a reused `client_order_id` returns the original order, and that private matches and classroom rooms pay nothing. Verify migrations append (11 = game tables, 12 = progression tables; 1–10 frozen) and exercise populated upgrades. The SQLite/mocked-Firebase profile tests establish ORM refresh semantics; `test_postgres_integration.py` separately verifies real lock waiting/refresh. Use the guarded disposable database and record actual results/skips. Distinguish local container proof from actual Firebase/hosted deployment.
3. Check source accuracy, narrow scope, dead controls, unused dependencies and truthful docs. Read the affected contracts in `docs/game-architecture.md` and the matching code in `server/app/game`, `campaign`, `player`, `quiz`, `multiplayer` and `research.py`. Keep `app/game` free of chapter and currency logic. For content changes, confirm `python -m app.content.validate` passes, scenario `version` was bumped when a market changed, and the balance gauntlet limits in `server/tests/test_game_balance.py` were not loosened. Keep match profit and ranked rating separate from learning claims; the decision score stays labelled unvalidated. Study enrollment must default off; consent must echo the exact configured version and digest; exports must omit the daily shared seed and other players' records. If generated API files changed, `npm run api:check` must pass.
4. Run the checks below from the target checkout root, or cite CI results for the exact head. Use a separate environment per worker; if reusing an interpreter, set `PYTHONPATH="$PWD/server:$PWD/server/tests"` explicitly and verify `app.__file__` belongs to this checkout. Never repoint a shared editable installation. Record command, exit status and failures/skips; never convert unavailable tooling into a pass:
   - `npm test`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npm run api:check`
   - `uv run --project server --extra test --locked python -m unittest discover -s server/tests`
   - `uv run --project server --extra test --locked python -m app.content.validate`
5. Require safety review for rewards/simulation/copy, independent financial/pedagogical review for content and design/accessibility review with 390px before/after evidence for UI. Frontend visual work remains the teammate's scope; tests do not approve publication or prove learning outcomes.
6. Report actionable findings with file/line, trigger, consequence, severity and missing regression coverage. Use the approved session handoff when `.coordination/` is absent or inaccessible; do not bypass restrictions or claim logs were updated.
7. Separate observed results from untested deployment/participant claims. State unresolved review and CI dependencies even if the diff has no blocking findings; local checks do not replace hosted CI. Do not change git configuration, add attribution, delete files, commit or push as part of review.
