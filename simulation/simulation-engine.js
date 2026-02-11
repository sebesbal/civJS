// SimulationEngine - core tick loop for production, trading, transport, and pricing

import { ActorState } from './actor-state.js';
import { findPath, computeRoadTiles, worldToGrid, gridToWorld } from './pathfinding.js';

export class SimulationEngine {
  /**
   * @param {EconomyManager} economyManager
   * @param {ObjectManager} objectManager
   * @param {RouteManager} routeManager
   * @param {Tilemap} tilemap
   */
  constructor(economyManager, objectManager, routeManager, tilemap) {
    this.economyManager = economyManager;
    this.objectManager = objectManager;
    this.routeManager = routeManager;
    this.tilemap = tilemap;

    // Actor states: Map<objectId, ActorState>
    this.actorStates = new Map();

    // Active traders
    this.activeTraders = [];
    this.nextTraderId = 0;

    // Simulation control
    this._running = false;
    this.speed = 1.0;             // multiplier
    this.tickCount = 0;
    this.tickInterval = 1000;     // ms per tick at 1x speed
    this._lastTickTime = 0;

    // Cached road tiles (recomputed on initialize)
    this.roadTiles = new Set();

    // Callback
    this.onTick = null;

    // Trade evaluation interval (not every tick to save CPU)
    this._tradeEvalCounter = 0;
    this._tradeEvalInterval = 3; // evaluate trades every N ticks
  }

  /**
   * Initialize actor states for all placed map objects.
   * Call this before starting the simulation.
   */
  initialize() {
    this.actorStates.clear();
    this.activeTraders = [];
    this.nextTraderId = 0;
    this.tickCount = 0;

    // Compute road tiles
    this.roadTiles = computeRoadTiles(this.routeManager, this.tilemap);

    // Create actor state for each map object
    for (const obj of this.objectManager.getAllObjects()) {
      this._createActorState(obj);
    }
  }

  _createActorState(obj) {
    if (obj.type === 'WAREHOUSE') {
      const state = new ActorState(obj.id, 'WAREHOUSE', null);
      state.initializeWarehouseStorage(this.economyManager);
      this.actorStates.set(obj.id, state);
    } else if (obj.type.startsWith('PRODUCT_')) {
      const productId = parseInt(obj.type.split('_')[1]);
      const state = new ActorState(obj.id, 'PRODUCER', productId);
      state.initializeProducerStorage(this.economyManager);
      this.actorStates.set(obj.id, state);
    }
  }

  // --- Simulation Control ---

  start() {
    if (this.actorStates.size === 0) {
      this.initialize();
    }
    this._running = true;
    this._lastTickTime = performance.now();
  }

  stop() {
    this._running = false;
  }

  get isRunning() {
    return this._running;
  }

  setSpeed(multiplier) {
    this.speed = Math.max(0.1, Math.min(10, multiplier));
  }

  /**
   * Called from the animation loop. Checks if enough time has passed for a tick.
   * @param {number} timestamp - performance.now()
   */
  update(timestamp) {
    if (!this._running) return;

    const elapsed = timestamp - this._lastTickTime;
    const adjustedInterval = this.tickInterval / this.speed;

    if (elapsed >= adjustedInterval) {
      this.tick();
      this._lastTickTime = timestamp;
    }
  }

  /**
   * Execute one simulation tick.
   */
  tick() {
    this.tickCount++;

    // Phase 1: Production
    this._runProduction();

    // Phase 2: Trading (evaluate new trades periodically)
    this._tradeEvalCounter++;
    if (this._tradeEvalCounter >= this._tradeEvalInterval) {
      this._evaluateTradeOpportunities();
      this._tradeEvalCounter = 0;
    }

    // Phase 3: Transport (move active traders)
    this._runTransport();

    // Phase 4: Pricing
    this._updateAllPrices();

    // Notify listeners
    if (this.onTick) {
      this.onTick(this.tickCount);
    }
  }

  // --- Phase 1: Production ---

  _runProduction() {
    for (const state of this.actorStates.values()) {
      if (state.type !== 'PRODUCER') continue;

      const node = this.economyManager.getNode(state.productId);
      if (!node) continue;

      const isRawMaterial = state.isRawMaterial();
      const isSink = state.isSink(this.economyManager);
      const outputStorage = state.outputStorage.get(state.productId);

      // Check if output storage is full (unless sink — output disappears)
      if (!isSink && outputStorage && outputStorage.current >= outputStorage.capacity) {
        state.isProducing = false;
        state.status = 'output_full';
        continue;
      }

      if (isRawMaterial) {
        // Raw materials always produce
        state.isProducing = true;
        state.status = 'producing';
        state.productionProgress += state.productionRate;

        if (state.productionProgress >= 1.0) {
          state.productionProgress -= 1.0;
          if (!isSink && outputStorage) {
            outputStorage.current = Math.min(
              outputStorage.current + 1,
              outputStorage.capacity
            );
          }
        }
      } else {
        // Check if all inputs are available
        let canProduce = true;
        for (const input of node.inputs) {
          const inputStorage = state.inputStorage.get(input.productId);
          if (!inputStorage || inputStorage.current < input.amount) {
            canProduce = false;
            break;
          }
        }

        if (canProduce) {
          state.isProducing = true;
          state.status = 'producing';

          // Consume inputs
          for (const input of node.inputs) {
            const inputStorage = state.inputStorage.get(input.productId);
            inputStorage.current -= input.amount;
          }

          state.productionProgress += state.productionRate;

          if (state.productionProgress >= 1.0) {
            state.productionProgress -= 1.0;
            if (!isSink && outputStorage) {
              outputStorage.current = Math.min(
                outputStorage.current + 1,
                outputStorage.capacity
              );
            }
          }
        } else {
          state.isProducing = false;
          state.status = 'missing_inputs';
        }
      }
    }
  }

  // --- Phase 2: Trade Evaluation ---

  _evaluateTradeOpportunities() {
    // Limit active traders to prevent runaway
    const maxActiveTraders = 50;
    if (this.activeTraders.length >= maxActiveTraders) return;

    // Find all actors with output surplus
    for (const sourceState of this.actorStates.values()) {
      for (const [productId, outputStorage] of sourceState.outputStorage) {
        // Need surplus: current > ideal
        if (outputStorage.current <= outputStorage.ideal * 0.5) continue;
        // Need at least 1 unit to transport
        if (outputStorage.current < 1) continue;

        // Find potential buyers for this product
        const buyer = this._findBestBuyer(sourceState, productId);
        if (!buyer) continue;

        // Check if there's already an active trader on this route for this product
        const alreadyTrading = this.activeTraders.some(t =>
          t.sourceObjectId === sourceState.objectId &&
          t.destObjectId === buyer.state.objectId &&
          t.productId === productId
        );
        if (alreadyTrading) continue;

        // Check profitability
        const sourceObj = this.objectManager.getObjectById(sourceState.objectId);
        const destObj = this.objectManager.getObjectById(buyer.state.objectId);
        if (!sourceObj || !destObj) continue;

        const sourceGrid = worldToGrid(sourceObj.mesh.position.x, sourceObj.mesh.position.z, this.tilemap);
        const destGrid = worldToGrid(destObj.mesh.position.x, destObj.mesh.position.z, this.tilemap);

        const path = findPath(this.tilemap, sourceGrid, destGrid, this.roadTiles);
        if (!path || path.length < 2) continue;

        // Calculate fuel consumption based on path length
        let fuelRequired = 0;
        for (const step of path) {
          fuelRequired += this.roadTiles.has(`${step.gridX},${step.gridZ}`) ? 0.15 : 0.5;
        }

        // Check if source has enough fuel (if fuel is designated)
        const fuelProductId = this.economyManager.getFuelProductId();
        if (fuelProductId !== null) {
          const fuelStorage = sourceState.outputStorage.get(fuelProductId) ||
                             sourceState.inputStorage.get(fuelProductId);
          if (!fuelStorage || fuelStorage.current < fuelRequired) {
            continue; // Not enough fuel, skip this trade
          }
        }

        const sellPrice = sourceState.getSellPrice(productId);
        const buyPrice = buyer.state.getBuyPrice(productId);

        // Trade is profitable if buyer pays more than seller price + fuel cost
        if (buyPrice > sellPrice + fuelRequired) {
          this._createTrader(sourceState, buyer.state, productId, path, fuelRequired);
        }
      }
    }
  }

  /**
   * Find the best buyer for a product (actor that needs it most and is willing to pay most).
   */
  _findBestBuyer(sourceState, productId) {
    let bestBuyer = null;
    let bestScore = -Infinity;

    for (const candidateState of this.actorStates.values()) {
      if (candidateState.objectId === sourceState.objectId) continue;

      // Check if candidate needs this product as input
      let needsProduct = false;
      let storage = null;

      if (candidateState.type === 'PRODUCER') {
        storage = candidateState.inputStorage.get(productId);
        if (storage) needsProduct = true;
      } else if (candidateState.type === 'WAREHOUSE') {
        storage = candidateState.outputStorage.get(productId);
        if (storage && storage.current < storage.capacity) needsProduct = true;
      }

      if (!needsProduct || !storage) continue;

      // Score: how much space they have (deficit from ideal)
      const deficit = storage.ideal - storage.current;
      if (deficit <= 0) continue;

      // Higher deficit = higher priority
      const score = deficit / storage.capacity;
      if (score > bestScore) {
        bestScore = score;
        bestBuyer = { state: candidateState, storage };
      }
    }

    return bestBuyer;
  }

  /**
   * Create an active trader to transport goods.
   * @param {number} fuelRequired - amount of fuel needed for this trip
   */
  _createTrader(sourceState, destState, productId, path, fuelRequired = 0) {
    // Withdraw goods from source
    const outputStorage = sourceState.outputStorage.get(productId);
    if (!outputStorage || outputStorage.current < 1) return;

    // Consume fuel from source
    const fuelProductId = this.economyManager.getFuelProductId();
    let fuelStorage = null;
    if (fuelProductId !== null && fuelRequired > 0) {
      // Try output storage first, then input storage
      fuelStorage = sourceState.outputStorage.get(fuelProductId) ||
                    sourceState.inputStorage.get(fuelProductId);
      if (!fuelStorage || fuelStorage.current < fuelRequired) {
        return; // Not enough fuel, abort trade
      }
    }

    // When product IS the fuel, both deductions come from the same storage.
    // Reserve fuel first, then compute trade amount from what remains.
    let available = outputStorage.current;
    if (fuelStorage === outputStorage && fuelRequired > 0) {
      available -= fuelRequired;
      if (available < 1) return;
    }

    const amount = Math.min(Math.floor(available), 5); // Max 5 units per trip
    if (amount <= 0) return;

    if (fuelStorage && fuelRequired > 0) {
      fuelStorage.current -= fuelRequired;
    }
    outputStorage.current -= amount;

    const trader = {
      id: this.nextTraderId++,
      productId,
      amount,
      sourceObjectId: sourceState.objectId,
      destObjectId: destState.objectId,
      path,           // array of {gridX, gridZ}
      pathIndex: 0,   // current tile in path
      progress: 0,    // 0-1 progress within current segment
      speed: 0.5      // tiles per tick
    };

    this.activeTraders.push(trader);
  }

  // --- Phase 3: Transport ---

  _runTransport() {
    const completed = [];

    for (const trader of this.activeTraders) {
      // Advance along path
      trader.progress += trader.speed;

      while (trader.progress >= 1.0 && trader.pathIndex < trader.path.length - 1) {
        trader.progress -= 1.0;
        trader.pathIndex++;
      }

      // Check if arrived at destination
      if (trader.pathIndex >= trader.path.length - 1) {
        // Deliver goods
        const destState = this.actorStates.get(trader.destObjectId);
        if (destState) {
          // Try input storage first (for producers), then output storage (for warehouses)
          let targetStorage = destState.inputStorage.get(trader.productId);
          if (!targetStorage) {
            targetStorage = destState.outputStorage.get(trader.productId);
          }

          if (targetStorage) {
            targetStorage.current = Math.min(
              targetStorage.current + trader.amount,
              targetStorage.capacity
            );
          }
        }
        completed.push(trader.id);
      }
    }

    // Remove completed traders
    this.activeTraders = this.activeTraders.filter(t => !completed.includes(t.id));
  }

  // --- Phase 4: Pricing ---

  /**
   * Compute market-average sell prices per product across all actors with stock.
   * @returns {Map<number, number>} productId → average sell price
   */
  _computeMarketPrices() {
    const sums = new Map();  // productId → { total, count }
    for (const state of this.actorStates.values()) {
      for (const [productId, storage] of state.outputStorage) {
        if (storage.current > 0) {
          const price = state.getSellPrice(productId);
          const entry = sums.get(productId);
          if (entry) {
            entry.total += price;
            entry.count++;
          } else {
            sums.set(productId, { total: price, count: 1 });
          }
        }
      }
    }
    const marketPrices = new Map();
    for (const [productId, { total, count }] of sums) {
      marketPrices.set(productId, total / count);
    }
    return marketPrices;
  }

  _updateAllPrices() {
    const marketPrices = this._computeMarketPrices();
    for (const state of this.actorStates.values()) {
      state.updatePrices(marketPrices);
    }
  }

  // --- Public API ---

  getActorState(objectId) {
    return this.actorStates.get(objectId);
  }

  getAllActorStates() {
    return Array.from(this.actorStates.values());
  }

  getActiveTraders() {
    return this.activeTraders;
  }

  /**
   * Get the world position for a trader (interpolated along its path).
   */
  getTraderWorldPosition(trader) {
    const current = trader.path[trader.pathIndex];
    const next = trader.path[Math.min(trader.pathIndex + 1, trader.path.length - 1)];

    const currentWorld = gridToWorld(current.gridX, current.gridZ, this.tilemap);
    const nextWorld = gridToWorld(next.gridX, next.gridZ, this.tilemap);

    const t = Math.min(trader.progress, 1.0);
    return {
      x: currentWorld.x + (nextWorld.x - currentWorld.x) * t,
      z: currentWorld.z + (nextWorld.z - currentWorld.z) * t
    };
  }

  // --- Serialization ---

  serialize() {
    return {
      version: 1,
      isRunning: this._running,
      tickCount: this.tickCount,
      speed: this.speed,
      nextTraderId: this.nextTraderId,
      actorStates: Array.from(this.actorStates.values()).map(s => s.serialize()),
      activeTraders: this.activeTraders.map(t => ({
        id: t.id,
        productId: t.productId,
        amount: t.amount,
        sourceObjectId: t.sourceObjectId,
        destObjectId: t.destObjectId,
        path: t.path,
        pathIndex: t.pathIndex,
        progress: t.progress,
        speed: t.speed
      }))
    };
  }

  loadFromData(data) {
    if (!data) return;

    this.tickCount = data.tickCount ?? 0;
    this.speed = data.speed ?? 1.0;
    this.nextTraderId = data.nextTraderId ?? 0;

    // Restore actor states
    this.actorStates.clear();
    if (data.actorStates) {
      for (const stateData of data.actorStates) {
        const state = ActorState.deserialize(stateData);
        this.actorStates.set(state.objectId, state);
      }
    }

    // Restore active traders
    this.activeTraders = data.activeTraders ?? [];

    // Recover missing recipes from economy for old saves
    for (const state of this.actorStates.values()) {
      if (state.type === 'PRODUCER' && state.recipe.length === 0 && state.productId !== null) {
        const node = this.economyManager.getNode(state.productId);
        if (node && node.inputs.length > 0) {
          state.recipe = node.inputs.map(inp => ({ productId: inp.productId, amount: inp.amount }));
        }
      }
    }

    // Recompute road tiles
    this.roadTiles = computeRoadTiles(this.routeManager, this.tilemap);

    // Restore running state
    if (data.isRunning) {
      this._running = true;
      this._lastTickTime = performance.now();
    }
  }
}
