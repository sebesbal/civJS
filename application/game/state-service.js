// GameStateService - application-level game state persistence.
export class GameStateService {
  constructor(version = 4) {
    this.currentVersion = version;
  }

  saveGameState({ tilemap, objectManager, routeManager, economyGraph = null, simulationEngine = null }) {
    const tileData = tilemap.getTileData();
    const mapConfig = tilemap.getConfig();
    const objectData = objectManager.serialize();
    const routeData = routeManager.serialize();

    const gameState = {
      version: this.currentVersion,
      mapConfig,
      tiles: tileData,
      objects: objectData.objects,
      routes: routeData.routes,
      nextObjectId: objectData.nextId,
      nextRouteId: routeData.nextRouteId,
      economy: economyGraph ? economyGraph.serialize() : null,
      simulation: simulationEngine ? simulationEngine.serialize() : null
    };

    return JSON.stringify(gameState, null, 2);
  }

  loadGameState(gameStateJson) {
    let data;
    try {
      data = JSON.parse(gameStateJson);
    } catch {
      throw new Error('Invalid game save: not valid JSON');
    }

    if (!data || data.version !== 4) {
      throw new Error('Unsupported game save version. Expected version 4.');
    }

    const requiredFields = ['mapConfig', 'tiles', 'objects', 'routes'];
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        throw new Error(`Invalid game save: missing ${field}`);
      }
    }

    return data;
  }
}
