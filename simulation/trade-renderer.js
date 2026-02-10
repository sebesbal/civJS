// TradeRenderer - renders active trade paths and transport spheres on the map

import * as THREE from 'three';
import { gridToWorld } from './pathfinding.js';

export class TradeRenderer {
  /**
   * @param {THREE.Scene} scene
   * @param {SimulationEngine} simulationEngine
   * @param {Tilemap} tilemap
   */
  constructor(scene, simulationEngine, tilemap) {
    this.scene = scene;
    this.simulationEngine = simulationEngine;
    this.tilemap = tilemap;

    // Rendered objects: Map<traderId, { pathLine, sphere }>
    this.traderVisuals = new Map();

    // Shared geometry for transport spheres
    this.sphereGeometry = new THREE.SphereGeometry(0.12, 8, 8);
  }

  /**
   * Called every frame to update visuals.
   */
  update() {
    const activeTraders = this.simulationEngine.getActiveTraders();
    const activeIds = new Set(activeTraders.map(t => t.id));

    // Remove visuals for completed traders
    for (const [id, visuals] of this.traderVisuals) {
      if (!activeIds.has(id)) {
        this._removeVisuals(visuals);
        this.traderVisuals.delete(id);
      }
    }

    // Update/create visuals for active traders
    for (const trader of activeTraders) {
      let visuals = this.traderVisuals.get(trader.id);

      if (!visuals) {
        visuals = this._createVisuals(trader);
        this.traderVisuals.set(trader.id, visuals);
      }

      // Update sphere position
      this._updateSpherePosition(trader, visuals.sphere);
    }
  }

  /**
   * Create path line + transport sphere for a trader.
   */
  _createVisuals(trader) {
    const color = this._getProductColor(trader.productId);

    // Build path points in world coordinates
    const points = [];
    for (const step of trader.path) {
      const world = gridToWorld(step.gridX, step.gridZ, this.tilemap);
      const topY = this.tilemap.getTileTopSurface(world.x, world.z) + 0.1;
      points.push(new THREE.Vector3(world.x, topY, world.z));
    }

    // Create path line
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      linewidth: 2
    });
    const pathLine = new THREE.Line(lineGeometry, lineMaterial);
    this.scene.add(pathLine);

    // Create transport sphere
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5
    });
    const sphere = new THREE.Mesh(this.sphereGeometry, sphereMaterial);
    this.scene.add(sphere);

    return { pathLine, lineGeometry, lineMaterial, sphere, sphereMaterial, points };
  }

  /**
   * Update the sphere position along the path using interpolation.
   */
  _updateSpherePosition(trader, sphere) {
    const pos = this.simulationEngine.getTraderWorldPosition(trader);
    const topY = this.tilemap.getTileTopSurface(pos.x, pos.z) + 0.25;
    sphere.position.set(pos.x, topY, pos.z);
  }

  /**
   * Remove all Three.js objects for a trader.
   */
  _removeVisuals(visuals) {
    this.scene.remove(visuals.pathLine);
    visuals.lineGeometry.dispose();
    visuals.lineMaterial.dispose();

    this.scene.remove(visuals.sphere);
    visuals.sphereMaterial.dispose();
    // Don't dispose shared sphereGeometry
  }

  /**
   * Generate a color for a product using the same golden angle distribution as object-types.js.
   */
  _getProductColor(productId) {
    const hue = (productId * 137.5) % 360;
    const s = 0.7;
    const l = 0.5;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    if (hue < 60) { r = c; g = x; b = 0; }
    else if (hue < 120) { r = x; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = x; }
    else if (hue < 240) { r = 0; g = x; b = c; }
    else if (hue < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (v) => Math.round((v + m) * 255);
    return (toHex(r) << 16) | (toHex(g) << 8) | toHex(b);
  }

  /**
   * Dispose all visuals and clean up.
   */
  dispose() {
    for (const visuals of this.traderVisuals.values()) {
      this._removeVisuals(visuals);
    }
    this.traderVisuals.clear();
    this.sphereGeometry.dispose();
  }
}
