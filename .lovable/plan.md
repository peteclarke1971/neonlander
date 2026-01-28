
# Remove Retro-Burst Fireworks from Survival Mode

## Problem
On the 2nd landing (and every 10th landing after that: 12th, 22nd, 32nd, etc.) in Survival mode, a special "retro-burst" fireworks effect triggers. This shows 12 geometric pattern fireworks (pentagon-shatter, star-constellation, geometric-rose, etc.) instead of the normal fireworks based on landing count.

You want normal fireworks instead - so the 2nd landing should show 2 regular fireworks, not 12 geometric ones.

## Solution
Remove the `isRetroBurst` detection logic from `SurvivalEngine.tsx`. This will allow all landings to use the normal landing type (`regular`, `moving`, or `2x`), which then uses the `fireworkCount` prop (set to `landings`) to determine how many fireworks to show.

## Changes

### File: `src/components/game/SurvivalEngine.tsx`

**Remove lines 2190-2204** (the retro-burst logic):

Before:
```typescript
// Determine if this is a retro-burst trigger (2nd, 12th, 22nd, 32nd, etc.)
const isRetroBurst = currentLandings === 2 || (currentLandings > 2 && (currentLandings - 2) % 10 === 0);

// Clear any existing firework timeouts
fireworkTimeoutsRef.current.forEach(t => clearTimeout(t));
fireworkTimeoutsRef.current = [];

// Show fireworks after brief delay
const initialTimeout = setTimeout(() => {
  // retro-burst supersedes all other landing types
  if (isRetroBurst) {
    setLandingType('retro-burst');
  } else {
    setLandingType(isMoving ? 'moving' : isBonus ? '2x' : 'regular');
  }
  // ...
```

After:
```typescript
// Clear any existing firework timeouts
fireworkTimeoutsRef.current.forEach(t => clearTimeout(t));
fireworkTimeoutsRef.current = [];

// Show fireworks after brief delay
const initialTimeout = setTimeout(() => {
  // Use standard landing types (fireworkCount determines quantity)
  setLandingType(isMoving ? 'moving' : isBonus ? '2x' : 'regular');
  // ...
```

## Result

| Landing | Before (retro-burst) | After (normal) |
|---------|---------------------|----------------|
| 1st | 1 regular firework | 1 regular firework |
| 2nd | 12 geometric fireworks | 2 regular fireworks |
| 3rd | 3 regular fireworks | 3 regular fireworks |
| 12th | 12 geometric fireworks | 12 regular fireworks |
| 22nd | 12 geometric fireworks | 22 regular fireworks |

The `fireworkCount={landings}` prop already handles scaling fireworks with landing count - the retro-burst was overriding this behavior.

## Technical Note

The `'retro-burst'` landing type will still exist in `FireworksDisplay.tsx` for potential future use elsewhere (like the main game modes or high score celebrations), but it will no longer trigger in Survival mode.
