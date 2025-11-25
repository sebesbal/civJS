// Economy Editor UI - handles economy editor interface
export class EconomyEditorUI {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.createUI();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'economy-editor-ui';
    document.body.appendChild(this.container);

    const title = document.createElement('h3');
    title.textContent = 'Economy Editor';
    title.style.margin = '0 0 20px 0';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    title.style.borderBottom = '2px solid rgba(255, 255, 255, 0.2)';
    title.style.paddingBottom = '10px';
    this.container.appendChild(title);

    const placeholder = document.createElement('p');
    placeholder.textContent = 'Economy editor functionality coming soon...';
    placeholder.style.color = '#aaaaaa';
    placeholder.style.fontSize = '14px';
    this.container.appendChild(placeholder);
  }

  show() {
    this.container.classList.add('visible');
  }

  hide() {
    this.container.classList.remove('visible');
  }
}

