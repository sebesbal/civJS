/**
 * Base class for resizable test views.
 * Handles resize logic. Subclasses must set this.container and this.canvasContainer,
 * then call setupResizeHandling().
 */
export class CanvasTestBase {
  constructor() {
    this.container = null;
    this.canvasContainer = null;
    this.resizeObserver = null;
    this.windowResizeHandler = null;
    this._resizeRetryCount = 0;
  }

  /**
   * Sets up resize observers. Call this after setting container and canvasContainer.
   */
  setupResizeHandling() {
    if (!this.canvasContainer || !this.container) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    this.resizeObserver.observe(this.canvasContainer);
    this.resizeObserver.observe(this.container);

    this.windowResizeHandler = () => {
      this.resizeCanvas();
    };
    window.addEventListener('resize', this.windowResizeHandler);

    // Initial resize - wait for layout to settle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.resizeCanvas();
      });
    });
  }

  /**
   * Calculates new dimensions and calls onResized() hook.
   */
  resizeCanvas() {
    if (!this.canvasContainer || !this.container) return;

    const containerRect = this.container.getBoundingClientRect();

    // If container hasn't been laid out yet, retry
    if (containerRect.width < 100 || containerRect.height < 100) {
      if (this._resizeRetryCount < 5) {
        this._resizeRetryCount++;
        setTimeout(() => this.resizeCanvas(), 50);
        return;
      }
      return;
    }
    this._resizeRetryCount = 0;

    const canvasContainerRect = this.canvasContainer.getBoundingClientRect();

    // Calculate available space (minus padding)
    const padding = 20;
    let newWidth = Math.max(100, Math.floor(canvasContainerRect.width - padding));
    let newHeight = Math.max(100, Math.floor(canvasContainerRect.height - padding));

    // Safety checks
    const maxWidthFromContainer = containerRect.width - 40;
    const maxHeightFromContainer = containerRect.height - 250;

    if (newWidth > maxWidthFromContainer && maxWidthFromContainer > 100) {
      newWidth = Math.floor(maxWidthFromContainer);
    }
    if (newHeight > maxHeightFromContainer && maxHeightFromContainer > 100) {
      newHeight = Math.floor(maxHeightFromContainer);
    }

    const maxViewportWidth = window.innerWidth - 250;
    const maxViewportHeight = window.innerHeight - 50;
    if (newWidth > maxViewportWidth && maxViewportWidth > 100) {
      newWidth = Math.floor(maxViewportWidth);
    }
    if (newHeight > maxViewportHeight && maxViewportHeight > 100) {
      newHeight = Math.floor(maxViewportHeight);
    }

    newWidth = Math.max(100, newWidth);
    newHeight = Math.max(100, newHeight);

    // Call hook for subclass to handle the new dimensions
    this.onResized(newWidth, newHeight);
  }

  /**
   * Hook for subclasses to handle resize. Override this method.
   * @param {number} width - New width
   * @param {number} height - New height
   */
  onResized(width, height) {
    // Override in subclass
  }

  /**
   * Cleanup resize observers.
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler);
      this.windowResizeHandler = null;
    }
  }
}
