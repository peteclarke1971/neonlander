

# Plan: Guide System Comprehensive Updates

## Summary

This plan implements multiple changes across the GUIDE popup pages:
1. **Controls Page** - Update controls text, remove lander animation, adjust gamepad text size
2. **Landing Page** - Replace "GREEN PADS = SAFE" with animated pulsing pad graphic, remove "Orange pads" text
3. **Fuel & Shields Page** - Remove lander graphic, update fuel text
4. **Remove Space Junk Page** - Delete from PAGES array
5. **Hazards Page** - Remove emoji graphics
6. **Survival Page** - Update comet text
7. **Navigation** - Confirm left/right arrow and gamepad navigation works
8. **Styling** - Apply NEON color to all text and key borders

---

## Part 1: Controls Page Updates

### File: `src/components/game/guide/GuidePageControls.tsx`

**Changes:**

1. **Remove lander animation** - Delete the `<LanderAnimation>` component at the top
2. **THRUST row** - Remove `/ Space` from the controls
3. **ABORT row** - Change label to `ABORT (STABILIZE SHIP)` and change instruction to show down arrow + `/ SPACE for emergency brake`
4. **Gamepad note** - Change from `text-xs` to `text-sm` to match other text size

**Updated structure:**
```tsx
// Remove this:
<div className="flex justify-center">
  <LanderAnimation showThrust showRotation size={100} />
</div>

// THRUST: W / ↑ (no Space)
// ABORT (STABILIZE SHIP): ↓ / SPACE for emergency brake
// Gamepad text: text-sm instead of text-xs
```

---

## Part 2: Landing Page Updates

### File: `src/components/game/guide/GuidePageLanding.tsx`

**Changes:**

1. **Replace "GREEN PADS = SAFE" box** with an animated canvas showing a pulsing green landing pad
2. **Remove "Orange pads" text** from the 2× PAD bonus box

**New component: PulsingPadAnimation**

Create a small canvas component that renders a pulsing green landing pad, similar to how pads are rendered in the game:

```tsx
// Pulsing pad animation - uses same pulse formula as game
// pulse = 1 + 0.6 * Math.sin(elapsed * 4)
// Green color with glow effect
```

**Updated 2× PAD box:**
```tsx
<div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
  <span style={{ color: 'hsl(30, 100%, 55%)' }}>2× PAD</span>
  <span className="opacity-70">Double points</span>
  {/* Remove: <span className="opacity-50">Orange pads</span> */}
</div>
```

---

## Part 3: Fuel & Shields Page Updates

### File: `src/components/game/guide/GuidePageFuelShields.tsx`

**Changes:**

1. **Remove lander/shield animation** at the top
2. **Update fuel text** on line 28: "Landing on pads gives fuel boost in time trial and survival modes"
3. **Update space junk text** on line 32: "Collect Space Junk for fuel boost"

---

## Part 4: Remove Space Junk Page

### File: `src/components/game/GuidePopup.tsx`

**Changes:**

1. Remove the import for `GuidePageJunk`
2. Remove the 'junk' entry from the PAGES array

**Updated PAGES array:**
```tsx
const PAGES = [
  { id: 'controls', title: 'CONTROLS', Component: GuidePageControls },
  { id: 'landing', title: 'LANDING', Component: GuidePageLanding },
  { id: 'fuel', title: 'FUEL & SHIELDS', Component: GuidePageFuelShields },
  // REMOVED: { id: 'junk', title: 'SPACE JUNK', Component: GuidePageJunk },
  { id: 'hazards', title: 'HAZARDS', Component: GuidePageHazards },
  { id: 'scoring', title: 'SCORING', Component: GuidePageScoring },
  { id: 'modes', title: 'GAME MODES', Component: GuidePageModes },
  { id: 'survival', title: 'SURVIVAL', Component: GuidePageSurvival },
];
```

This reduces pages from 8 to 7.

---

## Part 5: Hazards Page Updates

### File: `src/components/game/guide/GuidePageHazards.tsx`

**Changes:**

Remove the emoji graphics (🌋, 🕳️, ⚡, 🛸) from above each hazard title.

**Before:**
```tsx
<div className="text-2xl mb-1">🌋</div>
<div className="font-bold text-sm" style={{ color: 'hsl(15, 100%, 55%)' }}>
  VOLCANOES
</div>
```

**After:**
```tsx
<div className="font-bold text-sm" style={{ color: 'hsl(15, 100%, 55%)' }}>
  VOLCANOES
</div>
```

Remove all four emoji divs (lines 16, 42, 68, 94).

---

## Part 6: Survival Page Updates

### File: `src/components/game/guide/GuidePageSurvival.tsx`

**Changes:**

Update the COMETS text (currently "Catch for bonus points!") to "Land when active for bonus"

**Line 62:**
```tsx
<div className="opacity-70 mt-1">Land when active for bonus</div>
```

---

## Part 7: Navigation Verification

The guide already supports left/right arrow keys and gamepad navigation. This is implemented in `GuidePopup.tsx`:

**Keyboard (lines 68-78):**
```typescript
if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
  goToPrevPage();
} else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
  goToNextPage();
}
```

**Gamepad (lines 112-122):**
```typescript
// D-pad left/right for page navigation
if (input.ui.left && !prev.left && canFire('left')) {
  goToPrevPage();
  vibrate(30, 0.15, 0.3);
}
if (input.ui.right && !prev.right && canFire('right')) {
  goToNextPage();
  vibrate(30, 0.15, 0.3);
}
```

No changes needed - this already works as requested.

---

## Part 8: NEON Color Styling

### Files: All guide page components

**Changes across all pages:**

1. Change all white text (`color: 'hsl(var(--foreground) / 0.9)'`) to NEON (`color: 'hsl(var(--neon))'`)
2. Change specific colored text (yellows, greens, etc.) to NEON
3. Change key border colors from various colors to NEON

**Specific files and updates:**

**GuidePageControls.tsx:**
- Line 15: Text color from `foreground` to `neon`
- Line 58: BOOST color from `hsl(180, 100%, 50%)` to `neon`
- Line 76: ABORT color from `hsl(0, 100%, 65%)` to `neon`
- Gamepad note: color to `neon` and remove `opacity-60`

**GuidePageLanding.tsx:**
- Line 13: Text color from `foreground` to `neon`
- Lines 22, 26: Border colors to `neon`
- Lines 23, 27: Checkmark colors from green to `neon`
- Lines 52, 64, 69, 74: Section title and item colors to `neon`
- Box backgrounds: Keep with neon-based styling

**GuidePageFuelShields.tsx:**
- Line 21: Text color from `foreground` to `neon`
- All section headers and icons: Change to `neon`
- Shield section border: Change to `neon`

**GuidePageHazards.tsx:**
- All hazard titles: Change to `neon`
- All borders: Change to `neon`
- UFO types section: Change to `neon`

**GuidePageSurvival.tsx:**
- Main title and headers: Change to `neon`
- Feature icons and borders: Change to `neon`
- Special zone borders: Change to `neon`

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/guide/GuidePageControls.tsx` | Remove lander, fix THRUST/ABORT, fix gamepad text size, apply NEON colors |
| `src/components/game/guide/GuidePageLanding.tsx` | Add pulsing pad canvas, remove "Orange pads", apply NEON colors |
| `src/components/game/guide/GuidePageFuelShields.tsx` | Remove lander, update fuel text, apply NEON colors |
| `src/components/game/GuidePopup.tsx` | Remove Space Junk page from PAGES array |
| `src/components/game/guide/GuidePageHazards.tsx` | Remove emojis, apply NEON colors |
| `src/components/game/guide/GuidePageSurvival.tsx` | Update comet text, apply NEON colors |

---

## Technical Details

### Pulsing Pad Animation Component

```tsx
const PulsingPadCanvas: React.FC<{ size?: number }> = ({ size = 60 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = 30 * dpr;
    ctx.scale(dpr, dpr);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      
      ctx.clearRect(0, 0, size, 30);
      
      // Pulse formula from GameEngine: 1 + 0.6 * Math.sin(elapsed * 4)
      const pulse = 1 + 0.6 * Math.sin(elapsed * 4);
      const padWidth = size * 0.8;
      const padX = (size - padWidth) / 2;
      
      // Outer glow
      ctx.beginPath();
      ctx.moveTo(padX, 15);
      ctx.lineTo(padX + padWidth, 15);
      ctx.strokeStyle = 'hsl(120, 100%, 50%)';
      ctx.lineWidth = 6 * pulse;
      ctx.shadowColor = 'hsl(120, 100%, 50%)';
      ctx.shadowBlur = 20 * pulse;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      
      // Core line
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.stroke();
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [size]);

  return <canvas ref={canvasRef} style={{ width: size, height: 30 }} />;
};
```

---

## Result After Changes

| Page | Before | After |
|------|--------|-------|
| CONTROLS | Lander animation, Space in THRUST, wrong ABORT text, small gamepad text | No lander, THRUST: W / ↑, ABORT (STABILIZE SHIP): ↓ / SPACE for emergency brake, larger gamepad text |
| LANDING | "GREEN PADS = SAFE" text, "Orange pads" shown | Animated pulsing green pad, no "Orange pads" |
| FUEL & SHIELDS | Lander animation, old fuel text | No lander, updated fuel text |
| SPACE JUNK | Entire page exists | Page removed entirely |
| HAZARDS | Emoji graphics above each hazard | No emojis |
| SURVIVAL | "Catch for bonus points!" | "Land when active for bonus" |
| All pages | Mixed colors (green, yellow, cyan, etc.) | NEON color theme throughout |
| Navigation | Already working | Confirmed working (no changes needed) |

