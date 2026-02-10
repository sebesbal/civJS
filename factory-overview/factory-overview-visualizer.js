// FactoryOverviewVisualizer - Three.js DAG visualization with live stats cards
import * as THREE from 'three';
import { DAGLayout } from '../economy-editor/dag-layout.js';

export class FactoryOverviewVisualizer {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.economyManager = null;
    this.layout = new DAGLayout({
      horizontalSpacing: 5,
      verticalSpacing: 3.5
    });

    // Visual elements
    this.nodeGroups = new Map();   // Map<nodeId, { group, canvas, texture, bgMesh }>
    this.connectionLines = new Map();
    this.selectedNodeId = null;

    // Card dimensions
    this.cardWidth = 3.5;
    this.cardHeight = 2.5;

    // Canvas resolution for card textures
    this.canvasWidth = 512;
    this.canvasHeight = 384;

    // Colors
    this.nodeColor = 0x3a3a4a;
    this.selectedNodeColor = 0xffff00;
    this.connectionColor = 0x00ff00;
  }

  /**
   * Set economy manager and rebuild the entire visualization.
   */
  async setEconomyManager(economyManager) {
    this.economyManager = economyManager;
    await this.rebuildVisualization();
  }

  /**
   * Rebuild from scratch: layout, nodes, connections.
   */
  async rebuildVisualization() {
    if (!this.economyManager) return;

    this.clear();

    // Calculate layout
    this.layout.calculateLayout(this.economyManager);
    this.layout.centerLayout(this.economyManager);

    // Create node cards
    const nodes = this.economyManager.getAllNodes();
    for (const node of nodes) {
      this._createNodeCard(node);
    }

    // Create connections
    for (const node of nodes) {
      for (const input of node.inputs) {
        this._createConnection(input.productId, node.id);
      }
    }
  }

  /**
   * Create a card for a single economy node.
   */
  _createNodeCard(node) {
    const group = new THREE.Group();
    group.position.set(node.position.x, node.position.y, 0);
    group.userData.nodeId = node.id;

    // Background plane
    const bgGeometry = new THREE.PlaneGeometry(this.cardWidth, this.cardHeight);
    const isSelected = node.id === this.selectedNodeId;
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: isSelected ? this.selectedNodeColor : this.nodeColor
    });
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    bgMesh.position.z = -0.01;
    group.add(bgMesh);

    // Canvas texture for card content
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const cardGeometry = new THREE.PlaneGeometry(this.cardWidth, this.cardHeight);
    const cardMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true
    });
    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    cardMesh.position.z = 0.01;
    group.add(cardMesh);

    // Paint initial "no data" state
    this._paintCard(canvas, node.name, null);
    texture.needsUpdate = true;

    this.scene.add(group);
    this.nodeGroups.set(node.id, { group, canvas, texture, bgMesh });
  }

  /**
   * Create a spline connection between two nodes.
   */
  _createConnection(fromNodeId, toNodeId) {
    const fromNode = this.economyManager.getNode(fromNodeId);
    const toNode = this.economyManager.getNode(toNodeId);
    if (!fromNode || !toNode) return;

    const fromPos = new THREE.Vector3(
      fromNode.position.x + this.cardWidth / 2, fromNode.position.y, 0
    );
    const toPos = new THREE.Vector3(
      toNode.position.x - this.cardWidth / 2, toNode.position.y, 0
    );

    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const offset = (toPos.x - fromPos.x) * 0.2;
    const controlPoint = new THREE.Vector3(midX, midY + offset, 0);

    const curve = new THREE.CatmullRomCurve3(
      [fromPos, controlPoint, toPos], false, 'centripetal'
    );
    const points = curve.getPoints(50);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: this.connectionColor,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.connectionLines.set(`${fromNodeId}-${toNodeId}`, line);
  }

  /**
   * Update stats on all cards (called on simulation tick).
   * @param {Map<productId, stats>} statsMap from aggregator
   */
  updateStats(statsMap) {
    if (!this.economyManager) return;

    for (const node of this.economyManager.getAllNodes()) {
      const nodeData = this.nodeGroups.get(node.id);
      if (!nodeData) continue;

      const stats = statsMap.get(node.id) || null;
      this._paintCard(nodeData.canvas, node.name, stats);
      nodeData.texture.needsUpdate = true;
    }
  }

  /**
   * Paint a card canvas with product name and stats.
   */
  _paintCard(canvas, name, stats) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Product name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(name, w / 2, 12);

    if (!stats) {
      ctx.fillStyle = '#888888';
      ctx.font = '20px Arial';
      ctx.fillText('No data', w / 2, h / 2 - 10);
      return;
    }

    // Factory count
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Factories: ${stats.factoryCount}`, 16, 50);

    // Price
    ctx.fillText(`Avg Price: ${stats.avgSellPrice.toFixed(1)}`, 16, 74);

    // Output fill bar
    const barX = 16;
    const barW = w - 32;
    const barH = 24;
    let barY = 108;

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px Arial';
    ctx.fillText('Output', barX, barY - 4);
    this._drawBar(ctx, barX, barY + 12, barW, barH, stats.avgOutputFillPct, '#4a9eff');
    barY += 50;

    // Input fill bars (per input product)
    if (stats.inputDetails && stats.inputDetails.size > 0) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '14px Arial';
      ctx.fillText('Inputs', barX, barY - 4);
      barY += 14;

      for (const [, detail] of stats.inputDetails) {
        ctx.fillStyle = '#999999';
        ctx.font = '13px Arial';
        ctx.fillText(detail.name, barX + 4, barY);
        barY += 16;
        this._drawBar(ctx, barX, barY, barW, 18, detail.avgFillPct, '#ff9f43');
        barY += 26;
      }
    }

    // Status bar at bottom
    const statusBarY = h - 40;
    const statusBarH = 20;
    this._drawStatusBar(ctx, barX, statusBarY, barW, statusBarH, stats.statusCounts, stats.factoryCount);

    // Status legend
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('P=producing  I=idle  F=full  M=missing', w / 2, h - 8);
  }

  /**
   * Draw a filled bar (0-1 fill).
   */
  _drawBar(ctx, x, y, w, h, fillPct, color) {
    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y, w, h);

    // Fill
    const pct = Math.max(0, Math.min(1, fillPct));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * pct, h);

    // Percentage text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${(pct * 100).toFixed(0)}%`, x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  /**
   * Draw a stacked status bar showing producing/idle/full/missing proportions.
   */
  _drawStatusBar(ctx, x, y, w, h, statusCounts, total) {
    if (total === 0) return;

    const colors = {
      producing: '#2ecc71',
      idle: '#95a5a6',
      output_full: '#e74c3c',
      missing_inputs: '#f39c12'
    };
    const labels = {
      producing: 'P',
      idle: 'I',
      output_full: 'F',
      missing_inputs: 'M'
    };

    let offsetX = x;
    for (const status of ['producing', 'idle', 'output_full', 'missing_inputs']) {
      const count = statusCounts[status] || 0;
      if (count === 0) continue;
      const segW = (count / total) * w;
      ctx.fillStyle = colors[status];
      ctx.fillRect(offsetX, y, segW, h);

      // Label if segment wide enough
      if (segW > 16) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${labels[status]}${count}`, offsetX + segW / 2, y + h / 2);
      }
      offsetX += segW;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  /**
   * Select a node (highlight it).
   */
  selectNode(nodeId) {
    // Deselect previous
    if (this.selectedNodeId !== null) {
      const prev = this.nodeGroups.get(this.selectedNodeId);
      if (prev) {
        prev.bgMesh.material.color.setHex(this.nodeColor);
      }
    }

    this.selectedNodeId = nodeId;

    // Highlight new selection
    if (nodeId !== null) {
      const nodeData = this.nodeGroups.get(nodeId);
      if (nodeData) {
        nodeData.bgMesh.material.color.setHex(this.selectedNodeColor);
      }
    }
  }

  /**
   * Raycast to find node under mouse.
   */
  raycast(event) {
    if (!this.economyManager) return null;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const allMeshes = [];
    for (const nodeData of this.nodeGroups.values()) {
      nodeData.group.traverse((child) => {
        if (child.isMesh) allMeshes.push(child);
      });
    }

    if (allMeshes.length === 0) return null;

    const intersects = raycaster.intersectObjects(allMeshes, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && obj.userData.nodeId === undefined) {
        obj = obj.parent;
      }
      if (obj && obj.userData.nodeId !== undefined) {
        return this.economyManager.getNode(obj.userData.nodeId);
      }
    }

    return null;
  }

  /**
   * Clear all visualization elements.
   */
  clear() {
    for (const nodeData of this.nodeGroups.values()) {
      nodeData.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      this.scene.remove(nodeData.group);
    }
    this.nodeGroups.clear();

    for (const line of this.connectionLines.values()) {
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.connectionLines.clear();

    this.selectedNodeId = null;
  }

  dispose() {
    this.clear();
  }
}
