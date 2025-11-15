import * as THREE from 'three';
import { TileTypes } from './config/tile-types.js';

export function createTilemap(scene, options = {}) {
  const mapSize = options.mapSize || 20;
  const tileSize = options.tileSize || 1;
  const tileHeight = options.tileHeight || 0.1;
  const tiles = [];

  for (let x = 0; x < mapSize; x++) {
    for (let z = 0; z < mapSize; z++) {
      // Random tile type
      const tileTypeIndex = Math.floor(Math.random() * TileTypes.length);
      const tileType = TileTypes[tileTypeIndex];
      const color = tileType.color;
      
      // Slight random height variation for visual interest
      const heightVariation = (Math.random() - 0.5) * 0.1;
      
      const geometry = new THREE.BoxGeometry(tileSize, tileHeight, tileSize);
      const material = new THREE.MeshStandardMaterial({color: color});
      const tile = new THREE.Mesh(geometry, material);
      
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
