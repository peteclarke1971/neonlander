

# Fix Plan: Mega Pad on Chunk 2, Blackout at 4000m, Aggressive Volcanoes, Visible Gravity Wells

## 1. Force Mega Pad on Chunk 2

**File:** `src/components/game/systems/endlessTerrain.ts` (line 105)

Re-add chunk 2 as a forced mega pad spawn, but properly this time (without marking it as test code):

Change the `shouldGenerateMegaPad` condition to also trigger when `this.chunkCounter === 2`:
```
const shouldGenerateMegaPad = !isAsteroidFieldChunk && (
  this.chunkCounter === 2 || 
  (this.chunkCounter > 2 && difficulty > 0.15 && chunksSinceLastMega >= this.nextMegaPadInterval)
);
```

This places the first mega pad at chunk 2 (~4000m into the level), then subsequent ones follow the existing organic difficulty/interval system.

## 2. Move First Blackout to 4000m

**File:** `src/components/game/SurvivalEngine.tsx` (lines 1147-1150)

Change the first blackout distance threshold from `1500` to `4000`, and the random range from `1500 + 200` to `4000 + 200`:
- Line 1148: `currentDistance >= 4000`
- Line 1150: `4000 + Math.random() * 200`

Subsequent blackouts remain at 60-120 seconds (random) -- no change needed there, that's already the current behavior.

## 3. Double Volcano Aggressiveness

**File:** `src/components/game/systems/endlessTerrain.ts` (lines 436-459)

Currently volcanoes only spawn when `difficulty > 0.1 && rand() > 0.5` (50% chance). To make them twice as aggressive:
- Lower the difficulty threshold from `0.1` to `0.05` (appear sooner)
- Remove the 50% random gate (`rand() > 0.5`) so they always spawn when difficulty threshold is met
- Double the volcano power: change `config.power` to `config.power * 2`
- Double the particle count in the eruption duration config

## 4. Fix Gravity Wells Not Rendering

**File:** `src/components/game/SurvivalEngine.tsx` (line 3151)

The `drawAnomaliesField` call is missing `cameraX` and `viewWidth` parameters. The function defaults to `cameraX=0` and `viewWidth=800`, which means the viewport culling check always rejects anomalies at large world X positions (thousands of pixels from origin). The canvas has already been translated by `-cameraX`, so drawing is in world coordinates, but the visibility culling still needs the real camera position.

Fix: pass `cameraX` and `viewWidth` (and optionally a large worldWidth since survival doesn't wrap):
```typescript
drawAnomaliesField(ctx, allAnomalies, currentTime, neonColor, cameraX, viewWidth, Infinity);
```

Using `Infinity` for worldWidth prevents wrap-offset logic from interfering (survival terrain doesn't wrap).

---

## Summary of File Changes

| File | Change |
|---|---|
| `endlessTerrain.ts` | Force mega pad on chunk 2; lower volcano threshold & double power |
| `SurvivalEngine.tsx` | Blackout from 4000m; pass cameraX/viewWidth to drawAnomaliesField |

