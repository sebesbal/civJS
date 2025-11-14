import * as THREE from 'three';

// Tile colors for variety (grass, dirt, sand, stone, etc.)
const tileColors = [
  0x4a7c59, // Dark green (forest)
  0x6b8e23, // Olive green (grass)
  0x8b7355, // Brown (dirt)
  0xc2b280, // Beige (sand)
  0x708090, // Slate gray (stone)
  0x556b2f, // Dark olive (grass)
  0x9acd32, // Yellow green (lush grass)
  0xdaa520, // Goldenrod (dry grass)
];

export function createTilemap(scene, options = {}) {
  const mapSize = options.mapSize || 20;
  const tileSize = options.tileSize || 1;
  const tileHeight = options.tileHeight || 0.1;
  const tiles = [];

  for (let x = 0; x < mapSize; x++) {
    for (let z = 0; z < mapSize; z++) {
      // Random tile color
      const colorIndex = Math.floor(Math.random() * tileColors.length);
      const color = tileColors[colorIndex];
      
      // Slight random height variation for visual interest
      const heightVariation = (Math.random() - 0.5) * 0.1;
      
      const geometry = new THREE.BoxGeometry(tileSize, tileHeight, tileSize);
      const material = new THREE.MeshStandardMaterial({color: color});
      const tile = new THREE.Mesh(geometry, material);
      
      // Position tiles in a grid, centered around origin
      const offset = (mapSize * tileSize) / 2 - tileSize / 2;
      tile.position.set(
        x * tileSize - offset,
        heightVariation,
        z * tileSize - offset
      );
      
      scene.add(tile);
      tiles.push(tile);
    }
  }

  return tiles;
}
