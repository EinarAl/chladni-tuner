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

      const inverted = 1 - Math.min(1, raw);

      const noise =
        boost +
        Math.sin(x * 0.15 + time * 2.0) * 3 +
        Math.sin(y * 0.12 + time * 1.7) * 3 +
        Math.sin((x + y) * 0.08 + time * 2.3) * 2;

      const threshold = (BAYER_8[y % 8][x % 8] + noise) / 64;
      const output = inverted > threshold ? 255 : 0;

      const pixelIdx = idx * 4;
      imageData.data[pixelIdx] = output;
      imageData.data[pixelIdx + 1] = output;
      imageData.data[pixelIdx + 2] = output;
      imageData.data[pixelIdx + 3] = 255;
    }
  }

  return imageData;
}
