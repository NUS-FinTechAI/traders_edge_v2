# 0002: Proposed stack and mobile delivery

Status: proposed; technical/safety review and implementation approval pending.

## Context

V1 uses React/TypeScript, FastAPI, PostgreSQL and Firebase identity. V2 already builds with React/TypeScript/Vite and FastAPI. The audit found dense desktop UI/state coupling, synchronous request-path I/O, process-local sessions and live-at-play market downloads. The owner reports slow and unintuitive use.

## Options

Retain the stack with new domain boundaries; build native clients alongside the backend; or replace both frontend and backend frameworks. Native clients introduce another delivery/testing surface before the beginner journey is validated. Replacing frameworks alone does not resolve the observed contract problems.

## Proposal

Retain React/TypeScript/Vite, FastAPI, PostgreSQL and Firebase identity. Deliver a responsive web app first, with installable PWA metadata later. Only versioned public reading content may become offline-readable; authoritative assessment, rewards and order execution remain online. Native clients are deferred until a measured web limitation warrants them.

Keep one modular backend deployment initially. Separate pure simulation/scoring/progression functions from transport and persistence. Use PostgreSQL transactions for attempts, idempotent reward grants, plans and session events. Use ordered SQL migrations with version recording; never rely on initialization SQL for upgrades. Replace psycopg2 request-path use with an async PostgreSQL access boundary using psycopg3 and a bounded async pool. Do not change databases or introduce a message broker without a demonstrated need.

Keep Firebase UID as the identity reference; do not duplicate authentication passwords. Application profiles use a pseudonym and explicit visibility settings. Public leaderboards are opt-in and process-based. Firebase project/hosting choices and credential provisioning remain deployment decisions, not values to invent in source.

Simulation inputs are versioned controlled packs prepared before sessions. Future events, answer keys and RNG seeds remain server-private until an authorized debrief. Persist command/event sequence and snapshot version so interruption does not silently restart a scenario. Multiplayer comes last and shares the same domain rules and mastery policy.

## Consequences

Existing language/framework knowledge and useful tests remain relevant, but v1 runtime implementations are not copied wholesale. More explicit contracts, migration tests and privacy boundaries are necessary. An installable app does not imply offline trading or mastery. Performance must meet the proposed [budgets](../performance-and-usability.md) through measured loading/data work, not framework claims.

## Evidence

The [discovery summary](../v1-audit/summary.md) documents code evidence. [Psycopg asynchronous operations](https://www.psycopg.org/psycopg3/docs/advanced/async.html) documents the async connection/cursor interface and concurrency considerations; read 4 October 2026. This is a proposed library boundary, not an installed dependency or verified migration.
