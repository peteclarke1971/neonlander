
# Plan: Footer Button Navigation + Starting Level Left/Right

## Overview
Add gamepad/keyboard navigation support for the footer toggle buttons (Ghost, Tips, Lvl#, GFX) below the main menu, and add left/right gamepad support in the Starting Level sub-menu.

## Current Behavior
- Main menu has 5 items: START GAME (0), CHOOSE GAME MODE (1), STARTING LEVEL (2), GUIDE (3), SETTINGS (4)
- Down from SETTINGS hits the bottom boundary and stops
- Footer buttons (Ghost, Tips, Lvl#, GFX) are only clickable via touch/mouse
- Starting Level sub-menu: gamepad up/down cycles levels, but left/right does nothing

## Proposed Navigation Flow

```text
  START GAME
  CHOOSE GAME MODE
  STARTING LEVEL
  GUIDE
  SETTINGS
      |
    (down)
      v
  [GHOST OFF] <--left/right--> [TIPS ON] <--left/right--> [LVL# ON] <--left/right--> [LOW/MED/HIGH GFX]
      |
    (up)
      v
  SETTINGS (always)
```

## Technical Changes

### File: `src/components/game/PlayerMenu.tsx`

**1. Add footer navigation state**
- New state: `footerFocusedIndex` (number, -1 = not in footer)
- Footer items array: `["ghost", "tips", "lvl", "gfx"]` (4 items)

**2. Main menu keyboard handler changes** (lines 616-628)
- When on SETTINGS (focusedIndex === 4) and ArrowDown pressed: set `footerFocusedIndex = 0`, keep focusedIndex at 4 but blur main menu focus
- When in footer (footerFocusedIndex >= 0):
  - ArrowLeft: decrement footerFocusedIndex (min 0)
  - ArrowRight: increment footerFocusedIndex (max 3)
  - ArrowUp: exit footer (`footerFocusedIndex = -1`), focus stays on SETTINGS
  - Enter: toggle the focused footer option (ghost/tips/lvl/gfx)
- When ArrowDown on items 0-3: reset footerFocusedIndex to -1 (ensure clean state)

**3. Main menu gamepad handler changes** (lines 543-569)
- Same logic as keyboard but using gamepad input edges
- Down from SETTINGS → enter footer at index 0
- Left/Right in footer → cycle footer items
- Up from footer → back to SETTINGS
- Select in footer → toggle the option

**4. Footer button styling** (lines 932-1051)
- Add a visual highlight (ring/glow) to whichever footer button matches `footerFocusedIndex`
- Add refs to footer buttons for focus management
- Ghost = index 0, Tips = index 1, Lvl# = index 2, GFX = index 3

**5. Footer toggle actions**
- Select/Enter on each footer item triggers the same click handler already used:
  - Ghost: toggle `ghostModeEnabled`
  - Tips: toggle `tipsEnabled`
  - Lvl#: toggle `showLevelNumber`
  - GFX: cycle `graphicsLevel`

**6. Starting Level sub-menu: add left/right gamepad support** (lines 513-542)
- In the gamepad loop for `showLevelMenu`, add left/right input handling identical to up/down (decrement/increment levelFocusedIndex within bounds)
- This matches the existing keyboard left/right behavior already present at lines 600-611

**7. Reset footer focus on re-entry**
- When navigating down from SETTINGS to footer, always start at index 0 (Ghost button)
- When navigating up from footer or selecting a main menu item, reset footerFocusedIndex to -1
