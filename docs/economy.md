# Game currency policy 1

The supplied game brief is the product authority for competitive rewards. This
policy implements its daily victory, login, weekly cosmetic and earned premium
currency mechanics. It supplies explicit initial defaults where the brief leaves
amounts or reset rules open. These defaults are versioned product decisions,
not claims about validated learning outcomes or optimal game balance.

| Event or purchase                            | Initial policy 1                                              |
| -------------------------------------------- | ------------------------------------------------------------- |
| First daily AI victory on a UTC calendar day | 200 Stocks                                                    |
| Daily login claim                            | 20 Stocks and 5 player XP, once per UTC day                   |
| Daily challenge completed                    | 20 player XP, once per UTC day across retries                 |
| Chapter entry or exit boss completed         | 20 player XP, once per chapter and purpose across retries     |
| Practice AI challenge completed              | 20 player XP per completed challenge                          |
| Public ranked multiplayer completed          | 10 player XP; 10 premium for a winner, 5 for another finisher |
| Private lobby or abandoned challenge         | No XP or currency                                             |
| Daily loss or abandonment                    | Two-hour retry cooldown                                       |
| Clear an active daily cooldown               | 10 premium                                                    |
| Weekly Colossal Challenger title             | 1,000 Stocks                                                  |
| Market observer avatar                       | 100 premium                                                   |

Stocks are reward currency. They are separate from tradable share quantities and
each simulation's cash. Premium currency is earned from server-settled public
ranked results; there is no real-money purchase endpoint. Rating changes belong
to the public multiplayer service and cannot be submitted to the economy API.
Learning XP and game XP share the player XP ledger, with game events prefixed
`game:`. Economy rewards never create learning activity days or qualifying
lesson/review evidence. Login streaks are a separate count of consecutive UTC
days on which a login reward was claimed, rather than days on which a trading
order was submitted.

Weeks begin Monday at 00:00 UTC. Unspent Stocks expire at the next Monday;
premium and owned cosmetics persist. A read immediately projects expired Stocks
as zero without writing. The next mutation records the expiry and resets the
stored balance. Old command replays return their original committed response
without granting rewards for a new day or week. A delayed result from an expired
week cannot revive its Stocks. Previously earned daily victory markers remain stored.
The dated daily form must match the actual UTC completion day and current day
to award Stocks. Finishing yesterday's form today awards no Stocks and leaves
today's first-victory opportunity available; daily completion XP uses the actual
completion day. The internal result carries the dated form identifier separately
from the actual completion timestamp.

A two-hour defeat cooldown carries across midnight and weekly reset. Clearing
it consumes premium atomically. Replaying an older successful refresh returns
the original receipt and cannot clear a newer defeat's cooldown. Waiting two
hours costs nothing. Abandoning a daily attempt also triggers the cooldown and
awards nothing, so leaving a losing attempt cannot bypass the retry rules.

The weekly title is retained as an owned item with its earning-week suffix and
snapshot. A later week offers a distinct title grant; the earlier grant remains
usable in the existing inventory and title equipment slot. The premium avatar
is a single permanent grant. Buying an already owned item under a new command
does not debit currency again. Visual keys describe cosmetic identity; artwork
is not supplied by this backend change.

## Transactions and integration

`ServerChallengeResult` is an internal immutable value constructed from the
persisted final result by the challenge or public multiplayer service. It is
never an HTTP request schema. `settle_challenge` runs in the same transaction as
challenge finalization; rolling back finalization also rolls back wallet, event
and XP changes. It stores the exact award response under the server attempt ID
and rejects an altered result for an already settled ID. Private results have
zero rewards. Rank calculation remains in the public matchmaking service.

Mutation routes use the existing authenticated profile transaction lock. Wallet
creation additionally uses an atomic insert and each write locks and refreshes
the account row, covering workers that concurrently encounter a missing wallet.
SQLite mutation transactions use the existing immediate write transaction.
Database constraints prevent negative Stocks, premium or login streak values.
Unique event and command keys protect daily caps and exact request replay;
currency debit, item ownership and command receipts commit together.

The start service must call `daily_can_start` before creating a daily attempt.
After successfully creating it, `consume_daily_refresh` binds a pending paid
refresh receipt to that attempt and clears the pending pointer in the same
transaction. It returns the receipt key for the attempt's research metadata,
or null for an unpaid start. Failed starts leave the receipt available; repeating
the same attempt correlation never consumes a later receipt.
The finish and abandonment services must settle the stored result in their
existing transaction. API routes provide no client-controlled result or credit
operation:

- `GET /api/me/economy`: current wallet and separate login streak.
- `POST /api/me/economy/login-claims`: claim today's login reward.
- `POST /api/me/economy/daily-refresh`: pay to clear an active daily cooldown.
- `GET /api/me/economy/shop`: the finite policy 1 inventory.
- `POST /api/me/economy/shop/purchases`: purchase a known item with earned funds.

Mutation bodies require an idempotency key and accept only policy version `1`.
Shop purchase bodies also require the stable shop ID. Exact committed command
responses are replayed before current-week logic. Keys reused for different
commands return 409. Unknown items return 404; insufficient currency or absent
cooldowns return 409; unrecognized body fields return 422.

This policy does not establish a research rubric, participant privacy lifecycle,
cosmetic artwork, real-money purchases or economic balance evaluation.

Player profiles retain total `xp` and additionally expose `learning_xp`, `game_xp` and `player_level`. Initial player-level policy is level 1 plus one level per 100 total XP. The opt-in learning leaderboard excludes `game:` events, and learning activity/badges retain their original evidence.
