---
name: write-adr
description: Record a durable architecture or product decision with real alternatives, source evidence, status and consequences.
---

# Write ADR

Use when a durable tradeoff needs a decision record, not a task diary. Paths are repository-relative; write documentation only within the task's authorized scope.

1. Read `docs/source/traders-edge-supervisor-summary.md` and nearby `docs/decisions/` records. Confirm the target branch/commit and inspect current code/contracts; historical proposals are not proof of shipped behavior.
2. Identify the concrete decision trigger and observable acceptance criteria. Declare affected ownership and dependencies; coordinate frontend visual decisions with the teammate and keep v1 read-only.
3. Choose the next unused numbered filename in `docs/decisions/`; do not renumber, delete or silently rewrite historical decisions. If a new ADR is not authorized, provide its proposed content in the session handoff instead.
4. Write a concise status, Context, Options, Decision (or Proposal), Consequences and Evidence. Include only alternatives actually considered and code/source references that support the tradeoff; do not invent citations, consensus or independent review.
5. Distinguish proposed, selected, implemented and reviewed states. Routine backend decisions can proceed within existing authorization. Owner visual selection and a separate product-UI implementation go-ahead remain required; safety, content and design reviews are separate gates.
6. State compatibility, reversibility, migration impact and unresolved dependencies where relevant. Preserve one modular backend, existing attempts/progress/rewards and appended migrations; broader target diagrams do not authorize new runtime abstractions.
7. Link the record from the maintained contract only if that edit is authorized. Keep rationale in one place; avoid generic process essays and boilerplate promises.
8. Hand off the decision, evidence, consequences and pending review. When `.coordination/` is absent or inaccessible, use the approved session handoff without bypassing ignored paths or claiming persistent logs were updated; keep the existing git identity and add no attribution trailers.
