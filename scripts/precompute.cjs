const math = require('mathjs');
const fs = require('fs');
const path = require('path');

// ── Parameters ─────────────────────────────────────────────────────────────
const CLAMPED = process.argv.includes('--clamped');
const N_ELASTIC = CLAMPED ? 13 : 15;
const N_RIGID = CLAMPED ? 0 : 2;
const N_BEAMS = N_ELASTIC + N_RIGID;
const NU = 0.3;
const GRID_SIZE = 128;
const F11 = 23;
const N_INT = 4000;

console.log(`Boundary condition: ${CLAMPED ? 'clamped-clamped' : 'free-edge'}`);
console.log(`  N_ELASTIC = ${N_ELASTIC}, N_RIGID = ${N_RIGID}, N_BEAMS = ${N_BEAMS}`);

// ── Beam eigenfunctions ────────────────────────────────────────────────────
// Clamped-clamped (all modes elastic):
//   φₙ(x) = cosh(βx)−cos(βx) − σ·(sinh(βx)−sin(βx))
// Free-free (n=0,1 rigid body, n≥2 elastic):
//   n=0: φ₀(x) = 1, n=1: φ₁(x) = √3·(2x-1)
//   φₙ(x) = cosh(βx)+cos(βx) − σ·(sinh(βx)+sin(βx))
// β values solve cosh(β)cos(β) = 1 for both BCs

const BETA_FREE = [
  0,  // unused (n=0,1 are rigid body)
  4.730040744862704,
  7.853204624095838,
  10.995607838001670,
  14.137165491257348,
  17.278759657399481,
  20.420352245626061,
  23.561944902040455,
  26.703537555508186,
  29.845130209103254,
  32.986722862692819,
  36.128315516282622,
  39.269908169872416,
  42.411500823462205,
  45.553093477051995,
  48.694686130641785,
  51.836278784231588,
  54.977871437821380,
  58.119464091411174,
  61.261056745000967,
  64.402649398590773,
];
const BETA_CLAMPED = BETA_FREE.slice(1);
const BETA = CLAMPED ? BETA_CLAMPED : BETA_FREE;

function beamVal(n, x) {
  if (!CLAMPED) {
    if (n === 0) return 1;
    if (n === 1) return Math.sqrt(3) * (2*x - 1);
  }
  const bi = CLAMPED ? n : n - 1;
  const b = BETA[bi];
  const ch = Math.cosh(b), sh = Math.sinh(b);
  const c = Math.cos(b), sn = Math.sin(b);
  const sigma = (ch - c) / (sh - sn);
  const bx = b * x;
  if (CLAMPED) {
    return Math.cosh(bx) - Math.cos(bx) - sigma * (Math.sinh(bx) - Math.sin(bx));
  }
  return Math.cosh(bx) + Math.cos(bx) - sigma * (Math.sinh(bx) + Math.sin(bx));
}

function beamDeriv(n, x) {
  if (!CLAMPED) {
    if (n === 0) return 0;
    if (n === 1) return 2 * Math.sqrt(3);
  }
  const bi = CLAMPED ? n : n - 1;
  const b = BETA[bi];
  const ch = Math.cosh(b), sh = Math.sinh(b);
  const c = Math.cos(b), sn = Math.sin(b);
  const sigma = (ch - c) / (sh - sn);
  const bx = b * x;
  const shx = Math.sinh(bx), chx = Math.cosh(bx);
  const snx = Math.sin(bx), cx = Math.cos(bx);
  if (CLAMPED) {
    return b * ((shx + snx) - sigma * (chx - cx));
  }
  return b * ((shx - snx) - sigma * (chx + cx));
}

function beamDeriv2(n, x) {
  if (!CLAMPED && n < 2) return 0;
  const bi = CLAMPED ? n : n - 1;
  const b = BETA[bi];
  const ch = Math.cosh(b), sh = Math.sinh(b);
  const c = Math.cos(b), sn = Math.sin(b);
  const sigma = (ch - c) / (sh - sn);
  const bx = b * x;
  const chx = Math.cosh(bx), shx = Math.sinh(bx);
  const cx = Math.cos(bx), snx = Math.sin(bx);
  if (CLAMPED) {
    return b * b * ((chx + cx) - sigma * (shx + snx));
  }
  return b * b * ((chx - cx) - sigma * (shx - snx));
}

function phi(n, x) { return beamVal(n, x); }
function phiDeriv(n, x) { return beamDeriv(n, x); }
function phiDeriv2(n, x) { return beamDeriv2(n, x); }

// ── Precompute via Simpson's rule ───────────────────────────────────────────

const h = 1 / N_INT;
const NT = N_INT + 1;

const Phi = Array.from({length: N_BEAMS}, () => new Float64Array(NT));
const Phid = Array.from({length: N_BEAMS}, () => new Float64Array(NT));
const Phid2 = Array.from({length: N_BEAMS}, () => new Float64Array(NT));

for (let i = 0; i < N_BEAMS; i++) {
  for (let p = 0; p < NT; p++) {
    const xi = p * h;
    Phi[i][p] = phi(i, xi);
    Phid[i][p] = phiDeriv(i, xi);
    Phid2[i][p] = phiDeriv2(i, xi);
  }
}

function simpson2(fx, fy) {
  let s = fx[0]*fy[0] + fx[NT-1]*fy[NT-1];
  for (let p = 1; p < NT-1; p++) s += fx[p] * fy[p] * (p%2===0 ? 2 : 4);
  return s * h / 3;
}

// ── Build integral matrices ─────────────────────────────────────────────────
console.log('  Computing integral matrices...');

const M = Array.from({length:N_BEAMS}, () => new Float64Array(N_BEAMS));
const A = Array.from({length:N_BEAMS}, () => new Float64Array(N_BEAMS));
const Bmat = Array.from({length:N_BEAMS}, () => new Float64Array(N_BEAMS));
const Ip = Array.from({length:N_BEAMS}, () => new Float64Array(N_BEAMS));

for (let i = 0; i < N_BEAMS; i++) {
  for (let k = 0; k < N_BEAMS; k++) {
    M[i][k] = simpson2(Phi[i], Phi[k]);
    A[i][k] = simpson2(Phid2[i], Phid2[k]);
    Bmat[i][k] = simpson2(Phid2[i], Phi[k]);
    Ip[i][k] = simpson2(Phid[i], Phid[k]);
  }
}

let maxMoff = 0;
for (let i = 0; i < N_BEAMS; i++)
  for (let k = 0; k < N_BEAMS; k++)
    if (i !== k) maxMoff = Math.max(maxMoff, Math.abs(M[i][k]));
console.log(`  M off-diag max = ${maxMoff.toExponential(2)}`);

let maxCsym = 0;
for (let i = 0; i < N_BEAMS; i++) {
  for (let k = 0; k < N_BEAMS; k++) {
    const C_ik = simpson2(Phi[i], Phid2[k]);
    maxCsym = Math.max(maxCsym, Math.abs(C_ik - Bmat[k][i]));
  }
}
console.log(`  C = B^T max err = ${maxCsym.toExponential(2)}`);

// ── Build K and M matrices via Kronecker products ──────────────────────────
const N2 = N_BEAMS * N_BEAMS;
console.log(`  Building ${N2}x${N2} K and M via Kronecker products...`);

const n = N_BEAMS;
function arrToMat(fa) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(Array.from(fa[i]));
  return math.matrix(rows);
}

const mA = arrToMat(A);
const mM = arrToMat(M);
const mB = arrToMat(Bmat);
const mIp = arrToMat(Ip);

//   K_ijkl = A_ik·M_jl + M_ik·A_jl + ν(B_ik·B_lj + B_ki·B_jl) + 2(1-ν)·Ip_ik·Ip_jl
//         = (A⊗M) + (M⊗A) + ν(B⊗Bᵀ + Bᵀ⊗B) + 2(1-ν)·(Ip⊗Ip)
const KfullMat = math.add(
  math.kron(mA, mM),
  math.kron(mM, mA),
  math.multiply(NU, math.add(math.kron(mB, math.transpose(mB)), math.kron(math.transpose(mB), mB))),
  math.multiply(2 * (1 - NU), math.kron(mIp, mIp))
);
const MbigMat = math.kron(mM, mM);

const K = new Float64Array(KfullMat.toArray().flat());
const Mbig = new Float64Array(MbigMat.toArray().flat());

let kasym = 0, masym = 0;
for (let p = 0; p < N2; p++) {
  for (let q = p+1; q < N2; q++) {
    kasym = Math.max(kasym, Math.abs(K[p*N2+q] - K[q*N2+p]));
    masym = Math.max(masym, Math.abs(Mbig[p*N2+q] - Mbig[q*N2+p]));
  }
}
console.log(`  K max|K_pq-K_qp| = ${kasym.toExponential(2)}`);
console.log(`  M max|M_pq-M_qp| = ${masym.toExponential(2)}`);

// ── Center constraint: W(0.5, 0.5) = 0 (free-edge only) ─────────────────────

let Nred, pivot;
if (CLAMPED) {
  Nred = N2;
  pivot = -1;
} else {
  const centPhi = new Float64Array(N_BEAMS);
  for (let i = 0; i < N_BEAMS; i++) centPhi[i] = phi(i, 0.5);

  const cVec = new Float64Array(N2);
  for (let i = 0; i < N_BEAMS; i++)
    for (let j = 0; j < N_BEAMS; j++)
      cVec[i + j * N_BEAMS] = centPhi[i] * centPhi[j];

  pivot = 0;
  let maxC = Math.abs(cVec[0]);
  for (let p = 1; p < N2; p++) {
    if (Math.abs(cVec[p]) > maxC) { maxC = Math.abs(cVec[p]); pivot = p; }
  }
  console.log(`  Center constraint pivot = ${pivot}, |c| = ${maxC.toExponential(2)}`);

  Nred = N2 - 1;
}
const Kred = new Float64Array(Nred * Nred);
const Mred = new Float64Array(Nred * Nred);

if (CLAMPED) {
  for (let a = 0; a < Nred; a++)
    for (let b = 0; b < Nred; b++) {
      Kred[a * Nred + b] = K[a * N2 + b];
      Mred[a * Nred + b] = Mbig[a * N2 + b];
    }
} else {
  for (let a = 0; a < Nred; a++) {
    const ra = a < pivot ? a : a + 1;
    const SaPivot = -cVec[ra] / cVec[pivot];
    for (let b = 0; b < Nred; b++) {
      const rb = b < pivot ? b : b + 1;
      const SbPivot = -cVec[rb] / cVec[pivot];
      Kred[a * Nred + b] = K[ra * N2 + rb]
        + K[ra * N2 + pivot] * SbPivot
        + SaPivot * K[pivot * N2 + rb]
        + SaPivot * K[pivot * N2 + pivot] * SbPivot;
      Mred[a * Nred + b] = Mbig[ra * N2 + rb]
        + Mbig[ra * N2 + pivot] * SbPivot
        + SaPivot * Mbig[pivot * N2 + rb]
        + SaPivot * Mbig[pivot * N2 + pivot] * SbPivot;
    }
  }
}

// ── Eigensolve ──────────────────────────────────────────────────────────────
console.log(`  Solving ${Nred}x${Nred} generalized eigenvalue problem...`);
const t0 = Date.now();

const toArr = v => typeof v.toArray === 'function' ? v.toArray() : v;

const Mmat = math.reshape(Array.from(Mred), [Nred, Nred]);

// Generalized EVP: K·v = λ·M·v
// Transform: M^(-1/2)·K·M^(-1/2)·u = λ·u  via eigs of M
const Mres = math.eigs(Mmat);
const Mvals = toArr(Mres.values);
const MvecEig = Mres.eigenvectors.map(e => toArr(e.vector));

const Vflat = new Float64Array(Nred * Nred);
for (let k = 0; k < Nred; k++)
  for (let p = 0; p < Nred; p++)
    Vflat[p * Nred + k] = MvecEig[k][p];

const DinvSqrt = Mvals.map(v => 1 / Math.sqrt(Math.max(v, 1e-15)));

// Vᵀ·K·V via matrix multiply
console.log('  Computing Vᵀ·K·V...');
const KredMat = math.matrix(math.reshape(Array.from(Kred), [Nred, Nred]));
const VMat = math.matrix(math.reshape(Array.from(Vflat), [Nred, Nred]));
const KV = math.multiply(KredMat, VMat);
const VtKVMat = math.multiply(math.transpose(VMat), KV);
const VtKV = new Float64Array(VtKVMat.toArray().flat());

// Keff = D^{-1/2} · VtKV · D^{-1/2}
const Keff = new Float64Array(Nred * Nred);
for (let a = 0; a < Nred; a++)
  for (let b = 0; b < Nred; b++)
    Keff[a * Nred + b] = VtKV[a * Nred + b] * DinvSqrt[a] * DinvSqrt[b];

// Symmetrize
for (let a = 0; a < Nred; a++)
  for (let b = a+1; b < Nred; b++) {
    const avg = (Keff[a * Nred + b] + Keff[b * Nred + a]) / 2;
    Keff[a * Nred + b] = avg; Keff[b * Nred + a] = avg;
  }

console.log(`  Transform done in ${((Date.now()-t0)/1000).toFixed(1)}s, running eigs...`);
const result = math.eigs(math.reshape(Array.from(Keff), [Nred, Nred]), { eigenvectors: true });
console.log(`  eigs done in ${((Date.now()-t0)/1000).toFixed(1)}s`);

// ── Process results ─────────────────────────────────────────────────────────
const vals = toArr(result.values);
const order = vals.map((_,i) => i).sort((a,b) => vals[a] - vals[b]);
const eVal = order.map(i => vals[i]);
const eVecKeff = order.map(i => toArr(result.eigenvectors[i].vector));

// Back-transform reduced → full with center constraint
const eVec = eVecKeff.map(u => {
  const v = new Float64Array(Nred);
  for (let p = 0; p < Nred; p++) {
    let sum = 0;
    for (let q = 0; q < Nred; q++)
      sum += Vflat[p * Nred + q] * DinvSqrt[q] * u[q];
    v[p] = sum;
  }
  // Scale sign so center is positive
  return v;
});

// Expand from reduced to full DOFs
function expandReduced(vRed, evOut) {
  const v = evOut ?? new Float64Array(N2);
  if (CLAMPED) {
    for (let a = 0; a < Nred; a++) v[a] = vRed[a];
  } else {
    for (let a = 0; a < Nred; a++) {
      const ra = a < pivot ? a : a + 1;
      v[ra] = vRed[a];
    }
    let sum = 0;
    for (let a = 0; a < Nred; a++) {
      const ra = a < pivot ? a : a + 1;
      sum += cVec[ra] * v[ra];
    }
    v[pivot] = -sum / cVec[pivot];
  }
  return v;
}

// Frequencies: fₖ = F11 · √(λₖ / λ₁)
// Skip rigid body modes (eigenvalues near zero)
let firstElastic = 0;
if (!CLAMPED) {
  for (let k = 0; k < Nred; k++) {
    if (eVal[k] > 1e-6) { firstElastic = k; break; }
  }
}
const f0 = eVal[firstElastic];
const freqs = eVal.map(v => F11 * Math.sqrt(v / f0));

const valid = [];
for (let k = 0; k < Nred; k++) {
  if (freqs[k] >= 15 && freqs[k] <= 2000) valid.push(k);
}
const Mvalid = valid.length;
console.log(`  ${Nred} modes${CLAMPED ? '' : ` (${firstElastic} rigid body skipped)`}, ${Mvalid} in 15-2000 Hz`);
console.log(`  First 5 eigenvalues: ${eVal.slice(0,5).map(v=>v.toFixed(1)).join(', ')}`);
console.log(`  First 5 frequencies: ${freqs.slice(0,5).map(v=>v.toFixed(1)).join(', ')} Hz`);

// ── Precompute grid values ──────────────────────────────────────────────────
const Xgrid = Array.from({length: N_BEAMS}, () => new Float64Array(GRID_SIZE));
const Xcent = new Float64Array(N_BEAMS);
for (let i = 0; i < N_BEAMS; i++) {
  for (let gx = 0; gx < GRID_SIZE; gx++)
    Xgrid[i][gx] = phi(i, (gx + 0.5) / GRID_SIZE);
  Xcent[i] = phi(i, 0.5);
}

// ── Write binary ────────────────────────────────────────────────────────────
const header = 16;
const fSize = Mvalid * 8;
const aSize = Mvalid * 8;
const eSize = Mvalid * N2 * 8;
const total = header + fSize + aSize + eSize;

const buf = Buffer.alloc(total);
let off = 0;
buf.writeUInt32LE(0x4D4F4445, off); off += 4;
buf.writeUInt32LE(Mvalid, off); off += 4;
buf.writeUInt32LE(GRID_SIZE, off); off += 4;
buf.writeUInt32LE(N_BEAMS, off); off += 4;

const fArr = new Float64Array(Mvalid);
const aArr = new Float64Array(Mvalid);
const eVecArr = new Float64Array(Mvalid * N2);

for (let vi = 0; vi < Mvalid; vi++) {
  const k = valid[vi];
  const ev = expandReduced(eVec[k]);
  let center = 0;
  for (let i = 0; i < N_BEAMS; i++)
    for (let j = 0; j < N_BEAMS; j++)
      center += ev[i + j*N_BEAMS] * Xcent[i] * Xcent[j];
  const sign = center >= 0 ? 1 : -1;
  fArr[vi] = freqs[k];
  aArr[vi] = Math.abs(center) + 0.01;
  for (let n = 0; n < N2; n++)
    eVecArr[vi * N2 + n] = ev[n] * sign;
}

Buffer.from(fArr.buffer).copy(buf, header);
Buffer.from(aArr.buffer).copy(buf, header + fSize);
Buffer.from(eVecArr.buffer).copy(buf, header + fSize + aSize);

const outName = CLAMPED ? 'modes_clamped.bin' : 'modes.bin';
const outPath = path.join(__dirname, '..', 'public', outName);
fs.writeFileSync(outPath, buf);

const mb = (buf.length / (1024*1024)).toFixed(2);
console.log(`  Wrote modes.bin (${mb} MB, ${Mvalid} modes)`);
console.log(`  Freq range: ${fArr[0].toFixed(1)}-${fArr[Mvalid-1].toFixed(1)} Hz`);
console.log('Done.');
