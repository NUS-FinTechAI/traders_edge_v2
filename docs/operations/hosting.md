# Hosting on Render, Neon, Vercel and Firebase

One free environment deploys from `master`:

| Piece    | Service                 | Name / setting                                   |
| -------- | ----------------------- | ------------------------------------------------ |
| API      | Render free web service | `traders-edge-api`, Singapore                    |
| Database | Neon free project       | `traders-edge`, AWS Singapore                    |
| Client   | Vercel Hobby project    | `traders-edge-v2` (`traders-edge-v2.vercel.app`) |
| Sign-in  | Firebase Authentication | Google and Email/Password                        |

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
| Neon         | 0.5 GB. Suspends when idle and wakes in about a second on the next query; no expiry.      |
| Vercel Hobby | Non-commercial projects only.                                                             |
| Firebase     | Google and email sign-in are free on the Spark plan.                                      |

## 1. Firebase

1. In the [Firebase console](https://console.firebase.google.com), create a
   project and note its **Project ID** (Project settings → General).
2. **Authentication → Sign-in method**: enable **Google** and
   **Email/Password**.
3. **Authentication → Settings → Authorized domains**: add
   `traders-edge-v2.vercel.app`.
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

## 3. Database on Neon

1. In [Neon](https://neon.tech), create a project named `traders-edge` in
   **AWS Asia Pacific (Singapore)**, region `ap-southeast-1`.
2. Open **Connect**, turn **Connection pooling off**, and copy the
   connection string. The password is already in it:
   `postgresql://<user>:<password>@ep-<id>.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   (it may also end in `&channel_binding=require`, which is fine).
   - Use the direct string, without `-pooler` in the host. The pooled string
     goes through PgBouncer in transaction mode, which breaks the driver's
     prepared statements; the API keeps its own connection pool.
   - In a generated `.env` snippet this is `DATABASE_URL`, not
     `DATABASE_URL_POOLED`.

The API creates its tables on every start, so there is nothing to run by
hand. It pings pooled connections before use, so Neon suspending an idle
database only costs a short wake-up.

## 4. API on Render

1. In Render, choose **New → Blueprint**, select
   `NUS-FinTechAI/traders_edge_v2` on `master`, and apply `render.yaml`. It
   creates one free web service, `traders-edge-api`, in Singapore.
2. Fill in the variables it asks for:

   | Variable                   | Value                                         |
   | -------------------------- | --------------------------------------------- |
   | `DATABASE_URL`             | The Neon direct connection string from step 3 |
   | `ALLOWED_ORIGINS`          | `https://traders-edge-v2.vercel.app`          |
   | `FIREBASE_PROJECT_ID`      | The Firebase Project ID from step 1           |
   | `FIREBASE_SERVICE_ACCOUNT` | The whole service-account JSON, pasted in     |

3. Wait for the service to show **Live** (the logs show the migrations, then
   `Uvicorn running`), and check
   `https://traders-edge-api.onrender.com/health` returns `{"status":"ok"}`.

If Render gives the service a different hostname (because the name is taken),
update the `destination` in `client/vercel.json`.

## 5. Client on Vercel

1. In Vercel, **Add New → Project**, choose the **NUS-FinTechAI** account and
   import `traders_edge_v2`.
2. Project name `traders-edge-v2`; **Root Directory** `client`. Build settings
   come from `client/vercel.json`.
3. Environment variables: `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN` and `VITE_FIREBASE_APP_ID` from step 1.4.
4. **Deploy**, then set **Settings → General → Node.js Version** to 24.x and
   redeploy.
5. Confirm the domain is `traders-edge-v2.vercel.app`. If it differs, update
   `ALLOWED_ORIGINS` on Render and Firebase's authorized domains to match.

## 6. Check the deployment

Open `https://traders-edge-v2.vercel.app`, sign in with Google, claim the daily
streak, play the Chapter 1 Preview Battle and Level 1, reload, and confirm
progress is kept. Repeat the sign-in with email, including **Forgot
password?**.

If sign-in fails, the message points at the setting to check:

| Message                                              | Check                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| "This sign-in method isn’t turned on…"               | Step 1.2: the provider is enabled                                                  |
| "…(Firebase authorized domains)"                     | Step 1.3: the exact site domain is listed                                          |
| "…(Firebase API key)" or "…(API key restrictions)"   | Step 5.3 values, and any website restriction on the key in Google Cloud            |
| "Sign-in could not be verified"                      | `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT` on Render                     |
| "The game server didn’t answer…"                     | Render is awake and `ALLOWED_ORIGINS` lists the exact site origin (a CORS failure) |
| "A permitted request origin is required" (on a save) | `ALLOWED_ORIGINS` lists the exact site origin                                      |
| Any other message with a code in brackets            | Look the code up in the Firebase Authentication error list                         |

Before a demo, open the site a couple of minutes early so Render has woken
up. Every merge to `master`
redeploys Render and Vercel.

## Service logs (Render)

The API logs to stdout/stderr, so Render shows it under the service's
**Logs** tab with no setup. Each line is a startup event or one request:
method, route template, status, duration and a request id. When a player
reports a problem, ask for the `X-Request-ID` response header (browser
dev tools, Network) and search the logs for `rid=<id>`. Set `LOG_LEVEL`
(default `INFO`) to `DEBUG` to include `/health` checks or `WARNING` to
quiet routine requests. Logs hold no cookies, tokens, query strings, bodies,
IP addresses or identities; see
[server logging](../../server/README.md#logging).

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

## Web analytics (Vercel, free)

The production client renders Vercel Web Analytics and Speed Insights once at
the app root (`client/app/WebAnalytics.tsx`); development builds and tests
render nothing. Neither reports anything until you enable it in the Vercel
project:

1. Open the `traders-edge-v2` project, go to **Analytics** and choose
   **Enable**; do the same under **Speed Insights**.
2. Redeploy. Page views then appear in the Analytics tab.

Both are cookieless and carry no personal data: they count page views,
referrers, country, device and browser, and Core Web Vitals, using a
short-lived hash that cannot identify a player and is not kept across days.
The client strips the query string and fragment from every reported URL
(`client/services/analytics.ts`), so join codes and tokens never leave the
browser. Neither SDK sees the signed-in player, their profile or any game
data. The free Hobby plan caps events per month; past the cap Vercel stops
recording until the next month.

Search and link previews: `client/public/` holds `robots.txt`,
`sitemap.xml`, `site.webmanifest`, the icons and `og-image.png` (1200×630,
used by Open Graph and Twitter cards). The sitemap lists only the public
routes (`/`, `/adventure`, `/archive`); add a route there when you make a new
page public. The Vercel rewrite in `client/vercel.json` leaves these files
out of the single-page fallback.

## After the content review

Once the independent financial and teaching review is done, set
`server/app/content/review.json` to `"status": "approved"` and change
`APP_ENV` to `production` in `render.yaml`, in a reviewed PR.

## Enabling the research study

Optional, and only after the study protocol and its consent text have ethics
and privacy approval; configuration does not grant that approval. On the
Render service set:

| Variable                    | Value                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `RESEARCH_ENABLED`          | `true`                                                                                                |
| `RESEARCH_POLICY_VERSION`   | The approved policy version, e.g. `study-2026-1`                                                      |
| `RESEARCH_POLICY_TEXT`      | The exact approved consent text                                                                       |
| `RESEARCH_PSEUDONYM_SECRET` | A random secret of at least 32 characters (`openssl rand -hex 32`)                                    |
| `RESEARCHER_FIREBASE_UIDS`  | Comma-separated Firebase uids of the approved researchers (Firebase console → Authentication → Users) |

Leave them unset otherwise. Changing the policy text requires a new version,
and participants must consent again. Keep the pseudonym secret in Render only
and do not change it during a study, or pseudonyms stop matching earlier
exports. `RESEARCHER_PROFILE_IDS` is for local testing and is ignored in
production. See [research](../reference/research.md#researcher-dashboard) for
what researchers can see.
