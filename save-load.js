// Save/Load Manager for game state persistence
import { getTileData } from './tilemap.js';

export class SaveLoadManager {
  constructor() {
    this.currentVersion = 1;
  }

  // Serialize game state to JSON
  saveGameState(mapConfig, tiles, objectManager, routeManager) {
    try {
      // Get tile data
      const tileData = getTileData(tiles, mapConfig);
      
      // Get object data
      const objectData = objectManager.serialize();
      
      // Get route data
      const routeData = routeManager.serialize();
      
      const gameState = {
        version: this.currentVersion,
        mapConfig: mapConfig,
        tiles: tileData,
        objects: objectData.objects,
        routes: routeData.routes,
        nextObjectId: objectData.nextId,
        nextRouteId: routeData.nextRouteId
      };
      
      return JSON.stringify(gameState, null, 2);
    } catch (error) {
      console.error('Error saving game state:', error);
      throw error;
    }
  }

  // Download game state as JSON file
  downloadGameState(gameStateJson, filename = 'game-save.json') {
    const blob = new Blob([gameStateJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Load game state from JSON string
  async loadGameState(gameStateJson) {
    try {
      const gameState = JSON.parse(gameStateJson);
      
      // Validate version
      if (!gameState.version || gameState.version > this.currentVersion) {
        throw new Error('Unsupported save file version');
      }
      
      // Validate required fields
      if (!gameState.mapConfig || !gameState.tiles) {
        throw new Error('Invalid save file: missing required data');
      }
      
      return gameState;
    } catch (error) {
      console.error('Error loading game state:', error);
      throw error;
    }
  }

  // Read file from file input
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(e.target.result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

