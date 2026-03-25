# Navigation Index

## `ui/editors/`
- `map-editor-ui.js`: map-mode sidebars, product list, simulation controls, floating bottom-left overlay control, object inspector.
- `economy-editor-ui.js`: economy editor shell, product list, property editing, load/save/default economy bootstrap.

## `ui/viewers/`
- `camera-controller.js`: map camera input and camera reset/orbit behavior.
- `factory-overview-ui.js`: overview screen shell and interaction plumbing.
- `economy-icon-catalog.js`: maps products/icons for editor and inspector visuals.

## `ui/visualizers/`
- `map-overlay-renderer.js`: tile heatmap overlays using simulation/economy state.
- `trade-renderer.js`: animated route/trader visualization during simulation.
- `economy-visualizer.js`: economy DAG graph rendering.
- `factory-overview-visualizer.js`: overview graph rendering.
- `dag-layout.js`: shared graph layout helper.

## `ui/persistence/`
- `json-file-persistence.js`: browser download/upload operations for saves and economy files.

## Typical Entry Choices
- DOM/layout/control issue: `ui/editors/...`
- Rendering/animation/mesh issue: `ui/visualizers/...`
- Camera/input issue on the map: `ui/viewers/camera-controller.js`
