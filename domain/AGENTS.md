# Agent Instructions

Read `navigation_index.md` in this directory before deep domain exploration.

## Scope
- `domain/` owns the game models and simulation rules. It should stay mostly UI-agnostic.

## Discovery Tips
- Keep this layer free of DOM concerns and editor-specific UI behavior.
- When changing simulation behavior, verify whether the change also affects pathfinding, storage, or pricing invariants in adjacent domain modules.
- Prefer fixing data/rule issues here rather than papering over them in UI code.
