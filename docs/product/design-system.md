# Design system

The [sample UI](../source/Trader_s_Edge_Sample_UI.jpg) fixes the screens and
their content, not their appearance. The owner selects the visual direction;
replacement UI also needs a separate go-ahead after technical and safety
review.

## Visual direction

The default is the night-map style: a dark forest-green base, parchment text
and brass accents, on flat surfaces with 1px borders. No glow, neon, navy,
glass gradients, glowing hexagons or fantasy-map textures. Three alternative
base themes are under review ([issue #99](https://github.com/NUS-FinTechAI/traders_edge_v2/issues/99));
see [base themes](#base-themes).

Base themes in [`client/app/themes.ts`](../../client/app/themes.ts) are the
source of truth for colour; [`client/ui/tokens.css`](../../client/ui/tokens.css)
holds the Night Map values for first paint (a test keeps them in step) and the
scale, type and layout tokens. `client/ui/global.css` holds base styles. Token
roles:

| Group      | Tokens                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Surfaces   | `--bg`, `--bg-elev`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-strong`, `--border-input` |
| Text       | `--text` (parchment), `--text-muted`, `--text-dim`                                                              |
| Action     | `--primary`, `--primary-hover`, `--on-primary`, `--focus` (gold ring)                                           |
| Currencies | `--gold` (Doubloons), `--gem`, `--gem-text` (Gems), `--cash` (sim cash), each with `-soft`                      |
| State      | `--gain`, `--loss`, `--info`, `--warning`, each with `-soft`; `--candle-up`, `--candle-down`                    |
| Edges      | `--gold-line`, `--gem-line`, `--gain-line`, `--loss-line`, `--info-line` (tinted 1px borders)                   |
| On-colour  | `--on-gold`, `--on-gain`, `--on-loss` (text on a solid gold, gain or loss fill)                                 |
| Scale      | `--radius-sm` … `--radius-pill`, `--space-1` … `--space-7` (4–48px), `--text-xs` … `--text-2xl` (12–32px)       |
| Type       | `--font` (system rounded sans), `--font-num` (monospace, tabular prices)                                        |
| Layout     | `--hud-height`, `--nav-height`, `--content-width`, `--shadow`, `--ease`                                         |

Use the semantic names. Add a global token only when independent features
share the role, never for one feature's palette; keep feature styles in the
feature's CSS module. Provider logo colours (for example on sign-in buttons)
are artwork, not theme tokens. Run the theme tests when changing the palette;
they check contrast for every base theme and combination.

## Base themes

Themes stack in three layers, one of each, stored per player on the device:

1. **Base theme** (free) sets every colour token.
2. **Candle theme** (shop) overrides `--candle-up` and `--candle-down` only.
3. **Accessibility palette** (free) adjusts text, borders, gains and losses.

Without a candle theme, candles follow `--gain` and `--loss`, so palettes
recolour them too. A base theme can `adapt` a palette or candle theme where
the stock values would fail on it; Parchment Day does this for all five, and
the dark alternatives swap the high-contrast palette's green-tinted borders
for neutral ones.

**Default.** `DEFAULT_BASE_THEME` in `client/app/themes.ts` names the default.
Changing that one line switches every player who has not chosen a base, and
the tests still pass. Until the script loads, the page shows the
`client/ui/tokens.css` values (Night Map). To avoid that brief flash, copy the
new default's colours there too and point the tokens.css test at that theme.

**Preview by link.** `?theme=<id>` on any URL applies a free theme (a base or
a palette) and saves it as the player's choice once they are signed in. The
parameter is removed from the address bar after it is read. Shop candle
themes cannot be opened this way.

| Theme                                                                        | Direction                                                                            | Key colours (bg · surface · text · primary · gold · gain · loss)                  | Preview (390px and 1280px captures)                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Night Map (classic)](https://traders-edge-v2.vercel.app/?theme=night-map)   | Forest-green night map, parchment text, brass accents                                | `#0d1714` · `#172821` · `#f2ead3` · `#1f7a52` · `#e0b654` · `#46c384` · `#f0705f` | [home](themes/night-map-home-desktop.jpg), [arena](themes/night-map-arena-desktop.jpg), [home 390](themes/night-map-home-mobile.jpg), [arena 390](themes/night-map-arena-mobile.jpg)                         |
| [Midnight Ledger](https://traders-edge-v2.vercel.app/?theme=midnight-ledger) | Desaturated slate surfaces, ivory text, steel-blue actions, gold accents, teal gains | `#101419` · `#1a2029` · `#ede7d8` · `#2a6a96` · `#e2b860` · `#3fc1a5` · `#f07a68` | [home](themes/midnight-ledger-home-desktop.jpg), [arena](themes/midnight-ledger-arena-desktop.jpg), [home 390](themes/midnight-ledger-home-mobile.jpg), [arena 390](themes/midnight-ledger-arena-mobile.jpg) |
| [Parchment Day](https://traders-edge-v2.vercel.app/?theme=parchment-day)     | Light warm paper, ink text, deep teal actions, brass accents                         | `#f3ead9` · `#fffaf1` · `#2a2017` · `#1b6566` · `#87600f` · `#0e5a3d` · `#b83c2b` | [home](themes/parchment-day-home-desktop.jpg), [arena](themes/parchment-day-arena-desktop.jpg), [home 390](themes/parchment-day-home-mobile.jpg), [arena 390](themes/parchment-day-arena-mobile.jpg)         |
| [Harbor Dusk](https://traders-edge-v2.vercel.app/?theme=harbor-dusk)         | Charcoal-plum neutrals, amber actions, yellow-gold currency, coral-rose losses       | `#17131a` · `#231d27` · `#f4eae3` · `#e0903e` · `#f2c66d` · `#4cc3a2` · `#f2738a` | [home](themes/harbor-dusk-home-desktop.jpg), [arena](themes/harbor-dusk-arena-desktop.jpg), [home 390](themes/harbor-dusk-home-mobile.jpg), [arena 390](themes/harbor-dusk-arena-mobile.jpg)                 |

The captures show a guest at level 1, paused on day 4 of the Chapter 1
Preview Battle with one simulated buy, at 1280×800 and 390×844. The preview
links work only once this branch is deployed.

**Measured contrast** (WCAG 2.x ratio; 4.5 for body text, 3 for borders and
focus). `client/tests/theme-contrast.test.ts` checks these pairs and more,
including every base with each palette and candle theme.

| Pair                                       | Night Map | Midnight Ledger | Parchment Day | Harbor Dusk |
| ------------------------------------------ | --------- | --------------- | ------------- | ----------- |
| Text on surface                            | 12.8      | 13.3            | 15.3          | 13.9        |
| Muted text on surface                      | 7.4       | 7.7             | 8.2           | 7.8         |
| Dim text on surface-3                      | 4.7       | 5.1             | 5.2           | 5.2         |
| Primary button label                       | 5.3       | 5.8             | 6.8           | 7.1         |
| Gold text on surface                       | 8.1       | 8.8             | 5.4           | 10.2        |
| Gain text on surface                       | 6.9       | 7.3             | 7.9           | 7.5         |
| Loss text on surface                       | 5.3       | 6.0             | 5.4           | 5.9         |
| Gain chip (gain on gain-soft)              | 5.6       | 6.1             | 6.9           | 6.2         |
| Loss chip (loss on loss-soft)              | 5.1       | 5.4             | 4.7           | 5.3         |
| Input border on surface                    | 4.6       | 4.5             | 4.6           | 4.4         |
| Focus ring (gold) on bg                    | 9.6       | 9.9             | 4.7           | 11.4        |
| Buy label, hard-coded `#06210f` on gain    | 7.6       | 7.6             | **2.1**       | 7.8         |
| Sell label, hard-coded `#2a0905` on loss   | 6.3       | 6.7             | **3.3**       | 6.7         |
| Gold button, hard-coded `#1a1405` on gold  | 9.6       | 9.8             | **3.2**       | 11.4        |
| Gem chip, hard-coded `#c1b0f2` on gem-soft | 7.6       | 7.6             | **1.6**       | 7.6         |

Gains and losses differ in lightness as well as hue on every base (at least
1.15:1 between them), and every gain or loss value keeps its sign and ▲/▼
glyph. The colour-blind palette remains the safe choice for red–green colour
blindness.

**Hard-coded colours that block Parchment Day.** CSS modules still use fixed
colours tuned for dark bases. They look acceptable on the three dark themes
but fail or look wrong on a light one. Each needs the token shown:

| Fixed value                     | Role                            | Replace with                                           | Where                                                                                                                                                                                              |
| ------------------------------- | ------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#06210f`, `#2a0905`            | text on buy and sell fills      | `--on-gain`, `--on-loss`                               | `ui/ui.module.css` (`.buy`, `.sell`), `arena/ticket/TradeTicket.module.css`                                                                                                                        |
| `#5ad295`, `#f5877a`, `#ecc46a` | buy, sell and gold hover fills  | a `-hover` token or `filter: brightness()`             | `ui/ui.module.css`                                                                                                                                                                                 |
| `#1a1405`                       | text on gold fills              | `--on-gold`                                            | `ui/ui.module.css`, `ui/Avatar.module.css`, `ui/Choices.module.css`, `app/AppShell.module.css`, `adventure/ChapterMap.module.css`, `profile/Profile.module.css`, `arena/panels/panels.module.css`  |
| `#0b1410`                       | price-tag text on candle colour | `--on-gain` / `--on-loss`                              | `arena/chart/PriceChart.module.css`                                                                                                                                                                |
| `#5a4b28`                       | gold borders                    | `--gold-line`                                          | `ui/ui.module.css`, `ui/Emblem.module.css`, `app/AppShell.module.css`, `leaderboard`, `profile/Shop`, `arena/briefing`, `play/DailyCard`, `multiplayer/Lobby`                                      |
| `#275a3f`, `#2f6b4b`, `#2f5f45` | gain, success and cash borders  | `--gain-line`                                          | `ui/ui.module.css`, `ui/Choices.module.css`, `ui/Emblem.module.css`, `home/Home.module.css`, `adventure/Adventure.module.css`, `level/Level.module.css`, `profile/Shop.module.css`, `arena/panels` |
| `#6a3029`, `#7a352d`            | loss and error borders          | `--loss-line`                                          | `ui/ui.module.css`, `ui/Choices.module.css`, `ui/Emblem.module.css`, `arena/panels`, `arena/briefing`, `arena/ticket`                                                                              |
| `#2a5466`                       | info borders                    | `--info-line`                                          | `ui/ui.module.css`, `ui/Emblem.module.css`, `arena/briefing`, `arena/trading`, `multiplayer`                                                                                                       |
| `#4a3f73`, `#c1b0f2`            | gem border and gem chip text    | `--gem-line`, `--gem-text`                             | `ui/ui.module.css`, `ui/Emblem.module.css`, `quiz/Quiz.module.css`, `multiplayer`                                                                                                                  |
| `#f2a05a`, `#5c3b1f`, `#34241a` | streak (flame) chip             | new `--flame` tokens, or `--warning`, `--warning-soft` | `ui/ui.module.css`, `ui/Emblem.module.css`                                                                                                                                                         |
| `#ffd0c8` on `#6a3029`          | error callouts                  | `--loss` on `--loss-soft` with `--loss-line`           | `arena/briefing`, `arena/ticket`                                                                                                                                                                   |
| `#1f4a35`, `#2a6b4a`, `#3a9a66` | activity heatmap steps          | `color-mix()` of `--gain` and `--surface`              | `profile/Profile.module.css`                                                                                                                                                                       |
| `#050a08cc`                     | modal and overlay scrim         | acceptable on every base; optionally a `--scrim` token | `ui/ui.module.css`, `arena/trading`                                                                                                                                                                |
| `#d9c39a`, `#b5523f`            | map trail and X mark            | artwork; reads on all four bases                       | `adventure/ChapterMap.module.css`                                                                                                                                                                  |
| chapter accents, avatar art     | artwork colours in TSX          | artwork, not theme tokens                              | `adventure/AdventurePage.tsx`, `ui/Avatar.tsx`, `ui/avatarArt.tsx`                                                                                                                                 |

The new `-line` and `on-` tokens already hold the old fixed values on Night
Map, so this replacement changes nothing on the default theme.

**Recommendation: Midnight Ledger.** It solves the issue's complaint (the
saturated green that colours every surface) while keeping what works:
parchment-ivory text, brass-gold currency and the treasure-map artwork. On
desktop and mobile it reads as a calm trading terminal. Every text pair in the
table measures higher than on Night Map. Primary buttons are steel
blue, which no gain or loss colour uses, so a primary button reads as "next
step" and not as "buy" (Night Map uses the same green for both). It needs no
CSS module changes. The slate is kept desaturated so it does not read as navy,
which the visual direction above rules out; the owner should confirm it
passes that rule. Harbor Dusk is the warmer second choice. Its amber buttons
sit close to the yellow-gold Doubloon colour, so rewards and actions are
harder to tell apart. Parchment Day is the only light option. It should not
become the default until the hard-coded colours above are replaced, because
its buy and sell labels, gold buttons and gem chip fail AA today. Night Map
stays available for players who prefer it.

## Accessibility

Every screen must meet these:

- Gains and losses carry `+`/`−` signs and ▲/▼ glyphs as well as colour.
- Touch targets are at least 44px (stricter than WCAG 2.2 AA).
- Visible focus on every control; non-colour state labels for locks,
  completion and correctness.
- Every animation is disabled under `prefers-reduced-motion`.
- Free colour-blind-safe and high-contrast palettes.

## Copy

Plain explanations of the next action and its outcome; no hype, urgency,
undefined jargon or profitability claims. The fixed safety lines are listed
in [safety and wellbeing](safety-and-wellbeing.md).

## Review criteria

Reject a concept or UI change that fails any blocking criterion; a high score
elsewhere does not cancel a safety or accessibility failure.

| Area          | Blocking                                                                                                                 | Wanted                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Identity      | Generic gradient hero, glass cards, neon glow, copied sample styling, repetitive rounded-card layout                     | A recognisable composition and restrained palette with documented roles        |
| Typography    | Arbitrary weights and sizes; all-caps everywhere                                                                         | A readable hierarchy from the token scale                                      |
| Purpose       | Decorative charts, emoji icons, mixed icon styles, blobs, particles, filler stats                                        | Decoration explains route, status or action                                    |
| Copy          | Hype, urgency, undefined jargon, generic encouragement, profitability claims                                             | Plain next action, outcome and uncertainty                                     |
| Safety        | Volume or trade-count rewards, profit-size badges, trading pressure, order celebration, leverage, copy-trading           | Process badges; profit framed as the match result only; explicit prerequisites |
| Interaction   | Unclear next step, misleading resume, dead controls, hidden locks, unexplained full-screen loading                       | One primary action, honest recovery, useful state explanations                 |
| Accessibility | Contrast below AA, target below 44px, invisible focus, colour-only meaning, inaccessible modal, motion without reduction | Measured contrast, keyboard journey, labelled inputs, 200 % text zoom          |
| Performance   | Unneeded dependencies, network or font blockers, unbounded work                                                          | Profiling against the [budgets](../operations/performance.md)                  |
| Consistency   | One-off spacing, radii or colours; bypassed shared components                                                            | Tokens and `client/ui/` components                                             |
| Evidence      | Invented users or results; screenshots without viewport and state                                                        | Reproducible captures, limitations, resolved findings                          |

**Map-meaning test.** Hide the region names: the Preview Battle, connected
levels, reward nodes and Chapter Boss must still explain the sequence, and
locked nodes must say what opens them. Opening a node shows its task and
prerequisites.

**Learning-loop test.** Walk home → chapter map → level cards → check with a
wrong answer and its retry → briefing → trading → results → updated map
against the real API, including a server rejection and recovery.

## Review process

For each product UI change: verify real state and navigation; capture 390px
before/after evidence (then 360, 430 and 768px where layout changes); check
default, empty, loading, error, locked and success states, keyboard focus,
enlarged text, reduced motion, safety and beginner comprehension. Fix
blockers and recapture. When comparing directions, score identity, hierarchy,
beginner comprehension, map meaning, accessibility and safety from 1 to 5 with
observed evidence; reviewers record disagreements and the design lead the
resolution. An override needs a written reason and cannot waive the safety
rules. Expert review is not participant testing.
