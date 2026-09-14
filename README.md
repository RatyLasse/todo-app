# Todo App

A small app for adding, editing, completing, and deleting tasks, with optional AI priority and label suggestions from the task title.

Currently in planning/scaffolding: the setup and test commands below will become available during implementation. See [implementation progress](PLAN.md#milestones).

## Tech stack

- Backend: Python 3.14, FastAPI, SQLite
- Frontend: React, TypeScript, Vite
- LLM: OpenAI Python SDK
- Testing: pytest, Playwright
- Tooling: uv, Ruff, ty
- Packaging: Docker

## Quick start

With Docker installed:

```sh
cp .env.example .env
docker compose up --build
```

Open <http://localhost:8000>. To enable AI suggestions, set your OpenAI API key in `.env` using `.env.example` as a guide. Without a key, task management works and suggestions use clearly identified defaults.

## Local development

Install Python 3.14, [uv](https://docs.astral.sh/uv/), Node.js, and npm, then install dependencies:

```sh
uv sync --all-groups
npm --prefix frontend ci
```

uv uses public PyPI by default. If a lock unexpectedly references a private index, check `UV_INDEX` and `UV_EXTRA_INDEX_URL`; environment variables override project settings.

Run the backend and frontend in separate terminals:

```sh
uv run uvicorn todo_app.main:app --app-dir src --reload
npm --prefix frontend run dev
```

Vite runs at <http://localhost:5173> and proxies `/api` to FastAPI at <http://localhost:8000>.

## Tests

After installing development dependencies, install Chromium once:

```sh
npm --prefix frontend exec -- playwright install chromium
```

Run backend and browser tests:

```sh
uv run pytest
npm --prefix frontend run test:e2e
```

Tests use an isolated database and replace the AI provider; no OpenAI API key is needed. Contributor checks and conventions are in [AGENTS.md](AGENTS.md#verification).

## Design overview

FastAPI owns the API, SQLite persistence, and OpenAI integration; React is a small API client. Docker serves both from one origin. Optional AI suggestions use validated, controlled values and deterministic fallback on expected failures; users can edit them before saving. See [PLAN.md](PLAN.md#llm-design) for prompt strategy and error handling.
