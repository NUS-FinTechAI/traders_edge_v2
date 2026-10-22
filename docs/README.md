# Documentation

The [game design document](game-design.md) governs gameplay. Reference docs
describe current behaviour, one topic each; when a doc and the code disagree,
the code wins and the doc needs fixing. Start with
[ARCHITECTURE.md](../ARCHITECTURE.md) for the system overview and the
[server guide](../server/README.md) for running and configuring the API.

## Product

- [Game design document](game-design.md): the owner's gameplay requirements.
- [Safety and wellbeing](product/safety-and-wellbeing.md): reward and pressure rules, localization limits.
- [Design system](product/design-system.md): visual direction, tokens, accessibility and design review.

## Reference

- [Engine](reference/engine.md): market model, execution, clock, bots, missions, results, balance gauntlet.
- [Matches](reference/matches.md): modes, lifecycle, bosses, daily challenge, practice, settlement.
- [Progression](reference/progression.md): campaign, unlocks, XP and ranks, currencies, streak, shop, badges.
- [Multiplayer](reference/multiplayer.md): lobbies, ranked matchmaking, ranked rewards, Elo.
- [Quizzes](reference/quizzes.md): topics, attempts, classroom rooms.
- [API](reference/api.md): conventions, errors, every endpoint, game state.
- [Data model](reference/data-model.md): tables by migration, legacy tables, migrations.
- [Research](reference/research.md): recorded data, exports, study consent, prior-knowledge instrument, researcher dashboard, evaluation plan.
- [Design decisions](reference/decisions.md): answers to the design document's open questions (§12).

## Content

- [Authoring guide](content/authoring.md): content formats, validation, balance and review.
- [Curriculum spec](content/curriculum-spec.md): chapter-by-chapter design source.
- [Source register](content/sources.md): investor-education sources read for the earlier catalog.

## Operations

- [Hosting guide](operations/hosting.md): one free deployment on Render, Neon, Vercel and Firebase.
- [Deployment](operations/deployment.md): container image, Compose stack, client build, live PostgreSQL tests.
- [Performance](operations/performance.md): budgets, local benchmark, first-time usability tasks.

## Decisions

- [ADR 0001](decisions/0001-learning-authority-and-safety.md): learning authority and safety (partly superseded).
- [ADR 0002](decisions/0002-proposed-stack-and-delivery.md): proposed stack and mobile delivery.
- [ADR 0003](decisions/0003-gameplay-brief-authority.md): gameplay brief authority (partly superseded).
- [ADR 0004](decisions/0004-playable-game-overhaul.md): playable game overhaul (current).

## Source documents

- [Supervisor summary](source/traders-edge-supervisor-summary.md) and
  [sample UI](source/Trader_s_Edge_Sample_UI.jpg): the owner's original
  inputs, kept verbatim.
