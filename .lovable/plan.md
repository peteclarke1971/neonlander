
# Use Player's Chosen Starfield on All Mission Failed Screens

## What We're Doing

Replacing the hardcoded starfield effects on every mission failed/game over screen with the user's chosen starfield style (and customization settings). If no style has been chosen, it defaults to Nebula Drift. The existing starfield code on each screen will be commented out (not deleted) so it can be reverted easily.

## How It Works

A new shared component (`GameOverStarfield`) will read the user's starfield preference from localStorage (`ll-starfield-style`) and render the matching starfield component -- exactly mirroring the Player Menu's `renderStarfield` logic. Since all starfield components already read customization settings (density, speed, glow, etc.) from localStorage via `loadStarfieldConfig()`, the user's custom visual tweaks will automatically apply.

## Pages Affected

| Page | Current Starfield | After Change |
|------|------------------|--------------|
| Index.tsx (Classic/Fixed/Medley) | iOS: MobileStarfield, Desktop: HyperspaceStarfield + AsteroidField | User's chosen style |
| Asteroids.tsx | iOS: MobileStarfield, Desktop: HyperspaceStarfield (vector) | User's chosen style |
| AsteroidsColor.tsx | None (plain background) | User's chosen style |
| AsteroidsRemix.tsx | AsteroidStarfield | User's chosen style |
| LightCycles.tsx | HyperspaceStarfield | User's chosen style |
| NeonDocking.tsx | HyperspaceStarfield | User's chosen style |
| NeonRacing.tsx | HyperspaceStarfield | User's chosen style |
| Survival.tsx | HyperspaceStarfield | User's chosen style |
| Duel.tsx | iOS: MobileStarfield, Desktop: HyperspaceStarfield | User's chosen style |

## Technical Details

### Step 1: Create a shared component

**New file: `src/components/game/GameOverStarfield.tsx`**

A simple component that:
- Reads `ll-starfield-style` from localStorage
- Renders the corresponding starfield component using the same switch/case as PlayerMenu
- Wraps everything in a `div` with `position: absolute; inset: 0` styling
- Falls back to `NebulaDriftStarfield` (the default) if no preference is set

```text
+-------------------------------+
| GameOverStarfield             |
|  - reads ll-starfield-style   |
|  - renders matching component |
|  - absolute positioned        |
+-------------------------------+
```

### Step 2: Update each page's gameover view

For each of the 9 pages listed above:

1. Import `GameOverStarfield`
2. In the gameover/result section, comment out (wrap in `{/* OLD STARFIELD ... */}`) the existing starfield JSX
3. Replace with `<GameOverStarfield />`

The existing radial gradient overlays will remain in place -- they sit on top and will continue to work with any starfield style.

### Step 3: Remove unused imports (where applicable)

After commenting out the old starfield usage in gameover views, some pages may have starfield imports that are only used for the gameover screen (e.g., NeonRacing only imports HyperspaceStarfield for its gameover). These will be cleaned up, though imports shared with the home view (like in Asteroids.tsx) will remain.

### Summary of Changes

| File | Action |
|------|--------|
| `src/components/game/GameOverStarfield.tsx` | New shared component |
| `src/pages/Index.tsx` | Replace gameover starfield block |
| `src/pages/Asteroids.tsx` | Replace gameover starfield block |
| `src/pages/AsteroidsColor.tsx` | Add starfield to gameover (currently has none) |
| `src/pages/AsteroidsRemix.tsx` | Replace AsteroidStarfield with GameOverStarfield |
| `src/pages/LightCycles.tsx` | Replace gameover starfield |
| `src/pages/NeonDocking.tsx` | Replace gameover starfield |
| `src/pages/NeonRacing.tsx` | Replace gameover starfield |
| `src/pages/Survival.tsx` | Replace gameover starfield |
| `src/pages/Duel.tsx` | Replace gameover starfield |
