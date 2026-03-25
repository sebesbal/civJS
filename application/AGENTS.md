# Agent Instructions

Read `navigation_index.md` in this directory before exploring `application/` broadly.

## Scope
- `application/` coordinates use-cases across domain and UI layers. It is where runtime orchestration and editor services live.

## Discovery Tips
- If a task mentions callbacks wired in the browser runtime, inspect both the relevant service here and the top-level wiring in `index.js`/`ui.js`.
- Keep orchestration concerns here; avoid pushing UI rendering details or domain rules into `application/`.
