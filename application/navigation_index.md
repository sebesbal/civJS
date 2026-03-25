# Navigation Index

## `application/economy/`
- `economy-editor-service.js`: long-lived mutable economy graph service; emits economy-changed notifications used by `UIManager`.
- `economy-io-service.js`: loads default economy JSON and handles import/export-like graph file operations.

## `application/game/`
- `map-editor.js`: interaction/controller layer over tilemap, objects, and routes.
- `game-session-service.js`: owns creation/rebinding of `SimulationEngine` and `TradeRenderer`.
- `state-service.js`: full game-state serialization and deserialization.
- `object-types.js`: derives map-placeable object definitions from the economy graph.
- `random-factory-generator.js`: creates map factories from graph structure and terrain.
- `factory-overview-aggregator.js`: converts live actor/trader state into overview stats.

## Typical Entry Choices
- Simulation lifecycle issue: `game-session-service.js`
- Save/load issue: `state-service.js`
- Map placement/editor issue: `map-editor.js`
- Economy-to-map product mismatch: `object-types.js`
- Auto-generation behavior: `random-factory-generator.js`

## Cross-Layer Notes
- `application/game/map-editor.js` handles interaction/controller logic; the matching DOM/sidebar layer lives in `ui/editors/map-editor-ui.js`.
- `game-session-service.js` is the runtime bridge that creates and reuses `SimulationEngine` and `TradeRenderer`.
- `state-service.js` is the canonical full-game save/load serializer.
- `object-types.js` translates economy products into placeable map object definitions like `PRODUCT_<id>`.
