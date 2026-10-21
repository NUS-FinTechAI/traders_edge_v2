"""Unlock rules and map state derived from a player's saved progress."""

from dataclasses import dataclass, field

from sqlalchemy import select

from app.campaign.models import BossResult, CampaignProgress

LEVEL_XP = {'check': 10, 'normal': 20, 'special': 10}
PREVIEW_XP = 10
BOSS_XP = 50


def boss_key(chapter):
    return chapter['id'] + '-boss'


@dataclass
class Progress:
    campaign: object
    levels: dict = field(default_factory=dict)
    bosses: dict = field(default_factory=dict)

    def level(self, level_id):
        return self.levels.get(level_id)

    def star(self, level_id, kind):
        row = self.levels.get(level_id)
        return bool(row and getattr(row, kind + '_star'))

    def boss(self, chapter_id, kind):
        return self.bosses.get((chapter_id, kind))

    def won(self, chapter_id, kind):
        row = self.bosses.get((chapter_id, kind))
        return bool(row and row.won)

    def unlocked_by(self, chapter):
        if chapter['number'] == 1:
            return 'start'
        previous = self.campaign.previous(chapter)
        if self.won(previous['id'], 'boss'):
            return 'boss'
        if self.won(chapter['id'], 'gate'):
            return 'gate'
        return None

    def unlocked(self, chapter):
        return self.unlocked_by(chapter) is not None

    def preview_played(self, chapter):
        """Played to the last day without forfeiting (stored as `won` on the preview row)."""
        return self.won(chapter['id'], 'preview')

    def level_locked_reason(self, level_id):
        chapter, number = self.campaign.levels[level_id]
        if not self.unlocked(chapter):
            return f'Win the Chapter {chapter["number"] - 1} boss or the gate boss to unlock this chapter'
        if not self.preview_played(chapter):
            return 'Play the Preview Battle first'
        if number > 1 and not self.star(chapter['levels'][number - 2]['id'], 'normal'):
            return f'Finish Level {number - 1} first'
        return None

    def boss_locked_reason(self, chapter):
        if not self.unlocked(chapter):
            return f'Win the Chapter {chapter["number"] - 1} boss or the gate boss to unlock this chapter'
        if not all(self.star(level['id'], 'normal') for level in chapter['levels']):
            return 'Earn the normal star on every level first'
        return None

    def levels_done(self, chapter):
        return sum(self.star(level['id'], 'normal') for level in chapter['levels'])

    def stars(self, chapter):
        ids = [level['id'] for level in chapter['levels']] + [boss_key(chapter)]
        return sum(self.star(item, 'normal') + self.star(item, 'special') for item in ids)

    def state(self, chapter):
        if not self.unlocked(chapter):
            return 'locked'
        return 'complete' if self.won(chapter['id'], 'boss') else 'open'


async def load_progress(db, campaign, user_id):
    if user_id is None:
        return Progress(campaign)
    levels = {row.level_id: row for row in await db.scalars(select(CampaignProgress).where(CampaignProgress.user_id == user_id))}
    bosses = {(row.chapter_id, row.kind): row for row in await db.scalars(select(BossResult).where(BossResult.user_id == user_id))}
    return Progress(campaign, levels, bosses)


async def progress_row(db, user_id, level_id):
    row = await db.get(CampaignProgress, (user_id, level_id))
    if row is None:
        row = CampaignProgress(user_id=user_id, level_id=level_id, check_done=False, check_first_try=0, check_total=0, normal_star=False,
                               special_star=False, plays=0)
        db.add(row)
    return row


async def boss_row(db, user_id, chapter_id, kind):
    row = await db.get(BossResult, (user_id, chapter_id, kind))
    if row is None:
        row = BossResult(user_id=user_id, chapter_id=chapter_id, kind=kind, won=False, attempts=0)
        db.add(row)
    return row
