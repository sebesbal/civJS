import * as THREE from 'three';
import { worldToGrid } from '../../domain/map/pathfinding.js';

export class MapOverlayRenderer {
  constructor(scene, tilemap, simulationEngine, economyManager) {
    this.scene = scene;
    this.tilemap = tilemap;
    this.simulationEngine = simulationEngine;
    this.economyManager = economyManager;

    this.overlayEnabled = false;
    this.metric = 'buy';
    this.productId = null;

    this.overlayGroup = new THREE.Group();
    this.overlayTiles = new Map();
    this.scene.add(this.overlayGroup);

    this._rebuildTileOverlays();
  }

  setRuntimeReferences({ tilemap, simulationEngine, economyManager }) {
    if (tilemap && tilemap !== this.tilemap) {
      this.tilemap = tilemap;
      this._rebuildTileOverlays();
    }
    if (simulationEngine !== undefined) this.simulationEngine = simulationEngine;
    if (economyManager) this.economyManager = economyManager;
  }

  setOverlayConfig({ enabled, metric, productId }) {
    if (enabled !== undefined) this.overlayEnabled = !!enabled;
    if (metric !== undefined) this.metric = metric;
    if (productId !== undefined) {
      this.productId = productId === null || productId === '' ? null : Number(productId);
    }
    this.refresh();
  }

  refresh() {
    if (!this.overlayEnabled || !this.tilemap || !this.simulationEngine || this.productId === null) {
      this._setAllTilesHidden();
      return;
    }

    const values = this._computeMetricValues();
    this._applyValues(values);
  }

  _rebuildTileOverlays() {
    this._disposeTiles();
    if (!this.tilemap) return;

    for (const tile of this.tilemap.tiles) {
      const geometry = new THREE.PlaneGeometry(this.tilemap.tileSize * 0.92, this.tilemap.tileSize * 0.92);
      const material = new THREE.MeshBasicMaterial({
        color: 0x0000ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        tile.position.x,
        this.tilemap.getTileTopSurface(tile.position.x, tile.position.z) + 0.03,
        tile.position.z
      );
      this.overlayGroup.add(mesh);
      this.overlayTiles.set(`${tile.userData.gridX},${tile.userData.gridZ}`, { mesh, material, geometry });
    }
  }

  _disposeTiles() {
    for (const entry of this.overlayTiles.values()) {
      this.overlayGroup.remove(entry.mesh);
      entry.geometry.dispose();
      entry.material.dispose();
    }
    this.overlayTiles.clear();
  }

  _setAllTilesHidden() {
    for (const entry of this.overlayTiles.values()) {
      entry.material.opacity = 0;
      entry.mesh.visible = false;
    }
  }

  _computeMetricValues() {
    const values = new Map();
    const selectedNode = this.economyManager?.getNode(this.productId) ?? null;
    const sourceFields = new Map();

    for (const tile of this.tilemap.tiles) {
      const key = `${tile.userData.gridX},${tile.userData.gridZ}`;
      let value = null;

      if (this.metric === 'buy') {
        value = this._computeBuyPriceAtCell(tile.userData.gridX, tile.userData.gridZ, sourceFields);
      } else if (this.metric === 'sell') {
        value = this._computeSellPriceAtCell(tile.userData.gridX, tile.userData.gridZ, sourceFields);
      } else if (this.metric === 'productionCost') {
        value = this._computeProductionCostAtCell(tile.userData.gridX, tile.userData.gridZ, selectedNode, sourceFields);
      } else if (this.metric === 'profit') {
        const sellValue = this._computeSellPriceAtCell(tile.userData.gridX, tile.userData.gridZ, sourceFields);
        const productionCost = this._computeProductionCostAtCell(tile.userData.gridX, tile.userData.gridZ, selectedNode, sourceFields);
        value = sellValue === null || productionCost === null ? null : sellValue - productionCost;
      }

      values.set(key, value);
    }

    return values;
  }

  _computeBuyPriceAtCell(gridX, gridZ, cache) {
    let best = Infinity;
    for (const candidate of this._getActorsSellingProduct(this.productId, cache)) {
      const travelCost = candidate.costField.get(`${gridX},${gridZ}`);
      if (travelCost === undefined) continue;
      best = Math.min(best, candidate.price + travelCost);
    }
    return Number.isFinite(best) ? best : null;
  }

  _computeSellPriceAtCell(gridX, gridZ, cache) {
    let best = -Infinity;
    for (const candidate of this._getActorsBuyingProduct(this.productId, cache)) {
      const travelCost = candidate.costField.get(`${gridX},${gridZ}`);
      if (travelCost === undefined) continue;
      best = Math.max(best, candidate.price - travelCost);
    }
    return Number.isFinite(best) ? best : null;
  }

  _computeProductionCostAtCell(gridX, gridZ, selectedNode, cache) {
    if (!selectedNode) return null;
    if (!Array.isArray(selectedNode.inputs) || selectedNode.inputs.length === 0) return 0;

    let total = 0;
    for (const input of selectedNode.inputs) {
      let bestInput = Infinity;
      for (const candidate of this._getActorsSellingProduct(input.productId, cache)) {
        const travelCost = candidate.costField.get(`${gridX},${gridZ}`);
        if (travelCost === undefined) continue;
        bestInput = Math.min(bestInput, candidate.price + travelCost);
      }
      if (!Number.isFinite(bestInput)) return null;
      total += bestInput * input.amount;
    }
    return total;
  }

  _getActorsSellingProduct(productId, cache) {
    const key = `sell-${productId}`;
    if (cache.has(key)) return cache.get(key);

    const results = [];
    for (const state of this.simulationEngine.getAllActorStates()) {
      if (!state.outputStorage.has(productId)) continue;
      const objectData = this.simulationEngine.objectManager.getObjectById(state.objectId);
      if (!objectData) continue;
      const start = worldToGrid(objectData.mesh.position.x, objectData.mesh.position.z, this.tilemap);
      results.push({
        price: state.getSellPrice(productId),
        costField: this._buildCostField(start)
      });
    }

    cache.set(key, results);
    return results;
  }

  _getActorsBuyingProduct(productId, cache) {
    const key = `buy-${productId}`;
    if (cache.has(key)) return cache.get(key);

    const results = [];
    for (const state of this.simulationEngine.getAllActorStates()) {
      if (!state.inputStorage.has(productId) && !state.outputStorage.has(productId)) continue;
      const objectData = this.simulationEngine.objectManager.getObjectById(state.objectId);
      if (!objectData) continue;
      const start = worldToGrid(objectData.mesh.position.x, objectData.mesh.position.z, this.tilemap);
      results.push({
        price: state.getBuyPrice(productId),
        costField: this._buildCostField(start)
      });
    }

    cache.set(key, results);
    return results;
  }

  _buildCostField(start) {
    const config = this.tilemap.getConfig();
    const mapSize = config.mapSize;
    const costs = new Map();
    const frontier = [{ gridX: start.gridX, gridZ: start.gridZ, cost: 0 }];
    const tileMap = new Map();

    for (const tile of this.tilemap.tiles) {
      tileMap.set(`${tile.userData.gridX},${tile.userData.gridZ}`, tile);
    }

    costs.set(`${start.gridX},${start.gridZ}`, 0);

    const directions = [
      { dx: 0, dz: -1, factor: 1 },
      { dx: 0, dz: 1, factor: 1 },
      { dx: -1, dz: 0, factor: 1 },
      { dx: 1, dz: 0, factor: 1 },
      { dx: -1, dz: -1, factor: Math.SQRT2, diagonal: true },
      { dx: 1, dz: -1, factor: Math.SQRT2, diagonal: true },
      { dx: -1, dz: 1, factor: Math.SQRT2, diagonal: true },
      { dx: 1, dz: 1, factor: Math.SQRT2, diagonal: true }
    ];

    while (frontier.length > 0) {
      frontier.sort((a, b) => a.cost - b.cost);
      const current = frontier.shift();

      for (const dir of directions) {
        const nx = current.gridX + dir.dx;
        const nz = current.gridZ + dir.dz;
        if (nx < 0 || nx >= mapSize || nz < 0 || nz >= mapSize) continue;

        const neighborKey = `${nx},${nz}`;
        const neighborTile = tileMap.get(neighborKey);
        if (!neighborTile || neighborTile.userData.tileTypeIndex < 3) continue;

        if (dir.diagonal) {
          const horizontalTile = tileMap.get(`${current.gridX + dir.dx},${current.gridZ}`);
          const verticalTile = tileMap.get(`${current.gridX},${current.gridZ + dir.dz}`);
          if (!horizontalTile || !verticalTile) continue;
          if (horizontalTile.userData.tileTypeIndex < 3 || verticalTile.userData.tileTypeIndex < 3) continue;
        }

        const baseCost = this.simulationEngine.roadTiles.has(neighborKey)
          ? this.simulationEngine.transportCostRoad
          : this.simulationEngine.transportCostOffRoad;
        const nextCost = current.cost + (baseCost * dir.factor);
        if (nextCost >= (costs.get(neighborKey) ?? Infinity)) continue;

        costs.set(neighborKey, nextCost);
        frontier.push({ gridX: nx, gridZ: nz, cost: nextCost });
      }
    }

    return costs;
  }

  _applyValues(values) {
    const numericValues = Array.from(values.values()).filter(value => value !== null && Number.isFinite(value));
    if (numericValues.length === 0) {
      this._setAllTilesHidden();
      return;
    }

    const minValue = Math.min(...numericValues);
    const maxValue = Math.max(...numericValues);
    const range = Math.max(maxValue - minValue, 0.0001);

    for (const [key, entry] of this.overlayTiles) {
      const value = values.get(key);
      if (value === null || !Number.isFinite(value)) {
        entry.material.opacity = 0;
        entry.mesh.visible = false;
        continue;
      }

      const normalized = (value - minValue) / range;
      entry.material.color.copy(this._getHeatmapColor(normalized));
      entry.material.opacity = 0.5;
      entry.mesh.visible = true;
    }
  }

  _getHeatmapColor(normalized) {
    const t = Math.max(0, Math.min(1, normalized));
    return new THREE.Color().setHSL(0.66 + ((0.8 - 0.66) * t), 0.8, 0.5);
  }

  dispose() {
    this._disposeTiles();
    this.scene.remove(this.overlayGroup);
  }
}
