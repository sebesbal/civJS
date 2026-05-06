const { test, expect } = require('@playwright/test');

test.describe('GameplayController', () => {
  test('spawns a settler on land and moves it only from secondary-click orders', async ({ page }) => {
    await page.goto('/');

    const state = await page.evaluate(async () => {
      const THREE = await import('three');
      const { GameplayController } = await import('/application/game/gameplay-controller.js');

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const renderer = {
        domElement: {
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
        }
      };
      const cameraController = { focusOn: () => {} };
      const tiles = [0, 1, 2].map((x) => {
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.5, 1),
          new THREE.MeshBasicMaterial()
        );
        tile.position.set(x, 0, 0);
        tile.userData = {
          gridX: x,
          gridZ: 0,
          tileTypeIndex: 5
        };
        return tile;
      });

      const gameplay = new GameplayController({
        scene,
        camera,
        renderer,
        tilemap: { tiles },
        cameraController,
        rng: () => 0
      });

      const settler = gameplay.selectedUnit;
      const startX = settler.mesh.position.x;

      gameplay.raycast = () => ({ type: 'tile', tile: tiles[1] });
      gameplay.handlePrimaryClick({});
      const destinationAfterPrimaryClick = settler.destination;

      gameplay.selectUnit(settler);
      gameplay.raycast = () => ({ type: 'tile', tile: tiles[2] });
      gameplay.handleSecondaryClick({});
      gameplay.update(0.2);

      return {
        unitCount: gameplay.units.length,
        selectedType: gameplay.selectedUnit?.type,
        startX,
        movedX: settler.mesh.position.x,
        destinationAfterPrimaryClick: Boolean(destinationAfterPrimaryClick),
        hasDestination: Boolean(settler.destination)
      };
    });

    expect(state.unitCount).toBe(1);
    expect(state.selectedType).toBe('settler');
    expect(state.startX).toBe(0);
    expect(state.destinationAfterPrimaryClick).toBe(false);
    expect(state.movedX).toBeGreaterThan(state.startX);
    expect(state.hasDestination).toBe(true);
  });
});
