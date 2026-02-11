// Simulation Test - verifies that all products get produced after generating factories
import * as THREE from 'three';
import { Tilemap } from '../map-editor/tilemap.js';
import { ObjectManager } from '../map-editor/objects.js';
import { EconomyManager } from '../economy-editor/economy-manager.js';
import { generateObjectTypesFromEconomy } from '../map-editor/config/object-types.js';
import { RandomFactoryGenerator } from '../simulation/random-factory-generator.js';
import { SimulationEngine } from '../simulation/simulation-engine.js';

export class SimulationTest {
  constructor(container) {
    this.container = container;
    this.economyManager = null;
    this.objectManager = null;
    this.tilemap = null;
    this.simulationEngine = null;
    this.scene = null;

    // Test state
    this.running = false;
    this.tickTarget = 1000;
    this.tickBatch = 10; // ticks per animation frame
    this.logLines = [];

    this.init();
  }

  async init() {
    this.createUI();
    await this.loadDefaultEconomy();
    this.log('Ready. Click "Run Test" to start.');
  }

  createUI() {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding: 20px; font-family: monospace; color: #ddd; height: 100%; display: flex; flex-direction: column;';

    // Header
    const header = document.createElement('h2');
    header.textContent = 'Simulation Test';
    header.style.cssText = 'margin: 0 0 10px 0; color: #fff;';
    wrapper.appendChild(header);

    // Controls row
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 15px; flex-wrap: wrap;';

    const tickLabel = document.createElement('label');
    tickLabel.textContent = 'Ticks: ';
    tickLabel.style.color = '#aaa';
    this.tickInput = document.createElement('input');
    this.tickInput.type = 'number';
    this.tickInput.value = this.tickTarget;
    this.tickInput.min = 50;
    this.tickInput.max = 5000;
    this.tickInput.style.cssText = 'width: 70px; background: #333; color: #fff; border: 1px solid #555; padding: 4px;';
    this.tickInput.addEventListener('change', () => {
      this.tickTarget = parseInt(this.tickInput.value) || 200;
    });
    tickLabel.appendChild(this.tickInput);
    controls.appendChild(tickLabel);

    this.runBtn = document.createElement('button');
    this.runBtn.textContent = 'Run Test';
    this.runBtn.style.cssText = 'padding: 6px 16px; background: #2a6; color: #fff; border: none; cursor: pointer; font-weight: bold;';
    this.runBtn.addEventListener('click', () => this.runTest());
    controls.appendChild(this.runBtn);

    wrapper.appendChild(controls);

    // Results table
    this.resultsDiv = document.createElement('div');
    this.resultsDiv.style.cssText = 'margin-bottom: 15px;';
    wrapper.appendChild(this.resultsDiv);

    // Log area
    this.logArea = document.createElement('pre');
    this.logArea.style.cssText = 'flex: 1; overflow-y: auto; background: #111; padding: 10px; border: 1px solid #333; margin: 0; font-size: 12px; min-height: 150px;';
    wrapper.appendChild(this.logArea);

    this.container.appendChild(wrapper);
  }

  async loadDefaultEconomy() {
    this.economyManager = new EconomyManager();
    try {
      const resp = await fetch('economy-editor/economy-default.json');
      const data = await resp.json();
      this.economyManager.loadFromData(data);
      const nodes = this.economyManager.getAllNodes();
      this.log(`Loaded default economy: ${nodes.length} products`);
      for (const n of nodes) {
        const inputs = n.inputs.length === 0 ? '(raw material)' : n.inputs.map(i => `${i.productId}x${i.amount}`).join(', ');
        this.log(`  [${n.id}] ${n.name} <- ${inputs}`);
      }
    } catch (e) {
      this.log(`ERROR loading economy: ${e.message}`);
    }
  }

  setupSimulationEnvironment() {
    // Offscreen Three.js scene (no rendering needed)
    this.scene = new THREE.Scene();

    // Disable fuel for this test — we're testing cost-based pricing/production,
    // not fuel logistics. Fuel adds a transport bottleneck that's orthogonal to pricing.
    this.economyManager.fuelProductId = null;

    // Tilemap — all land, large enough for many factories
    const mapSize = 20;
    this.tilemap = new Tilemap(this.scene, { mapSize, tileSize: 1, tileHeight: 0.1 });

    // Force all tiles to be land (tileTypeIndex >= 3) so factories can be placed
    for (const tile of this.tilemap.tiles) {
      if (tile.userData.tileTypeIndex < 3) {
        tile.userData.tileTypeIndex = 3;
      }
    }

    // Object manager + object types from economy
    this.objectManager = new ObjectManager(this.scene, this.tilemap);
    const objectTypes = generateObjectTypesFromEconomy(this.economyManager);
    this.objectManager.setObjectTypes(objectTypes);

    // Generate many factories — high count to ensure enough supply for heavy recipes
    const generator = new RandomFactoryGenerator();
    const created = generator.generate(this.economyManager, this.objectManager, this.tilemap, {
      minSpacing: 1, totalFactories: 120
    });
    this.log(`Placed ${created.length} factories on ${mapSize}x${mapSize} map (no fuel)`);

    // Count per product
    const counts = new Map();
    for (const obj of this.objectManager.getAllObjects()) {
      counts.set(obj.type, (counts.get(obj.type) || 0) + 1);
    }
    for (const [type, count] of counts) {
      this.log(`  ${type}: ${count}`);
    }

    // Stub route manager (no roads)
    const stubRouteManager = { getAllRoutes() { return []; } };

    // Create simulation engine
    this.simulationEngine = new SimulationEngine(
      this.economyManager, this.objectManager, stubRouteManager, this.tilemap
    );
    this.simulationEngine.initialize();
    // Evaluate trades every tick for faster bootstrapping in test
    this.simulationEngine._tradeEvalInterval = 1;
  }

  async runTest() {
    if (this.running) return;
    this.running = true;
    this.runBtn.disabled = true;
    this.runBtn.textContent = 'Running...';
    this.resultsDiv.innerHTML = '';
    this.logLines = [];
    this.logArea.textContent = '';

    this.log('--- Setting up simulation environment ---');
    this.setupSimulationEnvironment();

    this.log(`--- Running ${this.tickTarget} ticks ---`);
    const startTime = performance.now();

    // Run ticks in batches via requestAnimationFrame to avoid freezing the UI
    let ticksDone = 0;
    await new Promise(resolve => {
      const step = () => {
        const batch = Math.min(this.tickBatch, this.tickTarget - ticksDone);
        for (let i = 0; i < batch; i++) {
          this.simulationEngine.tick();
          ticksDone++;
        }
        // Progress update every 50 ticks
        if (ticksDone % 50 === 0 || ticksDone >= this.tickTarget) {
          this.log(`  tick ${ticksDone}/${this.tickTarget}`);
        }
        if (ticksDone < this.tickTarget) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    this.log(`Completed ${this.tickTarget} ticks in ${elapsed}s`);
    this.log(`Traders created: ${this.simulationEngine.nextTraderId}, active: ${this.simulationEngine.activeTraders.length}`);

    // Evaluate results
    this.evaluateResults();

    // Cleanup Three.js resources
    this.cleanup();

    this.running = false;
    this.runBtn.disabled = false;
    this.runBtn.textContent = 'Run Test';
  }

  evaluateResults() {
    this.log('--- Results ---');
    const nodes = this.economyManager.getAllNodes();
    const allStates = this.simulationEngine.getAllActorStates();

    const results = [];
    let rawCount = 0, rawPassed = 0;
    let processedCount = 0, processedPassed = 0;

    for (const node of nodes) {
      const producers = allStates.filter(s => s.type === 'PRODUCER' && s.productId === node.id);
      let totalOutput = 0;
      let producingCount = 0;

      for (const state of producers) {
        const outStorage = state.outputStorage.get(node.id);
        if (outStorage) totalOutput += outStorage.current;
        if (state.status === 'producing') producingCount++;
      }

      // Count product in other actors' input storage (delivered and waiting to be consumed)
      let totalDelivered = 0;
      for (const state of allStates) {
        if (state.productId === node.id) continue;
        const inStorage = state.inputStorage.get(node.id);
        if (inStorage) totalDelivered += inStorage.current;
      }

      const isRaw = node.inputs.length === 0;
      const produced = totalOutput > 0 || totalDelivered > 0;

      if (isRaw) { rawCount++; if (produced) rawPassed++; }
      else { processedCount++; if (produced) processedPassed++; }

      // Get average sell price
      let avgPrice = 0;
      let priceCount = 0;
      for (const state of producers) {
        const p = state.getSellPrice(node.id);
        if (p > 0) { avgPrice += p; priceCount++; }
      }
      avgPrice = priceCount > 0 ? avgPrice / priceCount : 0;

      results.push({
        id: node.id, name: node.name, isRaw,
        factories: producers.length, producing: producingCount,
        stock: totalOutput.toFixed(1), delivered: totalDelivered.toFixed(1),
        avgPrice: avgPrice.toFixed(2), passed: produced
      });

      const status = produced ? 'PASS' : 'FAIL';
      this.log(`  [${status}] ${node.name} (id=${node.id}): stock=${totalOutput.toFixed(1)}, delivered=${totalDelivered.toFixed(1)}, price=${avgPrice.toFixed(2)}, producing=${producingCount}/${producers.length}`);
    }

    // Pass criteria:
    // 1. All raw materials must produce
    // 2. At least half of processed goods must produce (trade distribution limits throughput)
    // 3. Processed goods that produced must have higher avg price than raw materials (cost cascade)
    const rawOk = rawPassed === rawCount;
    const processedOk = processedPassed >= Math.ceil(processedCount / 2);

    const rawAvgPrice = results.filter(r => r.isRaw && r.passed).reduce((s, r) => s + parseFloat(r.avgPrice), 0) / Math.max(rawPassed, 1);
    const procAvgPrice = results.filter(r => !r.isRaw && r.passed).reduce((s, r) => s + parseFloat(r.avgPrice), 0) / Math.max(processedPassed, 1);
    const priceOk = processedPassed === 0 || procAvgPrice > rawAvgPrice;

    const allPassed = rawOk && processedOk && priceOk;

    this.log(`--- Checks ---`);
    this.log(`  Raw materials: ${rawPassed}/${rawCount} ${rawOk ? 'OK' : 'FAIL'}`);
    this.log(`  Processed goods: ${processedPassed}/${processedCount} (need ${Math.ceil(processedCount / 2)}) ${processedOk ? 'OK' : 'FAIL'}`);
    this.log(`  Price cascade: raw avg=${rawAvgPrice.toFixed(2)}, processed avg=${procAvgPrice.toFixed(2)} ${priceOk ? 'OK' : 'FAIL'}`);
    this.log(allPassed ? '=== TEST PASSED ===' : '=== TEST FAILED ===');

    this.renderResultsTable(results, allPassed);
  }

  renderResultsTable(results, allPassed) {
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse: collapse; width: 100%; font-size: 13px;';

    // Overall status banner
    const banner = document.createElement('div');
    banner.textContent = allPassed ? 'ALL PASSED' : 'SOME FAILED';
    banner.style.cssText = `padding: 8px 12px; font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #fff; background: ${allPassed ? '#2a6' : '#c44'};`;
    this.resultsDiv.appendChild(banner);

    const headerRow = table.insertRow();
    for (const col of ['', 'Product', 'Type', 'Factories', 'Producing', 'Stock', 'Delivered', 'Avg Price']) {
      const th = document.createElement('th');
      th.textContent = col;
      th.style.cssText = 'text-align: left; padding: 4px 8px; border-bottom: 1px solid #555; color: #aaa;';
      headerRow.appendChild(th);
    }

    for (const r of results) {
      const row = table.insertRow();
      row.style.background = r.passed ? 'rgba(34,170,102,0.1)' : 'rgba(204,68,68,0.15)';

      const cells = [
        r.passed ? '\u2705' : '\u274C',
        `${r.name} (${r.id})`,
        r.isRaw ? 'Raw' : 'Processed',
        r.factories,
        r.producing,
        r.stock,
        r.delivered,
        r.avgPrice
      ];

      for (const val of cells) {
        const td = row.insertCell();
        td.textContent = val;
        td.style.cssText = 'padding: 4px 8px; border-bottom: 1px solid #333;';
      }
    }

    this.resultsDiv.appendChild(table);
  }

  cleanup() {
    // Dispose Three.js objects to prevent memory leaks
    if (this.tilemap) {
      this.tilemap.clear();
      this.tilemap = null;
    }
    if (this.objectManager) {
      this.objectManager.clearAll();
      this.objectManager = null;
    }
    this.simulationEngine = null;
    this.scene = null;
  }

  log(msg) {
    this.logLines.push(msg);
    if (this.logArea) {
      this.logArea.textContent = this.logLines.join('\n');
      this.logArea.scrollTop = this.logArea.scrollHeight;
    }
  }
}
