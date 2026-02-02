

# Plan: Fix UFO Behavior, InitialsFireworks Physics, Portrait Warning, and Fullscreen Reminder

## Summary

Four issues need to be addressed:
1. **Early UFOs don't move** - They spawn but are never updated
2. **InitialsFireworks have wrong physics** - They move too fast and don't have the same feel as main fireworks
3. **iPhone portrait warning not appearing** - Component may not be detecting iPhone correctly
4. **PC fullscreen reminder** - Need to add an occasional message on PlayerMenu

---

## Issue 1: Early UFOs Don't Move

### Root Cause

The early UFO spawn code (lines 2756-2826) only **spawns** UFOs, but never **updates** them. The update logic at lines 2650-2754 is gated by:

```typescript
if (ufoLevelConfigRef.current) {
  // All the UFO update code is inside here
}
```

Early UFOs don't set `ufoLevelConfigRef.current`, so they spawn and sit motionless. The rendering was fixed to show them, but they never call `updateSmallUFO()` or `updateUFO()`.

### Solution

Add update calls for early UFOs **outside** the `ufoLevelConfigRef.current` block. When early UFOs are active but regular scheduled UFOs aren't, we still need to update them:

**File:** `src/components/game/GameEngine.tsx`

After line 2826 (after early UFO destruction tracking), add:

```typescript
// Update early UFOs when regular UFO system is NOT active
if (shouldHaveEarlyUFO && earlyUFOTriggered.current && !ufoLevelConfigRef.current) {
  const state = ufoSpawnStateRef.current;
  const configs: Record<UFOType, UFOTypeConfig> = {
    small: { ...UFO_CONFIGS.small, enabled: true, difficulty: Math.min(10, 1 + Math.floor((levelVar - 5) / 3)) },
    medium: { ...UFO_CONFIGS.medium, enabled: true, difficulty: Math.min(10, 1 + Math.floor((levelVar - 5) / 3)) },
    large: { ...UFO_CONFIGS.large, enabled: false, difficulty: 1 }
  };
  
  // Update small UFO
  if (state.activeSmall?.active) {
    updateSmallUFO(
      state.activeSmall,
      dt,
      elapsed,
      x, y,
      terrain.worldWidth,
      configs.small,
      terrain.points
    );
  }
  
  // Update medium UFO  
  if (state.activeMedium?.active) {
    const projectile = updateUFO(
      state.activeMedium,
      dt,
      elapsed,
      x, y,
      terrain.worldWidth,
      DEFAULT_UFO_CONFIG
    );
    if (projectile) {
      allProjectilesRef.current.push(projectile);
    }
  }
  
  // Update projectiles
  updateProjectiles(allProjectilesRef.current, dt);
}
```

---

## Issue 2: InitialsFireworks Physics Are Wrong

### Root Cause

Comparing the physics constants in both files:

**FireworksDisplay.tsx (main fireworks):**
- Gravity: `0.03` per frame (applied via `newVy += 0.03 * normalizedDelta`)
- Air resistance: `0.9995` for vx, `0.9998` for vy
- Initial speeds: `3-8` range depending on pattern

**InitialsFireworks.tsx (initials fireworks):**
- Gravity: `0.08` constant
- Air resistance: `0.99` for both
- Initial speeds: `4-8` range (similar)

The InitialsFireworks have **2.6x higher gravity** and **much stronger air resistance** (0.99 vs 0.9995-0.9998). This makes particles fall faster and slow down much quicker.

Also, the speeds in createExplosion are applied directly (`4 + Math.random() * 4`) without the lower multiplied velocities used in the main fireworks.

### Solution

Match the physics constants from FireworksDisplay:

**File:** `src/components/game/InitialsFireworks.tsx`

1. **Change GRAVITY constant** (line 90):
```typescript
const GRAVITY = 0.03; // Was 0.08 - match main fireworks
```

2. **Change AIR_RESISTANCE constant** (line 91):
```typescript
const AIR_RESISTANCE = 0.998; // Was 0.99 - match main fireworks
```

3. **Reduce initial speeds in createExplosion** to be more gradual:
   - starburst: `2.5 + Math.random() * 3` (was `4 + Math.random() * 4`)
   - spiral: `2 + Math.random() * 2.5` (was `3.5 + Math.random() * 3.5`)
   - willow: `3 + Math.random() * 3` (was `5 + Math.random() * 4`)
   - chrysanthemum: speed divisor 1.5 (was direct `3 * layer`)
   - sparkle: `1.5 + Math.random() * 1.5` (was `3 + Math.random() * 2`)

4. **Increase particle lifetimes** for longer, more graceful trajectories:
   - life: `1.5` (was `1`) for base particles

---

## Issue 3: iPhone Portrait Warning Not Showing

### Root Cause

The PortraitWarning component uses this detection:
```typescript
const isIPhone = /iPhone/i.test(navigator.userAgent);
```

This should work for iPhones, but potential issues:
1. The component is rendered inside GameEngine but only during gameplay, not on the main menu
2. The z-index `z-[100]` might be overridden
3. The component relies on `window.innerHeight > window.innerWidth` which should work

### Solution

1. **Also render PortraitWarning in Index.tsx and PlayerMenu.tsx** so it shows even before gameplay starts

2. **Add debug logging** to understand if detection is working

3. **Ensure z-index is high enough** - use `z-[9999]` to be above everything

**File:** `src/components/game/PortraitWarning.tsx`

Update the z-index and add debugging:

```typescript
useEffect(() => {
  if (!isIPhone) {
    console.log('PortraitWarning: Not iPhone, skipping', navigator.userAgent);
    return;
  }
  
  console.log('PortraitWarning: iPhone detected, checking orientation');
  // ... rest of code
}, [isIPhone]);
```

Also update z-index:
```tsx
<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-sm"
```

**File:** `src/pages/Index.tsx`

Import and render PortraitWarning at the top level:
```typescript
import { PortraitWarning } from '@/components/game/PortraitWarning';

// In return statement, early in the JSX:
<PortraitWarning />
```

---

## Issue 4: PC Fullscreen Reminder on PlayerMenu

### Design

After ~5 seconds of idle time on PlayerMenu (PC only, not fullscreen), show a message for 3 seconds:
- Text: "PILOTS: This simulation is best played FULL SCREEN"
- Fade in/out animation
- Match neon aesthetic
- Don't show on mobile/tablet or when already fullscreen
- Show occasionally (every ~15-20 seconds of non-fullscreen idle time)

### Solution

**File:** `src/components/game/PlayerMenu.tsx`

1. **Add state for fullscreen reminder** (around line 160):
```typescript
const [showFullscreenReminder, setShowFullscreenReminder] = useState(false);
const fullscreenReminderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const lastReminderTimeRef = useRef(0);
```

2. **Add effect to show reminder** (after idle timer logic):
```typescript
// Fullscreen reminder for PC users (not on mobile/iOS)
useEffect(() => {
  // Only on desktop, not fullscreen, and after assets loaded
  if (!assetsLoaded || isIOSDevice() || isFullscreen || showModeMenu || showLevelMenu || showGuidePopup) {
    return;
  }
  
  // Show reminder after 5 seconds idle, then repeat every 20 seconds
  const reminderInterval = setInterval(() => {
    if (!isFullscreen && idleTime >= 5) {
      const timeSinceLast = Date.now() - lastReminderTimeRef.current;
      if (timeSinceLast >= 20000 || lastReminderTimeRef.current === 0) {
        setShowFullscreenReminder(true);
        lastReminderTimeRef.current = Date.now();
        
        // Hide after 3 seconds
        setTimeout(() => {
          setShowFullscreenReminder(false);
        }, 3000);
      }
    }
  }, 5000);
  
  return () => clearInterval(reminderInterval);
}, [assetsLoaded, isFullscreen, idleTime, showModeMenu, showLevelMenu, showGuidePopup]);
```

3. **Add the reminder UI** (in the return statement, perhaps after the logo):
```tsx
{/* Fullscreen reminder for PC */}
{showFullscreenReminder && isSupported && !isIOSDevice() && (
  <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
    <div className="bg-card/80 backdrop-blur-sm border border-accent/50 rounded-lg px-6 py-3 
                    text-accent text-lg font-mono tracking-wide text-center
                    shadow-lg shadow-accent/20">
      PILOTS: This simulation is best played FULL SCREEN
    </div>
  </div>
)}
```

4. **Add CSS animation** for fade in/out (or use existing Tailwind classes).

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/GameEngine.tsx` | Add early UFO update loop |
| `src/components/game/InitialsFireworks.tsx` | Match physics to main fireworks |
| `src/components/game/PortraitWarning.tsx` | Higher z-index, debug logging |
| `src/pages/Index.tsx` | Render PortraitWarning component |
| `src/components/game/PlayerMenu.tsx` | Add fullscreen reminder UI and logic |

---

## Technical Details

### Physics Comparison

| Property | FireworksDisplay | InitialsFireworks (Before) | InitialsFireworks (After) |
|----------|-----------------|---------------------------|---------------------------|
| Gravity | 0.03 | 0.08 | 0.03 |
| Air Resistance (vx) | 0.9995 | 0.99 | 0.998 |
| Air Resistance (vy) | 0.9998 | 0.99 | 0.998 |
| Base speeds | 2-8 | 4-8 | 1.5-5.5 |
| Particle life | 120-180 frames | 1.0 (seconds) | 1.5 (seconds) |

The lower gravity and higher air resistance (closer to 1.0) means particles maintain momentum longer and fall more gracefully - exactly like the main fireworks.

### Early UFO Update Flow

```
Game Loop
├── if (ufoLevelConfigRef.current) { ... } // Level 10+ scheduled UFOs
│   ├── Check spawn schedule
│   ├── updateSmallUFO() / updateUFO() / updateLargeUFO()
│   └── updateProjectiles()
│
├── Early UFO spawn check (level 5+, elapsed >= 25s)
│   └── Spawn UFO to ufoSpawnStateRef.current
│
├── Track early UFO destruction
│
└── NEW: if (shouldHaveEarlyUFO && earlyUFOTriggered && !ufoLevelConfigRef.current) {
    ├── updateSmallUFO() or updateUFO()
    └── updateProjectiles()
```

---

## Testing Checklist

1. **Early UFOs**: Play level 5+ for 25+ seconds - UFO should appear, move across screen, potentially shoot, and be destroyable
2. **InitialsFireworks**: Get high score, enter initials - fireworks should have same graceful physics as landing fireworks
3. **Portrait Warning**: On iPhone in portrait, warning should appear immediately with z-index above everything
4. **Fullscreen Reminder**: On PC PlayerMenu, wait 5+ seconds without fullscreen - reminder should appear

