# Trader's Edge API

FastAPI backend for the Trader's Edge app.

## Setup

Install Python 3.12, then install `uv`:

```powershell
pip install uv
```

From this folder, recreate/sync the virtual environment:

```powershell
cd "C:\FYP\Traders Edge V2\Trader's Edge\server"
uv sync
```

## Run

```powershell
uv run fastapi dev app/main.py
```

Or use the project script:

```powershell
uv run server
```

The API runs at:

```text
http://127.0.0.1:8000
```

Useful endpoints:

```text
GET /health
GET /
```

FastAPI docs:

```text
http://127.0.0.1:8000/docs
```
