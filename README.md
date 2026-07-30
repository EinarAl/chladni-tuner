# Chladni Tuner

A 3D interactive audio visualization and instrument tuning tool that simulates Chladni plate patterns in real time. Visualize the vibrational modes of a square plate as you play or tune an instrument.

## Theory

Chladni patterns form when a vibrating plate is sprinkled with sand or powder — the sand settles at nodal lines (points of zero displacement), revealing the plate's resonant mode shape. This app simulates those patterns computationally using three different approaches.

## Simulation Modes

### Cos Approximation

An inline analytic approximation using products of cosines:

```
ψ(x, y) = cos(n·π·x)·cos(m·π·y) − cos(m·π·x)·cos(n·π·y)
```

n and m scale with frequency. Fast, no precomputed data needed — useful as a lightweight fallback.

### Ritz Free-Edge

Uses the Rayleigh-Ritz method with free-edge beam eigenfunctions (n=0,1 rigid body modes, n≥2 elastic modes). Computed offline by `scripts/precompute.cjs` and stored in `public/modes.bin`. The solver assembles mass and stiffness matrices from 2D products of one-dimensional beam functions, solves the generalized eigenvalue problem, and produces mode shapes and frequencies for the first ~188 modes.

### Ritz Clamped

Same Rayleigh-Ritz approach but with clamped-clamped boundary conditions (all modes elastic, no rigid body modes). Precomputed data in `public/modes_clamped.bin` (166 modes). Uses 13 elastic beam functions with the clamped beam formula:

```
φₙ(x) = cosh(βx) − cos(βx) − σ·(sinh(βx) − sin(βx))
```

The sign difference in the sine term shifts the mode shapes to satisfy clamped BCs (zero displacement and zero slope at edges).

## Controls

### 3D Interface

The device renders as a 3D model with interactive buttons arranged around a central circle:

- **North/South arcs** — octave up/down (▲▼)
- **East-West upper arcs** — half-step up/down (♯/♭)
- **East-West lower arcs** — fine cent adjustment (+/−)
- **Center circle** — toggle settings / select
- **Side buttons** — switch between Tuner and Sound modes

### Modes

- **Tuner** — listens to external audio (mic), detects pitch, and displays the corresponding Chladni pattern
- **Sound** — generates a tone via oscillator (Web Audio API), pattern follows the synthesized frequency

### Settings

Press the center gear to open settings:
- **Back** — return to current mode
- **Invert Chladni** — swap black/white on the pattern display
- **Simulation** — switch between Cos, Ritz Free-Edge, and Ritz Clamped (current simulation is hidden from the dropdown)

## Stack

- React 19 + TypeScript
- Vite (Rolldown)
- Three.js / React Three Fiber (@react-three/fiber, @react-three/drei)
- Web Audio API (PitchDetector, OscillatorNode)
- Canvas 2D (Chladni rendering with dithering)
- Motion (formerly Framer Motion) — spring physics for device rotation

## Build & Run

```bash
pnpm install
pnpm dev     # development server
pnpm build   # production build
```

## Precomputing Modes

```bash
node scripts/precompute.cjs              # free-edge → public/modes.bin
node scripts/precompute.cjs --clamped    # clamped   → public/modes_clamped.bin
```
