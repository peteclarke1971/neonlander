

# Plan: Multi-Feature Update

## Summary

This plan implements 8 features/fixes across multiple files. Each item is addressed with specific implementation details.

---

## 1. Mission Failed: Local High Scores Only (no Global Top 10)

**Issue:** When showing Mission Failed after getting a high score in campaign/fixed mode, both local (top 5) and global (top 10) leaderboards display.

**Solution:** Conditionally hide the `OnlineLeaderboard` component when `lastResult.cause !== "success"`.

**File:** `src/pages/Index.tsx`

**Change:** Lines 1310-1314 - Add condition to only show `OnlineLeaderboard` when `lastResult.cause === "success"`

```typescript
// Only show global leaderboard on Mission Success, not Mission Failed
{lastResult.cause === "success" && (
  <OnlineLeaderboard 
    mode={mode as "classic" | "fixed"} 
    highlightScore={recentlySubmittedScore} 
  />
)}
```

---

## 2. iPhone Portrait Mode Warning Overlay

**Issue:** No warning when iPhone is in portrait mode, which provides poor gameplay experience.

**Solution:** Create a new component that detects iPhone + portrait orientation and shows a dismissable warning overlay.

**Files:**
- Create `src/components/game/PortraitWarning.tsx` (new file)
- Modify `src/components/game/GameEngine.tsx` to include the component

**New Component: PortraitWarning.tsx**

```typescript
import React, { useState, useEffect } from "react";

interface Props {
  onDismiss?: () => void;
}

export const PortraitWarning: React.FC<Props> = ({ onDismiss }) => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // Only check for iPhone
  const isIPhone = /iPhone/i.test(navigator.userAgent);
  
  useEffect(() => {
    if (!isIPhone) return;
    
    const checkOrientation = () => {
      const isNowPortrait = window.innerHeight > window.innerWidth;
      setIsPortrait(isNowPortrait);
      // Auto-reset dismissed state when rotating to landscape and back
      if (!isNowPortrait) setDismissed(false);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [isIPhone]);
  
  if (!isIPhone || !isPortrait || dismissed) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm"
      onClick={() => { setDismissed(true); onDismiss?.(); }}
    >
      <div className="text-center px-8 animate-enter">
        <div className="text-6xl mb-6">📱↔️</div>
        <h2 className="text-2xl font-display font-bold text-accent mb-3">
          Game played best in LANDSCAPE mode
        </h2>
        <p className="text-lg text-muted-foreground mb-4">
          Please rotate your device
        </p>
        <p className="text-sm text-muted-foreground/60">
          Tap anywhere to dismiss
        </p>
      </div>
    </div>
  );
};
```

**GameEngine.tsx Changes:**
- Import the new component
- Render it inside the return statement (will self-hide when in landscape or dismissed)

---

## 3. InitialsFireworks Performance Optimization

**Issue:** Firework particles after entering initials cause slowdown on all devices.

**Solution:** Further reduce particle counts and secondary explosions in `InitialsFireworks.tsx`.

**File:** `src/components/game/InitialsFireworks.tsx`

**Changes:**

1. **Reduce QUALITY_TIERS particle multipliers** (lines 60-88):
   - high: `0.7` → `0.4`
   - medium: `0.45` → `0.25`
   - low: `0.25` → `0.12`

2. **Reduce base particle counts** in explosion functions:
   - starburst: `48 + random(13)` → `24 + random(8)`
   - spiral: `40` → `20`
   - willow: `32` → `16`
   - chrysanthemum: layers `24` each → `12` each
   - sparkle: `24` → `12`
   - secondary: `5 + random(6)` → `3 + random(3)`
   - sparkle re-explosion: `15 - generation*3` → `8 - generation*2`

3. **Reduce shadowBlur in QUALITY_TIERS:**
   - high: `10` → `6`
   - medium: `6` → `4`
   - low: `3` → `2`

4. **Increase lifeDecayMultiplier** to shorten particle lifetimes:
   - high: `1.2` → `1.5`
   - medium: `1.4` → `1.8`
   - low: `2.0` → `2.5`

5. **Disable secondary explosions by default** for medium quality:
   - medium: `enableSecondaryExplosions: true` → `false`

---

## 4. InitialsFireworks Restart Bug Fix

**Issue:** Pressing thrust key during initials fireworks restarts the routine instead of progressing.

**Solution:** Gate thrust input specifically for the InitialsFireworks component using the existing `gateThrustUntilRelease` function.

**File:** `src/components/game/InitialsFireworks.tsx`

**Changes:**

1. **Add keyboard thrust gate** (modify handleKeyPress around line 371-378):
   ```typescript
   const handleKeyPress = (e: KeyboardEvent) => {
     // Only respond to first press, ignore repeats that could restart
     if (e.repeat) return;
     if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
       setSkipped(true);
       gateThrustUntilRelease(); // Prevent button press from carrying over
       onSkip();
     }
   };
   ```

2. The gamepad handler already calls `gateThrustUntilRelease()`, so that's covered.

3. **Add `e.repeat` check** to prevent held keys from repeatedly triggering skip.

---

## 5. Secret Level Skip (CTRL+F7)

**Issue:** Need debug/test shortcut to skip to mission success.

**Solution:** Add global keyboard listener in GameEngine for CTRL+F7 combination.

**File:** `src/components/game/GameEngine.tsx`

**Changes:** Add to the existing keyboard handler (around lines 610-660):

```typescript
// Secret dev skip: CTRL + F7
if (e.ctrlKey && e.key === 'F7') {
  e.preventDefault();
  // Stop all game systems
  running = false;
  audio.current.stopThruster();
  try { audio.current.stopFuelAlarm(); } catch {}
  try { audio.current.stopLevelMusic(); } catch {}
  
  // Trigger mission success with current state
  setShowFireworks(true);
  setLandingType('regular');
  
  // Call onGameOver with success after short delay (mimics normal landing flow)
  setTimeout(() => {
    setShowFireworks(false);
    onGameOver({
      score: hud.score,
      landings: currentLandings + 1,
      cause: "success",
      difficulty,
      elapsed: hud.time,
      levelSeed: hud.levelSeed,
      level,
      initialSpawnX: initialSpawnRef.current.x,
      initialSpawnY: initialSpawnRef.current.y
    });
  }, 500);
  return;
}
```

Note: This needs access to game loop variables, so it may need to be implemented inside the game loop's keyboard event handler or as a ref-based flag.

---

## 6. iPad Touch Controls (Show by Default)

**Issue:** iPad doesn't show touch controls (left/right rotate, abort) when no keyboard is attached.

**Solution:** Modify the condition that shows touch controls to include iPad.

**File:** `src/components/game/GameEngine.tsx`

**Changes:**

1. **Update touch controls visibility condition** (around line 6194):

Current:
```typescript
{!isUsingPCControls && !isDemo && (
```

Updated:
```typescript
{(!isUsingPCControls || isIPad) && !isDemo && (
```

Wait - that's not quite right because `isUsingPCControls` will be true for iPad with keyboard preference saved. We need:

```typescript
// Show touch controls if: (not using PC controls OR is iPad without recent keyboard input) AND not demo
const showTouchControls = (!isUsingPCControls || (isIPad && !recentKeyboardInput)) && !isDemo;
```

Actually simpler solution: **For iPad, default `isUsingPCControls` to false** unless explicitly set via keyboard input:

**Line 264-267 modification:**
```typescript
const [isUsingPCControls, setIsUsingPCControls] = useState(() => {
  // iPad defaults to touch controls (even though isDesktopDevice returns true for iPad)
  if (isIPadDevice()) return false;
  // Check localStorage first, then check if desktop device
  return hasPCControlsPreference() || isDesktopDevice();
});
```

2. **The thrust-anywhere overlay** (lines 6162-6180) currently shows for `isTouch` - need to ensure iPad is included:
   - The `setIsTouch(true)` is set when touch events are detected, so this should work automatically
   - But iPad may not trigger this immediately, so we should also check `isIPad`

3. **Touch opacity setting** is already loaded from localStorage and applied, so that will transfer automatically.

---

## 7. Mission Success 6-Second Timer

**Issue:** Sometimes too long a gap between touchdown and mission success screen.

**Solution:** Start a 6-second timer on successful landing; if fireworks are still running, force completion.

**File:** `src/components/game/GameEngine.tsx`

**Changes:**

1. **Add a ref to track touchdown time** (near other refs around line 285):
```typescript
const touchdownTimeRef = useRef<number>(0);
const missionSuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
```

2. **When successful landing triggers** (multiple locations around lines 3340-3660), add:
```typescript
// Start 6-second timer for mission success
touchdownTimeRef.current = performance.now();
missionSuccessTimeoutRef.current = setTimeout(() => {
  if (showFireworks) {
    setShowFireworks(false);
    // Force trigger the fireworks onComplete logic
  }
}, 6000);
```

3. **In the FireworksDisplay onComplete callback**, clear the timeout:
```typescript
if (missionSuccessTimeoutRef.current) {
  clearTimeout(missionSuccessTimeoutRef.current);
  missionSuccessTimeoutRef.current = null;
}
```

4. **In cleanup**, clear the timeout to prevent memory leaks.

---

## 8. Early UFO Spawn (Level 5+, After 25 Seconds)

**Issue:** Want UFOs to appear on levels 5+ (medley, fixed, classic, time trial) if level lasts more than 25 seconds.

**Solution:** Add an "early UFO" system separate from the existing level 10+ UFO progression.

**Configuration:**
- Starts at level 5 (not underwater levels)
- Triggers after 25 seconds of level time
- Difficulty starts at 1, increases by 1 every 3 levels, max 10
- One UFO per level (small or medium, random)
- No respawn after destruction

**File:** `src/components/game/GameEngine.tsx`

**Changes:**

1. **Add early UFO state refs** (near other UFO refs):
```typescript
const earlyUFOTriggered = useRef(false);
const earlyUFODestroyed = useRef(false);
const earlyUFORef = useRef<LanderUFO | null>(null);
```

2. **Add early UFO config calculation:**
```typescript
// Early UFO config for levels 5+ (not underwater)
const shouldHaveEarlyUFO = level >= 5 && !isWaterLevel(mode, level) && 
  (mode === 'fixed' || mode === 'classic' || mode === 'medley' || mode === 'timetrial');
const earlyUFODifficulty = Math.min(10, 1 + Math.floor((level - 5) / 3));
const earlyUFOType: UFOType = Math.random() > 0.5 ? 'small' : 'medium';
```

3. **In the game loop**, check elapsed time and spawn:
```typescript
// Early UFO spawn check (level 5+, after 25 seconds)
if (shouldHaveEarlyUFO && elapsed >= 25 && !earlyUFOTriggered.current) {
  earlyUFOTriggered.current = true;
  // Spawn small or medium UFO with earlyUFODifficulty
  const ufoType = Math.random() > 0.5 ? 'small' : 'medium';
  // Use existing spawnUFO or spawnSmallUFO/spawnLargeUFO functions
}
```

4. **Reset flags on level start:**
```typescript
earlyUFOTriggered.current = false;
earlyUFODestroyed.current = false;
earlyUFORef.current = null;
```

5. **Track destruction** - when UFO is destroyed, set `earlyUFODestroyed.current = true` to prevent respawn.

---

## Files Summary

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Hide global leaderboard on mission failed |
| `src/components/game/PortraitWarning.tsx` | **NEW** - iPhone portrait warning overlay |
| `src/components/game/GameEngine.tsx` | Import PortraitWarning, CTRL+F7 skip, iPad touch controls, 6-second timer, early UFO system |
| `src/components/game/InitialsFireworks.tsx` | Reduce particle counts, fix restart bug |

---

## Implementation Order

1. **InitialsFireworks performance + restart fix** (self-contained)
2. **Mission Failed local-only leaderboard** (simple one-liner)
3. **PortraitWarning component** (new file + import)
4. **iPad touch controls** (simple condition change)
5. **CTRL+F7 level skip** (keyboard handler addition)
6. **6-second mission success timer** (state + timeout logic)
7. **Early UFO system** (most complex - game loop changes)

---

## Testing Recommendations

After implementation:
1. Test InitialsFireworks on iPhone - verify 60fps and no restart on thrust
2. Test Mission Failed screen - verify only local top 5 shows, not global top 10
3. Test iPhone in portrait mode - verify warning appears and can be dismissed
4. Test iPad without keyboard - verify touch controls appear
5. Test CTRL+F7 - verify level skips to mission success
6. Test successful landing - verify mission success screen appears within 6 seconds
7. Test level 5+ for 25+ seconds - verify UFO spawns (not underwater)

