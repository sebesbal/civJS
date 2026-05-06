import * as THREE from 'three';

const SETTLER_UNIT_ID = 'settler';
const LAND_TILE_MIN_INDEX = 3;
const MOUNTAIN_TILE_INDEX = 10;

export class GameplayController {
  constructor({ scene, camera, renderer, tilemap, cameraController, rng = Math.random }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.tilemap = tilemap;
    this.cameraController = cameraController;
    this.rng = rng;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.units = [];
    this.selectedUnit = null;
    this.destination = null;
    this.moveSpeed = 3.5;

    this.selectionRing = this._createSelectionRing();
    this.destinationMarker = this._createDestinationMarker();
    this.spawnSettler();
  }

  setTilemap(tilemap) {
    this.tilemap = tilemap;
  }

  spawnSettler() {
    const existingSettler = this.units.find(unit => unit.id === SETTLER_UNIT_ID);
    if (existingSettler) {
      this.scene.remove(existingSettler.mesh);
      this._disposeObject(existingSettler.mesh);
      this.units = this.units.filter(unit => unit !== existingSettler);
      if (this.selectedUnit === existingSettler) {
        this.selectedUnit = null;
      }
    }

    const startTile = this._chooseStartingTile();
    if (!startTile) {
      console.warn('Could not find a valid tile for the settler.');
      return null;
    }

    const unit = {
      id: SETTLER_UNIT_ID,
      type: 'settler',
      name: 'Settler',
      mesh: this._createSettlerMesh(),
      destination: null
    };

    unit.mesh.position.copy(this._tileTopPosition(startTile));
    unit.mesh.userData.gameUnitId = unit.id;

    this.units.push(unit);
    this.scene.add(unit.mesh);
    this.selectUnit(unit);
    return unit;
  }

  resetSettler() {
    this._hideDestinationMarker();
    return this.spawnSettler();
  }

  focusOnSettler() {
    const settler = this.units.find(unit => unit.id === SETTLER_UNIT_ID);
    if (settler) {
      this.cameraController.focusOn(settler.mesh.position, 7.5);
    }
  }

  handlePrimaryClick(event) {
    const hit = this.raycast(event);

    if (hit?.type === 'unit') {
      this.selectUnit(hit.unit);
      return { handled: true };
    }

    this.deselectUnit();
    return { handled: false };
  }

  handleSecondaryClick(event) {
    const hit = this.raycast(event);

    if (hit?.type === 'tile' && this.selectedUnit) {
      if (!this._isWalkableTile(hit.tile)) {
        return { handled: true };
      }

      this.moveSelectedUnitTo(hit.tile);
      return { handled: true };
    }

    return { handled: false };
  }

  moveSelectedUnitTo(tile) {
    if (!this.selectedUnit) return;

    const destination = this._tileTopPosition(tile);
    this.selectedUnit.destination = destination;
    this.destination = destination;
    this._positionDestinationMarker(destination);
  }

  update(deltaSeconds) {
    for (const unit of this.units) {
      if (!unit.destination) continue;

      const toDestination = new THREE.Vector3().subVectors(unit.destination, unit.mesh.position);
      const distance = toDestination.length();
      const step = this.moveSpeed * deltaSeconds;

      if (distance <= step) {
        unit.mesh.position.copy(unit.destination);
        unit.destination = null;
        this._hideDestinationMarker();
      } else {
        toDestination.normalize();
        unit.mesh.position.addScaledVector(toDestination, step);
        unit.mesh.rotation.y = Math.atan2(toDestination.x, toDestination.z);
      }

      if (unit === this.selectedUnit) {
        this._positionSelectionRing(unit.mesh.position);
      }
    }
  }

  raycast(event) {
    this._updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const unitMeshes = this.units.flatMap(unit => this._collectMeshes(unit.mesh));
    const unitIntersections = this.raycaster.intersectObjects(unitMeshes, false);
    if (unitIntersections.length > 0) {
      const root = this._findUnitRoot(unitIntersections[0].object);
      const unit = this.units.find(candidate => candidate.mesh === root);
      if (unit) {
        return { type: 'unit', unit, intersection: unitIntersections[0] };
      }
    }

    const tileIntersections = this.raycaster.intersectObjects(this.tilemap.tiles);
    if (tileIntersections.length > 0) {
      return {
        type: 'tile',
        tile: tileIntersections[0].object,
        intersection: tileIntersections[0]
      };
    }

    return null;
  }

  selectUnit(unit) {
    this.selectedUnit = unit;
    this._positionSelectionRing(unit.mesh.position);
  }

  deselectUnit() {
    this.selectedUnit = null;
    this.selectionRing.visible = false;
  }

  _chooseStartingTile() {
    const preferredTiles = this.tilemap.tiles.filter(tile => {
      const tileTypeIndex = tile.userData.tileTypeIndex;
      return tileTypeIndex >= 5 && tileTypeIndex < 9;
    });
    const fallbackTiles = this.tilemap.tiles.filter(tile => this._isWalkableTile(tile));
    const candidates = preferredTiles.length > 0 ? preferredTiles : fallbackTiles;
    if (candidates.length === 0) return null;

    const index = Math.floor(this.rng() * candidates.length);
    return candidates[index];
  }

  _isWalkableTile(tile) {
    const tileTypeIndex = tile?.userData?.tileTypeIndex;
    return tileTypeIndex >= LAND_TILE_MIN_INDEX && tileTypeIndex < MOUNTAIN_TILE_INDEX;
  }

  _tileTopPosition(tile) {
    return new THREE.Vector3(
      tile.position.x,
      tile.position.y + tile.geometry.parameters.height / 2,
      tile.position.z
    );
  }

  _createSettlerMesh() {
    const group = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xf7d36b, roughness: 0.65 });
    const cloakMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.8 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xf0c7a6, roughness: 0.6 });
    const packMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.55, 14), bodyMaterial);
    body.position.y = 0.32;
    body.castShadow = true;
    group.add(body);

    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.52, 14), cloakMaterial);
    cloak.position.set(0, 0.38, -0.05);
    cloak.rotation.x = 0.08;
    cloak.castShadow = true;
    group.add(cloak);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), headMaterial);
    head.position.y = 0.72;
    head.castShadow = true;
    group.add(head);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.14), packMaterial);
    pack.position.set(0, 0.42, -0.23);
    pack.castShadow = true;
    group.add(pack);

    group.name = 'Settler';
    return group;
  }

  _createSelectionRing() {
    const geometry = new THREE.TorusGeometry(0.42, 0.025, 8, 48);
    const material = new THREE.MeshBasicMaterial({ color: 0xfff06a });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    this.scene.add(ring);
    return ring;
  }

  _createDestinationMarker() {
    const geometry = new THREE.RingGeometry(0.18, 0.32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x57d68d,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    this.scene.add(marker);
    return marker;
  }

  _positionSelectionRing(position) {
    this.selectionRing.position.set(position.x, position.y + 0.03, position.z);
    this.selectionRing.visible = true;
  }

  _positionDestinationMarker(position) {
    this.destinationMarker.position.set(position.x, position.y + 0.04, position.z);
    this.destinationMarker.visible = true;
  }

  _hideDestinationMarker() {
    this.destinationMarker.visible = false;
    this.destination = null;
  }

  _updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _collectMeshes(root) {
    const meshes = [];
    root.traverse(child => {
      if (child.isMesh) meshes.push(child);
    });
    return meshes;
  }

  _findUnitRoot(mesh) {
    let current = mesh;
    while (current && !current.userData.gameUnitId) {
      current = current.parent;
    }
    return current;
  }

  _disposeObject(object) {
    object.traverse(child => {
      if (!child.isMesh) return;
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(material => material.dispose());
      } else {
        child.material?.dispose();
      }
    });
  }
}
