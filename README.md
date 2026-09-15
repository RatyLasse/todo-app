# Todo App

A small app for adding, editing, completing, and deleting tasks, with planned AI priority and label suggestions from the task title.

The task API and React UI are implemented. AI suggestions and a simpler local demo workflow are upcoming [milestones](PLAN.md#milestones).

## Tech stack

- Backend: Python 3.14, FastAPI, SQLite
- Frontend: React, TypeScript, Vite
- LLM (planned): OpenAI Python SDK
- Testing: pytest, Playwright
- Tooling: uv, Ruff, ty

## Quick start

Install [uv](https://docs.astral.sh/uv/) and [Node.js 24 LTS](https://nodejs.org/en/download) (including npm), then install dependencies from the repository root:

```sh
uv sync --all-groups
npm --prefix frontend ci
```

Start the backend in one terminal:

```sh
uv run uvicorn todo_app.main:app --reload
```

Start the frontend in a second terminal, also from the repository root:

```sh
npm --prefix frontend run dev
```

Open **<http://127.0.0.1:5173>** for the task UI. Add tasks, edit their title/priority/label, mark them complete or incomplete, and delete them after confirmation.

uv uses the Python 3.14 version declared in `.python-version` and downloads it if needed. The backend provides interactive API documentation at <http://127.0.0.1:8000/docs> and a health endpoint at <http://127.0.0.1:8000/api/health>. Port 8000 serves the API; its root `/` does not serve the UI during local development.

The backend needs no API key. Tasks persist in `data/tasks.sqlite3` across server restarts; the directory and table are created at startup.

## Local development

The quick-start commands work in PowerShell and POSIX shells. On Windows, open a new terminal after installing Node.js so `node` and `npm` are on `PATH`. A portable Node.js distribution also works when its extracted directory is added to the terminal's `PATH`.

To use a different database file, set `TODO_DATABASE_PATH` before starting the backend. Relative paths are resolved from the working directory. For example, in PowerShell:

```powershell
$env:TODO_DATABASE_PATH = 'data/development.sqlite3'
uv run uvicorn todo_app.main:app --reload
```

Configuration currently comes from environment variables; `.env` loading will be added with AI configuration. Vite proxies `/api` to the backend. It fails if port 5173 is occupied instead of silently selecting another port. For a backend on a different address, set `TODO_API_PROXY` before starting Vite.

Build the frontend with strict TypeScript checks:

```sh
npm --prefix frontend run build
```

The generated files are written to `frontend/dist`. Serving that build from FastAPI is planned for the [local demo workflow](#local-demo-planned).

## Tests

After installing development dependencies with `uv sync --all-groups`, run:

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run ty check
```

Tests use temporary SQLite databases and need no OpenAI API key. They cover task operations, validation, persistence across app instances, timestamps, stable errors, and safe logging. Test warnings are treated as failures. See [contributor checks](AGENTS.md#verification).

Install Chromium once, then run the browser tests:

```sh
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e
```

Playwright starts its own backend and frontend on ports 18000 and 15173 and refuses to reuse existing servers. Its temporary database is separate from your tasks. The suite runs the manual task workflow and failure recovery in desktop and mobile Chromium; no manual server startup is needed. Traces and screenshots for failed tests are saved under `frontend/test-results` and can contain test task text.

## Design overview

FastAPI validates requests, delegates persistence to a small SQLite module, and returns typed JSON responses. Each database operation owns and closes its connection and transaction. The API contract and architecture are defined in [PLAN.md](PLAN.md#interfaces).

React uses a small typed API client and local state. One form supports creation and editing; task rows support completion and deletion. Failed saves preserve the draft. Successful mutations update the displayed task from the API response and refetch the list; a failed refresh keeps the confirmed change visible and offers manual retry.

Optional AI suggestions will use controlled values and deterministic fallback on expected failures; users can edit them before saving. See the [LLM design](PLAN.md#llm-design) for prompt strategy and error handling.

## Local demo (planned)

Milestone 4 will add a convenient local start command after dependency installation and the frontend build. FastAPI will serve the built UI and API from one process and port. Until then, use the two-terminal [quick start](#quick-start). See the [local delivery plan](PLAN.md#local-delivery) for the approach and why Docker is outside scope.
