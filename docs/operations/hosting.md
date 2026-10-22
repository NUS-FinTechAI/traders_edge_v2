# Hosting on Render, Supabase and Vercel

Everything runs on free tiers. Two environments deploy from `master`:

| Environment          | Who it is for                  | Sign-in                  | Content gate                                 | API (Render)               | Database (Supabase)       | Client (Vercel)        |
| -------------------- | ------------------------------ | ------------------------ | -------------------------------------------- | -------------------------- | ------------------------- | ---------------------- |
| Staging (guest demo) | Supervisor demos, user testing | One-click guest          | Off                                          | `traders-edge-api-staging` | `traders-edge-staging`    | `traders-edge-staging` |
| Production           | Real accounts                  | Firebase (Google, email) | On until `content/review.json` is `approved` | `traders-edge-api`         | `traders-edge-production` | `traders-edge`         |

Vercel serves the static client and forwards `/api/*` to Render
(`client/vercel.json`). The browser sees one origin, so the guest session
cookie stays first-party and no CORS is involved. Both API services build the
same [container image](deployment.md#container-image); the `APP_ENV` values
are described in the [server guide](../../server/README.md#configuration).

| Service               | Free tier limits that matter                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Render web service    | Sleeps after about 15 minutes idle; the next request takes about a minute while it wakes.                      |
| Supabase PostgreSQL   | Two free projects, 500 MB each. A project pauses after 7 days without activity; restore it from the dashboard. |
| Vercel Hobby          | Non-commercial projects only.                                                                                  |
| Firebase Auth (Spark) | Google and email sign-in are free.                                                                             |

## 0. Give Render and Vercel access to the repository

Both services list only repositories their GitHub app can see. Install each
app on the **NUS-FinTechAI** organisation (an organisation owner must approve
it): <https://github.com/apps/render/installations/new> and
<https://github.com/apps/vercel/installations/new>, choosing
`traders_edge_v2`.

## 1. Firebase (production sign-in)

1. In the [Firebase console](https://console.firebase.google.com), add a
   project and note its **Project ID**.
2. **Authentication → Sign-in method**: enable **Google** and
   **Email/Password**.
3. **Authentication → Settings → Authorized domains**: add
   `traders-edge.vercel.app`.
4. **Project settings → General → Your apps**: add a **Web** app and copy
   `apiKey`, `authDomain` and `appId`.
5. **Project settings → Service accounts → Generate new private key**:
   download the JSON key. Treat it as a password and never commit it.

Staging does not use Firebase.

## 2. Databases on Supabase

1. In [Supabase](https://supabase.com), create two projects in **Southeast
   Asia (Singapore)**: `traders-edge-staging` and `traders-edge-production`.
   Save each database password.
2. In each project, open **Connect** and copy the **Session pooler**
   connection string
   (`postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`),
   replacing `[YOUR-PASSWORD]` with that project's password.
   - Do not use the **Direct connection**: on the free plan it is IPv6 only,
     and Render cannot reach it.
   - Do not use the **Transaction pooler** (port 6543): it breaks the
     driver's prepared statements.

The API accepts the `postgresql://` form and creates its tables on every
start, so there is nothing to run by hand. Supabase's own APIs (auth,
storage, REST) are not used.

## 3. API on Render

1. In Render, choose **New → Blueprint**, select
   `NUS-FinTechAI/traders_edge_v2` on `master`, and apply `render.yaml`. It
   creates two free web services in the `singapore` region.
2. Fill in the variables the blueprint asks for:

   | Service                    | Variable                   | Value                                     |
   | -------------------------- | -------------------------- | ----------------------------------------- |
   | `traders-edge-api-staging` | `DATABASE_URL`             | Supabase staging session pooler string    |
   | `traders-edge-api-staging` | `ALLOWED_ORIGINS`          | `https://traders-edge-staging.vercel.app` |
   | `traders-edge-api`         | `DATABASE_URL`             | Supabase production session pooler string |
   | `traders-edge-api`         | `ALLOWED_ORIGINS`          | `https://traders-edge.vercel.app`         |
   | `traders-edge-api`         | `FIREBASE_PROJECT_ID`      | Firebase Project ID                       |
   | `traders-edge-api`         | `FIREBASE_SERVICE_ACCOUNT` | The whole service-account JSON, pasted in |

3. Wait for both services to show **Live**, then check
   `https://<service>.onrender.com/health` returns `{"status":"ok"}`.

If Render gives a service a different hostname (because the name is taken),
update the matching `destination` in `client/vercel.json`. Render cannot move
a service to another region after it is created, so change `region` in
`render.yaml` before applying if needed.

## 4. Client on Vercel

Import the repository twice, both times with **Root Directory** `client` and
**Node.js Version** 24.x (Settings → General). Build settings come from
`client/vercel.json`.

1. `traders-edge-staging`: no environment variables.
2. `traders-edge`: set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`
   and `VITE_FIREBASE_APP_ID` from step 1.4.

`vercel.json` routes `/api/*` to the staging API only for requests to
`traders-edge-staging.vercel.app`; every other host, including preview
deployments, goes to the production API. If a project gets a different
domain, update the `host` value, that service's `ALLOWED_ORIGINS` and (for
production) Firebase's authorized domains.

## 5. Check a deployment

- Staging: open `https://traders-edge-staging.vercel.app`, press **Play
  now**, finish Level 1, reload, and confirm progress is kept.
- Production: sign in with Google and confirm the profile loads. Gameplay
  returns "Game content is awaiting independent review" until the content is
  approved.

Before a demo, open the staging site a couple of minutes early so the Render
service has woken up, and check that the Supabase project is not paused.

## Open production gameplay

After the independent financial and teaching review, set
`server/app/content/review.json` to `"status": "approved"` in a reviewed PR.
Render and Vercel redeploy on merge.
