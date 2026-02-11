// ActorState - data model for factory/warehouse simulation state

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

    // Storage: Map<productId, { current, capacity, ideal }>
    this.inputStorage = new Map();
    this.outputStorage = new Map();

    // Production state
    this.productionRate = 1.0;      // units per tick (base)
    this.productionProgress = 0.0;  // 0-1 progress toward next unit
    this.isProducing = false;
    this.status = 'idle';           // 'idle' | 'producing' | 'output_full' | 'missing_inputs'

    // Recipe: array of {productId, amount} — populated for processors
    this.recipe = [];

    // Pricing
    this.basePrice = 1.0;
    this.prices = new Map(); // Map<productId, number>
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
        ideal: inputCapacity * 0.5
      });
    }

    // Output storage: one slot for the produced product
    this.outputStorage.set(this.productId, {
      current: 0,
      capacity: outputCapacity,
      ideal: outputCapacity * 0.5
    });

    // Add fuel storage if fuel is designated and not already in inputs/outputs
    const fuelProductId = economyManager.getFuelProductId();
    if (fuelProductId !== null && fuelProductId !== this.productId) {
      const hasInInput = this.inputStorage.has(fuelProductId);
      const hasInOutput = this.outputStorage.has(fuelProductId);

      if (!hasInInput && !hasInOutput) {
        // Add fuel to input storage with smaller capacity (since it's consumed for transport)
        this.inputStorage.set(fuelProductId, {
          current: 0,
          capacity: 10, // Smaller capacity for fuel
          ideal: 5
        });
      }
    }

    // Initialize prices for all stored products
    this._recalculatePrices();
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

    this._recalculatePrices();
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
   * Calculate the price for a product based on storage fill level.
   * Above ideal → price drops to 25% of base. Below ideal → price rises up to 5x base (no hard cap).
   * Floor: 1
   */
  static calculatePrice(basePrice, current, capacity, ideal) {
    if (capacity <= 0) return Math.max(basePrice, 1);
    const fillRatio = current / capacity;
    const idealRatio = ideal / capacity;

    let price;
    if (fillRatio >= idealRatio) {
      // Above ideal: price drops to 25% of base
      const denom = 1.0 - idealRatio;
      const t = denom > 0 ? Math.min((fillRatio - idealRatio) / denom, 1.0) : 0;
      price = basePrice * (1.0 - 0.75 * t);
    } else {
      // Below ideal: price rises up to 5x base
      const t = idealRatio > 0 ? Math.min((idealRatio - fillRatio) / idealRatio, 1.0) : 0;
      price = basePrice * (1.0 + 4.0 * t);
    }
    return Math.max(price, 1);
  }

  /**
   * Recalculate all prices based on current storage levels and market prices.
   * Processors derive output base price from input costs (20% markup).
   * @param {Map<number, number>} [marketPrices] - average sell prices per product across all actors
   */
  _recalculatePrices(marketPrices) {
    const isProcessor = this.recipe.length > 0;
    const recipeInputIds = new Set(this.recipe.map(r => r.productId));

    // Determine output base price
    let outputBase = this.basePrice;
    if (isProcessor && marketPrices) {
      // Cost = sum of (recipe input amount * market price of that input)
      let cost = 0;
      for (const inp of this.recipe) {
        cost += inp.amount * (marketPrices.get(inp.productId) ?? 1);
      }
      outputBase = Math.max(cost * 1.2, 1); // 20% markup, floor 1
    }

    // Price for output products (sell price)
    for (const [productId, storage] of this.outputStorage) {
      this.prices.set(productId, ActorState.calculatePrice(
        outputBase, storage.current, storage.capacity, storage.ideal
      ));
    }

    // Price for input products (buy price)
    for (const [productId, storage] of this.inputStorage) {
      let inputBase = this.basePrice;
      if (isProcessor && marketPrices && recipeInputIds.has(productId)) {
        // Use market price as buy base for recipe inputs
        inputBase = marketPrices.get(productId) ?? this.basePrice;
      }
      this.prices.set(productId, ActorState.calculatePrice(
        inputBase, storage.current, storage.capacity, storage.ideal
      ));
    }
  }

  /**
   * Get the sell price for a product (from output storage).
   */
  getSellPrice(productId) {
    return this.prices.get(productId) ?? 1;
  }

  /**
   * Get the buy price for a product (from input storage — inverse logic: low stock = high willingness to pay).
   */
  getBuyPrice(productId) {
    return this.prices.get(productId) ?? 1;
  }

  /**
   * Recalculate all prices. Call this after storage changes.
   * @param {Map<number, number>} [marketPrices] - average sell prices per product
   */
  updatePrices(marketPrices) {
    this._recalculatePrices(marketPrices);
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
      basePrice: this.basePrice,
      recipe: this.recipe
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
    state.basePrice = 1.0;
    state.recipe = data.recipe ?? [];
    state._recalculatePrices();
    return state;
  }

  _serializeStorageMap(map) {
    const entries = [];
    for (const [productId, storage] of map) {
      entries.push({
        productId,
        current: storage.current,
        capacity: storage.capacity,
        ideal: storage.ideal
      });
    }
    return entries;
  }

  static _deserializeStorageMap(entries) {
    const map = new Map();
    if (entries && Array.isArray(entries)) {
      for (const entry of entries) {
        map.set(entry.productId, {
          current: entry.current,
          capacity: entry.capacity,
          ideal: entry.ideal
        });
      }
    }
    return map;
  }
}
