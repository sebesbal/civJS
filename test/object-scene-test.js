// Object Scene Test - 3D object manipulation based on OrthographicViewerBase
import * as THREE from 'three';
import { OrthographicViewerBase } from '../utils/orthographic-viewer-base.js';

export class ObjectSceneTest extends OrthographicViewerBase {
  constructor(container) {
    super();
    
    this.container = container;
    
    // Object management
    this.objects = new Map(); // id -> { mesh, data }
    this.nextObjectId = 1;
    this.selectedObjectId = null;
    
    // Dragging objects
    this.isDraggingObject = false;
    this.dragOffset = new THREE.Vector2();
    
    this.init();
  }

  init() {
    this.createUI();
    this.setupThreeJS();
    
    // Add some initial objects for demonstration
    this.addObject('cube', { color: 0x4a9eff, position: { x: -3, y: 2 } });
    this.addObject('sphere', { color: 0xff6b6b, position: { x: 3, y: 2 } });
    this.addObject('cylinder', { color: 0x6bff6b, position: { x: 0, y: -2 } });
    this.addObject('torus', { color: 0xffb86b, position: { x: -3, y: -3 } });
    this.addObject('cone', { color: 0xb86bff, position: { x: 3, y: -3 } });
    
    // Signal that content is ready - this fixes the timing issue
    this.onContentReady();
  }

  createUI() {
    this.container.innerHTML = '';
    // Don't set display on container - the UI manager controls that
    // Use an inner wrapper for the flex layout instead
    this.container.style.height = '100%';
    this.container.style.background = '#0d0d0d';

    // Inner wrapper for flex layout (not affected by UI manager's display changes)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    `;
    this.container.appendChild(wrapper);

    // Canvas container (full area)
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.style.cssText = `
      flex: 1;
      position: relative;
      background: #0a0a0f;
      overflow: hidden;
    `;
    wrapper.appendChild(this.canvasContainer);
  }

  setupThreeJS() {
    // Initialize base class Three.js setup
    this.initializeThreeJS({
      initialZoom: 20,
      minZoom: 2,
      maxZoom: 1000,
      backgroundColor: 0x0a0a0f
    });

    // Set camera Z position for 3D viewing
    this.camera.position.z = 50;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 30);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xe94560, 0.5, 50);
    pointLight.position.set(-10, 10, 20);
    this.scene.add(pointLight);

    // Add grid helper
    this.createGrid();

    // Setup object interaction
    this.setupObjectInteraction();
  }

  createGrid() {
    const gridSize = 50;
    const gridDivisions = 50;
    
    // Main grid
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x0f3460, 0x0a1628);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -0.1;
    this.scene.add(gridHelper);
    
    // Axis lines
    const axisLength = 25;
    
    // X axis (red)
    const xAxisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisLength, 0, 0),
      new THREE.Vector3(axisLength, 0, 0)
    ]);
    const xAxisMat = new THREE.LineBasicMaterial({ color: 0xe94560, linewidth: 2 });
    this.scene.add(new THREE.Line(xAxisGeom, xAxisMat));
    
    // Y axis (green)
    const yAxisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0)
    ]);
    const yAxisMat = new THREE.LineBasicMaterial({ color: 0x6bff6b, linewidth: 2 });
    this.scene.add(new THREE.Line(yAxisGeom, yAxisMat));
  }

  // Implement abstract method: get bounding box of all objects
  getContentBoundingBox() {
    if (this.objects.size === 0) {
      return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    this.objects.forEach(obj => {
      const pos = obj.data.position;
      const padding = 1.5; // Account for object size
      minX = Math.min(minX, pos.x - padding);
      maxX = Math.max(maxX, pos.x + padding);
      minY = Math.min(minY, pos.y - padding);
      maxY = Math.max(maxY, pos.y + padding);
    });
    
    return { minX, maxX, minY, maxY };
  }

  // Implement abstract method: check if there are objects
  hasContent() {
    return this.objects.size > 0;
  }

  // Override to handle object clicks before panning
  handleMouseDownBeforePan(event) {
    if (!this.renderer) return false;
    
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const meshes = Array.from(this.objects.values()).map(obj => obj.mesh);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const objectEntry = Array.from(this.objects.entries()).find(([_, obj]) => obj.mesh === clickedMesh);
      
      if (objectEntry) {
        this.selectObject(objectEntry[0]);
        
        // Start dragging
        this.isDraggingObject = true;
        const worldPoint = intersects[0].point;
        this.dragOffset.set(
          clickedMesh.position.x - worldPoint.x,
          clickedMesh.position.y - worldPoint.y
        );
        canvas.style.cursor = 'move';
        return true; // Prevent panning
      }
    } else {
      this.deselectObject();
    }
    
    return false; // Allow panning
  }

  setupObjectInteraction() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDraggingObject || this.selectedObjectId === null) return;

      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Convert mouse to world coordinates
      const aspect = rect.width / rect.height;
      const viewSize = this.currentZoom;
      const worldX = mouse.x * viewSize * aspect + this.camera.position.x;
      const worldY = mouse.y * viewSize + this.camera.position.y;

      const objectEntry = this.objects.get(this.selectedObjectId);
      if (objectEntry) {
        objectEntry.mesh.position.x = worldX + this.dragOffset.x;
        objectEntry.mesh.position.y = worldY + this.dragOffset.y;
        objectEntry.data.position = {
          x: objectEntry.mesh.position.x,
          y: objectEntry.mesh.position.y
        };
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (this.isDraggingObject) {
        this.isDraggingObject = false;
        canvas.style.cursor = 'default';
      }
    });

    // Prevent context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Override animation hook to add custom animations
  onAnimate() {
    // Rotate selected object for highlight effect
    this.objects.forEach((obj, id) => {
      if (id === this.selectedObjectId) {
        obj.mesh.rotation.z += 0.01;
      }
    });
  }

  addObject(type, options = {}) {
    const id = this.nextObjectId++;
    const color = options.color || Math.random() * 0xffffff;
    const position = options.position || { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 };
    const scale = options.scale || 1;

    let geometry;
    switch (type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.8, 32, 32);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 32);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(0.6, 0.25, 16, 100);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(0.7, 1.5, 32);
        break;
      case 'octahedron':
        geometry = new THREE.OctahedronGeometry(0.9);
        break;
      case 'icosahedron':
        geometry = new THREE.IcosahedronGeometry(0.8);
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const material = new THREE.MeshPhongMaterial({
      color: color,
      specular: 0x444444,
      shininess: 60,
      flatShading: type === 'octahedron' || type === 'icosahedron'
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, 0);
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);

    const data = {
      id,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${id}`,
      color,
      position: { ...position },
      scale,
      rotation: { x: 0, y: 0, z: 0 }
    };

    this.objects.set(id, { mesh, data });
    
    // Recalculate max zoom when objects change
    this.calculatedMaxZoom = null;

    return id;
  }

  deleteObject(id) {
    const objectEntry = this.objects.get(id);
    if (objectEntry) {
      this.scene.remove(objectEntry.mesh);
      objectEntry.mesh.geometry.dispose();
      objectEntry.mesh.material.dispose();
      this.objects.delete(id);
      
      if (this.selectedObjectId === id) {
        this.deselectObject();
      }
      
      // Recalculate max zoom when objects change
      this.calculatedMaxZoom = null;
    }
  }

  clearAllObjects() {
    const ids = Array.from(this.objects.keys());
    ids.forEach(id => this.deleteObject(id));
  }

  selectObject(id) {
    // Reset previous selection
    if (this.selectedObjectId !== null) {
      const prevObj = this.objects.get(this.selectedObjectId);
      if (prevObj) {
        prevObj.mesh.material.emissive.setHex(0x000000);
        prevObj.mesh.rotation.z = 0;
      }
    }

    this.selectedObjectId = id;

    // Highlight new selection
    const objectEntry = this.objects.get(id);
    if (objectEntry) {
      objectEntry.mesh.material.emissive.setHex(0x333333);
    }
  }

  deselectObject() {
    if (this.selectedObjectId !== null) {
      const prevObj = this.objects.get(this.selectedObjectId);
      if (prevObj) {
        prevObj.mesh.material.emissive.setHex(0x000000);
        prevObj.mesh.rotation.z = 0;
      }
    }

    this.selectedObjectId = null;
  }
}
