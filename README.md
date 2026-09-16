# Todo App

A small task manager for adding, editing, completing, and deleting tasks, with optional AI suggestions for priority and label. Core task management works without an API key or an available provider.

Built with FastAPI and SQLite, React and TypeScript, Vite, OpenRouter via the OpenAI Python SDK, pytest, Playwright, uv, Ruff, and ty.

## Run the demo

Install [uv](https://docs.astral.sh/uv/) and [Node.js 24 LTS](https://nodejs.org/en/download), including npm. From the repository root, install dependencies, build the frontend, and start the single-process demo:

```sh
uv sync --all-groups
npm --prefix frontend ci
npm --prefix frontend run build
uv run todo-demo
```

Open **<http://127.0.0.1:8000>**. FastAPI serves the built React UI, API, and interactive API documentation from one loopback process. Use `uv run todo-demo --port 8001` when port 8000 is occupied. A missing frontend build produces setup instructions and exits.

Tasks persist in `data/tasks.sqlite3` across restarts. The app uses fallback AI suggestions when no API key is configured, so the demo is fully usable offline.

## Develop with live reload

`uv run todo-demo` is the normal way to run the app. When actively changing code, use the two-terminal setup below for automatic backend and frontend reloads:

```sh
uv run uvicorn todo_app.main:app --reload
```

```sh
npm --prefix frontend run dev
```

Open **<http://127.0.0.1:5173>** for the development UI. The Vite server proxies `/api` to FastAPI on port 8000. The API documentation is at <http://127.0.0.1:8000/docs>, and its health endpoint is <http://127.0.0.1:8000/api/health>.

The frontend build is written to `frontend/dist`; rebuild it after frontend changes when using the demo. Set `TODO_DATABASE_PATH` to use another SQLite file.

## AI suggestions

Enter a task title and click **Suggest priority and label**. The result fills editable form fields but never saves a task. You can keep editing while a suggestion is pending; changing the draft, saving, switching tasks, or canceling prevents a late response from overwriting it.

Without an API key, or when the provider fails, the UI shows `Medium` / `Other` fallback values. This covers timeouts, rate limits, refused or incomplete responses, and invalid provider output. Browser request failures preserve the current values and allow retry or manual entry.

The default provider is [OpenRouter](https://openrouter.ai) using the free [Nex-AGI Nex-N2.5 Mini model](https://openrouter.ai/nex-agi/nex-n2.5-mini%3Afree). To enable live suggestions:

1. Create an OpenRouter key from [OpenRouter](https://openrouter.ai/settings/keys).
2. Create `.env` from [.env.example](.env.example) and set `OPENROUTER_API_KEY`.
3. Restart the backend and request a suggestion from the UI.

The key stays on the backend. Only the suggestion action sends the title to OpenRouter; task creation and editing do not call the provider. For the prompt, structured output, validation, timeout, and fallback policy, see the [LLM design](PLAN.md#llm-design).

To check the live integration without starting development servers or changing your task database:

```sh
uv run python scripts/check_ai.py
```

The check uses three canned examples and succeeds when all receive valid LLM suggestions. Free model availability and rate limits can change; fallback behavior remains the default safety net.

## Tests

Run the backend tests and quality checks from the repository root:

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run ty check
npm --prefix frontend run build
```

Install Chromium once, then run the development browser suite:

```sh
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e
```

The browser suite covers task management, failure recovery, editable suggestions, fallback behavior, and cancellation safety on desktop and mobile Chromium. It starts isolated servers and databases; it does not require an API key or call a live provider.

To build the UI and smoke-test the single-process demo:

```sh
npm --prefix frontend run test:demo
```

This suite runs the task workflow, editable suggestion review, and missing-key fallback against FastAPI serving the built UI.

## Design notes

FastAPI validates JSON at the API boundary and delegates task persistence to SQLite. The React client keeps form state locally, preserves drafts after failed saves, and applies confirmed server responses before refreshing the list.

The AI adapter sends the title as untrusted text to OpenRouter with a fixed classification prompt and a strict JSON Schema. It validates the response locally, assigns the `source` field on the server, disables provider retries, and falls back to deterministic defaults for expected provider failures. Detailed contracts, architecture, and test strategy are in [PLAN.md](PLAN.md).
