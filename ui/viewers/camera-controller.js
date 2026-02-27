import * as THREE from 'three';

export class CameraController {
  constructor(camera, target, options = {}) {
    this.camera = camera;
    this.target = target;
    this.minDistance = options.minDistance || 5;
    this.maxDistance = options.maxDistance || 50;
    this.panSpeed = options.panSpeed || 0.025;
    this.zoomFactor = options.zoomFactor || 1.1;
    
    this.currentZoomDistance = camera.position.distanceTo(target);
    this.isDragging = false;
    this.isCameraDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
  }

  handleMouseDown(event, canDrag = true) {
    if (canDrag) {
      this.isCameraDragging = true;
      this.isDragging = true;
      this.previousMousePosition = { x: event.clientX, y: event.clientY };
    } else {
      this.isCameraDragging = false;
      this.isDragging = false;
    }
  }

  handleMouseMove(event) {
    if (this.isDragging && this.isCameraDragging) {
      const deltaX = event.clientX - this.previousMousePosition.x;
      const deltaY = event.clientY - this.previousMousePosition.y;
      
      // Calculate right vector (perpendicular to camera direction, horizontal)
      const right = new THREE.Vector3();
      this.camera.getWorldDirection(right);
      right.cross(this.camera.up).normalize();
      
      // Calculate forward vector (camera direction projected onto horizontal plane)
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0; // Keep horizontal
      forward.normalize();
      
      // Move camera and target together to maintain angle
      const moveRight = right.multiplyScalar(-deltaX * this.panSpeed);
      const moveForward = forward.multiplyScalar(deltaY * this.panSpeed);
      const move = new THREE.Vector3().addVectors(moveRight, moveForward);
      
      this.camera.position.add(move);
      this.target.add(move);
      this.camera.lookAt(this.target);
      
      this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }
  }

  handleMouseUp() {
    this.isDragging = false;
    this.isCameraDragging = false;
  }

  handleWheel(event) {
    event.preventDefault();
    
    const zoomDelta = event.deltaY * 0.005;
    this.currentZoomDistance = this.camera.position.distanceTo(this.target);
    
    // Apply exponential zoom
    let newDistance = this.currentZoomDistance * Math.pow(this.zoomFactor, zoomDelta);
    
    // Smooth clamping with easing near limits
    const easingRange = 2.0;
    if (newDistance < this.minDistance) {
      const distanceToLimit = newDistance - this.minDistance;
      if (distanceToLimit > -easingRange) {
        const easeFactor = Math.max(0, (distanceToLimit + easingRange) / easingRange);
        newDistance = this.currentZoomDistance + (newDistance - this.currentZoomDistance) * easeFactor;
        newDistance = Math.max(newDistance, this.minDistance);
      } else {
        newDistance = this.minDistance;
      }
    } else if (newDistance > this.maxDistance) {
      const distanceToLimit = newDistance - this.maxDistance;
      if (distanceToLimit < easingRange) {
        const easeFactor = Math.max(0, (easingRange - distanceToLimit) / easingRange);
        newDistance = this.currentZoomDistance + (newDistance - this.currentZoomDistance) * easeFactor;
        newDistance = Math.min(newDistance, this.maxDistance);
      } else {
        newDistance = this.maxDistance;
      }
    }
    
    // Update camera position smoothly
    const direction = new THREE.Vector3()
      .subVectors(this.target, this.camera.position)
      .normalize();
    this.camera.position.copy(this.target).add(direction.multiplyScalar(-newDistance));
    this.currentZoomDistance = newDistance;
    
    // Update camera to look at target
    this.camera.lookAt(this.target);
  }

  reset() {
    this.camera.position.set(15, 20, 15);
    this.target.set(0, 0, 0);
    this.camera.lookAt(this.target);
    this.currentZoomDistance = this.camera.position.distanceTo(this.target);
  }
}

