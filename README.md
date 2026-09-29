# Trader’s Edge

A trading education project with a React/TypeScript frontend and a FastAPI backend.

The current frontend is a static, responsive home page. It introduces the project without requiring the API. Routing, authentication, lessons, quizzes, and user progress are reserved for later iterations.

## Setup

Use Node.js 22.12 or newer with npm. From the project root:

```powershell
npm install
npm --prefix client ci
```

The root package provides development commands and Prettier. The client keeps its own dependencies and lockfile; no npm workspace migration is required.

Once the first root install has generated `package-lock.json`, keep that lockfile in version control and use `npm ci` for subsequent clean installs.

## Run and check the frontend

Run these commands from the project root:

| Command                | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                                         |
| `npm run build`        | Type-check and build the frontend into `client/dist`                      |
| `npm run preview`      | Preview the production build after building                               |
| `npm run lint`         | Run the client's Oxlint checks                                            |
| `npm run format`       | Format frontend source, root configuration, and this README with Prettier |
| `npm run format:check` | Check formatting without changing files                                   |

Open the local URL printed by Vite, normally `http://localhost:5173`.

If PowerShell blocks `npm.ps1` due to its execution policy, use `npm.cmd` in place of `npm` (for example, `npm.cmd run lint`). No execution-policy change is needed.

Root linting delegates to the existing client command. Prettier runs from the root with shared configuration; generated files, lockfiles, and the Python server are excluded. These commands do not lint or format Python. Backend tooling can be added separately when needed.

## Frontend structure

```text
client/
  App.tsx                  Shared page layout
  App.css                  Home page and component styles
  index.css                Global styles and theme
  components/
    SiteHeader.tsx
    SiteFooter.tsx
  pages/
    HomePage.tsx
  public/favicon.svg       Brand emblem
```

The page uses native anchor links for its introduction and skip link. There is no router, authentication guard, mock user data, or API call.

## Backend

See [server/README.md](server/README.md) for Python and FastAPI setup. The backend currently exposes only `GET /` and `GET /health`.
