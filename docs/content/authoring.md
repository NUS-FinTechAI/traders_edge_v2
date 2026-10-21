# Curriculum authoring guide

The curriculum is 8 chapters × 5 levels, designed in the
[curriculum spec](curriculum-spec.md) and stored as JSON in
`server/app/content/`. The [build contract](../game-architecture.md#content-formats)
defines every field; this guide explains how to author and check content.

Status: all 40 levels, 8 bosses, 7 dailies, 5 practice markets, 4 multiplayer
markets and 160 quiz questions are authored. None has had independent
financial or pedagogical review, and there is no production approval flag.
Treat every file as a draft until that review is recorded.

## Files

| File                  | What to author                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `campaign/ch<N>.json` | Chapter title, region, tagline, icon, boss and gate scenario ids, boss reward, and 5 levels      |
| `scenarios/<id>.json` | One market: assets, regimes, news, bots, allowed order types, tools, missions, briefing, debrief |
| `bots.json`           | AI opponents: name, tier, avatar, one-line style, strategy and parameters                        |
| `quiz_bank.json`      | Quiz questions with chapter, concepts and difficulty                                             |
| `cosmetics.json`      | Avatars, titles, themes and badges, with how each is unlocked                                    |

Scenario ids follow the mode: `chN-lM-practice` (level missions), `chN-boss`
(boss, also the next chapter's gate and this chapter's Preview), `daily-*`
(the weekday rotation in `server/app/campaign/daily.py`), `practice-*`
(practice arena and lobbies) and `mp-*` (lobbies and ranked).

## A level

- **Objectives**: 1–6 lines for "In this lesson you will learn".
- **Terms**: glossary entries; they appear in the Trading Archive once the
  chapter is unlocked.
- **Cards**: 1–8 (4–5 is the design target). Plain text with `**bold**`.
  An optional `visual` key picks an interactive visual from
  `client/features/level/visuals/`; an unknown key shows text only.
- **Check**: 1–8 `mc` or `true_false` questions (4–5 is the target), each with
  an `answer` and a one-line `explanation`. Write misconception-based
  distractors and spread correct answers across positions.
- **Practice**: the scenario id. Give its missions one obvious link to the
  level's concept: basic missions earn the normal star (with the check), bonus
  missions the special star. A scenario without bonus missions cannot give a
  special star.
- **Reward** (optional): an avatar or title from `cosmetics.json`, shown as a
  map node after the level.

## A scenario

Follow the spec's design pillars (§B0): one obvious lesson, which the briefing
names, the market script builds around and the debrief explains. Use fictional
companies and 3–5 letter tickers. Enable `limit` and `stop` in `allow` only
once the curriculum has taught them (limit orders from Chapter 2 Level 3,
stop-losses from Chapter 2 Level 4). Choose `tools` the player has met.

Set `balance`:

- `boss` for chapter bosses: idle ≤ 5 % and random ≤ 10 % wins over 50 seeds;
- `daily` for dailies: idle ≤ 10 % and random ≤ 25 %;
- `lesson` for level practices (not gated), or omit it for practice and
  multiplayer markets.

Bump `version` whenever the market or missions change: a saved match on an
older version refuses to load instead of replaying differently.

## Quiz items

Quiz items must not repeat a lesson check prompt (the validator rejects
repeats). Each chapter needs at least 10 items for one chapter quiz; the bank
has 20. Tag `concepts` consistently: the daily review weights questions toward
concepts the player has missed.

## Check your work

From the repository root:

```sh
uv run --project server --extra test --locked python -m app.content.validate
uv run --project server --extra test --locked python -m unittest discover -s server/tests -p test_game_balance.py
uv run --project server --extra test --locked python -m unittest discover -s server/tests
```

The validator checks fields, limits and cross-references and prints the
content counts. The balance test plays synthetic players against every boss
and daily. While tuning one scenario, call
`app.game.balance.gauntlet(scenario, range(50))` to see the win rate and mean
profit of the idle, random, buy-and-hold and trend-following players. Play the
level in the client as well: the tools do not judge whether the lesson is
clear.

## Review before release

Validation and balance are not content review. Before release, an independent
reviewer should check each chapter's financial statements, arithmetic,
questions, explanations and debriefs, and confirm that no text reads as
personal investment advice or promises profit. Record the review; the
[source register](sources.md) lists sources read for the earlier catalog,
which can support but do not replace that review.

The earlier ten-module teaching contract that this file used to hold described
the removed learning-run catalog; it is in git history.
