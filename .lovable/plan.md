

# Plan: Fix Mission Success Timer, Early UFO Rendering, and InitialsFireworks Balance

## Summary

Three issues need to be fixed:
1. **Mission success 6-second timer freezes game** instead of triggering mission success
2. **Early UFOs (level 5+) not rendering** because the rendering condition only checks `ufoLevelConfigRef.current`
3. **InitialsFireworks too sparse** - need to rebalance between "impressive" and "60fps"

---

## Issue 1: Mission Success 6-Second Timer Freeze

### Root Cause

The timeout at line 3777-3779 only sets `setShowFireworks(false)` but doesn't call `onGameOver()` to transition to the mission success screen. When fireworks are hidden without calling onGameOver, the game loop is already stopped (running = false) and nothing triggers the next screen.

The FireworksDisplay `onComplete` callback (lines 6412-6605) contains all the complex logic for saving ghosts, checking records, and calling `onGameOver()`. The 6-second timeout bypasses all of this.

### Solution

Instead of just hiding fireworks, the 6-second timeout should trigger the same skip/complete logic that the FireworksDisplay `onComplete` callback uses. The cleanest approach is to:

1. **Store a ref flag** to indicate the timeout triggered
2. **Use the same logic path** as FireworksDisplay onComplete by setting a "force complete" flag that the fireworks component respects

Alternatively, extract the onComplete logic into a shared function that both timeout and component can call.

### Implementation

**File:** `src/components/game/GameEngine.tsx`

1. **Add a forceFireworksComplete ref** (around line 586):
```typescript
const forceFireworksCompleteRef = useRef(false);
```

2. **Modify the timeout** (line 3777) to set this flag and let the component handle it:
```typescript
missionSuccessTimeoutRef.current = setTimeout(() => {
  console.log('⏱️ 6-second mission success timeout triggered');
  forceFireworksCompleteRef.current = true;
  // Force the fireworks to complete via a re-render trigger
  setForceCompleteCounter(prev => prev + 1);
}, 6000);
```

3. **Add state to trigger force complete**:
```typescript
const [forceCompleteCounter, setForceCompleteCounter] = useState(0);
```

4. **Pass to FireworksDisplay** and have it check this prop to auto-complete:
```typescript
<FireworksDisplay 
  ...
  forceComplete={forceCompleteCounter > 0}
  ...
/>
```

5. **In FireworksDisplay**, add a useEffect that calls onComplete when forceComplete becomes true.

**Simpler alternative**: Just call the onSkip callback from the timeout, since onSkip already does everything needed:

```typescript
missionSuccessTimeoutRef.current = setTimeout(() => {
  console.log('⏱️ 6-second mission success timeout - auto-completing');
  // Trigger skip if fireworks are still showing
  if (showFireworks) {
    // We can't call onSkip directly since it's defined inside the component
    // Instead, set a flag that triggers skip
    setAutoSkipFireworks(true);
  }
}, 6000);
```

And add `autoSkip` state that triggers the onSkip callback when true.

---

## Issue 2: Early UFOs Not Rendering

### Root Cause

The UFO rendering code at lines 5197-5209 only renders UFOs when `ufoLevelConfigRef.current` is truthy:

```typescript
if (ufoLevelConfigRef.current) {
  const state = ufoSpawnStateRef.current;
  const activeUFOs = [state.activeSmall, state.activeMedium, state.activeLarge].filter(u => u?.active) as LanderUFO[];
  
  drawAllUFOs(ctx, activeUFOs, ...);
}
```

But the early UFO spawn system (level 5+, after 25 seconds) adds UFOs to `ufoSpawnStateRef.current` WITHOUT setting `ufoLevelConfigRef.current`, so they never get rendered.

### Solution

Change the rendering condition to check for active UFOs regardless of whether `ufoLevelConfigRef.current` is set:

```typescript
// UFO rendering - render any active UFOs (both scheduled and early spawn)
const state = ufoSpawnStateRef.current;
const activeUFOs = [state.activeSmall, state.activeMedium, state.activeLarge].filter(u => u?.active) as LanderUFO[];

if (activeUFOs.length > 0) {
  drawAllUFOs(
    ctx,
    activeUFOs,
    allProjectilesRef.current,
    neonColor,
    shouldOptimizePerformance ? 4 : 8,
    terrain.worldWidth
  );
}
```

### Implementation

**File:** `src/components/game/GameEngine.tsx`

**Lines 5196-5209** - Replace the condition:

```typescript
// UFO rendering - render any active UFOs (both scheduled level 10+ and early level 5+ spawns)
const ufoState = ufoSpawnStateRef.current;
const activeUFOs = [ufoState.activeSmall, ufoState.activeMedium, ufoState.activeLarge].filter(u => u?.active) as LanderUFO[];

if (activeUFOs.length > 0) {
  drawAllUFOs(
    ctx,
    activeUFOs,
    allProjectilesRef.current,
    neonColor,
    shouldOptimizePerformance ? 4 : 8,
    terrain.worldWidth
  );
}
```

---

## Issue 3: InitialsFireworks Too Sparse

### Root Cause

The previous optimization reduced particle counts too aggressively:
- `particleMultiplier`: high `0.4`, medium `0.25`, low `0.12` (was 0.7, 0.45, 0.25)
- Base counts halved: starburst 24 (was 48), spiral 20 (was 40), etc.
- `lifeDecayMultiplier` increased: 1.5/1.8/2.5 (was 1.2/1.4/2.0)
- Secondary explosions disabled for medium

### Solution

Find a middle ground between the original "impressive but 15fps" and the current "sparse but 60fps":

1. **Increase base particle counts** (but not back to original):
   - starburst: 36 (was 24, originally 48)
   - spiral: 30 (was 20, originally 40)
   - willow: 24 (was 16, originally 32)
   - chrysanthemum layers: 18 (was 12, originally 24)
   - sparkle: 18 (was 12, originally 24)

2. **Increase quality tier multipliers**:
   - high: `0.6` (was 0.4, originally 0.7)
   - medium: `0.35` (was 0.25, originally 0.45)
   - low: `0.18` (was 0.12, originally 0.25)

3. **Slightly reduce life decay** to make particles last longer:
   - high: `1.3` (was 1.5, originally 1.2)
   - medium: `1.5` (was 1.8, originally 1.4)
   - low: `2.0` (was 2.5, originally 2.0)

4. **Re-enable secondary explosions for medium** (but keep them off for low)

5. **Increase shadowBlur slightly**:
   - high: `8` (was 6, originally 10)
   - medium: `5` (was 4, originally 6)
   - low: `3` (was 2, originally 3)

### Implementation

**File:** `src/components/game/InitialsFireworks.tsx`

**Lines 60-88** - Update QUALITY_TIERS:
```typescript
const QUALITY_TIERS: Record<'high' | 'medium' | 'low', FireworksQuality> = {
  high: {
    particleMultiplier: 0.6,
    shadowBlur: 8,
    enableTrails: true,
    enableSecondaryExplosions: true,
    lifeDecayMultiplier: 1.3,
    enableInitialTrails: true,
    initialTrailLength: 7,
  },
  medium: {
    particleMultiplier: 0.35,
    shadowBlur: 5,
    enableTrails: false,
    enableSecondaryExplosions: true, // Re-enabled
    lifeDecayMultiplier: 1.5,
    enableInitialTrails: true,
    initialTrailLength: 5,
  },
  low: {
    particleMultiplier: 0.18,
    shadowBlur: 3,
    enableTrails: false,
    enableSecondaryExplosions: false,
    lifeDecayMultiplier: 2.0,
    enableInitialTrails: false,
    initialTrailLength: 0,
  },
};
```

**Lines 161-163** - Update starburst base count:
```typescript
case 'starburst': {
  const baseCount = 36 + Math.floor(Math.random() * 10);
```

**Lines 192-193** - Update spiral base count:
```typescript
case 'spiral': {
  const baseCount = 30;
```

**Lines 220-221** - Update willow base count:
```typescript
case 'willow': {
  const baseCount = 24;
```

**Lines 251-252** - Update chrysanthemum base count:
```typescript
[0.6, 1.0, 1.4, 1.8].forEach((layer) => {
  const baseCount = 18;
```

**Lines 282-283** - Update sparkle base count:
```typescript
case 'sparkle': {
  const baseCount = 18;
```

**Lines 316-318** - Update secondary explosion count:
```typescript
const count = 4 + Math.floor(Math.random() * 4); // Was 3 + random(3)
```

**Lines 110-145** - Update sparkle re-explosion count:
```typescript
const count = Math.max(6, 10 - generation * 2); // Was max(5, 8 - generation * 2)
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/GameEngine.tsx` | Fix 6-second timeout to trigger proper completion; Fix UFO rendering condition |
| `src/components/game/InitialsFireworks.tsx` | Rebalance particle counts for impressive-but-performant fireworks |

---

## Technical Notes

### Mission Success Timer Fix

The key insight is that when showFireworks becomes false without calling onGameOver, the game is in a broken state:
- `running = false` (game loop stopped)
- No active animation or input handlers
- No way to trigger onGameOver

The fix ensures the timeout triggers the same completion flow as user input.

### UFO Rendering Fix

The early UFO system was correctly adding UFOs to `ufoSpawnStateRef.current` but the rendering code was gated behind `ufoLevelConfigRef.current` which is only set for level 10+ scheduled UFOs.

### InitialsFireworks Balance

The goal is approximately 50% more particles than the current sparse implementation but still ~30-40% less than the original frame-killing implementation. This should achieve "impressive" without grinding framerates.

---

## Testing Checklist

After implementation:
1. Land successfully, wait 6 seconds WITHOUT pressing thrust - should auto-transition to mission success
2. Play level 5+ (Campaign, Fixed, Medley, or Time Trial) for 25+ seconds (not underwater) - UFO should appear and be visible
3. Get a high score and enter initials - fireworks should be impressive but maintain 60fps

