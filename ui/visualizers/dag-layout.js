// DAG Layout Algorithm - calculates node positions for visualization
export class DAGLayout {
  constructor(options = {}) {
    this.horizontalSpacing = options.horizontalSpacing || 4; // Distance between depth layers
    this.verticalSpacing = options.verticalSpacing || 2.5; // Distance between nodes at same depth
    this.startX = options.startX || 0;
    this.startY = options.startY || 0;
    this.startZ = options.startZ || 0; // Keep z at 0 for 2D layout
  }

  // Calculate positions for all nodes in the DAG
  calculateLayout(economyManager) {
    const depths = economyManager.calculateDepths();
    const nodes = economyManager.getAllNodes();

    // Group nodes by depth
    const nodesByDepth = new Map();
    let maxDepth = 0;

    for (const node of nodes) {
      const depth = depths.get(node.id);
      maxDepth = Math.max(maxDepth, depth);

      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth).push(node);
    }

    // Calculate positions
    const positions = new Map();

    for (let depth = 0; depth <= maxDepth; depth++) {
      const nodesAtDepth = nodesByDepth.get(depth) || [];
      
      // Sort nodes at same depth by ID for consistent layout
      nodesAtDepth.sort((a, b) => a.id - b.id);

      // Calculate vertical positions
      const totalHeight = (nodesAtDepth.length - 1) * this.verticalSpacing;
      const startY = this.startY - totalHeight / 2;

      nodesAtDepth.forEach((node, index) => {
        const x = this.startX + depth * this.horizontalSpacing;
        const y = startY + index * this.verticalSpacing;
        const z = 0; // 2D layout - all nodes at z=0

        positions.set(node.id, { x, y, z });
        node.position = { x, y, z };
      });
    }

    return positions;
  }

  // Get bounding box of all nodes
  getBoundingBox(economyManager) {
    const nodes = economyManager.getAllNodes();
    if (nodes.length === 0) {
      return {
        minX: 0, maxX: 0,
        minY: 0, maxY: 0,
        minZ: 0, maxZ: 0
      };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const node of nodes) {
      const pos = node.position;
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
      minZ = Math.min(minZ, pos.z);
      maxZ = Math.max(maxZ, pos.z);
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  // Center the layout around origin
  centerLayout(economyManager) {
    const bbox = this.getBoundingBox(economyManager);
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    const centerZ = (bbox.minZ + bbox.maxZ) / 2;

    for (const node of economyManager.getAllNodes()) {
      node.position.x -= centerX;
      node.position.y -= centerY;
      node.position.z -= centerZ;
    }
  }
}

