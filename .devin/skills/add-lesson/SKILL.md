---
name: add-lesson
description: Add or revise canonical interactive lessons, diagnostics, practice tasks or bonus tasks with source evidence and review gates.
---

# Add Lesson

Use when a lesson or assessment item needs authoring or correction. Paths are repository-relative; verify the target branch's code rather than a stale setup guide.

1. Read `docs/curriculum/README.md`, `docs/curriculum/sources.md`, `server/README.md`, `server/app/content/validate.py` and the affected `catalog.json` entries in that directory. The reviewed backend catalog edition is `2026-10-04.4`, schema 1: 30 entries, 97 required steps (one simulation), 30 bonuses and 50 exits. Verify counts against code rather than treating this guide as release evidence.
2. State the observable objective, prerequisite and source basis; read the supporting primary source and record its ID, URL, reading date and scope. Keep regional rules outside the neutral core and v1 discovery material read-only.
3. Extend the canonical catalog only: module `entry_tasks`, lesson `tasks` and optional `bonus_tasks`. Use `instruction` with a worked example plus graded `choice`/`classification` practice; entry and bonus tasks are graded, not instruction-only. Preserve the nine-string cycle and legacy questions without replacing decision practice with generic routine essays.
4. Preserve stable module, lesson and task IDs for existing meanings and the ten-module prerequisite order. Supply unambiguous keys, useful distractors, critical-risk flags and explanatory feedback; manually check arithmetic and classifications. Quiz choices never submit trades or require order plans.
5. Keep diagnostic, exit and review correctness/explanations withheld until each form completes; first answers freeze, and wrong diagnostics still permit teaching. Reviews require due/uncompleted ownership, all-correct passing and pinned failure intervals; resume pinned runs rather than current catalog questions. Keep practice feedback immediate, bonuses optional and answer keys private.
6. Inspect `server/app/learning_runs.py` and its tests before changing meanings/versions: retain first responses, retries, pinned history and replay before fresh gates. For the one bound `m05-l01` simulation step, also read `server/app/simulation/lesson_api.py`, `server/app/simulation/bindings.py`, ordinary routes and bound tests. Fresh audits must echo the public `observation_token`; same-tick order placement/cancellation invalidates it before first evidence is recorded. Preserve committed historical tokenless replay, dedicated audit versus unchanged `StepAnswer` hashing, prior plans for actual orders and verified no-order reasons; do not generalize this binding to other lessons. Do not rewrite old attempts or fabricate baseline/bonus evidence.
7. Keep changed catalog/module/lesson content `authored_requires_independent_review`; obtain independent financial/pedagogical review and retain the production publication gate. Validation is not approval.
8. Run from the target checkout root with a separate environment for each worker. If reusing an interpreter, set `PYTHONPATH="$PWD/server:$PWD/server/tests"` explicitly and verify `app.__file__` belongs to this checkout; never repoint a shared editable installation. Run:
   - `uv run --project server --extra test --locked python -m app.content.validate`
   - `uv run --project server --extra test --locked python -m unittest app.content.test_catalog`
   - `uv run --project server --extra test --locked python -m unittest discover -s server/tests`
9. Investigate count or preserved-question digest failures against source evidence; change expected counts/digests only for an intentional, justified contract change, never to silence a regression. Hand off changed IDs, source proof, checks and pending review.
