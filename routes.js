import * as THREE from 'three';

export class RouteManager {
  constructor(scene) {
    this.scene = scene;
    this.routes = [];
    this.nextRouteId = 0;
    this.currentRouteWaypoints = [];
    this.isCreatingRoute = false;
    this.previewLine = null;
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

    // Add waypoint
    this.currentRouteWaypoints.push(new THREE.Vector3(position.x, position.y + 0.1, position.z));
    
    // Update preview line
    this.updatePreviewLine();
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
      tubeMaterial: tubeMaterial
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
      dashSize: 0.1,
      gapSize: 0.1,
      linewidth: 2
    });
    
    this.previewLine = new THREE.Line(geometry, material);
    this.previewLine.computeLineDistances();
    this.scene.add(this.previewLine);
  }

  updatePreviewLine() {
    if (!this.previewLine || this.currentRouteWaypoints.length < 2) {
      if (this.previewLine) {
        this.previewLine.geometry.setFromPoints([]);
      }
      return;
    }

    // Create temporary curve for preview
    const curve = new THREE.CatmullRomCurve3(this.currentRouteWaypoints, false, 'centripetal');
    const points = curve.getPoints(50);
    this.previewLine.geometry.setFromPoints(points);
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

  removeRoute(routeId) {
    const index = this.routes.findIndex(route => route.id === routeId);
    if (index === -1) return false;

    const route = this.routes[index];
    
    this.scene.remove(route.line);
    this.scene.remove(route.tube);
    route.geometry.dispose();
    route.tubeGeometry.dispose();
    route.material.dispose();
    route.tubeMaterial.dispose();
    
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
        const waypoints = routeData.waypoints.map(wp => 
          new THREE.Vector3(wp.x, wp.y, wp.z)
        );
        this.createRoute(waypoints, routeData.id);
      });
    }
  }
}

