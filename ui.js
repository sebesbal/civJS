// UI Manager - coordinates different editor UIs
import { MapEditorUI } from './map-editor/map-editor-ui.js';
import { EconomyEditorUI } from './economy-editor/economy-editor-ui.js';
import { generateObjectTypesFromEconomy } from './map-editor/config/object-types.js';
import { ViewportControllerTest } from './test/viewport-controller-test.js';
import { ObjectSceneTest } from './test/object-scene-test.js';

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

    // Callback for external code that needs to know when object types change
    this.onObjectTypesChange = null;

    // Define forwarded callback properties dynamically
    this._setupCallbackForwarding([
      { name: 'onModeChange', target: 'mapEditorUI' },
      { name: 'onObjectTypeSelect', target: 'mapEditorUI' },
      { name: 'onRouteModeToggle', target: 'mapEditorUI' },
      { name: 'onObjectDelete', target: 'mapEditorUI' },
      { name: 'onRouteDelete', target: 'mapEditorUI' },
      { name: 'onSaveGame', target: 'mapEditorUI' },
      { name: 'onLoadGame', target: 'mapEditorUI' },
      { name: 'onSaveEconomy', target: 'economyEditorUI' },
      { name: 'onLoadEconomy', target: 'economyEditorUI' },
    ]);

    this.init();
  }

  _setupCallbackForwarding(callbacks) {
    for (const { name, target } of callbacks) {
      const privateName = `_${name}`;
      Object.defineProperty(this, name, {
        set(callback) {
          this[privateName] = callback;
          if (this[target]) {
            this[target][name] = callback;
          }
        },
        get() {
          return this[privateName];
        },
        configurable: true,
        enumerable: true,
      });
    }
  }

  init() {
    this.createMainToolbar();
    this.mapEditorUI = new MapEditorUI();
    this.economyEditorUI = new EconomyEditorUI();
    this.createTestEditorUI();

    // Wire economy changes to update map editor factory list
    this.economyEditorUI.onEconomyChange = (economyManager) => {
      this.updateMapObjectTypes(economyManager);
    };

    // Set the saved mode (or default to MAP_EDITOR)
    this.setEditorMode(this.currentEditorMode);
  }

  // Generate object types from economy and push to map editor UI and object manager
  updateMapObjectTypes(economyManager) {
    const objectTypes = generateObjectTypesFromEconomy(economyManager);
    this.mapEditorUI.setObjectTypes(objectTypes);
    // Notify external code (e.g., ObjectManager in index.js)
    if (this.onObjectTypesChange) {
      this.onObjectTypesChange(objectTypes);
    }
  }

  _createButton(text, className, dataset, onClick, parent) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = text;
    btn.title = text;
    Object.assign(btn.dataset, dataset);
    btn.addEventListener('click', onClick);
    parent.appendChild(btn);
    return btn;
  }

  createTestEditorUI() {
    // Create test toolbar (menubar)
    this.testToolbar = document.createElement('div');
    this.testToolbar.id = 'test-toolbar';
    this.testToolbar.style.position = 'fixed';
    this.testToolbar.style.left = '60px';
    this.testToolbar.style.top = '0';
    this.testToolbar.style.width = 'auto';
    this.testToolbar.style.minWidth = '60px';
    this.testToolbar.style.height = '100vh';
    this.testToolbar.style.background = 'rgba(20, 20, 20, 0.95)';
    this.testToolbar.style.backdropFilter = 'blur(10px)';
    this.testToolbar.style.color = '#ffffff';
    this.testToolbar.style.padding = '10px';
    this.testToolbar.style.zIndex = '2000';
    this.testToolbar.style.boxShadow = '2px 0 10px rgba(0, 0, 0, 0.3)';
    this.testToolbar.style.display = 'none';
    this.testToolbar.style.flexDirection = 'column';
    this.testToolbar.style.alignItems = 'stretch';
    this.testToolbar.style.gap = '10px';
    document.body.appendChild(this.testToolbar);

    // Create test tab buttons
    const testTabs = [
      { key: 'test1', label: 'ViewportController' },
      { key: 'test2', label: 'ObjectScene' },
      { key: 'test3', label: 'Test3' },
    ];

    this.testButtons = {};
    for (const tab of testTabs) {
      this.testButtons[tab.key] = this._createButton(
        tab.label,
        'toolbar-item test-toolbar-item',
        { testTab: tab.key },
        () => this.setTestTab(tab.key),
        this.testToolbar
      );
    }

    // Create test editor UI container with tabs
    this.testEditorUI = document.createElement('div');
    this.testEditorUI.id = 'test-editor-ui';
    this.testEditorUI.style.display = 'none';
    this.testEditorUI.style.position = 'fixed';
    this.testEditorUI.style.top = '0';
    this.testEditorUI.style.left = '200px';
    this.testEditorUI.style.width = 'calc(100% - 200px)';
    this.testEditorUI.style.height = '100vh';
    this.testEditorUI.style.background = '#1a1a1a';
    this.testEditorUI.style.color = '#ffffff';
    this.testEditorUI.style.overflow = 'auto';
    document.body.appendChild(this.testEditorUI);

    // Create tab containers
    this.testTabContainers = {};
    for (const tab of testTabs) {
      const container = document.createElement('div');
      container.id = `${tab.key}-container`;
      container.style.height = '100%';
      container.style.minHeight = '0';
      if (tab.key !== 'test1') {
        container.style.display = 'none';
      }
      if (tab.key === 'test3') {
        container.innerHTML = '<h1>Test 3</h1><p>This is the Test 3 interface.</p>';
      }
      this.testEditorUI.appendChild(container);
      this.testTabContainers[tab.key] = container;
    }

    // Initialize tests
    this.viewportControllerTest = null;
    this.objectSceneTest = null;
    // Load saved test tab from localStorage, default to 'test1'
    const savedTestTab = localStorage.getItem('lastTestTab') || 'test1';
    this.currentTestTab = savedTestTab;
    this.setTestTab(savedTestTab);
  }

  setTestTab(tabName) {
    this.currentTestTab = tabName;
    localStorage.setItem('lastTestTab', tabName);

    // Update button states
    for (const [key, btn] of Object.entries(this.testButtons)) {
      btn.classList.toggle('active', key === tabName);
    }

    // Show/hide tab containers
    for (const [key, container] of Object.entries(this.testTabContainers)) {
      container.style.display = key === tabName ? 'block' : 'none';
    }

    // Initialize tests if needed
    if (tabName === 'test1' && !this.viewportControllerTest) {
      this.viewportControllerTest = new ViewportControllerTest(this.testTabContainers.test1);
    }
    if (tabName === 'test2' && !this.objectSceneTest) {
      this.objectSceneTest = new ObjectSceneTest(this.testTabContainers.test2);
    }
  }

  createMainToolbar() {
    this.mainToolbar = document.createElement('div');
    this.mainToolbar.id = 'main-toolbar';
    document.body.appendChild(this.mainToolbar);

    const modes = [
      { text: 'Map', mode: 'MAP_EDITOR', title: 'Map Editor' },
      { text: 'Econ', mode: 'ECONOMY_EDITOR', title: 'Economy Editor' },
      { text: 'Test', mode: 'TEST_EDITOR', title: 'Test Editor' },
    ];

    for (const { text, mode, title } of modes) {
      const btn = this._createButton(
        text,
        'toolbar-item',
        { editorMode: mode },
        () => this.setEditorMode(mode),
        this.mainToolbar
      );
      btn.title = title;
    }
  }

  setEditorMode(mode) {
    this.currentEditorMode = mode;
    localStorage.setItem('lastEditorMode', mode);

    // Update toolbar button states
    document.querySelectorAll('.toolbar-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.editorMode === mode);
    });

    // Show/hide UI elements based on editor mode
    const isMap = mode === 'MAP_EDITOR';
    const isTest = mode === 'TEST_EDITOR';

    isMap ? this.mapEditorUI.show() : this.mapEditorUI.hide();
    mode === 'ECONOMY_EDITOR' ? this.economyEditorUI.show() : this.economyEditorUI.hide();

    if (this.testEditorUI) {
      this.testEditorUI.style.display = isTest ? 'block' : 'none';
    }
    if (this.testToolbar) {
      this.testToolbar.style.display = isTest ? 'flex' : 'none';
    }
    if (this.renderer) {
      this.renderer.domElement.style.display = isMap ? 'block' : 'none';
    }

    // Restore the saved test tab when switching to TEST_EDITOR
    if (isTest && this.testTabContainers) {
      const savedTestTab = localStorage.getItem('lastTestTab') || 'test1';
      this.setTestTab(savedTestTab);
    }

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
}
