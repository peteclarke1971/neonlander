
# Plan: Countdown Display Customization (3, 2, 1, GO)

## Summary

The user wants to:
1. Make the countdown 33% smaller and position it higher (above the lander)
2. Change the cyan outline to match the level's neon color
3. Add new settings in Controls page for customizing the countdown appearance

## Current Implementation Analysis

**CountdownOverlay.tsx** (lines 98-161):
- Current size: `minDim * 0.24` (24% of viewport)
- Current position: Centered at ship position or screen center
- Current colors: Cyan outline (`#00ffff`), white fill (`#ffffff`)
- Current font: `monospace`

## Changes Required

### 1. CountdownOverlay.tsx - Core Visual Changes

**Size reduction (33% smaller):**
- Change `baseSize` from `minDim * 0.24` to `minDim * 0.16` (0.24 * 0.67 = 0.16)
- Apply a size multiplier from settings (localStorage `ll-go-size-multiplier`)

**Position adjustment (higher, above lander):**
- Add Y offset: `targetY - baseSize * 0.8` to position text above the ship
- This creates vertical separation between the countdown and the lander

**Outline color (match level neon):**
- Replace hardcoded `#00ffff` with the `shieldColor` prop (already passed to component)
- Use the extracted hue to create HSL stroke color

**Fill color options (from settings):**
- Read `ll-go-fill-enabled` from localStorage
- If enabled: fill = neon color
- If disabled: fill = black

**Color cycling:**
- Read `ll-go-color-cycle` from localStorage
- If enabled: cycle fill through neon hues based on `performance.now()`
- Read `ll-go-color-cycle-speed` for cycle rate (1-10 range, default 5)

**Font selection:**
- Read `ll-go-font` from localStorage
- Options: `Orbitron`, `monospace`, `sans-serif`, `serif`
- Default: `Orbitron` (matches PlayerMenu and game UI)

### 2. Controls.tsx - New Settings Section

Add a new "Countdown Display Settings" section with:

```
┌──────────────────────────────────────────────────────────┐
│ COUNTDOWN DISPLAY (3, 2, 1, GO)                          │
├──────────────────────────────────────────────────────────┤
│ GO Fill                                          [ON/OFF]│
│ ↳ Fill with level neon color (OFF = black fill)         │
├──────────────────────────────────────────────────────────┤
│ GO Color Cycle                                   [ON/OFF]│
│ ↳ Cycle through all neon colors                          │
│                                                          │
│   (if Color Cycle is ON:)                                │
│   Color Cycle Speed: ████████░░  [slider 1-10]           │
├──────────────────────────────────────────────────────────┤
│ GO Font:                              [Dropdown]         │
│ ↳ Orbitron / Monospace / Sans-serif / Serif             │
├──────────────────────────────────────────────────────────┤
│ GO Size:                              [slider 0.33-3.0]  │
│ ↳ Adjust countdown text size                             │
└──────────────────────────────────────────────────────────┘
```

### 3. New Props for CountdownOverlay

Add new props to pass settings:

```typescript
interface CountdownOverlayProps {
  state: IntroState;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  lowGraphics?: boolean;
  photosensitive?: boolean;
  shipPosition?: { x: number; y: number };
  shieldColor?: string;
  // New props for customization:
  goFillEnabled?: boolean;
  goColorCycle?: boolean;
  goColorCycleSpeed?: number;
  goFont?: string;
  goSizeMultiplier?: number;
}
```

### 4. GameEngine.tsx Updates

Pass the new settings to CountdownOverlay:
- Read settings from localStorage
- Pass as props to CountdownOverlay component

---

## Technical Details

### localStorage Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ll-go-fill-enabled` | boolean | false | Use neon color for fill (vs black) |
| `ll-go-color-cycle` | boolean | false | Enable color cycling |
| `ll-go-color-cycle-speed` | number | 5 | Speed 1-10 (higher = faster) |
| `ll-go-font` | string | "Orbitron" | Font family name |
| `ll-go-size-multiplier` | number | 1.0 | Size multiplier (0.33 to 3.0) |

### Color Cycling Algorithm

```typescript
// Neon colors array (same as game uses)
const NEON_HUES = [330, 50, 140, 270, 25, 0]; // pink, yellow, green, purple, orange, red

// Calculate current hue based on time
const cycleSpeed = goColorCycleSpeed || 5;
const cycleProgress = (performance.now() / 1000) * cycleSpeed * 0.5;
const hueIndex = Math.floor(cycleProgress) % NEON_HUES.length;
const nextHueIndex = (hueIndex + 1) % NEON_HUES.length;
const t = cycleProgress % 1;

// Lerp between hues
const currentHue = NEON_HUES[hueIndex] + (NEON_HUES[nextHueIndex] - NEON_HUES[hueIndex]) * t;
const fillColor = `hsl(${currentHue}, 100%, 55%)`;
```

### Font Options

| Value | Display Name | Description |
|-------|--------------|-------------|
| `"Orbitron", sans-serif` | Orbitron | Default - matches game UI |
| `monospace` | Monospace | Classic arcade style |
| `"Arial", sans-serif` | Sans-serif | Clean modern look |
| `"Times New Roman", serif` | Serif | Traditional style |

### Size Calculation

```typescript
// Base size with 33% reduction
const baseSize = minDim * 0.16;

// Apply user multiplier (0.33 to 3.0)
const finalSize = baseSize * (goSizeMultiplier || 1.0);

// Position above lander
const yOffset = finalSize * 0.8;
const displayY = targetY - yOffset;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/game/intro/CountdownOverlay.tsx` | Size, position, colors, font, cycling logic |
| `src/pages/Controls.tsx` | New "Countdown Display" settings section |
| `src/components/game/GameEngine.tsx` | Read settings, pass to CountdownOverlay |
| `src/components/game/PlayerMenu.tsx` | Add defaults for new settings in initializeDefaultSettings() |

---

## Implementation Order

1. **Controls.tsx**: Add new settings UI section with state and localStorage persistence
2. **PlayerMenu.tsx**: Add default settings initialization
3. **CountdownOverlay.tsx**: Accept new props, implement visual changes
4. **GameEngine.tsx**: Read settings from localStorage, pass to CountdownOverlay

---

## Testing Checklist

1. Verify countdown appears 33% smaller and positioned above the lander
2. Verify outline matches level neon color
3. Toggle GO Fill ON - verify fill is neon color
4. Toggle GO Fill OFF - verify fill is black
5. Toggle GO Color Cycle ON - verify smooth color cycling
6. Adjust Color Cycle Speed slider - verify speed changes
7. Change GO Font dropdown - verify font changes
8. Adjust GO Size slider - verify size scales correctly (0.33x to 3x)
9. Settings persist after page reload
