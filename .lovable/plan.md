
# Restore Dual Ghost Display in Fixed/Medley Modes

## Problem
When both local and global ghost modes are enabled, players should see two ghosts:
- **Green ghost**: Their personal best time (local)
- **Gold ghost**: The global world record

Currently, the system only displays ONE ghost - it prioritizes global over local as a fallback, rather than showing both simultaneously.

## Current Behavior
| Local Setting | Global Setting | What Shows |
|---------------|----------------|------------|
| ON | OFF | Green local ghost ✓ |
| OFF | ON | Gold global ghost ✓ |
| ON | ON | Only gold global ghost ✗ |

## Desired Behavior
| Local Setting | Global Setting | What Shows |
|---------------|----------------|------------|
| ON | OFF | Green local ghost |
| OFF | ON | Gold global ghost |
| ON | ON | Both green AND gold (unless player holds world record) |

## Root Cause Analysis
The code in `GameEngine.tsx` lines 1183-1237 uses a "fallback" pattern:
```typescript
let activeGhostRecording: any = null;
let isUsingGlobalGhost = false;

if (globalGhostsEnabled) {
  globalRecording = await loadGlobalGhost();
  if (globalRecording) {
    activeGhostRecording = globalRecording; // Uses global
    isUsingGlobalGhost = true;
  }
}

// Fallback to local if no global
if (!activeGhostRecording) {
  localRecording = loadLocalGhost();
  if (localRecording) {
    activeGhostRecording = localRecording; // Uses local only if no global
  }
}
```

This "either/or" logic prevents both ghosts from being displayed.

**Time Trial mode already works correctly** because it uses separate variables (`timeTrialLocalGhost` and `timeTrialLoadedGhost`) and renders them independently.

---

## Solution

### Part 1: Add Separate Ghost Variables for Fixed/Medley Modes

**File: `src/components/game/GameEngine.tsx`**

Add refs for separate ghost recordings (around line 330):

```typescript
// Separate refs for dual ghost support in Fixed/Medley modes
const fixedLocalGhost = useRef<any>(null);
const fixedGlobalGhost = useRef<any>(null);
```

### Part 2: Update Ghost Loading Logic

Replace the current single-ghost loading logic (lines ~1179-1237) with dual-ghost loading:

```typescript
// Initialize ghost system - load BOTH local and global ghosts
let localGhostRecording: any = null;
let globalGhostRecording: any = null;

// Check settings
const localGhostsEnabled = localStorage.getItem('ll-ghost-mode-enabled') === 'true';
const globalGhostsEnabled = localStorage.getItem('ll-global-ghosts-enabled') === 'true';

// Fixed mode ghost loading
if (isGhostModeFixed && ghostLevel !== undefined) {
  // Load local ghost if local setting enabled
  if (localGhostsEnabled) {
    const localRecording = ghostManager.current.loadLunarLanderGhost(difficulty, ghostLevel);
    if (localRecording) {
      localGhostRecording = localRecording;
      fixedLocalGhost.current = localRecording;
      console.log("👻 Local ghost loaded:", (localRecording.completionTime / 1000).toFixed(2) + "s");
    }
  }
  
  // Load global ghost if global setting enabled
  if (globalGhostsEnabled) {
    const globalRecording = await ghostManager.current.loadGlobalGhost(difficulty, ghostLevel, 'fixed');
    if (globalRecording) {
      globalGhostRecording = globalRecording;
      fixedGlobalGhost.current = globalRecording;
      console.log("🌍 Global ghost loaded:", (globalRecording.completionTime / 1000).toFixed(2) + "s");
    }
  }
}

// Same pattern for Medley mode...
```

### Part 3: Add Separate Ghost State Objects

Replace single `ghostShip` with two separate ghost ship objects:

```typescript
// Ghost state - separate for local and global
let localGhostShip: { x: number; y: number; angle: number; visible: boolean } | null = null;
let globalGhostShip: { x: number; y: number; angle: number; visible: boolean } | null = null;

if ((isGhostModeFixed && ghostLevel !== undefined) || isGhostModeMedley) {
  if (localGhostsEnabled) {
    localGhostShip = { x: 0, y: 0, angle: 0, visible: false };
  }
  if (globalGhostsEnabled) {
    globalGhostShip = { x: 0, y: 0, angle: 0, visible: false };
  }
}
```

### Part 4: Update Ghost Playback Logic

Replace the current ghost playback (lines ~1908-1928):

```typescript
// Ghost playback - update BOTH ghost states (fixed and medley modes)
if (isGhostMode) {
  // Update local ghost state
  if (fixedLocalGhost.current && localGhostShip) {
    const localState = mode === "medley" 
      ? ghostManager.current.getMedleyGhostState(difficulty, level, gameTime)
      : ghostManager.current.getLunarLanderGhostState(difficulty, ghostLevel!, gameTime);
    
    if (localState) {
      localGhostShip.x = localState.x;
      localGhostShip.y = localState.y;
      localGhostShip.angle = localState.angle;
      localGhostShip.visible = localState.visible;
    } else {
      localGhostShip.visible = false;
    }
  }
  
  // Update global ghost state
  if (fixedGlobalGhost.current && globalGhostShip) {
    const globalState = ghostManager.current.getGlobalGhostState(fixedGlobalGhost.current, gameTime);
    
    if (globalState) {
      globalGhostShip.x = globalState.x;
      globalGhostShip.y = globalState.y;
      globalGhostShip.angle = globalState.angle;
      globalGhostShip.visible = globalState.visible;
    } else {
      globalGhostShip.visible = false;
    }
  }
}
```

### Part 5: Update Ghost Rendering

Replace single ghost rendering (lines ~5079-5101) with dual ghost rendering:

```typescript
// Ghost ships (render before player)
// Local ghost (green)
if (localGhostShip && localGhostShip.visible) {
  for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
    ctx.save();
    ctx.translate(localGhostShip.x + offset, localGhostShip.y);
    ctx.rotate(localGhostShip.angle);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.strokeStyle = '#00ff80'; // Green for local
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);
    ctx.moveTo(6, 8); ctx.lineTo(12, 12);
    ctx.stroke();
    ctx.restore();
  }
}

// Global ghost (gold)
if (globalGhostShip && globalGhostShip.visible) {
  for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
    ctx.save();
    ctx.translate(globalGhostShip.x + offset, globalGhostShip.y);
    ctx.rotate(globalGhostShip.angle);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.strokeStyle = '#FFD700'; // Gold for global
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);
    ctx.moveTo(6, 8); ctx.lineTo(12, 12);
    ctx.stroke();
    ctx.restore();
  }
}
```

### Part 6: Skip Duplicate Ghost When Player Holds Record

Add logic to skip local ghost if player's time equals global record:

```typescript
// During loading, check if local time matches global time
const playerHoldsRecord = localGhostRecording && globalGhostRecording &&
  Math.abs(localGhostRecording.completionTime - globalGhostRecording.completionTime) < 50;

// If player holds the record, only show global (gold) ghost
if (playerHoldsRecord) {
  fixedLocalGhost.current = null;
  localGhostShip = null;
  console.log("🏆 Player holds world record - showing only gold ghost");
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/GameEngine.tsx` | Add dual ghost refs, update loading/playback/rendering logic |

---

## Result After Fix

| Local Setting | Global Setting | What Shows |
|---------------|----------------|------------|
| ON | OFF | Green local ghost only |
| OFF | ON | Gold global ghost only |
| ON | ON (player doesn't hold record) | Both green AND gold ghosts |
| ON | ON (player holds record) | Gold ghost only (as their local IS the global) |

---

## Technical Notes

- This mirrors the existing Time Trial implementation which already supports dual ghosts
- Ghost time difference calculation for HUD will need adjustment to show both times
- The ghost rendering order (local first, then global) ensures gold ghost renders on top if they overlap
