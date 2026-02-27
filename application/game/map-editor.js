import * as THREE from 'three';
import { ObjectManager } from '../../domain/map/objects.js';

export class MapEditor {
  constructor(scene, camera, renderer, tiles, mapConfig = null, routeManager) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.tiles = tiles; // Array of tile meshes
    this.routeManager = routeManager;

    this.objectManager = new ObjectManager(scene);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.mode = 'VIEW';
    this.selectedObjectType = null;
    this.isRouteMode = false;

    // Dragging state
    this.isDraggingObject = false;
    this.dragStartPosition = null;
    this.dragObject = null;

    // Tile grid info (from mapConfig or calculated from tiles)
    if (mapConfig) {
      this.tileSize = mapConfig.tileSize || 1;
      this.mapSize = mapConfig.mapSize || 20;
    } else {
      // Calculate from tiles if mapConfig not provided
      let maxX = 0;
      let maxZ = 0;
      tiles.forEach(tile => {
        if (tile.userData && tile.userData.gridX !== undefined) {
          maxX = Math.max(maxX, tile.userData.gridX);
          maxZ = Math.max(maxZ, tile.userData.gridZ);
        }
      });
      this.mapSize = Math.max(maxX, maxZ) + 1;
      if (tiles.length > 0) {
        const firstTile = tiles[0];
        const secondTile = tiles.find(t =>
          t.userData && t.userData.gridX === 1 && t.userData.gridZ === 0
        );
        this.tileSize = secondTile
          ? Math.abs(secondTile.position.x - firstTile.position.x)
          : 1;
      } else {
        this.tileSize = 1;
      }
    }
    this.tileOffset = (this.mapSize * this.tileSize) / 2 - this.tileSize / 2;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'VIEW') {
      this.objectManager.deselectObject();
      this.selectedObjectType = null;
      this.routeManager.deselectRoute();
    }
  }

  setSelectedObjectType(type) {
    this.selectedObjectType = type;
  }

  setRouteMode(enabled) {
    this.isRouteMode = enabled;
  }

  // Convert mouse coordinates to normalized device coordinates
  updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // Get the tile position from world coordinates
  worldToTilePosition(worldPos) {
    const x = Math.round((worldPos.x + this.tileOffset) / this.tileSize);
    const z = Math.round((worldPos.z + this.tileOffset) / this.tileSize);

    const clampedX = Math.max(0, Math.min(this.mapSize - 1, x));
    const clampedZ = Math.max(0, Math.min(this.mapSize - 1, z));

    const tileWorldX = clampedX * this.tileSize - this.tileOffset;
    const tileWorldZ = clampedZ * this.tileSize - this.tileOffset;

    return new THREE.Vector3(tileWorldX, 0, tileWorldZ);
  }

  // Get tile top surface Y position from intersection result
  getTileTopSurfaceFromResult(result) {
    if (!result || result.type !== 'tile') return null;
    const clickedTile = result.intersection.object;
    return clickedTile.position.y + (clickedTile.geometry.parameters.height / 2);
  }

  // Raycast to find intersection with tiles, objects, or routes
  raycast(event) {
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check objects first
    const objects = this.objectManager.getAllObjects().map(obj => obj.mesh);
    const objectIntersects = this.raycaster.intersectObjects(objects);

    if (objectIntersects.length > 0) {
      const hitMesh = objectIntersects[0].object;
      const objectData = this.objectManager.getAllObjects().find(obj => obj.mesh === hitMesh);
      if (objectData) {
        return {
          type: 'object',
          intersection: objectIntersects[0],
          object: objectData
        };
      }
    }

    // Check routes
    if (!this.routeManager.isInRouteCreationMode()) {
      const routeMeshes = this.routeManager.getAllRouteMeshes();
      const routeIntersects = this.raycaster.intersectObjects(routeMeshes);

      if (routeIntersects.length > 0) {
        const hitMesh = routeIntersects[0].object;
        const route = this.routeManager.findRouteByMesh(hitMesh);
        if (route) {
          return {
            type: 'route',
            intersection: routeIntersects[0],
            route: route
          };
        }
      }
    }

    // Check tiles
    const tileIntersects = this.raycaster.intersectObjects(this.tiles);

    if (tileIntersects.length > 0) {
      const intersection = tileIntersects[0];
      const tilePos = this.worldToTilePosition(intersection.point);
      return {
        type: 'tile',
        intersection: intersection,
        position: tilePos
      };
    }

    return null;
  }

  handleMouseDown(event) {
    const result = this.raycast(event);

    // Handle object clicks in VIEW mode (for inspection)
    if (this.mode === 'VIEW' && !this.isRouteMode) {
      this.routeManager.deselectRoute();

      if (result && result.type === 'object') {
        this.objectManager.selectObject(result.object.id);
        // Return the selected object for inspection
        return { handled: true, selectedObject: result.object };
      }

      this.objectManager.deselectObject();
      return { handled: false };
    }

    if (!result) {
      this.routeManager.deselectRoute();
      this.objectManager.deselectObject();
      return { handled: false };
    }

    if (this.isRouteMode) {
      return { handled: false };
    }

    if (result.type === 'object') {
      this.routeManager.deselectRoute();
      this.objectManager.selectObject(result.object.id);

      if (this.mode === 'EDIT') {
        this.isDraggingObject = true;
        this.dragObject = result.object;
        this.dragStartPosition = new THREE.Vector2(event.clientX, event.clientY);
      }
      return { handled: true, selectedObject: result.object };
    } else if (result.type === 'route') {
      this.objectManager.deselectObject();
      this.routeManager.selectRoute(result.route.id);
      return { handled: true };
    } else if (result.type === 'tile') {
      if (this.selectedObjectType) {
        const tileTopY = this.getTileTopSurfaceFromResult(result);
        if (tileTopY === null) return { handled: false };

        const position = result.position.clone();
        position.y = tileTopY;

        this.objectManager.createObject(this.selectedObjectType, position);
        return { handled: true };
      } else {
        this.routeManager.deselectRoute();
        this.objectManager.deselectObject();
        return { handled: false };
      }
    }

    return { handled: false };
  }

  handleMouseMove(event) {
    if (this.isDraggingObject && this.dragObject) {
      const result = this.raycast(event);
      if (result && result.type === 'tile') {
        const tileTopY = this.getTileTopSurfaceFromResult(result);
        if (tileTopY === null) return;

        const position = result.position.clone();
        position.y = tileTopY;

        this.objectManager.moveObject(this.dragObject.id, position);
      }
    }
  }

  handleMouseUp(event) {
    if (this.isDraggingObject) {
      this.isDraggingObject = false;
      this.dragObject = null;
      this.dragStartPosition = null;
    }
  }

  handleRightClick(event) {
    // Allow right-click in both VIEW and EDIT modes (but not during route creation)
    if (this.isRouteMode) {
      return false;
    }

    const result = this.raycast(event);
    if (result && result.type === 'object') {
      return result.object;
    } else if (result && result.type === 'route') {
      return result.route;
    }

    return null;
  }

  deleteSelectedRoute() {
    const route = this.routeManager.getSelectedRoute();
    if (route) {
      return this.routeManager.removeRoute(route.id);
    }
    return false;
  }

  getObjectManager() {
    return this.objectManager;
  }

  getSelectedObject() {
    return this.objectManager.selectedObject;
  }

  deleteObject(objectId) {
    return this.objectManager.removeObject(objectId);
  }
}
