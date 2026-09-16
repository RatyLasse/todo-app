# Todo App

A small app for adding, editing, completing, and deleting tasks, with optional AI priority and label suggestions from the task title.

The task API, React UI, AI suggestions, and [single-process local demo](#local-demo) are implemented.

## Tech stack

- Backend: Python 3.14, FastAPI, SQLite
- Frontend: React, TypeScript, Vite
- LLM: OpenRouter via the OpenAI Python SDK with strict structured output (`nex-agi/nex-n2.5-mini:free`)
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

The app runs without an API key. Tasks persist in `data/tasks.sqlite3` across server restarts; the directory and table are created at startup.

## AI suggestions

Enter a title and click **Suggest priority and label** to fill the editable fields. A suggestion never saves a task; review or change the values, then click **Add task** or **Save changes**. You can keep editing or save manually while a suggestion is pending. Editing the draft, saving, or leaving it cancels the pending browser request and prevents a late response from overwriting your work.

Without an API key, suggestions return **Medium** priority and **Other** label with an explanation that these are fallback defaults. Provider failures, timeouts, refused or incomplete responses, and invalid output use the same fallback. A browser request failure preserves the current values and offers retry or manual entry.

The default is the free [Nex-AGI Nex-N2.5 Mini model on OpenRouter](https://openrouter.ai/nex-agi/nex-n2.5-mini%3Afree). It supports the [structured output](https://openrouter.ai/docs/guides/features/structured-outputs) required by this small classification task. Free model variants are rate limited; exceeding the provider limit produces fallback suggestions. `openrouter/free` can be used when you prefer automatic routing, but a pinned model gives more predictable behavior.

To enable live suggestions:

1. Sign in to [OpenRouter and create an API key](https://openrouter.ai/settings/keys).
2. Create or edit `.env` in the repository root using [.env.example](.env.example). Set `OPENROUTER_API_KEY` to that key and keep the default `OPENROUTER_MODEL` (`nex-agi/nex-n2.5-mini:free`). The filename must be exactly `.env`, not `.env.txt`.
3. Run `uv sync --all-groups` after updating the code, then restart the backend with the [quick-start command](#quick-start).
4. Enter a title such as `Pay the overdue electricity bill urgently today` and click **Suggest priority and label**. Expect High / Finance and the message **AI suggestion applied**. The fallback message means a live suggestion was not obtained.

Keep the key on the backend; `.env` is ignored by Git. Old `OPENAI_API_KEY`, `OPENAI_MODEL`, `GROQ_API_KEY`, and `GROQ_MODEL` entries are ignored and can be removed. The model ID names the model and its creator; requests go to OpenRouter and require an OpenRouter key. A custom `OPENROUTER_MODEL` must support OpenRouter Chat Completions and structured JSON Schema.

For a manual live check from the project root, run:

```sh
uv run python scripts/check_ai.py
```

This explicitly calls OpenRouter for three canned examples through the app's HTTP endpoint using an isolated temporary database. It prints only result metadata and succeeds when all three return the expected values with `source=llm`. It does not require running development servers or modify your task database. This is separate from the automated test suite.

In the UI, only clicking the suggestion button sends the current title to OpenRouter when a key is configured. Task creation and editing do not call the provider. See the [LLM design](PLAN.md#llm-design) for the prompt, validation, timeout, and fallback policy.

## Local development

The quick-start commands work in PowerShell and POSIX shells. On Windows, open a new terminal after installing Node.js so `node` and `npm` are on `PATH`. A portable Node.js distribution also works when its extracted directory is added to the terminal's `PATH`.

To use a different database file, set `TODO_DATABASE_PATH` before starting the backend. Relative paths are resolved from the working directory. For example, in PowerShell:

```powershell
$env:TODO_DATABASE_PATH = 'data/development.sqlite3'
uv run uvicorn todo_app.main:app --reload
```

The backend reads `.env` from its working directory; environment variables take precedence. Explicit settings used by tests bypass both. An empty `OPENROUTER_API_KEY` environment variable forces fallback even if `.env` contains a key. Vite proxies `/api` to the backend. It fails if port 5173 is occupied instead of silently selecting another port. For a backend on a different address, set `TODO_API_PROXY` before starting Vite.

Build the frontend with strict TypeScript checks:

```sh
npm --prefix frontend run build
```

The generated files are written to `frontend/dist`. The [local demo](#local-demo) serves that build from FastAPI; rebuild after changing the frontend.

## Tests

After installing development dependencies with `uv sync --all-groups`, run:

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run ty check
```

Tests use temporary SQLite databases and isolate configuration from local `.env` files and environment variables. They cover task operations, validation, persistence across app instances, timestamps, stable errors, and safe logging. AI tests inject a provider or exercise the OpenAI SDK against a mocked OpenRouter-compatible HTTP transport; they never call a live provider. Coverage includes structured output, missing keys, provider/transport errors, malformed or refused responses, cancellation at the request deadline, and safe logging. Test warnings are treated as failures. See [contributor checks](AGENTS.md#verification).

Install Chromium once, then run the browser tests:

```sh
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e
```

Playwright starts its own backend and frontend on ports 18000 and 15173 and refuses to reuse existing servers. Its temporary database is separate from your tasks. The suite runs the manual task workflow, suggestion review, fallback, failure recovery, and pending-request cancellation in desktop and mobile Chromium. Suggestions use a stubbed browser response or the backend's missing-key fallback; no API key or manual server startup is needed. Traces and screenshots for failed tests are saved under `frontend/test-results` and can contain test task text.

To build the UI and smoke-test the single-process demo in desktop and mobile Chromium:

```sh
npm --prefix frontend run test:demo
```

This runs the task workflow, editable suggestion review, and missing-key fallback against FastAPI on port 18001 using the demo entry point, a temporary database, and an explicitly empty API key. It refuses to reuse an existing server.

## Design overview

FastAPI validates requests, delegates persistence to a small SQLite module, and returns typed JSON responses. Each database operation owns and closes its connection and transaction. The API contract and architecture are defined in [PLAN.md](PLAN.md#interfaces).

React uses a small typed API client and local state. One form supports creation and editing; task rows support completion and deletion. Failed saves preserve the draft. Successful mutations update the displayed task from the API response and refetch the list; a failed refresh keeps the confirmed change visible and offers manual retry.

Optional AI suggestions use controlled values and deterministic fallback on expected failures; users can edit them before saving. See the [LLM design](PLAN.md#llm-design) for prompt strategy and error handling.

## Local demo

From a fresh checkout, install uv and Node.js as described in [quick start](#quick-start), then run these commands from the repository root:

```sh
uv sync --all-groups
npm --prefix frontend ci
npm --prefix frontend run build
uv run todo-demo
```

Open **<http://127.0.0.1:8000>**. FastAPI serves the built UI, `/api`, and `/docs` in one process on the loopback interface. Subsequent starts need only `uv run todo-demo`; stop it with Ctrl+C. Use `uv run todo-demo --port 8001` if port 8000 is occupied. A missing build produces setup instructions and exits.

The demo uses the same `.env` and `TODO_DATABASE_PATH` configuration as [local development](#local-development), so tasks persist across restarts. Only files under `frontend/dist` are served as static content; configuration and SQLite files remain outside that directory. The build is a local checkout artifact, not bundled into a Python wheel. Keep the two-terminal development workflow for automatic reload. See the [local delivery plan](PLAN.md#local-delivery) for why Docker is outside scope.

For an interview rehearsal, add a task, edit it, mark it complete, reload, restart the server to confirm persistence, and delete it after confirmation. Request a suggestion, review or change the fields, and save explicitly. With no API key, the same flow shows editable fallback defaults. The separate [manual AI check](#ai-suggestions) verifies live provider behavior when a key is available.
