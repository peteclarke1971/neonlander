

# Fix Lander Clipping Below Landing Pad

## Problem
The lander's triangle in GameEngine extends from `(0, -10)` to `(-8, 10)` — bottom at **y+10** from center. But on landing, the ship snaps to `pad.y - 8`, placing the bottom at `pad.y + 2` (2px below the pad surface). SurvivalEngine correctly uses `- 12` for its same-sized triangle.

## Fix
Change all 4 instances of `pad.y - 8` (and `currentPos.y - 8`) in GameEngine landing logic to `pad.y - 10`, so the lander bottom sits exactly flush on the pad.

### Lines to change in `src/components/game/GameEngine.tsx`:
1. **Line 3610**: Moving pad landing — `landedPad.currentPos.y - 8` → `- 10`
2. **Line 3698**: Time trial correct pad — `landedPad.y - 8` → `- 10`
3. **Line 3787**: Time trial wrong pad — `landedPad.y - 8` → `- 10`
4. **Line 3805**: Regular landing — `landedPad.y - 8` → `- 10`

Also update the water-reflection lander triangle (line 4671-4673) from the smaller `(0,-8),(-6,6),(6,6)` to match the actual ship size `(0,-10),(-8,10),(8,10)` for visual consistency.

