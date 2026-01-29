

# Update Tips Text and Trigger Locations

## Summary
This plan updates the text content of several in-flight tips and assigns them to specific levels in Classic/Fixed modes, plus one tip for Survival mode's first comet event.

---

## Text Changes Required

| Tip ID | Current Text | New Text |
|--------|--------------|----------|
| `landing` | "Green pads = safe. Land at low speed with level angle." | "Land on the glowing pads. 2x gives double points" |
| `junk` | "Collect SPACE JUNK for fuel! 3 items opens WORMHOLE." | "Collect SPACE JUNK for fuel, getting it all awards shield!" |
| `shield` | "SHIELD protects from one crash. Bounces you to safety." | "SHIELDS can take one hit and bounce you to safety." |
| `comet` | "COMET! Catch it for bonus points." | "COMET! Land when active for bonus points." |

---

## Trigger Assignments

| Tip ID | Trigger Location | Notes |
|--------|------------------|-------|
| `landing` | Level 2 | Classic/Fixed modes, after countdown |
| `junk` | Level 3 | Classic/Fixed modes, after countdown |
| `shield` | Level 4 | Classic/Fixed modes, after countdown |
| `blackout` | Level 9 | First blackout level (level 9 is where `darkside` type starts) |
| `storm` | Level 4 | First storm/lightning level (level 4 is configured as lightning) |
| `comet` | First comet appearance | Survival mode only, when comet first activates |

**Note on Level 10 vs Level 9**: The game code shows blackout ("darkside") levels occur at level 9, 19, 29, etc. (formula: `level % 10 === 9`). Level 10 is actually a normal level. If you specifically want level 10, I can adjust, but level 9 is the first blackout level.

---

## Technical Implementation

### File: `src/lib/inFlightGuide.ts`

Update the `TIPS` object with new text:

```typescript
landing: {
  id: 'landing',
  message: 'Land on the glowing pads. 2x gives double points',
  duration: 6000,
},
junk: {
  id: 'junk',
  message: 'Collect SPACE JUNK for fuel, getting it all awards shield!',
  duration: 6500,
},
shield: {
  id: 'shield',
  message: 'SHIELDS can take one hit and bounce you to safety.',
  duration: 6000,
},
comet: {
  id: 'comet',
  message: 'COMET! Land when active for bonus points.',
  duration: 5500,
},
```

### File: `src/components/game/GameEngine.tsx`

Expand the tip logic in the level initialization useEffect (around line 414-438) to include new level-specific tips:

```typescript
useEffect(() => {
  if (isDemo || tipShownThisLevel.current) return;
  
  const tipTimeout = setTimeout(() => {
    let tip: TipDefinition | null = null;
    
    // Time trial specific tip
    if (mode === 'timetrial') {
      tip = showTipAlways('timetrial');
    }
    // Level-specific tips for classic/fixed modes
    else if (mode === 'classic' || mode === 'fixed') {
      if (level === 1) {
        tip = showTipAlways('basic');
      } else if (level === 2) {
        tip = showTipAlways('landing');
      } else if (level === 3) {
        tip = showTipAlways('junk');
      } else if (level === 4) {
        // Level 4 is also a storm level - show shield tip instead
        // (storm tip shows on subsequent storm levels)
        tip = showTipAlways('shield');
      } else if (level === 9) {
        // First blackout level
        tip = showTipAlways('blackout');
      } else if (isLightningLevel(mode, level) && level !== 4) {
        // Storm levels after level 4
        tip = showTipAlways('storm');
      }
    }
    
    if (tip) {
      setCurrentTip(tip);
      tipShownThisLevel.current = true;
    }
  }, 2500);
  
  return () => clearTimeout(tipTimeout);
}, [level, mode, isDemo]);
```

### File: `src/components/game/SurvivalEngine.tsx`

Add a ref to track if comet tip has been shown this session (around line 176):

```typescript
const cometTipShownRef = useRef(false);
```

Add comet tip trigger when first comet activates (around line 1769, after `firstCometSpawnedRef.current = true`):

```typescript
// Show comet tip on first comet appearance
if (!cometTipShownRef.current) {
  const tip = showTipAlways('comet');
  if (tip) {
    setCurrentTip(tip);
    cometTipShownRef.current = true;
  }
}
```

This needs to be added in all places where the first comet spawns (chunks 5-8 spawn and the fallback >8 spawn).

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/inFlightGuide.ts` | Update text for `landing`, `junk`, `shield`, and `comet` tips |
| `src/components/game/GameEngine.tsx` | Add tip triggers for levels 2, 3, 4, 9, and subsequent storm levels |
| `src/components/game/SurvivalEngine.tsx` | Add comet tip trigger on first comet spawn |

---

## Tip Schedule Summary

| Level | Mode | Tip Shown |
|-------|------|-----------|
| 1 | Classic/Fixed | "THRUST to ascend, ROTATE to aim. Land gently on pads!" |
| 2 | Classic/Fixed | "Land on the glowing pads. 2x gives double points" |
| 3 | Classic/Fixed | "Collect SPACE JUNK for fuel, getting it all awards shield!" |
| 4 | Classic/Fixed | "SHIELDS can take one hit and bounce you to safety." |
| 9 | Classic/Fixed | "BLACKOUT! Use your spotlight to navigate." |
| 14+ storm levels | Classic/Fixed | "LIGHTNING STORM! Watch for strikes." |
| Start | Survival | "Travel as far as you can! Land on pads to refuel." |
| First comet | Survival | "COMET! Land when active for bonus points." |
| Any | Time Trial | "Land on pads IN ORDER! Timer starts at first takeoff." |

