# Chladni Tuner

A guitar tuner that renders real-time Chladni standing wave patterns on a 3D device, reacting to live microphone input or a built-in oscillator. Built with React Three Fiber, the app combines pitch detection, physical acoustics modeling (Rayleigh–Ritz method), and ordered dithering.

**Live demo:** [chladni-tuner.vercel.app](https://chladni-tuner.vercel.app)

## Features

- **Three simulation modes**: cos approximation (instant, no precomputed data), Rayleigh–Ritz free-edge (93 precomputed modes), Rayleigh–Ritz clamped (166 precomputed modes)
- **Tuner mode**: microphone → YIN pitch detection → nearest eigenmode → dithered Chladni pattern
- **Sound mode**: oscillator with half-step (♭/♯), octave, and cent controls cent buttons only in sound mode
- **Settings menu**: full canvas replacement (black bg, white text) invert toggle, simulation dropdown, about info
- **Settings navigation**: up/down arrows to move, center toggle to select, tuner/sound buttons to exit
- **Invert default ON**: native display is inverted; toggle to non inverted
- **3D device with arc-segment outer ring buttons**: six extruded annular sectors (north/south for up/down, east/west split into upper halves for ♯/♭ and lower halves for +/− cents)
- **Loading state**: pulsing "LOADING" text on screen canvas while modes.bin loads
- **Frequency bounds**: 20–2093 Hz; oscillator clamped, buttons disabled at limits

## Simulation Modes

| Mode | Solver | Precomputed | Modes |
|------|--------|-------------|-------|
| `cos` | Inline sin/cos formula | None | Instant, grid computed on mount |
| `ritz-free` | Rayleigh–Ritz, free-free beam eigenfunctions + center constraint | `public/modes.bin` | 93 (15–2000 Hz) |
| `ritz-clamped` | Rayleigh–Ritz, clamped-clamped beam eigenfunctions | `public/modes_clamped.bin` | 166 (15–2000 Hz) |

The Ritz modes use eigenvector blending between the two nearest precomputed modes for smooth transitions during frequency sweeps.

## Architecture

```
App
└── ThreeDevice (Canvas)
    ├── 3D scene (rotator group, drag-rotatable)
    │   ├── body mesh (ExtrudeGeometry, 577×1201, depth 60)
    │   ├── LEDs (sphere meshes; tuner + sound mode indicators)
    │   ├── mode buttons (tuner + sound, above circle, with LED indicators)
    │   ├── center circle toggle (settings / select)
    │   ├── 6 arc-segment outer ring buttons (north, south, east-upper, east-lower, west-upper, west-lower)
    │   ├── decorative gold spheres
    │   └── screen mesh (PlaneGeometry, CanvasTexture compositor)
    │       └── ScreenCanvas: dithered Chladni grid + note name + octave + Hz + cent meter
    └── lighting (directional + ambient)
```

## Key Files

| File | Purpose |
|---|---|
| `src/components/ThreeDevice.tsx` | 3D scene, body/arcs/buttons, screen compositor, settings canvas, LED logic |
| `src/App.tsx` | State management (mode, settings, simulation, invert, frequency) |
| `src/hooks/useChladni.ts` | Frequency → nearest modes → eigenvector blend → grid evaluation |
| `src/hooks/useModesData.ts` | Loads `modes.bin` / `modes_clamped.bin`, parses header, precomputes beam function grid |
| `src/hooks/usePitchDetection.ts` | Microphone → AnalyserNode → YIN loop |
| `src/hooks/useOscillator.ts` | OscillatorNode with clamped frequency stepping and cent acceleration |
| `src/lib/dither.ts` | 8×8 Bayer ordered dithering with per-frame animated noise and invert support |
| `src/lib/beam.ts` | Free-edge and clamped-clamped beam eigenfunction evaluation |
| `src/lib/notes.ts` | Note frequency table, `frequencyToNote`, cent calculation, half-step helpers |
| `src/lib/yin.ts` | YIN pitch detection algorithm |
| `scripts/precompute.cjs` | Rayleigh–Ritz plate solver (mathjs) → writes `public/modes.bin` or `modes_clamped.bin` |

## Data Flow

```
Mic (tuner mode) ──┐
                   ├── frequency → useChladni → dither → screen canvas
Osc (sound mode) ──┘
                   └── frequencyToNote → note name + octave + Hz + cents
```

## Interaction

- **Mode buttons**: tuner (left) / sound (right), switch modes, exit settings, activate corresponding LED
- **Center circle**: toggle settings menu; in settings mode acts as select
- **North arc** (top): octave up / settings up
- **South arc** (bottom): octave down / settings down
- **East-upper**: sharp / half-step up (sound mode only)
- **East-lower**: + cents (sound mode only)
- **West-upper**: flat / half-step down (sound mode only)
- **West-lower**: − cents (sound mode only)
- **Settings**: black bg, white menu, invert toggle, simulation dropdown, about; current simulation hidden from dropdown

## Commands

```
pnpm dev          # dev server
pnpm build        # production build
pnpm tsc          # typecheck only
pnpm precompute   # run Rayleigh-Ritz solver (requires --clamped for clamped BCs)
```

## Precompute

`scripts/precompute.cjs` solves the generalized eigenvalue problem `K·v = λ·M·v` for a thin square plate using the Rayleigh–Ritz method with beam eigenfunction basis sets:

- **Free-edge** (default): free-free beam functions + rigid body modes, center constraint `W(0.5,0.5)=0`, N_ELASTIC=15, writes `public/modes.bin`
- **Clamped** (`--clamped`): clamped-clamped beam functions, N_ELASTIC=13, writes `public/modes_clamped.bin`

The mode shapes are linear combinations of beam eigenfunction products evaluated on a 128×128 grid.
