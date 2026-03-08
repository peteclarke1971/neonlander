

# Separate Digital & Analog Rotation Sensitivity Settings

## Summary

Currently there's a single "Rotation Sensitivity" setting that only applies to digital rotation (keyboard/d-pad) in GameEngine. The analog stick rotation in GameEngine uses `rotAccel` (which includes this sensitivity) but through a different code path. SurvivalEngine doesn't use the sensitivity setting at all.

This plan creates a new **analog rotation sensitivity** setting alongside the existing one (renamed to "digital"), both defaulting to 1.0.

## Changes

### 1. New file: `src/lib/analogRotationSensitivity.ts`
- Mirror of `rotationSensitivity.ts` with storage key `ll-analog-rotation-sensitivity`
- Same range (0.5–2.0), same default (1.0)
- Export `loadAnalogRotationSensitivity`, `saveAnalogRotationSensitivity`, `resetAnalogRotationSensitivity`, and constants

### 2. `src/lib/rotationSensitivity.ts`
- No changes needed (this stays as the digital sensitivity)

### 3. `src/pages/Controls.tsx`
- Rename label from "Rotation Sensitivity" → **"Digital Rotation Sensitivity"**
- Update description to "Adjust rotation speed for keyboard & gamepad d-pad"
- Add a new **"Analog Rotation Sensitivity"** slider below it with description "Adjust rotation speed for gamepad analog stick & gyroscope"
- Import the new analog sensitivity functions
- Add state + slider wiring (same pattern as existing)

### 4. `src/components/game/GameEngine.tsx`
- Import `loadAnalogRotationSensitivity`
- Load analog sensitivity alongside digital: `const analogRotSensitivity = loadAnalogRotationSensitivity()`
- Line ~2121: Change `input.rotation * rotAccel * dt` to use `analogRotSensitivity` instead of the digital sensitivity baked into `rotAccel`. This means computing a separate `analogRotAccel` from the base rotation value × analogSensitivity
- Digital rotation (line 2375-2376) continues using the existing `rotAccel` (which includes digital sensitivity)

### 5. `src/components/game/SurvivalEngine.tsx`
- Import both `loadRotationSensitivity` and `loadAnalogRotationSensitivity`
- Apply digital sensitivity to keyboard/d-pad rotation paths (lines ~1381, 1384, 1433-1437)
- Apply analog sensitivity to analog stick rotation (line ~1376) and gyroscope input (line ~1430)
- Multiply `ROTATION_ACCEL` by respective sensitivity values

### Defaults
Both settings default to **1.0** — no gameplay change until a player adjusts them.

