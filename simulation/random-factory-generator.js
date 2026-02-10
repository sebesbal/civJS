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

    const nodes = economyManager.getAllNodes();
    if (nodes.length === 0) return [];

    // Calculate factory counts based on consumption demand
    const factoryCounts = this._calculateFactoryCounts(economyManager, nodes, totalFactories);

    // Find valid tiles (non-water, unoccupied)
    const validTiles = this._getValidTiles(tilemap, objectManager, minSpacing);
    if (validTiles.length === 0) {
      console.warn('No valid tiles available for factory placement');
      return [];
    }

    // Shuffle valid tiles for random placement
    this._shuffle(validTiles);

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

      const worldX = gx * config.tileSize - offset;
      const worldZ = gz * config.tileSize - offset;
      validTiles.push({ gridX: gx, gridZ: gz, worldX, worldZ });
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
  _calculateFactoryCounts(economyManager, nodes, totalFactories = null) {
    const factoryCounts = new Map();

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

    // Propagate demand upstream through the dependency graph
    // We need to iterate multiple times to handle complex graphs
    const maxIterations = nodes.length;
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;

      for (const node of nodes) {
        if (node.inputs.length === 0) continue; // Raw materials

        // This node's demand determines input demand
        const nodeDemand = demand.get(node.id);
        if (nodeDemand === 0) continue;

        // Each factory producing this node consumes its inputs
        for (const input of node.inputs) {
          const currentDemand = demand.get(input.productId);
          const newDemand = currentDemand + (nodeDemand * input.amount);
          if (Math.abs(newDemand - currentDemand) > 0.001) {
            demand.set(input.productId, newDemand);
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
      const depths = economyManager.calculateDepths();
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

    // Distribute factories based on relative demand
    if (totalFactories !== null && totalFactories > 0) {
      // User specified a total - distribute proportionally
      let allocatedFactories = 0;
      const sortedNodes = [...nodes].sort((a, b) => demand.get(b.id) - demand.get(a.id));

      for (let i = 0; i < sortedNodes.length; i++) {
        const node = sortedNodes[i];
        const nodeDemand = demand.get(node.id);

        if (i === sortedNodes.length - 1) {
          // Last product gets remaining factories (ensures we hit the target exactly)
          const count = Math.max(1, totalFactories - allocatedFactories);
          factoryCounts.set(node.id, count);
          allocatedFactories += count;
        } else {
          // Proportional allocation based on demand
          const ratio = nodeDemand / totalDemand;
          const count = Math.max(1, Math.round(totalFactories * ratio));
          factoryCounts.set(node.id, count);
          allocatedFactories += count;
        }
      }
    } else {
      // Auto-scale: min 2, max 16 per product (2x baseline)
      for (const node of nodes) {
        const nodeDemand = demand.get(node.id);
        const ratio = nodeDemand / maxDemand;
        const count = Math.max(2, Math.min(16, Math.round(ratio * 16)));
        factoryCounts.set(node.id, count);
      }
    }

    return factoryCounts;
  }

  /** Fisher-Yates shuffle */
  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
