// Economy Visualizer - Three.js visualization of the DAG (2D with 3D effects)
import * as THREE from 'three';
import { DAGLayout } from './dag-layout.js';

export class EconomyVisualizer {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.economyManager = null;
    this.layout = new DAGLayout();
    
    // Visual elements
    this.nodeMeshes = new Map(); // Map<nodeId, THREE.Mesh>
    this.connectionLines = new Map(); // Map<connectionKey, THREE.Line>
    this.selectedNodeId = null;
    this.imageTextures = new Map(); // Map<imagePath, THREE.Texture>
    
    // Node appearance
    this.nodeWidth = 2;
    this.nodeHeight = 1.5;
    this.nodeDepth = 0.1; // Small depth for 3D effect
    this.borderRadius = 0.2;
    this.nodeColor = 0x4a9eff;
    this.selectedNodeColor = 0xffff00;
    this.connectionColor = 0x00ff00;
    this.backgroundColor = 0x2a2a2a;
    
    // Text rendering
    this.textCanvas = document.createElement('canvas');
    this.textContext = this.textCanvas.getContext('2d');
  }

  // Create rounded rectangle shape
  createRoundedRectShape(width, height, radius) {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    const w = width;
    const h = height;
    const r = radius;

    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);

    return shape;
  }

  // Load image texture (supports both regular images and SVG)
  async loadImageTexture(imagePath) {
    if (!imagePath) return null;

    // Check if texture is already loaded
    if (this.imageTextures.has(imagePath)) {
      return this.imageTextures.get(imagePath);
    }

    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        imagePath,
        (texture) => {
          texture.flipY = false; // SVG and some images need this
          this.imageTextures.set(imagePath, texture);
          resolve(texture);
        },
        undefined,
        (error) => {
          console.warn(`Failed to load image: ${imagePath}`, error);
          resolve(null); // Return null instead of rejecting
        }
      );
    });
  }

  // Create text texture
  createTextTexture(text, fontSize = 24, width = 512, height = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    // Clear canvas
    context.clearRect(0, 0, width, height);

    // Draw text
    context.fillStyle = '#ffffff';
    context.font = `bold ${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // Set the economy manager and update visualization
  async setEconomyManager(economyManager) {
    this.economyManager = economyManager;
    await this.updateVisualization();
  }

  // Update the entire visualization
  async updateVisualization() {
    if (!this.economyManager) return;

    // Clear existing visualization
    this.clear();

    // Calculate layout
    this.layout.calculateLayout(this.economyManager);
    this.layout.centerLayout(this.economyManager);

    // Create node meshes (async to load images)
    const nodes = this.economyManager.getAllNodes();
    for (const node of nodes) {
      await this.createNodeMesh(node);
    }

    // Create connections
    for (const node of nodes) {
      for (const input of node.inputs) {
        this.createConnection(input.productId, node.id);
      }
    }

    // Update camera to view entire DAG
    this.updateCamera();
  }

  // Create a 2D rounded rectangle mesh for a node
  async createNodeMesh(node) {
    const isSelected = node.id === this.selectedNodeId;
    
    // Create rounded rectangle shape
    const shape = this.createRoundedRectShape(this.nodeWidth, this.nodeHeight, this.borderRadius);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: this.nodeDepth,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3
    });

    // Create material with image texture if available
    let material;
    const imageTexture = await this.loadImageTexture(node.imagePath);
    
    if (imageTexture) {
      // Create materials array for front (with image) and other faces
      const frontMaterial = new THREE.MeshStandardMaterial({
        map: imageTexture,
        color: isSelected ? this.selectedNodeColor : 0xffffff,
        emissive: isSelected ? this.selectedNodeColor : 0x000000,
        emissiveIntensity: isSelected ? 0.2 : 0
      });
      
      const sideMaterial = new THREE.MeshStandardMaterial({
        color: isSelected ? this.selectedNodeColor : this.nodeColor,
        emissive: isSelected ? this.selectedNodeColor : 0x000000,
        emissiveIntensity: isSelected ? 0.3 : 0
      });
      
      // ExtrudeGeometry uses materials array: [front, back, sides]
      material = [frontMaterial, sideMaterial, sideMaterial];
    } else {
      // No image, use solid color
      material = new THREE.MeshStandardMaterial({
        color: isSelected ? this.selectedNodeColor : this.nodeColor,
        emissive: isSelected ? this.selectedNodeColor : 0x000000,
        emissiveIntensity: isSelected ? 0.3 : 0
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.position.x, node.position.y, 0); // 2D plane at z=0
    mesh.userData.nodeId = node.id;
    mesh.userData.imagePath = node.imagePath; // Store for material updates
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Add text label below the node
    const textTexture = this.createTextTexture(node.name, 20);
    const textMaterial = new THREE.SpriteMaterial({ map: textTexture, transparent: true });
    const textSprite = new THREE.Sprite(textMaterial);
    textSprite.scale.set(this.nodeWidth * 1.2, 0.3, 1);
    textSprite.position.set(node.position.x, node.position.y - this.nodeHeight / 2 - 0.3, 0.1);
    textSprite.userData.nodeId = node.id;
    this.scene.add(textSprite);

    this.scene.add(mesh);
    this.nodeMeshes.set(node.id, { mesh, textSprite });
  }

  // Create a spline connection between two nodes (2D)
  createConnection(fromNodeId, toNodeId) {
    const fromNode = this.economyManager.getNode(fromNodeId);
    const toNode = this.economyManager.getNode(toNodeId);

    if (!fromNode || !toNode) return;

    // Create control points for smooth spline in 2D
    const fromPos = new THREE.Vector3(fromNode.position.x + this.nodeWidth / 2, fromNode.position.y, 0);
    const toPos = new THREE.Vector3(toNode.position.x - this.nodeWidth / 2, toNode.position.y, 0);

    // Add control points for smoother curve
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;

    // Offset control point to create arc (in 2D, slight vertical curve)
    const offset = (toPos.x - fromPos.x) * 0.2;
    const controlPoint = new THREE.Vector3(midX, midY + offset, 0);

    const waypoints = [fromPos, controlPoint, toPos];
    const curve = new THREE.CatmullRomCurve3(waypoints, false, 'centripetal');
    const points = curve.getPoints(50);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: this.connectionColor,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    const connectionKey = `${fromNodeId}-${toNodeId}`;
    this.connectionLines.set(connectionKey, line);
  }

  // Select a node (highlight it)
  async selectNode(nodeId) {
    // Deselect previous node
    if (this.selectedNodeId !== null) {
      const prevNodeData = this.nodeMeshes.get(this.selectedNodeId);
      if (prevNodeData) {
        await this.updateNodeMaterial(prevNodeData.mesh, this.selectedNodeId, false);
      }
    }

    this.selectedNodeId = nodeId;

    // Highlight selected node
    if (nodeId !== null) {
      const nodeData = this.nodeMeshes.get(nodeId);
      if (nodeData) {
        await this.updateNodeMaterial(nodeData.mesh, nodeId, true);
      }
    }
  }

  // Update node material for selection state
  async updateNodeMaterial(mesh, nodeId, isSelected) {
    const node = this.economyManager.getNode(nodeId);
    if (!node) return;

    // Dispose old materials
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else {
      mesh.material.dispose();
    }

    const imageTexture = await this.loadImageTexture(node.imagePath);
    
    if (imageTexture) {
      const frontMaterial = new THREE.MeshStandardMaterial({
        map: imageTexture,
        color: isSelected ? this.selectedNodeColor : 0xffffff,
        emissive: isSelected ? this.selectedNodeColor : 0x000000,
        emissiveIntensity: isSelected ? 0.2 : 0
      });
      
      const sideMaterial = new THREE.MeshStandardMaterial({
        color: isSelected ? this.selectedNodeColor : this.nodeColor,
        emissive: isSelected ? this.selectedNodeColor : 0x000000,
        emissiveIntensity: isSelected ? 0.3 : 0
      });
      
      mesh.material = [frontMaterial, sideMaterial, sideMaterial];
    } else {
      mesh.material = new THREE.MeshStandardMaterial({
        color: isSelected ? this.selectedNodeColor : this.nodeColor,
        emissive: isSelected ? this.selectedNodeColor : 0x000000,
        emissiveIntensity: isSelected ? 0.3 : 0
      });
    }
  }

  // Clear all visualization elements
  clear() {
    // Remove node meshes
    for (const nodeData of this.nodeMeshes.values()) {
      this.scene.remove(nodeData.mesh);
      this.scene.remove(nodeData.textSprite);
      nodeData.mesh.geometry.dispose();
      if (Array.isArray(nodeData.mesh.material)) {
        nodeData.mesh.material.forEach(m => m.dispose());
      } else {
        nodeData.mesh.material.dispose();
      }
      nodeData.textSprite.material.map.dispose();
      nodeData.textSprite.material.dispose();
    }
    this.nodeMeshes.clear();

    // Remove connections
    for (const line of this.connectionLines.values()) {
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.connectionLines.clear();

    this.selectedNodeId = null;
  }

  // Update camera to view entire DAG (2D view)
  updateCamera() {
    if (!this.economyManager || this.economyManager.getAllNodes().length === 0) {
      return;
    }

    const bbox = this.layout.getBoundingBox(this.economyManager);
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;

    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const maxDim = Math.max(width, height);

    // Position camera to view 2D plane from above with slight angle
    const distance = maxDim * 1.5;
    this.camera.position.set(centerX, centerY + distance * 0.3, distance);
    this.camera.lookAt(centerX, centerY, 0);
    this.camera.updateProjectionMatrix();
  }

  // Raycast to find node under mouse
  raycast(event) {
    if (!this.economyManager) return null;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const meshes = Array.from(this.nodeMeshes.values()).map(nd => nd.mesh);
    if (meshes.length === 0) return null;
    
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const nodeId = intersects[0].object.userData.nodeId;
      return this.economyManager.getNode(nodeId);
    }

    return null;
  }

  // Dispose of all resources
  dispose() {
    this.clear();
    
    // Dispose of image textures
    for (const texture of this.imageTextures.values()) {
      texture.dispose();
    }
    this.imageTextures.clear();
  }
}
