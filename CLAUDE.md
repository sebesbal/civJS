# CivJS - Project Guide

## Overview
A civilization-style browser game built with Three.js. Single-page app with multiple editor modes: Map Editor (3D isometric tile map), Economy Editor (product DAG visualizer), and Test Editor.

## Tech Stack
- Vanilla JS (ES modules, no bundler/transpiler)
- Three.js for 3D rendering
- Served via simple HTTP server (e.g., `npx serve`)
- No package.json / no npm dependencies beyond Three.js CDN or import map

## Architecture

### Entry Point
- `index.html` - loads `index.js` as module
- `index.js` - creates Three.js scene, camera, renderer; initializes all managers; wires callbacks

### Editor Modes (managed by `ui.js` → `UIManager`)
- **Map Editor**: 3D tile map with placeable objects and routes
  - `map-editor/map-editor.js` - MapEditor (raycasting, mouse handling)
  - `map-editor/tilemap.js` - Tilemap (grid of tiles)
  - `map-editor/objects.js` - ObjectManager (3D factory objects on map)
  - `map-editor/routes.js` - RouteManager (waypoint paths between tiles)
  - `map-editor/map-editor-ui.js` - MapEditorUI (sidebar, properties panel)
  - `map-editor/config/object-types.js` - generates factory types from economy
  - `map-editor/config/tile-types.js` - tile type definitions
  - `map-editor/camera-controller.js` - orbit/zoom camera
  - `map-editor/save-load.js` - game state serialization

- **Economy Editor**: DAG of product nodes with visualization
  - `economy-editor/economy-manager.js` - EconomyManager (CRUD for product nodes)
  - `economy-editor/product-node.js` - ProductNode data class
  - `economy-editor/economy-editor-ui.js` - EconomyEditorUI (extends OrthographicViewerBase)
  - `economy-editor/economy-visualizer.js` - 3D DAG visualization
  - `economy-editor/dag-layout.js` - Sugiyama-style DAG layout algorithm
  - `economy-editor/random-economy-generator.js` - random economy generation
  - `economy-editor/economy-save-load.js` - economy file I/O
  - `economy-editor/economy-default.json` - default 20-node animal-themed economy

- **Test Editor**: Test harnesses for components
  - `test/viewport-controller-test.js`, `test/object-scene-test.js`, `test/canvas-test-base.js`

### Shared Utilities (`utils/`)
- `orthographic-viewer-base.js` - base class for 2D orthographic viewers (economy editor, tests)
- `viewport-controller.js` - pan/zoom for orthographic views
- `save-load-base.js` - shared save/load file handling

### Key Data Flow
- Economy nodes (products) → `generateObjectTypesFromEconomy()` → factory types for map editor
- Economy changes fire `onEconomyChange` callback → UIManager updates map sidebar + ObjectManager
- Game save includes: map tiles, objects (with PRODUCT_<id> type keys), routes, economy data
- On load: economy restored first → object types regenerated → objects loaded

## Conventions
- UI classes create their own DOM elements in constructor/init
- Callbacks use simple property assignment pattern (e.g., `ui.onModeChange = (mode) => {...}`)
- Editor UIs extend OrthographicViewerBase for 2D viewers
- CSS in separate files per editor (map-editor-ui.css, economy-editor-ui.css)
- No build step - edit and refresh browser
