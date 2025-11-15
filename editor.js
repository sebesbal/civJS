import * as THREE from 'three';
import { ObjectManager } from './objects.js';

export class Editor {
  constructor(scene, camera, renderer, tiles, mapConfig = null, routeManager = null) {
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
      // Find the maximum grid coordinates from tile userData
      let maxX = 0;
      let maxZ = 0;
      tiles.forEach(tile => {
        if (tile.userData && tile.userData.gridX !== undefined) {
          maxX = Math.max(maxX, tile.userData.gridX);
          maxZ = Math.max(maxZ, tile.userData.gridZ);
        }
      });
      this.mapSize = Math.max(maxX, maxZ) + 1;
      // Calculate tileSize from first tile's position
      if (tiles.length > 0) {
        const firstTile = tiles[0];
        const secondTile = tiles.find(t => 
          t.userData && t.userData.gridX === 1 && t.userData.gridZ === 0
        );
        if (secondTile) {
          this.tileSize = Math.abs(secondTile.position.x - firstTile.position.x);
        } else {
          this.tileSize = 1;
        }
      } else {
        this.tileSize = 1;
      }
    }
    this.tileOffset = (this.mapSize * this.tileSize) / 2 - this.tileSize / 2;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Mouse events will be handled by the main index.js
    // This class provides methods for handling interactions
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'VIEW') {
      this.objectManager.deselectObject();
      this.selectedObjectType = null;
      // Deselect routes when switching to VIEW mode
      if (this.routeManager) {
        this.routeManager.deselectRoute();
      }
    }
  }

  setSelectedObjectType(type) {
    this.selectedObjectType = type;
  }

  setRouteMode(enabled) {
    this.isRouteMode = enabled;
    if (!enabled) {
      // Clear any route creation state
    }
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
    
    // Clamp to map bounds
    const clampedX = Math.max(0, Math.min(this.mapSize - 1, x));
    const clampedZ = Math.max(0, Math.min(this.mapSize - 1, z));
    
    // Convert back to world position (tile center)
    const tileWorldX = clampedX * this.tileSize - this.tileOffset;
    const tileWorldZ = clampedZ * this.tileSize - this.tileOffset;
    
    return new THREE.Vector3(tileWorldX, 0, tileWorldZ);
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
    
    // Check routes if routeManager is available
    if (this.routeManager && !this.routeManager.isInRouteCreationMode()) {
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
    if (this.mode === 'VIEW' && !this.isRouteMode) {
      // Deselect routes when clicking in VIEW mode
      if (this.routeManager) {
        this.routeManager.deselectRoute();
      }
      return false; // Let camera handle it
    }

    const result = this.raycast(event);
    if (!result) {
      // Clicked on empty space - deselect everything
      if (this.routeManager) {
        this.routeManager.deselectRoute();
      }
      this.objectManager.deselectObject();
      return false;
    }

    if (this.isRouteMode) {
      // Route creation is handled by routes.js
      return false;
    }

    if (result.type === 'object') {
      // Deselect route if selecting object
      if (this.routeManager) {
        this.routeManager.deselectRoute();
      }
      // Select object
      this.objectManager.selectObject(result.object.id);
      
      // Start dragging if in edit mode
      if (this.mode === 'EDIT') {
        this.isDraggingObject = true;
        this.dragObject = result.object;
        this.dragStartPosition = new THREE.Vector2(event.clientX, event.clientY);
      }
      return true;
    } else if (result.type === 'route') {
      // Deselect object if selecting route
      this.objectManager.deselectObject();
      // Select route
      if (this.routeManager) {
        this.routeManager.selectRoute(result.route.id);
      }
      return true;
    } else if (result.type === 'tile') {
      if (this.selectedObjectType) {
        // Place object on tile
        this.objectManager.createObject(this.selectedObjectType, result.position);
        return true;
      } else {
        // Clicked on empty tile - deselect everything
        if (this.routeManager) {
          this.routeManager.deselectRoute();
        }
        this.objectManager.deselectObject();
        return false;
      }
    }

    return false;
  }

  handleMouseMove(event) {
    if (this.isDraggingObject && this.dragObject) {
      const result = this.raycast(event);
      if (result && result.type === 'tile') {
        this.objectManager.moveObject(this.dragObject.id, result.position);
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
    if (this.mode !== 'EDIT' && !this.isRouteMode) {
      return false;
    }

    const result = this.raycast(event);
    if (result && result.type === 'object') {
      // Show properties panel (handled by UI)
      return result.object;
    } else if (result && result.type === 'route') {
      // Show route properties panel
      return result.route;
    }

    return null;
  }

  deleteSelectedRoute() {
    if (this.routeManager && this.routeManager.getSelectedRoute()) {
      const route = this.routeManager.getSelectedRoute();
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

