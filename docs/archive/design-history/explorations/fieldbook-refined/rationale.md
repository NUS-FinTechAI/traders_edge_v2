# Fieldbook refinement

Status: selected structural and visual reference, preserved as a static prototype. This document describes these three example screens; it does not specify the complete product or establish production performance or learner outcomes. The owner selected Fieldbook's structure and asked for a contemporary learning-app treatment with a thoughtful fox. The final artwork and detailed visual rules remain reviewable.

## What changed

The dashboard leads with the concrete task, its reason and **Continue learning**. The fox adds a useful question below that action. A compact four-stop summary gives progress context; the connected spatial route lives on the separate learning-path screen. This reduces the repeated orientation and long map that previously delayed the next step.

White surfaces, a deliberate sans hierarchy and cobalt actions replace parchment, forest green and serif headings. Spacing groups information; containers are reserved for a scenario, selectable answer, current map stop or explicit feedback. There are no shadows, gradients, ornamental compass marks or decorative stars.

The [reference study](../../competitor-study.md) records the public sources behind the refinement. Consistent headings and fewer containers inform the layout. A small character beside guidance informs the fox's role. Competitor artwork and interface code are not used.

## Candidate visual rules

- Typography: Avenir Next, with Avenir, Segoe UI and generic sans fallbacks. Bold, compact headings contrast with comfortably spaced body copy. There is no external font request; exact rendering varies with installed fonts.
- White `#ffffff` and cool `#f7f9fd` support reading. Charcoal `#172238` is primary text; muted `#526075` remains readable for supporting copy.
- Cobalt `#3155cc` identifies the primary action, current checkpoint and focus. Pale blue `#eef3ff` distinguishes selected answers and explanatory feedback. Warm orange `#b64c18` is a restrained secondary accent; reconsideration uses pale orange `#fff4eb` without a punitive message.
- Buttons have a maximum 12px corner radius. Control text and the entire answer label are clickable. Major navigation, buttons and disclosures have a minimum 44px target; normal-flow layout is intended to accommodate enlarged text.
- No motion is needed. Reduced-motion preferences explicitly suppress animations and transitions.

Calculated contrast ratios are 15.88:1 for charcoal on white, 6.39:1 for muted text on white, 6.36:1 for white on cobalt, 5.72:1 for cobalt on pale blue and 4.80:1 for orange on pale orange. Required map lines have 3.82:1 contrast against pale blue. These calculations check these pairings, not full accessibility conformance.

## Route and practice

The learning path retains geography: the shaded shore contains goals and essential money, and the boundary marks movement toward uncertain outcomes. A continuous required route connects four checkpoints to a learning cache; a dashed branch leads to optional reflection. Explicit prerequisite labels and ordered checkpoint details accompany the spatial map. Stars are explained as required or optional learning completion, never virtual profit.

The quiz presents one situation and three reasoned choices. A wrong answer explains the specific misconception and offers another attempt. Correct reasoning identifies the due-date risk and returns to the path. Optional confidence stays in a disclosure. Definitions remain beside the relevant learning context. A single correct answer is explicitly insufficient to establish mastery.

All displayed progress is an example, and the footer states that it is not saved. Each page accepts `?state=empty|loading|error|locked|success`; the default is example progress. The state selector is a prototype diagnostic. Loading and error states retain orientation, locks explain prerequisites, and success includes reasoning. These are preview states, not an account or persistence implementation.

## Fox asset and delivery limits

The static fox accompanies the dashboard's question and quiz feedback. It never evaluates financial performance, expresses disappointment or creates time pressure. The same thoughtful expression supports reconsideration; a complete expression system is outside this prototype.

`assets/fox-guide.webp` is a transparent 1211 × 1299 image of **453,592 bytes**. It is shown in a reserved small slot with intrinsic dimensions and contained scaling; nearby guidance remains usable if the asset fails. It has no decorative circle or glow. It is decorative to assistive technology because the accompanying text carries the instructional meaning.

The full-resolution asset is larger than required for this display size. Responsive derivatives and a measured delivery budget remain product work. The pages use local CSS, JavaScript and this image with no package or font downloads. That does not establish loading or interaction speed under mobile network conditions.

## Review evidence

This revision has no inherited screenshots or QA results from the earlier Fieldbook. The accompanying `qa-summary.json` records 72 passing screen/state/viewport captures and three passing doubled-text checks. Quiz validation, both wrong choices, retry and correct-answer return passed; first keyboard focus and reduced motion were checked. The three default390px captures remain here; the complete capture matrix and earlier concepts are recoverable from Git history before the documentation cleanup. CSS requests Avenir Next with weight900 for major headings; its heavy rounded appearance is intentional and installed-font rendering varies by device. This is an expert review of a static example, not participant testing or an accessibility conformance claim.
