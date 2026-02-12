# Economy Simulation Specification

## Overview

This document specifies the economy simulation system for CivJS. The simulation brings the economy to life by running production, trading, and pricing logic on the map in real time.

## Actors

### Producer (Factory)

A producer is a map object tied to one economy product node. It consumes input products and produces an output product.

- **Input Storage**: One storage slot per input product (capacity: 20 units, ideal: 10 units)
- **Output Storage**: One storage slot for the produced product (capacity: 20 units, ideal: 10 units)
- **Raw Material Factories**: Economy nodes with no inputs. They produce output for free (no input consumption).
- **Sink Factories**: Economy nodes whose output is consumed by no other node. Their output disappears when produced (not stored).

### Warehouse

A special map object with large storage capacity. Not tied to a single product.

- **Storage**: One slot per product in the economy (total capacity: ~100 units, divided across products)
- **Behavior**: Buys products at low prices, stores them, sells at higher prices
- **Pricing**: Dynamic, based on storage fill levels

### Trader

An automatic agent (not a map object). Connects a supplier's output storage to a consumer's input storage.

- Computes shortest tile path via A* pathfinding
- Roads along the path reduce transport cost (fuel)
- Visualized as a colored path line + animated sphere on the map
- Created automatically when a profitable trade opportunity exists

### Contract

A persistent agreement between two actors to exchange a fixed amount of one product at a fixed unit price.

- Contracts are created from local trade opportunities
- Contracts execute repeatedly (shipments are created automatically)
- Each actor has a limited contract capacity (~10 contracts)
- If capacity is full, an actor may replace its worst contract with a better one

## Storage Model

Each storage slot has:
- `productId`: which product is stored
- `current`: current amount in storage (units)
- `capacity`: maximum storage capacity (units)
- `ideal`: target stock level (units)

## Pricing Model

Prices are derived from how close current stock is to the ideal level:

```
fillRatio = current / capacity
idealRatio = ideal / capacity

If fillRatio >= idealRatio (above ideal, surplus):
  price = basePrice * (1.0 - 0.5 * (fillRatio - idealRatio) / (1.0 - idealRatio))
  Range: basePrice * 1.0 down to basePrice * 0.5

If fillRatio < idealRatio (below ideal, shortage):
  price = basePrice * (1.0 + 1.0 * (idealRatio - fillRatio) / idealRatio)
  Range: basePrice * 1.0 up to basePrice * 2.0
```

Effect: full storage drives prices down (want to sell), empty storage drives prices up (need to buy).

## Production Logic (per tick)

1. For each producer (non-raw-material):
   a. Check if all required inputs are available in input storage (per recipe amounts)
   b. If yes: consume inputs, advance production progress by `productionRate`
   c. When progress >= 1.0: produce 1 unit of output, add to output storage, reset progress
   d. If output storage full: pause production (do not consume inputs)

2. For raw material factories:
   a. Always advance production progress by `productionRate`
   b. When progress >= 1.0: produce 1 unit, add to output storage
   c. If output storage full: pause

3. For sink factories:
   a. Produce normally, but output is discarded (not added to storage)
   b. This represents the economy's end consumption (military, buildings, research)

## Trading Logic (contract-based)

1. Maintain existing contracts:
   a. Drop invalid contracts (missing actors/storage/path)
   b. Track repeated execution failures and cancel stale contracts
2. Discover new opportunities:
   a. For each available source output, find the best buyer (deficit + route cost score)
   b. If no matching contract exists, create one
   c. If an actor is at contract capacity, replace its worst contract only when the new one scores higher
3. Execute contracts:
   a. For each contract, spawn shipment(s) automatically when source stock, destination capacity, path, and fuel are available
   b. Shipment amount is fixed per contract
4. Trader agents then move along paths and deliver cargo as before

## Pathfinding

- **Algorithm**: A* on the tilemap grid
- **Grid**: The tilemap (default 40x40 tiles)
- **Movement**: 4-directional (up, down, left, right). No diagonals.
- **Tile costs**:
  - Normal land tile: 1.0
  - Road tile: 0.3 (tile that a road passes through)
  - Water tile (tileTypeIndex < 3): impassable
- **Heuristic**: Manhattan distance
- **Road detection**: Sample each road's spline curve at many points, snap to grid to determine which tiles the road covers

## Road System

Roads are the existing "route" system, renamed in the UI:
- Created via waypoint splines (same as before)
- Roads do not define trade routes -- traders pathfind automatically
- Roads reduce the movement cost for tiles they pass through
- A tile is considered a "road tile" if any road's spline curve passes through it

## Random Factory Generation

When the user clicks "Generate Factories":
1. Read all product nodes from the current economy
2. Categorize by depth (via `economyManager.calculateDepths()`)
3. Place factories on random valid tiles:
   - Valid = non-water (tileTypeIndex >= 3), not already occupied, minimum spacing >= 2 tiles
   - Raw materials (depth 0): 3 factories each
   - Intermediate products (depth 1-2): 2 factories each
   - High-tier products (depth 3+): 1 factory each
4. Use `objectManager.createObject()` for each placement

## Visualization

### Trade Paths
- Thin colored lines on the map showing active trade routes
- Color matches the transported product (golden angle hue distribution)
- Rendered along the A* tile path at tile-top-Y + 0.1 offset

### Transport Spheres
- Small colored spheres (radius 0.12) moving along trade paths
- Position interpolated between tiles for smooth per-frame animation
- Color matches the transported product

### Factory Inspector (Properties Panel)
Right-click a factory to see:
- Factory name and type
- Production status: Producing / Idle / Output Full / Missing Inputs
- Production progress bar
- Input Storage: colored bar per input product showing fill level
- Output Storage: colored bar for output product
- Prices: current buy/sell prices for each product

### Warehouse Inspector
Right-click a warehouse to see:
- All product storage slots with fill bars
- Current prices for each product
- Delete button

## Simulation Controls

Sidebar section with:
- **Play/Pause button**: Starts or pauses the simulation
- **Speed slider**: 0.5x to 4x speed (default 1x)
- **Generate Factories button**: Auto-places factories on the map
- Tick rate: 1 tick/second at 1x speed

## Save/Load

Save format version 3 adds:
- `simulation` field containing:
  - Actor states (storage levels, production progress, prices)
  - Contracts (source, destination, product, fixed shipment amount, fixed unit price, score)
  - Active traders (position, path, cargo)
  - Simulation metadata (tick count, speed, running state)
- Backward compatible: v1/v2 saves load without contracts
