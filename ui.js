// UI Manager - coordinates different editor UIs
import { MapEditorUI } from './map-editor/map-editor-ui.js';
import { EconomyEditorUI } from './economy-editor/economy-editor-ui.js';

export class UIManager {
  constructor() {
    this.mainToolbar = null;
    this.mapEditorUI = null;
    this.economyEditorUI = null;
    this.testEditorUI = null;
    this.testToolbar = null;
    // Load saved mode from localStorage, default to 'MAP_EDITOR'
    const savedMode = localStorage.getItem('lastEditorMode') || 'MAP_EDITOR';
    this.currentEditorMode = savedMode; // 'MAP_EDITOR', 'ECONOMY_EDITOR', or 'TEST_EDITOR'
    this.onEditorModeChange = null;
    this.renderer = null;
    this.init();
  }

  init() {
    this.createMainToolbar();
    this.mapEditorUI = new MapEditorUI();
    this.economyEditorUI = new EconomyEditorUI();
    this.createTestEditorUI();
    this.setupEconomyEditorCallbacks();
    // Set the saved mode (or default to MAP_EDITOR)
    this.setEditorMode(this.currentEditorMode);
  }

  setupEconomyEditorCallbacks() {
    // Callbacks will be set via property setters
  }

  createTestEditorUI() {
    // Create test toolbar (menubar)
    this.testToolbar = document.createElement('div');
    this.testToolbar.id = 'test-toolbar';
    this.testToolbar.style.position = 'fixed';
    this.testToolbar.style.left = '60px';
    this.testToolbar.style.top = '0';
    this.testToolbar.style.width = '60px';
    this.testToolbar.style.height = '100vh';
    this.testToolbar.style.background = 'rgba(20, 20, 20, 0.95)';
    this.testToolbar.style.backdropFilter = 'blur(10px)';
    this.testToolbar.style.color = '#ffffff';
    this.testToolbar.style.padding = '10px 0';
    this.testToolbar.style.zIndex = '2000';
    this.testToolbar.style.boxShadow = '2px 0 10px rgba(0, 0, 0, 0.3)';
    this.testToolbar.style.display = 'none';
    this.testToolbar.style.flexDirection = 'column';
    this.testToolbar.style.alignItems = 'center';
    this.testToolbar.style.gap = '10px';
    document.body.appendChild(this.testToolbar);

    // Create toolbar items
    const test1Btn = document.createElement('button');
    test1Btn.className = 'toolbar-item';
    test1Btn.textContent = 'Test1';
    test1Btn.title = 'Test1';
    this.testToolbar.appendChild(test1Btn);

    const test2Btn = document.createElement('button');
    test2Btn.className = 'toolbar-item';
    test2Btn.textContent = 'Test2';
    test2Btn.title = 'Test2';
    this.testToolbar.appendChild(test2Btn);

    const test3Btn = document.createElement('button');
    test3Btn.className = 'toolbar-item';
    test3Btn.textContent = 'Test3';
    test3Btn.title = 'Test3';
    this.testToolbar.appendChild(test3Btn);

    // Create a simple test editor UI container
    this.testEditorUI = document.createElement('div');
    this.testEditorUI.id = 'test-editor-ui';
    this.testEditorUI.style.display = 'none';
    this.testEditorUI.style.position = 'fixed';
    this.testEditorUI.style.top = '0';
    this.testEditorUI.style.left = '120px'; // Account for both toolbars
    this.testEditorUI.style.width = 'calc(100% - 120px)';
    this.testEditorUI.style.height = '100vh';
    this.testEditorUI.style.background = '#1a1a1a';
    this.testEditorUI.style.color = '#ffffff';
    this.testEditorUI.style.padding = '20px';
    this.testEditorUI.innerHTML = '<h1>Test Editor</h1><p>This is the test editor interface.</p>';
    document.body.appendChild(this.testEditorUI);
  }

  createMainToolbar() {
    this.mainToolbar = document.createElement('div');
    this.mainToolbar.id = 'main-toolbar';
    document.body.appendChild(this.mainToolbar);

    // Map Editor button
    const mapEditorBtn = document.createElement('button');
    mapEditorBtn.className = 'toolbar-item';
    mapEditorBtn.textContent = 'Map';
    mapEditorBtn.dataset.editorMode = 'MAP_EDITOR';
    mapEditorBtn.title = 'Map Editor';
    mapEditorBtn.addEventListener('click', () => this.setEditorMode('MAP_EDITOR'));
    this.mainToolbar.appendChild(mapEditorBtn);

    // Economy Editor button
    const economyEditorBtn = document.createElement('button');
    economyEditorBtn.className = 'toolbar-item';
    economyEditorBtn.textContent = 'Econ';
    economyEditorBtn.dataset.editorMode = 'ECONOMY_EDITOR';
    economyEditorBtn.title = 'Economy Editor';
    economyEditorBtn.addEventListener('click', () => this.setEditorMode('ECONOMY_EDITOR'));
    this.mainToolbar.appendChild(economyEditorBtn);

    // Test Editor button
    const testEditorBtn = document.createElement('button');
    testEditorBtn.className = 'toolbar-item';
    testEditorBtn.textContent = 'Test';
    testEditorBtn.dataset.editorMode = 'TEST_EDITOR';
    testEditorBtn.title = 'Test Editor';
    testEditorBtn.addEventListener('click', () => this.setEditorMode('TEST_EDITOR'));
    this.mainToolbar.appendChild(testEditorBtn);
  }

  setEditorMode(mode) {
    this.currentEditorMode = mode;
    
    // Save the selected mode to localStorage
    localStorage.setItem('lastEditorMode', mode);

    // Update toolbar button states
    document.querySelectorAll('.toolbar-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.editorMode === mode);
    });

    // Show/hide UI elements based on editor mode
    if (mode === 'MAP_EDITOR') {
      this.mapEditorUI.show();
      this.economyEditorUI.hide();
      if (this.testEditorUI) {
        this.testEditorUI.style.display = 'none';
      }
      if (this.testToolbar) {
        this.testToolbar.style.display = 'none';
      }
      // Show the map renderer
      if (this.renderer) {
        this.renderer.domElement.style.display = 'block';
      }
    } else if (mode === 'ECONOMY_EDITOR') {
      this.mapEditorUI.hide();
      this.economyEditorUI.show();
      if (this.testEditorUI) {
        this.testEditorUI.style.display = 'none';
      }
      if (this.testToolbar) {
        this.testToolbar.style.display = 'none';
      }
      // Hide the map renderer
      if (this.renderer) {
        this.renderer.domElement.style.display = 'none';
      }
    } else if (mode === 'TEST_EDITOR') {
      this.mapEditorUI.hide();
      this.economyEditorUI.hide();
      if (this.testEditorUI) {
        this.testEditorUI.style.display = 'block';
      }
      if (this.testToolbar) {
        this.testToolbar.style.display = 'flex';
      }
      // Hide the map renderer
      if (this.renderer) {
        this.renderer.domElement.style.display = 'none';
      }
    }

    // Notify listeners
    if (this.onEditorModeChange) {
      this.onEditorModeChange(mode);
    }
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  getCurrentEditorMode() {
    return this.currentEditorMode;
  }

  // Delegate methods to map editor UI
  setMode(mode) {
    if (this.mapEditorUI) {
      this.mapEditorUI.setMode(mode);
    }
  }

  selectObjectType(type) {
    if (this.mapEditorUI) {
      this.mapEditorUI.selectObjectType(type);
    }
  }

  toggleRouteMode() {
    if (this.mapEditorUI) {
      this.mapEditorUI.toggleRouteMode();
    }
  }

  showPropertiesPanel(objectData) {
    if (this.mapEditorUI && this.currentEditorMode === 'MAP_EDITOR') {
      this.mapEditorUI.showPropertiesPanel(objectData);
    }
  }

  showRoutePropertiesPanel(routeData) {
    if (this.mapEditorUI && this.currentEditorMode === 'MAP_EDITOR') {
      this.mapEditorUI.showRoutePropertiesPanel(routeData);
    }
  }

  hidePropertiesPanel() {
    if (this.mapEditorUI) {
      this.mapEditorUI.hidePropertiesPanel();
    }
  }

  getCurrentMode() {
    return this.mapEditorUI ? this.mapEditorUI.getCurrentMode() : null;
  }

  getSelectedObjectType() {
    return this.mapEditorUI ? this.mapEditorUI.getSelectedObjectType() : null;
  }

  // Callback properties - automatically forward to map editor UI
  set onModeChange(callback) {
    this._onModeChange = callback;
    if (this.mapEditorUI) {
      this.mapEditorUI.onModeChange = callback;
    }
  }

  get onModeChange() {
    return this._onModeChange;
  }

  set onObjectTypeSelect(callback) {
    this._onObjectTypeSelect = callback;
    if (this.mapEditorUI) {
      this.mapEditorUI.onObjectTypeSelect = callback;
    }
  }

  get onObjectTypeSelect() {
    return this._onObjectTypeSelect;
  }

  set onRouteModeToggle(callback) {
    this._onRouteModeToggle = callback;
    if (this.mapEditorUI) {
      this.mapEditorUI.onRouteModeToggle = callback;
    }
  }

  get onRouteModeToggle() {
    return this._onRouteModeToggle;
  }

  set onObjectDelete(callback) {
    this._onObjectDelete = callback;
    if (this.mapEditorUI) {
      this.mapEditorUI.onObjectDelete = callback;
    }
  }

  get onObjectDelete() {
    return this._onObjectDelete;
  }

  set onRouteDelete(callback) {
    this._onRouteDelete = callback;
    if (this.mapEditorUI) {
      this.mapEditorUI.onRouteDelete = callback;
    }
  }

  get onRouteDelete() {
    return this._onRouteDelete;
  }

  set onSaveGame(callback) {
    this._onSaveGame = callback;
    if (this.mapEditorUI) {
      this.mapEditorUI.onSaveGame = callback;
    }
  }

  get onSaveGame() {
    return this._onSaveGame;
  }

  set onLoadGame(callback) {
    this._onLoadGame = callback;
    if (this.mapEditorUI) {
      this.mapEditorUI.onLoadGame = callback;
    }
  }

  get onLoadGame() {
    return this._onLoadGame;
  }

  // Economy editor callbacks
  set onSaveEconomy(callback) {
    this._onSaveEconomy = callback;
    if (this.economyEditorUI) {
      this.economyEditorUI.onSaveEconomy = callback;
    }
  }

  get onSaveEconomy() {
    return this._onSaveEconomy;
  }

  set onLoadEconomy(callback) {
    this._onLoadEconomy = callback;
    if (this.economyEditorUI) {
      this.economyEditorUI.onLoadEconomy = callback;
    }
  }

  get onLoadEconomy() {
    return this._onLoadEconomy;
  }
}
