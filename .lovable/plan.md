
# Fix: Mega Pad Placement Broken in Survival Mode

## Root Cause

Two bugs are causing the mega pad to appear incorrectly in survival mode:

### Bug 1: Test Code Left In
In `src/components/game/systems/endlessTerrain.ts` (line 104), there's a line:
```
const isForcedTestChunk = this.chunkCounter === 2;
```
This forces a MEGA pad on the **third chunk** of every survival game -- far too early, before any real difficulty has ramped up. This was clearly added for testing and never removed.

### Bug 2: Coordinate System Mismatch (the "inside terrain" issue)
In `src/components/game/systems/movingPads.ts`, when a forced shuttle pad is generated, the positions are calculated in **absolute world coordinates** (e.g., `chunkStartX + bestX` = ~4000+ for chunk 2). However, the edge-margin validation at lines 246-253 compares these absolute positions against `worldWidth`, which is actually just the **chunk width** (~2000).

Since the absolute X coordinates are always larger than the chunk width, the validation always triggers for forced pads, and clamps the positions back down to `worldWidth - 100` (~1900 absolute). This teleports the pad to near the **start of the level**, completely detached from the terrain that was flattened for it in chunk 2. That's why it appears buried inside terrain early in the level.

## Fix

### File: `src/components/game/systems/endlessTerrain.ts`
- **Remove** the `isForcedTestChunk` variable (line 104)
- **Remove** its usage in the `shouldGenerateMegaPad` condition (line 106)
- **Remove** the special level override for forced test chunks (line 374)

This means MEGA pads will only appear organically based on difficulty and interval timing (every 3-9 chunks once difficulty exceeds 0.15), which is the intended behavior.

### File: `src/components/game/systems/movingPads.ts`
- **Fix the edge-margin check** for forced pads: when `chunkStartX > 0`, offset the bounds check to use `chunkStartX` and `chunkStartX + worldWidth` instead of `0` and `worldWidth`. This ensures the validation works correctly with absolute world coordinates.

No other files need changes. Classic mode, Fixed mode, and other modes are unaffected since they don't use `EndlessTerrainGenerator`.
