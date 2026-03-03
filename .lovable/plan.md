

# Create Lightweight GravityWaveLite to Replace Heavy GravityDistortionWave

## Overview

The `GravityDistortionWave` component (928 lines) is the other mission-success effect that alternates with `VectorWormholeLite`. It's extremely heavy due to:
- Tile-based screen warp (`drawImage` in a nested loop -- hundreds of `drawImage` calls per frame)
- Dual canvas system (background + composited output)
- Grid of rings + spokes with `shadowBlur` and `globalCompositeOperation: "lighter"`
- Spoke twinkle system, energy burst particles, center vortex gradients
- FPS governor that dynamically adjusts parameters (overhead in itself)
- Seeded PRNG system with complex parameter randomization

## New `GravityWaveLite` Design

A clean ~220-line component that captures the visual essence -- concentric rippling rings radiating outward from center with color cycling -- but rendered with minimal draw calls:

**Visual approach:**
- Concentric rings drawn with `ctx.arc()` that pulse in radius (sinusoidal displacement), creating a "gravity ripple" look
- Rings flow outward from center (tunnel/expansion feel)
- Radial spoke lines from center to edges (simple `moveTo/lineTo`, no quadratic curves)
- Color cycling through hue spectrum (rainbow effect matching the original)
- Central pulsing glow via a single radial gradient
- Vignette overlay

**What's removed vs the original:**
- No tile-based screen warp (the single biggest cost -- hundreds of `drawImage` calls)
- No dual canvas system
- No `shadowBlur` anywhere
- No `globalCompositeOperation: "lighter"` 
- No FPS governor (not needed -- it's already fast)
- No energy burst particle system
- No spoke twinkle system
- No chromatic aberration
- No seeded PRNG (visual randomization via simple `Math.random()` at init)

**Performance budget:** ~40-50 draw calls per frame (24 rings + 16 spokes + 2 gradients)

## Props Interface

Simplified to match what Index.tsx actually passes:

```text
active: boolean
preset: "Calm" | "Normal" | "Storm"  (controls speed/intensity)
cx, cy: number (0-1, center point)
className: string
```

Ref handle keeps `Play`, `Stop`, `SetSeed`, `PulseNow` for compatibility (SetSeed and PulseNow are no-ops).

## File Changes

| File | Change |
|------|--------|
| `src/components/game/GravityWaveLite.tsx` | **New file** -- lightweight ripple/grid effect (~220 lines) |
| `src/pages/Index.tsx` | Import `GravityWaveLite` instead of `GravityDistortionWave` for the success screen |
| `src/components/game/GravityDistortionWave.tsx` | **No changes** -- preserved as backup |

## Technical Details

### Rendering loop (pseudocode)

```text
each frame:
  clear canvas with dark background
  
  draw central radial gradient (pulsing glow)
  
  for each spoke (16 total):
    calculate angle
    draw line from center to edge
    stroke with hue-shifted color, alpha based on pulse
  
  for each ring (24 total):
    update z (move outward toward viewer)
    if z > far: respawn at near
    calculate screen radius from z
    add sinusoidal ripple displacement
    calculate hue from depth + elapsed time
    ctx.arc(centerX, centerY, radius, 0, TAU)
    ctx.stroke()
  
  draw vignette overlay
```

### Index.tsx changes

- Add import for `GravityWaveLite` and `GravityWaveLiteHandle`
- Replace `<GravityDistortionWave>` JSX block with `<GravityWaveLite>` keeping `active`, `preset`, `cx`, `cy` props
- Update the `gwRef` type to `GravityWaveLiteHandle`
- Remove the complex `gwRef.current?.Play()` / `SetSeed()` calls from the success activation logic (lite version auto-starts on `active`)

