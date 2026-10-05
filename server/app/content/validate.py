"""Validate the private curriculum contract without network or third-party packages."""

import re
from typing import Any
from urllib.parse import urlparse

from .catalog import load_catalog
from app.simulation.bindings import valid_binding

MODULE_TITLES = (
    "Money Before Markets", "How Markets Work", "Investment Products",
    "Building a Portfolio", "Safe Execution", "Managing Risk",
    "Making Decisions", "Psychology and Protection", "Integrated Simulation",
    "Optional Advanced Paths",
)
CYCLE_FIELDS = {
    "question", "explanation", "worked_example", "prediction", "guided_decision",
    "feedback", "reflection", "delayed_review", "mastery_check",
}
REVIEW_STATUSES = {"authored_requires_independent_review", "approved"}


class ContentValidationError(ValueError):
    """The authored content violates the service contract."""


def valid_choice_option_id(value: Any) -> bool:
    """Match the identifier limits and whitespace handling of answer submissions."""
    return isinstance(value, str) and 1 <= len(value) <= 100 and value == value.strip()


def validate_catalog(catalog: dict[str, Any]) -> None:
    """Reject incomplete content, ambiguous answer keys and inconsistent progression."""
    def require(condition: bool, message: str) -> None:
        if not condition:
            raise ContentValidationError(message)

    def text(value: Any, location: str) -> None:
        require(isinstance(value, str) and bool(value.strip()), f"{location}: expected nonempty text")

    require(isinstance(catalog, dict), "catalog: expected object")
    require(type(catalog.get("schema_version")) is int and catalog["schema_version"] == 1, "unsupported schema version")
    for key in ("content_version", "content_notice"):
        text(catalog.get(key), key)
    require(catalog.get("review_status") in REVIEW_STATUSES, "invalid catalog review status")
    seen: set[str] = set()

    def identifier(value: Any, location: str) -> None:
        require(isinstance(value, str) and bool(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value)), f"{location}: invalid id")
        require(value not in seen, f"{location}: duplicate id {value}")
        seen.add(value)

    sources = catalog.get("sources")
    require(isinstance(sources, list) and len(sources) > 0, "sources: expected nonempty list")
    for entry in sources:
        require(isinstance(entry, dict), "source: expected object")
        identifier(entry.get("id"), "source")
        for key in ("title", "url", "reviewed_on", "scope"):
            text(entry.get(key), f"source.{key}")
        url = urlparse(entry["url"])
        require(url.scheme == "https" and bool(url.hostname) and not url.username, "source: expected public HTTPS URL")
        require(bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", entry["reviewed_on"])), "source: invalid review date")
    source_ids = {entry["id"] for entry in sources}

    def references(value: Any, location: str) -> None:
        require(isinstance(value, list) and bool(value), f"{location}: source basis required")
        require(all(isinstance(item, str) and item in source_ids for item in value), f"{location}: unknown source")
        require(len(value) == len(set(value)), f"{location}: duplicate source")

    def question(item: Any, prefix: str) -> None:
        require(isinstance(item, dict), f"{prefix}: expected question object")
        identifier(item.get("id"), prefix)
        require(item["id"].startswith(prefix), f"{prefix}: question id outside owner")
        for key in ("prompt", "explanation"):
            text(item.get(key), f"{item['id']}.{key}")
        require(type(item.get("critical")) is bool, f"{item['id']}: critical must be boolean")
        options = item.get("options")
        require(isinstance(options, list) and len(options) == 3, f"{item['id']}: three options required")
        option_ids = []
        for option in options:
            require(isinstance(option, dict), f"{item['id']}: option must be object")
            require(valid_choice_option_id(option.get("id")), f"{item['id']}.option.id: invalid choice option id (expected trim-stable text of one to 100 characters)")
            text(option.get("text"), f"{item['id']}.option.text")
            option_ids.append(option["id"])
        require(len(set(option_ids)) == len(option_ids), f"{item['id']}: duplicate option ids")
        require(len({option['text'] for option in options}) == len(options), f"{item['id']}: duplicate option text")
        require(item.get("correct_option_id") in option_ids, f"{item['id']}: answer key not in options")

    def tasks(items: Any, prefix: str, teaching: bool = False, bound: bool = False) -> None:
        require(isinstance(items, list) and bool(items), f"{prefix}: tasks required")
        types = set()
        for item in items:
            require(isinstance(item, dict), f"{prefix}: task must be object")
            kind = item.get('type')
            require(isinstance(kind, str) and kind in {'instruction', 'choice', 'classification', 'simulation'}, f"{prefix}: unsupported task type")
            types.add(kind)
            identifier(item.get('id'), prefix)
            require(item['id'].startswith(prefix), f"{prefix}: task id outside owner")
            text(item.get('prompt'), f"{prefix}.prompt")
            common = {'id', 'type', 'prompt'}
            if kind == 'instruction':
                require(teaching, f"{prefix}: assessment and bonus tasks must be graded")
                require(set(item) == common | {'text'}, f"{prefix}: unexpected instruction fields")
                text(item.get('text'), f"{prefix}.text")
                continue
            text(item.get('explanation'), f"{prefix}.explanation")
            require(type(item.get('critical')) is bool, f"{prefix}: critical must be boolean")
            common |= {'explanation', 'critical'}
            if kind == 'simulation':
                require(bound and teaching and item is items[-1] and set(item) == common and item['critical'], f'{prefix}: simulation must be the final bound graded task')
                continue
            groups = ('options',) if kind == 'choice' else ('items', 'categories')
            ids = {}
            for group in groups:
                values = item.get(group)
                require(isinstance(values, list) and 2 <= len(values) <= 20, f"{prefix}: {group} need two to twenty entries")
                for value in values:
                    require(isinstance(value, dict) and set(value) == {'id', 'text'}, f"{prefix}: invalid {group}")
                    text(value['id'], f"{prefix}.{group}.id")
                    require(group == 'options' or value['id'] == value['id'].strip(), f"{prefix}.{group}.id: expected trim-stable identifier")
                    if group == 'options':
                        require(valid_choice_option_id(value['id']), f"{prefix}.{group}.id: invalid choice option id (expected trim-stable text of one to 100 characters)")
                    text(value['text'], f"{prefix}.{group}.text")
                ids[group] = {v['id'] for v in values}
                require(len(ids[group]) == len(values), f"{prefix}: duplicate {group} id")
            if kind == 'choice':
                require(set(item) == common | {'options', 'correct_option_id'}, f"{prefix}: unexpected choice fields")
                require(item.get('correct_option_id') in ids['options'], f"{prefix}: invalid answer key")
            else:
                require(set(item) == common | {'items', 'categories', 'correct_assignments'}, f"{prefix}: unexpected classification fields")
                assignments = item.get('correct_assignments')
                require(isinstance(assignments, dict) and set(assignments) == ids['items'] and all(isinstance(v, str) and v in ids['categories'] for v in assignments.values()), f"{prefix}: invalid classification assignment")
        require(sum(item['type'] == 'simulation' for item in items) == int(bound), f'{prefix}: exactly one simulation task per binding required')
        require(types - {'instruction'}, f"{prefix}: graded tasks required")
        if teaching:
            require('instruction' in types, f"{prefix}: authored teaching tasks required")

    modules = catalog.get("modules")
    require(isinstance(modules, list) and len(modules) == 10, "exactly ten complete modules required")
    previous_module = None
    for number, module in enumerate(modules, 1):
        require(isinstance(module, dict), "module: expected object")
        identifier(module.get("id"), "module")
        require(module["id"].startswith(f"m{number:02}-"), "module id/order mismatch")
        require(module.get("order") == number and module.get("title") == MODULE_TITLES[number - 1], "module order/title mismatch")
        text(module.get("description"), f"{module['id']}.description")
        require(module.get("review_status") in REVIEW_STATUSES, "module: invalid review status")
        require(module.get("optional") is (number == 10), "only advanced path is optional")
        require(module.get("prerequisite_module_ids") == ([previous_module] if previous_module else []), "module prerequisites must follow source order")
        lessons = module.get("lessons")
        require(isinstance(lessons, list) and 3 <= len(lessons) <= 4, "module needs three or four lessons")
        interactive = 'entry_tasks' in module
        if interactive:
            tasks(module['entry_tasks'], f"m{number:02}-entry-")
        previous_lesson = None
        for index, lesson in enumerate(lessons, 1):
            require(isinstance(lesson, dict), "lesson: expected object")
            identifier(lesson.get("id"), "lesson")
            require(lesson["id"] == f"m{number:02}-l{index:02}", "lesson id/order mismatch")
            for key in ("title", "objective", "explanation", "worked_example"):
                text(lesson.get(key), f"{lesson['id']}.{key}")
            references(lesson.get("source_basis"), lesson["id"])
            require(lesson.get("review_status") in REVIEW_STATUSES, "lesson: invalid review status")
            require(lesson.get("prerequisite_lesson_ids") == ([previous_lesson] if previous_lesson else []), "lesson prerequisites must be sequential")
            require(lesson.get("activity_kind") == "guided_decision", "catalog lessons are decision prompts, not executable orders")
            require(type(lesson.get("review_after_days")) is int and lesson["review_after_days"] > 0, "positive review interval required")
            cycle = lesson.get("learning_cycle")
            require(isinstance(cycle, dict) and set(cycle) == CYCLE_FIELDS, "learning cycle fields must match public string contract")
            for key, value in cycle.items():
                text(value, f"{lesson['id']}.learning_cycle.{key}")
            require(cycle["explanation"] == lesson["explanation"] and cycle["worked_example"] == lesson["worked_example"], "duplicate teaching fields must agree")
            questions = lesson.get("questions")
            require(isinstance(questions, list) and 2 <= len(questions) <= 3, "lesson needs two or three practice questions")
            for item in questions:
                question(item, f"{lesson['id']}-q")
            bound = 'simulation_binding' in lesson
            if bound:
                require(interactive and lesson['id'] == 'm05-l01' and valid_binding(lesson['simulation_binding']), 'invalid simulation binding')
            if interactive:
                tasks(lesson.get('tasks'), f"{lesson['id']}-task-", teaching=True, bound=bound)
                tasks(lesson.get('bonus_tasks'), f"{lesson['id']}-bonus-")
            else:
                require('tasks' not in lesson and 'bonus_tasks' not in lesson, 'interactive tasks require a module diagnostic')
            previous_lesson = lesson["id"]
        check = module.get("assessment")
        require(isinstance(check, list) and 4 <= len(check) <= 5, "module needs four or five mastery questions")
        for item in check:
            question(item, f"m{number:02}-check-q")
        require(sum(item["critical"] for item in check) >= 2, "module needs at least two critical risk checks")
        bonus = module.get("bonus_mission")
        require(isinstance(bonus, dict), "bonus mission required")
        identifier(bonus.get("id"), "bonus mission")
        require(bonus.get("optional") is True, "reflection bonus must be optional")
        require(bonus.get("implementation_status") == "content_only", "bonus implementation claim unsupported")
        for key in ("title", "prompt", "reward_basis"):
            text(bonus.get(key), f"bonus.{key}")
        previous_module = module["id"]
    glossary = catalog.get("glossary")
    require(isinstance(glossary, list) and bool(glossary), "glossary required")
    for entry in glossary:
        require(isinstance(entry, dict), "glossary: expected object")
        identifier(entry.get("id"), "glossary")
        text(entry.get("term"), "glossary.term")
        text(entry.get("definition"), "glossary.definition")
        references(entry.get("source_basis"), entry["id"])
    policy = catalog.get("assessment_policy", {})
    require(policy.get("lesson_required_correct_fraction") == 1.0, "lesson policy must require all practice answers")
    require(policy.get("module_required_correct_fraction") == 0.8, "module policy must require eighty percent")
    require(policy.get("all_critical_required") is True, "critical risk checks may not be averaged away")
    require(policy.get("review_interval_days") == 1, "review interval must match current policy")
    if catalog["review_status"] == "approved":
        require(all(m["review_status"] == "approved" and all(l["review_status"] == "approved" for l in m["lessons"]) for m in modules), "reviewed catalog contains unreviewed content")


def main() -> None:
    catalog = load_catalog()
    validate_catalog(catalog)
    modules = catalog["modules"]
    print(f"Valid curriculum: {len(modules)} modules, {sum(len(m['lessons']) for m in modules)} lessons, "
          f"{sum(len(l['questions']) for m in modules for l in m['lessons'])} practice questions, "
          f"{sum(len(m['assessment']) for m in modules)} mastery questions.")


if __name__ == "__main__":
    main()
