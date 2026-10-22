"""Descriptive aggregates over the in-scope records. Every learning metric here is unvalidated."""

from app.study.instrument import GROUPS, UNKNOWN

COHORTS = ('all', *GROUPS, UNKNOWN)
PARTS = ('missions', 'plan', 'risk', 'overtrading')
TREND_KINDS = ('preview', 'level', 'boss', 'gate', 'daily', 'practice', 'private', 'ranked')
MAX_ATTEMPT = 5
PRE_POST_NOTE = ('Preview Battle (before the lessons) and Chapter Boss (after) share a scenario with different seeds. A first attempt '
                 'is the participant\'s first ever match of that kind; retries follow. Profit decides matches but is not learning '
                 'evidence, and the decision score is an unvalidated heuristic.')
TREND_NOTE = ('Mean decision score by attempt number for the same level, boss kind, daily day, practice market or multiplayer mode; '
              'the last point pools attempts 5 and later. Forfeits are left out. Unvalidated.')
CHECK_NOTE = 'First answer to each lesson check question, recorded once per participant. Not a validated assessment.'
QUIZ_NOTE = ('Chapter quiz attempts by attempt number per topic, and first answers to each chapter\'s bank questions in any quiz. '
             'Quizzes can be passed by memorisation, retries or guessing.')
SCOPE = ('Participants with active consent under the current policy; records from the time of that consent onward. Pseudonymous '
         'ids only; no names, emails, sign-in ids or reflections.')


def mean(values):
    values = [value for value in values if value is not None]
    return round(sum(values) / len(values), 4) if values else None


def in_cohort(groups, cohort):
    return lambda user_id: cohort == 'all' or groups.get(user_id, UNKNOWN) == cohort


def mission_share(result):
    missions = result.get('missions') or []
    return sum(bool(mission['done']) for mission in missions) / len(missions) if missions else None


def part_share(result, part):
    maximum = (result.get('decision_max') or {}).get(part)
    return (result.get('decision_breakdown') or {}).get(part, 0) / maximum if maximum else None


def metric_summary(matches):
    finished = [match for match in matches if match.finished]
    played = [match for match in finished if not match.forfeited]
    return {'matches': len(finished), 'participants': len({match.user_id for match in finished}), 'forfeited': len(finished) - len(played),
            'mean_profit': mean(match.result.get('profit') for match in played),
            'mean_decision_score': mean(match.result.get('decision_score') for match in played),
            'decision_parts': {part: mean(part_share(match.result, part) for match in played) for part in PARTS},
            'mission_completion': mean(mission_share(match.result) for match in played),
            'win_rate': mean(float(bool(match.result.get('won'))) for match in played)}


def phase(matches):
    return {'first_attempts': metric_summary([match for match in matches if match.attempt == 1]), 'all_attempts': metric_summary(matches)}


def paired(preview, boss):
    def firsts(matches):
        return {match.user_id: match.result for match in matches if match.attempt == 1 and match.finished and not match.forfeited}
    before, after = firsts(preview), firsts(boss)
    both = sorted(before.keys() & after.keys())

    def change(key):
        return mean(after[user][key] - before[user][key] for user in both
                    if after[user].get(key) is not None and before[user].get(key) is not None)
    return {'participants': len(both), 'mean_profit_change': change('profit'), 'mean_decision_score_change': change('decision_score')}


def pre_post(campaign, groups, matches):
    chapters = []
    for chapter in campaign.chapters:
        own = [match for match in matches if match.mode == 'boss' and match.chapter_id == chapter['id']]
        cohorts = []
        for cohort in COHORTS:
            member = in_cohort(groups, cohort)
            preview = [match for match in own if match.kind == 'preview' and member(match.user_id)]
            boss = [match for match in own if match.kind == 'boss' and member(match.user_id)]
            cohorts.append({'cohort': cohort, 'preview': phase(preview), 'boss': phase(boss), 'paired_first_attempts': paired(preview, boss)})
        chapters.append({'chapter_id': chapter['id'], 'number': chapter['number'], 'title': chapter['title'], 'cohorts': cohorts})
    return {'note': PRE_POST_NOTE, 'chapters': chapters}


def trends(groups, matches, chapter_id=None, cohort='all'):
    member = in_cohort(groups, cohort)
    scored = [match for match in matches if match.finished and not match.forfeited and match.result.get('decision_score') is not None
              and member(match.user_id) and (chapter_id is None or match.chapter_id == chapter_id)]
    series = []
    for kind in TREND_KINDS:
        own = [match for match in scored if match.kind == kind]
        if not own:
            continue
        points = []
        for attempt in range(1, MAX_ATTEMPT + 1):
            bucket = [match for match in own if min(match.attempt, MAX_ATTEMPT) == attempt]
            points.append({'attempt': attempt, 'label': f'{attempt}+' if attempt == MAX_ATTEMPT else str(attempt), 'matches': len(bucket),
                           'mean_decision_score': mean(match.result['decision_score'] for match in bucket)})
        series.append({'kind': kind, 'points': points})
    return {'note': TREND_NOTE, 'series': series}


def check_accuracy(campaign, groups, checks, chapter_id=None, cohort='all'):
    member = in_cohort(groups, cohort)
    levels = []
    for chapter in campaign.chapters:
        if chapter_id is not None and chapter['id'] != chapter_id:
            continue
        for number, level in enumerate(chapter['levels'], 1):
            rows = [row for row in checks if row.level_id == level['id'] and member(row.user_id)]
            correct = sum(row.first_correct for row in rows)
            levels.append({'chapter_id': chapter['id'], 'level_id': level['id'], 'level_number': number, 'title': level['title'],
                           'participants': len({row.user_id for row in rows}), 'answers': len(rows), 'first_try_correct': correct,
                           'accuracy': round(correct / len(rows), 4) if rows else None})
    return {'note': CHECK_NOTE, 'levels': levels}


def quiz_stats(attempts):
    return {'attempts': len(attempts), 'participants': len({attempt.user_id for attempt in attempts}),
            'mean_score_pct': mean(100 * attempt.score / attempt.total for attempt in attempts if attempt.total),
            'pass_rate': mean(float(attempt.passed) for attempt in attempts if attempt.passed is not None)}


def quiz_performance(campaign, bank, groups, quizzes, cohort='all'):
    member = in_cohort(groups, cohort)
    mine = [quiz for quiz in quizzes if member(quiz.user_id)]
    chapters = []
    for chapter in campaign.chapters:
        topic = f'chapter-{chapter["number"]}'
        complete = [quiz for quiz in mine if quiz.topic_id == topic and quiz.status == 'complete']
        answers = [answer for quiz in mine for question_id, answer in quiz.answers.items()
                   if (bank.questions.get(question_id) or {}).get('chapter') == chapter['number']]
        correct = sum(bool(answer.get('correct')) for answer in answers)
        chapters.append({'chapter_id': chapter['id'], 'number': chapter['number'], 'title': chapter['title'],
                         'first_attempts': quiz_stats([quiz for quiz in complete if quiz.attempt == 1]), 'all_attempts': quiz_stats(complete),
                         'answers': len(answers), 'answer_accuracy': round(correct / len(answers), 4) if answers else None})
    return {'note': QUIZ_NOTE, 'chapters': chapters}


def funnel(campaign, matches, checks):
    chapters = []
    for chapter in campaign.chapters:
        own = [match for match in matches if match.mode == 'boss' and match.chapter_id == chapter['id']]
        steps = [('preview', 'Preview Battle played', {match.user_id for match in own if match.kind == 'preview' and match.finished
                                                        and not match.forfeited})]
        for number, level in enumerate(chapter['levels'], 1):
            steps.append((f'level-{number}-check', f'Level {number} check', {row.user_id for row in checks if row.level_id == level['id']}))
        steps.append(('boss-attempted', 'Chapter Boss attempted', {match.user_id for match in own if match.kind == 'boss'}))
        steps.append(('boss-won', 'Chapter Boss won', {match.user_id for match in own if match.kind == 'boss' and match.finished
                                                       and match.result.get('won')}))
        chapters.append({'chapter_id': chapter['id'], 'number': chapter['number'], 'title': chapter['title'],
                         'steps': [{'step': step, 'label': label, 'participants': len(users)} for step, label, users in steps]})
    return chapters


def summary(campaign, participants, matches, checks):
    finished = [match for match in matches if match.finished]
    modes = sorted({match.mode for match in finished})
    return {'scope': SCOPE, 'participants': len(participants),
            'onboarding': {status: sum(person.onboarding == status for person in participants) for status in ('completed', 'skipped', 'pending')},
            'groups': [{'group': group, 'participants': sum(person.group == group for person in participants)} for group in (*GROUPS, UNKNOWN)],
            'total_matches': len(finished),
            'matches': [{'mode': mode, 'matches': sum(match.mode == mode for match in finished)} for mode in modes],
            'funnel': funnel(campaign, matches, checks)}
