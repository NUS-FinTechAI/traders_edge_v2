from progression_fixtures import AppCase


class QuizTests(AppCase):
    def start(self, **body):
        response = self.client.post('/api/quizzes/attempts', json=body)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def answer(self, attempt, question, option_id, **extra):
        return self.client.post(f'/api/quizzes/attempts/{attempt["id"]}/answers',
                                json={'question_id': question['id'], 'option_id': option_id, **extra})

    def key(self, question_id):
        return self.content.quiz.questions[question_id]['answer']

    def wrong(self, question):
        return next(option['id'] for option in question['options'] if option['id'] != self.key(question['id']))

    def finish(self, attempt, correct):
        state = attempt
        for index, question in enumerate(attempt['questions']):
            option = self.key(question['id']) if index < correct else self.wrong(question)
            state = self.answer(attempt, question, option).json()
        return state

    def test_topics_lock_chapters_that_are_not_unlocked(self):
        topics = {topic['id']: topic for topic in self.client.get('/api/quizzes').json()['topics']}
        locked = self.client.post('/api/quizzes/attempts', json={'topic_id': 'chapter-2'})
        missing = self.client.post('/api/quizzes/attempts', json={'topic_id': 'chapter-9'})

        self.assertEqual(list(topics), ['chapter-1', 'chapter-2', 'chapter-3', 'daily-review', 'mixed'])
        self.assertEqual((topics['chapter-1']['locked'], topics['chapter-2']['locked']), (False, True))
        self.assertEqual((topics['chapter-1']['questions'], topics['daily-review']['questions'], topics['mixed']['questions']), (10, 5, 20))
        self.assertEqual(locked.status_code, 403)
        self.assertEqual(missing.status_code, 404)

    def test_chapter_quiz_draws_ten_items_from_its_chapter_with_stable_shuffled_options(self):
        attempt = self.start(topic_id='chapter-1')
        again = self.client.get(f'/api/quizzes/attempts/{attempt["id"]}').json()

        self.assertEqual(len(attempt['questions']), 10)
        self.assertTrue(all(self.content.quiz.questions[q['id']]['chapter'] == 1 for q in attempt['questions']))
        self.assertEqual(again['questions'], attempt['questions'])
        self.assertTrue(all(q['answered'] is None for q in attempt['questions']))
        self.assertNotIn('answer', attempt['questions'][0])

    def test_first_answer_is_final_with_instant_feedback(self):
        attempt = self.start(topic_id='chapter-1')
        question = attempt['questions'][0]
        wrong = self.wrong(question)

        first = self.answer(attempt, question, wrong).json()
        same = self.answer(attempt, question, wrong)
        changed = self.answer(attempt, question, self.key(question['id']))

        feedback = first['questions'][0]['answered']
        self.assertEqual((feedback['option_id'], feedback['correct'], feedback['correct_option_id']), (wrong, False, self.key(question['id'])))
        self.assertTrue(feedback['explanation'])
        self.assertEqual(same.status_code, 200)
        self.assertEqual((changed.status_code, changed.json()['detail']), (409, 'Your first answer to this question is final'))
        self.assertEqual(first['score'], 0)

    def test_passing_a_chapter_quiz_pays_xp_on_the_first_pass_only(self):
        failed = self.finish(self.start(topic_id='chapter-1'), correct=7)
        passed = self.finish(self.start(topic_id='chapter-1'), correct=8)
        repeat = self.finish(self.start(topic_id='chapter-1'), correct=10)
        topic = self.client.get('/api/quizzes').json()['topics'][0]

        self.assertEqual((failed['status'], failed['passed'], failed['xp']), ('complete', False, 0))
        self.assertEqual((passed['passed'], passed['xp']), (True, 20))
        self.assertEqual((repeat['passed'], repeat['xp']), (True, 0))
        self.assertEqual((topic['best'], topic['passed']), (10, True))

    def test_mixed_mastery_and_daily_review_rewards(self):
        mixed = self.finish(self.start(topic_id='mixed'), correct=16)
        review = self.finish(self.start(topic_id='daily-review'), correct=0)
        second_review = self.finish(self.start(topic_id='daily-review'), correct=5)

        self.assertEqual((mixed['total'], mixed['passed'], mixed['xp']), (20, True, 50))
        self.assertTrue(all(self.content.quiz.questions[q['id']]['chapter'] == 1 for q in mixed['questions']))
        self.assertEqual((review['total'], review['passed'], review['xp']), (5, None, 10))
        self.assertEqual(second_review['xp'], 0)

    def test_answers_to_unknown_questions_and_options_are_rejected(self):
        attempt = self.start(topic_id='chapter-1')
        other = self.content.quiz.chapter(2)[0]

        self.assertEqual(self.answer(attempt, other, 'a').status_code, 404)
        self.assertEqual(self.answer(attempt, attempt['questions'][0], 'z').status_code, 422)
        self.switch_user()
        self.assertEqual(self.client.get(f'/api/quizzes/attempts/{attempt["id"]}').status_code, 404)

    def test_quiz_master_and_calibrated_badges(self):
        for _ in range(10):
            attempt = self.start(topic_id='chapter-1')
            for question in attempt['questions'][:2]:
                self.answer(attempt, question, self.key(question['id']), confidence='sure')
            for question in attempt['questions'][2:]:
                self.answer(attempt, question, self.key(question['id']))
        badges = {badge['id']: badge for badge in self.client.get('/api/me/collection').json()['badges']}

        self.assertTrue(badges['badge-quiz-master']['earned'])
        self.assertTrue(badges['badge-calibrated']['earned'])

    def test_rooms_show_the_host_every_result_and_members_only_their_own(self):
        host_id = self.user_id
        host_cookie = self.client.cookies.get('traders_edge_session')
        room = self.client.post('/api/quizzes/rooms', json={'topic_id': 'chapter-5', 'title': 'Period 3'})
        self.assertEqual(room.status_code, 404)
        room = self.client.post('/api/quizzes/rooms', json={'topic_id': 'chapter-2', 'title': 'Period 3'}).json()
        self.assertRegex(room['code'], r'^[A-HJ-NP-Z2-9]{6}$')

        self.switch_user()
        self.client.patch('/api/me', json={'display_name': 'Student A'})
        attempt = self.start(room_code=room['code'].lower())
        finished = self.finish(attempt, correct=10)
        resumed = self.start(room_code=room['code'])
        member_view = self.client.get(f'/api/quizzes/rooms/{room["id"]}').json()
        me = self.client.get('/api/me').json()

        self.switch_user()
        self.client.patch('/api/me', json={'display_name': 'Student B'})
        self.start(room_code=room['code'])
        outsider = self.switch_user()
        hidden = self.client.get(f'/api/quizzes/rooms/{room["id"]}')
        self.client.cookies.clear()
        self.client.cookies.set('traders_edge_session', host_cookie)
        host_view = self.client.get(f'/api/quizzes/rooms/{room["id"]}').json()

        self.assertNotEqual(outsider, host_id)
        self.assertEqual((finished['room_id'], finished['xp'], finished['passed']), (room['id'], 0, True))
        self.assertEqual(resumed['id'], attempt['id'])
        self.assertEqual(me['xp'], 0)
        self.assertEqual(member_view['results'], [{'name': 'Student A', 'score': 10, 'total': 10, 'finished': True}])
        self.assertEqual(member_view['my_attempt_id'], attempt['id'])
        self.assertFalse(member_view['is_host'])
        self.assertEqual(hidden.status_code, 404)
        self.assertTrue(host_view['is_host'])
        self.assertEqual(host_view['members'], 2)
        self.assertEqual(sorted((row['name'], row['finished']) for row in host_view['results']), [('Student A', True), ('Student B', False)])
        self.assertEqual(host_view['topic_title'], 'Chapter 2: Fixture Chapter 2')

    def test_unknown_room_code_is_rejected(self):
        response = self.client.post('/api/quizzes/attempts', json={'room_code': 'ZZZZZZ'})

        self.assertEqual(response.status_code, 404)
