
# Plan: Fix Hyperspace 3D Performance & Verify World-Wrap Rendering

## Summary

Two issues need addressing:
1. **Hyperspace 3D massive FPS drop** - Recent customization changes added expensive operations that kill performance on PC
2. **Lander feels sluggish** - This is a side effect of the Hyperspace FPS drop affecting the entire app's frame rate

The world-wrap visibility fixes are correct and should NOT be reverted - they properly use centered bounds (`[-halfView, halfView]`) and draw at world coordinates.

---

## Part 1: Hyperspace 3D Performance Fix

### Root Cause Analysis

The recent changes added several expensive operations:

| Change | Impact |
|--------|--------|
| 500ms `setInterval` for config refresh | Minor CPU overhead, creates garbage collection pressure |
| Motion blur loop (lines 340-353) | **MAJOR** - draws 2-5 extra `arc()` + `fill()` per star = up to 6000 extra draw calls per frame |
| `shadowBlur * particleSize` (line 302) | Larger shadow blur = exponentially slower GPU compositing |
| Config read inside render loop | Memory allocation per frame |

With 1200 stars and motion blur enabled:
- Default: 1200 strokes per frame
- With motion blur: 1200 + (1200 × 5) = **7200 draw calls per frame**

### Solution: Simplify and Optimize

1. **Remove the 500ms setInterval** - Use only the `storage` event listener (which only fires on actual changes)
2. **Disable motion blur by default** - Set `motionBlur` default to 0 instead of 0.5
3. **Cap shadowBlur multiplier** - Limit `shadowBlur * particleSize` to reasonable maximum
4. **Optimize motion blur when enabled** - Reduce steps and skip when particle isn't moving much
5. **Cache config read** - Only read config once per frame, not per-star

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/starfieldConfig.ts` | Change `motionBlur` default from 0.5 to 0 |
| `src/components/game/HyperspaceStarfield.tsx` | Remove setInterval, optimize motion blur, cap shadowBlur |

### Specific Code Changes

**starfieldConfig.ts** - Change default:
```typescript
motionBlur: 0,  // Was 0.5 - too expensive as default
```

**HyperspaceStarfield.tsx** - Remove expensive interval:
```typescript
// REMOVE this block (lines 181-184):
const configRefreshInterval = setInterval(() => {
  configRef.current = loadStarfieldConfig();
}, 500);

// Keep ONLY the storage event listener for cross-tab changes
// AND refresh config once at start of each frame (not per-star)
```

**HyperspaceStarfield.tsx** - Cap shadow blur:
```typescript
// Line 302 - cap the multiplier
ctx.shadowBlur = Math.min(24, 12 * config.glow * Math.min(2, config.particleSize));
```

**HyperspaceStarfield.tsx** - Optimize motion blur:
```typescript
// Only draw motion blur if particle moved significantly AND config enabled
if (config.motionBlur > 0.1 && len > 8) {  // Was len > 2
  const blurSteps = 2;  // Fixed at 2, was 2-5 based on config
  // ... rest of blur code
}
```

---

## Part 2: Verify World-Wrap Rendering Is Correct

The visibility checks I implemented are mathematically correct:

```typescript
// Canvas transform applies: ctx.translate(-cameraX, anchor)
// So world coordinate X renders at screen position (X - cameraX)
// Screen visible range is [-viewWidth/2, viewWidth/2] relative to center

const screenX = entity.x + wrapOffset - cameraX;
const halfView = viewWidth / 2;
if (screenX > -halfView - margin && screenX < halfView + margin) {
  // Entity is visible - draw at world coords (canvas transform handles the rest)
  ctx.translate(entity.x + wrapOffset, entity.y);
}
```

This is correct because:
1. `screenX` calculates where the entity will appear on screen
2. The check uses centered bounds `[-halfView, halfView]` which matches the canvas transform
3. Drawing uses world coordinates which the canvas transform converts to screen space

### No Changes Needed to World-Wrap Code

The coral, jellyfish, space junk, wormhole, hazards, and anomalies all use the correct pattern. The sluggishness is caused by the Hyperspace FPS drop, not the visibility checks.

---

## Part 3: Additional Optimization for Other Starfields

Apply similar motion blur optimization to other starfield components that have the same issue:

| File | Change |
|------|--------|
| `PrismaticWavesStarfield.tsx` | Only draw motion blur if `len > 8` and reduce steps |
| `NeonVortexStarfield.tsx` | Same optimization |
| `CosmicTunnelStarfield.tsx` | Same optimization |
| `NebulaDriftStarfield.tsx` | Same optimization |
| `IntoTheVoidStarfield.tsx` | Same optimization |

---

## Implementation Order

1. Update `starfieldConfig.ts` - change motionBlur default to 0
2. Fix `HyperspaceStarfield.tsx` - remove setInterval, optimize motion blur, cap shadowBlur
3. Apply same optimizations to other starfield components

---

## Expected Results

- Hyperspace 3D should run at smooth 60fps on PC
- Lander controls will feel responsive again (since frame rate is restored)
- World-wrap rendering continues to work correctly
- Motion blur is still available for users who want it, just not enabled by default

---

## Technical Notes

### Why the setInterval Was Bad

The `setInterval` was firing every 500ms regardless of whether settings changed. This:
1. Allocates memory for the config object
2. Parses localStorage strings
3. Creates garbage collection pressure
4. Runs even when the game is idle

The `storage` event listener is much better - it only fires when localStorage actually changes.

### Why Motion Blur Was So Expensive

Each `ctx.arc()` + `ctx.fill()` is a separate GPU draw call. With 1200 stars × 5 blur steps = 6000 extra calls. GPU-accelerated 2D canvas can handle many strokes, but `arc()` is particularly expensive because it:
1. Calculates bezier approximation
2. Creates a new path
3. Fills with alpha blending

A simple `stroke()` line is much cheaper than an `arc()` + `fill()`.
