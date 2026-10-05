"""Contract regressions for progression, review status and private answer data."""

import hashlib
import json
import unittest

from .catalog import load_catalog
from .validate import ContentValidationError, validate_catalog


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.catalog = load_catalog()

    def test_complete_catalog(self):
        validate_catalog(self.catalog)
        self.assertEqual(sum(len(m["lessons"]) for m in self.catalog["modules"]), 30)
        questions = [q for m in self.catalog["modules"] for l in m["lessons"] for q in l["questions"]]
        questions += [q for m in self.catalog["modules"] for q in m["assessment"]]
        self.assertEqual(len(questions), 110)
        self.assertEqual({q["correct_option_id"] for q in questions}, {"a", "b", "c"})

    def test_interactive_tasks_are_explicit_and_validated(self):
        module = self.catalog['modules'][0]
        self.assertTrue(module['entry_tasks'])
        self.assertTrue(all(l['tasks'] and l['bonus_tasks'] for l in module['lessons']))
        self.assertEqual({t['type'] for l in module['lessons'] for t in l['tasks']}, {'instruction', 'choice', 'classification'})
        module['lessons'][0]['tasks'][0]['type'] = 'client_complete'
        with self.assertRaisesRegex(ContentValidationError, 'task type'):
            validate_catalog(self.catalog)

    def test_interactive_unknown_assignment_and_missing_sequence_rejected(self):
        lesson = self.catalog['modules'][0]['lessons'][0]
        task = next(t for t in lesson['tasks'] if t['type'] == 'classification')
        task['correct_assignments'][task['items'][0]['id']] = 'unknown'
        with self.assertRaisesRegex(ContentValidationError, 'assignment'):
            validate_catalog(self.catalog)
        self.catalog = load_catalog()
        self.catalog['modules'][0]['lessons'][1]['tasks'] = []
        with self.assertRaisesRegex(ContentValidationError, 'tasks'):
            validate_catalog(self.catalog)

    def test_legacy_question_bank_is_unchanged(self):
        bank = [{'practice': [l['questions'] for l in m['lessons']], 'exit': m['assessment']} for m in self.catalog['modules']]
        digest = hashlib.sha256(json.dumps(bank, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        self.assertEqual(digest, '05a76d82db81037db00f93205e411719d1fe6f50882f8b1e58883c9e27d6048e')

    def test_new_edition_remains_pending_independent_review(self):
        self.assertEqual(self.catalog['schema_version'], 1)
        self.assertEqual(self.catalog['content_version'], '2026-10-04.2')
        pending = 'authored_requires_independent_review'
        self.assertEqual(self.catalog['review_status'], pending)
        for module in self.catalog['modules']:
            self.assertEqual(module['review_status'], pending)
            self.assertEqual(module['optional'], module['order'] == 10)
            for lesson in module['lessons']:
                self.assertEqual(lesson['review_status'], pending)
                self.assertEqual(lesson['activity_kind'], 'guided_decision')
                self.assertTrue(lesson['source_basis'])

    def test_loader_returns_independent_data(self):
        self.catalog["modules"][0]["lessons"].clear()
        self.assertEqual(len(load_catalog()["modules"][0]["lessons"]), 3)

    def test_unknown_answer_is_rejected(self):
        self.catalog["modules"][0]["lessons"][0]["questions"][0]["correct_option_id"] = "missing"
        with self.assertRaisesRegex(ContentValidationError, "answer key"):
            validate_catalog(self.catalog)

    def test_duplicate_ids_are_rejected(self):
        questions = self.catalog["modules"][0]["lessons"][0]["questions"]
        questions[1]["id"] = questions[0]["id"]
        with self.assertRaisesRegex(ContentValidationError, "duplicate id"):
            validate_catalog(self.catalog)

    def test_unknown_source_is_rejected(self):
        self.catalog["modules"][0]["lessons"][0]["source_basis"] = ["invented-source"]
        with self.assertRaisesRegex(ContentValidationError, "unknown source"):
            validate_catalog(self.catalog)

    def test_skipped_prerequisite_is_rejected(self):
        self.catalog["modules"][2]["prerequisite_module_ids"] = []
        with self.assertRaisesRegex(ContentValidationError, "module prerequisites"):
            validate_catalog(self.catalog)

    def test_skipped_lesson_is_rejected(self):
        self.catalog["modules"][0]["lessons"][2]["prerequisite_lesson_ids"] = ["m01-l01"]
        with self.assertRaisesRegex(ContentValidationError, "lesson prerequisites"):
            validate_catalog(self.catalog)

    def test_missing_cycle_step_is_rejected(self):
        del self.catalog["modules"][0]["lessons"][0]["learning_cycle"]["reflection"]
        with self.assertRaisesRegex(ContentValidationError, "learning cycle"):
            validate_catalog(self.catalog)

    def test_nested_private_data_in_public_cycle_is_rejected(self):
        self.catalog["modules"][0]["lessons"][0]["learning_cycle"]["prediction"] = {"future_path": [5, 9]}
        with self.assertRaisesRegex(ContentValidationError, "expected nonempty text"):
            validate_catalog(self.catalog)

    def test_module_without_critical_checks_is_rejected(self):
        for q in self.catalog["modules"][0]["assessment"]:
            q["critical"] = False
        with self.assertRaisesRegex(ContentValidationError, "critical risk"):
            validate_catalog(self.catalog)

    def test_catalog_cannot_claim_review_ahead_of_lessons(self):
        self.catalog["review_status"] = "approved"
        with self.assertRaisesRegex(ContentValidationError, "unreviewed content"):
            validate_catalog(self.catalog)

    def test_review_interval_matches_service(self):
        self.assertEqual(self.catalog["assessment_policy"]["review_interval_days"], 1)
        self.assertTrue(all(l["review_after_days"] == 1 for m in self.catalog["modules"] for l in m["lessons"]))


    def choice_banks(self, catalog):
        module = catalog['modules'][0]
        lesson = module['lessons'][0]
        return {
            'diagnostic': module['entry_tasks'][0],
            'practice': next(t for t in lesson['tasks'] if t['type'] == 'choice'),
            'bonus': lesson['bonus_tasks'][0],
            'review_question': lesson['questions'][0],
            'assessment_question': module['assessment'][0],
        }

    def replace_correct_option_id(self, item, identifier):
        option = next(o for o in item['options'] if o['id'] == item['correct_option_id'])
        option['id'] = identifier
        item['correct_option_id'] = identifier

    def test_choice_option_ids_reject_unsubmittable_answer_keys(self):
        for bank in self.choice_banks(self.catalog):
            for identifier in ('x' * 101, ' leading', 'trailing ', '\twrapped\n'):
                with self.subTest(bank=bank, identifier=identifier):
                    content = load_catalog()
                    self.replace_correct_option_id(self.choice_banks(content)[bank], identifier)
                    with self.assertRaisesRegex(ContentValidationError, 'option id'):
                        validate_catalog(content)

    def test_classification_ids_reject_trimmed_assignments(self):
        for group in ('items', 'categories'):
            with self.subTest(group=group):
                content = load_catalog()
                task = next(t for t in content['modules'][0]['lessons'][0]['tasks'] if t['type'] == 'classification')
                old = task[group][0]['id']
                new = ' ' + old
                task[group][0]['id'] = new
                assignments = task['correct_assignments']
                task['correct_assignments'] = {new if group == 'items' and key == old else key: new if group == 'categories' and value == old else value for key, value in assignments.items()}
                with self.assertRaisesRegex(ContentValidationError, 'trim-stable identifier'):
                    validate_catalog(content)

    def test_choice_option_ids_accept_submission_length_boundary(self):
        for bank in self.choice_banks(self.catalog):
            with self.subTest(bank=bank):
                content = load_catalog()
                self.replace_correct_option_id(self.choice_banks(content)[bank], 'x' * 100)
                validate_catalog(content)


if __name__ == "__main__":
    unittest.main()
