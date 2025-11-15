// Simple noise generator for terrain height maps
// Implements a simplified Perlin noise-like algorithm

class NoiseGenerator {
  constructor(seed = Math.random() * 10000) {
    this.seed = seed;
  }

  // Simple hash function for pseudo-random values
  hash(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  }

  // Smooth interpolation
  lerp(a, b, t) {
    return a + t * (b - a);
  }

  // Smoothstep function for smoother interpolation
  smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  // 2D noise function
  noise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const sx = this.smoothstep(x - x0);
    const sy = this.smoothstep(y - y0);

    const n0 = this.hash(x0, y0);
    const n1 = this.hash(x1, y0);
    const ix0 = this.lerp(n0, n1, sx);

    const n2 = this.hash(x0, y1);
    const n3 = this.hash(x1, y1);
    const ix1 = this.lerp(n2, n3, sx);

    return this.lerp(ix0, ix1, sy);
  }

  // Fractal noise (octaves for more detail)
  fractalNoise(x, y, octaves = 4, persistence = 0.5, scale = 0.1) {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }

  // Generate height map
  generateHeightMap(width, height, scale = 0.1, octaves = 4) {
    const map = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        const value = this.fractalNoise(x, y, octaves, 0.5, scale);
        row.push(value);
      }
      map.push(row);
    }
    return map;
  }
}

export { NoiseGenerator };

