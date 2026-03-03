

# Standardize Game-Over Buttons to Arcade Style

## Overview

Replace all `<Button>` component usage on mission-failed/game-over screens with the `player-menu-btn` pattern (matching Survival and Asteroids modes). This gives consistent neon arcade styling with `selected` class highlighting for focused items.

## Files to Change

### 1. Index.tsx (Main Lander -- Mission Failed + Success buttons)

**Lines 1399-1439**: Replace `<Button>` components with `player-menu-btn` buttons.

- Mission Failed buttons (Home, Retry Current Level, Retry From Start): change from horizontal `<Button>` layout to a vertical `<nav>` with `player-menu-btn` buttons and `selected` class tied to `goIndex`.
- Success buttons (Continue, Time Trial trio): same treatment.
- Change the container from `flex gap-3` horizontal to `flex flex-col items-center gap-2 w-full max-w-xs` vertical nav.
- Use `ref` callback pattern (`ref={el => ...}`) instead of single refs, or keep existing refs but add `player-menu-btn` class and `selected` logic.

### 2. LightCycles.tsx (Lines 411-418)

Replace:
```html
<div className="space-y-4">
  <Button ref={tryAgainRef} ... variant="outline" ...>Try Again</Button>
  <Button ref={mainMenuRef} ... variant="ghost" ...>Main Menu</Button>
</div>
```
With:
```html
<nav className="flex flex-col items-center gap-2 w-full max-w-xs">
  <button ref={tryAgainRef} className={`player-menu-btn w-full ${goFocusIndex === 0 ? 'selected' : ''}`} onClick={retryGame} onFocus={() => setGoFocusIndex(0)} autoFocus>TRY AGAIN</button>
  <button ref={mainMenuRef} className={`player-menu-btn w-full ${goFocusIndex === 1 ? 'selected' : ''}`} onClick={backToHome} onFocus={() => setGoFocusIndex(1)}>MAIN MENU</button>
</nav>
```

### 3. NeonRacing.tsx (Lines 441-448) -- same pattern as LightCycles

### 4. NeonDocking.tsx (Lines 432-447)

Has three states (high score, crash with no retry, normal). Replace both the crash state and normal state buttons with `player-menu-btn` pattern.

### 5. AsteroidsColor.tsx (Lines 288-297)

Replace `<Button>` components with `player-menu-btn` pattern. Add `goFocusIndex` state and gamepad/keyboard navigation (currently missing).

### 6. AsteroidsRemix.tsx (Lines 306-311)

Replace `<Button>` components with `player-menu-btn` pattern. Add focus index state and navigation support.

## Navigation

All modes that already have gamepad polling and keyboard listeners (LightCycles, NeonRacing, NeonDocking, Index.tsx) keep their existing navigation logic -- the only change is the visual button element. AsteroidsColor and AsteroidsRemix need focus-index state and basic keyboard/gamepad nav added (matching the pattern already in Asteroids.tsx).

## Technical Details

- Remove `<Button>` import where no longer needed on game-over screens
- Use uppercase text (TRY AGAIN, MAIN MENU, etc.) to match arcade style
- All buttons get `player-menu-btn w-full` class with `selected` conditional
- Wrap in `<nav className="flex flex-col items-center gap-2 w-full max-w-xs">`
- Existing gamepad loops and keyboard handlers continue to work since they use refs

