// EconomyEditorService - application service for editing economy graph.
import { EconomyGraph } from '../../domain/economy/economy-graph.js';
import { RandomEconomyGenerator } from '../../domain/economy/random-economy-generator.js';

export class EconomyEditorService {
  constructor({ graph = null, randomGenerator = null } = {}) {
    this.graph = graph || new EconomyGraph();
    this.randomGenerator = randomGenerator || new RandomEconomyGenerator([]);
    this._subscribers = new Set();
  }

  subscribeEconomyChanged(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  _emitChanged() {
    for (const callback of this._subscribers) {
      callback(this.graph);
    }
  }

  setIconCatalog(iconCatalog) {
    this.randomGenerator.setIconCatalog(iconCatalog);
  }

  getGraph() {
    return this.graph;
  }

  addProduct(name, imagePath = '', inputs = []) {
    const id = this.graph.addProduct(name, imagePath, inputs);
    this._emitChanged();
    return id;
  }

  updateProduct(id, name, imagePath, inputs) {
    this.graph.updateProduct(id, name, imagePath, inputs);
    this._emitChanged();
  }

  deleteProduct(id) {
    const result = this.graph.deleteProduct(id);
    this._emitChanged();
    return result;
  }

  setFuelProduct(productId) {
    this.graph.setFuelProduct(productId);
    this._emitChanged();
  }

  loadEconomyData(data) {
    this.graph.load(data);
    this._emitChanged();
  }

  replaceGraph(graph) {
    this.graph = graph;
    this._emitChanged();
  }

  generateRandomEconomy(numNodes, maxDepth, minInputs, maxInputs) {
    this.graph = this.randomGenerator.generateRandomEconomy(numNodes, maxDepth, minInputs, maxInputs);
    this._emitChanged();
    return this.graph;
  }
}
