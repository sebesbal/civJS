// Economy Manager - manages the DAG of product nodes
import { ProductNode } from './product-node.js';

export class EconomyManager {
  constructor() {
    this.nodes = new Map(); // Map<id, ProductNode>
    this.nextNodeId = 0;
  }

  // Add a new node to the DAG
  addNode(name, imagePath = '', inputs = []) {
    // Validate inputs reference existing nodes
    for (const input of inputs) {
      if (!this.nodes.has(input.productId)) {
        throw new Error(`Input product ID ${input.productId} does not exist`);
      }
    }

    const node = new ProductNode(this.nextNodeId, name, imagePath, inputs);
    const validation = node.validate();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check for cycles before adding
    if (this.wouldCreateCycle(node)) {
      throw new Error('Adding this node would create a cycle in the DAG');
    }

    this.nodes.set(this.nextNodeId, node);
    const addedId = this.nextNodeId;
    this.nextNodeId++;
    return addedId;
  }

  // Update an existing node
  updateNode(id, name, imagePath, inputs) {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Node with ID ${id} does not exist`);
    }

    // Validate inputs reference existing nodes (excluding self)
    for (const input of inputs) {
      if (input.productId === id) {
        throw new Error('Node cannot depend on itself');
      }
      if (!this.nodes.has(input.productId)) {
        throw new Error(`Input product ID ${input.productId} does not exist`);
      }
    }

    // Create temporary node to validate
    const tempNode = new ProductNode(id, name, imagePath, inputs);
    const validation = tempNode.validate();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check for cycles before updating
    const oldInputs = node.inputs;
    node.inputs = inputs;
    if (this.wouldCreateCycle(node)) {
      node.inputs = oldInputs; // Restore
      throw new Error('Updating this node would create a cycle in the DAG');
    }

    // Update node properties
    node.name = name;
    node.imagePath = imagePath;
    node.inputs = inputs;
  }

  // Delete a node
  deleteNode(id) {
    if (!this.nodes.has(id)) {
      return false;
    }

    // Check if any other node depends on this one
    for (const node of this.nodes.values()) {
      if (node.id !== id && node.inputs.some(input => input.productId === id)) {
        throw new Error(`Cannot delete node: other nodes depend on it`);
      }
    }

    this.nodes.delete(id);
    return true;
  }

  // Get a node by ID
  getNode(id) {
    return this.nodes.get(id);
  }

  // Get all nodes
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  // Check if adding/updating a node would create a cycle
  wouldCreateCycle(node) {
    // Use DFS to detect cycles
    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (nodeId) => {
      if (recStack.has(nodeId)) {
        return true; // Cycle detected
      }
      if (visited.has(nodeId)) {
        return false; // Already processed
      }

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

    // Check if the node itself creates a cycle
    if (hasCycle(node.id)) {
      return true;
    }

    // Check if any node that depends on this node creates a cycle
    for (const otherNode of this.nodes.values()) {
      if (otherNode.inputs.some(input => input.productId === node.id)) {
        if (hasCycle(otherNode.id)) {
          return true;
        }
      }
    }

    return false;
  }

  // Topological sort for layout calculation
  topologicalSort() {
    const inDegree = new Map();
    const adjacencyList = new Map();

    // Initialize
    for (const node of this.nodes.values()) {
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    }

    // Build graph and calculate in-degrees
    for (const node of this.nodes.values()) {
      for (const input of node.inputs) {
        const fromId = input.productId;
        const toId = node.id;
        adjacencyList.get(fromId).push(toId);
        inDegree.set(toId, inDegree.get(toId) + 1);
      }
    }

    // Kahn's algorithm
    const queue = [];
    const result = [];

    // Start with nodes that have no incoming edges (raw materials)
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
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

  // Calculate depth of each node (distance from raw materials)
  calculateDepths() {
    const depths = new Map();

    const calculateDepth = (nodeId) => {
      if (depths.has(nodeId)) {
        return depths.get(nodeId);
      }

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

  // Serialize entire economy to JSON-compatible object
  serialize() {
    const nodes = Array.from(this.nodes.values()).map(node => node.serialize());
    return {
      version: 1,
      nodes: nodes,
      nextNodeId: this.nextNodeId
    };
  }

  // Load economy from serialized data
  loadFromData(data) {
    this.nodes.clear();
    this.nextNodeId = data.nextNodeId || 0;

    if (data.nodes && Array.isArray(data.nodes)) {
      for (const nodeData of data.nodes) {
        const node = ProductNode.deserialize(nodeData);
        this.nodes.set(node.id, node);
      }
    }
  }

  // Clear all nodes
  clear() {
    this.nodes.clear();
    this.nextNodeId = 0;
  }
}

