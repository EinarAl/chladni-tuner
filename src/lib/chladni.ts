export function computeChladniGrid(
  n: number,
  m: number,
  gridSize: number,
): Float32Array {
  const data = new Float32Array(gridSize * gridSize);
  const half = gridSize / 2;
  const scale = Math.PI;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const nx = (x - half) / half;
      const ny = (y - half) / half;

      const z = Math.cos(n * scale * nx) * Math.cos(m * scale * ny)
        - Math.cos(m * scale * nx) * Math.cos(n * scale * ny);

      data[y * gridSize + x] = z;
    }
  }

  return data;
}

export function frequencyToMode(freq: number): { n: number; m: number } {
  const minFreq = 20;
  const maxFreq = 1400;
  const clamped = Math.max(minFreq, Math.min(maxFreq, freq));
  const t = (clamped - minFreq) / (maxFreq - minFreq);

  const minMode = 1;
  const maxMode = 7;
  const base = minMode + t * (maxMode - minMode);

  let n = base;
  let m = base + 0.618;

  if (Math.abs(n - m) < 0.15) {
    m += 0.3;
  }

  return { n: Math.max(0.5, n), m: Math.max(0.5, m) };
}
