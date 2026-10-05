# API guide

Run the service and open `/docs` for the generated endpoint and payload reference. [server/README.md](../server/README.md) is the maintained setup, endpoint and configuration guide; this page explains client responsibilities rather than duplicating its tables.

Use one hostname for the browser and API in local development. Guest requests include credentials; state-changing requests require an allowed origin. Firebase mode uses a verified bearer token instead of guest creation. Keep credentials out of URLs and logs. API responses use `Cache-Control: no-store`.

Fetch `/api/curriculum` for authoritative lesson availability, progress and practice eligibility. Fetch a lesson only when its prerequisites are met. Submit exactly one answer per returned question with a new idempotency key and reflection. Retry an uncertain transport result with the same key and unchanged payload; using that key for a different submission returns 409. Do not derive grades, XP or unlocks in the client.

A valid but incorrect learning submission returns 200 with `passed: false` and explanation feedback. Malformed or incomplete input returns 422; missing identity returns 401; ownership or prerequisite failures return403; missing records return404. Production content awaiting approval returns 503. Distinguish those states from network failures and preserve the learner’s draft where possible.

Answer keys, critical flags and private future scenario data do not belong in initial responses. Lesson worked examples are intentionally solved public teaching material. Reflection is recorded but not semantically assessed; optional confidence produces an attempt-level probability-accuracy summary, not a competence label. A practice-eligibility flag is an authorization condition, not proof that a mode’s complete experience has shipped.

Simulation sessions are created through `/api/simulations` with `mode: guided` or `endless` and an idempotency key. Resume by session ID; orders, advancement, cancellation and debrief are separate commands. A written order plan supplies reason, risk, reconsideration condition, size reasoning and a positive planned loss boundary. The server selects the private scenario and seed. Retries use the same command key and unchanged payload, and clients render only the returned public observations. See the generated schema and [simulation model](simulation-model.md) for fields and assumptions.

For endpoint changes, update the transport tests, generated models and server guide together. Preserve owner checks, publication gates, complete-answer validation and idempotency. Browser success alone cannot demonstrate server enforcement; test direct requests that attempt to skip prerequisites, reuse request keys or access another learner’s records.
