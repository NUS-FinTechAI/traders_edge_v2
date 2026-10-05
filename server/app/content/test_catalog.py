"""Contract regressions for progression, review status and private answer data."""

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


if __name__ == "__main__":
    unittest.main()
