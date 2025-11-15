// Object type definitions
// This file can be customized to add, remove, or modify object types

export const ObjectTypes = {
  CITY: {
    name: 'City',
    color: 0xff6b6b, // Red
    shape: 'cylinder',
    size: { radius: 0.4, height: 0.8 }
  },
  FACTORY: {
    name: 'Factory',
    color: 0x4ecdc4, // Teal
    shape: 'box',
    size: { width: 0.6, height: 0.6, depth: 0.6 }
  },
  RESOURCE: {
    name: 'Resource',
    color: 0xffe66d, // Yellow
    shape: 'sphere',
    size: { radius: 0.3 }
  },
  UNIT: {
    name: 'Unit',
    color: 0x95e1d3, // Light green
    shape: 'box',
    size: { width: 0.3, height: 0.5, depth: 0.3 }
  }
};

