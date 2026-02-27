# UI Architecture

The project uses a three-layer architecture:

- `domain/`: pure game/economy/simulation behavior and state.
- `application/`: orchestration services and persistence workflows.
- `ui/`: editors, visualizers, viewers, and browser file interactions.

UI modules do not own domain state directly. They call application services such as:

- `EconomyEditorService`
- `EconomyIOService`
- `GameStateService`
- `GameSessionService`

Save/load in UI is handled through `ui/persistence/json-file-persistence.js`.
