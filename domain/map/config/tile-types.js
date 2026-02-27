// Tile type definitions
// This file can be customized to add, remove, or modify tile types
// Height ranges determine which tile type appears at different elevations
// Heights are normalized 0-1, where 0 is lowest (deep sea) and 1 is highest (mountain peak)

export const TileTypes = [
  {
    name: 'Deep Sea',
    color: 0x1e3a5f, // Dark blue
    minHeight: 0.0,
    maxHeight: 0.15
  },
  {
    name: 'Sea',
    color: 0x2e5a8a, // Medium blue
    minHeight: 0.15,
    maxHeight: 0.25
  },
  {
    name: 'Shallow Water',
    color: 0x4a90c2, // Light blue
    minHeight: 0.25,
    maxHeight: 0.3
  },
  {
    name: 'Beach',
    color: 0xf4e4bc, // Light sand
    minHeight: 0.3,
    maxHeight: 0.35
  },
  {
    name: 'Sand',
    color: 0xc2b280, // Beige
    minHeight: 0.35,
    maxHeight: 0.4
  },
  {
    name: 'Grass',
    color: 0x6b8e23, // Olive green
    minHeight: 0.4,
    maxHeight: 0.55
  },
  {
    name: 'Dark Grass',
    color: 0x556b2f, // Dark olive
    minHeight: 0.55,
    maxHeight: 0.65
  },
  {
    name: 'Forest',
    color: 0x4a7c59, // Dark green
    minHeight: 0.65,
    maxHeight: 0.75
  },
  {
    name: 'Dirt',
    color: 0x8b7355, // Brown
    minHeight: 0.75,
    maxHeight: 0.8
  },
  {
    name: 'Stone',
    color: 0x708090, // Slate gray
    minHeight: 0.8,
    maxHeight: 0.9
  },
  {
    name: 'Mountain',
    color: 0x5a5a5a, // Dark gray
    minHeight: 0.9,
    maxHeight: 1.0
  }
];

