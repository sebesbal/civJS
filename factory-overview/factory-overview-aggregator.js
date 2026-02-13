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

    const allStates = simulationEngine.getAllActorStates();

    // Group producer states by productId
    const grouped = new Map();
    for (const state of allStates) {
      if (state.type !== 'PRODUCER' || state.productId === null) continue;
      if (!grouped.has(state.productId)) {
        grouped.set(state.productId, []);
      }
      grouped.get(state.productId).push(state);
    }

    // Compute stats per product type
    for (const [productId, states] of grouped) {
      const node = economyManager.getNode(productId);
      if (!node) continue;

      const count = states.length;

      // Status counts
      const statusCounts = { producing: 0, idle: 0, output_full: 0, output_surplus: 0, missing_inputs: 0 };
      for (const s of states) {
        const out = s.outputStorage.get(productId);
        if (out && out.capacity > 0) {
          if (out.current >= out.capacity) {
            statusCounts.output_full++;
            continue;
          }
          if (out.idealMax !== undefined && out.current > out.idealMax) {
            statusCounts.output_surplus++;
            continue;
          }
        }

        if (s.status === 'producing') {
          statusCounts.producing++;
        } else if (s.status === 'missing_inputs') {
          statusCounts.missing_inputs++;
        } else {
          statusCounts.idle++;
        }
      }

      // Average output fill percentage
      let totalOutputFill = 0;
      for (const s of states) {
        const out = s.outputStorage.get(productId);
        if (out && out.capacity > 0) {
          totalOutputFill += out.current / out.capacity;
        }
      }
      const avgOutputFillPct = count > 0 ? totalOutputFill / count : 0;

      // Average input fill percentage (across all input types)
      let totalInputFill = 0;
      let inputSlotCount = 0;
      const inputDetails = new Map();

      for (const input of node.inputs) {
        let inputTotal = 0;
        for (const s of states) {
          const inp = s.inputStorage.get(input.productId);
          if (inp && inp.capacity > 0) {
            const fill = inp.current / inp.capacity;
            inputTotal += fill;
            totalInputFill += fill;
            inputSlotCount++;
          }
        }
        const inputNode = economyManager.getNode(input.productId);
        inputDetails.set(input.productId, {
          name: inputNode ? inputNode.name : `Product ${input.productId}`,
          avgFillPct: count > 0 ? inputTotal / count : 0
        });
      }
      const avgInputFillPct = inputSlotCount > 0 ? totalInputFill / inputSlotCount : 0;

      // Average sell price
      let totalSellPrice = 0;
      for (const s of states) {
        totalSellPrice += s.getSellPrice(productId);
      }
      const avgSellPrice = count > 0 ? totalSellPrice / count : 0;

      // Historical uptime (producing ticks / observed ticks) averaged by factory
      let totalUptimePct = 0;
      for (const s of states) {
        const uptime = s.observedTicks > 0 ? (s.producingTicks / s.observedTicks) : 0;
        totalUptimePct += uptime;
      }
      const avgUptimePct = count > 0 ? totalUptimePct / count : 0;

      // Transportation metrics for this product (from active traders carrying this product)
      const productTraders = simulationEngine
        .getActiveTraders()
        .filter(t => t.productId === productId);
      let totalRouteLength = 0;
      let totalFuelCost = 0;
      for (const trader of productTraders) {
        const metrics = simulationEngine.getPathMetrics(trader.path);
        totalRouteLength += metrics.routeLength;
        totalFuelCost += metrics.fuelCost;
      }
      const transportCount = productTraders.length;
      const avgRouteLength = transportCount > 0 ? totalRouteLength / transportCount : 0;
      // Average fuel cost is per route unit (tile), so:
      // avg transport cost = avg fuel cost per tile * avg route length.
      const avgFuelCost = totalRouteLength > 0 ? totalFuelCost / totalRouteLength : 0;
      const avgTransportCost = avgFuelCost * avgRouteLength;

      this.stats.set(productId, {
        factoryCount: count,
        avgInputFillPct,
        avgOutputFillPct,
        avgSellPrice,
        avgUptimePct,
        transportCount,
        avgRouteLength,
        avgTransportCost,
        avgFuelCost,
        statusCounts,
        inputDetails
      });
    }
  }

  /**
   * @returns {Map<productId, { factoryCount, avgInputFillPct, avgOutputFillPct, avgSellPrice, transportCount, avgRouteLength, avgTransportCost, avgFuelCost, statusCounts, inputDetails }>}
   */
  getStats() {
    return this.stats;
  }
}
