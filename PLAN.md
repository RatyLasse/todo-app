# Todo App Implementation Plan

## Goal and success criteria

Deliver the [exercise brief](docs/coding-exercise-ai-agent-developer.md) with local task management and optional AI metadata suggestions. Task management must work without an API key or available provider.

The project is done when:

- the product behavior below works with SQLite persistence and OpenAI;
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

Editing fills the same form and focuses the title; canceling discards the draft. Deletion asks for confirmation. Failed saves retain form values and existing task state. Loading, saving, empty, success, and error states are visible, and a failed list load offers manual refresh. The layout supports desktop and mobile screens with labeled controls and keyboard focus indicators.

### Smart suggestion

**Suggest priority and label** sends the current title to the backend and fills the editable form fields without saving the task.

The UI uses `source` to quietly confirm an LLM suggestion or explain that fallback defaults need review. Loading or failure must not block manual entry.

One label from a fixed list keeps validation and the UI predictable.

Priority estimates urgency from the title: `high` for explicit urgency, `low` for explicit low urgency or optional work, otherwise `medium`. The prompt must follow this policy.

## Interfaces

All HTTP routes use JSON under `/api`, except deletion, which returns no body.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks, newest first |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/{id}` | Change supplied task fields |
| `DELETE` | `/api/tasks/{id}` | Delete a task and return `204` |
| `POST` | `/api/task-suggestions` | Suggest priority and label for a title |
| `GET` | `/api/health` | Support local startup and demo health checks |

Task responses expose `id`, `title`, `completed`, `priority`, `label`, `created_at`, and `updated_at`. Create accepts `title` plus optional `priority` and `label`, and returns `201`; patch accepts at least one editable task field. Supplied fields cannot be null, unknown fields are rejected, and completion must be a JSON boolean. Task IDs must be positive integers within SQLite's signed 64-bit range. Unknown task IDs return `404`, invalid input returns `422`, and unexpected server errors use a generic `500` response.

Errors use `{ "detail": string }`: `Task not found` for unknown tasks, `Invalid request` for validation errors, and `Internal server error` for unexpected failures. Validation responses omit the submitted input. Health returns `{ "status": "ok" }` as a liveness check.

Suggestion request: `{ "title": string }`. Response: `{ "priority": string, "label": string, "source": "llm" | "fallback" }`. Expected OpenAI failures return `200` with fallback values.

## Architecture

Use the stack declared in [README.md](README.md) as a small monorepo:

```text
src/todo_app/
  main.py          FastAPI construction and routes
  config.py        environment-backed settings
  database.py      SQLite schema and task operations
  schemas.py       API and LLM validation models
  suggestions.py   OpenAI classification and fallback
frontend/
  src/              React UI and a small typed API client
  tests/            Playwright tests
tests/              pytest tests
```

Split files only for a clear second responsibility.

Use Python's `sqlite3` with an on-disk database path configured as described in [local development](README.md#local-development). The application factory accepts explicit settings for test isolation. Create the single `tasks` table idempotently at startup; its private schema needs no migration framework. Each operation owns a connection and transaction, with values bound as SQL parameters. Partial updates touch only supplied fields and the update timestamp; creation time and ID remain unchanged. Sort by creation time descending, then ID descending to break ties.

React keeps form/loading/error state locally; no state library. `App.tsx` coordinates the form and list components, while `api.ts` validates received task shapes and maps failures to stable user messages without displaying raw server details. Mutations first apply the confirmed API result locally, then refetch the short list. This keeps a saved change visible if the follow-up fetch fails. Controls prevent overlapping mutations and requests have a short timeout.

Vite proxies `/api` in development; [local setup and ports](README.md#quick-start) are documented in README.

### Local delivery

Use native Python and Node.js tooling for local development and delivery. Docker is optional in the exercise brief and cannot run on the current development VM, so Docker packaging is outside scope. Verify the native workflow from a clean checkout and rehearse it for the interview.

Milestone 4 will add a convenient demo start command after dependency installation and the frontend build. FastAPI will serve `frontend/dist` alongside `/api`: one process and one port, with SQLite stored at the same configured local database path. Keep the separate Vite and FastAPI servers for development with automatic reload. README will own the exact setup, build, and start commands once implemented.

## LLM design

`suggestions.py` exposes an injectable callable for provider access and fallback. Model and API key come from environment settings defined in `.env.example`.

Use the OpenAI Python SDK with structured output parsed into a Pydantic model. The fixed instruction:

- defines each allowed priority and label;
- asks for exactly one value from each enum;
- says not to invent deadlines or facts absent from the title; and
- states that the task title is untrusted content to classify, never an instruction to follow.

Pass the title separately; give the model no tools or database contents. Always validate responses locally.

Use a short timeout and no application-level retry. Missing key, timeout, rate/provider error, or invalid response returns `medium` / `other` with `source: fallback`. Log only safe failure categories; do not convert programming errors into fallbacks.

## Test strategy

Automated tests must never call OpenAI or require an API key; inject or replace the suggestion provider.

### pytest

- Exercise every task operation through FastAPI with an isolated temporary database.
- Check input boundaries, enum validation, timestamp/update behavior, `404`, and persistence across application instances.
- Mock the provider and verify a valid structured AI result reaches the API response.
- Cover missing-key, provider-error, and malformed-response fallbacks without network access.
- Verify task text and credentials are absent from captured logs.

### Playwright

- Create, edit, cancel editing, complete, reopen, and delete a task through the browser, including reload persistence and deletion confirmation.
- Check form validation and recovery from failed loads, mutations, and refreshes after successful saves.
- Request a suggestion from a stubbed or deterministic backend, edit it, save the task, and verify the displayed values.
- Verify fallback messaging.

Keep the browser suite intentionally small; backend tests own validation and edge-case coverage. The manual workflow and failure tests run in desktop and mobile Chromium. Playwright starts separate servers with a temporary database, runs one worker with database cleanup before each test, and never reuses development servers. See [test commands and artifacts](README.md#tests). Suggestion and fallback browser coverage will be added with milestone 3.

### Local delivery verification

At milestone 4, run the full [quality checks](AGENTS.md#verification) and verify the documented dependency installation, frontend build, and development/demo start commands from a clean checkout on the development machine. Add Playwright smoke coverage against the built UI served by FastAPI. Check the health endpoint, task operations, and SQLite persistence after restarting the demo server. Rehearse the task and suggestion workflows, including fallback without an API key; any live-provider check is manual and separate from automated tests.

## Milestones

- [x] **0. Define the project.** Capture the scope, decisions, workflow, and agent guidance. Suggested commit: `docs: define todo app implementation plan`.
- [x] **1. Build task persistence and API.** Align project metadata with the declared Python version, add configuration, schemas, SQLite operations, CRUD routes, and pytest coverage. Suggested commit: `feat: add persistent task API`.
- [x] **2. Build the task UI.** Add the Vite React app and complete the manual task workflow, with Playwright coverage for the affected flows. Suggested commit: `feat: add task management UI`.
- [ ] **3. Add smart suggestions.** Implement the OpenAI adapter, structured validation, fallback, UI action, and mocked tests. Suggested commit: `feat: suggest task priority and label`.
- [ ] **4. Prepare local delivery and verify.** Add the demo start command, FastAPI serving of the built frontend, and Playwright smoke coverage for that workflow. Finalize `.env.example` and README, complete clean-checkout verification, and rehearse the demo as described in [local delivery verification](#local-delivery-verification). Suggested commit: `chore: prepare and verify local delivery`.

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
