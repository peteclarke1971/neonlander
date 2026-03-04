

# Fix iPhone Thruster Particles in Survival Mode (High-GFX)

## Problem

`SurvivalEngine.tsx` uses a single boolean `shouldOptimize = isMobile || lowGraphics` that treats **all** mobile devices identically. On iPhone with high-GFX selected, players get:
- Only **2 particles per frame** (vs 25 on PC)
- **1 nozzle** (vs 3 on PC)
- Max **30 particles** cap (vs 300 on PC)
- Tiny 1.5px particles with **no glow**
- Short 0.5s lifespan (vs 1.6s on PC)

Meanwhile, `GameEngine.tsx` already handles iPhone properly with a tiered system: 10 particles, proper line rendering with velocity trails, etc.

## Solution

Refactor `SurvivalEngine.tsx` to distinguish between graphics tiers on iPhone, matching the approach in `GameEngine.tsx`. When on iPhone with high-GFX, use a "mid-tier" thruster config that looks spectacular without tanking FPS.

### Changes to `SurvivalEngine.tsx`

**1. Add iPhone detection** (line ~676):
```
const isIPhone = /iPhone/i.test(navigator.userAgent);
const isIPad = isIPadDevice();
```

**2. Replace the single `shouldOptimize` flag** with tier-aware constants:
- `shouldOptimize` remains `true` only for actual low-GFX mode (not just "is mobile")
- New iPhone high-GFX path:
  - `THRUSTER_PARTICLE_COUNT`: 12 (vs 2 currently, vs 25 on desktop)
  - 3 nozzle positions (not 1)
  - `maxThrusterParticles`: 150 (vs 30 currently)
  - Lifespan: 1.2s (vs 0.5s currently)
  - Angle spread: 1.2 (vs 0.6 currently)
  - Speed: 80-180 (decent trail length)

**3. Update the rendering** (line ~3287):
- iPhone high-GFX gets velocity-trail lines (`moveTo`/`lineTo`) like GameEngine, not just tiny `fillRect` dots
- `shadowBlur: 0` kept (no glow needed -- the trails + alpha provide the visual)
- Particle size: 2.5px shrinking over lifetime
- Line width: 1.8 + age-based taper

**4. Also update `Survival.tsx`** to pass `graphicsLevel` string instead of the legacy `lowGraphics` boolean, and update `SurvivalEngine` props to accept `graphicsLevel` (with backward-compatible `lowGraphics` fallback).

### Backup approach
All changes are additive -- the existing `shouldOptimize` path for low-GFX is preserved unchanged. The new code adds an `isIPhoneHighGfx` branch that sits between the low and desktop paths.

### Files changed

| File | Change |
|------|--------|
| `src/components/game/SurvivalEngine.tsx` | Add iPhone detection, tiered thruster config, velocity-trail rendering for iPhone high-GFX |
| `src/pages/Survival.tsx` | Read `graphicsLevel` from localStorage (3-tier), pass to engine |

