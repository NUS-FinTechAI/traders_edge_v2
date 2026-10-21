# Design system

The [sample UI](../source/Trader_s_Edge_Sample_UI.jpg) fixes the screens and
their content, not their appearance. The owner selects the visual direction;
replacement UI also needs a separate go-ahead after technical and safety
review. Earlier directions and prototypes are in the
[design archive](../archive/design-history/).

## Visual direction

The current client uses a night-map style: a dark forest-green base,
parchment text and brass accents, on flat surfaces with 1px borders. No glow,
neon, navy, glass gradients, glowing hexagons or fantasy-map textures.

[`client/ui/tokens.css`](../../client/ui/tokens.css) is the source of truth;
`client/ui/global.css` holds base styles. Token roles:

| Group      | Tokens                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Surfaces   | `--bg`, `--bg-elev`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-strong`, `--border-input` |
| Text       | `--text` (parchment), `--text-muted`, `--text-dim`                                                              |
| Action     | `--primary`, `--primary-hover`, `--on-primary`, `--focus` (gold ring)                                           |
| Currencies | `--gold` (Doubloons), `--gem`, `--gem-text` (Gems), `--cash` (sim cash), each with `-soft`                      |
| State      | `--gain`, `--loss`, `--info`, `--warning`, each with `-soft`; `--candle-up`, `--candle-down`                    |
| Scale      | `--radius-sm` … `--radius-pill`, `--space-1` … `--space-7` (4–48px), `--text-xs` … `--text-2xl` (12–32px)       |
| Type       | `--font` (system rounded sans), `--font-num` (monospace, tabular prices)                                        |
| Layout     | `--hud-height`, `--nav-height`, `--content-width`, `--shadow`, `--ease`                                         |

Use the semantic names. Add a global token only when independent features
share the role; keep feature styles in the feature's CSS module. Themes
(`client/app/themes.ts`) override `--gain`, `--loss`, text, border and candle
tokens. Verify contrast when changing the palette.

## Accessibility

- Gains and losses carry `+`/`−` signs and ▲/▼ glyphs as well as colour.
- Touch targets are at least 44px (stricter than WCAG 2.2 AA).
- Visible focus on every control; non-colour state labels for locks,
  completion and correctness.
- Every animation is disabled under `prefers-reduced-motion`.
- Free colour-blind-safe and high-contrast palettes.

## Copy

One persistent line says "Simulated money · fictional companies". The tick
counter reads "Day N of M". Results say "Profit decides the match; your
missions show what you learned". Plain explanations of the next action and
its outcome; no hype, urgency, undefined jargon or profitability claims.

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
