
# Plan: Fix iPad Touch Controls Session Persistence and Pre-Level Message Repetition

## Summary

Two related issues affecting iPad users:
1. Touch controls reappear on each level despite keyboard/gamepad being detected in the previous level
2. Pre-level messages (e.g., "TRY NOT TO EMBARRASS YOURSELF") repeat multiple times when keyboard is pressed during display

---

## Issue 1: Touch Controls Reappear on Level Start

### Root Cause
In `GameEngine.tsx` at lines 265-270, the `isUsingPCControls` state initialization has special iPad logic that **ignores** the localStorage preference:

```javascript
const [isUsingPCControls, setIsUsingPCControls] = useState(() => {
  if (isIPadDevice()) return false;  // Always false for iPad, ignores localStorage!
  return hasPCControlsPreference() || isDesktopDevice();
});
```

When a keyboard/gamepad is pressed:
- `setIsUsingPCControls(true)` sets local React state (hides controls)
- `setPCControlsPreference(true)` saves to localStorage

But when a new level starts (or restart), the component state re-initializes and iPad returns `false` again, ignoring the saved preference.

### Solution
Modify the iPad check to also respect localStorage:

```javascript
const [isUsingPCControls, setIsUsingPCControls] = useState(() => {
  // iPad defaults to touch controls UNLESS user has previously used keyboard/gamepad
  if (isIPadDevice()) return hasPCControlsPreference();  // Check localStorage!
  return hasPCControlsPreference() || isDesktopDevice();
});
```

This means:
- iPad starts with touch controls visible on first ever use
- Once keyboard/gamepad is detected and saved to localStorage, iPad will respect that for the session
- The preference persists across levels AND across sessions

### Files to Modify
| File | Line | Change |
|------|------|--------|
| `src/components/game/GameEngine.tsx` | 265-270 | Change `if (isIPadDevice()) return false;` to `if (isIPadDevice()) return hasPCControlsPreference();` |
| `src/components/game/SurvivalEngine.tsx` | 69-72 | Add same iPad-specific check for consistency (currently missing) |

---

## Issue 2: Pre-Level Message Repeats with Keyboard Input

### Root Cause
The main game useEffect at line 6319 has `waitingForSpecialMessage` in its dependency array:

```javascript
}, [difficulty, onGameOver, paused, level, mode, seedOverride, waitingForSpecialMessage]);
```

When the pre-level message completes:
1. `setWaitingForSpecialMessage(false)` is called (line 6847)
2. This triggers the useEffect to re-run
3. The message display logic runs again

The guard `messageShownForLevel.current !== level` prevents showing the message again, BUT if keyboard input is pressed during the message display, the combination of state updates can cause race conditions.

Additionally, when keyboard is pressed during message display:
1. `setIsUsingPCControls(true)` triggers a re-render
2. If `neonColor` state changes concurrently (from useEffect at lines 696-700), the BonusMessageDisplay may re-render with new props
3. The `messages` array reference changes (it's `[specialLevelMessage]` inline), which matches the useEffect dependency and could restart animation

### Solution
Two fixes:

**Fix A: Stabilize the message array reference**
Instead of passing `[specialLevelMessage]` inline (creates new array each render), memoize it:

```javascript
const specialMessageArray = useMemo(() => 
  specialLevelMessage ? [specialLevelMessage] : [], 
  [specialLevelMessage]
);
```

**Fix B: Add early exit in keyboard handler during message display**
When pre-level message is showing, still register keyboard usage for PC controls detection, but don't cause unnecessary re-renders:

```javascript
const onKey = (e: KeyboardEvent, down: boolean) => {
  // Skip keyboard input in demo mode
  if (isDemo) return;
  
  // During pre-level message, only track PC controls preference (no other state changes)
  if (waitingForSpecialMessage && down) {
    if (!isUsingPCControls) {
      setIsUsingPCControls(true);
      setPCControlsPreference(true);
    }
    return; // Don't process key as input during message display
  }
  // ... rest of handler
};
```

However, `waitingForSpecialMessage` is React state and the keyboard handler is in a useEffect with `[isDemo]` dependency. We need to use a ref instead:

```javascript
const waitingForSpecialMessageRef = useRef(false);
// Keep ref in sync with state
useEffect(() => {
  waitingForSpecialMessageRef.current = waitingForSpecialMessage;
}, [waitingForSpecialMessage]);
```

### Files to Modify
| File | Line | Change |
|------|------|--------|
| `src/components/game/GameEngine.tsx` | ~365 | Add `waitingForSpecialMessageRef` ref |
| `src/components/game/GameEngine.tsx` | ~634-690 | Update keyboard handler to check ref and early exit during message display |
| `src/components/game/GameEngine.tsx` | ~6838-6849 | Memoize the message array or use stable reference |

---

## Implementation Order

1. **Fix iPad touch controls initialization** (GameEngine.tsx line 267)
2. **Add same fix to SurvivalEngine.tsx** for consistency
3. **Add waitingForSpecialMessageRef** to GameEngine.tsx
4. **Update keyboard handler** to early-exit during message display
5. **Stabilize message array reference** to prevent re-renders

---

## Technical Notes

### Session vs Persistent Behavior
The current behavior saves to `localStorage`, which means:
- Once keyboard is detected on iPad, controls stay hidden across ALL sessions (not just current)
- This is probably desired behavior - user has indicated they prefer keyboard

If only session-scoped behavior is wanted (not persisting across browser sessions), we would use:
- `sessionStorage` instead of `localStorage`, OR
- A global variable that doesn't persist

The current localStorage approach seems appropriate since it indicates user preference.

### Why SurvivalEngine Doesn't Have This Bug
SurvivalEngine at lines 69-72 doesn't have the special iPad check:
```javascript
const [isUsingPCControls, setIsUsingPCControls] = useState(() => {
  return hasPCControlsPreference() || isDesktopDevice();
});
```

Since iPad reports as desktop via `isDesktopDevice()` returning true (due to iOS 13+ reporting as MacIntel), SurvivalEngine would start with controls hidden on iPad - which is the opposite problem! Should also be fixed to check `isIPadDevice()` first.
