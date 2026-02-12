// Map Editor UI - handles sidebar, properties panel, and map editor interactions

export class MapEditorUI {
  constructor() {
    this.sidebar = null;
    this.propertiesPanel = null;
    this.currentMode = 'VIEW';
    this.selectedObjectType = null;
    this.objectTypes = {}; // Dynamic object types from economy
    this.objectsSection = null; // Reference to rebuild when types change
    this.specialSection = null; // Reference for special buildings (warehouse, etc.)

    // Callbacks
    this.onModeChange = null;
    this.onObjectTypeSelect = null;
    this.onRouteModeToggle = null;
    this.onObjectDelete = null;
    this.onRouteDelete = null;
    this.onSaveGame = null;
    this.onLoadGame = null;
    this.onSimulationToggle = null;
    this.onSimulationSpeedChange = null;
    this.onGenerateRandomFactories = null;
    this.simTickLabel = null;

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

    // Separate factory types from special building types
    const factoryTypes = [];
    const specialTypes = [];
    for (const [key, def] of Object.entries(this.objectTypes)) {
      const entry = { key, name: def.name };
      if (def.isWarehouse) {
        specialTypes.push(entry);
      } else {
        factoryTypes.push(entry);
      }
    }

    // Rebuild factory buttons
    const factoryTitle = this.objectsSection.querySelector('h3');
    this.objectsSection.innerHTML = '';
    if (factoryTitle) {
      this.objectsSection.appendChild(factoryTitle);
    }
    this._createObjectTypeButtons(factoryTypes, this.objectsSection);

    // Rebuild special buildings buttons
    const specialTitle = this.specialSection.querySelector('h3');
    this.specialSection.innerHTML = '';
    if (specialTitle) {
      this.specialSection.appendChild(specialTitle);
    }
    this._createObjectTypeButtons(specialTypes, this.specialSection);
  }

  _createObjectTypeButtons(types, container) {
    types.forEach(type => {
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

      container.appendChild(btn);
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

    // Special buildings section (warehouse, etc.)
    this.specialSection = document.createElement('div');
    this.specialSection.className = 'sidebar-section';

    const specialTitle = document.createElement('h3');
    specialTitle.textContent = 'Special Buildings';
    this.specialSection.appendChild(specialTitle);

    this.sidebar.appendChild(this.specialSection);

    // Routes section
    const routesSection = document.createElement('div');
    routesSection.className = 'sidebar-section';

    const routesTitle = document.createElement('h3');
    routesTitle.textContent = 'Roads';
    routesSection.appendChild(routesTitle);

    const routeModeBtn = document.createElement('button');
    routeModeBtn.className = 'route-btn';
    routeModeBtn.textContent = 'Create Road';
    routeModeBtn.addEventListener('click', () => this.toggleRouteMode());
    routesSection.appendChild(routeModeBtn);

    this.sidebar.appendChild(routesSection);

    // Simulation section
    const simulationSection = document.createElement('div');
    simulationSection.className = 'sidebar-section';

    const simTitle = document.createElement('h3');
    simTitle.textContent = 'Simulation';
    simulationSection.appendChild(simTitle);

    this.simPlayPauseBtn = document.createElement('button');
    this.simPlayPauseBtn.className = 'sim-btn';
    this.simPlayPauseBtn.textContent = 'Start';
    this.simPlayPauseBtn.addEventListener('click', () => {
      if (this.onSimulationToggle) {
        this.onSimulationToggle();
      }
    });
    simulationSection.appendChild(this.simPlayPauseBtn);

    const speedContainer = document.createElement('div');
    speedContainer.className = 'speed-container';

    const speedLabel = document.createElement('label');
    speedLabel.className = 'speed-label';
    speedLabel.textContent = 'Speed: 1.0x';
    speedContainer.appendChild(speedLabel);

    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.className = 'speed-slider';
    speedSlider.min = '0.5';
    speedSlider.max = '40';
    speedSlider.step = '0.5';
    speedSlider.value = '1';
    speedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      speedLabel.textContent = `Speed: ${speed.toFixed(1)}x`;
      if (this.onSimulationSpeedChange) {
        this.onSimulationSpeedChange(speed);
      }
    });
    speedContainer.appendChild(speedSlider);
    simulationSection.appendChild(speedContainer);

    this.simTickLabel = document.createElement('div');
    this.simTickLabel.className = 'sim-tick-label';
    this.simTickLabel.textContent = 'Ticks: 0';
    simulationSection.appendChild(this.simTickLabel);

    // Factory count input
    const factoryCountContainer = document.createElement('div');
    factoryCountContainer.className = 'factory-count-container';

    const factoryCountLabel = document.createElement('label');
    factoryCountLabel.className = 'factory-count-label';
    factoryCountLabel.textContent = 'Total Factories:';
    factoryCountContainer.appendChild(factoryCountLabel);

    this.factoryCountInput = document.createElement('input');
    this.factoryCountInput.type = 'number';
    this.factoryCountInput.className = 'factory-count-input';
    this.factoryCountInput.min = '0';
    this.factoryCountInput.placeholder = 'Auto';
    this.factoryCountInput.title = 'Leave empty for automatic scaling';
    factoryCountContainer.appendChild(this.factoryCountInput);

    simulationSection.appendChild(factoryCountContainer);

    const generateBtn = document.createElement('button');
    generateBtn.className = 'sim-btn';
    generateBtn.textContent = 'Generate Factories';
    generateBtn.addEventListener('click', () => {
      if (this.onGenerateRandomFactories) {
        // Get the factory count value (null if empty for auto-scaling)
        const value = this.factoryCountInput.value.trim();
        const totalFactories = value ? parseInt(value, 10) : null;
        this.onGenerateRandomFactories(totalFactories);
      }
    });
    simulationSection.appendChild(generateBtn);

    this.sidebar.appendChild(simulationSection);

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
      routeBtn.textContent = 'Create Road';
      if (this.onRouteModeToggle) {
        this.onRouteModeToggle(false);
      }
    } else {
      routeBtn.classList.add('active');
      routeBtn.textContent = 'Cancel Road';
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
    title.textContent = 'Road Properties';
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
    deleteBtn.textContent = 'Delete Road';
    deleteBtn.addEventListener('click', () => {
      if (this.onRouteDelete) {
        this.onRouteDelete(routeData.id);
      }
      this.hidePropertiesPanel();
    });
    this.propertiesPanel.appendChild(deleteBtn);
  }

  /**
   * Show factory inspector with storage bars and prices.
   * @param {Object} objectData - map object data
   * @param {ActorState} actorState - simulation state for this actor
   * @param {EconomyManager} economyManager - for product names
   */
  showFactoryInspector(objectData, actorState, economyManager) {
    if (!objectData || !actorState) {
      this.showPropertiesPanel(objectData);
      return;
    }

    this.propertiesPanel.innerHTML = '';
    this.propertiesPanel.classList.remove('hidden');

    // Title
    const typeDef = this.objectTypes[objectData.type];
    const typeName = typeDef ? typeDef.name : objectData.type;
    const title = document.createElement('h3');
    title.textContent = typeName;
    this.propertiesPanel.appendChild(title);

    // ID
    const idRow = document.createElement('div');
    idRow.className = 'property-row';
    idRow.innerHTML = `<strong>ID:</strong> <span>${objectData.id}</span>`;
    this.propertiesPanel.appendChild(idRow);

    // Production status (for producers)
    if (actorState.type === 'PRODUCER') {
      const statusLabels = {
        'idle': 'Idle',
        'producing': 'Producing',
        'output_full': 'Output Full',
        'output_surplus': 'Output Above Ideal',
        'missing_inputs': 'Missing Inputs'
      };
      const statusRow = document.createElement('div');
      statusRow.className = 'property-row';
      statusRow.innerHTML = `<strong>Status:</strong> <span>${statusLabels[actorState.status] || actorState.status}</span>`;
      this.propertiesPanel.appendChild(statusRow);

      // Production progress bar
      const progressRow = document.createElement('div');
      progressRow.className = 'property-row';
      progressRow.innerHTML = `<strong>Progress:</strong>`;
      this.propertiesPanel.appendChild(progressRow);
      this.propertiesPanel.appendChild(
        this._createStorageBar('', actorState.productionProgress, 1.0)
      );
    }

    // Fuel storage section (always show if fuel is designated)
    const fuelProductId = economyManager ? economyManager.getFuelProductId() : null;
    if (fuelProductId !== null) {
      const fuelTitle = document.createElement('div');
      fuelTitle.className = 'inspector-section-title';
      fuelTitle.innerHTML = '⛽ Fuel Storage';
      this.propertiesPanel.appendChild(fuelTitle);

      // Check both input and output storage for fuel
      let fuelStorage = actorState.inputStorage.get(fuelProductId) ||
                       actorState.outputStorage.get(fuelProductId);

      // If no fuel storage exists, show empty (0/0)
      if (!fuelStorage) {
        fuelStorage = { current: 0, capacity: 0, ideal: 0 };
      }

      const fuelInfo = this._getProductInfo(fuelProductId, economyManager);
      this.propertiesPanel.appendChild(
        this._createStorageBar(
          `${fuelInfo.name}: ${fuelStorage.current.toFixed(1)} / ${fuelStorage.capacity}`,
          fuelStorage.current,
          fuelStorage.capacity,
          fuelInfo,
          fuelStorage.idealMin,
          fuelStorage.idealMax
        )
      );
    }

    // Input storage section
    if (actorState.inputStorage.size > 0) {
      const inputTitle = document.createElement('div');
      inputTitle.className = 'inspector-section-title';
      inputTitle.textContent = 'Input Storage';
      this.propertiesPanel.appendChild(inputTitle);

      for (const [productId, storage] of actorState.inputStorage) {
        // Skip fuel if already shown in fuel section
        if (fuelProductId !== null && productId === fuelProductId) continue;

        const productInfo = this._getProductInfo(productId, economyManager);
        this.propertiesPanel.appendChild(
          this._createStorageBar(
            `${productInfo.name}: ${storage.current.toFixed(1)} / ${storage.capacity}`,
            storage.current,
            storage.capacity,
            productInfo,
            storage.idealMin,
            storage.idealMax
          )
        );
      }
    }

    // Output storage section
    if (actorState.outputStorage.size > 0) {
      const outputTitle = document.createElement('div');
      outputTitle.className = 'inspector-section-title';
      outputTitle.textContent = actorState.type === 'WAREHOUSE' ? 'Storage' : 'Output Storage';
      this.propertiesPanel.appendChild(outputTitle);

      for (const [productId, storage] of actorState.outputStorage) {
        // Skip fuel if already shown in fuel section
        if (fuelProductId !== null && productId === fuelProductId) continue;

        const productInfo = this._getProductInfo(productId, economyManager);
        this.propertiesPanel.appendChild(
          this._createStorageBar(
            `${productInfo.name}: ${storage.current.toFixed(1)} / ${storage.capacity}`,
            storage.current,
            storage.capacity,
            productInfo,
            storage.idealMin,
            storage.idealMax
          )
        );
      }
    }

    // Prices section
    if (actorState.prices.size > 0) {
      const pricesTitle = document.createElement('div');
      pricesTitle.className = 'inspector-section-title';
      pricesTitle.textContent = 'Prices';
      this.propertiesPanel.appendChild(pricesTitle);

      for (const [productId, price] of actorState.prices) {
        const productInfo = this._getProductInfo(productId, economyManager);
        const priceRow = document.createElement('div');
        priceRow.className = 'price-row';

        const leftSide = document.createElement('div');
        leftSide.className = 'price-row-left';

        // Product indicator (color + icon)
        const indicator = this._createProductIndicator(productInfo);
        leftSide.appendChild(indicator);

        // Product name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'price-row-name';
        nameSpan.textContent = productInfo.name;
        leftSide.appendChild(nameSpan);

        priceRow.appendChild(leftSide);

        // Price value
        const priceSpan = document.createElement('span');
        priceSpan.className = 'price-row-value';
        priceSpan.textContent = `$${Math.round(price)}`;
        priceRow.appendChild(priceSpan);

        this.propertiesPanel.appendChild(priceRow);
      }
    }

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      if (this.onObjectDelete) {
        this.onObjectDelete(objectData.id);
      }
      this.hidePropertiesPanel();
    });
    this.propertiesPanel.appendChild(deleteBtn);
  }

  /**
   * Create a visual storage bar element.
   * @param {string} label - Label text
   * @param {number} current - Current value
   * @param {number} capacity - Maximum capacity
   * @param {Object} productInfo - Product info with icon, color, name
   * @param {number} [idealMin] - Ideal range minimum (optional)
   * @param {number} [idealMax] - Ideal range maximum (optional)
   */
  _createStorageBar(label, current, capacity, productInfo = null, idealMin = undefined, idealMax = undefined) {
    const container = document.createElement('div');
    container.className = 'storage-bar-container';

    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'storage-bar-label';

      // Add product indicator if provided
      if (productInfo) {
        const indicator = this._createProductIndicator(productInfo);
        labelEl.appendChild(indicator);
      }

      // Add label text
      const textSpan = document.createElement('span');
      textSpan.textContent = label;
      labelEl.appendChild(textSpan);

      container.appendChild(labelEl);
    }

    const barOuter = document.createElement('div');
    barOuter.className = 'storage-bar-outer';

    const barInner = document.createElement('div');
    barInner.className = 'storage-bar-inner';
    const fillPercent = capacity > 0 ? (current / capacity) * 100 : 0;
    barInner.style.width = `${Math.min(fillPercent, 100)}%`;

    // Color based on fill level
    const fillRatio = capacity > 0 ? current / capacity : 0;
    if (fillRatio > 0.8) barInner.style.background = '#ff6b6b';
    else if (fillRatio > 0.5) barInner.style.background = '#ffa500';
    else barInner.style.background = '#4caf50';

    barOuter.appendChild(barInner);

    // Add ideal range markers if provided
    if (idealMin !== undefined && idealMax !== undefined && capacity > 0) {
      const rangeOverlay = document.createElement('div');
      rangeOverlay.className = 'storage-bar-ideal-range';
      const leftPct = (idealMin / capacity) * 100;
      const widthPct = ((idealMax - idealMin) / capacity) * 100;
      rangeOverlay.style.left = `${leftPct}%`;
      rangeOverlay.style.width = `${widthPct}%`;
      barOuter.appendChild(rangeOverlay);
    }

    container.appendChild(barOuter);
    return container;
  }

  /**
   * Create a product indicator with color dot and optional icon.
   * @param {Object} productInfo - Object with icon, color, name properties
   */
  _createProductIndicator(productInfo) {
    const indicator = document.createElement('div');
    indicator.className = 'product-indicator';

    // Color dot
    const colorDot = document.createElement('div');
    colorDot.className = 'product-color-dot';
    colorDot.style.backgroundColor = productInfo.color;
    indicator.appendChild(colorDot);

    // Icon (if available)
    if (productInfo.icon) {
      const icon = document.createElement('img');
      icon.className = 'product-icon';
      icon.src = productInfo.icon;
      icon.alt = productInfo.name;
      icon.onerror = () => {
        // Hide icon if image fails to load
        icon.style.display = 'none';
      };
      indicator.appendChild(icon);
    }

    return indicator;
  }

  /**
   * Get human-readable product name from economy manager.
   */
  _getProductName(productId, economyManager) {
    if (!economyManager) return `Product ${productId}`;
    const node = economyManager.getNode(productId);
    return node ? node.name : `Product ${productId}`;
  }

  /**
   * Get product info including name, color, and icon.
   * @param {number} productId
   * @param {EconomyManager} economyManager
   * @returns {Object} Object with name, color (CSS hex), icon (path or null)
   */
  _getProductInfo(productId, economyManager) {
    const result = {
      name: `Product ${productId}`,
      color: '#888888',
      icon: null
    };

    if (!economyManager) return result;

    const node = economyManager.getNode(productId);
    if (!node) return result;

    result.name = node.name;

    // Get color from object types
    const objectTypeKey = `PRODUCT_${productId}`;
    const typeDef = this.objectTypes[objectTypeKey];
    if (typeDef && typeDef.color !== undefined) {
      // Convert THREE.js hex color (0xff6b6b) to CSS hex color (#ff6b6b)
      result.color = '#' + typeDef.color.toString(16).padStart(6, '0');
    }

    // Get icon from node
    if (node.imagePath) {
      result.icon = node.imagePath;
    }

    return result;
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

  setSimulationRunning(running) {
    if (this.simPlayPauseBtn) {
      this.simPlayPauseBtn.textContent = running ? 'Pause' : 'Start';
      this.simPlayPauseBtn.classList.toggle('active', running);
    }
  }

  setSimulationTick(tickCount) {
    if (this.simTickLabel) {
      this.simTickLabel.textContent = `Ticks: ${tickCount}`;
    }
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
