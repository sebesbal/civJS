// FactoryOverviewAggregator - groups ActorStates by productId and computes per-type stats

export class FactoryOverviewAggregator {
  constructor() {
    // Map<productId, stats>
    this.stats = new Map();
  }

  /**
   * Aggregate simulation data grouped by product type.
   * @param {SimulationEngine} simulationEngine
   * @param {EconomyManager} economyManager
   */
  aggregate(simulationEngine, economyManager) {
    this.stats.clear();

    if (!simulationEngine || !economyManager) return;

    const grouped = this._groupProducerStates(simulationEngine.getAllActorStates());

    // Compute stats per product type
    for (const [productId, states] of grouped) {
      const node = economyManager.getNode(productId);
      if (!node) continue;

      this.stats.set(
        productId,
        this._buildProductStats(states, productId, node, simulationEngine, economyManager)
      );
    }
  }

  _groupProducerStates(allStates) {
    const grouped = new Map();

    for (const state of allStates) {
      if (state.type !== 'PRODUCER' || state.productId === null) continue;
      if (!grouped.has(state.productId)) {
        grouped.set(state.productId, []);
      }
      grouped.get(state.productId).push(state);
    }

    return grouped;
  }

  _buildProductStats(states, productId, node, simulationEngine, economyManager) {
    const count = states.length;
    const { avgInputFillPct, inputDetails } = this._calculateInputMetrics(states, node, economyManager);
    const { transportCount, avgRouteLength, avgTransportCost, avgFuelCost } =
      this._calculateTransportMetrics(simulationEngine, productId);

    return {
      factoryCount: count,
      avgInputFillPct,
      avgOutputFillPct: this._calculateOutputFill(states, productId, count),
      avgSellPrice: this._calculateAverage(states, (state) => state.getSellPrice(productId)),
      avgUptimePct: this._calculateAverage(states, (state) => (
        state.observedTicks > 0 ? (state.producingTicks / state.observedTicks) : 0
      )),
      transportCount,
      avgRouteLength,
      avgTransportCost,
      avgFuelCost,
      statusCounts: this._calculateStatusCounts(states, productId),
      inputDetails
    };
  }

  _calculateStatusCounts(states, productId) {
    const statusCounts = {
      producing: 0,
      idle: 0,
      output_full: 0,
      output_surplus: 0,
      missing_inputs: 0
    };

    for (const state of states) {
      const output = state.outputStorage.get(productId);
      if (output && output.capacity > 0) {
        if (output.current >= output.capacity) {
          statusCounts.output_full++;
          continue;
        }
        if (output.idealMax !== undefined && output.current > output.idealMax) {
          statusCounts.output_surplus++;
          continue;
        }
      }

      if (state.status === 'producing') {
        statusCounts.producing++;
      } else if (state.status === 'missing_inputs') {
        statusCounts.missing_inputs++;
      } else {
        statusCounts.idle++;
      }
    }

    return statusCounts;
  }

  _calculateOutputFill(states, productId, count) {
    let totalOutputFill = 0;

    for (const state of states) {
      const output = state.outputStorage.get(productId);
      if (output && output.capacity > 0) {
        totalOutputFill += output.current / output.capacity;
      }
    }

    return count > 0 ? totalOutputFill / count : 0;
  }

  _calculateInputMetrics(states, node, economyManager) {
    let totalInputFill = 0;
    let inputSlotCount = 0;
    const inputDetails = new Map();

    for (const input of node.inputs) {
      let inputTotal = 0;

      for (const state of states) {
        const inputStorage = state.inputStorage.get(input.productId);
        if (inputStorage && inputStorage.capacity > 0) {
          const fill = inputStorage.current / inputStorage.capacity;
          inputTotal += fill;
          totalInputFill += fill;
          inputSlotCount++;
        }
      }

      const inputNode = economyManager.getNode(input.productId);
      inputDetails.set(input.productId, {
        name: inputNode ? inputNode.name : `Product ${input.productId}`,
        avgFillPct: states.length > 0 ? inputTotal / states.length : 0
      });
    }

    return {
      avgInputFillPct: inputSlotCount > 0 ? totalInputFill / inputSlotCount : 0,
      inputDetails
    };
  }

  _calculateTransportMetrics(simulationEngine, productId) {
    const productTraders = simulationEngine
      .getActiveTraders()
      .filter((trader) => trader.productId === productId);

    let totalRouteLength = 0;
    let totalFuelCost = 0;
    for (const trader of productTraders) {
      const metrics = simulationEngine.getPathMetrics(trader.path);
      totalRouteLength += metrics.routeLength;
      totalFuelCost += metrics.fuelCost;
    }

    const transportCount = productTraders.length;
    const avgRouteLength = transportCount > 0 ? totalRouteLength / transportCount : 0;
    const avgFuelCost = totalRouteLength > 0 ? totalFuelCost / totalRouteLength : 0;

    return {
      transportCount,
      avgRouteLength,
      avgTransportCost: avgFuelCost * avgRouteLength,
      avgFuelCost
    };
  }

  _calculateAverage(items, valueGetter) {
    if (items.length === 0) return 0;

    let total = 0;
    for (const item of items) {
      total += valueGetter(item);
    }
    return total / items.length;
  }

  /**
   * @returns {Map<productId, { factoryCount, avgInputFillPct, avgOutputFillPct, avgSellPrice, transportCount, avgRouteLength, avgTransportCost, avgFuelCost, statusCounts, inputDetails }>}
   */
  getStats() {
    return this.stats;
  }
}
