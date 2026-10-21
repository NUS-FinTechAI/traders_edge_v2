"""Shared app setup for progression tests: a fixture campaign, a temporary SQLite database and a fixed clock."""

from datetime import datetime, timezone
from functools import cache
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import Settings
from app.content.bundle import load_content
from app.db import Profile
from app.main import create_app

CAMPAIGN = Path(__file__).resolve().parent / 'fixtures' / 'campaign'
MONDAY = datetime(2026, 10, 19, 12, tzinfo=timezone.utc)
SCENARIO = 'practice-trend-rider'


@cache
def fixture_content():
    return load_content(CAMPAIGN)


def result(won=False, profit=0.0, basic=True, bonus=False, forfeited=False, trades=1, fees=5.0, drawdown=1.0, leaderboard=None):
    return {'won': won, 'rank': 1 if won else 2, 'of': 2, 'forfeited': forfeited, 'profit': profit, 'profit_pct': profit / 100,
            'leaderboard': leaderboard or [], 'plan_review': None, 'decision_score': 50, 'key_moments': [], 'debrief': 'Fixture.',
            'missions': [{'id': 'm1', 'tier': 'basic', 'text': 'Basic', 'done': basic, 'progress': ''},
                         {'id': 'b1', 'tier': 'bonus', 'text': 'Bonus', 'done': bonus, 'progress': ''}],
            'stats': {'trades': trades, 'fees': fees, 'biggest_position_pct': 10, 'max_drawdown_pct': drawdown, 'buy_hold_profit': 0}}


class AppCase(unittest.TestCase):
    """A running app with one guest player and the progression clock fixed at MONDAY (adjust `self.now`)."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/progression.db')
        self.app = create_app(self.settings, fixture_content())
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.user_id = self.client.post('/api/session').json()['profile_id']
        self.now = MONDAY
        clock = patch('app.player.ledger.now', side_effect=lambda: self.now)
        clock.start()
        self.addCleanup(clock.stop)

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    @property
    def content(self):
        return fixture_content()

    def run_db(self, function, *args):
        """Run `function(db, *args)` in one committed write transaction."""
        async def apply():
            async with self.app.state.db.sessions.begin() as db:
                await db.execute(text('BEGIN IMMEDIATE'))
                return await function(db, *args)
        return self.client.portal.call(apply)

    def switch_user(self):
        self.client.cookies.clear()
        self.user_id = self.client.post('/api/session').json()['profile_id']
        return self.user_id

    def settle(self, mode, outcome, user_id=None, game_id='game-1', participant_id=None, **fields):
        """Call the settle hook for a game that exists only as the attributes the hook reads."""
        game = SimpleNamespace(id=game_id, mode=mode, scenario_id=fields.pop('scenario_id', SCENARIO), context=fields.pop('context', {}),
                               level_id=fields.pop('level_id', None), chapter_id=fields.pop('chapter_id', None), boss=fields.pop('boss', None))
        participant = SimpleNamespace(id=participant_id or f'participant-{game_id}', plan=fields.pop('plan', None))

        async def apply(db):
            profile = await db.get(Profile, user_id or self.user_id)
            return await self.app.state.settle_game(db, profile, game, participant, outcome)
        return self.run_db(apply)

    def win_boss(self, chapter_id, kind='final', game_id=None, bonus=False):
        return self.settle('boss', result(won=True, profit=100, bonus=bonus), chapter_id=chapter_id, boss=kind,
                           game_id=game_id or f'{chapter_id}-{kind}-win')

    def pass_check(self, level_id):
        for question_id, option_id in (('q1', 'a'), ('q2', 'f')):
            response = self.client.post(f'/api/campaign/levels/{level_id}/check', json={'question_id': question_id, 'option_id': option_id})
            assert response.status_code == 200, response.text
        response = self.client.post(f'/api/campaign/levels/{level_id}/check/complete', json={})
        assert response.status_code == 200, response.text
        return response.json()

    def play_preview(self, chapter_id):
        return self.settle('boss', result(), chapter_id=chapter_id, boss='preview', game_id=f'{chapter_id}-preview')

    def star_level(self, level_id, bonus=False):
        self.pass_check(level_id)
        return self.settle('level', result(bonus=bonus), level_id=level_id, chapter_id=level_id.split('-')[0], game_id=f'{level_id}-play')

    def complete_chapter(self, chapter_id, bonus=False):
        self.play_preview(chapter_id)
        for number in range(1, 6):
            self.star_level(f'{chapter_id}-l{number}', bonus=bonus)
        return self.win_boss(chapter_id, bonus=bonus)
