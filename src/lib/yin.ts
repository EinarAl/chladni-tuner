export function yinPitchDetection(
  buffer: Float32Array,
  sampleRate: number
): number | null {
  const bufferSize = buffer.length;
  const maxTau = Math.floor(bufferSize / 2);
  const threshold = 0.1;

  const diff = new Float32Array(maxTau);
  for (let tau = 0; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < bufferSize - tau; i++) {
      const d = buffer[i] - buffer[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  const normDiff = new Float32Array(maxTau);
  normDiff[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    runningSum += diff[tau];
    normDiff[tau] = diff[tau] / (runningSum / tau);
  }

  let tau = 2;
  for (let i = 2; i < maxTau; i++) {
    if (normDiff[i] < threshold) {
      tau = i;
      break;
    }
  }

  if (tau >= maxTau) {
    let minVal = Infinity;
    for (let i = 2; i < maxTau; i++) {
      if (normDiff[i] < minVal) {
        minVal = normDiff[i];
        tau = i;
      }
    }
  }

  if (tau < 2 || tau >= maxTau - 1) return null;

  const y1 = normDiff[tau - 1];
  const y2 = normDiff[tau];
  const y3 = normDiff[tau + 1];
  const a = (y1 + y3 - 2 * y2) / 2;
  const b = (y3 - y1) / 2;
  let correction = 0;
  if (Math.abs(a) > 1e-15) {
    correction = -b / (2 * a);
  }

  const refinedTau = tau + correction;
  if (refinedTau < 1) return null;

  return sampleRate / refinedTau;
}
