# Playable AI challenge verification

Implementation baseline: `f04216d`, on `feat/playable-game-challenges`. The browser now opens explicit briefings, starts and resumes saved daily/practice/chapter challenges, records planned orders, advances observations and saves reflections with the server's frozen profit results. Existing page styling and the chapter map remain in place.

## Browser evidence

Captured on 19 October 2026 UTC with the installed Playwright CLI and Chrome 155.0.8059.80 against the local development API. A separate synthetic guest's prerequisite progress was prepared through real HTTP learning routes in the temporary QA database. This setup is not participant learning evidence.

- [Before, 390px](before-390.png) and [after, 390px](after-390.png): the same Chapter 2 entry-boss dialog gains its functional briefing link. The before page was the root checkout at `8d8e3c7`, whose player-rewards changes do not add challenge routes or boss links; the after page is this isolated branch.
- [Trading, 390px](trading-390.png): observed quotes/history, portfolio, optional full written order plan and execution rules.
- [Daily result, 390px](result-390.png): the server's saved profit leaderboard, actual game rewards, factual decision record and learner reflection. This particular no-order attempt won; it is not a recommended policy or a learning assessment.

The actual practice flow exercised three AI opponents, a partially filled market buy, cancellation retaining filled holdings and the unfilled remainder, an unfilled cancelled limit order, a reserved stop sell, a later market sell and final expiry. Reload retained the exact observation, holdings and orders. A deliberately lost start response created one attempt; reload recovered its original command. A deliberately lost completion response recovered the same frozen result and receipt. The practice result was 7.81 net profit after 0.66 fees, with 20 player XP and no Stocks or premium currency.

The current daily profile completed with no orders, a 0.00 net profit and a factual decision review; the saved first-victory reward was 200 weekly Stocks. A subsequent explicit abandonment had no completion result and disabled the next start until the server's two-hour UTC cooldown. Chapter entry launched and resumed the same attempt from its map. Chapter exit completed with its separate profit result and a return link to the correct chapter. A simulated 503 read error retained recovery controls; retry restored the unchanged saved leaderboard.

At 360, 390, 430 and 768px, the open order form had no document overflow and no visible enabled changed control smaller than 44px. Keyboard navigation showed a 3px visible focus outline. Reduced-motion media and 200% root text-size stress at 390px retained layout. Sampled rendered text contrast was at least 5.73:1. The review corrected one undersized disclosure target and a timezone-sensitive rendering of naive UTC saved timestamps. Normal walkthroughs produced no unexpected console errors; the deliberately aborted requests and simulated 503 produced their expected errors. The existing React Router initial hydration warning remains.

The complete local evidence is in `output/playwright/ai-challenges/qa-manifest.json` in the implementing checkout. Automated checks: 167 client tests, typecheck, Oxlint, scoped Prettier and production build passed. The build retains its existing ineffective dynamic-import warning for `configService`.

The player-rewards route must be integrated before these screens. Human multiplayer navigation is left to its own route integration. Independent review is recorded in the session handoff. Native zoom, screen-reader conformance, beginner usability, content approval, hosted deployment and learning outcomes are outside this evidence.
