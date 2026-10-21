# API guide

Run the service and open `/docs` for the generated schemas. The
[server guide](../server/README.md) lists every route and the configuration;
the [build contract](game-architecture.md#api) has the payload shapes. This
page explains how the client uses them.

## Session and requests

- Use one hostname for the client and the API, send credentials, and send an
  allowed `Origin` on every mutation. In guest mode, `POST /api/session` sets
  the cookie; in Firebase mode, send `Authorization: Bearer <ID token>`.
- `GET /api/config` tells the client which auth mode is active before sign-in.
- Responses are `Cache-Control: no-store`. Keep tokens out of URLs and logs.
- Client services (`client/services/*.ts`) call `httpService.request` with the
  types generated from the backend schema into `client/api/`. After changing a
  response model, run `npm run api:generate` and commit the generated files;
  CI fails on stale output (`npm run api:check`).

## Playing a match

1. `POST /api/games` with a mode (`level`, `boss`, `daily`, `practice`) and
   the ids that mode needs. The server chooses the scenario and checks unlocks
   (403 with a reason when locked; 409 during a daily cooldown).
2. Show the briefing from the returned state, then `POST /api/games/{id}/start`
   with the plan.
3. Poll `GET /api/games/{id}?since=<last bar tick>` and merge the new bars and
   news. Schedule the next poll from `next_tick_at` and `server_time`, not the
   device clock; poll slowly while paused.
4. Place orders with `POST /api/games/{id}/orders`. Generate a fresh
   `client_order_id` (8–64 characters) per order and resend the same id on a
   network retry: a repeat returns the original order, while the same id with
   different fields returns 409. A rejected order returns 422 with a `detail`
   sentence to show the player.
5. Cancel with `DELETE /api/games/{id}/orders/{order_id}`. Solo clock controls
   use `POST /api/games/{id}/clock`.
6. After the last day (`status: ended`), call `POST /api/games/{id}/finish`.
   Repeating it returns the stored result; sending a `reflection` later adds it
   once. `forfeit: true` ends the match early with no win.
7. `GET /api/games?status=active` lists matches to resume.

The start, clock, order and cancel responses include the full public state, so
the client can render it without waiting for the next poll.

## Campaign, player and other areas

- Campaign: read `GET /api/campaign`, the chapter map and the level; answer
  check questions one at a time and call `check/complete` when every question
  is right. The `next` field on `/api/campaign` drives the Continue button.
- Player: `GET /api/me` for the HUD (level, wallet, streak, unlocks),
  `POST /api/me/daily-login` once per day, `GET /api/me/collection`,
  `GET /api/shop` and `POST /api/shop/purchase`.
- Daily: `GET /api/daily` for the card, `POST /api/daily/refresh` to skip a
  cooldown with Gems.
- Quizzes, lobbies and matchmaking: see [quizzes](quizzes.md) and
  [multiplayer](multiplayer.md). Poll lobbies and the queue every 2 s while
  waiting.

## Errors

401 means no valid session; 403 a locked feature; 404 an unknown or foreign
record; 409 a state conflict (match not running, cooldown, first quiz answer
already given, reused order id); 413 a body over 64 KiB; 422 invalid input or a
rejected order. A 409 with "A concurrent update completed first" is safe to
retry with the same request.
