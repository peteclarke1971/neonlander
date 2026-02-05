

# Plan: Fix World Wrap Rendering for All Entities

## Summary

Objects near the world seam (where x wraps from ~4000 back to 0) appear/disappear abruptly because they are only drawn at their literal x position, not at wrapped offsets. This fix applies the triple-offset rendering pattern to all affected entities.

---

## Problem Analysis

### Current Behavior

When the camera is at x=3950 and an object is at x=50:
1. **Culling**: Correctly calculates wrapped distance as 100px (close to camera)
2. **Rendering**: Draws object at x=50, which is 3900px away on screen (off-screen left)
3. **Result**: Object is culled as "visible" but rendered off-screen, then suddenly appears when camera crosses x=0

### Solution Pattern

The lander already uses the correct pattern - draw at three x-offsets:

```typescript
for (const offset of [-worldWidth, 0, worldWidth]) {
  const drawX = object.x + offset - cameraX;
  if (drawX > -margin && drawX < viewWidth + margin) {
    // Draw object at drawX
  }
}
```

---

## Affected Systems in GameEngine.tsx

| Entity | Current Rendering | Fix Required |
|--------|------------------|--------------|
| Hazards | Single x position (line ~1680) | Triple offset |
| Anomalies | Single x position (line ~1720) | Triple offset |
| Space Junk | Single x position (line ~1760) | Triple offset |
| Jellyfish | Single x position (line ~1850) | Triple offset |
| Coral | Single x position (line ~1890) | Triple offset |
| UFO | Single x position (line ~1650) | Triple offset |
| Collectibles | Single x position (line ~1800) | Triple offset |
| Moving Pads | Single x position (line ~1580) | Triple offset |

---

## Implementation Details

### Option 1: Modify Individual Draw Calls (Precise Control)

Wrap each entity's draw loop with the offset pattern:

```typescript
// Before
drawHazards(ctx, hazards, neonColor, shadowBlur);

// After
for (const wrapOffset of [-worldWidth, 0, worldWidth]) {
  ctx.save();
  ctx.translate(wrapOffset, 0);
  drawHazards(ctx, hazards, neonColor, shadowBlur);
  ctx.restore();
}
```

**Pros**: Simple, works with existing draw functions
**Cons**: Draws everything 3x even when not needed

### Option 2: Filter and Draw Visible Only (Performance Optimized)

For each entity, check which offset makes it visible before drawing:

```typescript
for (const h of hazards) {
  for (const offset of [-worldWidth, 0, worldWidth]) {
    const screenX = h.x + offset - cameraX;
    if (screenX > -50 && screenX < viewWidth + 50) {
      // Draw this hazard at this offset
      drawSingleHazard(ctx, h, offset - cameraX, neonColor);
      break; // Only draw once
    }
  }
}
```

**Pros**: Only draws visible entities
**Cons**: Requires refactoring draw functions to accept offset

### Recommended: Option 1 with Early Exit

Use Option 1's simplicity but add visibility checks inside draw functions:

```typescript
// In drawHazards - add visibility culling per hazard
export function drawHazards(
  ctx: CanvasRenderingContext2D, 
  hazards: Hazard[], 
  neonColor: string, 
  shadowBlur: number,
  cameraX: number,      // NEW
  viewWidth: number,    // NEW
  worldWidth: number    // NEW
) {
  const margin = 100;
  for (const h of hazards) {
    // Check all three offsets for visibility
    for (const offset of [-worldWidth, 0, worldWidth]) {
      const screenX = h.x + offset - cameraX;
      if (screenX > -margin && screenX < viewWidth + margin) {
        // Draw at this offset
        ctx.save();
        ctx.translate(h.x + offset - cameraX, h.y);
        // ... draw hazard shape
        ctx.restore();
        break;
      }
    }
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/game/systems/hazards.ts` | Update `drawHazards` to accept camera/world params and use triple offset |
| `src/components/game/systems/anomalies.ts` | Update draw function for world wrap |
| `src/components/game/systems/spaceJunkAssets.ts` | Update `renderSpaceJunk` for world wrap |
| `src/components/game/systems/collectibles.ts` | Update `drawCollectibles` for world wrap |
| `src/components/game/systems/movingPads.ts` | Update pad rendering for world wrap |
| `src/components/game/systems/ufo.ts` | Update UFO rendering for world wrap |
| `src/components/game/GameEngine.tsx` | Pass new params to draw functions, update jellyfish/coral rendering inline |

---

## Detailed Changes

### 1. hazards.ts - drawHazards

Add world wrap parameters and triple-offset loop:

```typescript
export function drawHazards(
  ctx: CanvasRenderingContext2D, 
  hazards: Hazard[], 
  neonColor: string, 
  shadowBlur = 0,
  cameraX = 0,
  viewWidth = 800,
  worldWidth = 4000
) {
  if (hazards.length === 0) return;
  
  const margin = 100;
  ctx.save();
  ctx.strokeStyle = neonColor;
  ctx.globalAlpha = 0.9;
  if (shadowBlur > 0) {
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = shadowBlur;
  }
  
  for (const h of hazards) {
    // Try each wrap offset
    for (const offset of [-worldWidth, 0, worldWidth]) {
      const screenX = h.x + offset - cameraX;
      if (screenX > -margin && screenX < viewWidth + margin) {
        ctx.save();
        ctx.translate(screenX, h.y);
        ctx.rotate(h.angle);
        // ... existing shape drawing code
        ctx.restore();
        break; // Only draw once per hazard
      }
    }
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
}
```

### 2. GameEngine.tsx - Call Site Updates

Update all draw calls to pass the new parameters:

```typescript
// Before
drawHazards(ctx, hazards, neonColor, shadowBlur);

// After
drawHazards(ctx, hazards, neonColor, shadowBlur, cameraX, pxW, worldWidth);
```

### 3. Inline Rendering (Jellyfish, Coral)

For entities rendered directly in GameEngine, wrap in offset loop:

```typescript
// Jellyfish rendering
for (const jf of jellyfish) {
  for (const offset of [-worldWidth, 0, worldWidth]) {
    const screenX = jf.x + offset - cameraX;
    if (screenX > -100 && screenX < pxW + 100) {
      // Draw jellyfish at screenX
      break;
    }
  }
}
```

---

## Testing Scenarios

After implementation, verify these scenarios work correctly:

1. **Camera at x=3900, object at x=100**: Object should be visible (wrapped distance ~200)
2. **Camera at x=100, object at x=3900**: Object should be visible (wrapped distance ~200)
3. **Camera crosses x=0**: Objects should not pop in/out
4. **Camera crosses x=worldWidth**: Objects should not pop in/out
5. **Objects moving across seam**: Smooth continuous motion

---

## Implementation Order

1. Update `hazards.ts` - `drawHazards` function
2. Update `anomalies.ts` - draw functions  
3. Update `spaceJunkAssets.ts` - `renderSpaceJunk` function
4. Update `collectibles.ts` - `drawCollectibles` function
5. Update `movingPads.ts` - pad rendering
6. Update `ufo.ts` - UFO rendering
7. Update `GameEngine.tsx` - all call sites + inline jellyfish/coral rendering

