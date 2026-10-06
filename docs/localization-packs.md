# Localization boundaries

The current curriculum is jurisdiction-neutral. Sources include US and Spanish institutions, but the core does not adopt local tax rules, account benefits, deposit-protection limits, settlement-day counts or margin thresholds. Currency-neutral fictional units keep arithmetic separate from product recommendations.

A runtime localization-pack loader is not part of the current learning/content contract. Do not place regional legal facts into lesson prose as if they apply to everyone or invent a second unvalidated content format. The client should not infer a jurisdiction from language, currency or location without an explicit product decision.

When adding a regional pack, first define its versioned contract and selection behavior with the API. Each rule needs a jurisdiction, effective date, primary source, review date and publication status. Unknown or expired rules must stay visibly unavailable; falling back to another jurisdiction is unsafe. Keep local account and settlement explanations separate from generic order and risk principles. Language translation alone is not legal localization.

Validation should cover an unknown region, missing translation, outdated rule, withdrawn approval and source-link integrity. Have an independent reviewer with the relevant jurisdictional knowledge check the pack before publication. Record what was reviewed and when; a source link or translation test does not establish current legal accuracy.
