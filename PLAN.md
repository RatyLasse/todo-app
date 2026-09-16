# Todo App Implementation Plan

## Goal and success criteria

Deliver the [exercise brief](docs/coding-exercise-ai-agent-developer.md) with local task management and optional AI metadata suggestions. Task management must work without an API key or available provider.

The project is done when:

- the product behavior below works with SQLite persistence and OpenRouter;
- the test strategy passes, including AI fallback paths;
- documented local development and demo workflows work from a clean checkout;
- README accurately explains decisions and commands; and
- the [delivery checklist](#delivery-checklist) is complete.

## Product scope

### Tasks

A task contains:

- a server-generated integer ID;
- a trimmed title of 1–200 characters;
- a completion flag;
- one priority: `low`, `medium`, or `high`;
- one label: `work`, `personal`, `errands`, `finance`, `health`, or `other`; and
- server-generated creation and update timestamps in UTC.

One form and list support creation, title/priority/label editing, completion toggling, and permanent deletion. Defaults: priority `medium`, label `other`.

Editing fills the same form and focuses the title; canceling discards the draft. Deletion asks for confirmation. Failed saves retain form values and existing task state. Open tasks stay above completed tasks; priority sorting is enabled by default for open tasks, and disabling it shows their persisted manual order. Open and completed tasks can be rearranged by pointer drag-and-drop or keyboard movement within their own group, including while a label filter is active; dropping or moving a task disables priority sorting. Completed tasks move to the bottom with the most recently completed first by default; reopening a task returns it to its manual open-task position. Label filtering is inactive by default. Loading, saving, empty, success, and error states are visible. The layout supports desktop and mobile screens with labeled controls and keyboard focus indicators.

### Smart suggestion

**Suggest priority and label** sends the current title to the backend and fills the editable form fields without saving the task.

The UI uses `source` to quietly confirm an LLM suggestion or explain that fallback defaults need review. Loading or failure must not block manual entry. Title or metadata changes, saving, switching tasks, and canceling editing invalidate any pending suggestion. Late responses cannot overwrite the current draft; request failures preserve its values.

One label from a fixed list keeps validation and the UI predictable.

Priority estimates urgency from the title: `high` for explicit urgency, `low` for explicit low urgency or optional work, otherwise `medium`. The prompt must follow this policy.

## Interfaces

API routes use JSON under `/api`, except deletion, which returns no body. In API-only development mode, `GET /` redirects to `/docs` for a useful browser landing page; the demo mode serves the built UI at `/` instead.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks in manual group order, with newest-first defaults |
| `POST` | `/api/tasks` | Create a task |
| `POST` | `/api/tasks/reorder` | Persist the order of all tasks within their completion groups |
| `PATCH` | `/api/tasks/{id}` | Change supplied task fields |
| `DELETE` | `/api/tasks/{id}` | Delete a task and return `204` |
| `POST` | `/api/task-suggestions` | Suggest priority and label for a title |
| `GET` | `/api/health` | Support local startup and demo health checks |

Task responses expose `id`, `title`, `completed`, `priority`, `label`, `created_at`, and `updated_at`. Create accepts `title` plus optional `priority` and `label`, and returns `201`; patch accepts at least one editable task field. Supplied fields cannot be null, unknown fields are rejected, and completion must be a JSON boolean. Task IDs must be positive integers within SQLite's signed 64-bit range. Unknown task IDs return `404`, invalid input returns `422`, and unexpected server errors use a generic `500` response.

Errors use `{ "detail": string }`: `Task not found` for unknown tasks, `Invalid request` for validation errors, and `Internal server error` for unexpected failures. Validation responses omit the submitted input. Health returns `{ "status": "ok" }` as a liveness check.

Suggestion request: `{ "title": string }`. Response: `{ "priority": string, "label": string, "source": "llm" | "fallback" }`. Expected provider failures return `200` with fallback values.

## Architecture

Use the stack declared in [README.md](README.md) as a small monorepo:

```text
src/todo_app/
  main.py          FastAPI construction and routes
  demo.py          local demo command and build preflight
  config.py        environment-backed settings
  database.py      SQLite schema and task operations
  schemas.py       API and LLM validation models
  suggestions.py   OpenRouter classification and fallback
frontend/
  src/              React UI and a small typed API client
  tests/            Playwright tests
tests/              pytest tests
scripts/check_ai.py  explicit manual check with the live provider
```

Split files only for a clear second responsibility.

Use Python's `sqlite3` with an on-disk database path configured as described in [local development](README.md#develop-with-live-reload). The application factory accepts explicit settings for test isolation. Importing it does not construct an app or read local settings; Uvicorn calls it using `--factory`, and the demo calls it directly. Create the single `tasks` table idempotently at startup; add the manual position columns to existing databases in the same startup check. Each operation owns a connection and transaction, with values bound as SQL parameters. Partial updates touch only supplied fields and the update timestamp; creation time, ID, and manual positions remain unchanged. New tasks start at the top of the open-task order, and newly completed tasks start at the top of the completed-task order. Reordering validates and updates both completion-group positions atomically. List tasks by manual open-task position, completed status, manual completed-task position, completion timestamp, and ID; a migrated database initially follows creation time descending for open tasks and completion time descending for completed tasks.

React keeps form/loading/error state locally; no state library. `App.tsx` coordinates the form and list components, while `api.ts` validates received task shapes and maps failures to stable user messages without displaying raw server details. Mutations first apply the confirmed API result locally, then refetch the short list. This keeps a saved change visible if the follow-up fetch fails. Controls prevent overlapping mutations and requests have a short timeout.

Vite proxies `/api` in development; [local setup and ports](README.md#develop-with-live-reload) are documented in README.

### Local delivery

Use native Python and Node.js tooling for local development and delivery. Docker is optional in the exercise brief and cannot run on the current development VM, so Docker packaging is outside scope. Verify the native workflow from a clean checkout and rehearse it for the interview.

The `todo-demo` command checks for `frontend/dist/index.html` and starts FastAPI on loopback with the built UI alongside `/api`: one process and one port, with SQLite stored at the same configured local database path. The application factory accepts an optional frontend directory; only the demo opts into static serving. In API-only mode, serve `/docs` from the root redirect; with the frontend directory, mount static files after API routes and serve the index at `/`. Return `404` for unknown paths and missing assets. No client-side routing fallback is needed for this single-page UI. The build stays in the local checkout rather than the Python wheel. Keep the separate Vite and FastAPI servers for development with automatic reload. README owns the exact [setup, build, and start commands](README.md#run-the-demo).

## LLM design

`suggestions.py` owns the OpenRouter adapter and fallback. Use OpenRouter's free `nex-agi/nex-n2.5-mini:free` variant for a simple hosted demo without local model installation. The application factory accepts an asynchronous suggestion provider for tests. Model and API key come from settings defined in [.env.example](.env.example); configuration precedence, provider choice, and setup are documented in [README](README.md#ai-suggestions). Old OpenAI and Groq credentials and model settings are ignored; there is no paid-provider fallback.

Use the OpenAI Python SDK's asynchronous Chat Completions API pointed at OpenRouter's OpenAI-compatible endpoint. Send the JSON Schema generated by the Pydantic metadata model with [structured output](https://openrouter.ai/docs/guides/features/structured-outputs) and validate the returned JSON with that model. The request supplies a fixed system instruction separately from the title. The instruction:

- defines each allowed priority and label;
- asks for exactly one value from each enum;
- says not to invent deadlines or facts absent from the title; and
- states that the task title is untrusted content to classify, never an instruction to follow.

Pass the title as user content; give the model no tools or database contents. Request a small reasoning budget and cap completion tokens at 256. Validate the provider response envelope and metadata locally; reject unknown metadata fields or values. Only one completion with finish reason `stop` and valid metadata counts as an LLM suggestion. The `source` field is assigned by the backend, never the model.

Use an eight-second overall deadline and SDK timeout, with SDK retries disabled and no application-level retry. Missing key, timeout, rate/provider error, invalid output, refusal, or incomplete response returns `medium` / `other` with `source: fallback`. The browser's ten-second timeout allows time for the backend fallback. Canceling in the browser discards the result; it does not guarantee cancellation of a provider request already in flight.

Log only safe failure categories. The app sets OpenAI SDK logging to warning level because its debug output includes request bodies. Settings omit the API key from their representation. Do not convert programming errors into fallbacks: the existing generic `500` handler handles them without logging sensitive exception details.

## Test strategy

Automated tests must never call a live provider or require an API key; inject or replace the suggestion provider. The explicitly invoked [manual AI check](README.md#ai-suggestions) uses canned titles and a temporary database to check live integration and basic classification behavior; it is not part of pytest or Playwright.

### pytest

- Exercise every task operation through FastAPI with an isolated temporary database.
- Check input boundaries, enum validation, timestamp/update behavior, `404`, and persistence across application instances.
- Inject a provider or mock the SDK HTTP transport and verify a valid structured AI result reaches the API response without saving a task.
- Cover missing-key, provider/transport-error, malformed-response, refusal, and deadline fallbacks without network access; verify retries are disabled.
- Verify task text and credentials are absent from captured logs.
- Verify manual ordering, reorder validation, persistence across application instances, and restoration after completion/reopening for both completion groups.

### Playwright

- Create, edit, cancel editing, complete, reopen, and delete a task through the browser, including reload persistence and deletion confirmation.
- Check form validation and recovery from failed loads, mutations, and refreshes after successful saves.
- Request a suggestion from a stubbed or deterministic backend, edit it, save the task, and verify the displayed values.
- Verify fallback messaging.
- Verify failed suggestions preserve manual values and late responses cannot overwrite edits, saved tasks, or a different draft.
- Verify open and completed tasks can be dragged into a custom order, including inside a label filter, that dropping disables priority sorting, that groups cannot be crossed, and that the order survives reload on desktop and mobile.

Keep the browser suite focused on user flows; backend tests own validation and provider edge cases. The manual, suggestion, and failure tests run in desktop and mobile Chromium. Playwright starts separate servers with a temporary database and explicit settings without an API key, runs one worker with database cleanup before each test, and never reuses development servers. Successful LLM suggestions use stubbed browser responses; fallback tests use the backend. See [test commands and artifacts](README.md#tests).

### Local delivery verification

Run the full [quality checks](AGENTS.md#verification) and verify the documented dependency installation, frontend build, and development/demo start commands from a clean checkout on the development machine. The [demo browser smoke suite](README.md#tests) reuses the task, suggestion-review, and fallback flows against the built UI served by FastAPI through the demo entry point, with an isolated database and no provider calls. Check the health endpoint, task operations, and SQLite persistence after restarting the demo server. Rehearse the task and suggestion workflows, including fallback without an API key; any live-provider check is manual and separate from automated tests.

Verified on Windows on 2026-09-16 with Python 3.14.7, uv 0.12.13, and portable Node.js 24.21.0 (npm 11.19.0): 123 pytest tests, 30 development browser tests, six demo browser tests, Ruff lint/format, ty, and the TypeScript/Vite build passed. A fresh local clone with the pending milestone files applied, without copied dependencies, build output, `.env`, or task data, passed dependency installation and the build. The documented default demo and development commands served the UI and health endpoint; the development API proxy worked. Demo task creation, editing, completion, fallback, deletion, and SQLite persistence across a process restart passed. Browser flows rehearsed editable suggestions and fallback on desktop and mobile. Live OpenRouter behavior was not rechecked for this delivery-only milestone.

## Milestones

- [x] **0. Define the project.** Capture the scope, decisions, workflow, and agent guidance. Suggested commit: `docs: define todo app implementation plan`.
- [x] **1. Build task persistence and API.** Align project metadata with the declared Python version, add configuration, schemas, SQLite operations, CRUD routes, and pytest coverage. Suggested commit: `feat: add persistent task API`.
- [x] **2. Build the task UI.** Add the Vite React app and complete the manual task workflow, with Playwright coverage for the affected flows. Suggested commit: `feat: add task management UI`.
- [x] **3. Add smart suggestions.** Implement the OpenRouter adapter, structured validation, fallback, UI action, `.env` configuration, mocked tests, and a manual live check. Suggested commit: `feat: suggest task priority and label`.
- [x] **4. Prepare local delivery and verify.** Add the demo start command, FastAPI serving of the built frontend, and Playwright smoke coverage for that workflow. Finalize `.env.example` and README, complete clean-checkout verification, and rehearse the demo as described in [local delivery verification](#local-delivery-verification). Suggested commit: `chore: prepare and verify local delivery`.
- [x] **5. Add manual task ordering.** Persist completion-group positions, add pointer drag-and-drop rearranging for mouse and touch, turn off priority sorting after a drop, and cover the API and browser flow. Suggested commit: `feat: add drag-and-drop task ordering`.

Complete milestones in order and keep the application runnable at each boundary.

## Delivery checklist

Remaining [exercise delivery requirements](docs/coding-exercise-ai-agent-developer.md#3-what-to-deliver):

- [ ] Preserve readable milestone commits; do not squash the entire implementation.
- [ ] Publish the source and configuration in a public GitHub repository.
- [ ] Email the repository link to the interviewer at least 24 hours before the interview.

Commits, publication, and email require user authorization.

## Non-goals

- Authentication, accounts, sharing, and permissions
- Due dates, reminders, subtasks, multiple lists, search, and pagination
- Multiple labels per task or user-defined taxonomies
- Streaming, chat, agents, tool calling, embeddings, or prompt history
- Background jobs, caching, analytics, deployment automation, or production scaling
- Visual polish beyond a clear, responsive, accessible interface

Add these only through an explicit scope change.
