const BAYER_8: number[][] = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
];

export function applyAnimatedDither(
  grid: Float32Array,
  gridSize: number,
  time: number,
  prevGrid?: Float32Array | null,
  blend?: number,
  noiseBoost?: number,
  invert = false,
): ImageData {
  const imageData = new ImageData(gridSize, gridSize);
  const boost = noiseBoost ?? 0;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = y * gridSize + x;

      let raw = Math.abs(grid[idx]) / 2;

      if (prevGrid && blend !== undefined && blend < 1) {
        const prevRaw = Math.abs(prevGrid[idx]) / 2;
        raw = prevRaw * (1 - blend) + raw * blend;
      }

      const clamped = Math.min(1, raw);
      const inverted = 1 - clamped;

      const s1 = Math.sin(x * 0.02 + y * 0.015 + time * 0.5);
      const s2 = Math.sin(x * 0.03 - y * 0.025 + time * 0.7);
      const s3 = Math.sin((x - y) * 0.022 + (x + y) * 0.012 + time * 0.4);
      const s4 = Math.sin(x * 0.04 + y * 0.035 + time * 0.6);
      const sum = s1 + s2 + s3 + s4;
      const noiseScale = 0.5 + clamped * 2.5;
      const noise = boost + sum * noiseScale;

      const rawThreshold = BAYER_8[y % 8][x % 8] + noise;
      const threshold = Math.max(0, rawThreshold) / 64;
      let output = inverted > threshold ? 255 : 0;
      if (invert) output = 255 - output;

      const pixelIdx = idx * 4;
      imageData.data[pixelIdx] = output;
      imageData.data[pixelIdx + 1] = output;
      imageData.data[pixelIdx + 2] = output;
      imageData.data[pixelIdx + 3] = 255;
    }
  }

  return imageData;
}
