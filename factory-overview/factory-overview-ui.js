// Factory Overview UI - read-only DAG view with aggregated simulation stats
import * as THREE from 'three';
import { OrthographicViewerBase } from '../utils/orthographic-viewer-base.js';
import { FactoryOverviewVisualizer } from './factory-overview-visualizer.js';
import { FactoryOverviewAggregator } from './factory-overview-aggregator.js';

export class FactoryOverviewUI extends OrthographicViewerBase {
  constructor() {
    super();

    this.container = null;
    this.propertiesPanel = null;

    this.economyManager = null;
    this.simulationEngine = null;
    this.visualizer = null;
    this.aggregator = new FactoryOverviewAggregator();

    this.selectedNodeId = null;
    this._visible = false;

    this.createUI();
    this.setupThreeJS();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'factory-overview-ui';
    document.body.appendChild(this.container);

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Factory Overview';
    title.className = 'fo-title';
    this.container.appendChild(title);

    // Main content area
    const contentArea = document.createElement('div');
    contentArea.className = 'fo-content';

    // Canvas container
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'fo-canvas-container';
    contentArea.appendChild(this.canvasContainer);

    // Properties panel (hidden by default)
    this.propertiesPanel = document.createElement('div');
    this.propertiesPanel.className = 'fo-properties-panel';
    this.propertiesPanel.style.display = 'none';
    contentArea.appendChild(this.propertiesPanel);

    this.container.appendChild(contentArea);
  }

  setupThreeJS() {
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
    this.visualizer = new FactoryOverviewVisualizer(this.scene, this.camera, this.renderer);

    // Handle canvas clicks
    this.renderer.domElement.addEventListener('click', (e) => this._handleCanvasClick(e));
  }

  // --- Abstract method implementations ---

  getContentBoundingBox() {
    if (!this.economyManager || !this.visualizer || !this.visualizer.layout) {
      return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    }
    return this.visualizer.layout.getBoundingBox(this.economyManager);
  }

  hasContent() {
    if (!this.economyManager) return false;
    return this.economyManager.getAllNodes().length > 0;
  }

  // --- Public API ---

  /**
   * Set the economy manager and rebuild visualization.
   */
  async setEconomyManager(economyManager) {
    this.economyManager = economyManager;
    if (this.visualizer) {
      await this.visualizer.setEconomyManager(economyManager);
      this.onContentReady();
    }
  }

  /**
   * Set simulation engine reference for tick access.
   */
  setSimulationEngine(engine) {
    this.simulationEngine = engine;
  }

  /**
   * Called on each simulation tick. Aggregates data and refreshes cards.
   */
  onSimulationTick() {
    if (!this._visible) return;
    if (!this.simulationEngine || !this.economyManager) return;

    this.aggregator.aggregate(this.simulationEngine, this.economyManager);
    const stats = this.aggregator.getStats();

    if (this.visualizer) {
      this.visualizer.updateStats(stats);
    }

    // Refresh properties panel if a node is selected
    if (this.selectedNodeId !== null) {
      this._showPropertiesPanel(this.selectedNodeId);
    }
  }

  show() {
    this.container.classList.add('visible');
    this._visible = true;
    this.handleResize();

    // Do an immediate stats refresh if simulation is running
    if (this.simulationEngine && this.economyManager) {
      this.aggregator.aggregate(this.simulationEngine, this.economyManager);
      if (this.visualizer) {
        this.visualizer.updateStats(this.aggregator.getStats());
      }
    }
  }

  hide() {
    this.container.classList.remove('visible');
    this._visible = false;
  }

  // --- Internal ---

  _handleCanvasClick(event) {
    if (!this.visualizer) return;

    const node = this.visualizer.raycast(event);
    if (node) {
      this._selectNode(node.id);
    } else {
      this._deselectNode();
    }
  }

  _selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.visualizer.selectNode(nodeId);
    this._showPropertiesPanel(nodeId);
  }

  _deselectNode() {
    this.selectedNodeId = null;
    this.visualizer.selectNode(null);
    this._hidePropertiesPanel();
  }

  _showPropertiesPanel(nodeId) {
    if (!this.economyManager) return;
    const node = this.economyManager.getNode(nodeId);
    if (!node) return;

    this.propertiesPanel.innerHTML = '';
    this.propertiesPanel.style.display = 'block';

    // Title
    const title = document.createElement('h4');
    title.textContent = node.name;
    this.propertiesPanel.appendChild(title);

    const stats = this.aggregator.getStats().get(nodeId);

    if (!stats) {
      const noData = document.createElement('div');
      noData.className = 'fo-property-row';
      noData.innerHTML = '<span>No simulation data available</span>';
      this.propertiesPanel.appendChild(noData);
      return;
    }

    // Factory count
    this._addPropertyRow('Factory Count', `${stats.factoryCount}`);

    // Average sell price
    this._addPropertyRow('Avg Sell Price', `${stats.avgSellPrice.toFixed(2)}`);

    // Output storage bar
    this._addPropertyRow('Output Storage', '');
    this._addStorageBar('output', stats.avgOutputFillPct);

    // Input storage bars (per input product)
    if (stats.inputDetails && stats.inputDetails.size > 0) {
      this._addPropertyRow('Input Storage', '');
      for (const [, detail] of stats.inputDetails) {
        this._addStorageBar('input', detail.avgFillPct, detail.name);
      }
    }

    // Status breakdown
    this._addPropertyRow('Status Breakdown', '');
    const statusContainer = document.createElement('div');
    statusContainer.className = 'fo-status-breakdown';

    const statusLabels = {
      producing: 'Producing',
      idle: 'Idle',
      output_full: 'Output Full',
      missing_inputs: 'Missing Inputs'
    };

    for (const [status, label] of Object.entries(statusLabels)) {
      const count = stats.statusCounts[status] || 0;
      if (count === 0) continue;
      const chip = document.createElement('span');
      chip.className = `fo-status-chip ${status}`;
      chip.textContent = `${label}: ${count}`;
      statusContainer.appendChild(chip);
    }
    this.propertiesPanel.appendChild(statusContainer);
  }

  _addPropertyRow(label, value) {
    const row = document.createElement('div');
    row.className = 'fo-property-row';
    row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    this.propertiesPanel.appendChild(row);
  }

  _addStorageBar(type, fillPct, label) {
    const bar = document.createElement('div');
    bar.className = 'fo-storage-bar';

    if (label) {
      const lbl = document.createElement('div');
      lbl.className = 'fo-storage-bar-label';
      lbl.textContent = label;
      bar.appendChild(lbl);
    }

    const track = document.createElement('div');
    track.className = 'fo-storage-bar-track';

    const fill = document.createElement('div');
    fill.className = `fo-storage-bar-fill ${type}`;
    const pct = Math.max(0, Math.min(1, fillPct));
    fill.style.width = `${(pct * 100).toFixed(1)}%`;
    track.appendChild(fill);

    const text = document.createElement('div');
    text.className = 'fo-storage-bar-text';
    text.textContent = `${(pct * 100).toFixed(0)}%`;
    track.appendChild(text);

    bar.appendChild(track);
    this.propertiesPanel.appendChild(bar);
  }

  _hidePropertiesPanel() {
    this.propertiesPanel.style.display = 'none';
  }
}
