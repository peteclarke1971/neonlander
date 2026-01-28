
# Plan: Firework Masking, Repeatable Tips, and Longer Duration

## Overview
This plan addresses three changes:
1. Add terrain-masked fireworks to Survival mode (respecting settings toggle)
2. Make tips show every time a level loads (not just first time) when tips are enabled
3. Increase tip display duration by 2 seconds

---

## Part 1: Firework Masking in Survival Mode

### Current State
- GameEngine passes terrain masking props to FireworksDisplay (`terrainMaskEnabled`, `terrainPoints`, `cameraX`, `cameraAnchor`, `zoom`)
- SurvivalEngine does NOT pass these props
- Camera state (`cameraX`, `zoom`, `smoothedAnchor`) are local variables inside the main useEffect, not accessible to the FireworksDisplay component

### Changes Required

**File: `src/components/game/SurvivalEngine.tsx`**

1. Add state for terrain masking setting (around line 280):
```typescript
const [terrainMaskedFireworks] = useState<boolean>(() => {
  try {
    const saved = localStorage.getItem('ll-terrain-masked-fireworks');
    return saved ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
});
```

2. Add refs for camera state (around line 280):
```typescript
const cameraStateRef = useRef({ cameraX: 0, anchor: 0, zoom: 1 });
const terrainPointsRef = useRef<{ x: number; y: number }[]>([]);
```

3. Update camera refs in the render loop (where `cameraX`, `smoothedAnchor`, `zoom` are calculated):
```typescript
cameraStateRef.current = { cameraX, anchor: smoothedAnchor, zoom };
```

4. Aggregate terrain points from chunks for fireworks masking (in render loop after chunk updates):
```typescript
// Aggregate terrain points for fireworks masking
const allPoints: { x: number; y: number }[] = [];
for (const chunk of chunks) {
  allPoints.push(...chunk.points);
}
terrainPointsRef.current = allPoints;
```

5. Update FireworksDisplay component (around line 3895):
```typescript
<FireworksDisplay
  landingType={landingType}
  neonColor={...}
  fireworkCount={landings}
  isHighScore={isHighScore}
  onComplete={() => setShowFireworks(false)}
  onSkip={() => setShowFireworks(false)}
  lowGraphics={lowGraphics}
  allowSkip={false}
  terrainMaskEnabled={terrainMaskedFireworks}
  terrainPoints={terrainPointsRef.current}
  terrainWorldWidth={CHUNK_WIDTH * 3}
  cameraX={cameraStateRef.current.cameraX}
  cameraAnchor={cameraStateRef.current.anchor}
  zoom={cameraStateRef.current.zoom}
/>
```

---

## Part 2: Make Tips Show Every Time (Not Just First Time)

### Current Behavior
- `showTip()` checks `hasTipBeenShown()` which reads from localStorage
- If shown before, returns null and tip never appears again

### Solution
Create a new function that shows tips every time when enabled, without checking/marking localStorage.

**File: `src/lib/inFlightGuide.ts`**

1. Add new function `showTipAlways()` that shows tips every time without persistence:
```typescript
/**
 * Show a tip every time if guide is enabled (ignores shown state)
 * Use this for tips that should appear on every level/mode start
 */
export function showTipAlways(tipId: string): TipDefinition | null {
  if (!isGuideEnabled()) return null;
  return TIPS[tipId] || null;
}
```

**File: `src/components/game/GameEngine.tsx`**

2. Update import and call `showTipAlways` instead of `showTip`:
```typescript
import { showTipAlways, TipDefinition } from "@/lib/inFlightGuide";

// In useEffect (around line 424):
tip = showTipAlways('timetrial');
// ...
tip = showTipAlways('basic');
```

**File: `src/components/game/SurvivalEngine.tsx`**

3. Update import and call `showTipAlways`:
```typescript
import { showTipAlways, TipDefinition } from "@/lib/inFlightGuide";

// In useEffect (around line 430):
const tip = showTipAlways('survival');
```

---

## Part 3: Increase Tip Duration by 2 Seconds

### Changes Required

**File: `src/lib/inFlightGuide.ts`**

Update all tip durations:

| Tip ID | Old Duration | New Duration |
|--------|--------------|--------------|
| basic | 5000ms | 7000ms |
| landing | 4000ms | 6000ms |
| junk | 4500ms | 6500ms |
| shield | 4000ms | 6000ms |
| volcano | 4000ms | 6000ms |
| ufo | 4000ms | 6000ms |
| timetrial | 5000ms | 7000ms |
| survival | 5000ms | 7000ms |
| blackout | 4000ms | 6000ms |
| storm | 4000ms | 6000ms |
| comet | 3500ms | 5500ms |

---

## Current Tips and Their Triggers Summary

| Tip ID | Message | New Duration | Trigger Location |
|--------|---------|--------------|------------------|
| `basic` | "THRUST to ascend, ROTATE to aim. Land gently on pads!" | 7000ms | GameEngine: Level 1 |
| `landing` | "Green pads = safe. Land at low speed with level angle." | 6000ms | **Unused** |
| `junk` | "Collect SPACE JUNK for fuel! 3 items opens WORMHOLE." | 6500ms | **Unused** |
| `shield` | "SHIELD protects from one crash. Bounces you to safety." | 6000ms | **Unused** |
| `volcano` | "VOLCANOES erupt! Avoid lava particles." | 6000ms | **Unused** |
| `ufo` | "UFO ALERT! Dodge projectiles or use shield." | 6000ms | **Unused** |
| `timetrial` | "Land on pads IN ORDER! Timer starts at first takeoff." | 7000ms | GameEngine: Time trial mode |
| `survival` | "Travel as far as you can! Land on pads to refuel." | 7000ms | SurvivalEngine: On mount |
| `blackout` | "BLACKOUT! Use your spotlight to navigate." | 6000ms | **Unused** |
| `storm` | "LIGHTNING STORM! Watch for strikes." | 6000ms | **Unused** |
| `comet` | "COMET! Catch it for bonus points." | 5500ms | **Unused** |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/inFlightGuide.ts` | Add `showTipAlways()` function, increase all durations by 2000ms |
| `src/components/game/SurvivalEngine.tsx` | Add terrain masking state/refs, update FireworksDisplay props, switch to `showTipAlways()` |
| `src/components/game/GameEngine.tsx` | Switch to `showTipAlways()` for tip display |

---

## Technical Notes

- The terrain masking in Survival uses aggregated points from all visible chunks (typically 3 chunks)
- World width for masking is set to `CHUNK_WIDTH * 3` (6000 units)
- Camera state refs are updated in the render loop to capture current values for FireworksDisplay
- Tips will now show on every game start/level load when the guide toggle is enabled in Player Menu
