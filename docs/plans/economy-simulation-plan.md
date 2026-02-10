# Economy Simulation - Implementation Plan

See [specification](../spec/economy-simulation.md) for full details.

## Phase 1: Foundation (UI and data prep, no simulation logic)

### 1a. Rename "Route" to "Road" in UI labels
- `map-editor/map-editor-ui.js`: Update section title, button text, properties panel labels
- Internal variable names (`routeManager`, etc.) stay unchanged

### 1b. Add Warehouse object type
- `map-editor/config/object-types.js`: Add `WAREHOUSE` entry (brown, 0.9x0.4x0.9 box)
- `map-editor/map-editor-ui.js`: Split sidebar buttons into "Place Factories" and "Special Buildings"

### 1c. Simulation controls in sidebar
- `map-editor/map-editor-ui.js`: New sidebar section with Play/Pause, speed slider, Generate Factories button
- `ui.js`: Forward new callbacks (`onSimulationToggle`, `onSimulationSpeedChange`, `onGenerateRandomFactories`)

### 1d. Random factory generator
- New: `simulation/random-factory-generator.js`
- `index.js`: Wire callback

## Phase 2: Simulation Core

### 2a. Actor state data model
- New: `simulation/actor-state.js` (storage slots, pricing, serialization)

### 2b. A* Pathfinding
- New: `simulation/pathfinding.js` (A* on tilemap grid, road cost reduction)

### 2c. Simulation engine
- New: `simulation/simulation-engine.js` (tick loop: production → trading → transport → pricing)

## Phase 3: Visual Integration

### 3a. Trade renderer
- New: `simulation/trade-renderer.js` (path lines + animated spheres)

### 3b. Factory/Warehouse inspector
- `map-editor/map-editor-ui.js`: Storage bar UI, price display, live refresh
- `map-editor/map-editor-ui.css`: Storage bar styles

### 3c. Wire into main loop
- `index.js`: Integrate simulation tick + trade renderer into animate loop, wire callbacks

## Phase 4: Persistence

### 4a. Extend save/load
- `map-editor/save-load.js`: v2 format with simulation state
- `index.js`: Pass simulation engine to save/load

## New Files
| File | Purpose |
|------|---------|
| `simulation/simulation-engine.js` | Core tick loop |
| `simulation/actor-state.js` | Storage/pricing data |
| `simulation/pathfinding.js` | A* pathfinding |
| `simulation/trade-renderer.js` | Trade visualization |
| `simulation/random-factory-generator.js` | Random factory placement |

## Modified Files
| File | Changes |
|------|---------|
| `index.js` | Import simulation, wire callbacks, animate loop |
| `ui.js` | Forward 3 new callbacks |
| `map-editor/map-editor-ui.js` | Road rename, simulation section, inspector UI |
| `map-editor/map-editor-ui.css` | Storage bar styles |
| `map-editor/config/object-types.js` | Warehouse type |
| `map-editor/save-load.js` | v2 format |
