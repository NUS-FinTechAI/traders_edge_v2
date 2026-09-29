# Trader’s Edge

A trading education project with a React/TypeScript frontend and a FastAPI backend.

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

| Important Command | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| `npm run dev`     | Start the Vite development server                               |
| `npm run build`   | Type-check and build the frontend into `client/dist`            |
| `npm run lint`    | Run the client's Oxlint and project's Prettier format checks    |
| `npm run fix`     | Fix front-end lint issues and format this project with Prettier |
