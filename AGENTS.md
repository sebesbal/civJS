# Agent Instructions

Read `navigation_index.md` before broad repo exploration or multi-file changes.

Use it to:
- choose likely entrypoints before searching widely,
- understand backend, frontend, and test ownership,
- skip generated or vendor directories unless the task explicitly targets them.

`navigation_index.md` is the primary navigation reference for this repository. Keep this file short and update the index when the project structure changes in a way that affects code discovery.

## Directory-Specific Guidance
- The project is plain browser-side ES modules with no build step. Edit source files directly and test by reloading the app.
- Ignore `node_modules/` during code discovery. `icons/` is mostly asset inventory, not gameplay logic.
- Prefer the nearest subtree `AGENTS.md` when a task is clearly scoped to one area of the repo.

## Maintaining These Files

- Update the nearest relevant `AGENTS.md` only when a session uncovers a stable repo fact that will likely save future exploration.
- Prefer the most specific subtree `AGENTS.md` that owns the behavior. Keep the root file limited to repo-wide navigation and policy.
- Keep entries short and actionable. Record facts, conventions, and durable gotchas, not long explanations or change history.
- Replace or tighten outdated bullets instead of appending near-duplicates.
- Do not add transient details such as one-off bugs, temporary workarounds, timestamps, or task-specific notes.
- If project structure changes in a way that affects discovery, update `navigation_index.md` too.
