// Random Factory Generator - places factories on the map based on the current economy

export class RandomFactoryGenerator {
  /**
   * Generate random factories on the map for all products in the economy.
   * @param {EconomyManager} economyManager
   * @param {ObjectManager} objectManager
   * @param {Tilemap} tilemap
   * @param {Object} options - { minSpacing: 2 }
   * @returns {number[]} array of created object IDs
   */
  generate(economyManager, objectManager, tilemap, options = {}) {
    const minSpacing = options.minSpacing ?? 2;

    const nodes = economyManager.getAllNodes();
    if (nodes.length === 0) return [];

    const depths = economyManager.calculateDepths();

    // Determine how many factories per product based on depth
    const factoryCounts = new Map();
    for (const node of nodes) {
      const depth = depths.get(node.id) ?? 0;
      let count;
      if (depth === 0) count = 3;       // Raw materials: 3 each
      else if (depth <= 2) count = 2;    // Intermediate: 2 each
      else count = 1;                     // High-tier: 1 each
      factoryCounts.set(node.id, count);
    }

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

  /** Fisher-Yates shuffle */
  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
