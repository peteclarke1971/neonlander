

# Fix: Triple Volcano Eruption Frequency in Classic Mode

## Problem

The cavern volcano eruption intervals were correctly tripled previously, but the **classic mode** volcano config in `src/components/game/systems/volcano.ts` was never updated. The `baseInterval` values remain at their original frequent rates (15, 12, 8, 6, 4 seconds), causing volcanoes to erupt far too often.

## Fix

**File: `src/components/game/systems/volcano.ts`** -- Update `getVolcanoConfigForLevel()` to triple all `baseInterval` values:

| Level Range | Current baseInterval | New baseInterval |
|-------------|---------------------|-----------------|
| Level 1 | 15s | 45s |
| Level 2 | 12s | 36s |
| Level 3 | 8s | 24s |
| Level 4-8 | 6s | 18s |
| Level 9-40 | 4s | 12s |
| Level 40+ | 4s | 12s |

This matches the same tripling approach already applied to cavern volcanoes (which use 24, 18, 12, 9 second intervals). The volcano size and power values remain unchanged so difficulty still scales -- only the frequency is reduced.

No other files need changes.

