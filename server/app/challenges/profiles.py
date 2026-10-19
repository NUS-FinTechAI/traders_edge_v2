"""Versioned challenge briefs and observed-information opponent parameters."""

from copy import deepcopy

VERSION = 'challenge-profiles-1'
OPPONENT_VERSION = 'observed-allocation-1'

CHAPTERS = (
    ('Protect the purpose of the money',
     'All funds here are fictional and discretionary. Compare remaining in cash with accepting an uncertain outcome; essential spending does not belong in this challenge.',
     ('Which need would make this market risk unsuitable?', 'What uncertainty remained when you chose to act or wait?'),
     ('cash', 'plans', 'portfolio_value')),
    ('Read executable quotes and available liquidity',
     'The displayed mid is a valuation reference. Orders use the bid or ask on a later observation, and displayed capacity can change.',
     ('How did the spread affect the execution price?', 'Which orders filled only partly, and why?'),
     ('quotes', 'fills', 'order_status', 'fees')),
    ('Separate ownership from a promised return',
     'The four assets are fictional shares, not bonds or funds. Their price paths do not promise income or model the full range of investment products.',
     ('What return came from changing market value?', 'Which product risks cannot be inferred from these fictional shares?'),
     ('positions', 'portfolio_value', 'plans')),
    ('Maintain a deliberate allocation',
     'A 25% limit applies to each asset when buying. Cash remains part of the portfolio, and price movement can change weights after execution.',
     ('How concentrated was the whole portfolio including cash?', 'Did price drift justify changing the original allocation?'),
     ('position_weights', 'cash', 'plans', 'fees')),
    ('Compare order intent with actual execution',
     'Market, limit and stop orders have different execution tradeoffs. Limits may not fill; a triggered stop can fill beyond its trigger.',
     ('Which price or fill assumption changed after submission?', 'How much did fees and spread reduce the outcome?'),
     ('order_status', 'fills', 'fees', 'plans')),
    ('Manage exposure when the market changes',
     'The written loss boundary records an intention, not a guaranteed maximum loss. Review position size, observed drawdown and exit decisions together.',
     ('Did exposure remain consistent with the written risk plan?', 'Could a gap or partial fill prevent the intended exit?'),
     ('position_weights', 'max_drawdown', 'fills', 'plans')),
    ('Distinguish observed evidence from a prediction',
     'Opponents react only to observed prices. Neither recent momentum nor an opponent action supplies a guarantee about the next observation.',
     ('Which information was actually available at the decision?', 'What observation would have contradicted the plan?'),
     ('observed_history', 'plans', 'fills')),
    ('Recognize pressure to chase a result',
     'There is no time deadline or requirement to place orders. A competitor getting ahead is not evidence that a larger or unsuitable position is justified.',
     ('Did the leaderboard goal change the stated risk boundary?', 'Was any decision driven by a wish to recover an earlier loss?'),
     ('plans', 'position_weights', 'max_drawdown', 'fees')),
    ('Review the full decision sequence',
     'Compare the initial plan, changing observations, execution costs and final portfolio. One shared scenario cannot establish consistency across unfamiliar markets.',
     ('Where did the final actions differ from the initial plan?', 'Would the same policy remain suitable in a different market path?'),
     ('observed_history', 'plans', 'fills', 'fees', 'max_drawdown', 'portfolio_value')),
    ('Identify the limits of a foundation simulator',
     'This challenge remains long-only and unleveraged. It does not execute shorts, options or futures, or establish readiness to use them.',
     ('Which obligations and losses are absent from this simulator?', 'Why would a profitable long-only result not establish advanced-product understanding?'),
     ('plans', 'positions', 'portfolio_value', 'max_drawdown')),
)

TIERS = (
    {'name': 'foundation', 'interval': 5, 'lookback': 5, 'target_weight': '0.15', 'signal_threshold': '0.003', 'drawdown_limit': '0.025'},
    {'name': 'developing', 'interval': 3, 'lookback': 5, 'target_weight': '0.20', 'signal_threshold': '0.004', 'drawdown_limit': '0.020'},
    {'name': 'practised', 'interval': 2, 'lookback': 4, 'target_weight': '0.24', 'signal_threshold': '0.005', 'drawdown_limit': '0.015'},
)
CHAPTER_WEIGHTS = ('0.12', '0.135', '0.15', '0.18', '0.19', '0.20', '0.21', '0.22', '0.23', '0.24')


def opponent_profile(tier, strategies):
    return {'version': OPPONENT_VERSION, **deepcopy(TIERS[tier - 1]), 'strategies': list(strategies)}


def chapter_policy(order):
    if type(order) is not int or not 1 <= order <= len(CHAPTERS):
        raise ValueError('Chapter challenge requires an order from 1 to 10')
    objective, context, prompts, evidence = CHAPTERS[order - 1]
    tier = min(3, 1 + (order - 1) // 3)
    opponents = opponent_profile(tier, ('allocation', 'trend', 'defensive'))
    opponents['target_weight'] = CHAPTER_WEIGHTS[order - 1]
    return {'objective': objective, 'difficulty': f'chapter-{order}-{TIERS[tier - 1]["name"]}',
            'profile_version': VERSION, 'context': context, 'review_prompts': list(prompts),
            'recorded_evidence': list(evidence),
            'assessment_basis': 'Operational decision records and a profit-based game result; review prompts are not automatically graded or validated learning measures.',
            'opponent_profile': opponents}


def daily_policy(day):
    rotation = day.toordinal() % len(TIERS)
    strategy = ('allocation', 'trend', 'defensive')[rotation]
    return {'objective': 'Compare a planned decision policy with an observed-information opponent',
            'difficulty': f'daily-{TIERS[rotation]["name"]}', 'profile_version': VERSION,
            'context': 'The daily opponent policy changes by UTC date. Everyone receives the same saved market and opponent for that date; retries retain that form.',
            'review_prompts': ['Which observed information supported acting or waiting?', 'How did exposure and execution costs affect the final result?'],
            'recorded_evidence': ['observed_history', 'plans', 'fills', 'fees', 'position_weights', 'max_drawdown'],
            'assessment_basis': 'Profit determines this game result; it does not establish learning or future profitability.',
            'opponent_profile': opponent_profile(rotation + 1, (strategy,))}
