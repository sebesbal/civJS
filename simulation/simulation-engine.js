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
    this.contracts = [];
    this.nextContractId = 0;

    // Simulation control
    this._running = false;
    this.speed = 1.0;             // multiplier
    this.tickCount = 0;
    this.tickInterval = 1000;     // ms per tick at 1x speed
    this._lastTickTime = 0;

    // Cached road tiles (recomputed on initialize)
    this.roadTiles = new Set();

    // Path cache: Map<"fromId-toId", path|null>
    this._pathCache = new Map();

    // Callback
    this.onTick = null;

    // Trade evaluation interval (not every tick to save CPU)
    this._tradeEvalCounter = 0;
    this._tradeEvalInterval = 1; // evaluate trades every tick for steadier replenishment
    this.maxContractsPerActor = 10;
    this.maxConcurrentTradersPerContract = 3;
    this.contractReplacementMargin = 1.25; // replacement requires meaningfully better score
    this.minContractLifetimeTicks = 25; // avoid rapid churn right after creation

    // Cost model constants
    this.transportCostRoad = 0.3;
    this.transportCostOffRoad = 1.0;
    this.fuelCostRoad = 0.03;
    this.fuelCostOffRoad = 0.1;
  }

  /**
   * Initialize actor states for all placed map objects.
   * Call this before starting the simulation.
   */
  initialize() {
    this.actorStates.clear();
    this.activeTraders = [];
    this.nextTraderId = 0;
    this.contracts = [];
    this.nextContractId = 0;
    this.tickCount = 0;
    this._pathCache.clear();

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
      this._computeMinInputPrices();
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

      // Check if output storage is at capacity (unless sink — output disappears)
      if (!isSink && outputStorage && outputStorage.current >= outputStorage.capacity) {
        state.isProducing = false;
        state.status = 'output_full';
        continue;
      }

      // Keep producing until true capacity; ideal range affects pricing/trading, not hard stop.

      if (isRawMaterial) {
        // Raw materials always produce
        state.isProducing = true;
        state.status = 'producing';
        state.productionProgress += state.productionRate;

        if (state.productionProgress >= 1.0) {
          state.productionProgress -= 1.0;
          state.totalProduced++;
          if (!isSink && outputStorage) {
            outputStorage.current = Math.min(
              outputStorage.current + 1,
              outputStorage.capacity
            );
            // If we hit capacity, shift ideal range down
            if (outputStorage.current >= outputStorage.capacity && outputStorage.idealMin !== undefined) {
              state.shiftIdealRange(outputStorage, 'down');
            }
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
            // If input hits 0, shift ideal range up
            if (inputStorage.current <= 0 && inputStorage.idealMin !== undefined) {
              state.shiftIdealRange(inputStorage, 'up');
            }
          }

          state.productionProgress += state.productionRate;

          if (state.productionProgress >= 1.0) {
            state.productionProgress -= 1.0;
            state.totalProduced++;
            if (!isSink && outputStorage) {
              outputStorage.current = Math.min(
                outputStorage.current + 1,
                outputStorage.capacity
              );
              // If we hit capacity, shift ideal range down
              if (outputStorage.current >= outputStorage.capacity && outputStorage.idealMin !== undefined) {
                state.shiftIdealRange(outputStorage, 'down');
              }
            }
          }
        } else {
          state.isProducing = false;
          state.status = 'missing_inputs';
        }
      }
    }
  }

  // --- Min Input Prices ---

  /**
   * For each producer, find the cheapest seller of each input product
   * (seller's sell price + transport cost). Uses path cache.
   */
  _computeMinInputPrices() {
    for (const buyerState of this.actorStates.values()) {
      if (buyerState.type !== 'PRODUCER') continue;
      buyerState.minInputPrices.clear();

      for (const [inputProductId] of buyerState.inputStorage) {
        let cheapest = Infinity;

        for (const sellerState of this.actorStates.values()) {
          if (sellerState.objectId === buyerState.objectId) continue;
          const sellerOutput = sellerState.outputStorage.get(inputProductId);
          if (!sellerOutput || sellerOutput.current <= 0) continue;

          const sellPrice = sellerState.getSellPrice(inputProductId);
          const transportCost = this._getTransportCost(sellerState.objectId, buyerState.objectId);
          if (transportCost === null) continue; // no path

          const totalCost = sellPrice + transportCost;
          if (totalCost < cheapest) {
            cheapest = totalCost;
          }
        }

        if (cheapest < Infinity) {
          buyerState.minInputPrices.set(inputProductId, cheapest);
        }
      }
    }
  }

  /**
   * Get transport cost between two objects (uses path cache).
   * @returns {number|null} fuel cost, or null if no path
   */
  _getTransportCost(fromObjectId, toObjectId) {
    const cacheKey = `${fromObjectId}-${toObjectId}`;
    let path;

    if (this._pathCache.has(cacheKey)) {
      path = this._pathCache.get(cacheKey);
    } else {
      const fromObj = this.objectManager.getObjectById(fromObjectId);
      const toObj = this.objectManager.getObjectById(toObjectId);
      if (!fromObj || !toObj) {
        this._pathCache.set(cacheKey, null);
        return null;
      }

      const fromGrid = worldToGrid(fromObj.mesh.position.x, fromObj.mesh.position.z, this.tilemap);
      const toGrid = worldToGrid(toObj.mesh.position.x, toObj.mesh.position.z, this.tilemap);
      path = findPath(this.tilemap, fromGrid, toGrid, this.roadTiles);
      this._pathCache.set(cacheKey, path);
    }

    if (!path || path.length < 2) return null;

    return this._computePathFuelCost(path);
  }

  // --- Phase 2: Trade Evaluation ---

  _evaluateTradeOpportunities() {
    this._maintainContracts();
    this._discoverContracts();
    this._executeContracts();
  }

  _maintainContracts() {
    const removedIds = new Set();

    for (const contract of this.contracts) {
      const sourceState = this.actorStates.get(contract.sourceObjectId);
      const destState = this.actorStates.get(contract.destObjectId);
      if (!sourceState || !destState) {
        removedIds.add(contract.id);
        continue;
      }

      const sourceStorage = sourceState.outputStorage.get(contract.productId);
      const destStorage = this._getDestinationStorageForProduct(destState, contract.productId);
      if (!sourceStorage || !destStorage) {
        removedIds.add(contract.id);
        continue;
      }
      // Contract stays active until one actor cancels it due to storage/pricing rules.
      if (this._sourceCancelsContract(sourceState, contract)) {
        removedIds.add(contract.id);
        continue;
      }
      if (this._destinationCancelsContract(destState, contract.productId)) {
        removedIds.add(contract.id);
        continue;
      }

      const buyer = this._findBestBuyer(sourceState, contract.productId);
      if (buyer && buyer.state.objectId === contract.destObjectId) {
        contract.score = buyer.score;
      }
    }

    if (removedIds.size > 0) {
      this.contracts = this.contracts.filter(contract => !removedIds.has(contract.id));
    }
  }

  _discoverContracts() {
    for (const sourceState of this.actorStates.values()) {
      for (const [productId, outputStorage] of sourceState.outputStorage) {
        if (outputStorage.current < 1) continue;

        const buyer = this._findBestBuyer(sourceState, productId);
        if (!buyer) continue;

        const existing = this._getContract(sourceState.objectId, buyer.state.objectId, productId);
        if (existing) {
          existing.score = buyer.score;
          continue;
        }

        const amountPerShipment = Math.max(1, Math.floor(outputStorage.capacity / this.maxContractsPerActor));
        const candidate = {
          sourceObjectId: sourceState.objectId,
          destObjectId: buyer.state.objectId,
          productId,
          amountPerShipment,
          unitPrice: Math.ceil(sourceState.getSellPrice(productId)),
          score: buyer.score
        };

        this._addOrReplaceContract(candidate);
      }
    }
  }

  _executeContracts() {
    const maxActiveTraders = Math.max(50, this.actorStates.size * 4);

    for (const contract of this.contracts) {
      if (this.activeTraders.length >= maxActiveTraders) return;

      const concurrent = this.activeTraders.filter(t => t.contractId === contract.id).length;
      if (concurrent >= this.maxConcurrentTradersPerContract) continue;

      const sourceState = this.actorStates.get(contract.sourceObjectId);
      const destState = this.actorStates.get(contract.destObjectId);
      if (!sourceState || !destState) {
        continue;
      }

      const sourceStorage = sourceState.outputStorage.get(contract.productId);
      const destStorage = this._getDestinationStorageForProduct(destState, contract.productId);
      if (!sourceStorage || !destStorage) {
        continue;
      }
      // Temporary stock/capacity limits are normal in contract systems.
      // Do not count them as failures; keep contract alive and retry later.
      if (sourceStorage.current < 1) continue;
      if (destStorage.current >= destStorage.capacity) continue;

      const freeCapacity = Math.floor(destStorage.capacity - destStorage.current);
      const shipmentAmount = Math.max(1, Math.min(contract.amountPerShipment, freeCapacity));
      if (sourceStorage.current < shipmentAmount) continue;

      if (shipmentAmount < 1) {
        continue;
      }

      const path = this._getPathBetweenObjects(contract.sourceObjectId, contract.destObjectId);
      if (!path || path.length < 2) {
        continue;
      }

      const fuelRequired = this._computePathFuelCost(path);
      const created = this._createTrader(
        sourceState,
        destState,
        contract.productId,
        path,
        fuelRequired,
        shipmentAmount,
        contract.id
      );
      if (!created) continue;
    }
  }

  _addOrReplaceContract(candidate) {
    const sourceCount = this._countActorContracts(candidate.sourceObjectId);
    const destCount = this._countActorContracts(candidate.destObjectId);
    const sourceHasSpace = sourceCount < this.maxContractsPerActor;
    const destHasSpace = destCount < this.maxContractsPerActor;

    if (sourceHasSpace && destHasSpace) {
      this._createContract(candidate);
      return;
    }

    const replacementPool = this.contracts.filter(contract => {
      if (!sourceHasSpace && this._contractInvolvesActor(contract, candidate.sourceObjectId)) return true;
      if (!destHasSpace && this._contractInvolvesActor(contract, candidate.destObjectId)) return true;
      return false;
    });

    if (replacementPool.length === 0) return;

    let worst = replacementPool[0];
    for (const contract of replacementPool) {
      if (contract.score < worst.score) worst = contract;
    }

    // Do not churn very fresh contracts; let flows stabilize first.
    if (this.tickCount - (worst.createdTick ?? 0) < this.minContractLifetimeTicks) return;
    // Require a strong improvement before replacing.
    if (candidate.score <= worst.score * this.contractReplacementMargin) return;

    this.contracts = this.contracts.filter(contract => contract.id !== worst.id);
    this._createContract(candidate);
  }

  _createContract(candidate) {
    this.contracts.push({
      id: this.nextContractId++,
      sourceObjectId: candidate.sourceObjectId,
      destObjectId: candidate.destObjectId,
      productId: candidate.productId,
      amountPerShipment: candidate.amountPerShipment,
      unitPrice: candidate.unitPrice,
      score: candidate.score,
      createdTick: this.tickCount
    });
  }

  _countActorContracts(objectId) {
    let count = 0;
    for (const contract of this.contracts) {
      if (contract.sourceObjectId === objectId || contract.destObjectId === objectId) {
        count++;
      }
    }
    return count;
  }

  _contractInvolvesActor(contract, objectId) {
    return contract.sourceObjectId === objectId || contract.destObjectId === objectId;
  }

  _getContract(sourceObjectId, destObjectId, productId) {
    return this.contracts.find(contract =>
      contract.sourceObjectId === sourceObjectId &&
      contract.destObjectId === destObjectId &&
      contract.productId === productId
    );
  }

  _getDestinationStorageForProduct(destState, productId) {
    let storage = destState.inputStorage.get(productId);
    if (!storage) storage = destState.outputStorage.get(productId);
    return storage;
  }

  _getPathBetweenObjects(fromObjectId, toObjectId) {
    const cacheKey = `${fromObjectId}-${toObjectId}`;
    if (this._pathCache.has(cacheKey)) {
      return this._pathCache.get(cacheKey);
    }

    const fromObj = this.objectManager.getObjectById(fromObjectId);
    const toObj = this.objectManager.getObjectById(toObjectId);
    if (!fromObj || !toObj) {
      this._pathCache.set(cacheKey, null);
      return null;
    }

    const fromGrid = worldToGrid(fromObj.mesh.position.x, fromObj.mesh.position.z, this.tilemap);
    const toGrid = worldToGrid(toObj.mesh.position.x, toObj.mesh.position.z, this.tilemap);
    const path = findPath(this.tilemap, fromGrid, toGrid, this.roadTiles);
    this._pathCache.set(cacheKey, path);
    return path;
  }

  _sourceCancelsContract(sourceState, contract) {
    const minAllowedPrice = this._getMinimumSellPrice(sourceState, contract.productId);
    // Actor cancels only when fixed contract price violates hard floor-cost rule.
    return contract.unitPrice < minAllowedPrice;
  }

  _destinationCancelsContract(destState, productId) {
    const storage = this._getDestinationStorageForProduct(destState, productId);
    if (!storage) return true;
    // If storage is above ideal, actor should not buy this product.
    return this._isAboveIdeal(storage);
  }

  _isAboveIdeal(storage) {
    if (storage.idealMax !== undefined) {
      return storage.current > storage.idealMax;
    }
    if (storage.ideal !== undefined) {
      return storage.current > storage.ideal;
    }
    return false;
  }

  _getMinimumSellPrice(sourceState, productId) {
    if (sourceState.type !== 'PRODUCER') {
      return 1;
    }

    if (!sourceState.recipe || sourceState.recipe.length === 0) {
      return 1;
    }

    let cost = 0;
    for (const inp of sourceState.recipe) {
      const minInputPrice = sourceState.minInputPrices.get(inp.productId) ?? 1;
      cost += inp.amount * minInputPrice;
    }

    return Math.max(1, Math.ceil(cost * (1 + sourceState.profitMargin)));
  }

  /**
   * Find the best buyer for a product (actor that needs it most).
   */
  _findBestBuyer(sourceState, productId) {
    let bestBuyer = null;
    let bestScore = -Infinity;
    const fuelProductId = this.economyManager.getFuelProductId();
    const sourceFuelStorage = fuelProductId !== null
      ? (sourceState.outputStorage.get(fuelProductId) || sourceState.inputStorage.get(fuelProductId))
      : null;
    const sourceFuelAvailable = sourceFuelStorage ? sourceFuelStorage.current : Infinity;

    for (const candidateState of this.actorStates.values()) {
      if (candidateState.objectId === sourceState.objectId) continue;

      // Check if candidate needs this product as input
      let needsProduct = false;
      let storage = null;

      if (candidateState.type === 'PRODUCER') {
        storage = candidateState.inputStorage.get(productId);
        if (storage) {
          // If above ideal, actor should not buy this product.
          if (this._isAboveIdeal(storage)) continue;
          if (storage.current >= storage.capacity) continue;
          needsProduct = true;
        }
      } else if (candidateState.type === 'WAREHOUSE') {
        storage = candidateState.outputStorage.get(productId);
        if (storage && !this._isAboveIdeal(storage) && storage.current < storage.capacity) needsProduct = true;
      }

      if (!needsProduct || !storage) continue;

      // Candidate must be reachable.
      const transportCost = this._getTransportCost(sourceState.objectId, candidateState.objectId);
      if (transportCost === null) continue;

      // If fuel is enabled, skip destinations this source cannot currently reach.
      if (fuelProductId !== null && sourceFuelAvailable < transportCost) continue;

      // Score: deficit from ideal target gives higher priority to under-stocked buyers.
      let deficit;
      if (storage.idealMax !== undefined) {
        deficit = storage.idealMax - storage.current;
      } else {
        deficit = (storage.ideal ?? storage.capacity) - storage.current;
      }
      if (deficit <= 0) continue;

      // Higher deficit and lower transport cost = higher priority.
      let score = (deficit / storage.capacity) / (1 + transportCost);

      // When allocating fuel product, prioritize buyers that need it as recipe input
      // over those only topping up transport fuel reserves.
      if (candidateState.type === 'PRODUCER' && fuelProductId !== null && productId === fuelProductId) {
        const node = this.economyManager.getNode(candidateState.productId);
        const recipeNeedsFuel = !!node && node.inputs.some(inp => inp.productId === fuelProductId);
        if (!recipeNeedsFuel) {
          score *= 0.2;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestBuyer = { state: candidateState, storage, score };
      }
    }

    return bestBuyer;
  }

  /**
   * Create an active trader to transport goods.
   * @param {number} fuelRequired - amount of fuel needed for this trip
   */
  _createTrader(sourceState, destState, productId, path, fuelRequired = 0, amountOverride = null, contractId = null) {
    // Withdraw goods from source
    const outputStorage = sourceState.outputStorage.get(productId);
    if (!outputStorage || outputStorage.current < 1) return false;

    // Consume fuel from source
    const fuelProductId = this.economyManager.getFuelProductId();
    let fuelStorage = null;
    if (fuelProductId !== null && fuelRequired > 0) {
      // Try output storage first, then input storage
      fuelStorage = sourceState.outputStorage.get(fuelProductId) ||
                    sourceState.inputStorage.get(fuelProductId);
      if (!fuelStorage || fuelStorage.current < fuelRequired) {
        return false; // Not enough fuel, abort trade
      }
    }

    // When product IS the fuel, both deductions come from the same storage.
    // Reserve fuel first, then compute trade amount from what remains.
    let available = outputStorage.current;
    if (fuelStorage === outputStorage && fuelRequired > 0) {
      available -= fuelRequired;
      if (available < 1) return false;
    }

    const requestedAmount = amountOverride === null ? null : Math.floor(amountOverride);
    if (requestedAmount !== null && requestedAmount < 1) return false;
    const amount = requestedAmount === null
      ? Math.min(Math.floor(available), 10) // Max 10 units per trip
      : requestedAmount;
    if (amount <= 0 || available < amount) return false;

    if (fuelStorage && fuelRequired > 0) {
      fuelStorage.current -= fuelRequired;
    }
    outputStorage.current -= amount;

    // Do not shift producer output ideal range up when selling out.
    // Repeated successful sales otherwise ratchet scarcity targets upward permanently.

    const trader = {
      id: this.nextTraderId++,
      productId,
      amount,
      sourceObjectId: sourceState.objectId,
      destObjectId: destState.objectId,
      contractId,
      path,           // array of {gridX, gridZ}
      pathIndex: 0,   // current tile in path
      progress: 0,    // 0-1 progress within current segment
      speed: 1.0      // tiles per tick
    };

    this.activeTraders.push(trader);
    return true;
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
            // If delivery fills to capacity, shift ideal range down
            if (targetStorage.current >= targetStorage.capacity && targetStorage.idealMin !== undefined) {
              destState.shiftIdealRange(targetStorage, 'down');
            }
          }
        }
        completed.push(trader.id);
      }
    }

    // Remove completed traders
    this.activeTraders = this.activeTraders.filter(t => !completed.includes(t.id));
  }

  _computePathFuelCost(path) {
    return this.getPathMetrics(path).fuelCost;
  }

  getPathMetrics(path) {
    let routeLength = 0;
    let transportCost = 0;
    let fuelCost = 0;
    for (const step of path) {
      const isRoad = this.roadTiles.has(`${step.gridX},${step.gridZ}`);
      transportCost += isRoad ? this.transportCostRoad : this.transportCostOffRoad;
      fuelCost += isRoad ? this.fuelCostRoad : this.fuelCostOffRoad;
      routeLength++;
    }
    return { routeLength, transportCost, fuelCost };
  }

  // --- Phase 4: Pricing ---

  _updateAllPrices() {
    for (const state of this.actorStates.values()) {
      state.updatePrices();
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
      version: 3,
      isRunning: this._running,
      tickCount: this.tickCount,
      speed: this.speed,
      nextTraderId: this.nextTraderId,
      nextContractId: this.nextContractId,
      actorStates: Array.from(this.actorStates.values()).map(s => s.serialize()),
      contracts: this.contracts.map(c => ({
        id: c.id,
        sourceObjectId: c.sourceObjectId,
        destObjectId: c.destObjectId,
        productId: c.productId,
        amountPerShipment: c.amountPerShipment,
        unitPrice: c.unitPrice,
        score: c.score,
        createdTick: c.createdTick ?? 0
      })),
      activeTraders: this.activeTraders.map(t => ({
        id: t.id,
        productId: t.productId,
        amount: t.amount,
        sourceObjectId: t.sourceObjectId,
        destObjectId: t.destObjectId,
        contractId: t.contractId ?? null,
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
    this.nextContractId = data.nextContractId ?? 0;

    // Restore actor states
    this.actorStates.clear();
    if (data.actorStates) {
      for (const stateData of data.actorStates) {
        const state = ActorState.deserialize(stateData);
        this.actorStates.set(state.objectId, state);
      }
    }

    // Restore contracts
    this.contracts = data.contracts ?? [];
    for (const contract of this.contracts) {
      if (contract.createdTick === undefined) contract.createdTick = this.tickCount;
    }
    if (!data.nextContractId && this.contracts.length > 0) {
      this.nextContractId = Math.max(...this.contracts.map(c => c.id)) + 1;
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

    // Recompute road tiles and clear path cache
    this.roadTiles = computeRoadTiles(this.routeManager, this.tilemap);
    this._pathCache.clear();

    // Restore running state
    if (data.isRunning) {
      this._running = true;
      this._lastTickTime = performance.now();
    }
  }
}
