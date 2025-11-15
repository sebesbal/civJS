import * as THREE from 'three';
import { TileTypes } from './config/tile-types.js';
import { NoiseGenerator } from './noise.js';

export class Tilemap {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.mapSize = options.mapSize || 20;
    this.tileSize = options.tileSize || 1;
    this.tileHeight = options.tileHeight || 0.1;
    this.tiles = [];
    this.heightMap = null;
    this.noiseGenerator = null;
    
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

    // Generate height map if not loading from saved data
    if (!tileData) {
      this.noiseGenerator = new NoiseGenerator();
      this.heightMap = this.noiseGenerator.generateHeightMap(
        this.mapSize,
        this.mapSize,
        0.08, // Scale - lower = smoother terrain
        4     // Octaves - more = more detail
      );
    }

    // First pass: collect all height values to determine range
    const heightValues = [];
    for (let x = 0; x < this.mapSize; x++) {
      for (let z = 0; z < this.mapSize; z++) {
        const key = `${x},${z}`;
        const savedData = tileDataMap.get(key);
        let heightValue;
        
        if (savedData) {
          if (savedData.heightValue !== undefined) {
            heightValue = savedData.heightValue;
          } else {
            const maxAbs = Math.max(Math.abs(savedData.heightVariation), 0.01);
            if (maxAbs <= 0.6) {
              heightValue = (savedData.heightVariation + 0.5) / 1.0;
            } else {
              heightValue = (savedData.heightVariation / 2.5) + 0.5;
            }
            heightValue = Math.max(0, Math.min(1, heightValue));
          }
        } else {
          heightValue = this.heightMap[z][x];
        }
        heightValues.push(heightValue);
      }
    }

    // Calculate height range for tile sizing
    const minHeight = Math.min(...heightValues);
    const maxHeight = Math.max(...heightValues);
    const heightRange = (maxHeight - minHeight) * 2.5; // Scale matches heightPosition calculation
    // Make tiles tall enough to cover gaps (height range + base tile height + extra padding)
    const extendedTileHeight = Math.max(this.tileHeight, heightRange + 0.5);

    // Second pass: create tiles
    for (let x = 0; x < this.mapSize; x++) {
      for (let z = 0; z < this.mapSize; z++) {
        let tileTypeIndex;
        let heightValue;
        
        // Use saved data if available, otherwise generate from height map
        const key = `${x},${z}`;
        const savedData = tileDataMap.get(key);
        
        if (savedData) {
          tileTypeIndex = savedData.tileTypeIndex;
          // Use heightValue if available, otherwise convert from heightVariation
          if (savedData.heightValue !== undefined) {
            heightValue = savedData.heightValue;
          } else {
            // Convert saved heightVariation back to normalized height
            const maxAbs = Math.max(Math.abs(savedData.heightVariation), 0.01);
            if (maxAbs <= 0.6) {
              heightValue = (savedData.heightVariation + 0.5) / 1.0;
            } else {
              heightValue = (savedData.heightVariation / 2.5) + 0.5;
            }
            heightValue = Math.max(0, Math.min(1, heightValue));
          }
        } else {
          // Get height from height map
          heightValue = this.heightMap[z][x];
          
          // Determine tile type based on height
          tileTypeIndex = this.getTileTypeFromHeight(heightValue);
        }
        
        const tileType = TileTypes[tileTypeIndex];
        const color = tileType.color;
        
        // Calculate actual height position (normalized 0-1 maps to -1.0 to 1.5 for more dramatic terrain)
        const heightPosition = (heightValue - 0.5) * 2.5;
        
        // Create tile with extended height to cover gaps
        const geometry = new THREE.BoxGeometry(this.tileSize, extendedTileHeight, this.tileSize);
        const material = new THREE.MeshStandardMaterial({color: color});
        const tile = new THREE.Mesh(geometry, material);
        
        // Store tile data for later serialization
        tile.userData = {
          tileTypeIndex: tileTypeIndex,
          heightVariation: heightPosition, // Store as position for compatibility
          heightValue: heightValue, // Store normalized height
          gridX: x,
          gridZ: z
        };
        
        // Position tiles in a grid, centered around origin
        // Position tile so its center is at heightPosition
        const offset = (this.mapSize * this.tileSize) / 2 - this.tileSize / 2;
        tile.position.set(
          x * this.tileSize - offset,
          heightPosition,
          z * this.tileSize - offset
        );
        
        this.scene.add(tile);
        this.tiles.push(tile);
      }
    }
  }

  // Get tile type index based on height value (0-1)
  getTileTypeFromHeight(height) {
    for (let i = 0; i < TileTypes.length; i++) {
      const tileType = TileTypes[i];
      if (height >= tileType.minHeight && height < tileType.maxHeight) {
        return i;
      }
    }
    // Fallback to last tile type if height is exactly 1.0
    return TileTypes.length - 1;
  }

  // Get tile at world position (x, z coordinates)
  getTileAtPosition(x, z) {
    const offset = (this.mapSize * this.tileSize) / 2 - this.tileSize / 2;
    const gridX = Math.round((x + offset) / this.tileSize);
    const gridZ = Math.round((z + offset) / this.tileSize);
    
    return this.tiles.find(tile => 
      tile.userData.gridX === gridX && tile.userData.gridZ === gridZ
    );
  }

  // Get the top surface Y position of a tile at world coordinates (x, z)
  getTileTopSurface(x, z) {
    const tile = this.getTileAtPosition(x, z);
    if (tile) {
      return tile.position.y + (tile.geometry.parameters.height / 2);
    }
    return 0; // Default if tile not found
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
        heightVariation: tile.userData.heightVariation,
        heightValue: tile.userData.heightValue || ((tile.userData.heightVariation + 0.5) / 1.0)
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
