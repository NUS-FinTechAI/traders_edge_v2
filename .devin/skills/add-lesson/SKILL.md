---
name: add-lesson
description: Add or revise campaign levels, lesson cards, check questions or quiz items with source evidence and review gates.
---

# Add Lesson

Use when a level, its cards, its check or a quiz item needs authoring or correction. Paths are repository-relative; verify the target branch's code rather than a stale guide.

1. Read `docs/content/authoring.md`, `docs/content/curriculum-spec.md`, `server/app/campaign/content.py`, `server/app/quiz/bank.py`, `server/app/content/validate.py` and the affected `server/app/content/campaign/ch<N>.json` or `quiz_bank.json`.
2. State the level's objective and the one concept its practice mission tests. Read a supporting primary source and record it in the handoff; keep regional rules out of the neutral core and v1 discovery material read-only.
3. Extend the existing JSON only: chapter files hold exactly 5 levels, each with objectives, terms, cards (optional `visual` key from `client/features/level/visuals/`), check questions (`mc` or `true_false`, one `answer`, a one-line `explanation`) and a `practice` scenario id. Quiz items add `chapter`, `concepts` and `difficulty` and must not repeat a check prompt.
4. Keep stable level, question and scenario ids for existing meanings; progress, first answers and stars are stored against them. Supply useful misconception-based distractors and spread correct answers across positions. Check arithmetic by hand.
5. If the practice mission changes, follow the add-scenario-pack workflow and bump the scenario `version`.
6. Mark the change as needing independent financial/pedagogical review. Validation is not approval; only a recorded review may set `server/app/content/review.json` to `approved`.
7. Run from the target checkout root with a separate environment per worker. If reusing an interpreter, set `PYTHONPATH="$PWD/server:$PWD/server/tests"` explicitly and verify `app.__file__` belongs to this checkout; never repoint a shared editable installation. Run:
   - `uv run --project server --extra test --locked python -m app.content.validate`
   - `uv run --project server --extra test --locked python -m unittest discover -s server/tests`
8. Play the level in the client (cards, check with a wrong answer, practice mission). Hand off changed ids, sources, checks run and pending review.
