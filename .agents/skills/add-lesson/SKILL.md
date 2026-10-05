---
name: add-lesson
description: Add or revise a Trader’s Edge lesson or question in the canonical curriculum, including sources, prerequisites and validation.
---

# Add Lesson

All repository paths below are relative to the repository root.

Read `docs/curriculum/README.md`, `docs/curriculum/sources.md` and the relevant entries in `server/app/content/catalog.json`. Preserve the ten-module source order; the current validator permits three or four lessons and two or three practice questions per lesson.

1. State one observable learning objective and read a primary source supporting the concept. Keep jurisdiction-specific rules outside the core. Record its source ID, URL, reading date and scope.
2. Author explanation, worked example, prediction, guided decision, feedback, reflection, delayed-review prompt and mastery connection using the nine-string cycle contract. Before module 5, use readiness/allocation decisions rather than order execution.
3. Give each question one unambiguous correct option, useful distractors and an explanation. Mark critical risk errors privately. Keep IDs stable for existing meanings; check stored-attempt implications before changing one.
4. Update sequential prerequisites and the module check where the objective requires it. Never put answer-key objects or hidden scenario outcomes inside public cycle strings.
5. Run `uv run --project server --locked python -m app.content.validate` and `uv run --project server --locked python -m unittest app.content.test_catalog`. Recheck arithmetic and every answer choice manually.
6. Keep authored content pending independent accuracy review. Update the source traceability and request review of changed claims; passing a schema test does not establish financial correctness.
