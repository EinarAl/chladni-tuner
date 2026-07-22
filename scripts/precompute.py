"""Rayleigh-Ritz free-edge square plate solver.

Generates public/modes.bin with eigenfrequencies and mode shapes
using free-free beam eigenfunctions as basis + center constraint.

Usage: python scripts/precompute.py
"""
from __future__ import annotations
import struct
import time
import sys
import numpy as np
from scipy import linalg

# ── Parameters ─────────────────────────────────────────────────────────────
N_ELASTIC = 30   # elastic free-free beam modes
N_RIGID = 2      # rigid body modes (translation, rotation)
N_BEAMS = N_ELASTIC + N_RIGID
NU = 0.3
GRID_SIZE = 128
F11 = 23.0
N_INT = 4000

# ── Free-free beam eigenfunctions ──────────────────────────────────────────
# n=0: φ₀(x) = 1               (translation)
# n=1: φ₁(x) = √3·(2x-1)       (rotation)
# n≥2: φₙ(x) = cosh(βx)+cos(βx) - σ·(sinh(βx)+sin(βx))
#   β solves cosh(β)cos(β) = 1,  σ = (coshβ-cosβ)/(sinhβ-sinβ)

# β values for free-free beam (n≥2 beam mode, same as clamped-clamped: coshβ·cosβ=1)
BETA = [
    0.0,
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
]
# Extend BETA for higher N using asymptotic formula β_n ≈ (n+0.5)π
while len(BETA) <= N_ELASTIC:
    n = len(BETA)
    BETA.append((n + 0.5) * np.pi)
print(f"  N_ELASTIC={N_ELASTIC}, N_BEAMS={N_BEAMS}, BETA length={len(BETA)}")

def sigma_for(b: float) -> float:
    ch = np.cosh(b); sh = np.sinh(b)
    c = np.cos(b); sn = np.sin(b)
    return (ch - c) / (sh - sn)

def beam_val(n: int, x: float | np.ndarray) -> float | np.ndarray:
    if n == 0:
        return np.ones_like(x) if isinstance(x, np.ndarray) else 1.0
    if n == 1:
        return np.sqrt(3) * (2 * x - 1)
    b = BETA[n - 1]
    s = sigma_for(b)
    bx = b * x
    return np.cosh(bx) + np.cos(bx) - s * (np.sinh(bx) + np.sin(bx))

def beam_deriv(n: int, x: float | np.ndarray) -> float | np.ndarray:
    if n == 0:
        return np.zeros_like(x) if isinstance(x, np.ndarray) else 0.0
    if n == 1:
        return 2 * np.sqrt(3) * (np.ones_like(x) if isinstance(x, np.ndarray) else 1.0)
    b = BETA[n - 1]
    s = sigma_for(b)
    bx = b * x
    return b * ((np.sinh(bx) - np.sin(bx)) - s * (np.cosh(bx) + np.cos(bx)))

def beam_deriv2(n: int, x: float | np.ndarray) -> float | np.ndarray:
    if n < 2:
        return np.zeros_like(x) if isinstance(x, np.ndarray) else 0.0
    b = BETA[n - 1]
    s = sigma_for(b)
    bx = b * x
    return b * b * ((np.cosh(bx) - np.cos(bx)) - s * (np.sinh(bx) - np.sin(bx)))

# ── Precompute via Simpson's rule ───────────────────────────────────────────
h = 1.0 / N_INT
NT = N_INT + 1
xs = np.linspace(0.0, 1.0, NT)

Phi = np.zeros((N_BEAMS, NT))
Phid = np.zeros((N_BEAMS, NT))
Phid2 = np.zeros((N_BEAMS, NT))

for i in range(N_BEAMS):
    Phi[i] = beam_val(i, xs)
    Phid[i] = beam_deriv(i, xs)
    Phid2[i] = beam_deriv2(i, xs)

# Simpson's rule weights
w = np.ones(NT)
w[1:-1:2] = 4
w[2:-2:2] = 2
w[0] = w[-1] = 1
simpson_scale = h / 3

def simpson2(fx: np.ndarray, fy: np.ndarray) -> float:
    return float(np.dot(fx * fy, w) * simpson_scale)

# ── Build integral matrices ────────────────────────────────────────────────
print("  Computing integral matrices...")
M = np.zeros((N_BEAMS, N_BEAMS))
A = np.zeros((N_BEAMS, N_BEAMS))
Bmat = np.zeros((N_BEAMS, N_BEAMS))
Ip = np.zeros((N_BEAMS, N_BEAMS))

for i in range(N_BEAMS):
    for k in range(N_BEAMS):
        M[i, k] = simpson2(Phi[i], Phi[k])
        A[i, k] = simpson2(Phid2[i], Phid2[k])
        Bmat[i, k] = simpson2(Phid2[i], Phi[k])
        Ip[i, k] = simpson2(Phid[i], Phid[k])

max_M_off = np.max(np.abs(M - np.diag(np.diag(M))))
print(f"  M off-diag max = {max_M_off:.2e}")

max_C_sym = 0.0
for i in range(N_BEAMS):
    for k in range(N_BEAMS):
        C_ik = simpson2(Phi[i], Phid2[k])
        max_C_sym = max(max_C_sym, abs(C_ik - Bmat[k, i]))
print(f"  C = B^T max err = {max_C_sym:.2e}")

# ── Build K and M matrices ──────────────────────────────────────────────────
N2 = N_BEAMS * N_BEAMS
print(f"  Building {N2}x{N2} K and M matrices...")

K = np.zeros((N2, N2))
Mbig = np.zeros((N2, N2))

for i in range(N_BEAMS):
    for j in range(N_BEAMS):
        p = i + j * N_BEAMS
        for k in range(N_BEAMS):
            for l in range(N_BEAMS):
                q = k + l * N_BEAMS
                k1 = A[i, k] * M[j, l]
                k2 = M[i, k] * A[j, l]
                k3 = NU * (Bmat[i, k] * Bmat[l, j] + Bmat[k, i] * Bmat[j, l])
                k4 = 2 * (1 - NU) * Ip[i, k] * Ip[j, l]
                K[p, q] = k1 + k2 + k3 + k4
                Mbig[p, q] = M[i, k] * M[j, l]

K_upper = np.triu(K, 1)
M_upper = np.triu(Mbig, 1)
print(f"  K max|K_pq-K_qp| = {np.max(np.abs(K - K.T)):.2e}")
print(f"  M max|M_pq-M_qp| = {np.max(np.abs(Mbig - Mbig.T)):.2e}")

# ── Center constraint: W(0.5, 0.5) = 0 ─────────────────────────────────────
cent_phi = np.array([beam_val(i, 0.5) for i in range(N_BEAMS)])
cVec = np.zeros(N2)
for i in range(N_BEAMS):
    for j in range(N_BEAMS):
        cVec[i + j * N_BEAMS] = cent_phi[i] * cent_phi[j]

pivot = int(np.argmax(np.abs(cVec)))
print(f"  Center constraint pivot = {pivot}, |c| = {abs(cVec[pivot]):.2e}")

# Null-space elimination
Nred = N2 - 1
Kred = np.zeros((Nred, Nred))
Mred = np.zeros((Nred, Nred))

for a in range(Nred):
    ra = a if a < pivot else a + 1
    SaPivot = -cVec[ra] / cVec[pivot]
    for b in range(Nred):
        rb = b if b < pivot else b + 1
        SbPivot = -cVec[rb] / cVec[pivot]
        Kred[a, b] = (K[ra, rb] + K[ra, pivot] * SbPivot
                      + SaPivot * K[pivot, rb]
                      + SaPivot * K[pivot, pivot] * SbPivot)
        Mred[a, b] = (Mbig[ra, rb] + Mbig[ra, pivot] * SbPivot
                      + SaPivot * Mbig[pivot, rb]
                      + SaPivot * Mbig[pivot, pivot] * SbPivot)

# ── Eigensolve ──────────────────────────────────────────────────────────────
print(f"  Solving {Nred}x{Nred} generalized eigenvalue problem...")
t0 = time.time()

eigvals, eigvecs = linalg.eigh(Kred, Mred)
eigvecs = eigvecs.T  # now each row is a mode

print(f"  Eigensolve done in {time.time()-t0:.1f}s")

# ── Process results ─────────────────────────────────────────────────────────
# Frequencies: fₖ = F11 · √(λₖ / λ₁)
first_elastic = 0
for k in range(Nred):
    if eigvals[k] > 1e-6:
        first_elastic = k
        break
f0 = eigvals[first_elastic]
freqs = F11 * np.sqrt(eigvals / f0)

valid = [k for k in range(Nred) if 15 <= freqs[k] <= 2000]
Mvalid = len(valid)
print(f"  {Nred} modes, {first_elastic} rigid body skipped, {Mvalid} in 15-2000 Hz")
print(f"  First 5 eigenvalues: {eigvals[:5]}")
print(f"  First 5 frequencies: {freqs[:5]} Hz")

# Expand reduced → full with center constraint
def expand_reduced(v_red: np.ndarray) -> np.ndarray:
    v = np.zeros(N2)
    for a in range(Nred):
        ra = a if a < pivot else a + 1
        v[ra] = v_red[a]
    v[pivot] = -np.dot(cVec, v) / cVec[pivot]
    return v

# Precompute grid values
Xgrid = np.zeros((N_BEAMS, GRID_SIZE))
Xcent = np.zeros(N_BEAMS)
gx_vals = (np.arange(GRID_SIZE) + 0.5) / GRID_SIZE
for i in range(N_BEAMS):
    Xgrid[i] = beam_val(i, gx_vals)
    Xcent[i] = beam_val(i, 0.5)

# ── Write binary ────────────────────────────────────────────────────────────
header = 16
fSize = Mvalid * 8
aSize = Mvalid * 8
eSize = Mvalid * N2 * 8
total = header + fSize + aSize + eSize

buf = bytearray(total)

# Header
struct.pack_into('<I', buf, 0, 0x4D4F4445)
struct.pack_into('<I', buf, 4, Mvalid)
struct.pack_into('<I', buf, 8, GRID_SIZE)
struct.pack_into('<I', buf, 12, N_BEAMS)

fArr = np.zeros(Mvalid, dtype=np.float64)
aArr = np.zeros(Mvalid, dtype=np.float64)
eVecArr = np.zeros(Mvalid * N2, dtype=np.float64)

for vi, k in enumerate(valid):
    ev = expand_reduced(eigvecs[k])
    center = 0.0
    for i in range(N_BEAMS):
        for j in range(N_BEAMS):
            center += ev[i + j * N_BEAMS] * Xcent[i] * Xcent[j]
    sign = 1.0 if center >= 0 else -1.0
    fArr[vi] = freqs[k]
    aArr[vi] = abs(center) + 0.01
    for n in range(N2):
        eVecArr[vi * N2 + n] = ev[n] * sign

buf[header:header + fSize] = fArr.tobytes()
buf[header + fSize:header + fSize + aSize] = aArr.tobytes()
buf[header + fSize + aSize:] = eVecArr.tobytes()

out_path = sys.path[0] + '/../public/modes.bin' if '__file__' not in dir() else __file__.rsplit('/', 1)[0] + '/../public/modes.bin'
import os
script_dir = os.path.dirname(os.path.abspath(__file__))
out_path = os.path.normpath(os.path.join(script_dir, '..', 'public', 'modes.bin'))
with open(out_path, 'wb') as f:
    f.write(buf)

mb = total / (1024 * 1024)
print(f"  Wrote modes.bin ({mb:.2f} MB, {Mvalid} modes)")
print(f"  Freq range: {fArr[0]:.1f}-{fArr[-1]:.1f} Hz")
print("Done.")
