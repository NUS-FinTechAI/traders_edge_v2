# Performance and beginner usability

Status: proposed budgets and a reproducible local read check. No current
measurement, production-speed result or participant-usability result is
recorded for the game client.

## Budgets

| Boundary             | Proposed budget                                                                           | Reproduction and scope                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| First useful screen  | Largest Contentful Paint at or below 2.5 s; initial compressed JavaScript at most 160 KiB | Production build, empty cache, 390px viewport, 4× CPU slowdown, 1.6 Mbps down/750 Kbps up/150 ms latency; five runs, report every run and the median |
| Interaction feedback | Interaction to Next Paint at or below 200 ms                                              | Production browser trace while answering checks and placing orders; separate network waiting from visible acknowledgement                            |
| Visual stability     | Cumulative Layout Shift at or below 0.1                                                   | Fixed chart and panel dimensions; test font load and error transitions                                                                               |
| Authenticated reads  | p95 at or below 250 ms with 20 concurrent players                                         | Seeded local deployment; record machine, build, database and cache state                                                                             |
| Match state poll     | `GET /api/games/{id}?since=` p95 well under the 500 ms tick at 4× speed                   | Server-side replay of a 40-day, 3-asset, 3-bot match at its last tick; include serialization                                                         |

The web-vitals thresholds follow the published definitions; the payload, API
and lab profiles are project proposals. Every page is lazy-loaded
(`client/router.tsx`) and the chart is dependency-free SVG, but neither fact
shows that the budgets are met.

Match state is rebuilt from the order log on every poll, so poll cost grows
with match length, asset count, bots and orders. Measure it before raising
scenario limits (`ticks` up to 150, 5 assets, 7 bots).

## Reproducible local read check

```sh
uv run --project server --extra test --locked python server/tests/benchmark_reads.py
```

It creates a temporary SQLite database and 20 guest profiles, warms each route
five times, then measures 200 reads each of `/api/me`, `/api/campaign` and
`/api/me/collection` at concurrency 20. It prints status codes, median, p95
and maximum latency and payload sizes. It runs in-process with FastAPI's test
client: no browser, network, Firebase, PostgreSQL or populated history. It
does not yet cover match polling.

## First-time tasks

Run a pilot with five people new to the app and, where possible, to trading.
Record the actual sample and prior experience; five is a planning choice, not
statistical validation. Do not coach. Observe:

1. From the home screen, start Chapter 1. Proposed target: 4 of 5 do so
   unaided within 15 seconds.
2. Explain why a level or boss is locked and what opens it.
3. Answer a check question, read the feedback and get a wrong question right
   when it returns.
4. In the briefing, choose a plan and explain what the maximum loss means.
5. Place a market order and a limit order, pause, step one day, and find the
   order's status.
6. After a match, explain why they won or lost and what the missions showed.
7. Leave a running match and come back to it.

Log wrong turns, hesitation, accidental taps, perceived delay and each
participant's words. A reviewer role-play can find defects but is not a
participant study.

## Read sources

- [Web Vitals](https://web.dev/articles/vitals): LCP, INP, CLS definitions and
  field thresholds; read 4 October 2026.
- [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html):
  the project's 44px target is stricter than the WCAG 2.2 AA minimum.
