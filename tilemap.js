import * as THREE from 'three';
import { TileTypes } from './config/tile-types.js';

export class Tilemap {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.mapSize = options.mapSize || 20;
    this.tileSize = options.tileSize || 1;
    this.tileHeight = options.tileHeight || 0.1;
    this.tiles = [];
    
    // Create tiles
    this.createTiles(options.tileData || null);
  }

  createTiles(tileData = null) {
    // Clear existing tiles
    this.clear();
    
    // Create a map of tile data by position for quick lookup
    const tileDataMap = new Map();
    if (tileData) {
      tileData.forEach(data => {
        const key = `${data.x},${data.z}`;
        tileDataMap.set(key, data);
      });
    }

    for (let x = 0; x < this.mapSize; x++) {
      for (let z = 0; z < this.mapSize; z++) {
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
        
        const geometry = new THREE.BoxGeometry(this.tileSize, this.tileHeight, this.tileSize);
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
        const offset = (this.mapSize * this.tileSize) / 2 - this.tileSize / 2;
        tile.position.set(
          x * this.tileSize - offset,
          heightVariation,
          z * this.tileSize - offset
        );
        
        this.scene.add(tile);
        this.tiles.push(tile);
      }
    }
  }

  // Get map configuration
  getConfig() {
    return {
      mapSize: this.mapSize,
      tileSize: this.tileSize,
      tileHeight: this.tileHeight
    };
  }

  // Get tile data for serialization
  getTileData() {
    const tileData = [];
    this.tiles.forEach(tile => {
      tileData.push({
        x: tile.userData.gridX,
        z: tile.userData.gridZ,
        tileTypeIndex: tile.userData.tileTypeIndex,
        heightVariation: tile.userData.heightVariation
      });
    });
    return tileData;
  }

  // Clear all tiles from scene
  clear() {
    this.tiles.forEach(tile => {
      this.scene.remove(tile);
      tile.geometry.dispose();
      tile.material.dispose();
    });
    this.tiles = [];
  }
}

// Backward compatibility: export a function that creates a Tilemap
export function createTilemap(scene, options = {}) {
  const tilemap = new Tilemap(scene, options);
  return tilemap;
}
