# Changelog

## Unreleased

### Historical foundations through `8098856`

- Establish the React/TypeScript setup client, FastAPI service and build/check workflow; the HTTP service is tested but the setup screen does not call it.
- Add guest sessions, Firebase verification, SQLAlchemy persistence and ordered migrations.
- Persist server-graded learning, prerequisites, once-only XP, delayed reviews, journals, consent and an opt-in learning leaderboard.
- Add deterministic, owned, mastery-gated simulation with written order plans, friction, hidden futures and exact command replay.
- Author the ten-module foundations-first catalog, pending independent content approval. Preserve the source brief, screen reference and v1 audit evidence; design references are not a shipped product.

### Merged backend additions (#24–30)

- Add diagnostic, required/optional, exit and delayed-review runs, workflow/maps and owned step resume. Edition `2026-10-04.4`, schema 1, has 30 entries, 97 required steps (one simulation), 30 bonuses and 50 exits; the 60 legacy practice questions remain familiar review material.
- Freeze first diagnostic/exit/review answers and withhold feedback until completion. Remove generic essays from canonical review runs, block new whole-review bypasses, retain stored replay and unversioned fixture compatibility. Failed reviews reschedule using their pinned interval; passing awards `review:<lesson>` XP once.
- Bind only `m05-l01` to a graded simulation audit after knowledge cards. Enforce constrained optional NORTH buy limits through ordinary routes; preserve per-order plans, reasoned no-order success, observed-state audit feedback and exact replay. Require the latest public observation token for new audits, including same-tick changes; preserve committed tokenless replay and historical `StepAnswer` hashes. Do not reward profit, fills or order count.
- Add six finite, versioned code-policy reward items, owned/eligible/locked inventory, claims, avatar/title equipment and UTC activity calendar/streaks. Claims/equipment create no XP or activity; retired owned grants retain their snapshots.
- Migration 3 adds only run/command tables. Migration 4 adds only reward grants/commands and two nullable profile equipment columns; migrations 1–3 remain unchanged. The upgrade regression seeds all 14 prior data tables and compares every original column and full rowset after upgrade and repeat migration.
- Refresh mutation profiles at locked load with `populate_existing=True`. Regression coverage demonstrates ORM refresh semantics with SQLite and mocked Firebase, not live PostgreSQL locking.
- Preserve command namespaces, ownership, hidden state, current/pinned publication gates and historical responses. Verification on 5 October 2026 passed 131 backend, 22 catalog and five frontend HTTP-service tests plus lint, typecheck and build. These checks do not certify deployment or learning outcomes.

### Supplied gameplay brief and local database verification (#36–40)

- Adopt the supplied gameplay brief through ADR 0003, preserving both source documents and separating game profit outcomes from learning evidence.
- Add persistent shared synthetic challenges against simulated opponents, net-profit results, versioned private state and exact command replay.
- Add separate game currency, UTC login rewards, weekly Stocks expiry, premium accounting, cooldown refresh and a finite cosmetic shop. Profiles expose learning/game XP and a derived player level.
- Connect common daily forms, chapter entry/exit boss fights and earned chapter access without inventing earlier mastery or changing general guided/endless prerequisites.
- Add guarded live PostgreSQL tests and a locked container build with explicit migrations. PostgreSQL 16 transactions and local production-configured startup passed on 6 October 2026; real Firebase sign-in and hosted deployment remain unverified.

### Supplementary and classroom quizzes (#43)

- Add finite standalone forms and private instructor rooms, server-configured instructor authority, sequential pinned attempts, frozen first answers and feedback withheld until completion.
- Grant a once-only standalone quiz game-XP reward for each form/edition; private classroom quizzes grant no XP or currency. Migration 8 appends quiz rooms, members, attempts and command receipts.

### Shared multiplayer and owned evidence (#44–45)

- Add shared private code lobbies and public paired matchmaking, host controls, ready barriers, stale-tick rejection, frozen profit results and once-only Elo settlement. Private matches grant no XP/currency/rating; public finishers receive transactional game rewards. Migration 9 appends six multiplayer tables.
- Add paginated owner-scoped learning-run, learning-attempt and AI-challenge exports without private keys/futures/peer plans. Study enrollment defaults off and requires configured policy/version, exact consent-text digest, recorded acceptance and withdrawal; analytics consent remains separate. Migration 10 appends metadata and receipts.
- Runtime verification on 6 October 2026 passed 277 backend tests including 51 live PostgreSQL cases, 22 catalog tests and 14 frontend service tests. The rebuilt local production-configured API matches the tested application files, uses migrations 1–10 and runs as user 10001. This is local proof, not real Firebase/cloud release or learner-outcome evidence.

### Documentation maintenance and limits

- Update server/client workflow, assessment, rewards, simulation, persistence and authoring/review skills against the merged backend contracts. PR #31 merges the source-backed inventory and teaching documentation; mappings and proposals do not establish a complete port or independent financial/pedagogical approval.
- Other lesson bindings, Module 9 multi-scenario assessment, news/tutorials, unfamiliar review forms, advanced execution, artwork, full account deletion/retention, researcher access and validated learning rubrics remain pending; this is not a full v1 port.
- Frontend visual design belongs to the teammate; PR #22 remains open and its dirty work is preserved. Live PostgreSQL and local container evidence are recorded in `docs/deployment.md`. Actual Firebase/cloud deployment, independent content approval and learning-efficacy evidence remain separate.
