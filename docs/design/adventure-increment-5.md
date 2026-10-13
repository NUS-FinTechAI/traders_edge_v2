# Adventure increment 5: lesson simulation

The owner selected the bound `m05-l01` lesson simulation as increment 5 and requested a pause for permission after each implementation step. Work remains on `feat/adventure-5-connection`. Step 1 was based on `d8c367d`; step 2a extends `528f2bb`.

## Step 1: connect a saved simulation

The current simulation step now offers an explicit opening action within the existing guarded learning-run page. It uses the bound simulation endpoint, keeps the run URL unchanged, and loads the current observation through the owned resume endpoint. It does not start a replacement learning run or grant completion.

The binding command key is stored per owner and run in session storage before the mutation and retained for interrupted-request recovery. Reopening uses that key and fetches fresh state because replayed binding responses may be historical. Responses must identify the requested run and the same simulation session. Storage failure prevents the mutation; navigation away aborts the pending request.

The component and stylesheet are separate from the learning page. This is connection scaffolding, not a playable simulator: trading controls and the completion audit remain unavailable and are labelled accordingly. The ordinary lesson answer endpoint still rejects simulation answers. No backend, grading, reward or migration changes are included.

## Step 2a: inspect saved market and portfolio data

The owner authorized continuing on the same branch. The interface slice is split so forms arrive with working submission paths, rather than inactive controls. `MarketObservation`, `PortfolioSummary` and `OrderHistory` each have their own component and stylesheet. They display current quotes, expandable observed midpoint history, cash and available cash, holdings, fees and text-labelled order states. Empty holdings/orders are explicit. No trading is required to inspect these panels.

The response boundary validates and projects only the fields used by these panels. It rejects future-length histories, missing balances, inconsistent order quantities and unknown referenced symbols. Amounts remain server-supplied decimal strings. Refresh reads the same bound session without a new binding mutation or navigation. A failed refresh preserves and labels the last successfully loaded values.

This slice adds no order, cancellation, advance or audit mutations. Order-plan and audit forms remain pending. Existing authentication, progression and reward rules are unchanged.

## Verification and remaining work

- All 115 frontend tests pass, including the nine connection-service cases and five additional observation cases covering public projections, future history rejection, missing balances, cancelled orders and inconsistent quantities.
- The production build and Oxlint pass. The full lint command reports a formatting issue in the untouched `client/router.tsx`; it was not reformatted in this slice.
- Browser startup failed with a tool configuration error. Live API browser verification, 390px before/after screenshots, independent design/accessibility review and CI remain outstanding.
- The next slice adds the order-plan form together with server-restricted order placement, cancellation and observation advancement. Audit submission follows separately. Recovery checks and complete-journey verification remain required. Continue only with the owner's permission.

## Service contract follow-up

The owner requested explicit API contracts for all endpoints currently used by `client/services/`. Learning-run and bound-simulation responses now have backend models in the consolidated `app/api_schemas/` package and generated TypeScript contracts. Frontend task, result, market and session view types derive from those contracts rather than independently declaring response fields. Runtime validation remains separate from compile-time typing.

A new frontend check scans service endpoint references and rejects any listed as lacking a success schema. All 116 frontend tests pass; build, Oxlint and generated-artifact verification pass. Full formatting still flags the untouched router. Backend regression execution was rejected by the user; new response-compatibility tests and existing learning/review/bound-simulation suites remain unrun for this change. There are still 70 unspecified success responses elsewhere in the API, outside the current service consumers.

The shared command schema introduced during consolidation also added an economy policy field to unrelated learning/simulation payloads. That would change hashes used for replay. The field is now confined to the economy command subclass; response schemas preserve historical omitted fields through unset-field exclusion. Actual backend replay verification remains outstanding.
