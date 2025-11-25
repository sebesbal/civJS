// UI Manager - coordinates different editor UIs
import { MapEditorUI } from './map-editor/map-editor-ui.js';
import { EconomyEditorUI } from './economy-editor/economy-editor-ui.js';

export class UIManager {
  constructor() {
    this.mainToolbar = null;
    this.mapEditorUI = null;
    this.economyEditorUI = null;
    this.currentEditorMode = 'MAP_EDITOR'; // 'MAP_EDITOR' or 'ECONOMY_EDITOR'
    this.onEditorModeChange = null;
    this.init();
  }

  init() {
    this.createMainToolbar();
    this.mapEditorUI = new MapEditorUI();
    this.economyEditorUI = new EconomyEditorUI();
    this.setEditorMode('MAP_EDITOR');
  }

  createMainToolbar() {
    this.mainToolbar = document.createElement('div');
    this.mainToolbar.id = 'main-toolbar';
    document.body.appendChild(this.mainToolbar);

    // Map Editor button
    const mapEditorBtn = document.createElement('button');
    mapEditorBtn.className = 'toolbar-item active';
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
  }

  setEditorMode(mode) {
    this.currentEditorMode = mode;

    // Update toolbar button states
    document.querySelectorAll('.toolbar-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.editorMode === mode);
    });

    // Show/hide UI elements based on editor mode
    if (mode === 'MAP_EDITOR') {
      this.mapEditorUI.show();
      this.economyEditorUI.hide();
    } else {
      this.mapEditorUI.hide();
      this.economyEditorUI.show();
    }

    // Notify listeners
    if (this.onEditorModeChange) {
      this.onEditorModeChange(mode);
    }
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
}
