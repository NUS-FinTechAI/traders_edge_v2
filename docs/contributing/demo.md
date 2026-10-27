# Local demo

Use this walkthrough to inspect the game or prepare a demonstration from a
fresh checkout. It exercises the existing application without Firebase,
brokerage credentials, external market data or a model API. The opponents
labelled AI in the interface use deterministic trading rules.

This is a development demo. Independent financial and pedagogical content
review remains pending, and production blocks gameplay until approved review
is recorded. Do not change `review.json` to get a hosted demo working. See
[release readiness](../open-source/release-readiness.md) for the remaining
release decisions.

## Start the application

Follow the [README quick start](../../README.md#quick-start) from the repository
root. The defaults use development mode, guest sessions and SQLite. Existing
environment variables can override these; see the
[server settings](../../server/README.md#configuration).

Open `http://localhost:5173` and keep both terminals running. The API is at
`http://localhost:8000`; `/health` checks the API response and `/docs` shows the API.
Use `localhost` for both browser and API requests. No `.env` file is needed
for the default local setup.

Select **Play now**. A guest profile is stored on the server and accessed
through this browser's cookie. Refreshing the page should preserve that
profile. Clearing the cookie or using another browser creates a separate
guest; it does not erase the previous profile from the database.

## Try a practice match

1. Open `http://localhost:5173/play/practice`. Select **Start** on **Trend Rider**.
2. Read the market briefing, missions, rivals, starting cash, fees and spread.
   Choose a strategy and a maximum loss, then select **Start trading**.
3. On a first solo match, follow the tutorial. It pauses the market and includes
   an opportunity to buy a few shares. Use **Tutorial** to revisit it later.
4. Select a stock, place a small market buy and inspect its fill in the trade
   activity and the changed cash and holdings. On a phone, **Buy** opens the
   order ticket. Fees and the spread mean profit need not begin at zero.
5. Use **Pause** and **Next day** to inspect a new candle. Compare the account,
   rivals, missions and news. Future candles and news should not be visible.
6. Resume with **Play** and select 4× speed to reach the final day. Results
   should show profit, standings, missions and a plan review. Winning is not
   required to complete this walkthrough.
7. Open **Play hub** and return to practice to start another match. A new match
   gets a new seed, so prices and the winner can differ.

The plan's loss limit is used for feedback; it does not automatically close
positions. A profitable result, mission completion or discipline score does
not establish learning. See [match rules](../reference/matches.md) and the
[engine](../reference/engine.md) for execution and scoring details.

## Follow the lesson loop

1. Open **Adventure**, then Chapter 1. Select **Preview Battle** and **Start
   battle**. Choose a plan and play through the final day without forfeiting.
   Its result records a starting point; it cannot be failed.
2. Return to the map. Level 1 should now be available. Select it, then **Start
   lesson**, and read the cards.
3. Complete the check. For a review demonstration, answer one question
   incorrectly, read the explanation and answer it correctly when it returns.
   The completion screen records first-try answers separately.
4. Select **Next: trading mission**, then **Start trading mission**. Follow the
   briefing and missions through settlement, then inspect the map's stars.
   The normal star depends on the mission criteria, so it is not guaranteed.

Later levels require the preceding level's normal star. Daily challenge and
ranked matchmaking have progression requirements; they are not the shortest
routes through a fresh-profile demo.

## Try a classroom activity

Use two browser profiles, or a regular and private browser window, at the same
local URL. Sign into a guest session in each. Two tabs in the same profile
share a guest cookie and do not represent two players.

For a private trading match, open `/multiplayer` in both. In the first window,
choose a market, leave AI rivals at **None**, and select **Create lobby**. In
the second, enter the six-character code and select **Join lobby**. The host
can start once two players have joined. Both should enter the same market and
see the shared clock and profit standings. Private matches award no XP or
ranked rating.

For a class quiz, open `/quiz/classroom` in the first window, select **Create
a room**, enter a name and choose Chapter 1. Share the room's code with the
second window, then join there and complete the quiz. The host's results
should update as the participant finishes. Classroom quizzes award no XP;
participants see their own results and the host can see the room's results.

Use fictional names and non-sensitive reflections for public demonstrations.
This walkthrough does not verify real-account research access, retention or
account deletion.

## Check the experience

Record the commit, browser, viewport and actual observations when presenting
demo evidence. At 390px and on desktop, check that the next action, paused
state, order status, rejection reason and result are understandable. Use the
keyboard to navigate, open and close dialogs, and confirm visible focus.
Also check reduced motion and enlarged text. Theme contrast tests are useful
but do not establish that every browser interaction is accessible.

Run the [README checks](../../README.md#checks) before submitting a change.
Client tests, backend tests and content validation are separate commands.

## Troubleshooting

| Symptom                                                          | Check                                                                                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page reports that the server cannot be reached               | Confirm that Uvicorn is running and `http://localhost:8000/health` responds. Check `VITE_BACKEND_URL` if set; it must be an HTTP(S) origin without a path. |
| Guest sign-in succeeds but protected pages ask for sign-in again | Use the same hostname for frontend and API. Avoid mixing `localhost` and `127.0.0.1`. Restart Vite after changing client environment settings.             |
| Vite starts on a port other than 5173                            | Free port 5173, or set `ALLOWED_ORIGINS` to the actual frontend origin and restart the API.                                                                |
| The login page offers Firebase instead of guest play             | Check `APP_ENV` and `AUTH_MODE` in the API environment. The documented local demo uses development defaults.                                               |
| Gameplay returns 503 about content review                        | Check the environment. Production intentionally refuses unapproved content; arrange review before a production release.                                    |
| Level 1 is locked                                                | Complete the Chapter 1 Preview Battle through its final day without forfeiting.                                                                            |
| Both classroom windows show the same player                      | Use separate browser profiles or a private window so the guest cookies are separate.                                                                       |

## Hosting a fork

Follow the [deployment guide](../operations/deployment.md) for a hosted
environment. Review the project URLs in `client/index.html`,
`client/public/robots.txt` and `client/public/sitemap.xml`, plus the application
name and icons in `client/public/site.webmanifest`, before publishing a fork.
These currently identify the project's deployment.

Production builds include Vercel Web Analytics and Speed Insights. The shared
hook removes query strings and fragments from reported URLs; review these
integrations and the host's privacy disclosures for your deployment. Sentry
error reporting is optional and enabled by a DSN. See
[error monitoring](../../server/README.md#error-monitoring) and
`client/.env.example` for its configuration. A local guest demo does not
verify the behavior or privacy of a deployed service.
