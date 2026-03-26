# Agent Instructions

Read `navigation_index.md` in this directory before exploring `e2e/` broadly.

This directory holds Playwright coverage for the browser app shell.

## Guidance
- Prefer extending `smoke.spec.js` for broad regressions that should stay cheap and stable.
- Add focused browser-side specs here when a module can be validated more directly via `page.evaluate()` and ES module imports than through full UI interaction.
- Keep selectors tied to durable UI IDs or data attributes where possible.
