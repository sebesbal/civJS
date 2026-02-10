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
    this.cameraInitialized = false;
    
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
          // Fix orientation - SVG typically needs flipY = true for correct orientation
          texture.flipY = true;
          // Improve texture quality - use best filtering
          const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
          texture.anisotropy = maxAnisotropy > 0 ? maxAnisotropy : 16;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          texture.needsUpdate = true;
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

  // Create text texture with high quality
  createTextTexture(text, fontSize = 48, width = 1024, height = 256) {
    const canvas = document.createElement('canvas');
    // High resolution for crisp text
    const scale = 4; // Very high resolution
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');

    // Scale context for high DPI
    context.scale(scale, scale);

    // Clear canvas with transparent background
    context.clearRect(0, 0, width, height);

    // Draw text with strong shadow for better readability
    context.shadowColor = 'rgba(0, 0, 0, 1)';
    context.shadowBlur = 8;
    context.shadowOffsetX = 3;
    context.shadowOffsetY = 3;
    
    // Draw text outline first for better visibility
    context.strokeStyle = '#000000';
    context.lineWidth = 4;
    context.font = `bold ${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.strokeText(text, width / 2, height / 2);
    
    // Then fill text
    context.fillStyle = '#ffffff';
    context.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    // Best quality filtering
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
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

    // Initialize camera with fixed scale (only on first load)
    if (!this.cameraInitialized) {
      this.initializeCamera();
      this.cameraInitialized = true;
    }
  }

  // Create a 2D rounded rectangle mesh for a node
  async createNodeMesh(node) {
    const isSelected = node.id === this.selectedNodeId;
    
    // Create a group to hold the node components
    const nodeGroup = new THREE.Group();
    nodeGroup.position.set(node.position.x, node.position.y, 0);
    nodeGroup.userData.nodeId = node.id;
    
    // Create background rounded rectangle (using a plane with rounded corners via shader or simple plane)
    const bgGeometry = new THREE.PlaneGeometry(this.nodeWidth, this.nodeHeight);
    const bgMaterial = new THREE.MeshStandardMaterial({
      color: isSelected ? this.selectedNodeColor : this.nodeColor,
      emissive: isSelected ? this.selectedNodeColor : 0x000000,
      emissiveIntensity: isSelected ? 0.3 : 0
    });
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    bgMesh.position.z = -0.01; // Slightly behind the icon
    nodeGroup.add(bgMesh);

    // Create icon plane (centered)
    const imageTexture = await this.loadImageTexture(node.imagePath);
    if (imageTexture) {
      // Create a plane for the icon, slightly smaller than the node
      const iconSize = Math.min(this.nodeWidth * 0.8, this.nodeHeight * 0.8);
      const iconGeometry = new THREE.PlaneGeometry(iconSize, iconSize);
      const iconMaterial = new THREE.MeshBasicMaterial({
        map: imageTexture,
        transparent: true,
        color: isSelected ? this.selectedNodeColor : 0xffffff
      });
      const iconMesh = new THREE.Mesh(iconGeometry, iconMaterial);
      iconMesh.position.z = 0.01; // Slightly in front
      nodeGroup.add(iconMesh);
    }

    // Add text label below the node - make it much larger
    const textTexture = this.createTextTexture(node.name, 48, 1024, 256);
    const textMaterial = new THREE.SpriteMaterial({ 
      map: textTexture, 
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const textSprite = new THREE.Sprite(textMaterial);
    // Make text much larger for readability
    const textHeight = 0.8;
    textSprite.scale.set(this.nodeWidth * 2, textHeight, 1);
    textSprite.position.set(0, -this.nodeHeight / 2 - textHeight / 2 - 0.3, 0.1);
    textSprite.userData.nodeId = node.id;
    nodeGroup.add(textSprite);

    this.scene.add(nodeGroup);
    this.nodeMeshes.set(node.id, { mesh: nodeGroup, textSprite, bgMesh });
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
  async updateNodeMaterial(nodeGroup, nodeId, isSelected) {
    const node = this.economyManager.getNode(nodeId);
    if (!node) return;

    // Update background material
    const bgMesh = nodeGroup.children.find(child => child.material && child.material.type === 'MeshStandardMaterial');
    if (bgMesh) {
      bgMesh.material.color.setHex(isSelected ? this.selectedNodeColor : this.nodeColor);
      bgMesh.material.emissive.setHex(isSelected ? this.selectedNodeColor : 0x000000);
      bgMesh.material.emissiveIntensity = isSelected ? 0.3 : 0;
    }

    // Update icon material if it exists
    const iconMesh = nodeGroup.children.find(child => child.material && child.material.type === 'MeshBasicMaterial' && child.material.map);
    if (iconMesh) {
      iconMesh.material.color.setHex(isSelected ? this.selectedNodeColor : 0xffffff);
    }
  }

  // Clear all visualization elements
  clear() {
    // Remove node meshes
    for (const nodeData of this.nodeMeshes.values()) {
      // Dispose all children in the group
      nodeData.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
      this.scene.remove(nodeData.mesh);
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

  // Initialize camera with fixed scale (don't auto-fit)
  initializeCamera() {
    if (!this.camera.isOrthographicCamera) return;
    
    // Fixed view size at startup
    const fixedViewSize = 20;
    const rendererWidth = this.renderer.domElement.width;
    const rendererHeight = this.renderer.domElement.height;
    const aspect = rendererWidth / rendererHeight || 1;
    
    this.camera.left = -fixedViewSize * aspect;
    this.camera.right = fixedViewSize * aspect;
    this.camera.top = fixedViewSize;
    this.camera.bottom = -fixedViewSize;
    
    // Center at origin
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  // Update camera view size (for zoom)
  updateCameraViewSize(viewSize) {
    if (!this.camera.isOrthographicCamera) return;
    
    const aspect = this.renderer.domElement.width / this.renderer.domElement.height || 1;
    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  // Get current view size
  getCurrentViewSize() {
    if (!this.camera.isOrthographicCamera) return 20;
    return this.camera.top;
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

    // Get all meshes from node groups (including children)
    const allMeshes = [];
    for (const nodeData of this.nodeMeshes.values()) {
      nodeData.mesh.traverse((child) => {
        if (child.isMesh) {
          allMeshes.push(child);
        }
      });
    }
    
    if (allMeshes.length === 0) return null;
    
    const intersects = raycaster.intersectObjects(allMeshes, true);

    if (intersects.length > 0) {
      // Find the parent group
      let obj = intersects[0].object;
      while (obj && obj.userData.nodeId === undefined) {
        obj = obj.parent;
      }
      if (obj && obj.userData.nodeId !== undefined) {
        return this.economyManager.getNode(obj.userData.nodeId);
      }
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
