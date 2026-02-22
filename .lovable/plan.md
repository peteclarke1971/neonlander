
# Fix: Survival Game Over Button Navigation

## Root Cause
The `focusedButtonIndex` state is included in the dependency arrays of both the keyboard and gamepad `useEffect` hooks. Every time focus changes (e.g., pressing down to highlight "Back to Menu"), the effects restart, which:
1. **Gamepad**: Resets the 300ms cooldown (`readyAt = performance.now() + 300`), blocking further input for another 300ms after each navigation
2. **Both**: Recreates event handlers and edge-detection state (`prev`) on every focus change, potentially causing missed or duplicate inputs

## Fix

### File: `src/pages/Survival.tsx`

**Use a ref to track `focusedButtonIndex`** so neither effect needs it in its dependency array:

1. Add `const focusedIndexRef = useRef(0)` alongside the existing state
2. Keep `focusedButtonIndex` state for rendering (the ring highlight), but sync it to the ref
3. Update the keyboard `useEffect`:
   - Read `focusedIndexRef.current` instead of `focusedButtonIndex` from closure
   - Remove `focusedButtonIndex` from dependency array (keep `view`, `needsInitials`, `retryGame`, `backToHome`)
   - When changing focus, update both state and ref
4. Update the gamepad `useEffect`:
   - Read `focusedIndexRef.current` instead of `focusedButtonIndex` from closure
   - Remove `focusedButtonIndex` from dependency array (keep `view`, `needsInitials`, `retryGame`, `backToHome`)
   - The 300ms cooldown now only triggers once when entering gameover, not on every focus change

### Keyboard handler becomes:
```typescript
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const next = Math.max(0, focusedIndexRef.current - 1);
    focusedIndexRef.current = next;
    setFocusedButtonIndex(next);
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    const next = Math.min(1, focusedIndexRef.current + 1);
    focusedIndexRef.current = next;
    setFocusedButtonIndex(next);
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (focusedIndexRef.current === 0) retryGame();
    else backToHome();
  }
};
```

### Gamepad handler select becomes:
```typescript
if (input.ui.select && !prev.select) {
  if (focusedIndexRef.current === 0) retryGame();
  else {
    gateThrustUntilRelease();
    backToHome();
  }
}
```

This ensures the 300ms cooldown only fires once on screen entry, and navigation/selection always reads the latest focus index without restarting the effects.
