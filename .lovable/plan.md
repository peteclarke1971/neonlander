

# Fix Landing Detection Height in GameEngine

## Problem
In GameEngine, collision is detected when `y + 8 >= ground` (line 3398), but the ship is then snapped to `pad.y - 12`. This means the collision triggers when the ship center is at `ground - 8`, then it jumps up to `ground - 12` — a visible 4px upward "bump".

In SurvivalEngine, collision uses `shipY + 12 >= terrainY` and snaps to `pad.y - 12` — perfectly consistent, no bump.

## Fix
Change GameEngine line 3398 from `y + 8` to `y + 12` to match SurvivalEngine. This makes collision trigger at the same position it snaps to, eliminating the visual bump.

**One line change:**
- `src/components/game/GameEngine.tsx` line 3398: `const foot = y + 8` → `const foot = y + 12`

## Graphics Default
The game defaults to **Low graphics** (`"low"`) when no setting is saved — see `loadGraphicsSettings()` return on line 33 of `graphicsConfig.ts`.

