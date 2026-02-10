
# Balancing Changes and Rotation Sensitivity Setting

## 1. Level Structure Rework (Classic Mode)

Update `src/components/game/systems/levelConfig.ts` to change the level type assignments:

| Level | Current | New |
|-------|---------|-----|
| 4 | Storm | Normal |
| 5 | Water | Storm (1st storm) |
| 6 | Water | Normal |
| 7 | N/A | Normal (already) |
| 8 | N/A | Water (1st water) |
| 17 | N/A | Water |
| 20 | N/A | Storm |
| 27 | Water | Water |
| 30 | Storm | Storm |
| 37 | Water | Water |
| 40 | Storm | Storm |
| ...and so on every 10 | ...pattern continues |

The `LEVEL_CONFIGURATIONS` map will be replaced with a function that handles the fixed early levels (5=storm, 8=water) plus the recurring pattern (level % 10 === 0 for storms from 20+, level % 10 === 7 for water from 17+).

Note: Darkside levels (level % 10 === 9, from level 9+) and Search levels (level % 10 === 4, from level 14+) are handled separately in `levelIntroNames.ts` and won't conflict.

## 2. Storm Level Ramping (Lightning)

**File: `src/components/game/systems/weather.ts`**

Replace the fixed `LEVEL4_CONSTANTS` with a function `getStormConstants(stormOccurrence)` that scales based on how many storm levels the player has encountered:

- **1st storm (level 5)**: 75% of current values -- interval 25% longer (0.625-2.5s), max concurrent bolts reduced by 25%
- **2nd storm (level 20)**: 81% of current
- **3rd storm (level 30)**: 87.5% of current
- **4th storm (level 40)**: 93.75% of current
- **5th storm+ (level 50+)**: 100% (current full intensity)

**File: `src/components/game/GameEngine.tsx`**

Pass a `stormOccurrence` number to the lightning system. Add a helper function to count which storm occurrence the current level is (1st, 2nd, 3rd, etc.).

Also scale the shockwave hit radius (currently 200px) by the same factor, so the chance of getting hit is also reduced for early storms.

**File: `src/components/game/systems/levelConfig.ts`**

Add a `getStormOccurrence(level)` helper that returns which storm number a given level is (1 for level 5, 2 for level 20, 3 for level 30, etc.).

## 3. Jellyfish Density Ramping (Water Levels)

**File: `src/components/game/terrain.ts`**

Update `generateJellyfish` to accept a `level` parameter. The first water level (level 8) gets 75% of the current count (23-38 instead of 30-50). Each subsequent water level adds ~6% until reaching 100% by the 5th water level occurrence.

Update the call site in `generateTerrain` to pass the level number.

## 4. Mega Pad Speed/Difficulty Cap at Level 10

**File: `src/components/game/systems/movingPads.ts`**

Change line 100:
```typescript
// Current: const levelSpeedMultiplier = Math.min(5, 1 + (level - 1) * 0.5);
// New: Cap at level 10 values (multiplier of 5.5)
const levelSpeedMultiplier = Math.min(1 + (Math.min(level, 10) - 1) * 0.5, 5);
```

This ensures the speed multiplier stops scaling after level 10 and stays at that level forever.

## 5. Mega Pad Scoring: Always 3x

**File: `src/components/game/systems/movingPads.ts`**

Change line 114:
```typescript
// Current: const scoreMult = forced ? 3.0 : (speedBand === "fast" ? 3.0 : 2.0);
// New: Always 3x
const scoreMult = 3.0;
```

## 6. Rotation Sensitivity Setting

### New config service: `src/lib/rotationSensitivity.ts`

A small module to load/save a rotation sensitivity multiplier from localStorage (`ll-rotation-sensitivity`):
- Range: 0.5 to 2.0 (0.5 = half sensitivity, 2.0 = double)
- Default: 1.0 (exactly current behavior)
- Step: 0.1

### File: `src/components/game/GameEngine.tsx`

Read the saved sensitivity value and apply it as a multiplier to `rotAccel` (line 1226):
```typescript
const rotSensitivity = loadRotationSensitivity(); // 0.5-2.0, default 1.0
const rotAccel = (difficulty === "easy" ? 2.2 : 2.8) * 1.15 * rotSensitivity;
```

### File: `src/pages/Controls.tsx` (Developer Settings)

Add a "Rotation Sensitivity" slider under the Gameplay Settings section:
- Label: "Rotation Sensitivity"
- Description: "Adjust digital rotation speed (keyboard/gamepad d-pad)"
- Slider: 0.5 to 2.0, step 0.1, default 1.0
- "Reset to Default" button that sets it back to 1.0

### File: `src/components/game/PlayerMenu.tsx`

When "SETTINGS" is clicked, it navigates to the Controls page. The rotation sensitivity slider will be visible there. No additional changes needed in PlayerMenu itself since the settings page already serves as the controls hub.

## Summary of Files Changed

| File | Changes |
|------|---------|
| `src/components/game/systems/levelConfig.ts` | New level structure (5=storm, 8=water, recurring 20/30/40... and 17/27/37...) + storm occurrence helper |
| `src/components/game/systems/weather.ts` | New `getStormConstants(occurrence)` function with ramping |
| `src/components/game/GameEngine.tsx` | Use ramped storm constants, apply rotation sensitivity |
| `src/components/game/terrain.ts` | Pass level to `generateJellyfish`, scale count by water occurrence |
| `src/components/game/systems/movingPads.ts` | Cap speed at level 10 values, always 3x score multiplier |
| `src/lib/rotationSensitivity.ts` | New -- load/save sensitivity setting |
| `src/pages/Controls.tsx` | Add rotation sensitivity slider + reset button |
