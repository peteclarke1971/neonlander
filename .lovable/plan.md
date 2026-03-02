
# Fix: Gamepad/Keyboard Navigation on Success Screens

## Problem
After entering high score initials on success screens (especially Time Trial), the gamepad can't navigate or select buttons because:
1. The Time Trial success buttons (Try Again, Continue, Main Menu) have no refs -- they can't be focused or clicked programmatically
2. The gamepad handler only does `contRef.current?.click()` for all success screens, which only works for the Fixed/Classic single "Continue" button
3. The keyboard handler ignores arrow keys entirely on success screens (early return at line 700-702)

## Changes

### File: `src/pages/Index.tsx`

**1. Add refs for the three Time Trial success buttons**

Create `ttRetryRef`, `ttContRef`, `ttMenuRef` alongside existing button refs and attach them to the Time Trial success buttons (lines 1396-1407).

**2. Update keyboard handler (`handleGameOverKeys`, ~line 696)**

Remove the early return for success screens. Add arrow key navigation for Time Trial (3 buttons: ttRetryRef, ttContRef, ttMenuRef) using Left/Right/Up/Down. Keep Enter activating the focused button. For Fixed/Classic success, keep Enter-to-continue behavior.

**3. Update gamepad handler (~line 630)**

For success screens, check if mode is "timetrial":
- If Time Trial: navigate between the 3 buttons using directional input (same pattern as mission failed), select activates focused button
- If Fixed/Classic: keep existing `contRef.current?.click()` behavior

**4. Update focus initialization (~line 570)**

When entering gameover with Time Trial success, focus the first Time Trial button (`ttRetryRef`) instead of `contRef`.

**5. Update `focusOrder` in gamepad loop (~line 630)**

Make `focusOrder()` return the correct button set based on success/failure and mode:
- Time Trial success: `[ttRetryRef, ttContRef, ttMenuRef]`
- Fixed/Classic success: `[contRef]`
- Failure: `[homeRef, retryCurrRef, retryRef]` (unchanged)

This ensures all success screens get full keyboard and gamepad navigation matching the mission failed screens.
