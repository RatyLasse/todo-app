# AGENTS.md

## Project context

Before changing code, read the owning documents:

- [README.md](README.md): overview, stack, setup, run, and test commands.
- [PLAN.md](PLAN.md): scope, contracts (including AI), architecture, test strategy, and milestones.

This file owns contributor conventions and additional quality checks. Consult the unchanged [exercise brief](docs/coding-exercise-ai-agent-developer.md) when checking delivery requirements. Define details once; link elsewhere, with brief summaries allowed. Update PLAN.md alongside product or architecture changes.

## Coding conventions

- Keep it simple: small functions/modules, thin HTTP handlers, isolated persistence and LLM calls. No speculative layers or production infrastructure.
- Stay within scope; add dependencies only when they meaningfully simplify the declared stack.
- Use descriptive names, early returns, and concise comments only for non-obvious decisions.
- Add parameter and return types to Python functions; keep TypeScript strict and avoid `any`.
- Validate external input at the boundary and use parameterized SQL.
- Return concise, stable API errors; do not expose stack traces or provider details to the browser.
- Never log API keys or task text. Log only safe operational metadata and error categories.

## Verification

Cover changed behavior at the lowest useful level, with regression tests for fixes. Follow PLAN.md's test strategy for isolation and provider mocking. Keep tests deterministic and order-independent; use accessible roles/labels for Playwright selectors. Resolve tool and test warnings rather than suppressing them by default.

Run the [test commands](README.md#tests) and these additional checks as tooling becomes available:

```sh
uv run ruff check .
uv run ruff format --check .
uv run ty check
npm --prefix frontend run build
```

Select checks by change:

- Docs only: review accuracy, consistency, links, and diff; skip app tests/builds.
- Backend: Ruff, ty, relevant pytest tests; broaden coverage for shared schemas, persistence, configuration, or API changes.
- Frontend: TypeScript/build and browser tests for affected flows; backend tests if its behavior or API contract changes.
- Dependencies/packaging: affected install/build, startup smoke test, and tests for runtime behavior at risk.
- Milestones: relevant checks available at that stage. Final delivery: full quality set and documented local/Docker workflows.

Save time and tokens: read relevant files, batch independent checks, keep output focused, and reuse unchanged-code results. Repeat or broaden checks only for relevant edits, failures, or new evidence. Avoid unrelated tools and tests for prose. Report checks and material gaps.

## Change workflow

- Inspect the working tree first and preserve unrelated user changes.
- Keep each change limited to one logical milestone or fix.
- Do not edit generated lockfiles by hand.
- At milestone boundaries, summarize work and suggest PLAN.md's listed commit message.
- Do not create a commit unless the user asks for one.
