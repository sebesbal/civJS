import * as THREE from 'three';

export class RouteManager {
  constructor(scene, tilemap = null) {
    this.scene = scene;
    this.tilemap = tilemap;
    this.routes = [];
    this.nextRouteId = 0;
    this.currentRouteWaypoints = [];
    this.isCreatingRoute = false;
    this.previewLine = null;
    this.selectedRoute = null;
  }

  setTilemap(tilemap) {
    this.tilemap = tilemap;
  }

  // Get the Y position on top of the tile at the given x, z coordinates
  // Adds a small offset to keep routes above the tile surface
  getTileTopY(x, z) {
    if (this.tilemap) {
      const tileTop = this.tilemap.getTileTopSurface(x, z);
      // Add offset to keep route above tile (route tube radius is 0.05, so 0.1 should be safe)
      return tileTop + 0.2;
    }
    // Fallback: add small offset if tilemap not available
    return 0.25;
  }

  startRouteCreation() {
    this.isCreatingRoute = true;
    this.currentRouteWaypoints = [];
    this.createPreviewLine();
  }

  cancelRouteCreation() {
    this.isCreatingRoute = false;
    this.currentRouteWaypoints = [];
    this.removePreviewLine();
  }

  addWaypoint(position) {
    if (!this.isCreatingRoute) return;

    // Get tile top surface Y position
    const tileTopY = this.getTileTopY(position.x, position.z);
    
    // Add waypoint on top of tile
    this.currentRouteWaypoints.push(new THREE.Vector3(position.x, tileTopY, position.z));
    
    // Update preview line (without mouse position since we just added a waypoint)
    this.updatePreviewLine(null);
  }

  finishRoute() {
    if (this.currentRouteWaypoints.length < 2) {
      this.cancelRouteCreation();
      return null;
    }

    // Create the route
    const route = this.createRoute(this.currentRouteWaypoints);
    this.routes.push(route);
    
    // Reset creation state
    this.isCreatingRoute = false;
    this.currentRouteWaypoints = [];
    this.removePreviewLine();
    
    return route;
  }

  createRoute(waypoints, routeId = null) {
    if (waypoints.length < 2) return null;

    // Use provided ID or generate new one
    const id = routeId !== null ? routeId : this.nextRouteId++;
    if (routeId !== null && routeId >= this.nextRouteId) {
      this.nextRouteId = routeId + 1;
    }
    
    // Create spline curve
    const curve = new THREE.CatmullRomCurve3(waypoints, false, 'centripetal');
    
    // Generate points along the curve
    const points = curve.getPoints(50);
    
    // Create geometry for the route line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create material
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 3
    });
    
    // Create the line
    const line = new THREE.Line(geometry, material);
    
    // Also create a tube for a more visible 3D route
    const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00aa00,
      emissiveIntensity: 0.3
    });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    
    this.scene.add(line);
    this.scene.add(tube);
    
    const routeData = {
      id: id,
      waypoints: waypoints,
      curve: curve,
      line: line,
      tube: tube,
      geometry: geometry,
      tubeGeometry: tubeGeometry,
      material: material,
      tubeMaterial: tubeMaterial,
      originalLineMaterial: material,
      originalTubeMaterial: tubeMaterial,
      highlightLineMaterial: null,
      highlightTubeMaterial: null
    };
    
    return routeData;
  }

  createPreviewLine() {
    if (this.previewLine) {
      this.removePreviewLine();
    }

    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineDashedMaterial({
      color: 0xffff00,
      dashSize: 0.2,
      gapSize: 0.1,
      linewidth: 3,
      depthTest: true,
      depthWrite: false
    });
    
    this.previewLine = new THREE.Line(geometry, material);
    this.previewLine.renderOrder = 1000; // Render on top
    this.scene.add(this.previewLine);
  }

  updatePreviewLine(mousePosition = null) {
    if (!this.previewLine) return;

    // Build waypoints array including mouse position if available
    const previewWaypoints = [...this.currentRouteWaypoints];
    
    // Add mouse position as temporary endpoint if we have at least one waypoint
    if (mousePosition && previewWaypoints.length > 0) {
      // Get tile top surface Y position for the mouse position
      const tileTopY = this.getTileTopY(mousePosition.x, mousePosition.z);
      previewWaypoints.push(new THREE.Vector3(mousePosition.x, tileTopY, mousePosition.z));
    }

    // Need at least 2 points to show a line
    if (previewWaypoints.length < 2) {
      this.previewLine.geometry.setFromPoints([]);
      return;
    }

    // Create temporary curve for preview
    const curve = new THREE.CatmullRomCurve3(previewWaypoints, false, 'centripetal');
    const points = curve.getPoints(50);
    
    // Update geometry
    this.previewLine.geometry.setFromPoints(points);
    this.previewLine.geometry.attributes.position.needsUpdate = true;
    
    // Recompute line distances for dashed material
    this.previewLine.computeLineDistances();
  }

  removePreviewLine() {
    if (this.previewLine) {
      this.scene.remove(this.previewLine);
      this.previewLine.geometry.dispose();
      this.previewLine.material.dispose();
      this.previewLine = null;
    }
  }

  selectRoute(routeId) {
    this.deselectRoute();
    
    const route = this.routes.find(r => r.id === routeId);
    if (!route) return null;

    // Create highlight materials
    const highlightLineMaterial = new THREE.LineBasicMaterial({
      color: 0xffff00,
      linewidth: 4
    });
    
    const highlightTubeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xaaaa00,
      emissiveIntensity: 0.5
    });
    
    route.highlightLineMaterial = highlightLineMaterial;
    route.highlightTubeMaterial = highlightTubeMaterial;
    route.line.material = highlightLineMaterial;
    route.tube.material = highlightTubeMaterial;
    
    this.selectedRoute = route;
    return route;
  }

  deselectRoute() {
    if (this.selectedRoute) {
      this.selectedRoute.line.material = this.selectedRoute.originalLineMaterial;
      this.selectedRoute.tube.material = this.selectedRoute.originalTubeMaterial;
      
      if (this.selectedRoute.highlightLineMaterial) {
        this.selectedRoute.highlightLineMaterial.dispose();
        this.selectedRoute.highlightLineMaterial = null;
      }
      if (this.selectedRoute.highlightTubeMaterial) {
        this.selectedRoute.highlightTubeMaterial.dispose();
        this.selectedRoute.highlightTubeMaterial = null;
      }
      
      this.selectedRoute = null;
    }
  }

  removeRoute(routeId) {
    const index = this.routes.findIndex(route => route.id === routeId);
    if (index === -1) return false;

    const route = this.routes[index];
    
    // Deselect if this route is selected
    if (this.selectedRoute && this.selectedRoute.id === routeId) {
      this.deselectRoute();
    }
    
    this.scene.remove(route.line);
    this.scene.remove(route.tube);
    route.geometry.dispose();
    route.tubeGeometry.dispose();
    route.material.dispose();
    route.tubeMaterial.dispose();
    
    if (route.highlightLineMaterial) {
      route.highlightLineMaterial.dispose();
    }
    if (route.highlightTubeMaterial) {
      route.highlightTubeMaterial.dispose();
    }
    
    this.routes.splice(index, 1);
    return true;
  }

  getAllRoutes() {
    return this.routes;
  }

  getRouteById(id) {
    return this.routes.find(route => route.id === id);
  }

  clearAll() {
    this.routes.forEach(route => {
      this.scene.remove(route.line);
      this.scene.remove(route.tube);
      route.geometry.dispose();
      route.tubeGeometry.dispose();
      route.material.dispose();
      route.tubeMaterial.dispose();
    });
    this.routes = [];
    this.removePreviewLine();
  }

  isInRouteCreationMode() {
    return this.isCreatingRoute;
  }

  getCurrentWaypoints() {
    return this.currentRouteWaypoints;
  }

  getSelectedRoute() {
    return this.selectedRoute;
  }

  // Get all route meshes for raycasting
  getAllRouteMeshes() {
    const meshes = [];
    this.routes.forEach(route => {
      meshes.push(route.line);
      meshes.push(route.tube);
    });
    return meshes;
  }

  // Find route by mesh (line or tube)
  findRouteByMesh(mesh) {
    return this.routes.find(route => route.line === mesh || route.tube === mesh);
  }

  // Serialize routes to data array
  serialize() {
    const routes = this.routes.map(route => {
      const waypoints = route.waypoints.map(wp => ({
        x: wp.x,
        y: wp.y,
        z: wp.z
      }));
      return {
        id: route.id,
        waypoints: waypoints
      };
    });
    
    return {
      routes: routes,
      nextRouteId: this.nextRouteId
    };
  }

  // Load routes from serialized data
  loadFromData(routesData, nextRouteId) {
    // Clear existing routes
    this.clearAll();
    
    // Set next route ID
    this.nextRouteId = nextRouteId || 0;
    
    // Recreate routes with their original IDs
    if (routesData && Array.isArray(routesData)) {
      routesData.forEach(routeData => {
        // Use saved waypoints, but update Y positions to match current tile top surfaces
        const waypoints = routeData.waypoints.map(wp => {
          // If tilemap is available, use actual tile top surface
          const yPosition = this.tilemap ? this.tilemap.getTileTopSurface(wp.x, wp.z) : wp.y;
          return new THREE.Vector3(wp.x, yPosition, wp.z);
        });
        this.createRoute(waypoints, routeData.id);
      });
    }
  }
}

