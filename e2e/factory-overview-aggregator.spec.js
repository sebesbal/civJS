const { test, expect } = require('@playwright/test');

test.describe('FactoryOverviewAggregator', () => {
  test('aggregates product stats without changing output shape', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const { FactoryOverviewAggregator } = await import('/application/game/factory-overview-aggregator.js');

      const makeStorage = (entries) => new Map(entries);
      const makeState = ({
        productId,
        status,
        output,
        input,
        sellPrice,
        producingTicks,
        observedTicks
      }) => ({
        type: 'PRODUCER',
        productId,
        status,
        outputStorage: makeStorage([[productId, output]]),
        inputStorage: makeStorage([[2, input]]),
        getSellPrice: () => sellPrice,
        producingTicks,
        observedTicks
      });

      const aggregator = new FactoryOverviewAggregator();
      const states = [
        makeState({
          productId: 1,
          status: 'producing',
          output: { current: 5, capacity: 10, idealMax: 8 },
          input: { current: 4, capacity: 8 },
          sellPrice: 10,
          producingTicks: 6,
          observedTicks: 10
        }),
        makeState({
          productId: 1,
          status: 'idle',
          output: { current: 10, capacity: 10, idealMax: 8 },
          input: { current: 8, capacity: 8 },
          sellPrice: 14,
          producingTicks: 2,
          observedTicks: 10
        }),
        makeState({
          productId: 1,
          status: 'missing_inputs',
          output: { current: 9, capacity: 12, idealMax: 6 },
          input: { current: 2, capacity: 8 },
          sellPrice: 20,
          producingTicks: 0,
          observedTicks: 0
        }),
        {
          type: 'WAREHOUSE',
          productId: 1,
          outputStorage: new Map(),
          inputStorage: new Map(),
          getSellPrice: () => 999,
          producingTicks: 0,
          observedTicks: 0
        }
      ];

      const pathMetrics = {
        alpha: { routeLength: 6, fuelCost: 3 },
        beta: { routeLength: 3, fuelCost: 0.9 }
      };

      aggregator.aggregate(
        {
          getAllActorStates: () => states,
          getActiveTraders: () => [
            { productId: 1, path: 'alpha' },
            { productId: 1, path: 'beta' },
            { productId: 2, path: 'ignored' }
          ],
          getPathMetrics: (path) => pathMetrics[path]
        },
        {
          getNode: (id) => {
            if (id === 1) {
              return { id: 1, name: 'Tools', inputs: [{ productId: 2, amount: 1 }] };
            }
            if (id === 2) {
              return { id: 2, name: 'Ore', inputs: [] };
            }
            return null;
          }
        }
      );

      const stats = aggregator.getStats().get(1);
      return {
        factoryCount: stats.factoryCount,
        avgInputFillPct: stats.avgInputFillPct,
        avgOutputFillPct: stats.avgOutputFillPct,
        avgSellPrice: stats.avgSellPrice,
        avgUptimePct: stats.avgUptimePct,
        transportCount: stats.transportCount,
        avgRouteLength: stats.avgRouteLength,
        avgTransportCost: stats.avgTransportCost,
        avgFuelCost: stats.avgFuelCost,
        statusCounts: stats.statusCounts,
        inputDetails: Array.from(stats.inputDetails.entries())
      };
    });

    expect(result.factoryCount).toBe(3);
    expect(result.avgInputFillPct).toBeCloseTo(7 / 12, 10);
    expect(result.avgOutputFillPct).toBeCloseTo(3 / 4, 10);
    expect(result.avgSellPrice).toBeCloseTo(44 / 3, 10);
    expect(result.avgUptimePct).toBeCloseTo(4 / 15, 10);
    expect(result.transportCount).toBe(2);
    expect(result.avgRouteLength).toBeCloseTo(4.5, 10);
    expect(result.avgTransportCost).toBeCloseTo(1.95, 10);
    expect(result.avgFuelCost).toBeCloseTo(13 / 30, 10);
    expect(result.statusCounts).toEqual({
      producing: 1,
      idle: 0,
      output_full: 1,
      output_surplus: 1,
      missing_inputs: 0
    });
    expect(result.inputDetails).toEqual([[2, { name: 'Ore', avgFillPct: 7 / 12 }]]);
  });
});
