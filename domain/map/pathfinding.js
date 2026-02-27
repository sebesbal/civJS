// A* Pathfinding on the tilemap grid

/**
 * Find the shortest path between two grid positions using A*.
 * @param {Tilemap} tilemap
 * @param {{gridX: number, gridZ: number}} start
 * @param {{gridX: number, gridZ: number}} end
 * @param {Set<string>} roadTiles - Set of "gridX,gridZ" keys for road tiles
 * @returns {{gridX: number, gridZ: number}[]|null} - Path as array of grid positions, or null if no path
 */
export function findPath(tilemap, start, end, roadTiles) {
  const mapSize = tilemap.getConfig().mapSize;

  // Build tile lookup for fast access
  const tileMap = new Map();
  for (const tile of tilemap.tiles) {
    tileMap.set(`${tile.userData.gridX},${tile.userData.gridZ}`, tile);
  }

  const startKey = `${start.gridX},${start.gridZ}`;
  const endKey = `${end.gridX},${end.gridZ}`;

  // Open set as a simple priority queue (array sorted by f-score)
  const openSet = [];
  const gScore = new Map();  // best known cost from start
  const fScore = new Map();  // gScore + heuristic
  const cameFrom = new Map();
  const closedSet = new Set();

  gScore.set(startKey, 0);
  fScore.set(startKey, _heuristic(start, end));
  openSet.push({ key: startKey, gridX: start.gridX, gridZ: start.gridZ });

  const directions = [
    { dx: 0, dz: -1 },  // up
    { dx: 0, dz: 1 },   // down
    { dx: -1, dz: 0 },  // left
    { dx: 1, dz: 0 },   // right
  ];

  while (openSet.length > 0) {
    // Get node with lowest fScore
    openSet.sort((a, b) => (fScore.get(a.key) ?? Infinity) - (fScore.get(b.key) ?? Infinity));
    const current = openSet.shift();

    if (current.key === endKey) {
      return _reconstructPath(cameFrom, current);
    }

    closedSet.add(current.key);

    for (const dir of directions) {
      const nx = current.gridX + dir.dx;
      const nz = current.gridZ + dir.dz;

      // Bounds check
      if (nx < 0 || nx >= mapSize || nz < 0 || nz >= mapSize) continue;

      const neighborKey = `${nx},${nz}`;
      if (closedSet.has(neighborKey)) continue;

      // Check tile passability
      const tile = tileMap.get(neighborKey);
      if (!tile) continue;

      // Water tiles are impassable (tileTypeIndex < 3)
      if (tile.userData.tileTypeIndex < 3) continue;

      // Movement cost: 1.0 for normal tiles, 0.3 for road tiles
      const moveCost = roadTiles.has(neighborKey) ? 0.3 : 1.0;
      const tentativeG = (gScore.get(current.key) ?? Infinity) + moveCost;

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + _heuristic({ gridX: nx, gridZ: nz }, end));

        // Add to open set if not already there
        if (!openSet.find(n => n.key === neighborKey)) {
          openSet.push({ key: neighborKey, gridX: nx, gridZ: nz });
        }
      }
    }
  }

  return null; // No path found
}

/**
 * Compute which grid tiles have a road passing through them.
 * Samples each road's spline curve at many points and snaps to the grid.
 * @param {RouteManager} routeManager
 * @param {Tilemap} tilemap
 * @returns {Set<string>} Set of "gridX,gridZ" keys
 */
export function computeRoadTiles(routeManager, tilemap) {
  const roadTiles = new Set();
  const config = tilemap.getConfig();
  const offset = (config.mapSize * config.tileSize) / 2 - config.tileSize / 2;
  const sampleCount = 100; // samples per road

  for (const route of routeManager.getAllRoutes()) {
    if (!route.curve) continue;

    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const point = route.curve.getPoint(t);

      // Snap to grid
      const gridX = Math.round((point.x + offset) / config.tileSize);
      const gridZ = Math.round((point.z + offset) / config.tileSize);

      if (gridX >= 0 && gridX < config.mapSize && gridZ >= 0 && gridZ < config.mapSize) {
        roadTiles.add(`${gridX},${gridZ}`);
      }
    }
  }

  return roadTiles;
}

/**
 * Convert a world position to grid coordinates.
 */
export function worldToGrid(worldX, worldZ, tilemap) {
  const config = tilemap.getConfig();
  const offset = (config.mapSize * config.tileSize) / 2 - config.tileSize / 2;
  return {
    gridX: Math.round((worldX + offset) / config.tileSize),
    gridZ: Math.round((worldZ + offset) / config.tileSize)
  };
}

/**
 * Convert grid coordinates to world position (center of tile).
 */
export function gridToWorld(gridX, gridZ, tilemap) {
  const config = tilemap.getConfig();
  const offset = (config.mapSize * config.tileSize) / 2 - config.tileSize / 2;
  return {
    x: gridX * config.tileSize - offset,
    z: gridZ * config.tileSize - offset
  };
}

// Manhattan distance heuristic
function _heuristic(a, b) {
  return Math.abs(a.gridX - b.gridX) + Math.abs(a.gridZ - b.gridZ);
}

// Reconstruct path from cameFrom map
function _reconstructPath(cameFrom, current) {
  const path = [{ gridX: current.gridX, gridZ: current.gridZ }];
  let key = current.key;

  while (cameFrom.has(key)) {
    const prev = cameFrom.get(key);
    path.unshift({ gridX: prev.gridX, gridZ: prev.gridZ });
    key = prev.key;
  }

  return path;
}
