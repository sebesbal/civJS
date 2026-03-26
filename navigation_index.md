# Navigation Index

Agent-oriented map of the repository for fast code discovery. Prefer this file over broad recursive exploration.

## First Stops
- `README.md`: project intent and smoke-test commands.
- `index.js`: browser runtime entrypoint; wires scene, map editor, simulation, persistence, and event handlers.
- `ui.js`: top-level UI composition and editor-mode switching.
- `serve.ps1`: minimal static server for local development at `http://localhost:3000/`.

## Core Source Areas
- `application/`: orchestration/services.
  - `application/game/map-editor.js`: editor-side interaction logic over map/domain objects.
  - `application/game/game-session-service.js`: owns runtime simulation/trade-renderer lifecycle.
  - `application/game/state-service.js`: save/load serialization.
  - `application/game/object-types.js`: derives placeable map object types from the economy graph.
  - `application/game/random-factory-generator.js`: auto-populates the map from the current economy.
  - `application/game/factory-overview-aggregator.js`: aggregates simulation state per product for overview UI.
  - `application/economy/economy-editor-service.js`: mutable economy graph service and change notifications.
  - `application/economy/economy-io-service.js`: loading/saving economy files.
- `domain/`: core game state and rules.
  - `domain/simulation/simulation-engine.js`: main tick loop for production, trading, pricing, and transport.
  - `domain/simulation/actor-state.js`: per-object producer/warehouse state.
  - `domain/map/tilemap.js`: tile grid creation and persistence-friendly tile data.
  - `domain/map/objects.js`: object manager for placed factories/buildings.
  - `domain/map/routes.js`: road creation and route storage.
  - `domain/map/pathfinding.js`: road-aware movement/path cost helpers.
  - `domain/economy/economy-graph.js`: product graph model.
  - `domain/economy/random-economy-generator.js`: random graph generation.
- `ui/`: DOM UIs and visualizers.
  - `ui/editors/map-editor-ui.js`: map-mode sidebar, product selection, floating overlay chooser, inspector panel.
  - `ui/editors/economy-editor-ui.js`: economy editor shell and product list/properties UI.
  - `ui/viewers/factory-overview-ui.js`: aggregated factory/simulation overview.
  - `ui/viewers/camera-controller.js`: map camera interactions.
  - `ui/visualizers/map-overlay-renderer.js`: tile heatmap overlays for buy/sell/profit metrics.
  - `ui/visualizers/trade-renderer.js`: animated trade routes and active traders.
  - `ui/visualizers/economy-visualizer.js`: economy DAG rendering.
  - `ui/visualizers/factory-overview-visualizer.js`: factory overview graph.
  - `ui/persistence/json-file-persistence.js`: browser download/upload helpers.
- `utils/`: shared UI/viewer infrastructure.
  - `utils/orthographic-viewer-base.js`: shared base for the economy editor and factory overview canvas viewers.
- `assets/`: CSS and seed data.
  - `assets/map/map-editor-ui.css`
  - `assets/economy/economy-editor-ui.css`
  - `assets/factory-overview/factory-overview-ui.css`
  - `assets/economy/economy-default.json`

## Important Flows
- Economy graph -> `application/game/object-types.js` -> map product buttons / object types.
- Economy changes -> `ui.js` (`UIManager.updateMapObjectTypes`) -> map editor UI + object manager refresh.
- Map object placement -> `domain/map/objects.js` -> simulation actor creation on `SimulationEngine.initialize()`.
- Simulation startup -> `application/game/game-session-service.js` -> `domain/simulation/simulation-engine.js` + `ui/visualizers/trade-renderer.js`.
- Save/load -> `application/game/state-service.js` -> rehydrate economy first, then object types, then placed objects/routes/simulation.

## Tests And Diagnostics
- `e2e/smoke.spec.js`: app shell and editor-mode smoke coverage.
- `e2e/persistence-services.spec.js`: persistence-related coverage.
- `e2e/factory-overview-aggregator.spec.js`: focused browser-side coverage for factory overview aggregation math and output shape.
- `test/simulation-test.js`: the only in-app harness currently exposed through Test mode.
- `test/`: interactive diagnostics area, but not the main CI entrypoint.
- `scripts/econ-iteration-bench.mjs`: ad hoc economy performance experiment.

## Low-Priority Discovery Areas
- `icons/`: large static icon set used by the economy editor/catalog.
- `docs/`: design notes, specifications, and historical planning material.
- `node_modules/`: vendor code; ignore unless debugging tooling.
