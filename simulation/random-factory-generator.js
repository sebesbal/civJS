// Random Factory Generator - places factories on the map based on the current economy

export class RandomFactoryGenerator {
  /**
   * Generate random factories on the map for all products in the economy.
   * @param {EconomyManager} economyManager
   * @param {ObjectManager} objectManager
   * @param {Tilemap} tilemap
   * @param {Object} options - { minSpacing: 2, totalFactories: null (auto) }
   * @returns {number[]} array of created object IDs
   */
  generate(economyManager, objectManager, tilemap, options = {}) {
    const minSpacing = options.minSpacing ?? 2;
    const totalFactories = options.totalFactories ?? null;
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;

    const nodes = economyManager.getAllNodes();
    if (nodes.length === 0) return [];

    // Calculate factory counts based on transport-aware consumption demand.
    const factoryCounts = this._calculateFactoryCounts(
      economyManager,
      nodes,
      tilemap,
      minSpacing,
      totalFactories,
      options
    );

    // Find valid tiles (non-water, unoccupied)
    const validTiles = this._getValidTiles(tilemap, objectManager, minSpacing);
    if (validTiles.length === 0) {
      console.warn('No valid tiles available for factory placement');
      return [];
    }

    // Shuffle valid tiles for random placement
    this._shuffle(validTiles, rng);

    const createdIds = [];
    let tileIndex = 0;

    for (const node of nodes) {
      const count = factoryCounts.get(node.id);
      const typeKey = `PRODUCT_${node.id}`;

      for (let i = 0; i < count; i++) {
        if (tileIndex >= validTiles.length) {
          console.warn('Ran out of valid tiles for factory placement');
          return createdIds;
        }

        const tile = validTiles[tileIndex];
        tileIndex++;

        const topY = tilemap.getTileTopSurface(tile.worldX, tile.worldZ);
        const position = { x: tile.worldX, y: topY, z: tile.worldZ };
        const obj = objectManager.createObject(typeKey, position);
        if (obj) {
          createdIds.push(obj.id);
        }
      }
    }

    return createdIds;
  }

  /**
   * Get all valid tiles for factory placement.
   * Valid = non-water (tileTypeIndex >= 3), not occupied by an existing object.
   */
  _getValidTiles(tilemap, objectManager, minSpacing) {
    const config = tilemap.getConfig();
    const offset = (config.mapSize * config.tileSize) / 2 - config.tileSize / 2;

    // Build set of occupied grid positions
    const occupiedPositions = new Set();
    for (const obj of objectManager.getAllObjects()) {
      const gridX = Math.round((obj.mesh.position.x + offset) / config.tileSize);
      const gridZ = Math.round((obj.mesh.position.z + offset) / config.tileSize);
      occupiedPositions.add(`${gridX},${gridZ}`);
    }

    const validTiles = [];
    const acceptedPositions = new Set();
    for (const tile of tilemap.tiles) {
      // Skip water tiles (tileTypeIndex 0=Deep Sea, 1=Sea, 2=Shallow Water)
      if (tile.userData.tileTypeIndex < 3) continue;

      const gx = tile.userData.gridX;
      const gz = tile.userData.gridZ;

      // Skip occupied tiles
      if (occupiedPositions.has(`${gx},${gz}`)) continue;

      // Check minimum spacing from other occupied tiles
      let tooClose = false;
      for (const key of occupiedPositions) {
        const [ox, oz] = key.split(',').map(Number);
        const dist = Math.abs(gx - ox) + Math.abs(gz - oz); // Manhattan distance
        if (dist < minSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Also enforce spacing among newly accepted candidate tiles.
      for (const key of acceptedPositions) {
        const [ax, az] = key.split(',').map(Number);
        const dist = Math.abs(gx - ax) + Math.abs(gz - az);
        if (dist < minSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const worldX = gx * config.tileSize - offset;
      const worldZ = gz * config.tileSize - offset;
      validTiles.push({ gridX: gx, gridZ: gz, worldX, worldZ });
      acceptedPositions.add(`${gx},${gz}`);
    }

    return validTiles;
  }

  /**
   * Calculate factory counts based on input/output ratios in the economy.
   * Products with higher demand need more factories producing them.
   * @param {EconomyManager} economyManager
   * @param {Array} nodes - all economy nodes
   * @param {number|null} totalFactories - target total number of factories (null = auto-scale)
   */
  _calculateFactoryCounts(economyManager, nodes, tilemap, minSpacing, totalFactories = null, options = {}) {
    const factoryCounts = new Map();
    const fuelProductId = economyManager.getFuelProductId();
    const depths = economyManager.calculateDepths();
    const transportFriction = this._estimateTransportFriction(tilemap, minSpacing, options);

    // Step 1: Find sink nodes (products not consumed by anyone)
    const sinkNodes = new Set();
    for (const node of nodes) {
      const isConsumed = nodes.some(n =>
        n.inputs.some(input => input.productId === node.id)
      );
      if (!isConsumed) {
        sinkNodes.add(node.id);
      }
    }

    // Step 2: Calculate relative demand for each product
    // We'll work backwards from sinks, propagating demand upstream
    const demand = new Map();

    // Initialize: sinks have base demand of 1.0
    for (const node of nodes) {
      demand.set(node.id, sinkNodes.has(node.id) ? 1.0 : 0.0);
    }

    // Propagate demand upstream through the dependency graph.
    // Add transport friction so upstream and fuel capacity are not underbuilt.
    // We need to iterate multiple times to handle complex graphs
    const maxIterations = nodes.length;
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;

      for (const node of nodes) {
        if (node.inputs.length === 0) continue; // Raw materials

        // This node's demand determines input demand
        const nodeDemand = demand.get(node.id);
        if (nodeDemand === 0) continue;
        const nodeDepth = depths.get(node.id) ?? 0;
        const chainDistanceFactor = 1 + (nodeDepth * 0.2);

        // Each factory producing this node consumes its inputs
        let movedInputUnits = 0;
        for (const input of node.inputs) {
          const currentDemand = demand.get(input.productId);
          const transportMultiplier = 1 + (transportFriction * chainDistanceFactor);
          const incrementalDemand = nodeDemand * input.amount * transportMultiplier;
          movedInputUnits += nodeDemand * input.amount;
          const newDemand = currentDemand + incrementalDemand;
          if (Math.abs(newDemand - currentDemand) > 0.001) {
            demand.set(input.productId, newDemand);
            changed = true;
          }
        }

        // Every moved input unit consumes transport fuel across expected routes.
        if (fuelProductId !== null) {
          const fuelCurrent = demand.get(fuelProductId) ?? 0;
          const fuelIncrement = movedInputUnits * transportFriction;
          const fuelNew = fuelCurrent + fuelIncrement;
          if (Math.abs(fuelNew - fuelCurrent) > 0.001) {
            demand.set(fuelProductId, fuelNew);
            changed = true;
          }
        }
      }

      if (!changed) break;
    }

    // Step 3: Convert demand to factory counts
    // Find max demand and total demand
    let maxDemand = 0;
    let totalDemand = 0;
    for (const d of demand.values()) {
      maxDemand = Math.max(maxDemand, d);
      totalDemand += d;
    }

    if (maxDemand === 0) {
      // Fallback: use depth-based approach
      for (const node of nodes) {
        const depth = depths.get(node.id) ?? 0;
        let count;
        if (depth === 0) count = 3;
        else if (depth <= 2) count = 2;
        else count = 1;
        factoryCounts.set(node.id, count);
      }
      return factoryCounts;
    }

    if (totalFactories !== null && totalFactories > 0) {
      // User specified a total - distribute proportionally and exactly.
      this._allocateCountsByDemand(factoryCounts, nodes, demand, totalFactories);
    } else {
      // Auto-scale: size overall capacity by transport friction to avoid chronic starvation.
      const autoTotal = Math.max(
        nodes.length,
        Math.round(nodes.length * (2.0 + transportFriction * 2.5))
      );
      this._allocateCountsByDemand(factoryCounts, nodes, demand, autoTotal);
    }

    return factoryCounts;
  }

  _estimateTransportFriction(tilemap, minSpacing, options) {
    if (typeof options.transportFriction === 'number' && options.transportFriction >= 0) {
      return options.transportFriction;
    }

    const config = tilemap.getConfig();
    const mapSize = config?.mapSize ?? 40;
    // Expected random Manhattan distance in a square is ~2N/3.
    const expectedRouteLength = Math.max(4, (2 * mapSize) / 3 - minSpacing);
    const expectedFuelPerTile = options.expectedFuelCostPerTile ?? 0.08;
    const expectedShipmentUnits = Math.max(1, options.expectedShipmentUnits ?? 5);
    const expectedFuelPerUnit = (expectedRouteLength * expectedFuelPerTile) / expectedShipmentUnits;

    // Clamp to a stable planning range.
    return Math.max(0, Math.min(1.5, expectedFuelPerUnit));
  }

  _allocateCountsByDemand(factoryCounts, nodes, demand, totalFactories) {
    factoryCounts.clear();
    if (nodes.length === 0) return;

    const minPerNode = totalFactories >= nodes.length ? 1 : 0;
    const baseAllocated = minPerNode * nodes.length;
    let remaining = Math.max(0, totalFactories - baseAllocated);

    let totalDemand = 0;
    for (const node of nodes) {
      totalDemand += Math.max(0, demand.get(node.id) ?? 0);
    }

    if (totalDemand <= 0) {
      // Even fallback for degenerate cases.
      const equalShare = nodes.length > 0 ? Math.floor(remaining / nodes.length) : 0;
      let leftover = remaining - (equalShare * nodes.length);
      for (const node of nodes) {
        let count = minPerNode + equalShare;
        if (leftover > 0) {
          count += 1;
          leftover -= 1;
        }
        factoryCounts.set(node.id, count);
      }
      return;
    }

    // Largest-remainder proportional allocation.
    const quotas = [];
    let assigned = 0;
    for (const node of nodes) {
      const nodeDemand = Math.max(0, demand.get(node.id) ?? 0);
      const exact = (nodeDemand / totalDemand) * remaining;
      const floor = Math.floor(exact);
      quotas.push({ nodeId: node.id, floor, remainder: exact - floor });
      assigned += floor;
      factoryCounts.set(node.id, minPerNode + floor);
    }

    let toDistribute = remaining - assigned;
    quotas.sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < quotas.length && toDistribute > 0; i++) {
      const q = quotas[i];
      factoryCounts.set(q.nodeId, (factoryCounts.get(q.nodeId) ?? minPerNode) + 1);
      toDistribute -= 1;
    }
  }

  /** Fisher-Yates shuffle */
  _shuffle(array, rng = Math.random) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
