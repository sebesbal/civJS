import { ViewportController } from '../utils/viewport-controller.js';
import { CanvasTestBase } from './canvas-test-base.js';

export class ViewportControllerTest extends CanvasTestBase {
  constructor(container) {
    super();
    this.container = container;
    this.viewportController = null;
    this.canvas = null;
    this.ctx = null;
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };
    
    // Default rectangle sizes - will be initialized after canvas is sized
    this.viewportRect = { x: 0, y: 0, width: 300, height: 200 };
    this.boundsRect = { x: 0, y: 0, width: 600, height: 400 };
    
    this.init();
  }

  init() {
    this.createUI();
    this.setupViewportController();
    this.setupEventListeners();
    this.draw();
  }

  onResized(newWidth, newHeight) {
    // Update canvas size
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    
    // Update boundsRect to match new canvas size
    this.boundsRect = { 
      x: 0, 
      y: 0, 
      width: newWidth, 
      height: newHeight 
    };
    
    // Center viewport on canvas if this is the first resize
    if (!this.viewportController || this.viewportRect.width === 300) {
      this.viewportRect = {
        x: (newWidth - 300) / 2,
        y: (newHeight - 200) / 2,
        width: 300,
        height: 200
      };
    }
    
    // Update viewport controller if it exists
    if (this.viewportController) {
      this.viewportController.setBoundsRect({ ...this.boundsRect });
      this.viewportController.setViewportRect({ ...this.viewportRect });
      
      // Update inputs if they exist
      if (document.getElementById('bounds-width')) {
        this.updateBoundsInputs();
      }
      if (document.getElementById('viewport-x')) {
        document.getElementById('viewport-x').value = Math.round(this.viewportRect.x * 100) / 100;
        document.getElementById('viewport-y').value = Math.round(this.viewportRect.y * 100) / 100;
        document.getElementById('viewport-width').value = Math.round(this.viewportRect.width * 100) / 100;
        document.getElementById('viewport-height').value = Math.round(this.viewportRect.height * 100) / 100;
      }
    }
    
    // Redraw
    this.draw();
  }

  createUI() {
    this.container.innerHTML = '';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '10px';
    this.container.style.padding = '10px';
    this.container.style.overflow = 'hidden';
    this.container.style.height = '100%';
    this.container.style.minHeight = '0';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'ViewportController Test';
    title.style.margin = '0';
    title.style.fontSize = '18px';
    this.container.appendChild(title);

    // Controls panel
    const controlsPanel = document.createElement('div');
    controlsPanel.style.display = 'grid';
    controlsPanel.style.gridTemplateColumns = '1fr 1fr';
    controlsPanel.style.gap = '10px';
    controlsPanel.style.padding = '10px';
    controlsPanel.style.background = 'rgba(40, 40, 40, 0.8)';
    controlsPanel.style.borderRadius = '8px';
    controlsPanel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    controlsPanel.style.flexShrink = '0';

    // Viewport rectangle controls
    const viewportSection = document.createElement('div');
    viewportSection.innerHTML = `
      <h3 style="margin: 0 0 6px 0; font-size: 12px; color: #4a9eff;">Viewport Rectangle</h3>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; gap: 6px; align-items: center;">
          <label style="width: 50px; font-size: 11px;">X:</label>
          <input type="number" id="viewport-x" value="${this.viewportRect.x}" style="flex: 1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 11px;">
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <label style="width: 50px; font-size: 11px;">Y:</label>
          <input type="number" id="viewport-y" value="${this.viewportRect.y}" style="flex: 1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 11px;">
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <label style="width: 50px; font-size: 11px;">W:</label>
          <input type="number" id="viewport-width" value="${this.viewportRect.width}" style="flex: 1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 11px;">
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <label style="width: 50px; font-size: 11px;">H:</label>
          <input type="number" id="viewport-height" value="${this.viewportRect.height}" style="flex: 1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 11px;">
        </div>
      </div>
    `;
    controlsPanel.appendChild(viewportSection);

    // Bounds rectangle controls
    const boundsSection = document.createElement('div');
    boundsSection.innerHTML = `
      <h3 style="margin: 0 0 6px 0; font-size: 12px; color: #ff6b6b;">Bounds Rectangle</h3>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; gap: 6px; align-items: center;">
          <label style="width: 50px; font-size: 11px;">X:</label>
          <input type="number" id="bounds-x" value="${this.boundsRect.x}" style="flex: 1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 11px;">
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <label style="width: 50px; font-size: 11px;">Y:</label>
          <input type="number" id="bounds-y" value="${this.boundsRect.y}" style="flex: 1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 11px;">
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <label style="width: 50px; font-size: 11px;">W:</label>
          <input type="number" id="bounds-width" value="${this.boundsRect.width}" style="flex: 1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 11px;">
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <label style="width: 50px; font-size: 11px;">H:</label>
          <input type="number" id="bounds-height" value="${this.boundsRect.height}" style="flex: 1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 11px;">
        </div>
      </div>
    `;
    controlsPanel.appendChild(boundsSection);

    this.container.appendChild(controlsPanel);

    // Canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.position = 'relative';
    canvasContainer.style.background = '#2a2a2a';
    canvasContainer.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    canvasContainer.style.borderRadius = '8px';
    canvasContainer.style.padding = '10px';
    canvasContainer.style.display = 'flex';
    canvasContainer.style.justifyContent = 'center';
    canvasContainer.style.alignItems = 'center';
    canvasContainer.style.flex = '1';
    canvasContainer.style.minHeight = '0';
    canvasContainer.style.overflow = 'hidden';

    this.canvas = document.createElement('canvas');
    this.canvas.style.cursor = 'grab';
    this.canvas.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    this.canvas.style.borderRadius = '4px';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx = this.canvas.getContext('2d');

    canvasContainer.appendChild(this.canvas);
    this.container.appendChild(canvasContainer);

    // Store canvas container reference and set up resize handling
    this.canvasContainer = canvasContainer;
    this.setupResizeHandling();

    // Instructions
    const instructions = document.createElement('div');
    instructions.style.padding = '6px';
    instructions.style.background = 'rgba(74, 158, 255, 0.1)';
    instructions.style.borderRadius = '6px';
    instructions.style.fontSize = '11px';
    instructions.style.color = '#aaa';
    instructions.style.flexShrink = '0';
    instructions.innerHTML = `
      <strong>Instructions:</strong> Drag to pan • Mouse wheel to zoom • Change rectangle sizes using the input fields above
    `;
    this.container.appendChild(instructions);
  }

  setupViewportController() {
    this.viewportController = new ViewportController(
      { ...this.viewportRect },
      { ...this.boundsRect }
    );
  }

  setupEventListeners() {
    // Viewport rectangle input listeners
    document.getElementById('viewport-x').addEventListener('input', (e) => {
      this.viewportRect.x = parseFloat(e.target.value) || 0;
      this.viewportController.setViewportRect({ ...this.viewportRect });
      this.draw();
    });

    document.getElementById('viewport-y').addEventListener('input', (e) => {
      this.viewportRect.y = parseFloat(e.target.value) || 0;
      this.viewportController.setViewportRect({ ...this.viewportRect });
      this.draw();
    });

    document.getElementById('viewport-width').addEventListener('input', (e) => {
      this.viewportRect.width = parseFloat(e.target.value) || 1;
      this.viewportController.setViewportRect({ ...this.viewportRect });
      this.draw();
    });

    document.getElementById('viewport-height').addEventListener('input', (e) => {
      this.viewportRect.height = parseFloat(e.target.value) || 1;
      this.viewportController.setViewportRect({ ...this.viewportRect });
      this.draw();
    });

    // Bounds rectangle input listeners
    document.getElementById('bounds-x').addEventListener('input', (e) => {
      this.boundsRect.x = parseFloat(e.target.value) || 0;
      this.viewportController.setBoundsRect({ ...this.boundsRect });
      this.updateBoundsInputs();
      this.draw();
    });

    document.getElementById('bounds-y').addEventListener('input', (e) => {
      this.boundsRect.y = parseFloat(e.target.value) || 0;
      this.viewportController.setBoundsRect({ ...this.boundsRect });
      this.updateBoundsInputs();
      this.draw();
    });

    document.getElementById('bounds-width').addEventListener('input', (e) => {
      this.boundsRect.width = parseFloat(e.target.value) || 1;
      this.viewportController.setBoundsRect({ ...this.boundsRect });
      this.updateBoundsInputs();
      this.draw();
    });

    document.getElementById('bounds-height').addEventListener('input', (e) => {
      this.boundsRect.height = parseFloat(e.target.value) || 1;
      this.viewportController.setBoundsRect({ ...this.boundsRect });
      this.updateBoundsInputs();
      this.draw();
    });

    // Mouse events for panning
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.canvas.style.cursor = 'grabbing';
      const rect = this.canvas.getBoundingClientRect();
      const viewportRect = this.viewportController.getViewportRect();
      this.lastMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      // Store if we started dragging inside the viewport rectangle
      this.wasInsideViewport = (
        this.lastMousePos.x >= viewportRect.x &&
        this.lastMousePos.x <= viewportRect.x + viewportRect.width &&
        this.lastMousePos.y >= viewportRect.y &&
        this.lastMousePos.y <= viewportRect.y + viewportRect.height
      );
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging && this.wasInsideViewport) {
        const rect = this.canvas.getBoundingClientRect();
        const currentMousePos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        
        const deltaX = currentMousePos.x - this.lastMousePos.x;
        const deltaY = currentMousePos.y - this.lastMousePos.y;
        
        // For 1:1 panning: when mouse moves, content should move by the same amount on screen
        // The pan method moves the bounds rectangle. When you drag right, you want content to follow
        // the mouse (move right), which means bounds should move in the same direction.
        // Since pan() moves bounds directly, we use raw delta for 1:1 movement
        this.viewportController.pan(deltaX, deltaY);
        this.updateBoundsInputs();
        this.draw();
        
        this.lastMousePos = currentMousePos;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });

    // Mouse wheel for zooming
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      const viewportRect = this.viewportController.getViewportRect();
      
      // Convert canvas coordinates to viewport rectangle coordinates
      // Only zoom if mouse is over the viewport rectangle
      if (canvasX >= viewportRect.x && canvasX <= viewportRect.x + viewportRect.width &&
          canvasY >= viewportRect.y && canvasY <= viewportRect.y + viewportRect.height) {
        const viewportX = canvasX;
        const viewportY = canvasY;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.viewportController.zoomAtPoint(viewportX, viewportY, zoomFactor);
        this.updateBoundsInputs();
        this.draw();
      }
    });
  }

  updateBoundsInputs() {
    const boundsRect = this.viewportController.getBoundsRect();
    this.boundsRect = boundsRect;
    document.getElementById('bounds-x').value = Math.round(boundsRect.x * 100) / 100;
    document.getElementById('bounds-y').value = Math.round(boundsRect.y * 100) / 100;
    document.getElementById('bounds-width').value = Math.round(boundsRect.width * 100) / 100;
    document.getElementById('bounds-height').value = Math.round(boundsRect.height * 100) / 100;
  }

  draw() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const viewportRect = this.viewportController.getViewportRect();
    const boundsRect = this.viewportController.getBoundsRect();
    
    // Draw bounds rectangle - larger, semi-transparent
    ctx.fillStyle = 'rgba(255, 107, 107, 0.2)';
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.fillRect(boundsRect.x, boundsRect.y, boundsRect.width, boundsRect.height);
    ctx.strokeRect(boundsRect.x, boundsRect.y, boundsRect.width, boundsRect.height);
    
    // Draw viewport rectangle - smaller, solid
    ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.fillRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height);
    ctx.strokeRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height);
    
    // Draw labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Bounds label
    ctx.fillText('bounds', boundsRect.x + 5, boundsRect.y + 5);
    
    // Viewport label
    ctx.fillText('viewport', viewportRect.x + 5, viewportRect.y + 5);
    
    // Draw scale info
    const scale = this.viewportController.getScale();
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `Scale: ${(scale.scaleX * 100).toFixed(1)}%`,
      canvas.width - 150,
      canvas.height - 30
    );
  }
}

