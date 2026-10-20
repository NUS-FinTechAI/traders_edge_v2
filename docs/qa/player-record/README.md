# Player record verification

Scope: the typed wallet, collection, shop and review reads in `1405c1e`, followed by the `/player` browser flow. The preserved home design is extended with a player-record link. This does not approve content publication or establish hosted deployment.

Acceptance: the player can claim login rewards, claim/equip/unequip eligible collectibles, explicitly confirm a purchase or cooldown refresh, recover an uncertain request with its original choice/key, and start/resume/view an owned delayed review. Learning XP, game XP and spending remain distinct. Failed section reads remain retryable without hiding successfully loaded sections.

## Live checks

- A fresh guest claimed the daily login reward: 20 Stocks and 5 game XP. Reload retained the grant and disabled a second claim that UTC day.
- An account with four completed foundation checks claimed/equipped the Compass avatar and Foundations complete title. A deliberately dropped committed claim response remained pending across reload; confirmation recovered the original receipt. Reload during equipment submission also recovered without a duplicate grant or XP.
- Explicit purchase confirmations showed the exact currency and cost. Buying Market observer and the weekly Colossal Challenger title retained both items after reload. The weekly progress remained collected after spending its Stocks. A 10-premium refresh removed the active daily cooldown without granting XP.
- One due review launched from `/player`, withheld answer feedback until both questions finished, awarded 10 learning XP, and exposed the First review badge for claiming. A second tab's Reload player record fetched the current profile and showed 470 learning XP with game XP unchanged at 60. Reopening and reloading the completed review retained the result.
- The purchase/refresh walkthrough used explicitly labelled disposable database fixtures: 1,000 Stocks, 110 premium and an active cooldown, plus one review's due date moved into the past. The balance was not earned through play; no XP, mastery or reward inventory was seeded. Separate daily/public-match verification covers actual game rewards.

## Independent review and checks

Independent code, simulation/reward-copy and rendered design/accessibility review resolved an account-switch race, stale profile totals on reload and a small Shop anchor. All player reads/commands guard the current owner; uncertain commands remain with their original account. Confirmation and recovery notices receive visible keyboard focus.

- 167 client tests pass, including 14 player-service scenarios for recovery, rejection, partial reads, unavailable storage and account changes and same-owner cross-tab overlap. Browsers without Web Locks reject mutations before saving or sending a request.
- Type checks, lint, formatting and production build pass. The existing ineffective dynamic import build warning remains.
- 334 combined backend tests pass, including all 51 live PostgreSQL integration tests against the guarded disposable PostgreSQL 16 database. Catalog validation and 22 catalog tests pass.
- Browser widths 360, 390, 430 and 768 have no horizontal document overflow or enabled targets smaller than 44px. Visible focus is 3px; 200% root text stress did not overflow. These sampled checks do not constitute a full screen-reader audit.

## Captures

- [Before: existing home at 390px](before-home-390.png), captured at the challenge slice's `f04216d` baseline. The player record did not exist there; this is not a fabricated before version of the new page.
- [Player record at 390px](after-390.png).
- [Uncertain command recovery at 390px](pending-390.png).
- [Completed delayed review at 390px](review-result-390.png).

Raw captures and temporary walkthrough scripts remain ignored under `output/playwright/player/` and the host temporary directory. No authentication state is included in these tracked captures.
