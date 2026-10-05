---
name: capture-screenshots
description: Capture reproducible browser evidence for changed Trader’s Edge screens and states, including mobile and enlarged-text checks.
---

# Capture Screenshots

All repository paths below are relative to the repository root.

Use the repository’s existing browser harness if present; otherwise use the available browser automation tool against a local development server. Read the current client/API run instructions. Do not invent a screenshot command that is not installed.

1. Record branch/commit, route, viewport, browser version and test setup. Use clearly labeled fixtures or a dedicated local test profile; do not publish private learner data.
2. Capture the changed flow at 390px before and after, plus 360/430px and a tablet where layout changes matter. Include applicable empty, loading, error, locked and success states. Do not represent a static query-state prototype as a live request test.
3. Exercise keyboard focus, missing-answer validation, wrong/correct feedback and retry separately. Enlarge text and inspect collisions; say whether this was native zoom or a text-size stress procedure.
4. Check console/page errors, horizontal overflow and unexpected external requests. Preserve meaningful retained captures and a compact manifest with source identity and findings; avoid committing redundant image matrices.
5. State limits: screenshots do not establish screen-reader access, beginner usability, production speed or learning outcomes. Keep unresolved findings visible for review.
