// GameSessionService - orchestrates game domain/application objects used by the runtime.
import { SimulationEngine } from '../../domain/simulation/simulation-engine.js';
import { TradeRenderer } from '../../ui/visualizers/trade-renderer.js';

export class GameSessionService {
  constructor({ scene, routeManager, mapEditor, tilemap, economyEditorService }) {
    this.scene = scene;
    this.routeManager = routeManager;
    this.mapEditor = mapEditor;
    this.tilemap = tilemap;
    this.economyEditorService = economyEditorService;

    this.simulationEngine = null;
    this.tradeRenderer = null;
  }

  setRuntimeReferences({ mapEditor, tilemap, routeManager }) {
    this.mapEditor = mapEditor;
    this.tilemap = tilemap;
    this.routeManager = routeManager;

    if (this.simulationEngine) {
      this.simulationEngine.objectManager = this.mapEditor.getObjectManager();
      this.simulationEngine.tilemap = this.tilemap;
      this.simulationEngine.routeManager = this.routeManager;
      this.simulationEngine.economyManager = this.economyEditorService.getGraph();
    }

    if (this.tradeRenderer) {
      this.tradeRenderer.tilemap = this.tilemap;
      this.tradeRenderer.simulationEngine = this.simulationEngine;
    }
  }

  disposeSimulation() {
    if (this.simulationEngine) {
      this.simulationEngine.stop();
    }
    if (this.tradeRenderer) {
      this.tradeRenderer.dispose();
    }
    this.simulationEngine = null;
    this.tradeRenderer = null;
  }

  getOrCreateSimulationEngine(onTick) {
    const economyGraph = this.economyEditorService.getGraph();
    const objectManager = this.mapEditor.getObjectManager();

    if (!this.simulationEngine) {
      this.simulationEngine = new SimulationEngine(economyGraph, objectManager, this.routeManager, this.tilemap);
      this.tradeRenderer = new TradeRenderer(this.scene, this.simulationEngine, this.tilemap);
    } else {
      this.simulationEngine.economyManager = economyGraph;
      this.simulationEngine.objectManager = objectManager;
      this.simulationEngine.routeManager = this.routeManager;
      this.simulationEngine.tilemap = this.tilemap;
    }

    this.simulationEngine.onTick = onTick;
    return this.simulationEngine;
  }

  getSimulationEngine() {
    return this.simulationEngine;
  }

  getTradeRenderer() {
    return this.tradeRenderer;
  }
}
