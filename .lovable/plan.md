
# Plan: Optimize GravityDistortionWave Performance

## Summary

The `GravityDistortionWave` component is causing severe frame rate drops on the "Mission Successful" screen due to several expensive operations running every frame. This plan implements major performance optimizations while maintaining the visual appeal of the effect.

---

## Root Cause Analysis

The component has these critical performance bottlenecks:

| Issue | Impact | Location |
|-------|--------|----------|
| **warpBackground loop** | 57,600+ drawImage calls per frame at 1080p | Lines 556-589 |
| **Chromatic aberration** | Creates temp canvas every pulse frame | Lines 698-744 |
| **colorForMode CSS access** | getComputedStyle called multiple times per frame | Lines 201-254 |
| **Gradient creation** | New gradient objects every frame | Lines 535-543, 451-461 |
| **shadowBlur on every stroke** | GPU-intensive glow on every line | Lines 338, 373, 400 |
| **High ring/spoke count** | 32+ rings × 32+ spokes = 1000+ draw calls | Lines 326-420 |

---

## Optimization Strategy

### 1. Remove or Simplify warpBackground

The `warpBackground` function performs tens of thousands of small `drawImage` calls to create a subtle lens distortion. This is extremely GPU/CPU intensive for minimal visual impact.

**Solution:** Either:
- A) Remove warp entirely and keep the grid effect (recommended - most visual impact is from grid)
- B) Use a much larger tile size (24px instead of 6px) reducing calls by 16x

**Implementation (Option B - larger tiles):**
```typescript
// Line 570: Increase minimum tile size significantly
const tile = Math.max(24, Math.floor(Math.min(w, h) / 40)); // Was 6, now minimum 24

// Skip warp on lower-end detection or when fps drops
if (perfRef.current.skipWarp) {
  ctx.drawImage(src, 0, 0);
  return;
}
```

---

### 2. Cache getComputedStyle Result

Currently `colorForMode` calls `getComputedStyle` potentially multiple times per frame.

**Solution:** Cache CSS variables once on component mount and when theme changes.

```typescript
// Add to refs section (around line 140)
const cachedNeonRef = useRef<{ neon: string; neon2: string }>({ neon: "180 100% 55%", neon2: "180 100% 55%" });

// Add useEffect to cache CSS vars
useEffect(() => {
  const updateCache = () => {
    const css = getComputedStyle(document.documentElement);
    cachedNeonRef.current = {
      neon: css.getPropertyValue("--neon").trim() || "180 100% 55%",
      neon2: css.getPropertyValue("--neon-2").trim() || cachedNeonRef.current.neon
    };
  };
  updateCache();
  // Listen for theme changes
  const observer = new MutationObserver(updateCache);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  return () => observer.disconnect();
}, []);

// Update colorForMode to use cache (line 201-254)
const colorForMode = (alphaCore: number, alphaGlow: number, ringOrSpoke?: 'ring' | 'spoke') => {
  const neon = cachedNeonRef.current.neon;  // Use cached value
  const neon2 = cachedNeonRef.current.neon2;
  // ... rest of function
};
```

---

### 3. Reduce Grid Complexity with Performance Governor

Currently the grid density can be up to 60 lines in each direction.

**Solution:** Cap grid density based on FPS and start with lower values.

```typescript
// Update PRESETS (lines 79-113) with lower defaults
Normal: {
  // ... existing
  gridDensity: 24,  // Was 32
},
Storm: {
  // ... existing
  gridDensity: 32,  // Was 42
},

// In Play() method (around line 829), apply stricter limits
p.gridDensity = Math.max(16, Math.min(36, Math.floor(p.gridDensity * (0.85 + rng() * 0.35))));
```

---

### 4. Disable shadowBlur or Use Sparingly

`shadowBlur` is extremely expensive on canvas operations.

**Solution:** Only apply glow to every Nth ring/spoke, or disable during low FPS.

```typescript
// Add performance tracking ref
const perfRef = useRef<{ skipGlow: boolean; skipWarp: boolean; currentFps: number }>({ 
  skipGlow: false, 
  skipWarp: false, 
  currentFps: 60 
});

// In drawGrid (around line 337-338), conditionally apply glow
const shouldGlow = !perfRef.current.skipGlow && i % 3 === 0; // Only every 3rd ring gets glow
if (shouldGlow) {
  ctx.shadowColor = ringColors.core as any;
  ctx.shadowBlur = 8 * p.glow * glowMult;
} else {
  ctx.shadowBlur = 0;
}

// Update autoGovernor to set these flags based on FPS
const autoGovernor = (now: number) => {
  // ... existing fps tracking
  const rate = fps.frames / ((now - fps.last) / 1000);
  perfRef.current.currentFps = rate;
  perfRef.current.skipGlow = rate < 50;
  perfRef.current.skipWarp = rate < 40;
  // ... rest of function
};
```

---

### 5. Remove Chromatic Aberration or Simplify

The chromatic aberration effect creates a temporary canvas every frame during pulses.

**Solution:** Remove this effect entirely or only run it on desktop with high FPS.

```typescript
// In step() function, around lines 682-762, simplify:
// Remove the entire chromatic aberration block and just do:
try {
  warpBackground(ctx, bg, tSec);
} catch {
  failSoftRef.current.warpOff = true;
  ctx.drawImage(bg, 0, 0);
}
```

---

### 6. Batch Draw Operations

Currently each ring and spoke is drawn with separate beginPath/stroke calls.

**Solution:** Batch all rings into a single path, then stroke once.

```typescript
// drawGrid optimization - batch rings
ctx.beginPath();
for (let i = 0; i < grid.rings; i++) {
  const r0 = grid.ringRs[i] + off;
  const hgt = computePhase(r0, tSec);
  const wob = 1 + 0.15 * Math.sin(0.6 * tSec + r0 * 0.003);
  const rr = Math.max(1, (r0 + hgt * 22) * wob);
  ctx.moveTo(rr, 0);
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
}
// Single stroke for all rings
ctx.strokeStyle = ringColors.glow;
ctx.lineWidth = 2;
ctx.stroke();
```

---

### 7. Remove Energy Bursts or Make Optional

The energy burst system creates gradients every frame.

**Solution:** Disable by default or cache gradients.

```typescript
// In Play() method, disable energy bursts by default
p.energyBursts = false; // Was: p.energyBursts !== false
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/GravityDistortionWave.tsx` | All optimizations listed above |

---

## Expected Performance Improvement

| Optimization | Estimated FPS Gain |
|-------------|-------------------|
| Larger warp tiles (24px vs 6px) | +15-25 FPS |
| Cache CSS vars | +2-3 FPS |
| Reduce grid density | +5-10 FPS |
| Selective shadowBlur | +10-15 FPS |
| Remove chromatic aberration | +5-8 FPS |
| Batch draw calls | +3-5 FPS |
| Disable energy bursts | +2-3 FPS |

**Total estimated improvement: 40-70 FPS** (from ~20 FPS to 60+ FPS)

---

## Visual Impact Assessment

| Change | Visual Impact |
|--------|---------------|
| Larger warp tiles | Barely noticeable - warp is subtle |
| Fewer rings/spokes | Slightly less dense grid - still looks good |
| Less glow | Slightly less bloom - retains neon aesthetic |
| No chromatic aberration | Removes minor edge color split during pulses |
| No energy bursts | Removes occasional radial streaks |

The core visual effect (pulsing concentric rings with radiating spokes, rainbow color cycling) remains fully intact. The optimizations primarily remove subtle secondary effects that are expensive but not essential to the visual identity.

---

## Implementation Priority

1. **High Priority (biggest gains):**
   - Increase warp tile size
   - Add skipWarp flag for low FPS
   - Reduce shadowBlur usage

2. **Medium Priority:**
   - Cache CSS variables
   - Remove chromatic aberration
   - Reduce grid density

3. **Low Priority (polish):**
   - Batch draw operations
   - Remove energy bursts
