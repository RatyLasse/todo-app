# Todo App

A small app for adding, editing, completing, and deleting tasks, with planned AI priority and label suggestions from the task title.

The persistent task API is implemented. The React UI, AI suggestions, and Docker packaging are upcoming [milestones](PLAN.md#milestones).

## Tech stack

- Backend: Python 3.14, FastAPI, SQLite
- Frontend (planned): React, TypeScript, Vite
- LLM (planned): OpenAI Python SDK
- Testing: pytest; Playwright browser tests planned with the frontend
- Tooling: uv, Ruff, ty
- Packaging (planned): Docker

## Quick start

Docker is not required for local development. Install [uv](https://docs.astral.sh/uv/), then run from the repository root:

```sh
uv sync --all-groups
uv run uvicorn todo_app.main:app --reload
```

uv uses the Python 3.14 version declared in `.python-version` and downloads it if needed. Open <http://localhost:8000/docs> to create, list, update, and delete tasks through the interactive API documentation. The health endpoint is <http://localhost:8000/api/health>.

The backend needs no API key. Tasks persist in `data/tasks.sqlite3` across server restarts; the directory and table are created at startup.

## Local development

The quick-start commands work in PowerShell and POSIX shells. To use a different database file, set `TODO_DATABASE_PATH` before starting the backend. Relative paths are resolved from the working directory. For example, in PowerShell:

```powershell
$env:TODO_DATABASE_PATH = 'data/development.sqlite3'
uv run uvicorn todo_app.main:app --reload
```

Configuration currently comes from environment variables; `.env` loading will be added with AI configuration. Node.js and npm will be needed for the frontend milestone. Vite will run on port 5173 and proxy `/api` to the backend on port 8000.

## Tests

After installing development dependencies with `uv sync --all-groups`, run:

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run ty check
```

Tests use temporary SQLite databases and need neither Docker nor an OpenAI API key. They cover task operations, validation, persistence across app instances, timestamps, stable errors, and safe logging. Test warnings are treated as failures. See [contributor checks](AGENTS.md#verification) and the planned [browser test strategy](PLAN.md#playwright).

## Design overview

FastAPI validates requests, delegates persistence to a small SQLite module, and returns typed JSON responses. Each database operation owns and closes its connection and transaction. The API contract and architecture are defined in [PLAN.md](PLAN.md#interfaces).

The planned React UI will be a small API client. Optional AI suggestions will use controlled values and deterministic fallback on expected failures; users can edit them before saving. See the [LLM design](PLAN.md#llm-design) for prompt strategy and error handling.

## Docker

Docker packaging will be added in milestone 4. Docker is currently unavailable on the development VM, so container build and runtime verification remain pending; local development and backend tests can proceed independently.
