import * as THREE from 'three';
import { Tilemap } from './map-editor/tilemap.js';
import { MapEditor } from './map-editor/map-editor.js';
import { UIManager } from './ui.js';
import { RouteManager } from './map-editor/routes.js';
import { SaveLoadManager } from './map-editor/save-load.js';
import { CameraController } from './map-editor/camera-controller.js';
import { generateObjectTypesFromEconomy } from './map-editor/config/object-types.js';
import { RandomFactoryGenerator } from './simulation/random-factory-generator.js';
import { SimulationEngine } from './simulation/simulation-engine.js';
import { TradeRenderer } from './simulation/trade-renderer.js';

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
let tilemap = new Tilemap(scene, { mapSize: 40, tileSize: 1, tileHeight: 0.1 });

// Initialize systems
const routeManager = new RouteManager(scene, tilemap);
let mapEditor = new MapEditor(scene, camera, renderer, tilemap.tiles, tilemap.getConfig(), routeManager);
// Set tilemap reference in object manager for proper object positioning
mapEditor.getObjectManager().setTilemap(tilemap);
const ui = new UIManager();
ui.setRenderer(renderer); // Set renderer reference so UI can hide/show it
const saveLoadManager = new SaveLoadManager();

// Simulation engine and trade renderer (created lazily, initialized on first start)
let simulationEngine = null;
let tradeRenderer = null;

function getOrCreateSimulationEngine() {
  const economyManager = ui.economyEditorUI.economyManager;
  const objectManager = mapEditor.getObjectManager();
  if (!simulationEngine) {
    simulationEngine = new SimulationEngine(economyManager, objectManager, routeManager, tilemap);
    tradeRenderer = new TradeRenderer(scene, simulationEngine, tilemap);

    // Live refresh of properties panel on each tick
    simulationEngine.onTick = () => {
      const selectedObject = mapEditor.getSelectedObject();
      if (selectedObject && simulationEngine) {
        const actorState = simulationEngine.getActorState(selectedObject.id);
        if (actorState) {
          ui.showFactoryInspector(selectedObject, actorState, ui.economyEditorUI.economyManager);
        }
      }
    };
  } else {
    // Update references in case tilemap/mapEditor were recreated (e.g., after load)
    simulationEngine.economyManager = economyManager;
    simulationEngine.objectManager = objectManager;
    simulationEngine.routeManager = routeManager;
    simulationEngine.tilemap = tilemap;
    if (tradeRenderer) {
      tradeRenderer.tilemap = tilemap;
      tradeRenderer.simulationEngine = simulationEngine;
    }
  }
  return simulationEngine;
}

// Helper function to setup UI callbacks
function setupUICallbacks(ui, mapEditor, routeManager) {
  ui.onModeChange = (mode) => {
    mapEditor.setMode(mode);
    if (mode === 'VIEW') {
      routeManager.cancelRouteCreation();
    }
  };

  ui.onObjectTypeSelect = (type) => {
    mapEditor.setSelectedObjectType(type);
  };

  ui.onRouteModeToggle = (enabled) => {
    if (enabled) {
      routeManager.startRouteCreation();
      mapEditor.setRouteMode(true);
      mapEditor.setMode('EDIT');
    } else {
      routeManager.cancelRouteCreation();
      mapEditor.setRouteMode(false);
    }
  };

  ui.onObjectDelete = (objectId) => {
    mapEditor.deleteObject(objectId);
  };

  ui.onRouteDelete = (routeId) => {
    routeManager.removeRoute(routeId);
  };

  // Wire economy-driven object types to the ObjectManager
  ui.onObjectTypesChange = (objectTypes) => {
    mapEditor.getObjectManager().setObjectTypes(objectTypes);
  };
}

// Connect UI callbacks
setupUICallbacks(ui, mapEditor, routeManager);

// Economy Editor Save/Load callbacks
ui.onSaveEconomy = () => {
  if (ui.economyEditorUI) {
    ui.economyEditorUI.saveEconomy();
  }
};

ui.onLoadEconomy = async (file) => {
  if (ui.economyEditorUI) {
    await ui.economyEditorUI.loadEconomy(file);
  }
};

// Simulation callbacks
const randomFactoryGenerator = new RandomFactoryGenerator();

ui.onGenerateRandomFactories = (totalFactories = null) => {
  const economyManager = ui.economyEditorUI.economyManager;
  const objectManager = mapEditor.getObjectManager();
  const options = { totalFactories };
  const created = randomFactoryGenerator.generate(economyManager, objectManager, tilemap, options);
  const modeText = totalFactories ? `${totalFactories} (target)` : 'auto-scaled';
  console.log(`Generated ${created.length} factories (${modeText})`);
};

ui.onSimulationToggle = () => {
  const engine = getOrCreateSimulationEngine();
  if (engine.isRunning) {
    engine.stop();
    ui.setSimulationRunning(false);
  } else {
    engine.initialize();
    engine.start();
    ui.setSimulationRunning(true);
  }
};

ui.onSimulationSpeedChange = (speed) => {
  if (simulationEngine) {
    simulationEngine.setSpeed(speed);
  }
};

// Save/Load callbacks
ui.onSaveGame = () => {
  try {
    const objectManager = mapEditor.getObjectManager();
    const economyManager = ui.economyEditorUI.economyManager;
    const gameStateJson = saveLoadManager.saveGameState(
      tilemap,
      objectManager,
      routeManager,
      economyManager,
      simulationEngine
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
    
    // Stop simulation and clean up trade visuals
    if (simulationEngine) {
      simulationEngine.stop();
      ui.setSimulationRunning(false);
    }
    if (tradeRenderer) {
      tradeRenderer.dispose();
    }
    simulationEngine = null;
    tradeRenderer = null;

    // Clear existing scene objects (keep lights and camera)
    tilemap.clear();

    const objectManager = mapEditor.getObjectManager();
    objectManager.clearAll();
    routeManager.clearAll();
    
    // Recreate tilemap with saved data
    tilemap = new Tilemap(scene, {
      mapSize: gameState.mapConfig.mapSize,
      tileSize: gameState.mapConfig.tileSize,
      tileHeight: gameState.mapConfig.tileHeight,
      tileData: gameState.tiles
    });
    
    // Recreate map editor with new tiles and map config
    mapEditor = new MapEditor(scene, camera, renderer, tilemap.tiles, tilemap.getConfig(), routeManager);

    // Reconnect UI callbacks
    setupUICallbacks(ui, mapEditor, routeManager);

    // Restore economy data if included in save, then regenerate object types
    if (gameState.economy) {
      ui.economyEditorUI.economyManager.loadFromData(gameState.economy);
    }
    const objectTypes = generateObjectTypesFromEconomy(ui.economyEditorUI.economyManager);
    ui.mapEditorUI.setObjectTypes(objectTypes);

    // Load objects
    const newObjectManager = mapEditor.getObjectManager();
    newObjectManager.setTilemap(tilemap); // Set tilemap reference for proper positioning
    newObjectManager.setObjectTypes(objectTypes); // Set types before loading objects
    newObjectManager.loadFromData(gameState.objects, gameState.nextObjectId);
    
    // Load routes
    routeManager.setTilemap(tilemap); // Set tilemap reference for proper positioning
    routeManager.loadFromData(gameState.routes, gameState.nextRouteId);
    
    // Restore simulation state if present in save
    if (gameState.simulation) {
      const engine = getOrCreateSimulationEngine();
      engine.loadFromData(gameState.simulation);
      ui.setSimulationRunning(engine.isRunning);
    }

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
    const result = mapEditor.raycast(event);
    if (result && result.type === 'tile') {
      routeManager.addWaypoint(result.position);
    }
    return;
  }
  
  // Try map editor interaction first
  const result = mapEditor.handleMouseDown(event);
  if (result.handled) {
    // If an object was selected in VIEW mode, show the factory inspector
    if (currentMode === 'VIEW' && result.selectedObject) {
      const actorState = simulationEngine ? simulationEngine.getActorState(result.selectedObject.id) : null;
      if (actorState) {
        ui.showFactoryInspector(result.selectedObject, actorState, ui.economyEditorUI.economyManager);
      } else {
        ui.showPropertiesPanel(result.selectedObject);
      }
    }
    cameraController.handleMouseDown(event, false);
    return;
  }

  // Hide properties panel when clicking empty space in VIEW mode
  if (currentMode === 'VIEW') {
    ui.hidePropertiesPanel();
  }

  // Allow camera dragging in VIEW mode, or in EDIT mode when clicking empty space
  // Also allow with Shift modifier in any mode
  if (currentMode === 'VIEW' || currentMode === 'EDIT' || event.shiftKey) {
    cameraController.handleMouseDown(event, true);
  }
};

const onMouseMove = (event) => {
  // Handle map editor dragging
  mapEditor.handleMouseMove(event);
  
  // Update route preview if in route creation mode
  if (routeManager.isInRouteCreationMode()) {
    const result = mapEditor.raycast(event);
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
  mapEditor.handleMouseUp(event);
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
  
  // Show properties panel for objects or routes (in any mode)
  if (currentMode === 'EDIT' || currentMode === 'VIEW') {
    const result = mapEditor.handleRightClick(event);
    if (result) {
      // Check if it's a route or object
      if (result.id !== undefined && result.waypoints !== undefined) {
        // It's a route
        ui.showRoutePropertiesPanel(result);
      } else {
        // It's an object — show inspector if simulation is active, otherwise basic properties
        const actorState = simulationEngine ? simulationEngine.getActorState(result.id) : null;
        if (actorState) {
          ui.showFactoryInspector(result, actorState, ui.economyEditorUI.economyManager);
        } else {
          ui.showPropertiesPanel(result);
        }
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
      if (mapEditor.deleteSelectedRoute()) {
        ui.hidePropertiesPanel();
        return;
      }
    }
    
    // Delete selected object
    const selectedObject = mapEditor.getSelectedObject();
    if (selectedObject) {
      mapEditor.deleteObject(selectedObject.id);
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

function animate(timestamp) {
  requestAnimationFrame(animate);

  // Simulation tick (fixed timestep, decoupled from frame rate)
  if (simulationEngine) {
    simulationEngine.update(timestamp);
  }

  // Trade renderer (smooth animation every frame)
  if (tradeRenderer) {
    tradeRenderer.update();
  }

  renderer.render(scene, camera);
}
animate();