# Navigation Index

## `domain/economy/`
- `economy-graph.js`: core graph model for products and dependencies.
- `product.js`: product/node value object.
- `random-economy-generator.js`: procedural graph generation.

## `domain/map/`
- `tilemap.js`: grid creation, terrain data, and tile mesh lifecycle.
- `objects.js`: placed-object manager and selection/storage for factories/buildings.
- `routes.js`: road creation, selection, persistence, and mesh handling.
- `pathfinding.js`: world/grid conversion and path cost helpers.
- `config/tile-types.js`: terrain/type configuration.
- `noise.js`: terrain noise helper.

## `domain/simulation/`
- `simulation-engine.js`: main tick loop and all trade/production phases.
- `actor-state.js`: producer/warehouse storage, pricing, and status bookkeeping.

## Typical Entry Choices
- Trade/pricing/production behavior: `simulation/simulation-engine.js`
- Storage/status behavior: `simulation/actor-state.js`
- Map persistence or placement semantics: `map/tilemap.js` and `map/objects.js`
- Route/path issues: `map/routes.js` and `map/pathfinding.js`

## Discovery Notes
- `simulation/simulation-engine.js` is the densest logic file in this layer and drives ticking, production, pricing, contracts, and trader movement.
- `map/objects.js`, `map/routes.js`, and `map/tilemap.js` are the persistent world-state trio.
- `map/pathfinding.js` is shared by transport logic and route cost/path calculations.
- `economy/economy-graph.js` is the source of truth for product graph structure and invariants.
