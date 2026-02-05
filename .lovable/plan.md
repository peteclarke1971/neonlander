
# Plan: Low Fuel Flashing in Medley/Survival and iOS Starfield Toggle

## Summary

This plan addresses two features:
1. Replicate the low fuel lander flashing behavior (from Time Trial, Fixed, Classic modes) into Medley and Survival modes
2. Create an improved starfield option for iOS devices with a toggle in settings

---

## Part 1: Low Fuel Lander Flashing for Medley and Survival

### Current Behavior
- **GameEngine.tsx** (line 5543): The ship color/glow warning system only runs for modes: "classic", "fixed", or "timetrial"
- **Medley mode** uses GameEngine but is excluded from the condition
- **SurvivalEngine.tsx**: Has no ship color warning system at all - the lander outline always uses `neonColor`

### The Warning Effect Logic (from GameEngine lines 5539-5567)
```text
Fuel Level       | Effect
-----------------|------------------------------------------
50% - 8%         | Ship pulses between neon and red
                 | Frequency: 2Hz at 50% → 8Hz at 8% (faster as fuel drops)
                 | Red intensity: 30% at 50% → 100% at 8%
Below 8%         | Solid red with pulsing glow (5Hz)
                 | Glow: 20-40px pulsing shadow blur
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/game/GameEngine.tsx` | Add "medley" to the mode check at line 5543 |
| `src/components/game/SurvivalEngine.tsx` | Add the entire ship color warning logic before lander rendering |

### Implementation Details

**GameEngine.tsx (simple fix)**
Change line 5543 from:
```typescript
if (mode === "classic" || mode === "fixed" || mode === "timetrial") {
```
To:
```typescript
if (mode === "classic" || mode === "fixed" || mode === "timetrial" || mode === "medley") {
```

**SurvivalEngine.tsx (add full warning logic)**
Add before line 3608 (where `ctx.globalAlpha = shipAlpha` is set):
```typescript
// Low fuel warning - smooth color fade and pulsing glow
let shipColor = neonColor;
let shipShadowBlur = shouldOptimize ? 8 : 12;

const fuelPercent = fuelAmount / fuelCap;

if (fuelPercent <= 0.5 && fuelPercent > 0) {
  if (fuelPercent < 0.08) {
    // Below 8% - Solid red with pulsing glow
    shipColor = "#ff0000";
    const glowPulse = (Math.sin(currentTime * 5 * Math.PI * 2) + 1) / 2;
    shipShadowBlur = 20 + glowPulse * 20;
  } else {
    // 8-50% - Pulsing between neon and red
    const fuelRatio = (fuelPercent - 0.08) / 0.42;
    const pulseFreq = 2 + (1 - fuelRatio) * 6;
    const pulse = (Math.sin(currentTime * pulseFreq * Math.PI * 2) + 1) / 2;
    const redInfluence = 0.3 + (1 - fuelRatio) * 0.7;
    shipColor = pulse > (1 - redInfluence) ? "#ff0000" : neonColor;
  }
}
```

Then update lines 3611-3613 to use `shipColor` and `shipShadowBlur` instead of `neonColor` and hardcoded `12`.

---

## Part 2: iOS Starfield Toggle

### Current Behavior
- iOS devices use `MobileStarfield` (radial burst with neon color cycling)
- Non-iOS devices use `HyperspaceStarfield` (3D perspective starfield with trails)
- No user option to switch between them

### Solution: Create Enhanced iOS Starfield + Toggle

#### Approach A: Add HyperspaceStarfield Support for iOS
The `HyperspaceStarfield` component already works on iOS - it just uses simpler rendering. We can allow iOS users to opt into it.

#### New Setting
| Setting | localStorage Key | Default | Options |
|---------|-----------------|---------|---------|
| Starfield Style | `ll-starfield-style` | `"auto"` | `"auto"`, `"hyperspace"`, `"mobile"` |

- **auto**: iOS uses MobileStarfield, others use HyperspaceStarfield (current behavior)
- **hyperspace**: Always use HyperspaceStarfield (3D perspective)
- **mobile**: Always use MobileStarfield (radial burst)

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Controls.tsx` | Add Starfield Style dropdown (visible in both player menu and developer settings) |
| `src/components/game/PlayerMenu.tsx` | Read setting and conditionally render starfield |

### Settings UI (Controls.tsx)
Add to the "Gameplay Settings" section:
```jsx
<div>
  <Label>Starfield Style</Label>
  <Select value={starfieldStyle} onValueChange={setStarfieldStyle}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="auto">Auto (Default)</SelectItem>
      <SelectItem value="hyperspace">Hyperspace (3D)</SelectItem>
      <SelectItem value="mobile">Radial Burst</SelectItem>
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground mt-1">
    Choose the starfield effect for menus. Hyperspace uses 3D perspective, Radial uses outward burst.
  </p>
</div>
```

### PlayerMenu.tsx Update
Change the starfield rendering logic:
```typescript
// Read starfield preference
const [starfieldStyle] = useState(() => {
  try {
    const saved = localStorage.getItem('ll-starfield-style');
    if (saved === 'hyperspace' || saved === 'mobile') return saved;
  } catch {}
  return 'auto';
});

// Determine which starfield to use
const useHyperspace = 
  starfieldStyle === 'hyperspace' || 
  (starfieldStyle === 'auto' && !isiOS);

// In JSX:
{useHyperspace ? (
  <HyperspaceStarfield ... />
) : (
  <MobileStarfield ... />
)}
```

---

## Implementation Order

1. **GameEngine.tsx**: Add "medley" to the fuel warning mode check (1 line change)
2. **SurvivalEngine.tsx**: Add complete fuel warning logic with shipColor and shipShadowBlur
3. **Controls.tsx**: Add starfield style dropdown with state and localStorage persistence
4. **PlayerMenu.tsx**: Read starfield preference and update conditional rendering

---

## Technical Notes

### Fuel Warning Variables
Both engines need these variables for the warning effect:
- `shipColor`: The current ship outline color (neonColor or #ff0000)
- `shipShadowBlur`: The glow intensity (base value or pulsing 20-40px)
- `fuelPercent`: Current fuel / fuel capacity
- Timing: Use `currentTime` (SurvivalEngine) or `elapsed` (GameEngine)

### Starfield Setting Location
The setting will appear in both Player Menu settings and Developer Menu settings since:
1. It's a visual preference that players may want to adjust
2. It's not a technical/debug setting

### Performance Consideration
The HyperspaceStarfield on iOS may be slightly more CPU-intensive than MobileStarfield, but both are designed to run at 60fps on modern devices. The `lowGraphics` prop on HyperspaceStarfield reduces particle count if needed.
