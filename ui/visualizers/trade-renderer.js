// TradeRenderer - renders active trade paths and transport spheres on the map

import * as THREE from 'three';
import { gridToWorld } from '../../domain/map/pathfinding.js';

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

    this.routeVisuals = new Map();
    this.traderVisuals = new Map();
    this.selectedObjectId = null;

    // Shared geometry for transport spheres
    this.sphereGeometry = new THREE.SphereGeometry(0.14, 10, 10);
    this.flowPulseGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  }

  /**
   * Called every frame to update visuals.
   */
  update() {
    const activeTraders = this.simulationEngine.getActiveTraders();
    const activeIds = new Set(activeTraders.map(t => t.id));
    const activeContractIds = new Set(
      activeTraders
        .map(trader => trader.contractId)
        .filter(contractId => contractId !== null && contractId !== undefined)
    );

    const selectedContracts = this.selectedObjectId === null
      ? []
      : this.simulationEngine.getConnectedContracts(this.selectedObjectId);

    const routeStates = new Map();
    for (const contract of selectedContracts) {
      routeStates.set(this._getContractVisualKey(contract), {
        contract,
        active: activeContractIds.has(contract.id),
        selected: true
      });
    }
    for (const contract of this.simulationEngine.getContracts()) {
      if (!activeContractIds.has(contract.id)) continue;
      const key = this._getContractVisualKey(contract);
      const prev = routeStates.get(key);
      routeStates.set(key, {
        contract,
        active: true,
        selected: prev?.selected ?? false
      });
    }

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
        visuals = this._createTraderVisuals(trader);
        this.traderVisuals.set(trader.id, visuals);
      }

      // Update sphere position
      this._updateTraderSpherePosition(trader, visuals.sphere);
      this._styleTraderVisual(trader, visuals);
    }

    const requiredRouteKeys = new Set(routeStates.keys());
    for (const [key, visuals] of this.routeVisuals) {
      if (!requiredRouteKeys.has(key)) {
        this._removeRouteVisuals(visuals);
        this.routeVisuals.delete(key);
      }
    }

    for (const [key, routeState] of routeStates) {
      let visuals = this.routeVisuals.get(key);
      if (!visuals) {
        visuals = this._createRouteVisuals(routeState.contract);
        if (!visuals) continue;
        this.routeVisuals.set(key, visuals);
      }

      this._styleRouteVisual(visuals, routeState);
      this._animateRouteFlow(visuals, routeState);
    }
  }

  /**
   * Create the reusable route mesh for a contract.
   */
  _createRouteVisuals(contract) {
    const path = this.simulationEngine.getContractPath(contract);
    if (!path || path.length < 2) return null;

    const color = this._getProductColor(contract.productId);
    const points = this._simplifyPathPoints(this._buildPathPoints(path));
    const curve = this._createRouteCurve(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, Math.max(24, points.length * 6), 0.06, 10, false);
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.45
    });
    const routeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    this.scene.add(routeMesh);

    const flowPulses = [];
    for (let i = 0; i < 3; i++) {
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.8
      });
      const pulse = new THREE.Mesh(this.flowPulseGeometry, material);
      pulse.visible = false;
      this.scene.add(pulse);
      flowPulses.push({ mesh: pulse, material, offset: i / 3 });
    }

    return { routeMesh, tubeGeometry, tubeMaterial, curve, color, flowPulses };
  }

  _buildPathPoints(path) {
    const points = [];
    for (const step of path) {
      const world = gridToWorld(step.gridX, step.gridZ, this.tilemap);
      const topY = this.tilemap.getTileTopSurface(world.x, world.z) + 0.14;
      points.push(new THREE.Vector3(world.x, topY, world.z));
    }
    return points;
  }

  _simplifyPathPoints(points) {
    if (points.length <= 2) return points.map(point => point.clone());

    const simplified = [points[0].clone()];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const next = points[i + 1];

      const incomingX = Math.sign(current.x - prev.x);
      const incomingZ = Math.sign(current.z - prev.z);
      const outgoingX = Math.sign(next.x - current.x);
      const outgoingZ = Math.sign(next.z - current.z);

      if (incomingX !== outgoingX || incomingZ !== outgoingZ) {
        simplified.push(current.clone());
      }
    }

    simplified.push(points[points.length - 1].clone());
    return simplified;
  }

  _createRouteCurve(points) {
    if (points.length === 2) {
      return new THREE.LineCurve3(points[0], points[1]);
    }

    const curvePath = new THREE.CurvePath();
    let segmentStart = points[0].clone();

    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      const incoming = current.clone().sub(points[i - 1]);
      const outgoing = next.clone().sub(current);
      const incomingLength = incoming.length();
      const outgoingLength = outgoing.length();

      if (incomingLength < 1e-6 || outgoingLength < 1e-6) {
        continue;
      }

      const cornerRadius = Math.min(0.18, incomingLength * 0.35, outgoingLength * 0.35);
      const entry = current.clone().addScaledVector(incoming.normalize(), -cornerRadius);
      const exit = current.clone().addScaledVector(outgoing.normalize(), cornerRadius);

      curvePath.add(new THREE.LineCurve3(segmentStart.clone(), entry));
      curvePath.add(new THREE.QuadraticBezierCurve3(entry, current.clone(), exit));
      segmentStart = exit;
    }

    curvePath.add(new THREE.LineCurve3(segmentStart, points[points.length - 1].clone()));
    return curvePath;
  }

  _createTraderVisuals(trader) {
    const color = this._getProductColor(trader.productId);
    // Create transport sphere
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5
    });
    const sphere = new THREE.Mesh(this.sphereGeometry, sphereMaterial);
    this.scene.add(sphere);

    return { sphere, sphereMaterial };
  }

  _updateTraderSpherePosition(trader, sphere) {
    const pos = this.simulationEngine.getTraderWorldPositionAtProgress(
      trader,
      this.simulationEngine.getTickProgress()
    );
    const topY = this.tilemap.getTileTopSurface(pos.x, pos.z) + 0.25;
    sphere.position.set(pos.x, topY, pos.z);
  }

  _styleTraderVisual(trader, visuals) {
    const highlighted = this.selectedObjectId !== null && (
      trader.sourceObjectId === this.selectedObjectId ||
      trader.destObjectId === this.selectedObjectId ||
      (trader.contractId !== null &&
        this.simulationEngine.getConnectedContracts(this.selectedObjectId)
          .some(contract => contract.id === trader.contractId))
    );
    visuals.sphereMaterial.opacity = highlighted || this.selectedObjectId === null ? 1.0 : 0.35;
    visuals.sphereMaterial.transparent = visuals.sphereMaterial.opacity < 1.0;
    visuals.sphereMaterial.emissiveIntensity = highlighted ? 1.2 : 0.55;
    visuals.sphere.scale.setScalar(highlighted ? 1.15 : 1.0);
  }

  _styleRouteVisual(visuals, routeState) {
    const hasSelection = this.selectedObjectId !== null;
    visuals.tubeMaterial.opacity = routeState.selected ? 0.95 : (hasSelection ? 0.12 : 0.45);
    visuals.tubeMaterial.emissiveIntensity = routeState.selected ? 0.7 : (routeState.active ? 0.25 : 0.12);
    visuals.tubeMaterial.color.setHex(visuals.color);
  }

  _animateRouteFlow(visuals, routeState) {
    const time = performance.now() * 0.00022;
    for (const pulse of visuals.flowPulses) {
      if (!routeState.active && !routeState.selected) {
        pulse.mesh.visible = false;
        continue;
      }

      const t = (time + pulse.offset) % 1;
      const point = visuals.curve.getPointAt(t);
      pulse.mesh.position.copy(point);
      pulse.mesh.visible = true;
      pulse.material.opacity = routeState.selected ? 0.92 : 0.45;
      pulse.material.emissiveIntensity = routeState.selected ? 1.0 : 0.55;
      pulse.mesh.scale.setScalar(routeState.selected ? 1.35 : 1.0);
    }
  }

  _getContractVisualKey(contract) {
    return `contract-${contract.id}`;
  }

  /**
   * Remove all Three.js objects for a trader.
   */
  _removeVisuals(visuals) {
    this.scene.remove(visuals.sphere);
    visuals.sphereMaterial.dispose();
    // Don't dispose shared sphereGeometry
  }

  _removeRouteVisuals(visuals) {
    this.scene.remove(visuals.routeMesh);
    visuals.tubeGeometry.dispose();
    visuals.tubeMaterial.dispose();
    for (const pulse of visuals.flowPulses) {
      this.scene.remove(pulse.mesh);
      pulse.material.dispose();
    }
  }

  setSelectedObjectId(objectId) {
    this.selectedObjectId = objectId;
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
    for (const visuals of this.routeVisuals.values()) {
      this._removeRouteVisuals(visuals);
    }
    this.routeVisuals.clear();

    for (const visuals of this.traderVisuals.values()) {
      this._removeVisuals(visuals);
    }
    this.traderVisuals.clear();
    this.sphereGeometry.dispose();
    this.flowPulseGeometry.dispose();
  }
}
