from dataclasses import replace
import unittest

from app.quizzes.models import QuizCommand
import test_quizzes as fixtures


class QuizClientContractTests(unittest.TestCase):
    postgres = False
    setUp = fixtures.QuizTests.setUp
    tearDown = fixtures.QuizTests.tearDown
    post = fixtures.QuizTests.post
    room = fixtures.QuizTests.room
    joined_room = fixtures.QuizTests.joined_room
    finish = fixtures.QuizTests.finish

    def test_instructor_capability_and_room_management_follow_current_server_authorization(self):
        self.assertFalse(self.client.get('/api/quizzes/forms').json()['instructor_authorized'])
        self.assertTrue(self.teacher.get('/api/quizzes/forms').json()['instructor_authorized'])
        room = self.room()
        self.assertTrue(self.teacher.get('/api/quizzes/rooms/' + room['id']).json()['can_manage'])
        self.post('rooms/join', 'client-contract-join', join_code=room['join_code'])
        self.assertFalse(self.client.get('/api/quizzes/rooms/' + room['id']).json()['can_manage'])

        self.teacher_app.state.settings = replace(self.settings, instructor_profile_ids=())

        self.assertFalse(self.teacher.get('/api/quizzes/rooms/' + room['id']).json()['can_manage'])
        self.assertFalse(self.teacher.get('/api/quizzes/forms').json()['instructor_authorized'])
        denied = self.post('rooms/' + room['id'] + '/start', 'revoked-client-host', client=self.teacher)
        self.assertEqual(denied.status_code, 403)

    def test_completed_question_previews_remain_private_until_the_whole_attempt_finishes(self):
        started = self.post('attempts', module_id='m1')
        self.assertEqual(started.status_code, 201, started.text)
        self.assertNotIn('completed_questions', started.json())
        self.assertIsNone(started.json()['result'])
        original_prompt = started.json()['current_question']['prompt']

        finished = self.finish(started)

        self.assertEqual(len(finished['completed_questions']), finished['progress']['total'])
        self.assertEqual(finished['completed_questions'][0]['prompt'], original_prompt)
        self.assertNotIn('author_only', str(finished['completed_questions']))
        self.assertNotIn('correct_option_id', str(finished['completed_questions']))
        self.content['modules'][0]['lessons'][0]['questions'][0]['prompt'] = 'Changed current-catalog prompt'
        saved = self.client.get('/api/quizzes/attempts/' + finished['id']).json()
        self.assertEqual(saved['completed_questions'][0]['prompt'], original_prompt)

    def test_quiz_title_is_pinned_for_owned_attempt_lists_and_details(self):
        started = self.post('attempts', module_id='m1')
        self.assertEqual(started.status_code, 201, started.text)
        original_title = self.content['modules'][0]['title']
        self.content['modules'][0]['title'] = 'A later edition title'

        detail = self.client.get('/api/quizzes/attempts/' + started.json()['id']).json()
        listed = self.client.get('/api/quizzes/attempts').json()['attempts']

        self.assertEqual(detail['title'], original_title)
        self.assertEqual(listed[0]['title'], original_title)

    def test_host_report_uses_pinned_question_previews_without_giving_students_report_access(self):
        room = self.room()
        self.content['modules'][0]['lessons'][0]['questions'][0]['prompt'] = 'Changed after room creation'

        report = self.teacher.get('/api/quizzes/rooms/' + room['id'] + '/results')

        self.assertEqual(report.status_code, 200, report.text)
        self.assertNotEqual(report.json()['questions'][0]['prompt'], 'Changed after room creation')
        self.assertNotIn('correct_option_id', str(report.json()['questions']))
        self.assertNotIn('author_only', str(report.json()['questions']))
        self.assertEqual(self.client.get('/api/quizzes/rooms/' + room['id'] + '/results').status_code, 403)

    def test_legacy_saved_start_receipt_replays_without_new_preview_or_title_fields(self):
        key = 'legacy-quiz-client-start'
        started = self.post('attempts', key, module_id='m1')
        self.assertEqual(started.status_code, 201, started.text)
        legacy = {field: value for field, value in started.json().items() if field != 'title'}
        async def retain_old_shape():
            async with self.app.state.db.sessions.begin() as db:
                command = await db.get(QuizCommand, (self.student_id, key))
                command.response = legacy
        self.client.portal.call(retain_old_shape)

        replay = self.post('attempts', key, module_id='m1')

        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.json(), legacy)
