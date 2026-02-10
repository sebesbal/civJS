// Object type definitions - dynamically generated from economy data
// Each economy product node becomes a factory type on the map

// Default factory shape/size used for all product factories
const FACTORY_SHAPE = 'box';
const FACTORY_SIZE = { width: 0.6, height: 0.6, depth: 0.6 };

// Generate a deterministic color from a node ID using golden angle distribution
function generateColor(id) {
  const hue = (id * 137.5) % 360;
  // Convert HSL to hex (saturation: 70%, lightness: 50%)
  const s = 0.7;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (hue < 60) { r = c; g = x; b = 0; }
  else if (hue < 120) { r = x; g = c; b = 0; }
  else if (hue < 180) { r = 0; g = c; b = x; }
  else if (hue < 240) { r = 0; g = x; b = c; }
  else if (hue < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v) => Math.round((v + m) * 255);
  return (toHex(r) << 16) | (toHex(g) << 8) | toHex(b);
}

// Generate ObjectTypes from an EconomyManager instance
export function generateObjectTypesFromEconomy(economyManager) {
  const types = {};
  if (!economyManager) return types;

  const nodes = economyManager.getAllNodes();
  for (const node of nodes) {
    const key = `PRODUCT_${node.id}`;
    types[key] = {
      name: `${node.name} Factory`,
      color: generateColor(node.id),
      shape: FACTORY_SHAPE,
      size: { ...FACTORY_SIZE },
      productId: node.id,
      imagePath: node.imagePath
    };
  }
  return types;
}
