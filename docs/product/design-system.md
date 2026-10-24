# Design system

The [sample UI](../source/Trader_s_Edge_Sample_UI.jpg) fixes the screens and
their content, not their appearance. The owner selects the visual direction;
replacement UI also needs a separate go-ahead after technical and safety
review.

## Visual direction

The default is Midnight Ledger: desaturated slate surfaces, ivory text, gold
accents and teal gains, on flat surfaces with 1px borders. No glow, neon, navy,
glass gradients, glowing hexagons or fantasy-map textures. Parchment Day and
Harbor Dusk are alternative base themes; see [base themes](#base-themes). The
earlier forest-green Night Map theme was retired.

Base themes in [`client/app/themes.ts`](../../client/app/themes.ts) are the
source of truth for colour; [`client/ui/tokens.css`](../../client/ui/tokens.css)
holds the Midnight Ledger values for first paint (a test keeps them in step) and the
scale, type and layout tokens. `client/ui/global.css` holds base styles. Token
roles:

| Group      | Tokens                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Surfaces   | `--bg`, `--bg-elev`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-strong`, `--border-input` |
| Text       | `--text` (ivory), `--text-muted`, `--text-dim`                                                                  |
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
the dark bases swap the high-contrast palette's green-tinted borders for
neutral ones.

**Default.** `DEFAULT_BASE_THEME` in `client/app/themes.ts` names the default.
Changing that one line switches every player who has not chosen a base, and
the tests still pass. Until the script loads, the page shows the
`client/ui/tokens.css` values (Midnight Ledger). To avoid that brief flash, copy the
new default's colours there too and point the tokens.css test at that theme.

A player who saved the retired `night-map` id, or an unknown id, falls back to
the default. Shop and server data hold no base theme ids, so nothing is
migrated.

**Preview by link.** `?theme=<id>` on any URL applies a free theme (a base or
a palette) and saves it as the player's choice once they are signed in. The
parameter is removed from the address bar after it is read. Shop candle
themes cannot be opened this way.

| Theme                                                                        | Direction                                                                            | Key colours (bg · surface · text · primary · gold · gain · loss)                  | Preview (390px and 1280px captures)                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Midnight Ledger](https://traders-edge-v2.vercel.app/?theme=midnight-ledger) | Desaturated slate surfaces, ivory text, steel-blue actions, gold accents, teal gains | `#101419` · `#1a2029` · `#ede7d8` · `#2a6a96` · `#e2b860` · `#3fc1a5` · `#f07a68` | [home](themes/midnight-ledger-home-desktop.jpg), [arena](themes/midnight-ledger-arena-desktop.jpg), [home 390](themes/midnight-ledger-home-mobile.jpg), [arena 390](themes/midnight-ledger-arena-mobile.jpg) |
| [Parchment Day](https://traders-edge-v2.vercel.app/?theme=parchment-day)     | Light warm paper, ink text, deep teal actions, brass accents                         | `#f3ead9` · `#fffaf1` · `#2a2017` · `#1b6566` · `#87600f` · `#0e5a3d` · `#b83c2b` | [home](themes/parchment-day-home-desktop.jpg), [arena](themes/parchment-day-arena-desktop.jpg), [home 390](themes/parchment-day-home-mobile.jpg), [arena 390](themes/parchment-day-arena-mobile.jpg)         |
| [Harbor Dusk](https://traders-edge-v2.vercel.app/?theme=harbor-dusk)         | Charcoal-plum neutrals, amber actions, yellow-gold currency, coral-rose losses       | `#17131a` · `#231d27` · `#f4eae3` · `#e0903e` · `#f2c66d` · `#4cc3a2` · `#f2738a` | [home](themes/harbor-dusk-home-desktop.jpg), [arena](themes/harbor-dusk-arena-desktop.jpg), [home 390](themes/harbor-dusk-home-mobile.jpg), [arena 390](themes/harbor-dusk-arena-mobile.jpg)                 |

The captures show a guest at level 1, paused on day 4 of the Chapter 1
Preview Battle with one simulated buy, at 1280×800 and 390×844. The preview
links work only once this branch is deployed.

**Measured contrast** (WCAG 2.x ratio; 4.5 for body text, 3 for borders and
focus). `client/tests/theme-contrast.test.ts` checks these pairs and more,
including every base with each palette and candle theme.

| Pair                          | Midnight Ledger | Parchment Day | Harbor Dusk |
| ----------------------------- | --------------- | ------------- | ----------- |
| Text on surface               | 13.3            | 15.3          | 13.9        |
| Muted text on surface         | 7.7             | 8.2           | 7.8         |
| Dim text on surface-3         | 5.1             | 5.2           | 5.2         |
| Primary button label          | 5.8             | 6.8           | 7.1         |
| Gold text on surface          | 8.8             | 5.4           | 10.2        |
| Gain text on surface          | 7.3             | 7.9           | 7.5         |
| Loss text on surface          | 6.0             | 5.4           | 5.9         |
| Gain chip (gain on gain-soft) | 6.1             | 6.9           | 6.2         |
| Loss chip (loss on loss-soft) | 5.4             | 4.7           | 5.3         |
| Input border on surface       | 4.5             | 4.6           | 4.4         |
| Focus ring (gold) on bg       | 9.9             | 4.7           | 11.4        |

Gains and losses differ in lightness as well as hue on every base (at least
1.15:1 between them), and every gain or loss value keeps its sign and ▲/▼
glyph. The colour-blind palette remains the safe choice for red–green colour
blindness.

**Fixed colours.** Borders, on-fill text, chips, the error callout and the
activity heatmap use the `-line`, `on-`, `--gem-text`, `--warning` and
`color-mix()` tokens, so every base themes them. These stay fixed because
they are artwork or neutral:

| Fixed value                 | Role                              | Where                                                              |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `#05080dcc`                 | modal and overlay scrim, any base | `ui/ui.module.css`, `app/AppShell`, `arena/trading`                |
| `#d9c39a`, `#b5523f`        | map trail and X mark              | `adventure/ChapterMap.module.css`                                  |
| chapter accents, avatar art | artwork colours in TSX            | `adventure/AdventurePage.tsx`, `ui/Avatar.tsx`, `ui/avatarArt.tsx` |
| `#b98a2f`                   | emblem accent on gold             | `ui/Emblem.module.css`                                             |

**Why Midnight Ledger is the default.** It solves the issue's complaint (the
saturated green that coloured every surface) while keeping what works:
ivory text, brass-gold currency and the treasure-map artwork. On
desktop and mobile it reads as a calm trading terminal. Primary buttons are steel
blue, which no gain or loss colour uses, so a primary button reads as "next
step" and not as "buy". The slate is kept desaturated so it does not read as navy,
which the visual direction above rules out; the owner should confirm it
passes that rule. Harbor Dusk is the warmer second choice. Its amber buttons
sit close to the yellow-gold Doubloon colour, so rewards and actions are
harder to tell apart. Parchment Day is the only light option and stays opt-in.

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
