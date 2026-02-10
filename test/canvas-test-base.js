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

    // Clamp to smallest of: canvas container, parent container, and viewport
    const newWidth = Math.max(100, Math.floor(Math.min(
      canvasContainerRect.width - 20,
      containerRect.width - 40,
      window.innerWidth - 250
    )));
    const newHeight = Math.max(100, Math.floor(Math.min(
      canvasContainerRect.height - 20,
      containerRect.height - 250,
      window.innerHeight - 50
    )));

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
