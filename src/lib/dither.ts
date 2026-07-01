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

export function applyDither(grid: Float32Array, gridSize: number): ImageData {
  const imageData = new ImageData(gridSize, gridSize);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = y * gridSize + x;
      const pixelIdx = idx * 4;

      const value = Math.min(1, Math.abs(grid[idx]) / 2);
      const inverted = 1 - value;
      const threshold = BAYER_8[y % 8][x % 8] / 64;
      const output = inverted > threshold ? 255 : 0;

      imageData.data[pixelIdx] = output;
      imageData.data[pixelIdx + 1] = output;
      imageData.data[pixelIdx + 2] = output;
      imageData.data[pixelIdx + 3] = 255;
    }
  }

  return imageData;
}
