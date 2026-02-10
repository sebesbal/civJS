// Save/Load Manager for game state persistence
import { SaveLoadBase } from '../utils/save-load-base.js';

export class SaveLoadManager extends SaveLoadBase {
  constructor() {
    super(1);
  }

  // Serialize game state to JSON
  saveGameState(tilemap, objectManager, routeManager) {
    const tileData = tilemap.getTileData();
    const mapConfig = tilemap.getConfig();
    const objectData = objectManager.serialize();
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
  }

  // Download game state as JSON file
  downloadGameState(gameStateJson, filename = 'game-save.json') {
    this.downloadAsFile(gameStateJson, filename);
  }

  // Load game state from JSON string
  async loadGameState(gameStateJson) {
    return this.parseAndValidate(gameStateJson, ['mapConfig', 'tiles']);
  }
}
