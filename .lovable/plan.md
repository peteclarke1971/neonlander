
# Fix: Game Over Screen Navigation (Gamepad + Keyboard)

## Issues Found

### Main Game Modes (Index.tsx)
- Gamepad translates d-pad inputs to synthetic keyboard events, but the keyboard handler (`handleGameOverKeys`) only listens for `ArrowLeft` and `ArrowRight`
- The three buttons (Home, Retry Current Level, Retry From Start) are laid out **horizontally**, so left/right is correct
- However, d-pad **up/down** should also work as aliases for left/right since users naturally try both directions
- The gamepad "select" (thrust button) works but uses `gp.buttons[0]` -- it should use the user's configured thrust button via `readGamepad`

### Survival Mode (Survival.tsx)
- Gamepad polling uses raw `gp.buttons` instead of the `readGamepad` utility (ignores user's configured controls and deadzone)
- **No keyboard handler exists at all** -- arrow keys and Enter do nothing on the game over screen
- The two buttons (Try Again, Back to Menu) are laid out **vertically**, so up/down is correct, but left/right should also work as aliases

---

## Planned Changes

### File: `src/pages/Index.tsx`

**Keyboard handler (`handleGameOverKeys`):**
- Add `ArrowUp` as alias for `ArrowLeft` (move to previous button)
- Add `ArrowDown` as alias for `ArrowRight` (move to next button)
- This means all four arrow keys navigate the horizontal button row

No changes needed to the gamepad handler -- it already translates all d-pad directions to arrow key events and the keyboard handler will now respond to all four.

### File: `src/pages/Survival.tsx`

**Add keyboard handler:**
- Add a `keydown` event listener when on the gameover screen (and not entering initials)
- `ArrowUp`, `ArrowLeft`: move focus to previous button (min 0)
- `ArrowDown`, `ArrowRight`: move focus to next button (max 1)
- `Enter`: click the currently focused button

**Improve gamepad handler:**
- Import and use `readGamepad`, `loadProfile`, `anyGamepad`, `getLastDeviceId`, `gateThrustUntilRelease` from `use-gamepad`
- Replace raw `gp.buttons` reads with `readGamepad()` so it respects user's configured controls (thrust button, deadzone, etc.)
- Add left/right d-pad support alongside up/down (both navigate the two buttons)
- Use the configured thrust/select button for activation instead of hardcoded `gp.buttons[0]`
- Add input cooldown (300ms) matching the main game pattern to prevent button carry-over from gameplay

---

## Technical Details

### Survival Keyboard Handler (new)
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
      // Click whichever button is focused
      if (focusedButtonIndex === 0) retryGame();
      else backToHome();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [view, needsInitials, focusedButtonIndex, retryGame, backToHome]);
```

### Index.tsx Keyboard Handler Update
Add two lines to `handleGameOverKeys`:
```typescript
if (key === "ArrowUp") { /* same logic as ArrowLeft */ }
if (key === "ArrowDown") { /* same logic as ArrowRight */ }
```

### Survival Gamepad Handler Update
- Replace raw gamepad reads with `readGamepad(gp, profile)` 
- Map all four UI directions (up/down/left/right) to navigate between the two buttons
- Use `input.ui.select` for activation (respects configured thrust button)
- Add 300ms cooldown on entering gameover screen
