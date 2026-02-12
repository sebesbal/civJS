// ActorState - data model for factory/warehouse simulation state

const DEFAULT_IDEAL_RANGE_SIZE = 3;

export class ActorState {
  /**
   * @param {number} objectId - map object ID
   * @param {'PRODUCER'|'WAREHOUSE'} type
   * @param {number|null} productId - the product this factory produces (null for warehouses)
   */
  constructor(objectId, type, productId = null) {
    this.objectId = objectId;
    this.type = type;
    this.productId = productId;

    // Storage: Map<productId, { current, capacity, idealMin, idealMax }>
    this.inputStorage = new Map();
    this.outputStorage = new Map();

    // Production state
    this.productionRate = 1.0;      // units per tick (base)
    this.productionProgress = 0.0;  // 0-1 progress toward next unit
    this.isProducing = false;
    this.status = 'idle';           // 'idle' | 'producing' | 'output_full' | 'output_surplus' | 'missing_inputs'

    // Recipe: array of {productId, amount} — populated for processors
    this.recipe = [];

    // Production counter (useful for sinks where output disappears)
    this.totalProduced = 0;

    // Pricing
    this.profitMargin = 0.05;       // default 5%
    this.prices = new Map();        // Map<productId, number> — integer prices
    this.minInputPrices = new Map(); // Map<productId, number> — cheapest source price + transport
  }

  /**
   * Initialize storage for a producer (factory).
   * Creates input slots for each recipe input, and one output slot for the produced product.
   */
  initializeProducerStorage(economyManager, inputCapacity = 20, outputCapacity = 20) {
    const node = economyManager.getNode(this.productId);
    if (!node) return;

    // Store recipe for cost-based pricing
    this.recipe = node.inputs.map(inp => ({ productId: inp.productId, amount: inp.amount }));

    // Input storage: one slot per recipe input
    for (const input of node.inputs) {
      this.inputStorage.set(input.productId, {
        current: 0,
        capacity: inputCapacity,
        idealMin: 0,
        idealMax: DEFAULT_IDEAL_RANGE_SIZE
      });
    }

    // Output storage: one slot for the produced product
    this.outputStorage.set(this.productId, {
      current: 0,
      capacity: outputCapacity,
      idealMin: 0,
      idealMax: DEFAULT_IDEAL_RANGE_SIZE
    });

    // Add fuel storage if fuel is designated and not already in inputs/outputs
    const fuelProductId = economyManager.getFuelProductId();
    if (fuelProductId !== null && fuelProductId !== this.productId) {
      const hasInInput = this.inputStorage.has(fuelProductId);
      const hasInOutput = this.outputStorage.has(fuelProductId);

      if (!hasInInput && !hasInOutput) {
        // Fuel is consumed by outbound transport, so keep a larger reserve than regular ideal ranges.
        const fuelCapacity = Math.max(40, inputCapacity);
        this.inputStorage.set(fuelProductId, {
          current: 0,
          capacity: fuelCapacity,
          idealMin: 0,
          idealMax: Math.max(DEFAULT_IDEAL_RANGE_SIZE, Math.floor(fuelCapacity * 0.5))
        });
      }
    }

    // Initialize prices for all stored products (start at 1)
    this._initializePrices();
  }

  /**
   * Initialize storage for a warehouse.
   * Creates a storage slot for every product in the economy.
   */
  initializeWarehouseStorage(economyManager, totalCapacity = 100) {
    const nodes = economyManager.getAllNodes();
    const capacityPerProduct = nodes.length > 0 ? totalCapacity / nodes.length : totalCapacity;

    for (const node of nodes) {
      // Warehouses use a single "storage" map — we put everything in outputStorage
      // since warehouses both buy and sell
      this.outputStorage.set(node.id, {
        current: 0,
        capacity: capacityPerProduct,
        ideal: capacityPerProduct * 0.5
      });
    }

    // Warehouses already store all products, so fuel storage is included above

    this._initializePrices();
  }

  /**
   * Check if this actor is a sink (output product not consumed by any other node).
   */
  isSink(economyManager) {
    if (this.type !== 'PRODUCER' || this.productId === null) return false;
    const allNodes = economyManager.getAllNodes();
    // A sink's output is not used as input by any other node
    return !allNodes.some(n =>
      n.id !== this.productId && n.inputs.some(inp => inp.productId === this.productId)
    );
  }

  /**
   * Check if this producer is a raw material (no inputs).
   */
  isRawMaterial() {
    return this.type === 'PRODUCER' && this.inputStorage.size === 0;
  }

  /**
   * Shift the ideal range up or down by 1, keeping range size fixed.
   * @param {Object} storage - storage slot {current, capacity, idealMin, idealMax}
   * @param {'up'|'down'} direction - 'up' shifts toward capacity, 'down' shifts toward 0
   */
  shiftIdealRange(storage, direction) {
    if (!storage || storage.idealMin === undefined) return; // skip warehouse slots
    const rangeSize = storage.idealMax - storage.idealMin;
    if (direction === 'up') {
      // Storage hit empty — shift range up (tolerate more stock)
      if (storage.idealMax < storage.capacity) {
        storage.idealMin += 1;
        storage.idealMax += 1;
      }
    } else if (direction === 'down') {
      // Storage hit full — shift range down (try to sell more aggressively)
      if (storage.idealMin > 0) {
        storage.idealMin -= 1;
        storage.idealMax -= 1;
      }
    }
    // Clamp to valid bounds
    storage.idealMin = Math.max(0, storage.idealMin);
    storage.idealMax = Math.min(storage.capacity, storage.idealMax);
    // Ensure range size is preserved
    if (storage.idealMax - storage.idealMin < rangeSize) {
      if (direction === 'up') {
        storage.idealMin = Math.max(0, storage.idealMax - rangeSize);
      } else {
        storage.idealMax = Math.min(storage.capacity, storage.idealMin + rangeSize);
      }
    }
  }

  /**
   * Initialize all prices to 1 (integer).
   */
  _initializePrices() {
    for (const [productId] of this.outputStorage) {
      this.prices.set(productId, 1);
    }
    for (const [productId] of this.inputStorage) {
      if (!this.prices.has(productId)) {
        this.prices.set(productId, 1);
      }
    }
  }

  /**
   * Adjust the output price for a product based on storage vs ideal range.
   * +1 if storage < idealMin (scarce), -1 if storage > idealMax (surplus).
   * Clamp to priceFloor.
   */
  adjustOutputPrice(productId, priceFloor) {
    const storage = this.outputStorage.get(productId);
    if (!storage) return;

    let price = this.prices.get(productId) ?? 1;

    if (storage.current > storage.idealMax) {
      price -= 1;
    } else if (storage.current < storage.idealMin) {
      price += 1;
    }

    price = Math.max(price, priceFloor);
    this.prices.set(productId, price);
  }

  /**
   * Recalculate all prices. Producers use integer incremental pricing.
   * Warehouses keep the old continuous pricing for now.
   */
  updatePrices() {
    if (this.type === 'WAREHOUSE') {
      this._updateWarehousePrices();
      return;
    }

    // --- Producer pricing ---
    const isProcessor = this.recipe.length > 0;

    // Compute price floor from recipe inputs + profit margin
    let priceFloor = 1;
    if (isProcessor) {
      let cost = 0;
      for (const inp of this.recipe) {
        const minPrice = this.minInputPrices.get(inp.productId) ?? 1;
        cost += inp.amount * minPrice;
      }
      priceFloor = Math.ceil(cost * (1 + this.profitMargin));
      priceFloor = Math.max(priceFloor, 1);
    }

    // Adjust output price
    for (const [productId] of this.outputStorage) {
      this.adjustOutputPrice(productId, priceFloor);
    }

    // Input prices: for each input, set buy price = current output sell price of that input
    // (producers set a buy willingness but trades don't check buy price anymore)
    for (const [productId, storage] of this.inputStorage) {
      let price = this.prices.get(productId) ?? 1;
      // Scarce inputs → raise willingness, surplus → lower
      if (storage.idealMax !== undefined) {
        if (storage.current < storage.idealMin) {
          price += 1;
        } else if (storage.current > storage.idealMax) {
          price -= 1;
        }
      }
      price = Math.max(price, 1);
      this.prices.set(productId, price);
    }
  }

  /**
   * Warehouse pricing — keeps old continuous curve (warehouses excluded from this change).
   */
  _updateWarehousePrices() {
    for (const [productId, storage] of this.outputStorage) {
      if (storage.capacity <= 0) {
        this.prices.set(productId, 1);
        continue;
      }
      const fillRatio = storage.current / storage.capacity;
      const idealRatio = (storage.ideal ?? storage.capacity * 0.5) / storage.capacity;
      let price;
      if (fillRatio >= idealRatio) {
        const denom = 1.0 - idealRatio;
        const t = denom > 0 ? Math.min((fillRatio - idealRatio) / denom, 1.0) : 0;
        price = 1.0 * (1.0 - 0.75 * t);
      } else {
        const t = idealRatio > 0 ? Math.min((idealRatio - fillRatio) / idealRatio, 1.0) : 0;
        price = 1.0 * (1.0 + 4.0 * t);
      }
      this.prices.set(productId, Math.max(price, 1));
    }
  }

  /**
   * Get the sell price for a product (from output storage).
   */
  getSellPrice(productId) {
    return this.prices.get(productId) ?? 1;
  }

  /**
   * Get the buy price for a product (from input storage).
   */
  getBuyPrice(productId) {
    return this.prices.get(productId) ?? 1;
  }

  // --- Serialization ---

  serialize() {
    return {
      objectId: this.objectId,
      type: this.type,
      productId: this.productId,
      inputStorage: this._serializeStorageMap(this.inputStorage),
      outputStorage: this._serializeStorageMap(this.outputStorage),
      productionRate: this.productionRate,
      productionProgress: this.productionProgress,
      isProducing: this.isProducing,
      status: this.status,
      profitMargin: this.profitMargin,
      recipe: this.recipe,
      prices: Array.from(this.prices.entries())
    };
  }

  static deserialize(data) {
    const state = new ActorState(data.objectId, data.type, data.productId);
    state.inputStorage = ActorState._deserializeStorageMap(data.inputStorage);
    state.outputStorage = ActorState._deserializeStorageMap(data.outputStorage);
    state.productionRate = data.productionRate ?? 1.0;
    state.productionProgress = data.productionProgress ?? 0.0;
    state.isProducing = data.isProducing ?? false;
    state.status = data.status ?? 'idle';
    state.profitMargin = data.profitMargin ?? 0.05;
    state.recipe = data.recipe ?? [];

    // Restore prices
    if (data.prices && Array.isArray(data.prices)) {
      state.prices = new Map(data.prices);
    } else {
      state._initializePrices();
    }

    return state;
  }

  _serializeStorageMap(map) {
    const entries = [];
    for (const [productId, storage] of map) {
      const entry = {
        productId,
        current: storage.current,
        capacity: storage.capacity
      };
      // Producer slots have idealMin/idealMax, warehouse slots have ideal
      if (storage.idealMin !== undefined) {
        entry.idealMin = storage.idealMin;
        entry.idealMax = storage.idealMax;
      } else {
        entry.ideal = storage.ideal;
      }
      entries.push(entry);
    }
    return entries;
  }

  static _deserializeStorageMap(entries) {
    const map = new Map();
    if (entries && Array.isArray(entries)) {
      for (const entry of entries) {
        const slot = {
          current: entry.current,
          capacity: entry.capacity
        };
        // Migrate old format: single `ideal` → idealMin/idealMax
        if (entry.idealMin !== undefined) {
          slot.idealMin = entry.idealMin;
          slot.idealMax = entry.idealMax;
        } else if (entry.ideal !== undefined) {
          // Old save format — migrate
          slot.idealMin = 0;
          slot.idealMax = Math.min(entry.ideal, entry.capacity);
        } else {
          slot.idealMin = 0;
          slot.idealMax = DEFAULT_IDEAL_RANGE_SIZE;
        }
        map.set(entry.productId, slot);
      }
    }
    return map;
  }
}
