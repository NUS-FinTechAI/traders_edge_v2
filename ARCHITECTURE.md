# Architecture status

Current scaffold: React/TypeScript with Vite in `client/`; FastAPI in `server/app/` exposes `/` and `/health`. The client does not call the API yet. No database, authentication, scoring or simulation is implemented in v2.

The architecture decision follows the v1 audit. The default is to retain v1’s stack unless evidence justifies a change. See [docs/plan.md](docs/plan.md) for the approval gates.
