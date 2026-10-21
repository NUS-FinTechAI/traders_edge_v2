---
name: safety-review-checklist
description: Review financial copy, rewards, learning gates and simulation changes for concrete safety failures and unsupported claims.
---

# Safety Review Checklist

Use for changes to financial claims, assessment, rewards or simulated actions. Paths are repository-relative.

1. Read the changed code/copy, `docs/game-design.md`, `docs/gamification-and-safety.md`, `docs/economy.md`, `docs/source/traders-edge-supervisor-summary.md` and the relevant contract in `docs/game-architecture.md`. Separate implemented behavior from proposals.
2. Trace success, rejection and retry/reload through the server: ownership, unlocks, hidden future bars/news and idempotent settlement must hold. Ranked requires the Chapter 3 boss and the daily the Chapter 1 boss on the server, not merely in the client.
3. Each match has one plan (strategy and maximum loss) chosen in the briefing; do not reintroduce per-order essays, and do not let the plan be skipped for solo matches. Order types must be enabled only after they are taught. The ticket's risk-if-stopped line must not promise a guaranteed maximum loss: stop-losses fill at the stop or a worse open.
4. Apply the game design document and ADR 0004: profit decides matches and may pay its win reward. Reject trade-count or volume rewards, profit-size badges, leverage, shorting, copy-trading, one-swipe execution, order confetti, urgent alerts, countdown timers, flashing prices and loss-chasing or streak-loss pressure. News stays in a calm feed. Rewards must identify their basis (login, match result, ranked play, process badge). Never claim profit or the decision score establishes competence.
5. Check that fees and the spread still make random clicking lose: the balance gauntlet must pass without loosened limits. Check that private lobbies and classroom quiz rooms pay nothing, that Gems are never sold for real money, and that the login streak has no penalty.
6. Verify changed factual claims against primary sources, arithmetic and jurisdiction scope; keep local legal rules in reviewed localization. Require independent financial/pedagogical review before release; note that no production approval gate exists for content yet.
7. Report each finding with file/line, trigger, consequence, severity and required retest. Use the approved session handoff when `.coordination/` is absent or inaccessible; do not bypass ignored-path restrictions or claim a persistent review log was updated.
8. Block material safety failures until resolved and retested. A narrow review cannot certify the whole product, profitable learners, effective pedagogy or scenario/reward behavior beyond what was inspected. SQLite/mocked-Firebase profile-refresh tests are not live PostgreSQL locking evidence; report unavailable deployment checks.
