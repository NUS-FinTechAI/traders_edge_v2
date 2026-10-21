# Localization boundaries

The current curriculum is jurisdiction-neutral. Chapter 1 names real exchanges and an index (NYSE, Nasdaq, S&P) as examples, but the core does not adopt local tax rules, account benefits, deposit-protection limits, settlement-day counts or margin thresholds. Matches use simulated dollars (`$`) and fictional companies; the dollar sign is a display unit, not a statement about a particular market's rules.

A runtime localization-pack loader is not part of the current content contract. Do not place regional legal facts into lesson prose as if they apply to everyone or invent a second unvalidated content format. The client should not infer a jurisdiction from language, currency or location without an explicit product decision.

When adding a regional pack, first define its versioned contract and selection behavior with the API. Each rule needs a jurisdiction, effective date, primary source, review date and publication status. Unknown or expired rules must stay visibly unavailable; falling back to another jurisdiction is unsafe. Keep local account and settlement explanations separate from generic order and risk principles. Language translation alone is not legal localization.

Validation should cover an unknown region, missing translation, outdated rule, withdrawn approval and source-link integrity. Have an independent reviewer with the relevant jurisdictional knowledge check the pack before publication. Record what was reviewed and when; a source link or translation test does not establish current legal accuracy.
