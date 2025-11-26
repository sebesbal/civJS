/**
 * ViewportController - A helper class for managing zoom and pan in a map/image viewer.
 * 
 * Manages two rectangles:
 * - viewport: The view surface (what's visible on screen)
 * - bounds: The resized/moved bounding box of the content to display
 * 
 * Ensures bounds always contains viewport.
 */
export class ViewportController {
  /**
   * @param {Object} viewportRect - Initial viewport rectangle {x, y, width, height}
   * @param {Object} boundsRect - Initial bounds rectangle {x, y, width, height}
   */
  constructor(viewportRect = { x: 0, y: 0, width: 800, height: 600 }, 
              boundsRect = { x: 0, y: 0, width: 800, height: 600 }) {
    this.viewport = { ...viewportRect };
    this.bounds = { ...boundsRect };
    
    // Ensure bounds contains viewport initially
    this._ensureBoundsContainsViewport();
  }

  /**
   * Sets the viewport rectangle (view surface).
   * @param {Object} rect - Rectangle {x, y, width, height}
   */
  setViewportRect(rect) {
    this.viewport = { ...rect };
    this._ensureBoundsContainsViewport();
  }

  /**
   * Gets the viewport rectangle.
   * @returns {Object} Rectangle {x, y, width, height}
   */
  getViewportRect() {
    return { ...this.viewport };
  }

  /**
   * Sets the bounds rectangle.
   * Automatically ensures it contains viewport.
   * @param {Object} rect - Rectangle {x, y, width, height}
   */
  setBoundsRect(rect) {
    this.bounds = { ...rect };
    this._ensureBoundsContainsViewport();
  }

  /**
   * Gets the bounds rectangle.
   * @returns {Object} Rectangle {x, y, width, height}
   */
  getBoundsRect() {
    return { ...this.bounds };
  }

  /**
   * Pans the bounds by a delta amount.
   * @param {number} deltaX - Horizontal pan amount
   * @param {number} deltaY - Vertical pan amount
   */
  pan(deltaX, deltaY) {
    this.bounds.x += deltaX;
    this.bounds.y += deltaY;
    this._ensureBoundsContainsViewport();
  }

  /**
   * Zooms in/out around a specific point (in viewport coordinates).
   * @param {number} viewportX - X coordinate in viewport space
   * @param {number} viewportY - Y coordinate in viewport space
   * @param {number} zoomFactor - Zoom factor (>1 zooms in, <1 zooms out)
   * @param {number} minScale - Minimum scale factor (optional)
   * @param {number} maxScale - Maximum scale factor (optional)
   */
  zoomAtPoint(viewportX, viewportY, zoomFactor, minScale = null, maxScale = null) {
    // Convert viewport point to bounds coordinates (before zoom)
    const boundsX = this.viewportToBoundsX(viewportX);
    const boundsY = this.viewportToBoundsY(viewportY);
    
    // Calculate current scale
    const currentScaleX = this.bounds.width / this.viewport.width;
    const currentScaleY = this.bounds.height / this.viewport.height;
    
    // Apply zoom factor
    let newScaleX = currentScaleX * zoomFactor;
    let newScaleY = currentScaleY * zoomFactor;
    
    // Apply min/max constraints if provided
    if (minScale !== null) {
      newScaleX = Math.max(newScaleX, minScale);
      newScaleY = Math.max(newScaleY, minScale);
    }
    if (maxScale !== null) {
      newScaleX = Math.min(newScaleX, maxScale);
      newScaleY = Math.min(newScaleY, maxScale);
    }
    
    // Calculate new bounds dimensions
    const newBoundsWidth = this.viewport.width * newScaleX;
    const newBoundsHeight = this.viewport.height * newScaleY;
    
    // Adjust bounds position to keep the zoom point fixed
    // After zoom, the same bounds point should map to the same viewport point
    // boundsX = new_bounds.x + (viewportX - viewport.x) * newScaleX
    // Therefore: new_bounds.x = boundsX - (viewportX - viewport.x) * newScaleX
    this.bounds.x = boundsX - (viewportX - this.viewport.x) * newScaleX;
    this.bounds.y = boundsY - (viewportY - this.viewport.y) * newScaleY;
    this.bounds.width = newBoundsWidth;
    this.bounds.height = newBoundsHeight;
    
    this._ensureBoundsContainsViewport();
  }

  /**
   * Zooms to fit the content within the viewport (ensures content is fully visible).
   * @param {Object} actualContentSize - The actual size of the content {width, height}
   */
  zoomToFit(actualContentSize) {
    const scaleX = this.viewport.width / actualContentSize.width;
    const scaleY = this.viewport.height / actualContentSize.height;
    const scale = Math.min(scaleX, scaleY);
    
    this.bounds.width = actualContentSize.width * scale;
    this.bounds.height = actualContentSize.height * scale;
    this.bounds.x = this.viewport.x + (this.viewport.width - this.bounds.width) / 2;
    this.bounds.y = this.viewport.y + (this.viewport.height - this.bounds.height) / 2;
    
    this._ensureBoundsContainsViewport();
  }

  /**
   * Gets the scale factor from bounds to viewport.
   * @returns {Object} {scaleX, scaleY}
   */
  getScale() {
    return {
      scaleX: this.viewport.width / this.bounds.width,
      scaleY: this.viewport.height / this.bounds.height
    };
  }

  /**
   * Converts a viewport X coordinate to bounds X coordinate.
   * @param {number} viewportX - X coordinate in viewport space
   * @returns {number} X coordinate in bounds space
   */
  viewportToBoundsX(viewportX) {
    const scale = this.bounds.width / this.viewport.width;
    return this.bounds.x + (viewportX - this.viewport.x) * scale;
  }

  /**
   * Converts a viewport Y coordinate to bounds Y coordinate.
   * @param {number} viewportY - Y coordinate in viewport space
   * @returns {number} Y coordinate in bounds space
   */
  viewportToBoundsY(viewportY) {
    const scale = this.bounds.height / this.viewport.height;
    return this.bounds.y + (viewportY - this.viewport.y) * scale;
  }

  /**
   * Converts a bounds X coordinate to viewport X coordinate.
   * @param {number} boundsX - X coordinate in bounds space
   * @returns {number} X coordinate in viewport space
   */
  boundsToViewportX(boundsX) {
    const scale = this.viewport.width / this.bounds.width;
    return this.viewport.x + (boundsX - this.bounds.x) * scale;
  }

  /**
   * Converts a bounds Y coordinate to viewport Y coordinate.
   * @param {number} boundsY - Y coordinate in bounds space
   * @returns {number} Y coordinate in viewport space
   */
  boundsToViewportY(boundsY) {
    const scale = this.viewport.height / this.bounds.height;
    return this.viewport.y + (boundsY - this.bounds.y) * scale;
  }

  /**
   * Converts a viewport point to a bounds point.
   * @param {Object} viewportPoint - {x, y} in viewport space
   * @returns {Object} {x, y} in bounds space
   */
  viewportToBounds(viewportPoint) {
    return {
      x: this.viewportToBoundsX(viewportPoint.x),
      y: this.viewportToBoundsY(viewportPoint.y)
    };
  }

  /**
   * Converts a bounds point to a viewport point.
   * @param {Object} boundsPoint - {x, y} in bounds space
   * @returns {Object} {x, y} in viewport space
   */
  boundsToViewport(boundsPoint) {
    return {
      x: this.boundsToViewportX(boundsPoint.x),
      y: this.boundsToViewportY(boundsPoint.y)
    };
  }

  /**
   * Ensures bounds always contains viewport.
   * Adjusts bounds position and size if necessary.
   * @private
   */
  _ensureBoundsContainsViewport() {
    // Calculate the minimum required size for bounds
    const minWidth = this.viewport.width;
    const minHeight = this.viewport.height;
    
    // Ensure bounds is at least as large as viewport
    if (this.bounds.width < minWidth) {
      this.bounds.width = minWidth;
    }
    if (this.bounds.height < minHeight) {
      this.bounds.height = minHeight;
    }
    
    // Ensure viewport is contained within bounds
    // Check left edge
    if (this.bounds.x > this.viewport.x) {
      this.bounds.x = this.viewport.x;
    }
    // Check right edge
    if (this.bounds.x + this.bounds.width < this.viewport.x + this.viewport.width) {
      this.bounds.x = this.viewport.x + this.viewport.width - this.bounds.width;
    }
    // Check top edge
    if (this.bounds.y > this.viewport.y) {
      this.bounds.y = this.viewport.y;
    }
    // Check bottom edge
    if (this.bounds.y + this.bounds.height < this.viewport.y + this.viewport.height) {
      this.bounds.y = this.viewport.y + this.viewport.height - this.bounds.height;
    }
  }

  /**
   * Resets the viewport to show content at a 1:1 scale, centered.
   * @param {Object} actualContentSize - The actual size of the content {width, height}
   */
  reset(actualContentSize) {
    this.bounds.width = actualContentSize.width;
    this.bounds.height = actualContentSize.height;
    this.bounds.x = this.viewport.x + (this.viewport.width - this.bounds.width) / 2;
    this.bounds.y = this.viewport.y + (this.viewport.height - this.bounds.height) / 2;
    this._ensureBoundsContainsViewport();
  }
}

