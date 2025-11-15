import * as THREE from 'three';
import { createTilemap } from './tilemap.js';
import { Editor } from './editor.js';
import { UIManager } from './ui.js';
import { RouteManager } from './routes.js';
import { SaveLoadManager } from './save-load.js';
import { CameraController } from './camera-controller.js';

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Camera positioned at an angle looking down at the map (isometric style)
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraTarget = new THREE.Vector3(0, 0, 0);
const cameraController = new CameraController(camera, cameraTarget, {
  minDistance: 5,
  maxDistance: 50
});
cameraController.reset(); // Initialize camera position

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

// Helper function to setup UI callbacks
function setupUICallbacks(ui, editor, routeManager) {
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
      editor.setMode('EDIT');
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
}

// Connect UI callbacks
setupUICallbacks(ui, editor, routeManager);

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
    
    // Reconnect UI callbacks
    setupUICallbacks(ui, editor, routeManager);
    
    // Load objects
    const newObjectManager = editor.getObjectManager();
    newObjectManager.setTilemap(tilemap); // Set tilemap reference for proper positioning
    newObjectManager.loadFromData(gameState.objects, gameState.nextObjectId);
    
    // Load routes
    routeManager.setTilemap(tilemap); // Set tilemap reference for proper positioning
    routeManager.loadFromData(gameState.routes, gameState.nextRouteId);
    
    // Reset camera to default position
    cameraController.reset();
    
    console.log('Game loaded successfully');
  } catch (error) {
    console.error('Failed to load game:', error);
    alert('Failed to load game: ' + error.message);
  }
};

// Mouse event handlers
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
    cameraController.handleMouseDown(event, false);
    return;
  }
  
  // Allow camera dragging in VIEW mode, or in EDIT mode when clicking empty space
  // Also allow with Shift modifier in any mode
  if (currentMode === 'VIEW' || currentMode === 'EDIT' || event.shiftKey) {
    cameraController.handleMouseDown(event, true);
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
  cameraController.handleMouseMove(event);
};

const onMouseUp = (event) => {
  editor.handleMouseUp(event);
  cameraController.handleMouseUp();
};

const onWheel = (event) => {
  cameraController.handleWheel(event);
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