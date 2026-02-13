import fs from 'node:fs';
import { EconomyManager } from '../economy-editor/economy-manager.js';
import { RandomFactoryGenerator } from '../simulation/random-factory-generator.js';
import { SimulationEngine } from '../simulation/simulation-engine.js';
import { NoiseGenerator } from '../map-editor/noise.js';
import { TileTypes } from '../map-editor/config/tile-types.js';

class HeadlessTilemap {
  constructor(mapSize, tileSize, seed) {
    this.mapSize = mapSize;
    this.tileSize = tileSize;
    this.tileHeight = 0.1;
    this.tiles = [];

    const noise = new NoiseGenerator(seed);
    const heights = noise.generateHeightMap(mapSize, mapSize, 0.08, 4);
    for (let x = 0; x < mapSize; x++) {
      for (let z = 0; z < mapSize; z++) {
        const h = Math.min(1, heights[z][x] + 0.18);
        let tileTypeIndex = TileTypes.length - 1;
        for (let i = 0; i < TileTypes.length; i++) {
          if (h >= TileTypes[i].minHeight && h < TileTypes[i].maxHeight) {
            tileTypeIndex = i;
            break;
          }
        }
        this.tiles.push({ userData: { gridX: x, gridZ: z, tileTypeIndex } });
      }
    }
  }

  getConfig() {
    return { mapSize: this.mapSize, tileSize: this.tileSize, tileHeight: this.tileHeight };
  }

  getTileTopSurface() {
    return 0;
  }
}

class HeadlessObjectManager {
  constructor() {
    this.objects = [];
    this.nextId = 0;
  }

  createObject(type, position) {
    const obj = {
      id: this.nextId++,
      type,
      mesh: { position: { x: position.x, y: position.y, z: position.z } }
    };
    this.objects.push(obj);
    return obj;
  }

  getAllObjects() {
    return this.objects;
  }

  getObjectById(id) {
    return this.objects.find(o => o.id === id);
  }
}

class StubRouteManager {
  getAllRoutes() {
    return [];
  }
}

function makeRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function loadEconomy() {
  const raw = fs.readFileSync(new URL('../economy-editor/economy-default.json', import.meta.url), 'utf8');
  const data = JSON.parse(raw);
  const em = new EconomyManager();
  em.loadFromData(data);
  return em;
}

function runSingle(seed, ticks = 1200) {
  const economy = loadEconomy();
  const tilemap = new HeadlessTilemap(40, 1, seed);
  const objectManager = new HeadlessObjectManager();
  const generator = new RandomFactoryGenerator();
  const created = generator.generate(economy, objectManager, tilemap, { rng: makeRng(seed), minSpacing: 2 });

  const sim = new SimulationEngine(economy, objectManager, new StubRouteManager(), tilemap);
  sim.initialize();

  const prevStatus = new Map();
  let statusChanges = 0;
  let statusSamples = 0;
  let transportCostSamples = 0;
  let transportCostSum = 0;

  for (let t = 0; t < ticks; t++) {
    sim.tick();

    for (const s of sim.getAllActorStates()) {
      if (s.type !== 'PRODUCER' || s.productId === null) continue;
      const key = s.objectId;
      const prev = prevStatus.get(key);
      if (prev !== undefined && prev !== s.status) statusChanges += 1;
      prevStatus.set(key, s.status);
      statusSamples += 1;
    }

    for (const trader of sim.getActiveTraders()) {
      const m = sim.getPathMetrics(trader.path);
      transportCostSum += m.transportCost;
      transportCostSamples += 1;
    }
  }

  let producing = 0;
  let observed = 0;
  for (const s of sim.getAllActorStates()) {
    if (s.type !== 'PRODUCER' || s.productId === null) continue;
    producing += s.producingTicks;
    observed += s.observedTicks;
  }
  const uptime = observed > 0 ? producing / observed : 0;
  const churn = statusSamples > 0 ? statusChanges / statusSamples : 0;
  const avgTransportCost = transportCostSamples > 0 ? transportCostSum / transportCostSamples : 0;
  const score = uptime * 100 - churn * 120 - avgTransportCost * 4;

  return {
    seed,
    factories: created.length,
    uptime,
    churn,
    avgTransportCost,
    score
  };
}

function summarize(results) {
  const n = results.length;
  const avg = (k) => results.reduce((s, r) => s + r[k], 0) / n;
  return {
    avgUptime: avg('uptime'),
    avgChurn: avg('churn'),
    avgTransportCost: avg('avgTransportCost'),
    avgScore: avg('score')
  };
}

const seedArg = process.argv[2] || '1337,2026,9001';
const tickArg = Number(process.argv[3] || '1200');
const seeds = seedArg.split(',').map(s => Number(s.trim())).filter(Number.isFinite);
const results = seeds.map(seed => runSingle(seed >>> 0, tickArg));
const summary = summarize(results);

console.log(JSON.stringify({ seeds, ticks: tickArg, summary, results }, null, 2));
