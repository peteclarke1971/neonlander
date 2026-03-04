

# Fix Misaligned Thruster Particles in Survival Mode

## Root Cause

Comparing `SurvivalEngine.tsx` particle code with the working `GameEngine.tsx`:

| Parameter | GameEngine (works) | SurvivalEngine (broken) |
|-----------|-------------------|------------------------|
| Nozzle offset | 10 | 14 (too far below ship) |
| Trail length factor | 0.03 | 0.15 (5x too long) |
| Line width | `1.8 + (1-age)*1.0` (2.8→1.8) | `1.8 * (1-t)` (1.8→0, inverts) |
| Head dot | none | fillRect (adds visual noise) |

The nozzle at 14 places particles well below the visible ship body, and the trail factor of 0.15 (vs GameEngine's 0.03) creates 5x longer trails that visually stretch back into and through the ship -- producing the "mirrored" effect. The line width formula tapering to 0 also makes trails look spiky and scattered.

## Fix

In `SurvivalEngine.tsx`, align the particle system with `GameEngine.tsx`:

1. **Nozzle offset**: Change from 14 back to 10 (all 5 nozzle calculations, lines 1601-1609)
2. **Trail factor**: Change from 0.15 to 0.03 (line 3308)
3. **Line width**: Change from `1.8 * (1 - t)` to `1.8 + (1 - t) * 1.0` to match GameEngine (line 3309)
4. **Remove head dot**: Remove the fillRect head dot rendering (lines 3316-3319) -- GameEngine doesn't use one for the line-rendered path

| File | Change |
|------|--------|
| `src/components/game/SurvivalEngine.tsx` | Fix nozzle offset (10), trail length (0.03), line width formula, remove head dot |

