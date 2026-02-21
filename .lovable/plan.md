

# Fix: Survival Game Over Navigation + HOME Button Pass-Through

## Problem 1: Survival Game Over - No Keyboard Navigation
The survival game over screen has no keyboard event listener at all, and the gamepad handler uses raw `gp.buttons` instead of the proper `readGamepad` utility (ignoring user's configured controls).

## Problem 2: HOME Button Triggers START GAME
When selecting HOME on the mission failed screen via gamepad, the player menu appears but the game immediately starts. This happens because:
- The gamepad select button is still physically pressed when PlayerMenu mounts
- PlayerMenu's `gpPrevRef` starts with all `false`, so the first poll sees select as a "new press"
- This immediately clicks START GAME (index 0)

---

## Planned Changes

### File: `src/pages/Survival.tsx`

**Add keyboard handler** (new useEffect):
- Listen for `keydown` when on gameover screen and not entering initials
- ArrowUp / ArrowLeft: move focus to previous button (min 0)
- ArrowDown / ArrowRight: move focus to next button (max 1)
- Enter: activate focused button (Try Again or Back to Menu)

**Replace raw gamepad handler** with proper `readGamepad`:
- Import `anyGamepad`, `loadProfile`, `readGamepad`, `getLastDeviceId`, `gateThrustUntilRelease` from `use-gamepad`
- Use `readGamepad(gp, profile)` instead of raw `gp.axes`/`gp.buttons`
- Map all four UI directions to navigate between the two buttons
- Use `input.ui.select` for activation
- Add 300ms input cooldown on entering gameover (matching Index.tsx pattern)

### File: `src/components/game/PlayerMenu.tsx`

**Add input cooldown on mount** to prevent pass-through from previous screen:
- Add state `inputReady` (boolean, starts false)
- On mount, set a 300ms timeout to enable input
- During cooldown, update `gpPrevRef` with current input state (so edge detection works correctly when cooldown ends) but skip all actions
- This prevents the still-held select button from triggering START GAME

---

## Technical Details

### Survival Keyboard Handler
```typescript
useEffect(() => {
  if (view !== 'gameover' || needsInitials) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusedButtonIndex(i => Math.max(0, i - 1));
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusedButtonIndex(i => Math.min(1, i + 1));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedButtonIndex === 0) retryGame();
      else backToHome();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [view, needsInitials, focusedButtonIndex, retryGame, backToHome]);
```

### PlayerMenu Input Cooldown
```typescript
const [inputReady, setInputReady] = useState(false);
useEffect(() => {
  setInputReady(false);
  const t = setTimeout(() => setInputReady(true), 300);
  return () => clearTimeout(t);
}, []);

// In gamepad loop:
if (!inputReady) {
  gpPrevRef.current = { ...input.ui };
  return; // Track state but skip actions
}
```
