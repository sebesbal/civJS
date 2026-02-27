const { test, expect } = require('@playwright/test');

test.describe('Persistence Services', () => {
  test('economy round-trip preserves data', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const { EconomyGraph } = await import('/domain/economy/economy-graph.js');
      const { EconomyIOService } = await import('/application/economy/economy-io-service.js');

      const graph = new EconomyGraph();
      const oreId = graph.addProduct('Ore', '', []);
      const metalId = graph.addProduct('Metal', '', [{ productId: oreId, amount: 2 }]);
      graph.setFuelProduct(metalId);

      const io = new EconomyIOService();
      const json = io.toJson(graph);
      const loaded = io.fromJson(json);

      return {
        before: graph.serialize(),
        after: loaded.serialize()
      };
    });

    expect(result.after).toEqual(result.before);
  });

  test('economy loader rejects non-v2 files', async ({ page }) => {
    await page.goto('/');

    const errorMessage = await page.evaluate(async () => {
      const { EconomyIOService } = await import('/application/economy/economy-io-service.js');
      const io = new EconomyIOService();
      try {
        io.fromJson(JSON.stringify({ version: 1, nodes: [] }));
        return null;
      } catch (error) {
        return error.message;
      }
    });

    expect(errorMessage).toMatch(/Expected version 2/);
  });

  test('game state round-trip with v4 schema', async ({ page }) => {
    await page.goto('/');

    const parsed = await page.evaluate(async () => {
      const { GameStateService } = await import('/application/game/state-service.js');

      const service = new GameStateService();
      const mockTilemap = {
        getTileData: () => [{ gridX: 0, gridZ: 0, tileTypeIndex: 3 }],
        getConfig: () => ({ mapSize: 1, tileSize: 1, tileHeight: 0.1 })
      };
      const mockObjectManager = { serialize: () => ({ objects: [{ id: 0, type: 'WAREHOUSE' }], nextId: 1 }) };
      const mockRouteManager = { serialize: () => ({ routes: [], nextRouteId: 0 }) };
      const mockEconomy = { serialize: () => ({ version: 2, nodes: [], nextNodeId: 0, fuelProductId: null }) };
      const mockSimulation = { serialize: () => ({ version: 3, tickCount: 10 }) };

      const saved = service.saveGameState({
        tilemap: mockTilemap,
        objectManager: mockObjectManager,
        routeManager: mockRouteManager,
        economyGraph: mockEconomy,
        simulationEngine: mockSimulation
      });

      return service.loadGameState(saved);
    });

    expect(parsed.version).toBe(4);
    expect(parsed.economy.version).toBe(2);
    expect(parsed.simulation.tickCount).toBe(10);
  });

  test('game state loader rejects non-v4 files', async ({ page }) => {
    await page.goto('/');

    const errorMessage = await page.evaluate(async () => {
      const { GameStateService } = await import('/application/game/state-service.js');
      const service = new GameStateService();
      try {
        service.loadGameState(JSON.stringify({ version: 3 }));
        return null;
      } catch (error) {
        return error.message;
      }
    });

    expect(errorMessage).toMatch(/Expected version 4/);
  });
});
