# CivJS - Project Guide

## Overview
A civilization-style browser game built with Three.js. Single-page app with multiple editor modes: Map Editor (3D isometric tile map), Economy Editor (product DAG visualizer), Factory Overview, and Test Editor.

## Tech Stack
- Vanilla JS (ES modules, no bundler/transpiler)
- Three.js for 3D rendering
- Served directly as static files; local automation uses `serve.ps1`
- `package.json` is present for Playwright smoke tests

## Architecture

### Entry Point
- `index.html` - loads `index.js` as module
- `index.js` - creates Three.js scene, camera, renderer; initializes all managers; wires callbacks

### Editor Modes (managed by `ui.js` → `UIManager`)
- **Map Editor**: 3D tile map with placeable objects and routes
  - `application/game/map-editor.js` - MapEditor (raycasting, mouse handling)
  - `domain/map/tilemap.js` - Tilemap (grid of tiles)
  - `domain/map/objects.js` - ObjectManager (3D factory objects on map)
  - `domain/map/routes.js` - RouteManager (waypoint paths between tiles)
  - `ui/editors/map-editor-ui.js` - MapEditorUI (sidebar, properties panel)
  - `application/game/object-types.js` - generates factory types from economy
  - `domain/map/config/tile-types.js` - tile type definitions
  - `ui/viewers/camera-controller.js` - orbit/zoom camera
  - `application/game/state-service.js` - game state serialization

- **Economy Editor**: DAG of product nodes with visualization
  - `domain/economy/economy-graph.js` - economy graph model
  - `domain/economy/product.js` - Product data class
  - `ui/editors/economy-editor-ui.js` - EconomyEditorUI (extends OrthographicViewerBase)
  - `ui/visualizers/economy-visualizer.js` - 3D DAG visualization
  - `ui/visualizers/dag-layout.js` - DAG layout algorithm
  - `domain/economy/random-economy-generator.js` - random economy generation logic
  - `application/economy/economy-io-service.js` - economy file I/O
  - `assets/economy/economy-default.json` - default 20-node animal-themed economy

- **Factory Overview**: read-only aggregated economy/simulation view
  - `ui/viewers/factory-overview-ui.js`
  - `ui/visualizers/factory-overview-visualizer.js`
  - `application/game/factory-overview-aggregator.js`

- **Test Editor**: currently exposes the simulation harness only
  - `test/simulation-test.js`

### Shared Utilities (`utils/`)
- `orthographic-viewer-base.js` - shared base class for the economy editor and factory overview canvases

### Key Data Flow
- Economy nodes (products) → `generateObjectTypesFromEconomy()` → factory types for map editor
- Economy changes fire `onEconomyChange` callback → UIManager updates map sidebar + ObjectManager
- Game save includes: map tiles, objects (with PRODUCT_<id> type keys), routes, economy data
- On load: economy restored first → object types regenerated → objects loaded

## Conventions
- UI classes create their own DOM elements in constructor/init
- Callbacks use simple property assignment pattern (e.g., `ui.onModeChange = (mode) => {...}`)
- Canvas-based economy/overview screens extend `OrthographicViewerBase`
- CSS in separate files per editor (map-editor-ui.css, economy-editor-ui.css)
- No build step - edit and refresh browser
