import * as THREE from 'three';
import { createTilemap } from './tilemap.js';
import { Editor } from './editor.js';
import { UIManager } from './ui.js';
import { RouteManager } from './routes.js';
import { SaveLoadManager } from './save-load.js';

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Camera positioned at an angle looking down at the map (isometric style)
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 20, 15);
const cameraTarget = new THREE.Vector3(0, 0, 0);
camera.lookAt(cameraTarget);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Create tilemap
let tilemap = createTilemap(scene, { mapSize: 40, tileSize: 1, tileHeight: 0.1 });

// Initialize systems
const routeManager = new RouteManager(scene, tilemap);
let editor = new Editor(scene, camera, renderer, tilemap.tiles, tilemap.getConfig(), routeManager);
// Set tilemap reference in object manager for proper object positioning
editor.getObjectManager().setTilemap(tilemap);
const ui = new UIManager();
const saveLoadManager = new SaveLoadManager();

// Connect UI callbacks
ui.onModeChange = (mode) => {
  editor.setMode(mode);
  if (mode === 'VIEW') {
    routeManager.cancelRouteCreation();
  }
};

ui.onObjectTypeSelect = (type) => {
  editor.setSelectedObjectType(type);
};

ui.onRouteModeToggle = (enabled) => {
  if (enabled) {
    routeManager.startRouteCreation();
    editor.setRouteMode(true);
    editor.setMode('EDIT'); // Switch to edit mode for route creation
  } else {
    routeManager.cancelRouteCreation();
    editor.setRouteMode(false);
  }
};

ui.onObjectDelete = (objectId) => {
  editor.deleteObject(objectId);
};

ui.onRouteDelete = (routeId) => {
  routeManager.removeRoute(routeId);
};

// Save/Load callbacks
ui.onSaveGame = () => {
  try {
    const objectManager = editor.getObjectManager();
    const gameStateJson = saveLoadManager.saveGameState(
      tilemap,
      objectManager,
      routeManager
    );
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    saveLoadManager.downloadGameState(gameStateJson, `game-save-${timestamp}.json`);
    console.log('Game saved successfully');
  } catch (error) {
    console.error('Failed to save game:', error);
    alert('Failed to save game: ' + error.message);
  }
};

ui.onLoadGame = async (file) => {
  try {
    // Read file
    const fileContent = await saveLoadManager.readFile(file);
    
    // Parse game state
    const gameState = await saveLoadManager.loadGameState(fileContent);
    
    // Clear existing scene objects (keep lights and camera)
    tilemap.clear();
    
    const objectManager = editor.getObjectManager();
    objectManager.clearAll();
    routeManager.clearAll();
    
    // Recreate tilemap with saved data
    tilemap = createTilemap(scene, {
      mapSize: gameState.mapConfig.mapSize,
      tileSize: gameState.mapConfig.tileSize,
      tileHeight: gameState.mapConfig.tileHeight,
      tileData: gameState.tiles
    });
    
    // Recreate editor with new tiles and map config
    editor = new Editor(scene, camera, renderer, tilemap.tiles, tilemap.getConfig(), routeManager);
    
    // Reconnect editor callbacks
    ui.onModeChange = (mode) => {
      editor.setMode(mode);
      if (mode === 'VIEW') {
        routeManager.cancelRouteCreation();
      }
    };
    
    ui.onObjectTypeSelect = (type) => {
      editor.setSelectedObjectType(type);
    };
    
    ui.onObjectDelete = (objectId) => {
      editor.deleteObject(objectId);
    };
    
    ui.onRouteModeToggle = (enabled) => {
      if (enabled) {
        routeManager.startRouteCreation();
        editor.setRouteMode(true);
        editor.setMode('EDIT'); // Switch to edit mode for route creation
      } else {
        routeManager.cancelRouteCreation();
        editor.setRouteMode(false);
      }
    };
    
    // Load objects
    const newObjectManager = editor.getObjectManager();
    newObjectManager.setTilemap(tilemap); // Set tilemap reference for proper positioning
    newObjectManager.loadFromData(gameState.objects, gameState.nextObjectId);
    
    // Load routes
    routeManager.setTilemap(tilemap); // Set tilemap reference for proper positioning
    routeManager.loadFromData(gameState.routes, gameState.nextRouteId);
    
    // Reset camera to default position
    camera.position.set(15, 20, 15);
    cameraTarget.set(0, 0, 0);
    camera.lookAt(cameraTarget);
    currentZoomDistance = camera.position.distanceTo(cameraTarget);
    
    console.log('Game loaded successfully');
  } catch (error) {
    console.error('Failed to load game:', error);
    alert('Failed to load game: ' + error.message);
  }
};

// Mouse camera controls
let isDragging = false;
let previousMousePosition = {x: 0, y: 0};
let isCameraDragging = false;

// Zoom settings
const minDistance = 5;
const maxDistance = 50;
let currentZoomDistance = camera.position.distanceTo(cameraTarget);

const onMouseDown = (event) => {
  const currentMode = ui.getCurrentMode();
  const isRouteMode = routeManager.isInRouteCreationMode();
  
  // Handle route creation
  if (isRouteMode) {
    const result = editor.raycast(event);
    if (result && result.type === 'tile') {
      routeManager.addWaypoint(result.position);
    }
    return;
  }
  
  // Try editor interaction first
  const handled = editor.handleMouseDown(event);
  if (handled) {
    isCameraDragging = false;
    isDragging = true;
    previousMousePosition = {x: event.clientX, y: event.clientY};
    return;
  }
  
  // Allow camera dragging in VIEW mode, or in EDIT mode when clicking empty space
  // Also allow with Shift modifier in any mode
  if (currentMode === 'VIEW' || currentMode === 'EDIT' || event.shiftKey) {
    isCameraDragging = true;
    isDragging = true;
    previousMousePosition = {x: event.clientX, y: event.clientY};
  }
};

const onMouseMove = (event) => {
  // Handle editor dragging
  editor.handleMouseMove(event);
  
  // Update route preview if in route creation mode
  if (routeManager.isInRouteCreationMode()) {
    const result = editor.raycast(event);
    if (result && result.type === 'tile') {
      routeManager.updatePreviewLine(result.position);
    } else {
      routeManager.updatePreviewLine(null);
    }
  }
  
  // Handle camera dragging
  if (isDragging && isCameraDragging) {
    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;
    
    // Pan speed
    const panSpeed = 0.025;
    
    // Calculate right vector (perpendicular to camera direction, horizontal)
    const right = new THREE.Vector3();
    camera.getWorldDirection(right);
    right.cross(camera.up).normalize();
    
    // Calculate forward vector (camera direction projected onto horizontal plane)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep horizontal
    forward.normalize();
    
    // Move camera and target together to maintain angle
    const moveRight = right.multiplyScalar(-deltaX * panSpeed);
    const moveForward = forward.multiplyScalar(deltaY * panSpeed);
    const move = new THREE.Vector3().addVectors(moveRight, moveForward);
    
    camera.position.add(move);
    cameraTarget.add(move);
    camera.lookAt(cameraTarget);
    
    previousMousePosition = {x: event.clientX, y: event.clientY};
  }
};

const onMouseUp = (event) => {
  editor.handleMouseUp(event);
  isDragging = false;
  isCameraDragging = false;
};

const onWheel = (event) => {
  event.preventDefault();
  
  // Exponential zoom for smoother feel
  const zoomFactor = 1.1;
  const zoomDelta = event.deltaY * 0.005; // Normalize wheel delta (inverted: scroll down zooms in)
  
  // Calculate current distance
  currentZoomDistance = camera.position.distanceTo(cameraTarget);
  
  // Apply exponential zoom
  let newDistance = currentZoomDistance * Math.pow(zoomFactor, zoomDelta);
  
  // Smooth clamping with easing near limits
  const easingRange = 2.0; // Distance from limit where easing starts
  if (newDistance < minDistance) {
    const distanceToLimit = newDistance - minDistance;
    if (distanceToLimit > -easingRange) {
      // Ease into the limit - reduce zoom speed as we approach
      const easeFactor = Math.max(0, (distanceToLimit + easingRange) / easingRange);
      newDistance = currentZoomDistance + (newDistance - currentZoomDistance) * easeFactor;
      newDistance = Math.max(newDistance, minDistance);
    } else {
      newDistance = minDistance;
    }
  } else if (newDistance > maxDistance) {
    const distanceToLimit = newDistance - maxDistance;
    if (distanceToLimit < easingRange) {
      // Ease into the limit - reduce zoom speed as we approach
      const easeFactor = Math.max(0, (easingRange - distanceToLimit) / easingRange);
      newDistance = currentZoomDistance + (newDistance - currentZoomDistance) * easeFactor;
      newDistance = Math.min(newDistance, maxDistance);
    } else {
      newDistance = maxDistance;
    }
  }
  
  // Update camera position smoothly
  const direction = new THREE.Vector3().subVectors(cameraTarget, camera.position).normalize();
  camera.position.copy(cameraTarget).add(direction.multiplyScalar(-newDistance));
  currentZoomDistance = newDistance;
  
  // Update camera to look at target
  camera.lookAt(cameraTarget);
};

// Right-click handler for properties panel
const onContextMenu = (event) => {
  event.preventDefault();
  const currentMode = ui.getCurrentMode();
  const isRouteMode = routeManager.isInRouteCreationMode();
  
  // Finish route creation on right-click if in route mode
  if (isRouteMode) {
    routeManager.finishRoute();
    ui.toggleRouteMode(); // This will call the callback to disable route mode
    return;
  }
  
  // Show properties panel for objects or routes in edit mode
  if (currentMode === 'EDIT') {
    const result = editor.handleRightClick(event);
    if (result) {
      // Check if it's a route or object
      if (result.id !== undefined && result.waypoints !== undefined) {
        // It's a route
        ui.showRoutePropertiesPanel(result);
      } else {
        // It's an object
        ui.showPropertiesPanel(result);
      }
    } else {
      ui.hidePropertiesPanel();
    }
  }
};

// Double-click to finish route
const onDoubleClick = (event) => {
  if (routeManager.isInRouteCreationMode()) {
    routeManager.finishRoute();
    ui.toggleRouteMode(); // This will call the callback to disable route mode
  }
};

// Keyboard handler for delete key
const onKeyDown = (event) => {
  // Delete key
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const currentMode = ui.getCurrentMode();
    
    // Don't delete during route creation
    if (routeManager.isInRouteCreationMode()) {
      return;
    }
    
    // Delete selected route in EDIT mode
    if (currentMode === 'EDIT') {
      if (editor.deleteSelectedRoute()) {
        ui.hidePropertiesPanel();
        return;
      }
    }
    
    // Delete selected object
    const selectedObject = editor.getSelectedObject();
    if (selectedObject) {
      editor.deleteObject(selectedObject.id);
      ui.hidePropertiesPanel();
    }
  }
};

// Add event listeners
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mouseup', onMouseUp);
renderer.domElement.addEventListener('mouseleave', onMouseUp); // Stop dragging when mouse leaves
renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
renderer.domElement.addEventListener('contextmenu', onContextMenu);
renderer.domElement.addEventListener('dblclick', onDoubleClick);
window.addEventListener('keydown', onKeyDown);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();