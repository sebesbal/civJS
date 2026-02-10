// Economy Editor UI - handles economy editor interface
import * as THREE from 'three';
import { OrthographicViewerBase } from '../utils/orthographic-viewer-base.js';
import { EconomyManager } from './economy-manager.js';
import { EconomyVisualizer } from './economy-visualizer.js';
import { EconomySaveLoadManager } from './economy-save-load.js';
import { RandomEconomyGenerator } from './random-economy-generator.js';

export class EconomyEditorUI extends OrthographicViewerBase {
  constructor() {
    super();
    
    this.container = null;
    this.sidebar = null;
    this.propertiesPanel = null;
    
    this.economyManager = new EconomyManager();
    this.saveLoadManager = new EconomySaveLoadManager();
    this.randomGenerator = new RandomEconomyGenerator();
    this.visualizer = null;
    
    this.selectedNodeId = null;
    
    // Callbacks
    this.onSaveEconomy = null;
    this.onLoadEconomy = null;
    this.onEconomyChange = null; // Fired when economy is modified (add/edit/delete/load/generate)
    
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
    
    // Signal that content is ready - this fixes the timing issue
    // when the tab is selected before the economy is loaded
    this.onContentReady();

    // Notify that economy data is now available
    this.notifyEconomyChange();
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
    // Initialize base class Three.js setup
    this.initializeThreeJS({
      initialZoom: 20,
      minZoom: 2,
      maxZoom: 1000,
      backgroundColor: 0x1a1a1a
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Create visualizer
    this.visualizer = new EconomyVisualizer(this.scene, this.camera, this.renderer);

    // Handle canvas clicks
    this.renderer.domElement.addEventListener('click', (e) => this.handleCanvasClick(e));
  }

  // Implement abstract method: get bounding box from economy layout
  getContentBoundingBox() {
    if (!this.economyManager || !this.visualizer || !this.visualizer.layout) {
      return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    }
    
    return this.visualizer.layout.getBoundingBox(this.economyManager);
  }

  // Implement abstract method: check if economy has nodes
  hasContent() {
    if (!this.economyManager) return false;
    const nodes = this.economyManager.getAllNodes();
    return nodes.length > 0;
  }

  // Override to update visualizer's camera view size when zooming
  updateCameraViewSize() {
    super.updateCameraViewSize();
    
    // Also update the visualizer's camera if it exists
    if (this.visualizer) {
      this.visualizer.updateCameraViewSize(this.currentZoom);
    }
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
        this.notifyEconomyChange();
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
          this.notifyEconomyChange();
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

  // Notify listeners that the economy has changed
  notifyEconomyChange() {
    if (this.onEconomyChange) {
      this.onEconomyChange(this.economyManager);
    }
  }

  async updateVisualization() {
    if (this.visualizer) {
      await this.visualizer.updateVisualization();
      // Signal content update to base class
      this.onContentReady();
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
      this.notifyEconomyChange();

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
    nodesInput.value = '8';
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
        this.notifyEconomyChange();

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
