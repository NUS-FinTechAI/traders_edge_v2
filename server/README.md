# API scaffold

Requires Python 3.12 or newer and uv 0.12.23 (CI installs it with `python -m pip install uv==0.12.23`). Run these commands from the repository root:

```sh
uv sync --project server --extra test --locked
uv run --project server --locked python -m uvicorn app.main:app --reload
uv run --project server --extra test --locked python -m unittest discover -s server/tests
```

`GET /health` returns `{"status":"ok"}`. No authentication, persistence or simulator is implemented yet. Allowed browser origins are the two local Vite addresses in `app/main.py`.
