import * as THREE from 'three';
import { createTilemap } from './tilemap.js';

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
const tiles = createTilemap(scene);

// Mouse camera controls
let isDragging = false;
let previousMousePosition = {x: 0, y: 0};

// Zoom settings
const minDistance = 5;
const maxDistance = 50;
let currentZoomDistance = camera.position.distanceTo(cameraTarget);

const onMouseDown = (event) => {
  isDragging = true;
  previousMousePosition = {x: event.clientX, y: event.clientY};
};

const onMouseMove = (event) => {
  if (!isDragging) return;
  
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
};

const onMouseUp = () => {
  isDragging = false;
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

// Add event listeners
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mouseup', onMouseUp);
renderer.domElement.addEventListener('mouseleave', onMouseUp); // Stop dragging when mouse leaves
renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

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