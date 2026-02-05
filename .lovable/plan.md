

# Plan: Fix World Wrap Visibility Bounds Bug

## Problem

The previous fix introduced a bug where the visibility check uses **asymmetric bounds**. The check compares `screenX` (which is centered at 0) against bounds from `-margin` to `viewWidth + margin`, when it should be from `-viewWidth/2 - margin` to `viewWidth/2 + margin`.

### Example of the Bug

With `viewWidth = 800px` and camera at center:
- **Current check**: Objects visible from `x = -50` to `x = 850` (relative to camera)
- **Correct check**: Objects visible from `x = -450` to `x = 450` (relative to camera)

This causes objects on the **right side** of the screen to render when they shouldn't, and objects that ARE visible to sometimes not render.

---

## Files to Fix

| File | Issue |
|------|-------|
| `src/components/game/systems/hazards.ts` | Line 82 uses wrong bounds |
| `src/components/game/systems/anomalies.ts` | Line 184 uses wrong bounds |
| `src/components/game/GameEngine.tsx` | Space junk, wormhole, coral, jellyfish visibility checks use wrong bounds |

---

## Correct Pattern

```typescript
// BEFORE (wrong - asymmetric bounds)
const screenX = entity.x + offset - cameraX;
if (screenX < -margin || screenX > viewWidth + margin) continue;

// AFTER (correct - centered bounds)
const screenX = entity.x + offset - cameraX;
const halfView = viewWidth / 2;
if (screenX < -halfView - margin || screenX > halfView + margin) continue;
```

---

## Specific Fixes

### 1. hazards.ts - drawHazards (line 82)

```typescript
// BEFORE
if (screenX > -margin && screenX < viewWidth + margin) {

// AFTER
const halfView = viewWidth / 2;
if (screenX > -halfView - margin && screenX < halfView + margin) {
```

### 2. anomalies.ts - drawAnomaliesField (line 184)

```typescript
// BEFORE
if (screenX > -margin - a.radius && screenX < viewWidth + margin + a.radius) {

// AFTER  
const halfView = viewWidth / 2;
if (screenX > -halfView - margin - a.radius && screenX < halfView + margin + a.radius) {
```

### 3. GameEngine.tsx - Space Junk (line 5310)

```typescript
// BEFORE
if (screenX < -50 || screenX > viewWCull + 50) continue;

// AFTER
const halfView = viewWCull / 2;
if (screenX < -halfView - 50 || screenX > halfView + 50) continue;
```

### 4. GameEngine.tsx - Wormhole Door (line 5331)

```typescript
// BEFORE
if (screenX < -wormhole.radius || screenX > viewWCull + wormhole.radius) continue;

// AFTER
const halfView = viewWCull / 2;
if (screenX < -halfView - wormhole.radius || screenX > halfView + wormhole.radius) continue;
```

### 5. GameEngine.tsx - Coral (line 4883)

```typescript
// BEFORE
if (screenX < -100 || screenX > viewWCull + 100) continue;

// AFTER
const halfView = viewWCull / 2;
if (screenX < -halfView - 100 || screenX > halfView + 100) continue;
```

### 6. GameEngine.tsx - Jellyfish (line 5016)

```typescript
// BEFORE
if (screenX < -100 || screenX > viewWCull + 100) continue;

// AFTER
const halfView = viewWCull / 2;
if (screenX < -halfView - 100 || screenX > halfView + 100) continue;
```

---

## Implementation

I will update all six locations with the corrected centered visibility bounds. This will fix the appearing/disappearing issue for all entities.

