# The learning journal

An independent editorial direction for selection, not an approved product design.

## Composition

Treat financial learning like a thoughtful reading practice. A large, asymmetric opening headline leads to one next lesson; a narrow margin holds context. Hairline rules, numbered folios and typographic scale organize the page without a grid of cards. On phones, the margin becomes a short appendix below the next action. The three primary destinations use plain names and an underlined current location.

The opening headline, “Protect the money you’ll need soon,” leads with the concrete learning objective. The next lesson names what the learner will do. No balances, performance charts or rankings compete with it. The two-day activity sample has no deadline or threatened loss.

## Candidate visual choices

- Georgia is the reading voice: headlines, question, scenario and route names. Its available italic creates emphasis without an extra font download.
- Verdana is the interface voice: navigation, actions, feedback labels and small explanatory copy. Its generous shapes remain legible at small sizes.
- Both are named locally available macOS typefaces. Generic serif and sans-serif fallbacks are provided; there are no network fonts. Cross-platform rendering and font licensing decisions remain for the selected design.
- Warm ivory (`#f6f2e9`) is the paper surface. Charcoal (`#292521`) carries body text. Oxblood (`#782e2d`) identifies the next action, route position and editorial emphasis. Muted brown (`#62594f`) carries supporting text. Pale brown rules organize space, but never convey a state alone.
- Square actions and restrained rules suit the journal. Circular route markers have a navigational purpose. No gradients, shadows, stock imagery or ornamental financial charts.
- No animated motion. Reduced-motion preferences are explicitly respected.

## The atlas

The numbered expedition begins at Readiness Shore and climbs toward Reserve Ridge and a Readiness Lookout. A printed spatial atlas groups paired stops into the near-term shore, Reserve Ridge and the Readiness Lookout. Its switchback route connects to a readiness record and branches to a labelled optional reflection. Normal-flow labels grow with text resizing; keyboard order follows stop numbers even where the visual route reverses. Each atlas stop links to its ordered explanation and prerequisite below. A dashed route joins the milestones; the filled marker locates the learner. Stop numbers, explicit text and ordered-list structure give the route meaning without depending on color. The bonus reflection is a marked optional detour. Standard and bonus stars have text equivalents and concern learning only.

This is a first-chapter atlas, not the full curriculum. The path’s later chapter is named but requires a readiness check. Later locked stops explain their prerequisites in place and are not pretend interactive controls. A completed sample can be revisited through the sample question, labelled as such rather than claiming the actual first lesson exists.

## Behavior and scope

The local journey is `dashboard.html` → `map.html` → `quiz.html`; the dominant dashboard action also opens the example directly. Quiz submission has different, reasoned feedback for both wrong options, a working retry, and a correct completion route. Optional confidence is an interaction demonstration, not stored or assessed. Progress is never persisted; no control claims to resume work. State navigation is tucked under a clearly labelled prototype diagnostic disclosure.

The shared objective is to distinguish money required for essential near-term spending from money available for uncertain market outcomes. The rent example is a proposed learning scenario based on the readiness-first source brief, not a validated or final curriculum item. It has no order execution or profit reward.

## State contract

Each screen accepts `?state=empty|loading|error|locked|success`. An absent or unrecognized value renders the default example. All displayed learning activity, progress and rewards are labelled examples.

| State   | Journal                                           | Route                                                | Question                                      |
| ------- | ------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| Default | One suggested next lesson and restrained activity | One completed, one current, three prerequisite stops | Unanswered rent-money decision                |
| Empty   | No journal entries; start learning                | No completed lessons; begin at readiness             | No answer yet; open the question              |
| Loading | Journal context retained                          | Chapter context retained                             | Stop context retained                         |
| Error   | Progress unavailable; retry                       | Availability unknown; retry                          | No submitted answer; retry                    |
| Locked  | Practice needs foundation and risk checks         | Next chapter needs readiness mastery                 | Later check needs an earlier readiness lesson |
| Success | Learning takeaway and return route                | Example standard star for recognizing risk           | Correct answer plus explanation               |

Loading is an explicit stable review preview with a “show example” action, not a simulated live fetch or unexplained spinner. Error retries return to the default local example. Success states state that no real learning record changes. Real runtime persistence, request timing and mastery contracts remain out of scope.

## Accessibility and performance

Semantic headings, an ordered route, fieldset/legend, native radios, native select, skip link and visible focus support keyboard and assistive technology use. Choice rows and controls are at least 44px tall. Correctness, locks and route position have written labels. Feedback receives focus and is a polite live region. Layout uses no fixed heights for text; a single-column mobile layout supports wrapping and zoom.

The implementation uses three local HTML files, one stylesheet and one small script. No external requests, libraries, charts, images or dependencies. Prototype size alone is not a future-product performance measurement. Browser verification must include all six states on all three screens at 360, 390, 430 and 768px, 200% zoom, keyboard operation and both answer paths.

## Tradeoffs to test

The editorial voice may feel more serious than the field-navigation idea suggests. The path is longer vertically than a game map, in exchange for readable prerequisites. The concrete objective leads after critique found the original abstract headline required unnecessary interpretation. Detailed learning activity and other future screens are not implemented in this study.
