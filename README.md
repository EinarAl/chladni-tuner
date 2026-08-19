# Chladni Tuner

A guitar tuner that renders real-time Chladni standing wave patterns on a 3D device, reacting to live microphone input or a built-in oscillator. Built with React Three Fiber, the app combines pitch detection, physical acoustics modeling (Rayleigh-Ritz method), and ordered dithering.

**Live demo:** [chladni-tuner.vercel.app](https://chladni-tuner.vercel.app)

## Use case(s)

- Tune a stringed instrument by eye: play a note, watch the plate settle into the standing-wave pattern of the nearest pitch, read cents off the device screen
- Sweep an oscillator across 15 to 2000 Hz and watch eigenmode transitions blend between precomputed modes
- Compare boundary conditions: switch between free-edge and clamped solvers and see the same frequency produce different geometry

## System Architecture

```
App
└── ThreeDevice (Canvas)
    ├── 3D scene (rotator group, drag-rotatable)
    │   ├── body mesh (ExtrudeGeometry, depth 60)
    │   ├── LEDs (sphere meshes; tuner + sound mode indicators)
    │   ├── mode buttons (tuner + sound, above circle, with LED indicators)
    │   ├── center circle toggle (settings / select)
    │   ├── 6 arc-segment outer ring buttons (north, south, east-upper, east-lower, west-upper, west-lower)
    │   ├── decorative gold spheres
    │   └── screen mesh (PlaneGeometry, CanvasTexture compositor)
    │       └── ScreenCanvas: dithered Chladni grid + note name + octave + Hz + cent meter
    └── lighting (directional + ambient)

Mic (tuner mode) ──┐
                   ├── frequency -> useChladni -> dither -> screen canvas
Osc (sound mode) ──┘
                   └── frequencyToNote -> note name + octave + Hz + cents
```

## Component Choices

**Precomputed Rayleigh-Ritz modes over runtime solving.** The plate solver runs offline (`scripts/precompute.cjs`, mathjs generalized eigenvalue problem) and writes `modes.bin` / `modes_clamped.bin`. At runtime the app blends only the eigenvectors of the two nearest modes. Rejected: solving per frame, too slow for 60 fps on a 128x128 grid. Tradeoff: a brief `LOADING` state while the binary loads.

**YIN pitch detection over FFT peak picking.** Spectral peaks produce octave errors on low guitar strings, where harmonics often dominate the fundamental. YIN avoids that failure mode. Rejected: naive autocorrelation, which shares the weakness. Tradeoff: more math per frame, acceptable because detection runs only in tuner mode.

**CanvasTexture screen compositor over a DOM HUD.** Note name, octave, Hz readout and cent meter render into the same canvas as the dithered pattern, mapped onto the 3D screen mesh. Rejected: a DOM overlay, which breaks the handheld-device look and splits state between React and the scene. Tradeoff: you lay out text inside the canvas yourself.

**8x8 Bayer ordered dithering on the CPU.** The Chladni grid gets dithered each frame with animated noise for a pixel-exact retro display, with invert support since the native look is inverted. Rejected: a postprocessing shader pass, which would dither the whole scene instead of only the plate pattern. Tradeoff: a JS loop per frame, bounded by the small grid size.

## What I'd Do Differently

- The two `.bin` files duplicate header and grid metadata. One indexed file with a shared header would cut loading logic in half.
- Eigenvector blending between the two nearest modes smears shapes near mode crossings during fast sweeps. Mode tracking keyed on frequency proximity would keep patterns crisp through transitions.
- The settings menu grew into boolean-flag navigation inside one component. A small explicit state machine (mode, settings, item) would age better as menus expand.
- `beam.ts` and `yin.ts` produce the tuning display and have zero tests. Property-based tests on the solver and detector would lock behavior before future refactors.

## Setup / Quick Start

Requires Node 20+ and pnpm.

```bash
pnpm install
pnpm dev          # dev server
```

Production build and typecheck:

```bash
pnpm build        # production build
pnpm tsc          # typecheck only
```

Regenerating the precomputed modes is optional (binaries ship in `public/`):

```bash
pnpm precompute              # free-edge modes -> public/modes.bin
pnpm precompute --clamped    # clamped modes   -> public/modes_clamped.bin
```

## Simulation Modes

| Mode | Solver | Precomputed | Modes |
|------|--------|-------------|-------|
| `cos` | Inline sin/cos formula | None | Instant, grid computed on mount |
| `ritz-free` | Rayleigh-Ritz, free-free beam eigenfunctions + center constraint | `public/modes.bin` | 93 (15-2000 Hz) |
| `ritz-clamped` | Rayleigh-Ritz, clamped-clamped beam eigenfunctions | `public/modes_clamped.bin` | 166 (15-2000 Hz) |

The Ritz modes blend the eigenvectors of the two nearest precomputed modes, which smooths transitions during frequency sweeps.

## Key Files

| File | Purpose |
|---|---|
| `src/components/ThreeDevice.tsx` | 3D scene, body/arcs/buttons, screen compositor, settings canvas, LED logic |
| `src/App.tsx` | State management (mode, settings, simulation, invert, frequency) |
| `src/hooks/useChladni.ts` | Frequency to nearest modes to eigenvector blend to grid evaluation |
| `src/hooks/useModesData.ts` | Loads `modes.bin` / `modes_clamped.bin`, parses header, precomputes beam function grid |
| `src/hooks/usePitchDetection.ts` | Microphone to AnalyserNode to YIN loop |
| `src/hooks/useOscillator.ts` | OscillatorNode with clamped frequency stepping and cent acceleration |
| `src/lib/dither.ts` | 8x8 Bayer ordered dithering with per-frame animated noise and invert support |
| `src/lib/beam.ts` | Free-edge and clamped-clamped beam eigenfunction evaluation |
| `src/lib/notes.ts` | Note frequency table, `frequencyToNote`, cent calculation, half-step helpers |
| `src/lib/yin.ts` | YIN pitch detection algorithm |
| `scripts/precompute.cjs` | Rayleigh-Ritz plate solver (mathjs), writes `public/modes.bin` or `modes_clamped.bin` |

## Interaction

- **Mode buttons**: tuner (left) / sound (right), switch modes, exit settings, activate corresponding LED
- **Center circle**: toggle settings menu; in settings mode acts as select
- **North arc** (top): octave up / settings up
- **South arc** (bottom): octave down / settings down
- **East-upper**: sharp / half-step up (sound mode only)
- **East-lower**: + cents (sound mode only)
- **West-upper**: flat / half-step down (sound mode only)
- **West-lower**: - cents (sound mode only)
- **Settings**: black bg, white menu, invert toggle, simulation dropdown, about; current simulation hidden from dropdown

## Precompute

`scripts/precompute.cjs` solves the generalized eigenvalue problem `K v = lambda M v` for a thin square plate using the Rayleigh-Ritz method with beam eigenfunction basis sets:

- **Free-edge** (default): free-free beam functions + rigid body modes, center constraint `W(0.5,0.5)=0`, N_ELASTIC=15, writes `public/modes.bin`
- **Clamped** (`--clamped`): clamped-clamped beam functions, N_ELASTIC=13, writes `public/modes_clamped.bin`

Mode shapes are linear combinations of beam eigenfunction products evaluated on a 128x128 grid.
