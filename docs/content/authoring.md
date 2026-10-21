# Content authoring

All content is JSON in `server/app/content/`, loaded at startup and validated
strictly: unknown fields fail and invalid content stops the server. The
design source is the [curriculum spec](curriculum-spec.md); how the engine
uses scenarios is in the [engine reference](../reference/engine.md).

Authored: 8 chapters × 5 levels, 64 scenarios (40 level practices, 8 bosses,
7 dailies, 5 practice, 4 multiplayer), 24 bots, 160 quiz questions and 73
cosmetics. None has had independent financial or pedagogical review;
`review.json` records that status and production refuses gameplay until it is
`approved` (see [Review before release](#review-before-release)).

| File                  | Content                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| `campaign/ch<N>.json` | One chapter: title, region, tagline, icon, boss and gate ids, boss reward, 5 levels |
| `scenarios/<id>.json` | One market: assets, regimes, news, bots, allowed orders, tools, missions, copy      |
| `bots.json`           | AI opponents: name, tier, avatar, style, strategy, parameters                       |
| `quiz_bank.json`      | Quiz questions with chapter, concepts and difficulty                                |
| `cosmetics.json`      | Avatars, titles, themes and badges with their sources                               |
| `review.json`         | `{status: authored_requires_independent_review \| approved, notes}`                 |

Scenario ids follow the mode: `chN-lM-practice` (level missions), `chN-boss`
(the chapter's Preview and Boss, and the next chapter's Gate), `daily-*` (the
weekday rotation in `campaign/daily.py`), `practice-*` (practice arena and
lobbies) and `mp-*` (lobbies and ranked).

## Chapters and levels

```jsonc
{
  "id": "ch1",
  "number": 1,
  "title": "Market Basics",
  "region": "Harbor of Basics",
  "tagline": "What a stock is, how prices move, and your first trades.",
  "icon": "compass",
  "boss": "ch1-boss", // also this chapter's Preview Battle
  "gate": null, // chapter 2+: the previous chapter's boss scenario
  "boss_reward": { "kind": "avatar", "id": "avatar-guide-1" },
  "levels": [
    {
      "id": "ch1-l1",
      "title": "What Is a Stock?",
      "summary": "One sentence shown on the map popup.",
      "objectives": ["…"], // "In this lesson you will learn"
      "terms": [{ "term": "Share", "definition": "…" }], // Trading Archive
      "cards": [
        {
          "title": "A slice of the company",
          "body": "Plain text. **bold** allowed.",
          "visual": "ownership-slider", // optional
        },
      ],
      "check": [
        {
          "id": "q1",
          "kind": "mc", // or "true_false"
          "prompt": "…",
          "options": [{ "id": "a", "text": "…" }],
          "answer": "b",
          "explanation": "One line shown after answering.",
        },
      ],
      "practice": "ch1-l1-practice",
      "reward": { "kind": "avatar", "id": "…" }, // optional map reward node
    },
  ],
}
```

The loader (`campaign/content.py`) requires: chapter numbers 1, 2, 3, …
without gaps; exactly 5 levels per chapter; 1–6 objectives, 0–20 terms, 1–8
cards and 1–8 check questions per level (4–5 cards and questions is the
design target); `mc` questions with 2–6 options and `true_false` with 2; an
`answer` among the option ids; `boss`, `gate` and `practice` naming existing
scenarios; no gate in chapter 1; rewards that exist in `cosmetics.json` with
the same kind; unique chapter, level and node ids.

Writing guidance: one objective per level that its practice mission tests;
misconception-based distractors; correct answers spread across positions;
arithmetic checked by hand. Keep level, question and scenario ids stable:
progress, first answers and stars are stored against them.

Card `visual` keys (`client/features/level/visuals/`; an unknown key renders
text only): `ownership-slider`, `market-cap-compare`, `supply-demand`,
`gap-chart`, `candle-anatomy`, `candle-patterns`, `trend-lines`,
`support-resistance`, `volume-bars`, `order-book`, `bid-ask-spread`,
`order-types`, `limit-vs-market`, `stop-loss`, `position-size`,
`risk-reward`, `diversification`, `drawdown-recovery`, `moving-average`,
`rsi`, `macd`, `earnings`, `pe-ratio`, `news-impact`, `bubble-cycle`,
`emotion-cycle`.

## Scenarios

Follow the spec's pillars (§B0): one obvious lesson that the briefing names,
the market script builds and the debrief explains. Fictional companies only.

```jsonc
{
  "id": "ch1-l2-practice", // must equal the file name
  "version": 1,
  "title": "First Buy",
  "briefing": "One or two sentences read before starting.",
  "objective": "The concept this market tests.",
  "debrief": "What happened and why, shown on the results screen.",
  "difficulty": 1,
  "ticks": 40,
  "history": 20,
  "tick_label": "Day",
  "starting_cash": 10000,
  "fee": { "rate": 0.001, "min": 1 },
  "spread": 0.001,
  "allow": { "limit": false, "stop": false },
  "max_position_pct": null,
  "tools": ["candles"],
  "market": { "vol": 0.006 },
  "regimes": [{ "from": 0, "to": 40, "market_drift": 0.0015, "vol_mult": 1.0 }],
  "assets": [
    {
      "symbol": "LEAF",
      "name": "Leafy Greens Co.",
      "sector": "Consumer staples",
      "blurb": "Sells salad kits to supermarkets.",
      "price": 50,
      "drift": 0.0005,
      "beta": 1.0,
      "vol": 0.012,
      "base_volume": 10000,
    },
  ],
  "news": [
    {
      "id": "n1",
      "tick": 18,
      "headline": "Leafy Greens wins a national supermarket contract",
      "body": "…",
      "tone": "positive",
      "symbols": ["LEAF"],
      "kind": "company", // optional: earnings|macro|rumor|company|hype
      "effects": [{ "symbol": "LEAF", "move": 0.08, "ticks": 4, "gap": true }],
    },
  ],
  "bots": ["hodl-hannah"],
  "balance": "lesson", // optional: boss|daily|lesson
  "missions": {
    "basic": [
      {
        "id": "m1",
        "type": "trades_min",
        "params": { "n": 1 },
        "text": "Buy at least one share",
      },
    ],
    "bonus": [
      {
        "id": "b1",
        "type": "profit_min",
        "params": { "amount": 1 },
        "text": "Finish with a profit",
      },
    ],
  },
}
```

`game/scenario.py` enforces: tickers of 3–5 capital letters; `ticks` 15–150,
`history` 5–120; 1–5 assets; regimes covering ticks `0..ticks` without gaps;
news inside the match with effects ending by the last tick; effects and
missions naming known symbols, news and bots; 0–7 bots; 1–5 basic and 0–5
bonus missions ([types](../reference/engine.md#missions)); unique ids. A
`use_order` or `stop_loss_set` mission needs that order type in `allow`.
`tools` come from `candles`, `line`, `volume`, `sma`, `ema`, `rsi`, `macd`,
`bollinger`; the arena draws candles, volume, SMA(20), EMA(10), RSI(14) and
MACD, so `line` and `bollinger` validate but are not drawn.

- Enable `limit` only from Chapter 2 Level 3 and `stop` from Chapter 2
  Level 4; choose `tools` the player has met.
- Set `balance` to `boss` for chapter bosses (a boss needs at least one bot),
  `daily` for dailies, `lesson` for level practices, or omit it for practice
  and `mp-*` markets. The limits are in the
  [balance gauntlet](../reference/engine.md#balance-gauntlet); never loosen
  them to make a scenario pass.
- Bump `version` whenever the market or missions change: saved matches on an
  older version then close instead of replaying differently.
- The validator warns about a lesson or boss scenario with no bonus mission,
  because its special star cannot be earned.

## Bots

```jsonc
{
  "id": "momentum-max-pro",
  "name": "Momentum Max",
  "tier": "pro", // optional: rookie|pro|elite
  "avatar": "bull",
  "style": "Buys strength, sells weakness.",
  "strategy": "momentum",
  "params": {
    "sma": 10,
    "exit_sma": 10,
    "rising": true,
    "high_window": 0,
    "weight": 0.5,
    "delay": 1,
  },
}
```

Parameters per strategy are in the [engine reference](../reference/engine.md#bots).
Avatars come from `bull`, `bear`, `owl`, `fox`, `eagle`, `whale`, `tortoise`,
`hare`, `shark`, `parrot`, `octopus`, `lion`. Keep bot ids stable.

## Quiz bank

`{"version": "…", "questions": [...]}`, each question in the check format plus
`chapter`, `concepts` (1–10) and `difficulty` (1–3). The validator requires at
least 10 questions per chapter and none for missing chapters, and rejects a
prompt that repeats a lesson check. Tag `concepts` consistently: the daily
review weights questions toward concepts the player missed. Quizzes shuffle
options, but spread correct answers across positions anyway.

## Cosmetics

`{"version", "avatars", "titles", "themes", "badges"}`. Ids start with
`avatar-`, `title-`, `theme-` or `badge-`. Each avatar, title and theme has a
`source` (shipped counts in [progression](../reference/progression.md#shop-and-cosmetics)):
`starter` (exactly 4 avatars), `boss`, `map`, `shop`, `rank`, `boss_special`,
`weekly` or `free`. `shop` and `weekly` items need a `price` (`stocks` or
`gems`); `boss`, `map` and `boss_special` items need a `chapter`; rank titles
need a `level`, with one at level 1. A new badge also needs a condition in
`player/badges.py`.

## Validate

From the repository root:

```sh
uv run --project server --extra test --locked python -m app.content.validate
uv run --project server --extra test --locked python -m unittest discover -s server/tests -p test_game_balance.py
```

The validator loads every file and checks the links between them: each
chapter has a `boss_special` title, each daily scenario exists and has an
opponent, at least one `practice-*` scenario exists, every chapter has a full
chapter quiz, and no quiz item repeats a lesson check. It prints the counts.
While tuning one scenario, call
`app.game.balance.gauntlet(load_scenarios()['ch3-boss'], range(50))` from a
Python shell in the server environment to see each synthetic player's win
rate and mean profit. Then play the level in the client: the tools cannot
judge whether a lesson is clear.

## Review before release

Validation and the gauntlet check structure and balance, not financial
accuracy or teaching quality. Before release an independent reviewer checks
each chapter's statements, arithmetic, questions, explanations and debriefs,
and confirms that no text reads as personal investment advice or promises
profit. Record the review, then set `review.json` to `approved`. The
[source register](sources.md) lists sources read for the earlier catalog;
they can support that review but do not replace it.
