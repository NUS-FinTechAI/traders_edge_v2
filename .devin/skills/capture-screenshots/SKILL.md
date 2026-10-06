---
name: capture-screenshots
description: Capture reproducible before-and-after UI evidence using an existing harness and explicitly report unavailable checks.
---

# Capture Screenshots

Use when changed screens need browser evidence; coordinate with the frontend teammate, without redesigning their UI. Paths are repository-relative.

1. Inspect `package.json`, `client/package.json`, existing scripts and `docs/design/review-process.md` for an installed browser harness and its exact invocation. Use only that existing harness; if unavailable, report the blocker and obtain the harness location through an approved handoff. Do not fabricate commands, add dependencies or call retained prototype screenshots fresh evidence.
2. Read the target branch's `README.md` run instructions and verify client/API readiness and same-hostname cookie setup where applicable. Record branch/commit, route, viewport, browser version and fixture/profile setup; exclude private learner data.
3. Capture the same changed flow before and after at 390px, then at 360, 430 and 768px where layout changes matter. Include applicable default, empty, loading, error, locked and success states; label static fixtures separately from live API states.
4. Exercise navigation, missing-answer validation, wrong/correct feedback, retry, resume/reload and return paths separately. Confirm captures show the intended state, not a stale page or a server error.
5. Check keyboard order and visible focus, 44px targets, non-color status, reduced motion and 200% text enlargement. State whether enlargement used native zoom or text-size stress; screenshots alone cannot verify these interactions.
6. Inspect console/page errors, horizontal overflow and unexpected external requests. Use only authorized output paths for selected captures and a compact manifest; if artifacts are out of scope, return evidence in the session handoff instead.
7. Report exact harness invocation, setup, capture locations and observed failures or untested checks. Do not delete old captures or claim screen-reader access, beginner usability, production speed or learning outcomes from image evidence.
