# Agent Instructions

Read `navigation_index.md` in this directory before broad UI changes.

## Scope
- The repo mixes traditional DOM UIs with Three.js visualizers; many user-facing changes require touching both.

## Discovery Tips
- If the issue is "buttons/sidebar/panel behavior", start in `ui/editors/`.
- If the issue is "how something is drawn or animated", start in `ui/visualizers/`.
- Map overlay work usually spans `ui/editors/map-editor-ui.js` and `ui/visualizers/map-overlay-renderer.js`.
- Factory overview work usually spans `ui/viewers/factory-overview-ui.js`, `ui/visualizers/factory-overview-visualizer.js`, and `application/game/factory-overview-aggregator.js`.
