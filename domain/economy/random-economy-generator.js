// RandomEconomyGenerator - domain-level random DAG generation.
import { EconomyGraph } from './economy-graph.js';

export class RandomEconomyGenerator {
  /**
   * @param {Array<{name:string, path:string}>} iconCatalog
   */
  constructor(iconCatalog = []) {
    this.iconCatalog = iconCatalog;
  }

  setIconCatalog(iconCatalog) {
    this.iconCatalog = iconCatalog || [];
  }

  getRandomIcon() {
    if (this.iconCatalog.length === 0) {
      return { path: '', name: 'Product' };
    }
    const randomIndex = Math.floor(Math.random() * this.iconCatalog.length);
    return this.iconCatalog[randomIndex];
  }

  generateRandomEconomy(numNodes, maxDepth, minInputs, maxInputs) {
    const graph = new EconomyGraph();

    if (numNodes <= 0) throw new Error('Number of nodes must be greater than 0');
    if (maxDepth < 0) throw new Error('Max depth must be non-negative');
    if (minInputs < 0 || maxInputs < minInputs) throw new Error('Invalid input range');

    const shuffledIcons = [...this.iconCatalog].sort(() => Math.random() - 0.5);
    let iconIndex = 0;

    const nodesByDepth = [];
    for (let i = 0; i <= maxDepth; i++) nodesByDepth.push([]);

    const numRawMaterials = Math.max(1, Math.floor(numNodes / (maxDepth + 1)));
    for (let i = 0; i < numRawMaterials && i < numNodes; i++) {
      const icon = shuffledIcons.length > 0 ? shuffledIcons[iconIndex % shuffledIcons.length] : this.getRandomIcon();
      iconIndex++;
      const nodeId = graph.addProduct(icon.name, icon.path, []);
      nodesByDepth[0].push(nodeId);
    }

    let createdNodes = numRawMaterials;

    for (let depth = 1; depth <= maxDepth && createdNodes < numNodes; depth++) {
      const nodesAtPrevDepth = nodesByDepth[depth - 1];
      if (nodesAtPrevDepth.length === 0) break;

      const remainingNodes = numNodes - createdNodes;
      const nodesAtThisDepth = Math.min(
        remainingNodes,
        Math.max(1, Math.floor((numNodes - numRawMaterials) / maxDepth))
      );

      for (let i = 0; i < nodesAtThisDepth && createdNodes < numNodes; i++) {
        const icon = shuffledIcons.length > 0 ? shuffledIcons[iconIndex % shuffledIcons.length] : this.getRandomIcon();
        iconIndex++;

        const numInputs = Math.floor(Math.random() * (maxInputs - minInputs + 1)) + minInputs;
        const availableInputs = [];
        for (let d = 0; d < depth; d++) availableInputs.push(...nodesByDepth[d]);

        const shuffledInputs = [...availableInputs].sort(() => Math.random() - 0.5);
        const selectedInputs = shuffledInputs.slice(0, Math.min(numInputs, availableInputs.length));

        const inputs = selectedInputs.map(inputId => ({
          productId: inputId,
          amount: Math.round((Math.random() * 9 + 1) * 10) / 10
        }));

        try {
          const nodeId = graph.addProduct(icon.name, icon.path, inputs);
          nodesByDepth[depth].push(nodeId);
          createdNodes++;
        } catch {
          if (inputs.length > 1) {
            const reducedInputs = inputs.slice(0, Math.floor(inputs.length / 2));
            try {
              const nodeId = graph.addProduct(icon.name, icon.path, reducedInputs);
              nodesByDepth[depth].push(nodeId);
              createdNodes++;
            } catch {
              // Skip if still invalid.
            }
          }
        }
      }
    }

    while (createdNodes < numNodes) {
      const icon = shuffledIcons.length > 0 ? shuffledIcons[iconIndex % shuffledIcons.length] : this.getRandomIcon();
      iconIndex++;

      let depth = Math.floor(Math.random() * (maxDepth + 1));
      let availableInputs = [];
      for (let d = 0; d < depth; d++) availableInputs.push(...nodesByDepth[d]);

      if (availableInputs.length === 0 && depth > 0) {
        depth = 1;
        availableInputs = nodesByDepth[0];
      }

      if (availableInputs.length === 0) break;

      const numInputs = Math.min(
        Math.floor(Math.random() * (maxInputs - minInputs + 1)) + minInputs,
        availableInputs.length
      );

      const shuffledInputs = [...availableInputs].sort(() => Math.random() - 0.5);
      const selectedInputs = shuffledInputs.slice(0, numInputs);
      const inputs = selectedInputs.map(inputId => ({
        productId: inputId,
        amount: Math.round((Math.random() * 9 + 1) * 10) / 10
      }));

      try {
        const nodeId = graph.addProduct(icon.name, icon.path, inputs);
        if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
        nodesByDepth[depth].push(nodeId);
        createdNodes++;
      } catch {
        if (inputs.length > 0) {
          try {
            const nodeId = graph.addProduct(icon.name, icon.path, [inputs[0]]);
            if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
            nodesByDepth[depth].push(nodeId);
            createdNodes++;
          } catch {
            break;
          }
        }
      }
    }

    return graph;
  }
}
