# Performance and beginner usability

Status: proposed product budgets, with a separately scoped local backend measurement below. No production-speed or participant-usability result is claimed.

The owner reports that v1 feels slow and unintuitive. Source inspection suggests possible causes; it does not identify the dominant delay. Treat both speed and task clarity as requirements.

## Budgets and measurement

| Boundary                     | Proposed budget                                                                                           | Reproduction and scope                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| First useful learning screen | Largest Contentful Paint at or below 2.5s; initial compressed JavaScript at most 160KiB                   | Production build, empty browser cache, 390px viewport, 4x CPU slowdown, 1.6Mbps down/750Kbps up/150ms latency; five runs, report every run and median |
| Interaction feedback         | Interaction to Next Paint at or below 200ms; no client task above 50ms during answer selection/navigation | Production browser trace; separately identify network waiting and visible acknowledgement                                                             |
| Visual stability             | Cumulative Layout Shift at or below 0.1                                                                   | Fixed image dimensions, stable feedback slots; test font load and error transitions                                                                   |
| Authenticated learning reads | p95 at or below 250ms with 20 concurrent learners                                                         | Seeded local deployment; record machine, build, database size, cold/warm cache and external identity exclusions                                       |
| Scenario start/resume        | p95 at or below 1s for four assets and 120 ticks of prepared scenario state                               | Server-side prepared/versioned inputs; no live vendor download in learner requests; include serialization and database restoration                    |
| Prototype resources          | No external requests; no installed runtime packages                                                       | Browser request log, source bytes and all three screen/state journeys                                                                                 |

The web-vitals thresholds follow the published definitions; the payload, API, scenario and lab profiles are project proposals. Lab results are not field 75th-percentile evidence. When consented aggregate field samples exist, report 75th-percentile LCP/INP/CLS separately. Do not label the product fast solely from a small static prototype.

## Reproducible local read check

Run `uv run --project server --extra test --locked python server/tests/benchmark_reads.py`. It creates a temporary SQLite database and 20 fresh guest profiles, warms each route five times, then measures 200 reads per endpoint at concurrency 20. It prints all status codes, median/p95/maximum latency and payload sizes, failing if a response is not 200. It does not modify the normal learning database or print guest credentials.

Historical measurement from an integration run on 5 October 2026, arm64/Python 3.12.13, with content edition `2026-10-04.3` before publication. These values are preserved evidence for that run, not a benchmark of the current edition:

| Endpoint           |   Median |      p95 |  Maximum |
| ------------------ | -------: | -------: | -------: |
| `/api/me/profile`  | 40.01 ms | 53.87 ms | 77.05 ms |
| `/api/curriculum`  | 44.34 ms | 61.70 ms | 69.55 ms |
| `/api/me/workflow` | 56.21 ms | 78.43 ms | 83.08 ms |

All 600 responses were 200. These are in-process TestClient measurements: no browser, TCP server, Firebase, PostgreSQL or populated-history load. They do not satisfy the deployment budgets by themselves. A query-amplification regression was corrected from 53 SELECTs for the ten-module workflow to nine observed locally; tests bound it at ten and require equal counts for one and ten modules. A standalone module map does not load private run snapshots. Constant query count does not imply constant row volume or validated large-cohort performance.

## First-time tasks

Run a pilot with five people unfamiliar with the app and, where possible, finance. Record the actual sample and prior experience; five is a planning choice, not statistical validation. Do not coach during the task. Observe:

1. Find and begin the first learning step from the dashboard. Proposed target: 4/5 participants do so unaided within 15 seconds.
2. Explain what a locked checkpoint requires and return to an available one. No participant should infer that a trade or payment unlocks it.
3. Answer a sample question, explain the feedback and revise an incorrect answer. Identify any misunderstood term.
4. Find the explanation of an unfamiliar term without losing the current question.
5. Leave and return to a saved learning step through the frontend connected to the existing learning-run persistence. Compare the learner's expectation with the actual restored state.

Log wrong turns, hesitation, accidental taps, repeated clicks, perceived delay and each participant's words. A reviewer role-play can find defects but must not be reported as a participant study. Resolve blocking confusion before adding more features.

## Engineering implications

Lazy-load charts and simulation screens; keep the learning entry small. Current authenticated API responses use `Cache-Control: no-store`; respect it for lesson and workflow reads as well as learner records. Any future shared/offline lesson cache needs a separate reviewed public-content contract that excludes identity, answers, scenario futures and learner state. Defer network work unrelated to the current task. Use abortable requests, explicit retry states and server idempotency so a retry cannot duplicate rewards/orders.

Measure browser parse/render work, API time, database time and scenario preparation separately. Keep bounded timings and error codes without raw tokens, free-text reflections or market plans in telemetry. Choose one chart library only when the simulation slice needs it.

## Read sources

- [Web Vitals](https://web.dev/articles/vitals): LCP, INP, CLS definitions and field thresholds; read 4 October 2026.
- [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): contrast verification basis; read 4 October 2026.
- [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): WCAG 2.2 minimum criterion. This project deliberately requires 44px targets, a stricter project constraint, rather than mislabelling 44px as the AA minimum.
