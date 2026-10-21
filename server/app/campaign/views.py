"""Public response shapes for chapters, map nodes, levels, the archive and the play hub."""

from app.campaign.progress import BOSS_XP, LEVEL_XP, PREVIEW_XP, boss_key
from app.game.scenario import load_bots, load_scenarios


def scenario_title(scenario_id, fallback):
    scenario = load_scenarios().get(scenario_id)
    return scenario['title'] if scenario else fallback


def money(value):
    return None if value is None else float(value)


def stars(progress, item_id):
    return {'normal': progress.star(item_id, 'normal'), 'special': progress.star(item_id, 'special')}


def reward(cosmetics, value):
    return cosmetics.reward(value['id']) if value else None


def chapter_card(progress, chapter):
    unlocked_by = progress.unlocked_by(chapter)
    gate = None
    if chapter['gate'] and unlocked_by in (None, 'gate'):
        row = progress.boss(chapter['id'], 'gate')
        gate = {'scenario_id': chapter['gate'], 'won': bool(row and row.won), 'attempts': row.attempts if row else 0}
    return {key: chapter[key] for key in ('id', 'number', 'title', 'region', 'tagline', 'icon')} | {
        'state': progress.state(chapter), 'unlocked_by': unlocked_by, 'stars': progress.stars(chapter),
        'stars_total': 2 * len(chapter['levels']) + 2, 'levels_done': progress.levels_done(chapter),
        'levels_total': len(chapter['levels']), 'gate': gate}


def _node(node_id, kind, title, summary, state, **extra):
    return {'id': node_id, 'kind': kind, 'title': title, 'summary': summary, 'state': state, 'stars': None, 'objectives': [], 'xp': 0,
            'reward': None, 'scenario_id': None, 'best_profit': None, 'attempts': 0, 'locked_reason': None} | extra


def map_nodes(progress, chapter, cosmetics):
    locked = None if progress.unlocked(chapter) else progress.level_locked_reason(chapter['levels'][0]['id'])
    preview = progress.boss(chapter['id'], 'preview')
    nodes = [_node(chapter['id'] + '-preview', 'preview', 'Preview Battle', 'Your starting point: the boss market before the lessons. It cannot be failed.',
                   'locked' if locked else 'done' if progress.preview_played(chapter) else 'open',
                   xp=PREVIEW_XP, scenario_id=chapter['boss'], locked_reason=locked,
                   best_profit=money(preview.best_profit) if preview else None, attempts=preview.attempts if preview else 0)]
    for number, level in enumerate(chapter['levels'], 1):
        row = progress.level(level['id'])
        reason = progress.level_locked_reason(level['id'])
        done = progress.star(level['id'], 'normal')
        nodes.append(_node(level['id'], 'level', f'Level {number}: {level["title"]}', level['summary'],
                           'done' if done else 'locked' if reason else 'open', stars=stars(progress, level['id']),
                           objectives=level['objectives'], xp=sum(LEVEL_XP.values()), locked_reason=None if done else reason,
                           best_profit=money(row.best_profit) if row else None, attempts=row.plays if row else 0))
        if 'reward' in level:
            item = reward(cosmetics, level['reward'])
            nodes.append(_node(level['id'] + '-reward', 'reward', item['name'], f'Earn the normal star on Level {number} to collect it.',
                               'done' if done else 'locked', reward=item, locked_reason=None if done else f'Finish Level {number} first'))
    boss = progress.boss(chapter['id'], 'boss')
    reason = progress.boss_locked_reason(chapter)
    won = progress.won(chapter['id'], 'boss')
    nodes.append(_node(boss_key(chapter), 'boss', scenario_title(chapter['boss'], 'Chapter Boss'),
                       'Beat every opponent on total profit to win the chapter.', 'done' if won else 'locked' if reason else 'open',
                       stars=stars(progress, boss_key(chapter)), xp=BOSS_XP, reward=reward(cosmetics, chapter['boss_reward']),
                       scenario_id=chapter['boss'], locked_reason=None if won else reason,
                       best_profit=money(boss.best_profit) if boss else None, attempts=boss.attempts if boss else 0))
    return nodes


def continue_target(progress, campaign):
    for chapter in campaign.chapters:
        if progress.state(chapter) != 'open':
            continue
        label = f'Chapter {chapter["number"]}'
        if not progress.preview_played(chapter):
            return {'chapter_id': chapter['id'], 'node_id': chapter['id'] + '-preview', 'label': label + ' · Preview Battle'}
        for number, level in enumerate(chapter['levels'], 1):
            if not progress.star(level['id'], 'normal'):
                return {'chapter_id': chapter['id'], 'node_id': level['id'], 'label': f'{label} · Level {number}: {level["title"]}'}
        return {'chapter_id': chapter['id'], 'node_id': boss_key(chapter), 'label': label + ' · Chapter Boss'}
    return None


def level_view(progress, campaign, level_id):
    chapter, number = campaign.levels[level_id]
    level = chapter['levels'][number - 1]
    scenario = load_scenarios()[level['practice']]
    row = progress.level(level_id)
    return {
        'id': level_id, 'chapter_id': chapter['id'], 'number': number, 'title': level['title'], 'summary': level['summary'],
        'objectives': level['objectives'], 'terms': level['terms'],
        'cards': [{'title': card['title'], 'body': card['body'], 'visual': card.get('visual')} for card in level['cards']],
        'check': [{'id': q['id'], 'kind': q['kind'], 'prompt': q['prompt'], 'options': q['options']} for q in level['check']],
        'practice': {'scenario_id': scenario['id'], 'title': scenario['title'], 'briefing': scenario['briefing'],
                     'missions': [{'tier': tier, 'text': mission['text']} for tier in ('basic', 'bonus') for mission in scenario['missions'][tier]]},
        'progress': {'check_done': bool(row and row.check_done), 'check_best': row.check_first_try if row and row.check_done else None,
                     'normal_star': bool(row and row.normal_star), 'special_star': bool(row and row.special_star),
                     'plays': row.plays if row else 0},
    }


def archive(progress, campaign):
    return {'terms': [{**term, 'chapter_id': chapter['id'], 'level_id': level['id']}
                      for chapter in campaign.chapters if progress.unlocked(chapter)
                      for level in chapter['levels'] for term in level['terms']]}


def bosses(progress, campaign):
    entries = []
    for chapter in campaign.chapters:
        if chapter['gate']:
            won = progress.won(chapter['id'], 'gate')
            entries.append({'chapter_id': chapter['id'], 'kind': 'gate', 'scenario_id': chapter['gate'],
                            'title': scenario_title(chapter['gate'], f'Chapter {chapter["number"]} Gate'),
                            'state': 'done' if won else 'open', 'won': won})
        won = progress.won(chapter['id'], 'boss')
        entries.append({'chapter_id': chapter['id'], 'kind': 'boss', 'scenario_id': chapter['boss'],
                        'title': scenario_title(chapter['boss'], f'Chapter {chapter["number"]} Boss'),
                        'state': 'done' if won else 'locked' if progress.boss_locked_reason(chapter) else 'open', 'won': won})
    return {'bosses': entries}


def bot_summary(bot_id):
    bot = load_bots()[bot_id]
    return {'bot_id': bot_id, 'name': bot['name'], 'avatar': bot['avatar'], 'tier': bot.get('tier', '')}


def practice_pool():
    return sorted(key for key in load_scenarios() if key.startswith('practice-'))


def practice_scenarios():
    scenarios = load_scenarios()
    return {'scenarios': [{'id': key, 'title': scenarios[key]['title'], 'briefing': scenarios[key]['briefing'],
                           'difficulty': scenarios[key]['difficulty'], 'bots': [bot_summary(b) for b in scenarios[key]['bots']]}
                          for key in practice_pool()]}
