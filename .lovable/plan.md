# Plan: Firework Masking, Repeatable Tips, and Longer Duration

## Status: ✅ COMPLETE

## Overview
This plan addressed three changes:
1. ✅ Add terrain-masked fireworks to Survival mode (respecting settings toggle)
2. ✅ Make tips show every time a level loads (not just first time) when tips are enabled
3. ✅ Increase tip display duration by 2 seconds

---

## Changes Made

### Part 1: Firework Masking in Survival Mode

**File: `src/components/game/SurvivalEngine.tsx`**
- Added `terrainMaskedFireworks` state reading from localStorage
- Added `cameraStateRef` and `terrainPointsRef` refs
- Updated camera state ref in render loop after smoothedAnchor calculation
- Aggregated terrain points from all chunks for masking
- Updated FireworksDisplay with terrain masking props

### Part 2: Make Tips Show Every Time

**File: `src/lib/inFlightGuide.ts`**
- Added new `showTipAlways()` function that shows tips every time without checking localStorage

**File: `src/components/game/GameEngine.tsx`**
- Switched import and calls from `showTip` to `showTipAlways`

**File: `src/components/game/SurvivalEngine.tsx`**
- Switched import and calls from `showTip` to `showTipAlways`

### Part 3: Increase Tip Duration by 2 Seconds

**File: `src/lib/inFlightGuide.ts`**
- Updated all tip durations (+2000ms each)

---

## Current Tips and Their Triggers Summary

| Tip ID | Message | Duration | Trigger Location |
|--------|---------|----------|------------------|
| `basic` | "THRUST to ascend, ROTATE to aim. Land gently on pads!" | 7000ms | GameEngine: Level 1 |
| `landing` | "Green pads = safe. Land at low speed with level angle." | 6000ms | **Unused** |
| `junk` | "Collect SPACE JUNK for fuel! 3 items opens WORMHOLE." | 6500ms | **Unused** |
| `shield` | "SHIELD protects from one crash. Bounces you to safety." | 6000ms | **Unused** |
| `volcano` | "VOLCANOES erupt! Avoid lava particles." | 6000ms | **Unused** |
| `ufo` | "UFO ALERT! Dodge projectiles or use shield." | 6000ms | **Unused** |
| `timetrial` | "Land on pads IN ORDER! Timer starts at first takeoff." | 7000ms | GameEngine: Time trial mode |
| `survival` | "Travel as far as you can! Land on pads to refuel." | 7000ms | SurvivalEngine: On mount |
| `blackout` | "BLACKOUT! Use your spotlight to navigate." | 6000ms | **Unused** |
| `storm` | "LIGHTNING STORM! Watch for strikes." | 6000ms | **Unused** |
| `comet` | "COMET! Catch it for bonus points." | 5500ms | **Unused** |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/inFlightGuide.ts` | Added `showTipAlways()` function, increased all durations by 2000ms |
| `src/components/game/SurvivalEngine.tsx` | Added terrain masking state/refs, update camera refs in loop, updated FireworksDisplay props, switched to `showTipAlways()` |
| `src/components/game/GameEngine.tsx` | Switched to `showTipAlways()` for tip display |
