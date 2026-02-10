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
      const statusCounts = { producing: 0, idle: 0, output_full: 0, missing_inputs: 0 };
      for (const s of states) {
        if (statusCounts[s.status] !== undefined) {
          statusCounts[s.status]++;
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

      this.stats.set(productId, {
        factoryCount: count,
        avgInputFillPct,
        avgOutputFillPct,
        avgSellPrice,
        statusCounts,
        inputDetails
      });
    }
  }

  /**
   * @returns {Map<productId, { factoryCount, avgInputFillPct, avgOutputFillPct, avgSellPrice, statusCounts, inputDetails }>}
   */
  getStats() {
    return this.stats;
  }
}
