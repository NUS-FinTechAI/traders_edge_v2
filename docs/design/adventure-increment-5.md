# Adventure increment 5: lesson simulation

The owner selected the bound `m05-l01` lesson simulation as increment 5 and requested a pause for permission after each implementation step. This record covers only step 1 on `feat/adventure-5-connection`, based on `d8c367d`.

## Step 1: connect a saved simulation

The current simulation step now offers an explicit opening action within the existing guarded learning-run page. It uses the bound simulation endpoint, keeps the run URL unchanged, and loads the current observation through the owned resume endpoint. It does not start a replacement learning run or grant completion.

The binding command key is stored per owner and run in session storage before the mutation and retained for interrupted-request recovery. Reopening uses that key and fetches fresh state because replayed binding responses may be historical. Responses must identify the requested run and the same simulation session. Storage failure prevents the mutation; navigation away aborts the pending request.

The component and stylesheet are separate from the learning page. This is connection scaffolding, not a playable simulator: trading controls and the completion audit remain unavailable and are labelled accordingly. The ordinary lesson answer endpoint still rejects simulation answers. No backend, grading, reward or migration changes are included.

## Verification and remaining work

- All 110 frontend tests pass, including nine connection-service cases covering fresh reads, lost responses, reload recovery, owner isolation, unavailable storage, mismatched identities, denial and cancellation.
- The production build and Oxlint pass. The full lint command reports a formatting issue in the untouched `client/router.tsx`; it was not reformatted in this slice.
- Browser startup failed with a tool configuration error. Live API browser verification, 390px before/after screenshots, independent design/accessibility review and CI remain outstanding.
- Step 2 adds the modular market, portfolio, order and audit interface. Subsequent steps enforce the public lesson restrictions, connect audit completion, broaden recovery checks and verify the complete journey. Continue only with the owner's permission.
