# Hosting on Render and Vercel

Two environments run from `master`:

| Environment          | Who it is for                  | Sign-in                  | Content gate                                 | API (Render)               | Client (Vercel)        |
| -------------------- | ------------------------------ | ------------------------ | -------------------------------------------- | -------------------------- | ---------------------- |
| Staging (guest demo) | Supervisor demos, user testing | One-click guest          | Off                                          | `traders-edge-api-staging` | `traders-edge-staging` |
| Production           | Real accounts                  | Firebase (Google, email) | On until `content/review.json` is `approved` | `traders-edge-api`         | `traders-edge`         |

Vercel serves the static client and forwards `/api/*` to Render
(`client/vercel.json`). The browser sees one origin, so the guest session
cookie stays first-party and no CORS is involved. Both API services build the
same [container image](deployment.md#container-image); the `APP_ENV` values
are described in the [server guide](../../server/README.md#configuration).

## 1. API and database on Render

1. In Render, choose **New → Blueprint**, connect
   `NUS-FinTechAI/traders_edge_v2`, and apply `render.yaml`. It creates both
   web services and both PostgreSQL databases.
2. Set the variables the blueprint marks `sync: false`:
   - Staging `ALLOWED_ORIGINS`: `https://traders-edge-staging.vercel.app`
   - Production `ALLOWED_ORIGINS`: `https://traders-edge.vercel.app`
   - Production `FIREBASE_PROJECT_ID`: your Firebase project ID.
3. Production only: in the service's **Secret Files**, add
   `firebase-service-account.json` with a Firebase service-account key
   (Project settings → Service accounts → Generate new private key). The
   server checks revoked tokens, which needs these credentials. Never commit
   the key.
4. Deploy. Each start runs `python -m app.db` (migrations) and then the API.
   Check `https://<service>.onrender.com/health` returns `{"status":"ok"}`.

If Render gives a service a different hostname (because the name is taken),
update the matching `destination` in `client/vercel.json`.

Plans and cost: the staging service and database use Render's free plan. Free
web services sleep when idle (the first request after a pause takes about a
minute) and free databases expire after 30 days. Production uses the
`starter` web plan and `basic-256mb` database, which are paid; change the
plans in `render.yaml` before applying if you want something else.

## 2. Client on Vercel

Create two Vercel projects from the same repository, both with **Root
Directory** `client` (framework preset Vite is detected from
`client/vercel.json`):

1. `traders-edge-staging`: no environment variables needed (guest mode).
2. `traders-edge` (production): set `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN` and `VITE_FIREBASE_APP_ID` from the Firebase
   web-app settings (see `client/.env.example`).

`vercel.json` routes `/api/*` to the staging API only for requests to
`traders-edge-staging.vercel.app`; every other host, including preview
deployments, goes to the production API. If you rename the staging project,
update the `host` value.

## 3. Firebase (production)

In the Firebase console: enable **Google** and **Email/Password** sign-in,
and add `traders-edge.vercel.app` to **Authorized domains**.

## 4. Open production gameplay

Production returns 503 for gameplay until the content has an independent
financial and teaching review. After that review, set
`server/app/content/review.json` to `"status": "approved"` in a reviewed PR;
Render redeploys on merge.

## Check a deployment

- `GET /health` on the Render service returns `ok`.
- Staging: open the Vercel URL, press **Play now**, finish Level 1, reload,
  and confirm progress is kept.
- Production: sign in with Google, confirm `GET /api/me` succeeds, and sign
  out.

Record the date, commit, and results of these checks in the PR that changes
deployment settings.
