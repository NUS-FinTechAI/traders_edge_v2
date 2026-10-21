"""Quiz question bank (`content/quiz_bank.json`), kept separate from lesson check questions."""

from dataclasses import dataclass
from pathlib import Path

from app.content.checks import fail, items, keys, question, read, text, unique, whole

PATH = Path(__file__).resolve().parents[1] / 'content' / 'quiz_bank.json'


@dataclass(frozen=True)
class QuizBank:
    version: str
    questions: dict

    def chapter(self, number):
        return [item for item in self.questions.values() if item['chapter'] == number]


def validate_bank(data):
    keys('quiz_bank.json', data, {'version', 'questions'})
    text('quiz_bank.json.version', data['version'], 40)
    for index, item in enumerate(items('quiz_bank.json.questions', data['questions'], 1, 5000)):
        where = f'quiz_bank.json.questions[{index}]'
        question(where, item, {'chapter', 'concepts', 'difficulty'})
        whole(where + '.chapter', item['chapter'], 1, 50)
        whole(where + '.difficulty', item['difficulty'], 1, 3)
        for number, concept in enumerate(items(where + '.concepts', item['concepts'], 1, 10)):
            text(f'{where}.concepts[{number}]', concept, 60)
    unique('quiz_bank.json ids', [item['id'] for item in data['questions']])
    return QuizBank(data['version'], {item['id']: item for item in data['questions']})


def load_bank(path=PATH):
    return validate_bank(read(path))


def check_chapters(bank, chapter_count, minimum):
    for number in range(1, chapter_count + 1):
        if len(bank.chapter(number)) < minimum:
            fail('quiz_bank.json', f'chapter {number} needs at least {minimum} questions')
    extra = sorted({item['chapter'] for item in bank.questions.values()} - set(range(1, chapter_count + 1)))
    if extra:
        fail('quiz_bank.json', f'has questions for chapters that do not exist: {extra}')
