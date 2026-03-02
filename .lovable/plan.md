

# Fix: Visible Button Highlighting on Game Over Screens

## Problem
The gamepad navigation correctly moves between buttons on success (and failure) screens, but there is no visible highlighting. The buttons use `focus-visible:ring-2` CSS, which only activates on keyboard-initiated focus, not programmatic `.focus()` from gamepad code.

## Solution
Replace all game over `<Button>` components (both success and failure screens) with `player-menu-btn` styled buttons that use the existing `goIndex` state to apply a `selected` class -- the same proven pattern used on the Survival game over screen.

## Changes

### File: `src/pages/Index.tsx`

**1. Replace Time Trial success buttons (lines 1403-1415)**

Replace the three `<Button>` components with `<button>` elements using `player-menu-btn` class and `goIndex`-driven `selected` class:
- Button 0: TRY AGAIN (`goIndex === 0`)
- Button 1: CONTINUE (`goIndex === 1`)  
- Button 2: MAIN MENU (`goIndex === 2`)

Each button gets `onFocus={() => setGoIndex(n)}` to sync state when focused by any means.

**2. Replace Fixed/Classic success Continue button (lines 1419-1425)**

Replace with a `player-menu-btn` button with `selected` class when `goIndex === 0`.

**3. Replace mission failed buttons (lines 1428-1438)**

Replace the three `<Button>` components with `player-menu-btn` styled buttons:
- Button 0: HOME (`goIndex === 0`)
- Button 1: RETRY CURRENT LEVEL (`goIndex === 1`)
- Button 2: RETRY FROM START (`goIndex === 2`)

**4. Update container layout (line 1399)**

Change the flex container from horizontal (`flex gap-3`) to vertical (`flex flex-col items-center gap-2 w-full max-w-xs mx-auto`) to match the Survival screen's button layout.

### Result
All post-game buttons will show the neon light-trail highlight animation when navigated to via gamepad, matching the Survival game over screen's visual feedback.
