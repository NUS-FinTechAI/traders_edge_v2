# Performance and usability

Proposed budgets and a local read benchmark. No production-speed or
participant-usability result has been recorded for the game client.

## Budgets

| Boundary             | Proposed budget                                                           | How to measure                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| First useful screen  | Largest Contentful Paint ≤ 2.5 s; initial compressed JavaScript ≤ 160 KiB | Production build, empty cache, 390px, 4× CPU slowdown, 1.6 Mbps down / 750 Kbps up / 150 ms; five runs, report each and the median |
| Interaction feedback | Interaction to Next Paint ≤ 200 ms                                        | Browser trace while answering checks and placing orders; separate network waiting from visible acknowledgement                     |
| Visual stability     | Cumulative Layout Shift ≤ 0.1                                             | Fixed chart and panel sizes; test font load and error transitions                                                                  |
| Authenticated reads  | p95 ≤ 250 ms with 20 concurrent players                                   | Seeded local deployment; record machine, build, database and cache state                                                           |
| Match state poll     | `GET /api/games/{id}?since=` p95 well under the 500 ms tick at 4×         | Server replay of a 40-day, 3-asset, 3-bot match at its last tick, including serialization                                          |

The web-vitals thresholds follow the [published definitions](https://web.dev/articles/vitals)
(read 4 October 2026); the payload, API and lab profiles are project
proposals. Lazy-loaded pages and a dependency-free SVG chart do not by
themselves show the budgets are met. Poll cost grows with match length,
assets, bots and orders because state is replayed on every read; measure it
before raising scenario limits (`ticks` up to 150, 5 assets, 7 bots).

## Local read benchmark

```sh
uv run --project server --extra test --locked python server/tests/benchmark_reads.py
```

It creates a temporary SQLite database and 20 guest profiles, warms each
route five times, then measures 200 reads each of `/api/me`, `/api/campaign`
and `/api/me/collection` at concurrency 20, printing status codes, median,
p95, maximum latency and payload sizes. It runs in-process (no browser,
network, Firebase, PostgreSQL or populated history) and does not cover match
polling.

## First-time tasks

Pilot with five people new to the app and, where possible, to trading. Record
the actual sample and prior experience; five is a planning choice, not
statistical validation. Do not coach. Observe whether each person can:

1. Start Chapter 1 from the home screen (target: 4 of 5 unaided within 15 s).
2. Explain why a level or boss is locked and what opens it.
3. Answer a check question, read the feedback and get a wrong question right
   when it returns.
4. Choose a plan in the briefing and explain the maximum loss.
5. Place a market and a limit order, pause, step one day and find the order's
   status.
6. Explain after a match why they won or lost and what the missions showed.
7. Leave a running match and come back to it.

Log wrong turns, hesitation, accidental taps, perceived delay and each
participant's words. A reviewer role-play finds defects but is not a
participant study.
