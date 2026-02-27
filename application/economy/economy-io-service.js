// EconomyIOService - application-level serialization and loading for economy state.
import { EconomyGraph } from '../../domain/economy/economy-graph.js';

export class EconomyIOService {
  toJson(graph) {
    return JSON.stringify(graph.serialize(), null, 2);
  }

  fromJson(json) {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      throw new Error('Invalid economy file: not valid JSON');
    }

    if (!data || data.version !== 2) {
      throw new Error('Unsupported economy version. Expected version 2.');
    }

    const graph = new EconomyGraph();
    graph.load(data);
    return graph;
  }

  async loadDefault(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.statusText}`);
    }
    const json = await response.text();
    return this.fromJson(json);
  }
}
