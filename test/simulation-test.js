// Simulation Test - verifies that all products get produced after generating factories
import * as THREE from 'three';
import { Tilemap } from '../domain/map/tilemap.js';
import { ObjectManager } from '../domain/map/objects.js';
import { EconomyGraph as EconomyManager } from '../domain/economy/economy-graph.js';
import { generateObjectTypesFromEconomy } from '../application/game/object-types.js';
import { RandomFactoryGenerator } from '../application/game/random-factory-generator.js';
import { SimulationEngine } from '../domain/simulation/simulation-engine.js';
import { FactoryOverviewAggregator } from '../application/game/factory-overview-aggregator.js';

export class SimulationTest {
  constructor(container, options = {}) {
    this.container = container;
    this.factoryOverviewUI = options.factoryOverviewUI || null;
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
    this.runtimeStatsByProduct = new Map();
    this.runtimeProductIds = [];
    this.useFixedSeed = true;
    this.fixedSeed = 1337;
    this.lastRunSeed = null;

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

    // Seed mode checkbox
    const seedModeLabel = document.createElement('label');
    seedModeLabel.style.cssText = 'color: #aaa; display: inline-flex; align-items: center; gap: 6px;';
    this.seedModeCheckbox = document.createElement('input');
    this.seedModeCheckbox.type = 'checkbox';
    this.seedModeCheckbox.checked = this.useFixedSeed;
    this.seedModeCheckbox.addEventListener('change', () => {
      this.useFixedSeed = this.seedModeCheckbox.checked;
      this.seedInput.disabled = !this.useFixedSeed;
    });
    seedModeLabel.appendChild(this.seedModeCheckbox);
    seedModeLabel.appendChild(document.createTextNode('Fixed Seed'));
    controls.appendChild(seedModeLabel);

    // Seed value input
    const seedLabel = document.createElement('label');
    seedLabel.textContent = 'Seed: ';
    seedLabel.style.color = '#aaa';
    this.seedInput = document.createElement('input');
    this.seedInput.type = 'number';
    this.seedInput.value = String(this.fixedSeed);
    this.seedInput.min = '0';
    this.seedInput.max = '4294967295';
    this.seedInput.style.cssText = 'width: 110px; background: #333; color: #fff; border: 1px solid #555; padding: 4px;';
    this.seedInput.addEventListener('change', () => {
      this.fixedSeed = this._normalizeSeed(this.seedInput.value);
      this.seedInput.value = String(this.fixedSeed);
    });
    seedLabel.appendChild(this.seedInput);
    controls.appendChild(seedLabel);

    // Optional helper button to create a new fixed seed quickly
    this.newSeedBtn = document.createElement('button');
    this.newSeedBtn.textContent = 'New Seed';
    this.newSeedBtn.style.cssText = 'padding: 6px 10px; background: #555; color: #fff; border: none; cursor: pointer;';
    this.newSeedBtn.addEventListener('click', () => {
      this.fixedSeed = this._randomSeed();
      this.seedInput.value = String(this.fixedSeed);
    });
    controls.appendChild(this.newSeedBtn);

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

  _normalizeSeed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1337;
    return (Math.floor(n) >>> 0);
  }

  _randomSeed() {
    return (Math.floor(Math.random() * 0x100000000) >>> 0);
  }

  _selectRunSeed() {
    if (this.useFixedSeed) {
      this.fixedSeed = this._normalizeSeed(this.seedInput.value);
      this.seedInput.value = String(this.fixedSeed);
      return this.fixedSeed;
    }
    return this._randomSeed();
  }

  _createSeededRng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  async loadDefaultEconomy() {
    this.economyManager = new EconomyManager();
    try {
      const resp = await fetch('assets/economy/economy-default.json');
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
    // Dispose previous run resources first so a new run starts clean.
    this.cleanup();

    // Offscreen Three.js scene (no rendering needed)
    this.scene = new THREE.Scene();

    // Tilemap - match normal gameplay defaults.
    const mapSize = 40;
    this.tilemap = new Tilemap(this.scene, {
      mapSize,
      tileSize: 1,
      tileHeight: 0.1,
      noiseSeed: this.lastRunSeed
    });

    // Object manager + object types from economy
    this.objectManager = new ObjectManager(this.scene, this.tilemap);
    const objectTypes = generateObjectTypesFromEconomy(this.economyManager);
    this.objectManager.setObjectTypes(objectTypes);

    // Generate factories with the same defaults used by normal gameplay.
    const generator = new RandomFactoryGenerator();
    const rng = this._createSeededRng(this.lastRunSeed);
    const created = generator.generate(this.economyManager, this.objectManager, this.tilemap, { rng });
    this.log(`Placed ${created.length} factories on ${mapSize}x${mapSize} map (fuel enabled, seed=${this.lastRunSeed})`);

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

    // Initialize runtime metrics tracking per product
    const nodes = this.economyManager.getAllNodes();
    this.runtimeProductIds = nodes.map(n => n.id);
    this.runtimeStatsByProduct.clear();
    for (const id of this.runtimeProductIds) {
      this.runtimeStatsByProduct.set(id, {
        producingTicks: 0,
        totalFactoryTicks: 0,
        activeTransporterCountSum: 0,
        activeTransporterTickSamples: 0,
        routeLengthSum: 0,
        transportCostSum: 0,
        fuelCostSum: 0,
        transportSamples: 0
      });
    }
  }

  async _syncFactoryOverview() {
    if (!this.factoryOverviewUI || !this.economyManager || !this.simulationEngine) return;
    await this.factoryOverviewUI.setEconomyManager(this.economyManager);
    this.factoryOverviewUI.setSimulationEngine(this.simulationEngine);
    this.factoryOverviewUI.onSimulationTick();
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
    this.lastRunSeed = this._selectRunSeed();
    this.log(`Seed mode: ${this.useFixedSeed ? 'fixed' : 'random'}, run seed=${this.lastRunSeed}`);
    this.setupSimulationEnvironment();
    await this._syncFactoryOverview();

    this.log(`--- Running ${this.tickTarget} ticks ---`);
    const startTime = performance.now();

    // Run ticks in batches via requestAnimationFrame to avoid freezing the UI
    let ticksDone = 0;
    await new Promise(resolve => {
      const step = () => {
        const batch = Math.min(this.tickBatch, this.tickTarget - ticksDone);
        for (let i = 0; i < batch; i++) {
          this.simulationEngine.tick();
          this._sampleRuntimeStats();
          ticksDone++;
        }
        // Keep Factory Overview data live while test runs.
        if (ticksDone % 20 === 0 || ticksDone >= this.tickTarget) {
          this.factoryOverviewUI?.onSimulationTick();
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
    await this._syncFactoryOverview();

    this.running = false;
    this.runBtn.disabled = false;
    this.runBtn.textContent = 'Run Test';
  }

  _sampleRuntimeStats() {
    const allStates = this.simulationEngine.getAllActorStates();

    for (const state of allStates) {
      if (state.type !== 'PRODUCER' || state.productId === null) continue;
      const entry = this.runtimeStatsByProduct.get(state.productId);
      if (!entry) continue;
      entry.totalFactoryTicks += 1;
      if (state.status === 'producing') {
        entry.producingTicks += 1;
      }
    }

    const activeCounts = new Map();
    for (const trader of this.simulationEngine.getActiveTraders()) {
      const entry = this.runtimeStatsByProduct.get(trader.productId);
      if (!entry) continue;

      activeCounts.set(trader.productId, (activeCounts.get(trader.productId) || 0) + 1);

      const metrics = this.simulationEngine.getPathMetrics(trader.path);
      entry.routeLengthSum += metrics.routeLength;
      entry.transportCostSum += metrics.transportCost;
      entry.fuelCostSum += metrics.fuelCost;
      entry.transportSamples += 1;
    }

    for (const productId of this.runtimeProductIds) {
      const entry = this.runtimeStatsByProduct.get(productId);
      if (!entry) continue;
      entry.activeTransporterCountSum += activeCounts.get(productId) || 0;
      entry.activeTransporterTickSamples += 1;
    }
  }

  evaluateResults() {
    this.log('--- Results ---');
    const nodes = this.economyManager.getAllNodes();
    const allStates = this.simulationEngine.getAllActorStates();
    const overviewAggregator = new FactoryOverviewAggregator();
    overviewAggregator.aggregate(this.simulationEngine, this.economyManager);
    const overviewStats = overviewAggregator.getStats();

    const results = [];
    let rawCount = 0, rawPassed = 0;
    let processedCount = 0, processedPassed = 0;

    for (const node of nodes) {
      const producers = allStates.filter(s => s.type === 'PRODUCER' && s.productId === node.id);
      let totalOutput = 0;
      let producingCount = 0;
      let totalProducedCount = 0;

      for (const state of producers) {
        const outStorage = state.outputStorage.get(node.id);
        if (outStorage) totalOutput += outStorage.current;
        if (state.status === 'producing') producingCount++;
        totalProducedCount += state.totalProduced;
      }

      let totalDelivered = 0;
      for (const state of allStates) {
        if (state.productId === node.id) continue;
        const inStorage = state.inputStorage.get(node.id);
        if (inStorage) totalDelivered += inStorage.current;
      }

      const isRaw = node.inputs.length === 0;
      const produced = totalOutput > 0 || totalDelivered > 0 || totalProducedCount > 0;

      if (isRaw) { rawCount++; if (produced) rawPassed++; }
      else { processedCount++; if (produced) processedPassed++; }

      let avgPrice = 0;
      let priceCount = 0;
      for (const state of producers) {
        const p = state.getSellPrice(node.id);
        if (p > 0) { avgPrice += p; priceCount++; }
      }
      avgPrice = priceCount > 0 ? avgPrice / priceCount : 0;

      const ov = overviewStats.get(node.id) || {
        avgInputFillPct: 0,
        avgOutputFillPct: 0
      };
      const rt = this.runtimeStatsByProduct.get(node.id) || {
        producingTicks: 0,
        totalFactoryTicks: 0,
        activeTransporterCountSum: 0,
        activeTransporterTickSamples: 0,
        routeLengthSum: 0,
        transportCostSum: 0,
        fuelCostSum: 0,
        transportSamples: 0
      };

      const uptimePct = rt.totalFactoryTicks > 0
        ? (rt.producingTicks / rt.totalFactoryTicks) * 100
        : 0;
      const avgActiveTransporters = rt.activeTransporterTickSamples > 0
        ? rt.activeTransporterCountSum / rt.activeTransporterTickSamples
        : 0;
      const avgRouteLength = rt.transportSamples > 0 ? rt.routeLengthSum / rt.transportSamples : 0;
      const avgTransportCost = rt.transportSamples > 0 ? rt.transportCostSum / rt.transportSamples : 0;
      const avgFuelCost = rt.transportSamples > 0 ? rt.fuelCostSum / rt.transportSamples : 0;

      results.push({
        id: node.id, name: node.name, isRaw,
        factories: producers.length, producing: producingCount,
        uptimePct: `${uptimePct.toFixed(1)}%`,
        avgInputFillPct: `${((ov.avgInputFillPct || 0) * 100).toFixed(1)}%`,
        avgOutputFillPct: `${((ov.avgOutputFillPct || 0) * 100).toFixed(1)}%`,
        avgPrice: Math.round(avgPrice),
        avgActiveTransporters: avgActiveTransporters.toFixed(2),
        avgRouteLength: avgRouteLength.toFixed(2),
        avgTransportCost: avgTransportCost.toFixed(2),
        avgFuelCost: avgFuelCost.toFixed(2),
        stock: totalOutput.toFixed(1),
        delivered: totalDelivered.toFixed(1),
        totalProduced: totalProducedCount,
        passed: produced
      });

      const status = produced ? 'PASS' : 'FAIL';
      this.log(
        `  [${status}] ${node.name} (id=${node.id}): stock=${totalOutput.toFixed(1)}, delivered=${totalDelivered.toFixed(1)}, produced=${totalProducedCount}, ` +
        `price=${Math.round(avgPrice)}, producing=${producingCount}/${producers.length}, uptime=${uptimePct.toFixed(1)}%, ` +
        `avgRoute=${avgRouteLength.toFixed(2)}, avgTransCost=${avgTransportCost.toFixed(2)}, avgFuelCost=${avgFuelCost.toFixed(2)}`
      );
    }

    const rawOk = rawPassed === rawCount;
    const processedOk = processedPassed === processedCount;

    const rawAvgPrice = results.filter(r => r.isRaw && r.passed).reduce((s, r) => s + r.avgPrice, 0) / Math.max(rawPassed, 1);
    const procAvgPrice = results.filter(r => !r.isRaw && r.passed).reduce((s, r) => s + r.avgPrice, 0) / Math.max(processedPassed, 1);
    const priceOk = processedPassed === 0 || procAvgPrice > rawAvgPrice;

    const allPassed = rawOk && processedOk;

    this.log(`--- Checks ---`);
    this.log(`  Raw materials: ${rawPassed}/${rawCount} ${rawOk ? 'OK' : 'FAIL'}`);
    this.log(`  Processed goods: ${processedPassed}/${processedCount} (need ${processedCount}) ${processedOk ? 'OK' : 'FAIL'}`);
    this.log(`  Price cascade (info): raw avg=${Math.round(rawAvgPrice)}, processed avg=${Math.round(procAvgPrice)} ${priceOk ? 'OK' : 'WARN'}`);
    this.log(allPassed ? '=== TEST PASSED ===' : '=== TEST FAILED ===');

    this.renderResultsTable(results, allPassed);
  }

  renderResultsTable(results, allPassed) {
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse: collapse; width: 100%; font-size: 13px;';

    const banner = document.createElement('div');
    banner.textContent = allPassed ? 'ALL PASSED' : 'SOME FAILED';
    banner.style.cssText = `padding: 8px 12px; font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #fff; background: ${allPassed ? '#2a6' : '#c44'};`;
    this.resultsDiv.appendChild(banner);

    const headerDefs = [
      { label: '', title: 'Per-product pass/fail status.' },
      { label: 'Product', title: 'Product name and ID.' },
      { label: 'Type', title: 'Raw material or processed product.' },
      { label: 'Factories', title: 'Number of factories producing this product type.' },
      { label: 'Producing', title: 'Factories currently producing at end of run.' },
      { label: 'Uptime %', title: 'Percent of sampled factory-ticks spent in producing state during the run.' },
      { label: 'Avg In %', title: 'Average input storage fill percentage for this product type.' },
      { label: 'Avg Out %', title: 'Average output storage fill percentage for this product type.' },
      { label: 'Avg Price', title: 'Average sell price across factories of this product type at end of run.' },
      { label: 'Avg Active Tr', title: 'Average number of active traders carrying this product over time.' },
      { label: 'Avg Route Len', title: 'Average route length (tiles/steps) for active transports of this product.' },
      { label: 'Avg Transport Cost', title: 'Average transport cost per active transport sample for this product.' },
      { label: 'Avg Fuel Cost', title: 'Average fuel cost per active transport sample for this product.' },
      { label: 'Stock', title: 'Total output stock currently in producer output storage.' },
      { label: 'Delivered', title: 'Total amount currently sitting in other actors input storage.' },
      { label: 'Produced', title: 'Total units produced over the run.' }
    ];

    const headerRow = table.insertRow();
    for (const { label, title } of headerDefs) {
      const th = document.createElement('th');
      th.textContent = label;
      th.title = title;
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
        r.uptimePct,
        r.avgInputFillPct,
        r.avgOutputFillPct,
        r.avgPrice,
        r.avgActiveTransporters,
        r.avgRouteLength,
        r.avgTransportCost,
        r.avgFuelCost,
        r.stock,
        r.delivered,
        r.totalProduced
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
