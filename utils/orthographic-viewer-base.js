/**
 * Base class for orthographic 2D/3D viewers with proper zoom and resize handling.
 * 
 * This class handles the common pattern of:
 * - Orthographic camera setup with zoom controls
 * - Camera panning
 * - Zoom constraints based on content bounds
 * - Proper resize handling with timing fixes for tab-based UIs
 * 
 * Subclasses must implement:
 * - getContentBoundingBox(): { minX, maxX, minY, maxY }
 * - hasContent(): boolean
 * - Additional Three.js scene setup (lighting, objects, etc.)
 */
import * as THREE from 'three';

export class OrthographicViewerBase {
  constructor() {
    // Container elements
    this.canvasContainer = null;
    
    // Three.js core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // Camera controls
    this.isPanning = false;
    this.panStart = new THREE.Vector2();
    this.cameraStartPosition = new THREE.Vector2();
    this.minZoom = 2;
    this.maxZoom = 1000;
    this.currentZoom = 20;
    this.calculatedMaxZoom = null;
    
    // Initialization state
    this._animationStarted = false;
  }

  /**
   * Initialize the Three.js scene with orthographic camera.
   * Call this after setting up canvasContainer.
   * @param {Object} options - Configuration options
   * @param {number} options.initialZoom - Initial zoom level (default: 20)
   * @param {number} options.minZoom - Minimum zoom level (default: 2)
   * @param {number} options.maxZoom - Maximum zoom level (default: 1000)
   * @param {number} options.backgroundColor - Background color (default: 0x1a1a1a)
   */
  initializeThreeJS(options = {}) {
    const {
      initialZoom = 20,
      minZoom = 2,
      maxZoom = 1000,
      backgroundColor = 0x1a1a1a
    } = options;

    this.currentZoom = initialZoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(backgroundColor);

    // Create orthographic camera
    const aspect = 1; // Will be updated on resize
    const viewSize = this.currentZoom;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      0.1, 1000
    );
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);

    // Create renderer with high quality settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      precision: "highp"
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(800, 600); // Initial size, will be updated on resize
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    if (this.canvasContainer) {
      this.canvasContainer.appendChild(this.renderer.domElement);
    }

    // Setup camera controls
    this.setupCameraControls();

    // Setup resize handling
    this.setupResizeHandling();

    // Start animation loop
    if (!this._animationStarted) {
      this._animationStarted = true;
      this.animate();
    }
  }

  /**
   * Setup camera panning and zooming controls.
   */
  setupCameraControls() {
    if (!this.renderer) return;

    const canvas = this.renderer.domElement;

    // Mouse down - start panning
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !this.handleMouseDownBeforePan(e)) {
        this.isPanning = true;
        this.panStart.set(e.clientX, e.clientY);
        this.cameraStartPosition.set(this.camera.position.x, this.camera.position.y);
        canvas.style.cursor = 'grabbing';
      }
    });

    // Mouse move - pan camera
    canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const deltaX = e.clientX - this.panStart.x;
        const deltaY = e.clientY - this.panStart.y;

        const rect = canvas.getBoundingClientRect();
        const aspect = rect.width / rect.height || 1;
        const viewSize = this.currentZoom;
        const worldDeltaX = (deltaX / rect.width) * (viewSize * 2 * aspect);
        const worldDeltaY = -(deltaY / rect.height) * (viewSize * 2);

        this.camera.position.x = this.cameraStartPosition.x - worldDeltaX;
        this.camera.position.y = this.cameraStartPosition.y - worldDeltaY;
        this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);

        this.constrainCameraToContentBounds();
      }
    });

    // Mouse up - stop panning
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isPanning = false;
        canvas.style.cursor = 'default';
      }
    });

    // Mouse leave - stop panning
    canvas.addEventListener('mouseleave', () => {
      this.isPanning = false;
      canvas.style.cursor = 'default';
    });

    // Wheel - zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const zoomSpeed = 0.002;
      const zoomDelta = e.deltaY * zoomSpeed;
      let newZoom = this.currentZoom * (1 + zoomDelta);

      // Calculate max zoom if not already calculated
      if (this.calculatedMaxZoom === null) {
        this.calculateMaxZoom();
      }

      // Clamp zoom to limits
      const maxZoom = this.calculatedMaxZoom || this.maxZoom;
      newZoom = Math.max(this.minZoom, Math.min(maxZoom, newZoom));

      if (newZoom !== this.currentZoom) {
        this.currentZoom = newZoom;
        this.updateCameraViewSize();
        this.constrainCameraToContentBounds();
      }
    });
  }

  /**
   * Hook for subclasses to handle mouse down before panning starts.
   * Return true to prevent panning (e.g., when clicking on an object).
   * @param {MouseEvent} event
   * @returns {boolean} - True if the event was handled and panning should be prevented
   */
  handleMouseDownBeforePan(event) {
    return false; // Default: allow panning
  }

  /**
   * Setup resize handling with proper timing for tab-based UIs.
   */
  setupResizeHandling() {
    if (!this.canvasContainer) return;

    window.addEventListener('resize', () => this.handleResize());
    new ResizeObserver(() => this.handleResize()).observe(this.canvasContainer);
  }

  /**
   * Handle container resize.
   */
  handleResize() {
    if (!this.renderer || !this.canvasContainer || !this.camera) return;

    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;

    // Skip if container is not visible (0 dimensions)
    if (width === 0 || height === 0) return;

    // Update renderer size
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(width, height);

    // Update camera view size
    this.updateCameraViewSize();

    // Constrain camera to content bounds after resize
    this.constrainCameraToContentBounds();
  }

  /**
   * Update the orthographic camera bounds based on current zoom.
   */
  updateCameraViewSize() {
    if (!this.camera || !this.renderer) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    const viewSize = this.currentZoom;

    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Calculate the maximum zoom level based on content bounds.
   */
  calculateMaxZoom() {
    if (!this.hasContent()) {
      this.calculatedMaxZoom = 100;
      return;
    }

    const bbox = this.getContentBoundingBox();
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const maxDim = Math.max(width, height);

    if (maxDim === 0) {
      this.calculatedMaxZoom = 100;
      return;
    }

    // Calculate view size to fit the content with padding
    const padding = 2;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;

    let viewSize;
    if (width / height > aspect) {
      viewSize = (maxDim / 2) + padding;
    } else {
      viewSize = ((maxDim / 2) + padding) / aspect;
    }

    viewSize = Math.max(this.minZoom, viewSize);
    this.calculatedMaxZoom = viewSize;
  }

  /**
   * Constrain camera so viewport always stays within content bounds.
   */
  constrainCameraToContentBounds() {
    if (!this.camera || !this.renderer || !this.hasContent()) {
      return;
    }

    const contentBbox = this.getContentBoundingBox();

    // Get viewport dimensions
    const rect = this.renderer.domElement.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    const viewSize = this.currentZoom;

    // Calculate viewport bounds in world coordinates
    const viewportHalfWidth = viewSize * aspect;
    const viewportHalfHeight = viewSize;

    // Current viewport bounds
    const viewportLeft = this.camera.position.x - viewportHalfWidth;
    const viewportRight = this.camera.position.x + viewportHalfWidth;
    const viewportBottom = this.camera.position.y - viewportHalfHeight;
    const viewportTop = this.camera.position.y + viewportHalfHeight;

    // Content bounds with padding
    const nodePadding = 1.5;
    const contentLeft = contentBbox.minX - nodePadding;
    const contentRight = contentBbox.maxX + nodePadding;
    const contentBottom = contentBbox.minY - nodePadding;
    const contentTop = contentBbox.maxY + nodePadding;

    // Clamp camera position so viewport stays within content bounds
    let newCameraX = this.camera.position.x;
    let newCameraY = this.camera.position.y;

    // Constrain horizontally
    if (viewportRight > contentRight) {
      newCameraX = contentRight - viewportHalfWidth;
    }
    if (viewportLeft < contentLeft) {
      newCameraX = contentLeft + viewportHalfWidth;
    }

    // Constrain vertically
    if (viewportTop > contentTop) {
      newCameraY = contentTop - viewportHalfHeight;
    }
    if (viewportBottom < contentBottom) {
      newCameraY = contentBottom + viewportHalfHeight;
    }

    // If viewport is larger than content, center it
    const viewportWidth = viewportRight - viewportLeft;
    const viewportHeight = viewportTop - viewportBottom;
    const contentWidth = contentRight - contentLeft;
    const contentHeight = contentTop - contentBottom;

    if (viewportWidth > contentWidth) {
      newCameraX = (contentLeft + contentRight) / 2;
    }
    if (viewportHeight > contentHeight) {
      newCameraY = (contentBottom + contentTop) / 2;
    }

    // Update camera position if it changed
    if (newCameraX !== this.camera.position.x || newCameraY !== this.camera.position.y) {
      this.camera.position.x = newCameraX;
      this.camera.position.y = newCameraY;
      this.camera.lookAt(newCameraX, newCameraY, 0);
    }

    // Also constrain zoom - ensure zoom doesn't allow viewport to exceed content bounds
    const maxZoomForContent = Math.min(
      contentWidth / (2 * aspect),
      contentHeight / 2
    );

    // If current zoom is too large (viewport too large), reduce it
    if (this.currentZoom > maxZoomForContent) {
      this.currentZoom = maxZoomForContent;
      if (this.calculatedMaxZoom === null || this.currentZoom > this.calculatedMaxZoom) {
        this.calculatedMaxZoom = this.currentZoom;
      }
      this.updateCameraViewSize();
      this.constrainCameraToContentBounds();
    }
  }

  /**
   * Fit the view to show all content.
   */
  fitToScreen() {
    if (this.calculatedMaxZoom === null) {
      this.calculateMaxZoom();
    }

    if (!this.camera || !this.hasContent()) return;

    const bbox = this.getContentBoundingBox();

    // Use calculated max zoom
    const viewSize = this.calculatedMaxZoom || 20;

    // Update zoom to fit
    this.currentZoom = viewSize;
    this.updateCameraViewSize();

    // Center camera on content
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    this.camera.position.set(centerX, centerY, this.camera.position.z);
    this.camera.lookAt(centerX, centerY, 0);

    // Apply constraints
    this.constrainCameraToContentBounds();
  }

  /**
   * Mark content as ready and recalculate zoom constraints.
   * Call this after loading/initializing content (e.g., after loading economy data).
   * This fixes the timing issue when the tab is selected before content is loaded.
   */
  onContentReady() {
    // Recalculate zoom constraints now that content is available
    this.calculatedMaxZoom = null;
    this.calculateMaxZoom();
    this.constrainCameraToContentBounds();
    
    // Call handleResize to update camera with corrected zoom
    this.handleResize();
  }

  /**
   * Animation loop. Override animate() to add custom animations.
   */
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Call subclass animation hook
    this.onAnimate();
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Hook for subclasses to add custom animation logic.
   * Called every frame before rendering.
   */
  onAnimate() {
    // Override in subclass
  }

  /**
   * Get the bounding box of all content.
   * Must be implemented by subclasses.
   * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
   */
  getContentBoundingBox() {
    // Override in subclass
    return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
  }

  /**
   * Check if there is any content to display.
   * Must be implemented by subclasses.
   * @returns {boolean}
   */
  hasContent() {
    // Override in subclass
    return false;
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
    }
    // Subclasses should override and call super.dispose()
  }
}

