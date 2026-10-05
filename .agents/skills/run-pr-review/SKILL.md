---
name: run-pr-review
description: Review a Trader’s Edge pull request for correctness, focused scope, evidence, documentation and required safety/design checks.
---

# Run Pr Review

All repository paths below are relative to the repository root.

Read the PR diff, applicable AGENTS instructions and the contracts for changed areas. Attach an existing PR when reviewing it through the application. Inspect related code only as needed to verify behavior.

Check concrete triggers and failure paths: grading/prerequisites, owner checks, idempotency, migrations, private content/future state and source accuracy where touched. Look for dead controls, unused dependencies, untested material behavior and documentation that overstates implementation. Product UI needs 390px evidence and accessibility/design review; rewards, simulation and financial copy need safety review.

Run the relevant checks or inspect attributable CI evidence. Separate an observed failure from untested deployment/participant claims. Give actionable findings with location, consequence and severity; do not generate cosmetic objections to fill a review.

A clean local run does not replace hosted CI. Merge only within existing authorization after required reviews and CI pass; never force-push a shared branch. Use the existing git identity and concise commit/PR text without attribution trailers. Report remaining limitations honestly even when no blocking diff issue is found.
