import * as THREE from 'three';
import { TileTypes } from './config/tile-types.js';

export function createTilemap(scene, options = {}) {
  const mapSize = options.mapSize || 20;
  const tileSize = options.tileSize || 1;
  const tileHeight = options.tileHeight || 0.1;
  const tileData = options.tileData || null; // Optional saved tile data
  const tiles = [];

  // Create a map of tile data by position for quick lookup
  const tileDataMap = new Map();
  if (tileData) {
    tileData.forEach(data => {
      const key = `${data.x},${data.z}`;
      tileDataMap.set(key, data);
    });
  }

  for (let x = 0; x < mapSize; x++) {
    for (let z = 0; z < mapSize; z++) {
      let tileTypeIndex;
      let heightVariation;
      
      // Use saved data if available, otherwise generate randomly
      const key = `${x},${z}`;
      const savedData = tileDataMap.get(key);
      
      if (savedData) {
        tileTypeIndex = savedData.tileTypeIndex;
        heightVariation = savedData.heightVariation;
      } else {
        // Random tile type
        tileTypeIndex = Math.floor(Math.random() * TileTypes.length);
        // Slight random height variation for visual interest
        heightVariation = (Math.random() - 0.5) * 0.1;
      }
      
      const tileType = TileTypes[tileTypeIndex];
      const color = tileType.color;
      
      const geometry = new THREE.BoxGeometry(tileSize, tileHeight, tileSize);
      const material = new THREE.MeshStandardMaterial({color: color});
      const tile = new THREE.Mesh(geometry, material);
      
      // Store tile data for later serialization
      tile.userData = {
        tileTypeIndex: tileTypeIndex,
        heightVariation: heightVariation,
        gridX: x,
        gridZ: z
      };
      
      // Position tiles in a grid, centered around origin
      const offset = (mapSize * tileSize) / 2 - tileSize / 2;
      tile.position.set(
        x * tileSize - offset,
        heightVariation,
        z * tileSize - offset
      );
      
      scene.add(tile);
      tiles.push(tile);
    }
  }

  return tiles;
}

// Get tile data for serialization
export function getTileData(tiles, mapConfig) {
  const tileData = [];
  tiles.forEach(tile => {
    tileData.push({
      x: tile.userData.gridX,
      z: tile.userData.gridZ,
      tileTypeIndex: tile.userData.tileTypeIndex,
      heightVariation: tile.userData.heightVariation
    });
  });
  return tileData;
}
