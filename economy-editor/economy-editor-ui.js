// Economy Editor UI - handles economy editor interface
import * as THREE from 'three';
import { EconomyManager } from './economy-manager.js';
import { EconomyVisualizer } from './economy-visualizer.js';
import { EconomySaveLoadManager } from './economy-save-load.js';
import { RandomEconomyGenerator } from './random-economy-generator.js';

export class EconomyEditorUI {
  constructor() {
    this.container = null;
    this.canvasContainer = null;
    this.sidebar = null;
    this.propertiesPanel = null;
    
    this.economyManager = new EconomyManager();
    this.saveLoadManager = new EconomySaveLoadManager();
    this.randomGenerator = new RandomEconomyGenerator();
    this.visualizer = null;
    
    // Three.js setup
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.selectedNodeId = null;
    
    // Camera controls
    this.isPanning = false;
    this.panStart = null;
    this.cameraStartPosition = null;
    this.minZoom = 2;
    this.maxZoom = 1000; // Will be calculated based on graph size
    this.currentZoom = 20; // Initial zoom level
    this.calculatedMaxZoom = null; // Calculated max zoom based on graph size
    
    // Callbacks
    this.onSaveEconomy = null;
    this.onLoadEconomy = null;
    
    this.init();
  }

  async init() {
    this.createUI();
    this.setupThreeJS();
    this.updateNodeList();
    
    // Load default economy file if it exists, then initialize visualizer
    try {
      await this.loadDefaultEconomy();
    } catch (error) {
      // Silently fail if default file doesn't exist - this is expected for new installations
      if (error.message && error.message.includes('404')) {
        console.log('No default economy file found, starting with empty economy');
      } else {
        console.warn('Error loading default economy:', error);
      }
    }
    
    // Initialize visualizer with the economy manager (after loading default if available)
    try {
      await this.visualizer.setEconomyManager(this.economyManager);
    } catch (err) {
      console.error('Error initializing visualizer:', err);
    }
    
    // After visualization is set up, recalculate zoom constraints
    // This is needed when the Eco tab is selected on page load
    // (show() was called before the economy was loaded, so constraints weren't applied)
    this.calculatedMaxZoom = null;
    this.calculateMaxZoom();
    this.constrainCameraToGraphBounds();
    // Call handleResize to update camera with corrected zoom
    this.handleResize();
  }

  // Load default economy file
  async loadDefaultEconomy() {
    try {
      const economyData = await this.saveLoadManager.loadEconomyFromPath('economy-editor/economy-default.json');
      this.economyManager.loadFromData(economyData);
      this.deselectNode();
      this.updateNodeList();
      console.log('Default economy loaded successfully');
    } catch (error) {
      // Re-throw to let caller handle it
      throw error;
    }
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'economy-editor-ui';
    document.body.appendChild(this.container);

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Economy Editor';
    title.className = 'economy-title';
    this.container.appendChild(title);

    // Main content area
    const contentArea = document.createElement('div');
    contentArea.className = 'economy-content';
    
    // Sidebar
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'economy-sidebar';
    this.createSidebar();
    contentArea.appendChild(this.sidebar);

    // Canvas container
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'economy-canvas-container';
    contentArea.appendChild(this.canvasContainer);

    // Properties panel
    this.propertiesPanel = document.createElement('div');
    this.propertiesPanel.className = 'economy-properties-panel';
    this.propertiesPanel.style.display = 'none';
    contentArea.appendChild(this.propertiesPanel);

    this.container.appendChild(contentArea);
  }

  createSidebar() {
    // Node list section
    const nodeListSection = document.createElement('div');
    nodeListSection.className = 'economy-section';
    
    const nodeListTitle = document.createElement('h4');
    nodeListTitle.textContent = 'Products';
    nodeListSection.appendChild(nodeListTitle);

    this.nodeList = document.createElement('div');
    this.nodeList.className = 'economy-node-list';
    nodeListSection.appendChild(this.nodeList);

    // Create node button
    const createBtn = document.createElement('button');
    createBtn.className = 'economy-btn economy-btn-primary';
    createBtn.textContent = '+ Create Product';
    createBtn.addEventListener('click', () => this.showCreateNodeDialog());
    nodeListSection.appendChild(createBtn);

    // Generate random economy button
    const generateBtn = document.createElement('button');
    generateBtn.className = 'economy-btn';
    generateBtn.textContent = '🎲 Generate Random Economy';
    generateBtn.addEventListener('click', () => this.showGenerateRandomDialog());
    nodeListSection.appendChild(generateBtn);

    this.sidebar.appendChild(nodeListSection);

    // Save/Load section
    const saveLoadSection = document.createElement('div');
    saveLoadSection.className = 'economy-section';
    
    const saveLoadTitle = document.createElement('h4');
    saveLoadTitle.textContent = 'Save/Load';
    saveLoadSection.appendChild(saveLoadTitle);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'economy-btn';
    saveBtn.textContent = 'Save Economy';
    saveBtn.addEventListener('click', () => {
      this.saveEconomy();
    });
    saveLoadSection.appendChild(saveBtn);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'economy-btn';
    loadBtn.textContent = 'Load Economy';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.loadEconomy(file);
      }
      fileInput.value = '';
    });
    document.body.appendChild(fileInput);
    
    loadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    saveLoadSection.appendChild(loadBtn);

    this.sidebar.appendChild(saveLoadSection);
  }

  setupThreeJS() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Create camera (orthographic for true 2D view)
    const aspect = 1; // Will be updated on resize
    const viewSize = 20;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      0.1, 1000
    );
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);

    // Create renderer with high quality settings
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance",
      precision: "highp"
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1); // Use device pixel ratio for crisp rendering
    this.renderer.setSize(800, 600);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvasContainer.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Create visualizer
    this.visualizer = new EconomyVisualizer(this.scene, this.camera, this.renderer);
    // Store reference for default economy loading (will be set after loading default economy)
    this.visualizerReady = Promise.resolve();

    // Camera controls
    this.setupCameraControls();

    // Handle canvas clicks
    this.renderer.domElement.addEventListener('click', (e) => this.handleCanvasClick(e));
    
    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());

    // Start animation loop
    this.animate();
  }

  setupCameraControls() {
    // Initialize pan state
    this.panStart = new THREE.Vector2();
    this.cameraStartPosition = new THREE.Vector2();

    const canvas = this.renderer.domElement;

    // Mouse down - start panning
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

        // Convert screen delta to world delta
        const rect = canvas.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        const viewSize = this.currentZoom;
        const worldDeltaX = (deltaX / rect.width) * (viewSize * 2 * aspect);
        const worldDeltaY = -(deltaY / rect.height) * (viewSize * 2); // Negative for correct Y direction

        this.camera.position.x = this.cameraStartPosition.x - worldDeltaX;
        this.camera.position.y = this.cameraStartPosition.y - worldDeltaY;
        this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);
        
        // Constrain camera to graph bounds
        this.constrainCameraToGraphBounds();
      }
    });

    // Mouse up - stop panning
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isPanning = false;
        canvas.style.cursor = 'default';
      }
    });

    // Mouse leave - stop panning
    canvas.addEventListener('mouseleave', () => {
      this.isPanning = false;
      canvas.style.cursor = 'default';
    });

    // Wheel - zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      // Smoother zoom - use exponential scaling with smaller multiplier
      const zoomSpeed = 0.002; // Small multiplier for smooth zooming
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
        if (this.visualizer) {
          this.visualizer.updateCameraViewSize(this.currentZoom);
        }
        // Constrain camera to graph bounds after zoom
        this.constrainCameraToGraphBounds();
      }
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  calculateMaxZoom() {
    if (!this.economyManager || !this.visualizer) {
      this.calculatedMaxZoom = 100; // Default fallback
      return;
    }
    
    const nodes = this.economyManager.getAllNodes();
    if (nodes.length === 0) {
      this.calculatedMaxZoom = 100; // Default fallback
      return;
    }
    
    // Get bounding box from layout
    const layout = this.visualizer.layout;
    if (!layout) {
      this.calculatedMaxZoom = 100; // Default fallback
      return;
    }
    
    const bbox = layout.getBoundingBox(this.economyManager);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const maxDim = Math.max(width, height);
    
    if (maxDim === 0) {
      this.calculatedMaxZoom = 100; // Default fallback
      return;
    }
    
    // Calculate view size to fit the graph with padding
    const padding = 2;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    
    // Calculate view size needed to fit the graph
    let viewSize;
    if (width / height > aspect) {
      // Graph is wider than viewport aspect ratio
      viewSize = (maxDim / 2) + padding;
    } else {
      // Graph is taller than viewport aspect ratio
      viewSize = ((maxDim / 2) + padding) / aspect;
    }
    
    // Ensure we don't go below min zoom
    viewSize = Math.max(this.minZoom, viewSize);
    
    // Set calculated max zoom (this is the zoom level that fits the graph)
    this.calculatedMaxZoom = viewSize;
  }

  // Constrain camera so that the viewport (r1) always stays within graph bounds (r2)
  constrainCameraToGraphBounds() {
    if (!this.economyManager || !this.visualizer || !this.camera || !this.renderer) {
      return;
    }
    
    const nodes = this.economyManager.getAllNodes();
    if (nodes.length === 0) {
      return;
    }
    
    // Get graph bounding box (r2)
    const layout = this.visualizer.layout;
    if (!layout) {
      return;
    }
    
    const graphBbox = layout.getBoundingBox(this.economyManager);
    
    // Get viewport dimensions (r1)
    const rect = this.renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    const viewSize = this.currentZoom;
    
    // Calculate viewport bounds in world coordinates
    const viewportHalfWidth = viewSize * aspect;
    const viewportHalfHeight = viewSize;
    
    // Current viewport bounds (r1)
    const viewportLeft = this.camera.position.x - viewportHalfWidth;
    const viewportRight = this.camera.position.x + viewportHalfWidth;
    const viewportBottom = this.camera.position.y - viewportHalfHeight;
    const viewportTop = this.camera.position.y + viewportHalfHeight;
    
    // Graph bounds (r2) - add padding for node sizes
    const nodePadding = 1.5; // Account for node width/height
    const graphLeft = graphBbox.minX - nodePadding;
    const graphRight = graphBbox.maxX + nodePadding;
    const graphBottom = graphBbox.minY - nodePadding;
    const graphTop = graphBbox.maxY + nodePadding;
    
    // Clamp camera position so viewport stays within graph bounds
    let newCameraX = this.camera.position.x;
    let newCameraY = this.camera.position.y;
    
    // Constrain horizontally
    if (viewportRight > graphRight) {
      newCameraX = graphRight - viewportHalfWidth;
    }
    if (viewportLeft < graphLeft) {
      newCameraX = graphLeft + viewportHalfWidth;
    }
    
    // Constrain vertically
    if (viewportTop > graphTop) {
      newCameraY = graphTop - viewportHalfHeight;
    }
    if (viewportBottom < graphBottom) {
      newCameraY = graphBottom + viewportHalfHeight;
    }
    
    // If viewport is larger than graph, center it
    const viewportWidth = viewportRight - viewportLeft;
    const viewportHeight = viewportTop - viewportBottom;
    const graphWidth = graphRight - graphLeft;
    const graphHeight = graphTop - graphBottom;
    
    if (viewportWidth > graphWidth) {
      newCameraX = (graphLeft + graphRight) / 2;
    }
    if (viewportHeight > graphHeight) {
      newCameraY = (graphBottom + graphTop) / 2;
    }
    
    // Update camera position if it changed
    if (newCameraX !== this.camera.position.x || newCameraY !== this.camera.position.y) {
      this.camera.position.x = newCameraX;
      this.camera.position.y = newCameraY;
      this.camera.lookAt(newCameraX, newCameraY, 0);
    }
    
    // Also constrain zoom - ensure zoom doesn't allow viewport to exceed graph bounds
    // Calculate maximum allowed zoom (view size) to fit graph
    // Viewport width = 2 * viewSize * aspect, must be <= graphWidth
    // Viewport height = 2 * viewSize, must be <= graphHeight
    // So: viewSize <= graphWidth / (2 * aspect) AND viewSize <= graphHeight / 2
    // Maximum allowed viewSize is the minimum of these two
    const maxZoomForGraph = Math.min(
      graphWidth / (2 * aspect),
      graphHeight / 2
    );
    
    // If current zoom is too large (viewport too large), reduce it
    if (this.currentZoom > maxZoomForGraph) {
      this.currentZoom = maxZoomForGraph;
      // Update calculatedMaxZoom to reflect this constraint
      if (this.calculatedMaxZoom === null || this.currentZoom > this.calculatedMaxZoom) {
        this.calculatedMaxZoom = this.currentZoom;
      }
      this.visualizer.updateCameraViewSize(this.currentZoom);
      // Recalculate camera position after zoom change
      this.constrainCameraToGraphBounds();
    }
  }

  fitGraphToScreen() {
    if (this.calculatedMaxZoom === null) {
      this.calculateMaxZoom();
    }
    
    if (!this.economyManager || !this.visualizer || !this.camera) return;
    
    const nodes = this.economyManager.getAllNodes();
    if (nodes.length === 0) return;
    
    // Get bounding box from layout
    const layout = this.visualizer.layout;
    if (!layout) return;
    
    const bbox = layout.getBoundingBox(this.economyManager);
    
    // Use calculated max zoom
    const viewSize = this.calculatedMaxZoom || 20;
    
    // Update zoom to fit
    this.currentZoom = viewSize;
    this.visualizer.updateCameraViewSize(this.currentZoom);
    
    // Center camera on graph
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    this.camera.position.set(centerX, centerY, 10);
    this.camera.lookAt(centerX, centerY, 0);
    
    // Apply constraints
    this.constrainCameraToGraphBounds();
  }

  handleResize() {
    if (!this.renderer || !this.canvasContainer || !this.camera) return;
    
    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;
    
    // Update orthographic camera bounds with current zoom level
    const aspect = width / height;
    const viewSize = this.currentZoom || 20;
    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
    // Use device pixel ratio for crisp rendering
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(width, height);
    
    // Constrain camera to graph bounds after resize
    this.constrainCameraToGraphBounds();
  }

  handleCanvasClick(event) {
    if (!this.visualizer) return;
    
    const node = this.visualizer.raycast(event);
    if (node) {
      this.selectNode(node.id);
    } else {
      this.deselectNode();
    }
  }

  updateNodeList() {
    this.nodeList.innerHTML = '';
    const nodes = this.economyManager.getAllNodes();
    
    nodes.forEach(node => {
      const nodeItem = document.createElement('div');
      nodeItem.className = 'economy-node-item';
      if (node.id === this.selectedNodeId) {
        nodeItem.classList.add('selected');
      }
      
      nodeItem.textContent = node.name;
      nodeItem.addEventListener('click', () => this.selectNode(node.id));
      
      this.nodeList.appendChild(nodeItem);
    });
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.visualizer.selectNode(nodeId);
    this.updateNodeList();
    this.showPropertiesPanel(nodeId);
  }

  deselectNode() {
    this.selectedNodeId = null;
    this.visualizer.selectNode(null);
    this.updateNodeList();
    this.hidePropertiesPanel();
  }

  showCreateNodeDialog() {
    this.showNodeDialog(null);
  }

  showNodeDialog(nodeId) {
    const isEdit = nodeId !== null;
    const node = isEdit ? this.economyManager.getNode(nodeId) : null;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'economy-dialog';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'economy-dialog-content';
    
    const title = document.createElement('h4');
    title.textContent = isEdit ? 'Edit Product' : 'Create Product';
    dialogContent.appendChild(title);

    // Name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name:';
    dialogContent.appendChild(nameLabel);
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'economy-input';
    nameInput.value = node ? node.name : '';
    nameInput.placeholder = 'Product name';
    dialogContent.appendChild(nameInput);

    // Image path input
    const imageLabel = document.createElement('label');
    imageLabel.textContent = 'Image Path:';
    dialogContent.appendChild(imageLabel);
    
    const imageInput = document.createElement('input');
    imageInput.type = 'text';
    imageInput.className = 'economy-input';
    imageInput.value = node ? node.imagePath : '';
    imageInput.placeholder = 'path/to/image.png or image.svg';
    dialogContent.appendChild(imageInput);

    // Inputs section
    const inputsLabel = document.createElement('label');
    inputsLabel.textContent = 'Input Products (amounts needed to produce 10 units):';
    dialogContent.appendChild(inputsLabel);
    
    const inputsContainer = document.createElement('div');
    inputsContainer.className = 'economy-inputs-container';
    
    const inputs = node ? [...node.inputs] : [];
    
    const renderInputs = () => {
      inputsContainer.innerHTML = '';
      inputs.forEach((input, index) => {
        const inputRow = document.createElement('div');
        inputRow.className = 'economy-input-row';
        
        const productSelect = document.createElement('select');
        productSelect.className = 'economy-select';
        const allNodes = this.economyManager.getAllNodes();
        productSelect.innerHTML = '<option value="">Select product...</option>';
        allNodes.forEach(n => {
          if (!isEdit || n.id !== nodeId) {
            const option = document.createElement('option');
            option.value = n.id;
            option.textContent = n.name;
            option.selected = input.productId === n.id;
            productSelect.appendChild(option);
          }
        });
        productSelect.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val) {
            inputs[index].productId = parseInt(val);
          } else {
            inputs[index].productId = null;
          }
        });
        inputRow.appendChild(productSelect);
        
        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.className = 'economy-input-small';
        amountInput.value = input.amount;
        amountInput.min = '0.1';
        amountInput.step = '0.1';
        amountInput.addEventListener('change', (e) => {
          inputs[index].amount = parseFloat(e.target.value);
        });
        inputRow.appendChild(amountInput);
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'economy-btn-remove';
        removeBtn.addEventListener('click', () => {
          inputs.splice(index, 1);
          renderInputs();
        });
        inputRow.appendChild(removeBtn);
        
        inputsContainer.appendChild(inputRow);
      });
    };
    
    renderInputs();
    
    const addInputBtn = document.createElement('button');
    addInputBtn.textContent = '+ Add Input';
    addInputBtn.className = 'economy-btn-small';
    addInputBtn.addEventListener('click', () => {
      inputs.push({ productId: null, amount: 1 });
      renderInputs();
    });
    inputsContainer.appendChild(addInputBtn);
    
    dialogContent.appendChild(inputsContainer);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'economy-dialog-buttons';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'economy-btn economy-btn-primary';
    saveBtn.textContent = isEdit ? 'Save' : 'Create';
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const imagePath = imageInput.value.trim();
      const filteredInputs = inputs.filter(i => i.productId !== null && i.productId !== undefined && !isNaN(i.productId));
      
      if (!name) {
        alert('Product name is required');
        return;
      }
      
      try {
        if (isEdit) {
          this.economyManager.updateNode(nodeId, name, imagePath, filteredInputs);
        } else {
          const newId = this.economyManager.addNode(name, imagePath, filteredInputs);
          this.selectNode(newId);
        }
        
        await this.updateVisualization();
        this.updateNodeList();
        document.body.removeChild(dialog);
      } catch (error) {
        alert('Error: ' + error.message);
      }
    });
    buttonContainer.appendChild(saveBtn);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'economy-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    buttonContainer.appendChild(cancelBtn);
    
    dialogContent.appendChild(buttonContainer);
    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);
  }

  showPropertiesPanel(nodeId) {
    const node = this.economyManager.getNode(nodeId);
    if (!node) return;

    this.propertiesPanel.innerHTML = '';
    this.propertiesPanel.style.display = 'block';

    const title = document.createElement('h4');
    title.textContent = 'Product Properties';
    this.propertiesPanel.appendChild(title);

    const nameRow = document.createElement('div');
    nameRow.className = 'economy-property-row';
    nameRow.innerHTML = `<strong>Name:</strong> <span>${node.name}</span>`;
    this.propertiesPanel.appendChild(nameRow);

    const imageRow = document.createElement('div');
    imageRow.className = 'economy-property-row';
    imageRow.innerHTML = `<strong>Image:</strong> <span>${node.imagePath || 'None'}</span>`;
    this.propertiesPanel.appendChild(imageRow);

    const inputsRow = document.createElement('div');
    inputsRow.className = 'economy-property-row';
    if (node.inputs.length === 0) {
      inputsRow.innerHTML = `<strong>Inputs:</strong> <span>Raw Material</span>`;
    } else {
      const inputsList = node.inputs.map(input => {
        const inputNode = this.economyManager.getNode(input.productId);
        return `${inputNode ? inputNode.name : 'Unknown'} (${input.amount})`;
      }).join(', ');
      inputsRow.innerHTML = `<strong>Inputs:</strong> <span>${inputsList}</span>`;
    }
    this.propertiesPanel.appendChild(inputsRow);

    const editBtn = document.createElement('button');
    editBtn.className = 'economy-btn economy-btn-primary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      this.showNodeDialog(nodeId);
      this.hidePropertiesPanel();
    });
    this.propertiesPanel.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'economy-btn economy-btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Delete "${node.name}"?`)) {
        try {
          this.economyManager.deleteNode(nodeId);
          this.deselectNode();
          await this.updateVisualization();
          this.updateNodeList();
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    });
    this.propertiesPanel.appendChild(deleteBtn);
  }

  hidePropertiesPanel() {
    this.propertiesPanel.style.display = 'none';
  }

  async updateVisualization() {
    if (this.visualizer) {
      await this.visualizer.updateVisualization();
      // Recalculate max zoom after visualization updates
      this.calculatedMaxZoom = null;
      this.calculateMaxZoom();
      // Apply constraints after visualization update
      this.constrainCameraToGraphBounds();
    }
  }

  // Save economy data
  saveEconomy() {
    try {
      const economyDataJson = this.saveLoadManager.saveEconomyData(this.economyManager);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      this.saveLoadManager.downloadEconomyData(economyDataJson, `economy-save-${timestamp}.json`);
      console.log('Economy saved successfully');
    } catch (error) {
      console.error('Failed to save economy:', error);
      alert('Failed to save economy: ' + error.message);
    }
  }

  // Load economy data
  async loadEconomy(file) {
    try {
      const fileContent = await this.saveLoadManager.readFile(file);
      const economyData = await this.saveLoadManager.loadEconomyData(fileContent);
      
      this.economyManager.loadFromData(economyData);
      this.deselectNode();
      await this.updateVisualization();
      this.updateNodeList();
      
      console.log('Economy loaded successfully');
    } catch (error) {
      console.error('Failed to load economy:', error);
      alert('Failed to load economy: ' + error.message);
    }
  }

  show() {
    this.container.classList.add('visible');
    this.handleResize();
    this.updateNodeList();
  }

  hide() {
    this.container.classList.remove('visible');
  }

  showGenerateRandomDialog() {
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'economy-dialog';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'economy-dialog-content';
    
    const title = document.createElement('h4');
    title.textContent = 'Generate Random Economy';
    dialogContent.appendChild(title);

    // Number of nodes input
    const nodesLabel = document.createElement('label');
    nodesLabel.textContent = 'Number of Nodes:';
    dialogContent.appendChild(nodesLabel);
    
    const nodesInput = document.createElement('input');
    nodesInput.type = 'number';
    nodesInput.className = 'economy-input';
    nodesInput.value = '20';
    nodesInput.min = '1';
    nodesInput.max = '100';
    dialogContent.appendChild(nodesInput);

    // Max depth input
    const depthLabel = document.createElement('label');
    depthLabel.textContent = 'Max Depth (longest chain):';
    dialogContent.appendChild(depthLabel);
    
    const depthInput = document.createElement('input');
    depthInput.type = 'number';
    depthInput.className = 'economy-input';
    depthInput.value = '4';
    depthInput.min = '1';
    depthInput.max = '10';
    dialogContent.appendChild(depthInput);

    // Min inputs
    const minInputsLabel = document.createElement('label');
    minInputsLabel.textContent = 'Min Input Products:';
    dialogContent.appendChild(minInputsLabel);
    
    const minInputsInput = document.createElement('input');
    minInputsInput.type = 'number';
    minInputsInput.className = 'economy-input';
    minInputsInput.value = '1';
    minInputsInput.min = '0';
    minInputsInput.max = '10';
    dialogContent.appendChild(minInputsInput);

    // Max inputs
    const maxInputsLabel = document.createElement('label');
    maxInputsLabel.textContent = 'Max Input Products:';
    dialogContent.appendChild(maxInputsLabel);
    
    const maxInputsInput = document.createElement('input');
    maxInputsInput.type = 'number';
    maxInputsInput.className = 'economy-input';
    maxInputsInput.value = '3';
    maxInputsInput.min = '0';
    maxInputsInput.max = '10';
    dialogContent.appendChild(maxInputsInput);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'economy-dialog-buttons';
    
    const generateBtn = document.createElement('button');
    generateBtn.className = 'economy-btn economy-btn-primary';
    generateBtn.textContent = 'Generate';
    generateBtn.addEventListener('click', async () => {
      const numNodes = parseInt(nodesInput.value);
      const maxDepth = parseInt(depthInput.value);
      const minInputs = parseInt(minInputsInput.value);
      const maxInputs = parseInt(maxInputsInput.value);

      if (isNaN(numNodes) || numNodes < 1) {
        alert('Number of nodes must be at least 1');
        return;
      }

      if (isNaN(maxDepth) || maxDepth < 1) {
        alert('Max depth must be at least 1');
        return;
      }

      if (isNaN(minInputs) || minInputs < 0) {
        alert('Min inputs must be non-negative');
        return;
      }

      if (isNaN(maxInputs) || maxInputs < minInputs) {
        alert('Max inputs must be >= min inputs');
        return;
      }

      try {
        // Generate random economy
        const newManager = this.randomGenerator.generateRandomEconomy(
          numNodes,
          maxDepth,
          minInputs,
          maxInputs
        );

        // Replace current economy
        this.economyManager.clear();
        const economyData = newManager.serialize();
        this.economyManager.loadFromData(economyData);
        
        this.deselectNode();
        await this.updateVisualization();
        this.updateNodeList();
        
        document.body.removeChild(dialog);
      } catch (error) {
        alert('Error generating economy: ' + error.message);
        console.error('Generation error:', error);
      }
    });
    buttonContainer.appendChild(generateBtn);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'economy-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    buttonContainer.appendChild(cancelBtn);
    
    dialogContent.appendChild(buttonContainer);
    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);
  }
}
