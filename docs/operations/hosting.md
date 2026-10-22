# Hosting on Render, Supabase, Vercel and Firebase

One free environment deploys from `master`:

| Piece    | Service                 | Name / setting                             |
| -------- | ----------------------- | ------------------------------------------ |
| API      | Render free web service | `traders-edge-api`, Singapore              |
| Database | Supabase free project   | `traders-edge`, Singapore                  |
| Client   | Vercel Hobby project    | `traders-edge` (`traders-edge.vercel.app`) |
| Sign-in  | Firebase Authentication | Google and Email/Password                  |

The API runs with `APP_ENV=staging` and `AUTH_MODE=firebase`: hosted on
PostgreSQL over HTTPS, signed in with Firebase, and playable before the
independent content review (the production content gate is off). Vercel
serves the static client and forwards `/api/*` to Render
(`client/vercel.json`), so the browser sees one origin. The `APP_ENV` values
are described in the [server guide](../../server/README.md#configuration).

Free-tier limits that matter:

| Service      | Limit                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------- |
| Render       | Sleeps after about 15 minutes idle; the next request takes about a minute while it wakes. |
| Supabase     | 500 MB. Pauses after 7 days without activity; restore it from the dashboard.              |
| Vercel Hobby | Non-commercial projects only.                                                             |
| Firebase     | Google and email sign-in are free on the Spark plan.                                      |

## 1. Firebase

1. In the [Firebase console](https://console.firebase.google.com), create a
   project and note its **Project ID** (Project settings → General).
2. **Authentication → Sign-in method**: enable **Google** and
   **Email/Password**.
3. **Authentication → Settings → Authorized domains**: add
   `traders-edge.vercel.app`.
4. **Project settings → General → Your apps**: add a **Web** app and copy
   `apiKey`, `authDomain` and `appId`.
5. **Project settings → Service accounts → Generate new private key**:
   download the JSON key. Treat it as a password and never commit it.

## 2. Repository access for Render and Vercel

Both services list only repositories their GitHub app can see. Install each
app on the **NUS-FinTechAI** organisation, choosing `traders_edge_v2`:
<https://github.com/apps/render/installations/new> and
<https://github.com/apps/vercel/installations/new>. An organisation owner must
approve the installation.

## 3. Database on Supabase

1. In [Supabase](https://supabase.com), create a project named
   `traders-edge` in **Southeast Asia (Singapore)** and save its database
   password.
2. Open **Connect → Session pooler** and copy the URI
   (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`),
   replacing `[YOUR-PASSWORD]` with the password. URL-encode `@ : / ? #` if
   the password contains them.
   - Not the **Direct connection**: on the free plan it is IPv6 only, and
     Render cannot reach it.
   - Not the **Transaction pooler** (port 6543): it breaks the driver's
     prepared statements.

The API creates its tables on every start, so there is nothing to run by
hand. Supabase's own auth, storage and REST APIs are not used.

## 4. API on Render

1. In Render, choose **New → Blueprint**, select
   `NUS-FinTechAI/traders_edge_v2` on `master`, and apply `render.yaml`. It
   creates one free web service, `traders-edge-api`, in Singapore.
2. Fill in the variables it asks for:

   | Variable                   | Value                                       |
   | -------------------------- | ------------------------------------------- |
   | `DATABASE_URL`             | The Supabase session pooler URI from step 3 |
   | `ALLOWED_ORIGINS`          | `https://traders-edge.vercel.app`           |
   | `FIREBASE_PROJECT_ID`      | The Firebase Project ID from step 1         |
   | `FIREBASE_SERVICE_ACCOUNT` | The whole service-account JSON, pasted in   |

3. Wait for the service to show **Live** (the logs show the migrations, then
   `Uvicorn running`), and check
   `https://traders-edge-api.onrender.com/health` returns `{"status":"ok"}`.

If Render gives the service a different hostname (because the name is taken),
update the `destination` in `client/vercel.json`.

## 5. Client on Vercel

1. In Vercel, **Add New → Project**, choose the **NUS-FinTechAI** account and
   import `traders_edge_v2`.
2. Project name `traders-edge`; **Root Directory** `client`. Build settings
   come from `client/vercel.json`.
3. Environment variables: `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN` and `VITE_FIREBASE_APP_ID` from step 1.4.
4. **Deploy**, then set **Settings → General → Node.js Version** to 24.x and
   redeploy.
5. Confirm the domain is `traders-edge.vercel.app`. If it differs, update
   `ALLOWED_ORIGINS` on Render and Firebase's authorized domains to match.

## 6. Check the deployment

Open `https://traders-edge.vercel.app`, sign in with Google, claim the daily
streak, play the Chapter 1 Preview Battle and Level 1, reload, and confirm
progress is kept.

Before a demo, open the site a couple of minutes early so Render has woken
up, and check the Supabase project is not paused. Every merge to `master`
redeploys Render and Vercel.

## Error monitoring (Sentry, free)

Optional. Without the variables below nothing is reported and the client
build leaves the Sentry SDK out.

1. Create a free [Sentry](https://sentry.io) organisation (Developer plan)
   with two projects: **FastAPI** (`traders-edge-api`) and **React**
   (`traders-edge-client`). Copy each project's DSN.
2. In the API project's **Settings → Security & Privacy**, turn on
   **Prevent Storing of IP Addresses**; do the same for the client project.
3. Render: set `SENTRY_DSN` to the FastAPI DSN. Events use `APP_ENV` as the
   environment and the deployed commit as the release.
4. Vercel: set `VITE_SENTRY_DSN` to the React DSN (and optionally
   `VITE_SENTRY_ENVIRONMENT`, default `production`). The release is the
   deployed commit.
5. Redeploy both. Vite reads `VITE_*` at build time, so Vercel needs a new
   build.

Reports carry the page or route, stack trace and browser, but no cookies,
`Authorization` header, request bodies, query strings or IP address. The
client sends errors only (no performance tracing or session replay) and the
API samples 10% of requests for performance, to stay within the free
quota.

## After the content review

Once the independent financial and teaching review is done, set
`server/app/content/review.json` to `"status": "approved"` and change
`APP_ENV` to `production` in `render.yaml`, in a reviewed PR.
