# Changelog

## Unreleased

### Service logging

- Add API logging for Render: a `LOG_LEVEL` setting (default `INFO`), single-line startup and migration events, and a request line with method, route template, status, duration and an `X-Request-ID` that is also returned as a response header. Logs carry no cookies, tokens, query strings, bodies, IP addresses or identities.

### Level check

- Fix a spurious "Answer every question correctly before finishing the check" error after a fully correct check: the client sent the completion request twice and the server rejected the second.

### Research instruments

- Add a versioned prior-knowledge instrument (four self-report items and a ten-item unscored concept pre-quiz) offered once, skippably, only to participants with active study consent; migration 13 stores responses with a score-band group and times new first check answers.
- Add a researcher dashboard (`/research`, `/api/research/*`) for a server allow-list: participants, groups, funnel, Preview-vs-Boss comparison by first and all attempts, decision-score trends, check and quiz accuracy, and streamed CSV exports under HMAC pseudonyms, limited to records made under active consent. All learning metrics are labelled unvalidated.
- Add the study consent panel to the profile.

### First-match arena tour

- Add a skippable coach-mark tour of the briefing and trading screens (`client/features/arena/tour/`). It starts by itself on a profile's first solo match, never in multiplayer, and replays from "How to play" in the arena top bar. It pauses a running solo clock and resumes it when it ends, includes an optional "buy a few shares" step, and stores completion per profile in `localStorage` (once per page session when storage is blocked).

### Documentation restructure

- Split the build contract (`docs/game-architecture.md`) and the overlapping topic docs into one reference doc per topic under `docs/reference/` (engine, matches, progression, multiplayer, quizzes, API, data model, research, design decisions), with an index at `docs/README.md`.
- Group the rest by purpose: `docs/product/` (safety and wellbeing, design system), `docs/content/` (authoring guide, curriculum spec, sources) and `docs/operations/` (deployment, performance).
- Merge the economy page into progression, the evaluation plan into research, localization into safety, and the design review notes into the design system.
- Remove historical material that no longer describes the product: the v1 audit, design prototypes and studies, QA placeholders and the agent workflow files. Git history keeps them.
- Make `CONTRIBUTING.md` the contributor guide and shorten `AGENTS.md` and the server guide.
- Correct stale statements: production already refuses gameplay until `content/review.json` is approved, the client applies themes and palettes, lobbies add default AI opponents to `mp-*` markets, private lobbies have no prerequisite, and the quiz bank is version `2026-10-21.1`.

### Playable game overhaul (`9db44ce`)

- Replace the learning-run, observation and challenge backend and the old client with a real-time trading game. [ADR 0004](docs/decisions/0004-playable-game-overhaul.md) records the decision; the [game design document](docs/game-design.md) governs gameplay.
- Add the trading engine (`server/app/game`): seeded markets with news, market/limit/stop-loss orders with fees and a spread, 24 AI opponents across 8 strategies, live missions, a server-owned clock with pause, next-day stepping and 1×/2×/4× speed, state rebuilt from the order log on each read, results with key moments and an unvalidated decision score, and a Monte-Carlo balance gauntlet for bosses and dailies.
- Add the campaign (`server/app/campaign`): 8 chapters × 5 levels with lesson cards, checks and trading missions, Preview, Gate and Chapter bosses, stars, unlocks and the weekday daily challenge with a cooldown and Gem refresh.
- Add the player economy (`server/app/player`): XP and levels, Doubloons and Gems, a 7-day login cycle, cosmetics, 16 process badges, a shop and opt-in leaderboards.
- Add quizzes and classroom rooms (`server/app/quiz`), private lobbies, ranked matchmaking and Elo (`server/app/multiplayer`), and research exports of game events, campaign progress and quiz attempts.
- Migration 11 adds the game tables and migration 12 the campaign, quiz, lobby and rating tables. Migrations 1–10 stay frozen; most of their tables are no longer used.
- Author 64 scenarios, 160 quiz questions and 73 cosmetics, pending independent financial and pedagogical review.
- Build a new React client: home, adventure map, lesson and check flow with interactive visuals, trading arena, play hub, quizzes, multiplayer, profile, shop, leaderboards and archive, with services bound to the generated API types.
- Local checks at `9db44ce`: 249 backend tests passed (15 PostgreSQL tests skipped without a database URL) and content validation passed.

### Learning-run system (removed by the overhaul)

- Foundations: React/TypeScript client, FastAPI service, guest sessions, Firebase verification, SQLAlchemy persistence and ordered migrations (1).
- A ten-module catalog with diagnostic, lesson, exit and delayed-review runs, server grading, once-only XP and a bound simulation audit with written per-order plans and exact command replay (migrations 2–3).
- Finite learning rewards, avatar and title equipment and a UTC activity calendar (migration 4).
- Shared AI challenges, chapter boss fights, daily challenges and a separate game economy with weekly and premium currencies (migrations 5–7), following the supplied gameplay brief ([ADR 0003](docs/decisions/0003-gameplay-brief-authority.md)).
- Standalone and classroom quizzes (migration 8), private lobbies and public matchmaking with Elo (migration 9), and owner-scoped evidence exports with default-off study consent (migration 10).
- A locked container build and live PostgreSQL tests; PostgreSQL 16 and a local production-configured start passed on 6 October 2026.
