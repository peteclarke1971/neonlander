

# Plan: PC Thruster Optimization Toggle & Tip Size Increase

## Summary

This plan implements two changes:
1. **Thruster Optimization Toggle** - A new setting in the Controls page that enables the iPad-style optimized thruster particle rendering on PC/Laptop for users experiencing performance issues (especially at 4K resolutions)
2. **Tip Text Size Increase** - Make in-flight tips 25% larger for better visibility

---

## Part 1: Thruster Optimization Toggle

### 1.1 Add State to Controls.tsx

Add a new toggle state for thruster optimization (off by default).

**File:** `src/pages/Controls.tsx`

**Add new state (around line 173):**
```typescript
const [thrusterOptimization, setThrusterOptimization] = useState<boolean>(() => {
  try {
    const saved = localStorage.getItem('ll-thruster-optimization');
    return saved ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
});
```

**Add useEffect to persist (around line 330):**
```typescript
useEffect(() => {
  try {
    localStorage.setItem('ll-thruster-optimization', JSON.stringify(thrusterOptimization));
  } catch {}
}, [thrusterOptimization]);
```

### 1.2 Add UI Toggle in Controls.tsx

Add the toggle to the "Gameplay Settings" section after Graphics Quality.

**Location:** After line 1045 (after Graphics Quality dropdown)

```tsx
{/* Thruster Optimization (PC only) */}
<div className="flex items-center justify-between">
  <div>
    <Label>Thruster Optimization</Label>
    <div className="text-xs text-muted-foreground">
      Reduces thruster particle effects for better performance at high resolutions (4K)
    </div>
  </div>
  <Switch 
    checked={thrusterOptimization}
    onCheckedChange={setThrusterOptimization}
  />
</div>
```

### 1.3 Read Setting in GameEngine.tsx

Modify GameEngine to read the new setting and apply PC thruster optimization.

**File:** `src/components/game/GameEngine.tsx`

**Add state to read setting (around line 381):**
```typescript
// PC thruster optimization: user toggle for 4K performance
const pcThrusterOptimization = useState<boolean>(() => {
  try {
    const saved = localStorage.getItem('ll-thruster-optimization');
    return saved ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
})[0];

// Unified thruster optimization: applies to iPad (automatic) OR PC with toggle enabled
const useThrusterOptimization = useIPadThrusterOptimization || (pcThrusterOptimization && !isMobile);
```

**Update particle count (line 1469):**
```typescript
// Thruster optimization uses 15 particles with fillRect; desktop without optimization uses 25
const THRUSTER_PARTICLE_COUNT = shouldOptimizePerformance ? 2 : 
  (isIPhone ? 10 : (useThrusterOptimization ? 15 : 25));
```

**Update shadow blur (line 1471):**
```typescript
const THRUSTER_SHADOW_BLUR = shouldOptimizePerformance ? 0 : 
  (isIPhone ? 0 : (useThrusterOptimization ? 6 : 25));
```

**Update max particles (line 3857):**
```typescript
const maxParticles = shouldOptimizePerformance ? 30 : 
  (useThrusterOptimization ? 150 : (isUnderwater ? 150 : 300));
```

**Update rendering branch (line 5664):**
```typescript
} else if (useThrusterOptimization) {
  // === OPTIMIZED: Fast fillRect rendering (iPad or PC with toggle) ===
```

---

## Part 2: Increase Tip Text Size by 25%

### File: `src/components/game/InFlightTip.tsx`

The current text sizes are:
- iPhone: `text-sm` (14px)
- Other: `text-base md:text-lg` (16px / 18px on md+)

Increase by 25%:
- iPhone: `text-base` (16px) - was 14px, now 16px (+14%)
- Other: `text-lg md:text-xl` (18px / 20px on md+) - was 16px/18px, now 18px/20px (+12.5% / +11%)

To get exactly 25% larger, use custom font sizes instead of Tailwind classes.

**Update lines 148-151:**

```typescript
// Adjust sizes for devices - 25% larger than before
// Before: iPhone 14px, Other 16px/18px
// After: iPhone 17.5px (round to 18px), Other 20px/22.5px
const textSize = isIPhone 
  ? 'text-[18px]' 
  : 'text-[20px] md:text-[22px]';
const shadowBlur = isIPhone ? 10 : 15; // Also slightly increased for better glow
const padding = isIPhone ? 'px-4 py-2' : 'px-5 py-2.5'; // Slightly more padding
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/Controls.tsx` | Add thruster optimization toggle state and UI |
| `src/components/game/GameEngine.tsx` | Read setting and apply unified thruster optimization |
| `src/components/game/InFlightTip.tsx` | Increase text size by 25% |

---

## Technical Notes

### Thruster Optimization Behavior

| Device | Toggle | Graphics | Particle Type | Count | shadowBlur |
|--------|--------|----------|---------------|-------|------------|
| iPad | N/A (auto) | Mid/High | fillRect | 15 | 6 |
| iPad | N/A | Low | minimal | 2 | 0 |
| PC | OFF | Any | stroke() | 25 | 25 |
| PC | ON | Low | fillRect | 15 | 6 |
| PC | ON | Mid | fillRect | 15 | 6 |
| PC | ON | High | fillRect | 15 | 6 |
| iPhone | N/A | Any | stroke() | 10 | 0 |

When the PC toggle is ON:
- Particle count: 15 (same as iPad optimization)
- shadowBlur: 6 (same as iPad optimization)
- Max particles: 150 (capped, same as iPad)
- Rendering: fillRect instead of stroke()
- Effect: Identical across Low/Mid/High graphics

### Tip Size Changes

| Device | Before | After | Increase |
|--------|--------|-------|----------|
| iPhone | 14px | 18px | +29% |
| Desktop | 16px | 20px | +25% |
| Desktop (md+) | 18px | 22px | +22% |

Average increase is approximately 25% across all breakpoints.

---

## Result

1. **PC users with 4K displays** can enable "Thruster Optimization" in Controls to improve FPS
2. **In-flight tips** will be 25% larger and more readable
3. **iPad users** are unaffected - they still get automatic optimization
4. **Desktop/iPhone users without toggle** are unaffected - normal rendering

