# Workbench — independent exploration

Status: candidate only. This is a static prototype, not an approved visual system or implemented product. The other directions were not inspected during creation.

## Intent

Make the first useful action easy to find. A narrow navigation rail provides orientation; a ruled learning workspace holds one dominant next checkpoint. On phones, the rail becomes a compact three-link header. The learning record is secondary and appears below the main action. The composition uses rules, typography and spacing rather than a grid of feature cards.

The map is an expedition route: Base camp identifies essential needs, Safe ground explains availability, Decision crossing applies the distinction, and the Destination cache contains a useful principle. These are navigational milestones with a clear order and prerequisite explanation. The spatial map has an ordered text companion, so its sequence and prerequisite explanations remain available without relying on the route drawing or color. Standard and bonus stars have written definitions; no invented bonus activity is presented as available.

The quiz asks for a reason, gives specific feedback and allows another attempt. It explains that money not needed for rent is not automatically suitable for investing. Optional confidence is visibly unscored. The demonstration never places a trade or rewards profit.

## Candidate visual choices

- Porcelain `#f5f6f3` is the canvas; white is reserved for answer surfaces.
- Charcoal `#172321` carries primary text and completed milestones.
- Cobalt `#2047bd` carries the next action, selected answer and current route node.
- Muted `#58615c` carries secondary text; rules use `#c7ccc5` and never communicate state alone.
- Success `#245d40` and error `#963c2c` accompany explicit text; feedback surfaces stay pale.
- Trebuchet MS gives headings a clear, practical human voice. Verdana supports small reading text. Checkpoint indices use tabular numerals in Trebuchet MS. The direction uses only these two named typefaces, with installed local fallbacks and no font request.

Spacing follows an 8px base with deliberate 12px secondary gaps. Corners stay square. Controls are at least 44px high; important action buttons are 48px. Answer labels are full-width targets. There is no automatic motion; reduced-motion preference is explicitly respected.

## Demonstration contract

Open `dashboard.html`, `map.html` or `quiz.html` through a local static server. Each supports `?state=empty|loading|error|locked|success`; no query is the default example. Diagnostic links are inside an explicitly labelled disclosure at the bottom. Loading and error states preserve the heading, navigation and purpose. Retry returns to the ready example; there is no fake network operation.

The dashboard leads to the route. The available checkpoint opens the practice check. Choose A for correct feedback or B/C for a retry explanation. A successful check links to the completed route and destination principle. Completed route checkpoints expose inline recaps; locked ones explain prerequisites. The fresh-map first-step link opens the same self-contained example decision; this prototype demonstrates the learning objective rather than claiming three complete lessons exist.

All progress, activity and outcomes are example data. Nothing is saved; no resume claim is made. No external network requests, packages, images or analytics are used. Advanced-practice locks describe prerequisites without urgency or punishment.

## Review boundary

The [QA summary](qa-summary.json) records the verified viewport, state, interaction and enlarged-text checks and their limits. The route uses a two-dimensional wayfinding diagram: a solid path turns through Base camp, Safe ground and the Decision crossing to the Principle cache. A dashed branch leads to an optional uncertainty definition. Markers are working navigation targets with written status; an ordered list below preserves the complete sequence and prerequisite explanations. The tradeoff is additional vertical space on phones in exchange for a more legible map and destination. Review must assess this balance in the rendered prototype.

## Source verification

JavaScript syntax and all direct HTML local resource/link targets passed checks. Calculated WCAG text contrast ratios: charcoal/porcelain 14.91:1, muted/porcelain 5.90:1, cobalt/porcelain 7.18:1, white/cobalt 7.78:1, charcoal/blue-tint 14.17:1, error/red-tint 6.20:1 and success/green-tint 6.77:1. These calculations do not replace keyboard, viewport or rendered text-zoom checks.

## Review refinements

The mobile Today navigation target now has a 44px minimum inline size. The dashboard headline now names the purpose: “Protect money you need soon.” The two-dimensional expedition map replaces the checklist-only presentation as the primary wayfinding view. These remain candidate changes, not direction approval.

Optional confidence uses less space: it now opens from a labelled disclosure, keeping Check my reasoning close to the answers. The confidence inputs remain optional, unscored and semantically grouped.

Enlarged-text review found that the first spatial-map canvas let captions collide and overflow. It was replaced by a normal-flow two-column grid with content-sized rows and row gaps. A lightweight ResizeObserver draws route lines behind the actual node positions; the labels no longer depend on fixed coordinates or a fixed canvas height. The route remains legible without the lines through its numbered semantic anchors and ordered explanations. See the QA summary for the repeated enlarged-text check and final capture results.
