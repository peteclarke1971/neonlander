

# Optimize VectorWormhole Effect for Mission Success Screens

## Overview

Create a new lightweight wormhole component (`VectorWormholeLite`) that delivers a visually striking tunnel effect with dramatically fewer draw calls. The existing `VectorWormhole` component is preserved unchanged as a fallback. Index.tsx switches to using the lite version.

## Current Problem

The existing `VectorWormhole` (616 lines) is heavy:
- Draws 16-36 sided polygons per ring, with bloom passes using `shadowBlur: 10` and `globalCompositeOperation: "lighter"`
- Helical rib strands with per-step centerline + radius calculations
- Up to 64 filament lines with per-segment projection math
- Aperture discs with additional bloom passes
- Adaptive quality scaling that itself adds overhead (FPS tracking, dynamic parameter adjustment every 20 frames)

## New `VectorWormholeLite` Design

A clean, single-purpose tunnel effect (~200 lines) that achieves a better visual with far fewer draw calls:

**Rendering approach:**
- **Concentric rings only** -- no ribs, filaments, or apertures. Simple circles drawn with `ctx.arc()` (one draw call each vs N-sided polygon paths)
- **20-30 rings** visible at once (vs potentially hundreds of ring segments + filament points)
- Rings expand from center as they approach the viewer, creating the "flying through a tunnel" feel
- **No `shadowBlur`** -- use radial gradients for the central glow and simple alpha for ring brightness (shadowBlur is the single biggest GPU cost in canvas)
- **No `globalCompositeOperation: "lighter"`** bloom passes -- achieve glow through slightly thicker bright lines and a single central radial gradient
- **Hue cycling** along ring depth for the neon color shift, reading from `--neon` CSS variable (cached, not per-frame)
- **Subtle camera wobble** via simple sine-based offset (no seeded noise, no centerline function)
- **Ring rotation** -- each ring rotates at a slightly different speed for visual interest

**Performance wins:**
- ~30 `ctx.arc()` calls per frame vs hundreds of polygon vertices + bloom passes
- Zero `shadowBlur` usage
- Zero composite operation switches
- No adaptive quality system needed (it's already fast enough)
- Single `requestAnimationFrame` loop, no FPS tracking overhead

**Visual quality:**
- Central pulsing glow (single radial gradient)
- Depth-based alpha falloff (far rings are dimmer)
- Hue shifts along depth for rainbow tunnel effect
- Subtle vignette overlay
- Ring line width scales with proximity for depth cue

## Props Interface

Same props as existing `VectorWormhole` so it's a drop-in replacement:
- `active`, `loop`, `cx`, `cy`, `speed`, `className`
- Simplified -- no `preset`, `seed`, `focalLength`, `motionReduce`, `style` (always glow-style)
- Keeps the `ref` handle with `Play`, `Stop`, `SetSpeed` for compatibility

## File Changes

| File | Change |
|------|--------|
| `src/components/game/VectorWormholeLite.tsx` | **New file** -- lightweight tunnel effect (~200 lines) |
| `src/pages/Index.tsx` | Import `VectorWormholeLite` instead of `VectorWormhole` for the success screen |
| `src/components/game/VectorWormhole.tsx` | **No changes** -- preserved as backup |

## Technical Details

### VectorWormholeLite rendering loop (pseudocode)

```text
each frame:
  clear canvas
  draw central radial gradient (pulsing glow)
  for each ring (sorted far-to-near):
    update z position (move toward viewer)
    if z < near: respawn at far
    calculate screen radius = baseRadius / z * focalLength
    calculate alpha from depth
    calculate hue from depth + time
    ctx.arc(centerX, centerY, screenRadius, 0, TAU)
    ctx.stroke()
  draw vignette overlay
```

### Index.tsx changes

- Line 19: Add import for `VectorWormholeLite`
- Lines 1051-1061: Replace `<VectorWormhole>` with `<VectorWormholeLite>` keeping same `cx`, `cy`, `loop`, `active` props
- Keep `VectorWormhole` import for potential future use (or remove if unused -- the file itself stays)

