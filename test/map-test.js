import * as THREE from 'three';
import { Tilemap } from '../domain/map/tilemap.js';
import { ObjectManager } from '../domain/map/objects.js';
import { EconomyGraph } from '../domain/economy/economy-graph.js';
import { generateObjectTypesFromEconomy } from '../application/game/object-types.js';
import { RandomFactoryGenerator } from '../application/game/random-factory-generator.js';
import { SimulationEngine } from '../domain/simulation/simulation-engine.js';
import { TradeRenderer } from '../ui/visualizers/trade-renderer.js';
import { CanvasTestBase } from './canvas-test-base.js';

export class MapTest extends CanvasTestBase {
  constructor(container) {
    super();

    this.container = container;
    this.canvasContainer = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.tilemap = null;
    this.objectManager = null;
    this.economyGraph = null;
    this.simulationEngine = null;
    this.tradeRenderer = null;
    this.routeManager = { getAllRoutes() { return []; } };

    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.tickAccumulatorMs = 0;
    this.simulationTickMs = 150;

    this.statusLine = null;
    this.messageLine = null;
    this.factoryCount = 0;
    this.warmupStatus = 'Loading scenario...';

    this.init();
  }

  async init() {
    this.createUI();
    this.setupThreeJS();
    this.updateStatus();

    try {
      const shouldAnimate = await this.loadScenario();
      if (shouldAnimate) {
        this.startAnimation();
      }
    } catch (error) {
      this.showError(`Failed to load map test: ${error.message}`);
    }
  }

  createUI() {
    this.container.innerHTML = '';
    this.container.style.height = '100%';
    this.container.style.background = '#121212';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; height: 100%; width: 100%; color: #fff; font-family: sans-serif;';
    this.container.appendChild(wrapper);

    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px 20px 8px; border-bottom: 1px solid #2d2d2d;';
    wrapper.appendChild(header);

    const title = document.createElement('h2');
    title.textContent = 'Map Test';
    title.style.cssText = 'margin: 0 0 6px; font-size: 22px;';
    header.appendChild(title);

    this.statusLine = document.createElement('div');
    this.statusLine.style.cssText = 'font-size: 13px; color: #c6c6c6;';
    header.appendChild(this.statusLine);

    this.messageLine = document.createElement('div');
    this.messageLine.style.cssText = 'padding: 8px 20px 0; font-size: 13px; color: #f0c674; min-height: 20px;';
    wrapper.appendChild(this.messageLine);

    this.canvasContainer = document.createElement('div');
    this.canvasContainer.style.cssText = 'flex: 1; min-height: 0; position: relative; overflow: hidden;';
    wrapper.appendChild(this.canvasContainer);
  }

  setupThreeJS() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x182028);

    this.camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 500);
    this.camera.position.set(24, 22, 24);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(800, 600);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvasContainer.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(18, 30, 12);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    this.setupResizeHandling();
    this.renderFrame();
  }

  async loadScenario() {
    const response = await fetch('assets/economy/economy-default.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    this.economyGraph = new EconomyGraph();
    this.economyGraph.loadFromData(data);

    this.tilemap = new Tilemap(this.scene, {
      mapSize: 30,
      tileSize: 1,
      tileHeight: 0.1,
      noiseSeed: 1337
    });

    this.objectManager = new ObjectManager(this.scene, this.tilemap);
    this.objectManager.setObjectTypes(generateObjectTypesFromEconomy(this.economyGraph));

    const generator = new RandomFactoryGenerator();
    generator.generate(this.economyGraph, this.objectManager, this.tilemap, {
      rng: this.createSeededRng(1337)
    });

    this.factoryCount = this.objectManager.getAllObjects().length;
    if (this.factoryCount === 0) {
      this.warmupStatus = 'No factories generated';
      this.showMessage('No factories were generated for the map test.');
      this.updateCameraPosition();
      this.updateStatus();
      this.renderFrame();
      return false;
    }

    this.simulationEngine = new SimulationEngine(
      this.economyGraph,
      this.objectManager,
      this.routeManager,
      this.tilemap
    );
    this.simulationEngine.initialize();

    let tradeFound = false;
    for (let i = 0; i < 200; i++) {
      this.simulationEngine.tick();
      if (this.simulationEngine.getActiveTraders().length > 0) {
        tradeFound = true;
        break;
      }
    }

    this.warmupStatus = tradeFound ? 'Trade active' : 'No active trade emerged during warm-up';
    this.showMessage(tradeFound ? '' : 'No active trade emerged during warm-up');

    this.tradeRenderer = new TradeRenderer(this.scene, this.simulationEngine, this.tilemap);
    this.tradeRenderer.update();
    this.updateCameraPosition();
    this.updateStatus();
    this.renderFrame();
    return true;
  }

  createSeededRng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  updateCameraPosition() {
    if (!this.camera || !this.tilemap) return;

    const mapRadius = this.tilemap.getConfig().mapSize * 0.5;
    this.camera.position.set(mapRadius * 1.25, mapRadius * 1.15, mapRadius * 1.25);
    this.camera.lookAt(0, 0, 0);
  }

  startAnimation() {
    if (this.animationFrameId !== null || !this.renderer) {
      return;
    }

    this.lastFrameTime = performance.now();
    const animate = (timestamp) => {
      if (!this.renderer) return;

      const deltaMs = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;
      this.tickAccumulatorMs += deltaMs;

      while (this.simulationEngine && this.tickAccumulatorMs >= this.simulationTickMs) {
        this.simulationEngine.tick();
        this.tickAccumulatorMs -= this.simulationTickMs;
      }

      this.tradeRenderer?.update();
      this.updateStatus();
      this.renderFrame();

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  updateStatus() {
    if (!this.statusLine) return;

    const activeTraders = this.simulationEngine ? this.simulationEngine.getActiveTraders().length : 0;
    this.statusLine.textContent = `Factories: ${this.factoryCount} | Active Traders: ${activeTraders} | Status: ${this.warmupStatus}`;
  }

  showMessage(message) {
    if (!this.messageLine) return;
    this.messageLine.textContent = message;
  }

  showError(message) {
    this.warmupStatus = 'Error';
    this.showMessage(message);
    this.updateStatus();
    this.renderFrame();
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  onResized(width, height) {
    if (!this.renderer || !this.camera) return;

    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderFrame();
  }

  destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.tradeRenderer?.dispose();
    this.tradeRenderer = null;

    this.objectManager?.clearAll();
    this.objectManager = null;

    this.tilemap?.clear();
    this.tilemap = null;

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.simulationEngine = null;
    this.economyGraph = null;

    super.destroy();
  }
}
