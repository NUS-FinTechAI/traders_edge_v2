# Client

The React 19, TypeScript and Vite web client. Folder layout and data flow are
in [ARCHITECTURE.md](../ARCHITECTURE.md#client); visual rules are in the
[design system](../docs/product/design-system.md).

## Run and verify

Node.js 24+, from the repository root, with the API running as described in
the [server guide](../server/README.md):

```sh
npm ci
npm --prefix client ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

The dev server is at `http://localhost:5173` and talks to the API on port
8000 of the same hostname. Local development uses guest sessions, so no
Firebase project is needed.

## Configuration

Copy `.env.example` to `.env.local` only to override defaults. It documents
the backend origin, the Firebase web-app settings for hosted sign-in and
optional Sentry reporting. Firebase values here are public client
identifiers; never put Admin credentials in client configuration.

## Working in the client

- Add a page under `features/<area>/` and register it in `router.tsx`, which
  lazy-loads every page. Pages that need a player use `authGuard`.
- Call the API through a module in `services/`, which uses the typed
  `apiClient` and the generated definitions in `api/`. After a backend schema
  change, run `npm run api:generate` and commit the result; CI runs
  `npm run api:check`.
- Build screens from the primitives in `ui/` and the tokens in
  `ui/tokens.css`. Keep 44px targets, visible focus, reduced motion and text
  labels for every coloured state.
- Put testable logic in plain functions and cover them in `tests/` with
  `node:test`. Mock services at the HTTP boundary, never the behaviour under
  test.
