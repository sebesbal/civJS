// Map Editor UI - handles sidebar, properties panel, and map editor interactions

export class MapEditorUI {
  constructor() {
    this.sidebar = null;
    this.propertiesPanel = null;
    this.currentMode = 'VIEW';
    this.selectedObjectType = null;
    this.objectTypes = {}; // Dynamic object types from economy
    this.objectsSection = null; // Reference to rebuild when types change

    // Callbacks
    this.onModeChange = null;
    this.onObjectTypeSelect = null;
    this.onRouteModeToggle = null;
    this.onObjectDelete = null;
    this.onRouteDelete = null;
    this.onSaveGame = null;
    this.onLoadGame = null;

    this.init();
  }

  init() {
    this.createSidebar();
    this.createPropertiesPanel();
  }

  // Update the object types and rebuild the sidebar buttons
  setObjectTypes(objectTypes) {
    this.objectTypes = objectTypes || {};
    // Clear selection if the selected type no longer exists
    if (this.selectedObjectType && !this.objectTypes[this.selectedObjectType]) {
      this.selectedObjectType = null;
      if (this.onObjectTypeSelect) {
        this.onObjectTypeSelect(null);
      }
    }
    this.rebuildObjectButtons();
  }

  rebuildObjectButtons() {
    if (!this.objectsSection) return;

    // Remove old buttons (keep the title)
    const title = this.objectsSection.querySelector('h3');
    this.objectsSection.innerHTML = '';
    if (title) {
      this.objectsSection.appendChild(title);
    }

    const objectTypes = Object.keys(this.objectTypes).map(key => ({
      key: key,
      name: this.objectTypes[key].name
    }));

    objectTypes.forEach(type => {
      const btn = document.createElement('button');
      btn.className = 'object-type-btn';
      btn.dataset.type = type.key;

      const colorPreview = document.createElement('span');
      colorPreview.className = 'color-preview';
      colorPreview.style.backgroundColor = this.getColorForType(type.key);
      btn.appendChild(colorPreview);

      const label = document.createElement('span');
      label.textContent = type.name;
      btn.appendChild(label);

      btn.addEventListener('click', () => this.selectObjectType(type.key));

      if (type.key === this.selectedObjectType) {
        btn.classList.add('active');
      }

      this.objectsSection.appendChild(btn);
    });
  }

  createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'sidebar';
    document.body.appendChild(this.sidebar);

    // Mode toggle section
    const modeSection = document.createElement('div');
    modeSection.className = 'sidebar-section';

    const modeTitle = document.createElement('h3');
    modeTitle.textContent = 'Mode';
    modeSection.appendChild(modeTitle);

    const viewModeBtn = document.createElement('button');
    viewModeBtn.className = 'mode-btn active';
    viewModeBtn.textContent = 'View';
    viewModeBtn.dataset.mode = 'VIEW';
    viewModeBtn.addEventListener('click', () => this.setMode('VIEW'));
    modeSection.appendChild(viewModeBtn);

    const editModeBtn = document.createElement('button');
    editModeBtn.className = 'mode-btn';
    editModeBtn.textContent = 'Edit';
    editModeBtn.dataset.mode = 'EDIT';
    editModeBtn.addEventListener('click', () => this.setMode('EDIT'));
    modeSection.appendChild(editModeBtn);

    this.sidebar.appendChild(modeSection);

    // Object types section (dynamic, rebuilt when economy changes)
    this.objectsSection = document.createElement('div');
    this.objectsSection.className = 'sidebar-section';

    const objectsTitle = document.createElement('h3');
    objectsTitle.textContent = 'Place Factories';
    this.objectsSection.appendChild(objectsTitle);

    this.sidebar.appendChild(this.objectsSection);

    // Routes section
    const routesSection = document.createElement('div');
    routesSection.className = 'sidebar-section';

    const routesTitle = document.createElement('h3');
    routesTitle.textContent = 'Routes';
    routesSection.appendChild(routesTitle);

    const routeModeBtn = document.createElement('button');
    routeModeBtn.className = 'route-btn';
    routeModeBtn.textContent = 'Create Route';
    routeModeBtn.addEventListener('click', () => this.toggleRouteMode());
    routesSection.appendChild(routeModeBtn);

    this.sidebar.appendChild(routesSection);

    // Save/Load section
    const saveLoadSection = document.createElement('div');
    saveLoadSection.className = 'sidebar-section';

    const saveLoadTitle = document.createElement('h3');
    saveLoadTitle.textContent = 'Save/Load';
    saveLoadSection.appendChild(saveLoadTitle);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.textContent = 'Save Game';
    saveBtn.addEventListener('click', () => {
      if (this.onSaveGame) {
        this.onSaveGame();
      }
    });
    saveLoadSection.appendChild(saveBtn);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'load-btn';
    loadBtn.textContent = 'Load Game';

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && this.onLoadGame) {
        this.onLoadGame(file);
      }
      // Reset input so same file can be selected again
      fileInput.value = '';
    });
    document.body.appendChild(fileInput);

    loadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    saveLoadSection.appendChild(loadBtn);

    this.sidebar.appendChild(saveLoadSection);
  }

  createPropertiesPanel() {
    this.propertiesPanel = document.createElement('div');
    this.propertiesPanel.id = 'properties-panel';
    this.propertiesPanel.classList.add('hidden');
    document.body.appendChild(this.propertiesPanel);
  }

  setMode(mode) {
    this.currentMode = mode;

    // Update button states
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Clear object type selection when switching to view mode
    if (mode === 'VIEW') {
      this.selectObjectType(null);
    }

    if (this.onModeChange) {
      this.onModeChange(mode);
    }
  }

  selectObjectType(type) {
    // Toggle selection
    if (this.selectedObjectType === type) {
      this.selectedObjectType = null;
    } else {
      this.selectedObjectType = type;
    }

    // Update button states
    document.querySelectorAll('.object-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === this.selectedObjectType);
    });

    if (this.onObjectTypeSelect) {
      this.onObjectTypeSelect(this.selectedObjectType);
    }
  }

  toggleRouteMode() {
    const routeBtn = document.querySelector('.route-btn');
    const isActive = routeBtn.classList.contains('active');

    if (isActive) {
      routeBtn.classList.remove('active');
      routeBtn.textContent = 'Create Route';
      if (this.onRouteModeToggle) {
        this.onRouteModeToggle(false);
      }
    } else {
      routeBtn.classList.add('active');
      routeBtn.textContent = 'Cancel Route';
      if (this.onRouteModeToggle) {
        this.onRouteModeToggle(true);
      }
    }
  }

  showPropertiesPanel(objectData) {
    if (!objectData) {
      this.hidePropertiesPanel();
      return;
    }

    this.propertiesPanel.innerHTML = '';
    this.propertiesPanel.classList.remove('hidden');

    const title = document.createElement('h3');
    title.textContent = 'Object Properties';
    this.propertiesPanel.appendChild(title);

    // Show the factory name from the object types registry
    const typeDef = this.objectTypes[objectData.type];
    const typeName = typeDef ? typeDef.name : objectData.type;

    const typeLabel = document.createElement('div');
    typeLabel.className = 'property-row';
    typeLabel.innerHTML = `<strong>Type:</strong> <span>${typeName}</span>`;
    this.propertiesPanel.appendChild(typeLabel);

    const idLabel = document.createElement('div');
    idLabel.className = 'property-row';
    idLabel.innerHTML = `<strong>ID:</strong> <span>${objectData.id}</span>`;
    this.propertiesPanel.appendChild(idLabel);

    const positionLabel = document.createElement('div');
    positionLabel.className = 'property-row';
    const pos = objectData.mesh.position;
    positionLabel.innerHTML = `<strong>Position:</strong> <span>(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})</span>`;
    this.propertiesPanel.appendChild(positionLabel);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete Object';
    deleteBtn.addEventListener('click', () => {
      if (this.onObjectDelete) {
        this.onObjectDelete(objectData.id);
      }
      this.hidePropertiesPanel();
    });
    this.propertiesPanel.appendChild(deleteBtn);
  }

  showRoutePropertiesPanel(routeData) {
    if (!routeData) {
      this.hidePropertiesPanel();
      return;
    }

    this.propertiesPanel.innerHTML = '';
    this.propertiesPanel.classList.remove('hidden');

    const title = document.createElement('h3');
    title.textContent = 'Route Properties';
    this.propertiesPanel.appendChild(title);

    const idLabel = document.createElement('div');
    idLabel.className = 'property-row';
    idLabel.innerHTML = `<strong>ID:</strong> <span>${routeData.id}</span>`;
    this.propertiesPanel.appendChild(idLabel);

    const waypointsLabel = document.createElement('div');
    waypointsLabel.className = 'property-row';
    waypointsLabel.innerHTML = `<strong>Waypoints:</strong> <span>${routeData.waypoints.length}</span>`;
    this.propertiesPanel.appendChild(waypointsLabel);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete Route';
    deleteBtn.addEventListener('click', () => {
      if (this.onRouteDelete) {
        this.onRouteDelete(routeData.id);
      }
      this.hidePropertiesPanel();
    });
    this.propertiesPanel.appendChild(deleteBtn);
  }

  hidePropertiesPanel() {
    this.propertiesPanel.classList.add('hidden');
  }

  getColorForType(type) {
    const typeDef = this.objectTypes[type];
    if (!typeDef) {
      return '#ffffff';
    }
    // Convert THREE.js hex color (0xff6b6b) to CSS hex color (#ff6b6b)
    return '#' + typeDef.color.toString(16).padStart(6, '0');
  }

  getCurrentMode() {
    return this.currentMode;
  }

  getSelectedObjectType() {
    return this.selectedObjectType;
  }

  show() {
    this.sidebar.classList.remove('hidden');
  }

  hide() {
    this.sidebar.classList.add('hidden');
    this.propertiesPanel.classList.add('hidden');
  }
}
