// EconomyGraph - domain model for product dependency DAG
import { Product } from './product.js';

export class EconomyGraph {
  constructor() {
    this.nodes = new Map(); // Map<id, Product>
    this.nextNodeId = 0;
    this.fuelProductId = null;
  }

  addProduct(name, imagePath = '', inputs = []) {
    for (const input of inputs) {
      if (!this.nodes.has(input.productId)) {
        throw new Error(`Input product ID ${input.productId} does not exist`);
      }
    }

    const node = new Product(this.nextNodeId, name, imagePath, inputs);
    const validation = node.validate();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (this.wouldCreateCycle(node)) {
      throw new Error('Adding this node would create a cycle in the DAG');
    }

    this.nodes.set(this.nextNodeId, node);
    const addedId = this.nextNodeId;
    this.nextNodeId++;
    return addedId;
  }

  updateProduct(id, name, imagePath, inputs) {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Node with ID ${id} does not exist`);
    }

    for (const input of inputs) {
      if (input.productId === id) {
        throw new Error('Node cannot depend on itself');
      }
      if (!this.nodes.has(input.productId)) {
        throw new Error(`Input product ID ${input.productId} does not exist`);
      }
    }

    const tempNode = new Product(id, name, imagePath, inputs);
    const validation = tempNode.validate();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const oldInputs = node.inputs;
    node.inputs = inputs;
    if (this.wouldCreateCycle(node)) {
      node.inputs = oldInputs;
      throw new Error('Updating this node would create a cycle in the DAG');
    }

    node.name = name;
    node.imagePath = imagePath;
    node.inputs = inputs;
  }

  deleteProduct(id) {
    if (!this.nodes.has(id)) {
      return false;
    }

    for (const node of this.nodes.values()) {
      if (node.id !== id && node.inputs.some(input => input.productId === id)) {
        throw new Error('Cannot delete node: other nodes depend on it');
      }
    }

    this.nodes.delete(id);
    return true;
  }

  getProduct(id) {
    return this.nodes.get(id);
  }

  listProducts() {
    return Array.from(this.nodes.values());
  }

  wouldCreateCycle(node) {
    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (nodeId) => {
      if (recStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recStack.add(nodeId);

      const currentNode = nodeId === node.id ? node : this.nodes.get(nodeId);
      if (currentNode) {
        for (const input of currentNode.inputs) {
          if (hasCycle(input.productId)) {
            return true;
          }
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    if (hasCycle(node.id)) {
      return true;
    }

    for (const otherNode of this.nodes.values()) {
      if (otherNode.inputs.some(input => input.productId === node.id)) {
        if (hasCycle(otherNode.id)) {
          return true;
        }
      }
    }

    return false;
  }

  topologicalSort() {
    const inDegree = new Map();
    const adjacencyList = new Map();

    for (const node of this.nodes.values()) {
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    }

    for (const node of this.nodes.values()) {
      for (const input of node.inputs) {
        const fromId = input.productId;
        const toId = node.id;
        adjacencyList.get(fromId).push(toId);
        inDegree.set(toId, inDegree.get(toId) + 1);
      }
    }

    const queue = [];
    const result = [];

    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const nodeId = queue.shift();
      result.push(nodeId);

      for (const neighborId of adjacencyList.get(nodeId)) {
        inDegree.set(neighborId, inDegree.get(neighborId) - 1);
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId);
        }
      }
    }

    return result;
  }

  calculateDepths() {
    const depths = new Map();

    const calculateDepth = (nodeId) => {
      if (depths.has(nodeId)) return depths.get(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node || node.inputs.length === 0) {
        depths.set(nodeId, 0);
        return 0;
      }

      let maxDepth = -1;
      for (const input of node.inputs) {
        const inputDepth = calculateDepth(input.productId);
        maxDepth = Math.max(maxDepth, inputDepth);
      }

      const depth = maxDepth + 1;
      depths.set(nodeId, depth);
      return depth;
    };

    for (const node of this.nodes.values()) {
      calculateDepth(node.id);
    }

    return depths;
  }

  setFuelProduct(productId) {
    if (productId !== null && !this.nodes.has(productId)) {
      throw new Error(`Product ID ${productId} does not exist`);
    }
    this.fuelProductId = productId;
  }

  getFuelProductId() {
    return this.fuelProductId;
  }

  isFuel(productId) {
    return this.fuelProductId === productId;
  }

  serialize() {
    const nodes = Array.from(this.nodes.values()).map(node => node.serialize());
    return {
      version: 2,
      nodes,
      nextNodeId: this.nextNodeId,
      fuelProductId: this.fuelProductId
    };
  }

  load(data) {
    if (!data || data.version !== 2) {
      throw new Error('Unsupported economy version. Expected version 2.');
    }
    if (!Array.isArray(data.nodes)) {
      throw new Error('Invalid economy file: missing nodes array');
    }

    this.nodes.clear();
    this.nextNodeId = data.nextNodeId ?? 0;
    this.fuelProductId = data.fuelProductId ?? null;

    for (const nodeData of data.nodes) {
      const node = Product.deserialize(nodeData);
      this.nodes.set(node.id, node);
    }
  }

  clear() {
    this.nodes.clear();
    this.nextNodeId = 0;
    this.fuelProductId = null;
  }

  // Compatibility aliases while migrating call sites.
  addNode(name, imagePath = '', inputs = []) { return this.addProduct(name, imagePath, inputs); }
  updateNode(id, name, imagePath, inputs) { return this.updateProduct(id, name, imagePath, inputs); }
  deleteNode(id) { return this.deleteProduct(id); }
  getNode(id) { return this.getProduct(id); }
  getAllNodes() { return this.listProducts(); }
  loadFromData(data) { return this.load(data); }
}
