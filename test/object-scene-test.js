// Object Scene Test - 3D object manipulation based on EconomyEditorUI pattern
import * as THREE from 'three';

export class ObjectSceneTest {
  constructor(container) {
    this.container = container;
    this.canvasContainer = null;
    
    // Object management
    this.objects = new Map(); // id -> { mesh, data }
    this.nextObjectId = 1;
    this.selectedObjectId = null;
    
    // Three.js setup
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // Camera controls
    this.isPanning = false;
    this.panStart = null;
    this.cameraStartPosition = null;
    this.minZoom = 2;
    this.maxZoom = 1000;
    this.currentZoom = 20;
    this.calculatedMaxZoom = null;
    
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
    
    // Fit view to content after adding objects
    this.fitToScreen();
  }

  createUI() {
    this.container.innerHTML = '';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.height = '100%';
    this.container.style.background = '#0d0d0d';

    // Canvas container (full area)
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.style.cssText = `
      flex: 1;
      position: relative;
      background: #0a0a0f;
      overflow: hidden;
    `;
    this.container.appendChild(this.canvasContainer);
  }

  setupThreeJS() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    // Create camera (orthographic for 2D-like view)
    const aspect = 1;
    const viewSize = this.currentZoom;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      0.1, 1000
    );
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(800, 600);
    this.renderer.shadowMap.enabled = true;
    this.canvasContainer.appendChild(this.renderer.domElement);

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

    // Setup controls
    this.setupCameraControls();
    this.setupObjectInteraction();

    // Handle resize
    window.addEventListener('resize', () => this.handleResize());
    new ResizeObserver(() => this.handleResize()).observe(this.canvasContainer);

    // Start animation loop
    this.animate();
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

  // Get bounding box of all objects
  getBoundingBox() {
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

  calculateMaxZoom() {
    if (this.objects.size === 0) {
      this.calculatedMaxZoom = 100;
      return;
    }
    
    const bbox = this.getBoundingBox();
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const maxDim = Math.max(width, height);
    
    if (maxDim === 0) {
      this.calculatedMaxZoom = 100;
      return;
    }
    
    // Calculate view size to fit the content with padding
    const padding = 2;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    
    let viewSize;
    if (width / height > aspect) {
      viewSize = (maxDim / 2) + padding;
    } else {
      viewSize = ((maxDim / 2) + padding) / aspect;
    }
    
    viewSize = Math.max(this.minZoom, viewSize);
    this.calculatedMaxZoom = viewSize;
  }

  // Constrain camera so viewport always stays within content bounds
  constrainCameraToContentBounds() {
    if (!this.camera || !this.renderer || this.objects.size === 0) {
      return;
    }
    
    const contentBbox = this.getBoundingBox();
    
    // Get viewport dimensions
    const rect = this.renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    const viewSize = this.currentZoom;
    
    // Calculate viewport bounds in world coordinates
    const viewportHalfWidth = viewSize * aspect;
    const viewportHalfHeight = viewSize;
    
    // Current viewport bounds
    const viewportLeft = this.camera.position.x - viewportHalfWidth;
    const viewportRight = this.camera.position.x + viewportHalfWidth;
    const viewportBottom = this.camera.position.y - viewportHalfHeight;
    const viewportTop = this.camera.position.y + viewportHalfHeight;
    
    // Content bounds with padding
    const nodePadding = 1.5;
    const contentLeft = contentBbox.minX - nodePadding;
    const contentRight = contentBbox.maxX + nodePadding;
    const contentBottom = contentBbox.minY - nodePadding;
    const contentTop = contentBbox.maxY + nodePadding;
    
    // Clamp camera position so viewport stays within content bounds
    let newCameraX = this.camera.position.x;
    let newCameraY = this.camera.position.y;
    
    // Constrain horizontally
    if (viewportRight > contentRight) {
      newCameraX = contentRight - viewportHalfWidth;
    }
    if (viewportLeft < contentLeft) {
      newCameraX = contentLeft + viewportHalfWidth;
    }
    
    // Constrain vertically
    if (viewportTop > contentTop) {
      newCameraY = contentTop - viewportHalfHeight;
    }
    if (viewportBottom < contentBottom) {
      newCameraY = contentBottom + viewportHalfHeight;
    }
    
    // If viewport is larger than content, center it
    const viewportWidth = viewportRight - viewportLeft;
    const viewportHeight = viewportTop - viewportBottom;
    const contentWidth = contentRight - contentLeft;
    const contentHeight = contentTop - contentBottom;
    
    if (viewportWidth > contentWidth) {
      newCameraX = (contentLeft + contentRight) / 2;
    }
    if (viewportHeight > contentHeight) {
      newCameraY = (contentBottom + contentTop) / 2;
    }
    
    // Update camera position if it changed
    if (newCameraX !== this.camera.position.x || newCameraY !== this.camera.position.y) {
      this.camera.position.x = newCameraX;
      this.camera.position.y = newCameraY;
      this.camera.lookAt(newCameraX, newCameraY, 0);
    }
    
    // Also constrain zoom - ensure zoom doesn't allow viewport to exceed content bounds
    const maxZoomForContent = Math.min(
      contentWidth / (2 * aspect),
      contentHeight / 2
    );
    
    // If current zoom is too large (viewport too large), reduce it
    if (this.currentZoom > maxZoomForContent) {
      this.currentZoom = maxZoomForContent;
      if (this.calculatedMaxZoom === null || this.currentZoom > this.calculatedMaxZoom) {
        this.calculatedMaxZoom = this.currentZoom;
      }
      this.updateCameraViewSize();
      this.constrainCameraToContentBounds();
    }
  }

  fitToScreen() {
    if (this.calculatedMaxZoom === null) {
      this.calculateMaxZoom();
    }
    
    if (!this.camera || this.objects.size === 0) return;
    
    const bbox = this.getBoundingBox();
    
    // Use calculated max zoom
    const viewSize = this.calculatedMaxZoom || 20;
    
    // Update zoom to fit
    this.currentZoom = viewSize;
    this.updateCameraViewSize();
    
    // Center camera on content
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    this.camera.position.set(centerX, centerY, 50);
    this.camera.lookAt(centerX, centerY, 0);
    
    // Apply constraints
    this.constrainCameraToContentBounds();
  }

  setupCameraControls() {
    this.panStart = new THREE.Vector2();
    this.cameraStartPosition = new THREE.Vector2();

    const canvas = this.renderer.domElement;

    // Mouse down - start panning (left click, like economy editor)
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
        this.isPanning = true;
        this.panStart.set(e.clientX, e.clientY);
        this.cameraStartPosition.set(this.camera.position.x, this.camera.position.y);
        canvas.style.cursor = 'grabbing';
      }
    });

    // Mouse move - pan camera
    canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const deltaX = e.clientX - this.panStart.x;
        const deltaY = e.clientY - this.panStart.y;

        const rect = canvas.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        const viewSize = this.currentZoom;
        const worldDeltaX = (deltaX / rect.width) * (viewSize * 2 * aspect);
        const worldDeltaY = -(deltaY / rect.height) * (viewSize * 2);

        this.camera.position.x = this.cameraStartPosition.x - worldDeltaX;
        this.camera.position.y = this.cameraStartPosition.y - worldDeltaY;
        this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);
        
        // Constrain camera to content bounds
        this.constrainCameraToContentBounds();
      }
    });

    // Mouse up - stop panning
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isPanning = false;
        canvas.style.cursor = 'default';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      this.isPanning = false;
      canvas.style.cursor = 'default';
    });

    // Wheel - zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const zoomSpeed = 0.002;
      const zoomDelta = e.deltaY * zoomSpeed;
      let newZoom = this.currentZoom * (1 + zoomDelta);
      
      // Calculate max zoom if not already calculated
      if (this.calculatedMaxZoom === null) {
        this.calculateMaxZoom();
      }
      
      // Clamp zoom to limits
      const maxZoom = this.calculatedMaxZoom || this.maxZoom;
      newZoom = Math.max(this.minZoom, Math.min(maxZoom, newZoom));
      
      if (newZoom !== this.currentZoom) {
        this.currentZoom = newZoom;
        this.updateCameraViewSize();
        // Constrain camera to content bounds after zoom
        this.constrainCameraToContentBounds();
      }
    });

    // Prevent context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setupObjectInteraction() {
    const canvas = this.renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;

      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

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
        }
      } else {
        this.deselectObject();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDraggingObject || this.selectedObjectId === null) return;

      const rect = canvas.getBoundingClientRect();
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
  }

  updateCameraViewSize() {
    if (!this.camera || !this.renderer) return;
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const viewSize = this.currentZoom;
    
    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Rotate selected object for highlight effect
    this.objects.forEach((obj, id) => {
      if (id === this.selectedObjectId) {
        obj.mesh.rotation.z += 0.01;
      }
    });
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  handleResize() {
    if (!this.renderer || !this.canvasContainer || !this.camera) return;
    
    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;
    
    if (width === 0 || height === 0) return;
    
    // Update renderer size
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(width, height);
    
    // Update camera view size
    this.updateCameraViewSize();
    
    // Constrain camera to content bounds after resize
    this.constrainCameraToContentBounds();
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
