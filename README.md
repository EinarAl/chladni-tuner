# Chladni Tuner

A **progressive web app** guitar tuner that renders real-time Chladni standing-wave patterns on a 3D device, reacting to live microphone input or a built-in oscillator. Built with React Three Fiber, the app combines pitch detection, physical acoustics modeling, and ordered dithering to produce the visual.

---

## Abstract

This project bridges musical instrument tuning with physical acoustics visualization. A guitar tuner detects pitch via the YIN algorithm (or generates tones via an oscillator) and maps the frequency to a standing wave mode on a thin square plate. The nodal lines of the resulting eigenfunction are rendered as a dithered binary image on the screen of a 3D device. The visualization uses 8×8 Bayer ordered dithering with per frame animated noise to emulate the granular appearance of sand on a physical Chladni plate.

---

## Research Background

### The Chladni Experiment

Ernst Chladni (1756–1827) discovered that sprinkling sand on a vibrating metal plate causes the grains to migrate to nodal lines — the stationary regions of the plate's standing-wave pattern [1]. Different frequencies excite different eigenmodes of the plate, producing distinct patterns. This provided the first visualization of two-dimensional standing waves and laid the foundation for modal analysis.

### Governing Physics

The transverse displacement `w(x, y, t)` of a thin elastic plate is governed by the Kirchhoff–Love biharmonic equation [2, 4]:

```
D · ∇⁴w + ρh · ∂²w/∂t² = 0
```

where `D = Eh³/[12(1-ν²)]` is the flexural rigidity, `ρ` is density, `h` is thickness, `E` is Young's modulus, and `ν` is Poisson's ratio. For harmonic motion `w(x, y, t) = W(x, y)·cos(ωt)`, this reduces to the eigenvalue problem:

```
∇⁴W = λW,    λ = ω²ρh/D
```

### The Free-Edge Square Plate Problem

For a square plate with **free edges** and a **center constraint**, the exact eigenfunctions have been an open problem since Rayleigh [3]. As noted in contemporary research: *"an exact solution to this problem has not yet been found"* [5]. The difficulty lies in the free-edge boundary conditions (zero bending moment and zero effective shear), which couple the spatial dimensions.

Ritz published the first numerical approximation in 1909 [6]. Modern treatments use the Ritz method with free-free beam functions as basis sets, assembling stiffness and mass matrices to solve for eigenvalues and mode shapes.

### Common Online Simulators

Most web-based Chladni simulators use a simplified 2nd-order wave equation (Helmholtz), treating the plate as a membrane rather than a thin elastic plate [7]:

```
s(x, y) = a·sin(nπx)·sin(mπy) + b·sin(mπx)·sin(nπy)    with   n² + m² = k
```

This produces visually recognizable patterns but the author of one such implementation notes: *"accurately generating Chladni patterns requires more sophisticated modeling… The correct equation uses the biharmonic operator and was previously solved by Ritz. Solving this requires advanced techniques that I do not yet possess"* [8].

Another common approximation is the standing-wave formula:

```
cos(nπx/L)·cos(mπy/L) - cos(mπx/L)·cos(nπy/L) = 0
```

Both of these produce diagonal grids and plasma-like patterns that resemble Chladni figures visually, but they do **not** reproduce experimental results. Researchers at Brigham Young University tested the cos-cos formula and found: *"Although the solutions resemble 2D mode shapes, they do not match up very well with the mode shapes observed experimentally on a Chladni plate"* [9].

### Our Approach

We implement the **Rayleigh–Ritz method** directly: solving the 4th-order biharmonic eigenvalue problem `∇⁴W = λW` using beam eigenfunctions as the basis set. This is the same mathematical approach Ritz developed in 1909 [6], solving the correct Kirchhoff plate equation rather than a membrane approximation.

The mode shapes are computed as weighted sums of beam eigenfunction products:

```
Wₖ(x, y) = Σᵢⱼ aᵢⱼ·Xᵢ(x)·Yⱼ(y)
```

The project now supports two boundary condition configurations across separate branches:

| Branch | Edge BC | Basis | Center | N_ELASTIC | Valid modes |
|--------|---------|-------|--------|-----------|-------------|
| `ritz-method` | Clamped (W = ∂W/∂n = 0) | Clamped-clamped beam functions | Free | 13 | ~200 |
| `free-edges` | Free (M = V = 0) | Free-free beam functions + rigid body modes | Constrained (W=0) | **+15** | **+93** |

The free-edge solver includes:
- Two rigid body modes (translation and rotation)
- 15 elastic free-free beam modes with `σ = (coshβ−cosβ)/(sinhβ−sinβ)` (reciprocal of clamped σ)
- Center constraint `W(0.5, 0.5) = 0` via null-space elimination
- 93 valid modes in 15–2000 Hz range (vs 202 for clamped)

**Eigenvalue convergence verified** — increasing N_ELASTIC from 13 to 15 changes eigenvalues by <0.5% (typically <0.2%), confirming convergence for all 93 valid modes.

### Experimental Evidence

Experimental photographs of a 24 cm square brass plate (0.86 mm thick) driven at center by a mechanical shaker show patterns with **curved nodal lines, circular nodes near the center, and corner details** — completely unlike the straight diagonal grids produced by the cos-cos formula [10]. A UC Santa Barbara student (Kelly Janus) catalogued 35 distinct eigenmodes of this plate [11].

---

## Methodology

### Offline Precomputation

We solve the generalized eigenvalue problem `K·v = λ·M·v` for a thin square plate using `scripts/precompute.cjs`. This script:

1. Defines **N = 15 elastic free-free beam eigenfunctions** `Xᵢ(x)` as basis plus 2 rigid body modes (translation and rotation), totaling 17 basis functions. The elastic modes have the form `cosh(βx) + cos(βx) − σ(sinh(βx) + sin(βx))` where `β` solves `cosh(β)cos(β) = 1` (same β as clamped-clamped) and `σ = (coshβ−cosβ)/(sinhβ−sinβ)`.
2. Assembles the **stiffness matrix `K`** (289×289) and **mass matrix `M`** from beam function integrals via Simpson's rule (4000 points). The free-edge boundary conditions (zero bending moment `M = 0`, zero effective shear `V = 0`) are satisfied by the free-free beam functions by construction.
3. Applies center constraint `W(0.5, 0.5) = 0` via null-space elimination (reduces to 288 unknowns).
4. Solves `K·v = λ·M·v` by Cholesky-transforming to a standard eigenvalue problem `(M^{-1/2}·K·M^{-1/2})·u = λ·u`, solved with mathjs.
5. Writes valid modes (15–2000 Hz) as eigenfrequencies and coefficient vectors to `public/modes.bin`.

The mode shapes are linear combinations of product basis functions:

```
Wₖ(x, y) = Σᵢⱼ aᵢⱼ·Xᵢ(x)·Xⱼ(y)
```

### Real-Time Evaluation

On the client side, `src/hooks/useModesData.ts` loads `modes.bin` and precomputes the beam function values at each grid cell center. When a frequency is detected:

1. The two nearest precomputed modes bracketing the target frequency are found.
2. Their eigenvectors are linearly interpolated (if the target is between two modes).
3. The interpolated eigenvector is evaluated on the 128×128 grid as the double sum above.
4. The grid is normalized to a consistent scale and passed to the dither engine.

### Reference Plate

| Property | Value | Notes |
|---|---|---|
| Shape | Square | Free edges (M = V = 0) |
| Side length | a × a | Dimensionless (normalized to [0,1]) |
| Poisson's ratio ν | 0.3 | Typical for metals |
| Fundamental f₁₁ | 23 Hz | Set by `F11` parameter in precompute |
| N_ELASTIC | 15 | Elastic free-free beam eigenfunctions |
| N_BEAMS | 17 | 15 elastic + 2 rigid body modes |
| Matrix size | 289 × 289 | N_BEAMS², reduced to 288 by center constraint |
| Grid resolution | 128 × 128 | Precomputed at cell centers |
| Valid modes | 93 | 15–2000 Hz range |

### Frequency Bounds

| Bound | Value | Rationale |
|---|---|---|
| Minimum | 20 Hz | Below threshold of human hearing; floor of 8-string range |
| Maximum | 2093 Hz (C7) | Highest piano key; hearing safety; fractal resolution limit at 128×128 |

### Frequency Stepping Safety

The sound mode oscillator is clamped to 20–2093 Hz. Half-step and octave buttons cease to function at the bounds. The oscillator gain is fixed at 0.25 to prevent high-amplitude output.

---

## Findings

### What We Achieved

1. **Correct PDE solved.** Our solver uses the 4th-order biharmonic equation `∇⁴W = λW` with proper Kirchhoff boundary conditions, not the simplified 2nd-order wave equation used by most web Chladni simulators.

2. **Positive definite eigenvalues.** The K matrix has no spurious zero eigenvalues, confirming that the clamped-clamped beam eigenfunctions satisfy the boundary conditions by construction. The first non-zero eigenvalue corresponds to `f₁₁ = 23 Hz`.

3. **Physically plausible doublets.** The second and third modes appear as a degenerate doublet at 46.9 Hz `(f₂₁ = f₁₂)`, matching the expected behavior for a symmetric square plate.

4. **Valid mode count.** 202 of 225 possible modes fall within the 15–2000 Hz audible range, providing dense coverage across the guitar frequency spectrum.

5. **Smooth interpolation.** By blending between adjacent precomputed eigenvectors, frequency sweeps produce continuous transitions between mode shapes rather than discrete jumps.

### Convergence Verified

Increasing the number of free-free beam functions from N_ELASTIC=13 to N_ELASTIC=15 changes eigenvalues by <0.5% (typically <0.2%), confirming that the first 93 modes are well-converged. The number of valid modes in 15–2000 Hz remains at 93.

### Experimental Validation (D'Alessio 2021)

D'Alessio's experiments on a center-driven free-edge square plate [5] found resonant frequencies at **190, 340, 490, 800, 955 Hz** in the 1–1000 Hz range. Our free-edge solver produces 93 mode shapes covering this range, with the first few elastic modes at 23, 27.5, 40.2, 71.3, 71.3 Hz. Direct frequency comparison is not straightforward because our `F11 = 23 Hz` calibration parameter is set to match a different reference plate (not D'Alessio's specific brass plate), and the mode ordering depends on the specific plate dimensions and material properties.

### Current Limitations

1. **Practical ceiling at N_ELASTIC=30.** The Rayleigh–Ritz method converges to the exact solution as N → ∞. Our Python solver uses N_ELASTIC=30 (doubled from the earlier JavaScript N=15), giving a 1024×1024 eigenproblem via `scipy.linalg.eigh`. Eigenvalue change between N=15 and N=30 is <0.1% for the first 70 modes and <0.5% for all 93, confirming convergence. For Porter's high-accuracy standard (N=48), a 2499×2499 problem solves in ~13s, unlocking 200+ modes below 2000 Hz.

2. **Degenerate mode pairs.** The free-edge square plate has symmetry-induced degenerate pairs — multiple eigenfunctions share the same eigenvalue (e.g., modes 4 and 5 both at 71.28 Hz, modes 7 and 8 both at 125.13 Hz). These appear as duplicate entries in `modes.bin`, and the frequency-to-mode mapper may arbitrarily select one. The superposition is not physically wrong but the visualization loses the rotation information between the pair.

3. **Approximate frequencies.** The `F11 = 23 Hz` parameter sets the fundamental to match a reference brass plate, but actual eigenfrequencies depend on precise material properties (`E`, `ρ`, `ν`, `h`) that we approximate with ν = 0.3 (typical metals). The resulting frequency ratios `fₖ/f₁₁` are physically meaningful, but absolute frequencies are not calibrated to any specific physical plate.

4. **Center constraint is a simplification.** The solver enforces `W(0.5, 0.5) = 0` as a rigid pin via null-space elimination. A real mechanical shaker applies a point force, allowing small but non-zero displacement at the drive point. This constraint also couples the spatial dimensions, increasing the effective stiffness of the plate and potentially shifting mode frequencies upward.

5. **No direct experimental validation of mode shapes.** While the eigenfrequencies follow expected patterns for a free-edge plate, we have not systematically compared the rendered mode shapes against experimental photographs [10, 11] or D'Alessio's numerical mode shape snapshots [5]. A side-by-side comparison would confirm that the nodal line patterns match physical measurements.

6. **15–2000 Hz coverage boundary.** The mode set includes 93 modes spanning 23–1994 Hz. Frequencies below 23 Hz produce no modes and fall back to displaying the fundamental mode only. Frequencies above 1994 Hz hit the solver limit and display the highest available mode.

---

## Architecture

```
App
└── device container (w-full max-w-sm, aspect-ratio 577/917)
    └── ThreeDevice (Canvas — SVG-to-3D extrusion, screen via canvas-texture compositor)
        ├── 3D scene (rotator group, drag-rotatable)
        │   ├── scaled group (dynamic viewport scale × 1.25, 40% padding)
        │   │   ├── body mesh (ExtrudeGeometry, 577×917, depth 60)
        │   │   ├── LEDs (sphere meshes)
        │   │   ├── button meshes + icons (canvas textures from SVG, follow button on press)
        │   │   └── screen mesh (PlaneGeometry, CanvasTexture compositor)
        │   │       └── fractal (dithered) + note display + cent meter + Hz/ct
        │   └── drag rotation via pointer events → useFrame
        └── background + lights
```

### Key Files

| File | Purpose |
|---|---|
| `scripts/precompute.cjs` | Rayleigh-Ritz plate solver → writes `public/modes.bin` |
| `src/lib/beam.ts` | Free-free beam eigenfunction evaluation (cosh/cos basis + rigid body modes) |
| `src/lib/dither.ts` | 8×8 Bayer ordered dithering with per-frame animated noise |
| `src/lib/notes.ts` | Note frequency table, `frequencyToNote`, cent calculation, half-step helpers |
| `src/lib/yin.ts` | YIN pitch detection algorithm (zero external audio dependencies) |
| `src/hooks/useModesData.ts` | Loads `modes.bin`, parses header, precomputes beam function grid |
| `src/hooks/usePitchDetection.ts` | Microphone → AnalyserNode → YIN loop |
| `src/hooks/useOscillator.ts` | OscillatorNode with clamped frequency stepping (20–2093 Hz) |
| `src/hooks/useChladni.ts` | Frequency → nearest modes → eigenvector blend → grid evaluation |
| `src/components/ThreeDevice.tsx` | 3D scene, screen compositor, button rendering, LED states |

### Data Flow

```
Mic (tuner mode) ──┐
                   ├── frequency → useChladni → dither → screen canvas
Osc (sound mode) ──┘
                   └── frequencyToNote → note name + octave + Hz + cents
```

---

## Future Work

### Method Selector Toggle

Once all simulation approaches are stable, add a UI dropdown or toggle in the app to switch between the three methods:

- **cos approximation** (on `3D` branch) — simple sin/cos formula, fast, visually recognizable
- **Ritz clamped** (on `ritz-method` branch) — clamped-clamped beam eigenfunctions, 202 modes
- **Ritz free-edge** (on `free-edges` branch) — free-free beam functions + center constraint, 93 modes

This would allow users to compare the methods side-by-side and see how boundary conditions affect the mode shapes.

### Free-Edge Validation

The free-edge solver is implemented but needs validation against:
- Eigenfrequency tables from Leissa [12]
- UCSB experimental photos [10, 11] — do the mode shapes match?
- D'Alessio's numerical results [5]

Key questions to answer:
- Does the second mode at 27.5 Hz (ratio 1.20× fundamental) match physical expectations?
- Are the 93 valid modes in the correct frequency bands?
- Do the mode shapes show curved nodal lines and corner lobes characteristic of free-edge plates?

### Convergence Study — DONE

The free-edge problem requires more basis functions than clamped for equivalent accuracy. We increased `N_ELASTIC` from 13 to 15 and confirmed eigenvalue stability (<0.5% change). Further increases (to 18–20) are blocked by mathjs eigenvalue solver performance in JavaScript — a 483×483 problem times out.

### Python/NumPy Offline Solver — IMPLEMENTED

`scripts/precompute.py` is now the primary solver, replacing the earlier JavaScript `precompute.cjs`. It provides:
- **N_ELASTIC=30** (N_BEAMS=32, 1024×1024 matrices via `scipy.linalg.eigh`) — doubling the previous 15-function basis for better convergence
- **24× faster eigensolve** vs JavaScript mathjs (1.5s vs timeout at N=21)
- **Extensible to N=48+** — the current N=30 gives 93 modes in 15–2000 Hz with tighter eigenvalue convergence. At N=48 (Porter's standard), a 2499×2499 problem solves in ~13s, yielding |200+ modes.
- **Identical binary output** — writes the same `public/modes.bin` format with zero client-side changes

### Mixed Mode Visualization

Physical plates can exhibit superpositions of multiple eigenfunctions at non-resonant driving frequencies. Implement a mode-mixing feature that blends adjacent eigenvectors for more realistic off-resonance visualization.

---

## References

1. E. F. F. Chladni, *Entdeckungen über die Theorie des Klanges* (1787).
2. G. Kirchhoff, "Über das Gleichgewicht und die Bewegung einer elastischen Scheibe," *Journal für die reine und angewandte Mathematik*, Vol. 40 (1850).
3. J. W. Strutt (Lord Rayleigh), *Theory of Sound* Vol. 1 (Dover, 1945; originally 1877).
4. S. Timoshenko & S. Woinowsky-Krieger, *Theory of Plates and Shells*, 2nd ed. (McGraw-Hill, 1959).
5. S. J. D. D'Alessio, "Forced free vibrations of a square plate," *SN Applied Sciences*, Vol. 3, No. 60 (2021). https://doi.org/10.1007/s42452-020-04062-6
6. M. J. Gander & G. Wanner, "From Euler, Ritz, and Galerkin to Modern Computing," *SIAM Review*, Vol. 54, No. 4 (2012).
7. P. Bourke, *Chladni Plate Mathematics, 2D* (2003). https://paulbourke.net/geometry/chladni/
8. R. Hunter, "Creating Digital Chladni Patterns" (2014). https://thelig.ht/chladni/
9. BYU Mechanical Engineering, "Mathematical Model of a Chladni Plate." https://www.et.byu.edu/~vps/ME505/AAEM/V10-14.pdf
10. UCSB Lecture Demonstrations, *Chladni Plates* (44.45). https://web.physics.ucsb.edu/~lecturedemonstrations/Composer/Pages/44.45.html
11. K. Janus, *Square Plate Chladni Patterns* (UCSB special project). Linked from [10].
12. A. W. Leissa, *Vibration of Plates*, NASA SP-160 (1969).
13. Harvard Natural Sciences Lecture Demonstrations, *Chladni Plates*. https://sciencedemonstrations.fas.harvard.edu/presentations/chladni-plates
14. PASCO Scientific, *Chladni Plates Kit WA-9607*. https://www.pasco.com/products/lab-apparatus/waves-and-sound/ripple-tank-and-standing-waves/chladni-plates-kit
15. NovaSolver, *Chladni Figures Simulator*. https://novasolver.jp/en/tools/chladni-figures.html
16. S. H. Crandall & L. E. Wittig, "Chladni's Patterns for Random Vibration of a Plate," NASA Symposium (1971).
17. De Cheveigné & Kawahara, "YIN, a fundamental frequency estimator for speech and music," *J. Acoust. Soc. Am.*, Vol. 111, No. 4 (2002).
