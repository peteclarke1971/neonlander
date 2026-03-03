
# Fix: Three Visual/Performance Issues

## Issue 1: VectorWormhole Off-Center on Some Resolutions

**Root Cause**: The `wormholeVP` (vanishing point) is calculated based on the `successTitleRef` element's bounding rect position, computing `cx` and `cy` as ratios of `window.innerWidth` / `window.innerHeight`. However, this calculation happens once on gameover view mount and on resize. If the title element hasn't fully laid out yet or the gameover container doesn't match `window` dimensions (e.g., scrollbars, notch insets), the cx/cy values become inaccurate.

Additionally, the `VectorWormhole` component uses `c.clientWidth` / `c.clientHeight` for its canvas but applies `opts.current.cx * w` for the pixel center. If the canvas element doesn't fill the full viewport (CSS sizing mismatch), the center drifts.

**Fix (in `src/pages/Index.tsx`)**:
- Simplify the vanishing point to always use `{ cx: 0.5, cy: 0.5 }` as the default, only adjusting if the title ref is reliably measured.
- Add a `ResizeObserver` on the container to re-measure more reliably.
- Clamp cx/cy to a tighter range around center (0.35-0.65) to prevent extreme off-center positions.

**Fix (in `src/components/game/VectorWormhole.tsx`)**:
- Ensure the canvas resize logic accounts for DPR correctly and that `clientWidth`/`clientHeight` matches the actual visible area. The canvas currently sets its pixel dimensions via `c.width = w * dpr` but then uses `c.clientWidth` for drawing calculations -- ensure these stay in sync by using the parent element dimensions as the source of truth (matching the starfield pattern).

## Issue 2: Survival Mode Explosion Slowdown at 4K

**Root Cause**: In `SurvivalEngine.tsx`, the `spawnExplosion` function creates 120-180 primary particles, then 80-120 secondary particles after 100ms, plus 40-60 sparks. That's up to 360 particles, each drawn with `fillRect` and `globalCompositeOperation: "lighter"`. The debris system adds another 80-120 pieces with rotation transforms. At 4K resolution, the canvas is 4x the pixel count, making every draw call more expensive. Combined with shockwave rings, flash effects, and camera shake, this creates a frame budget spike.

**Fix (in `src/components/game/SurvivalEngine.tsx`)**:
- Scale particle counts based on canvas resolution. At 4K (width > 2500), reduce counts by ~40%:
  - Primary: cap at 80 (from 120-180)
  - Secondary: cap at 50 (from 80-120)  
  - Sparks: cap at 25 (from 40-60)
  - Debris: cap at 50 (from 80-120)
- Keep particle velocities and colors identical so the visual "feel" stays the same -- fewer particles at higher speed still looks dramatic.
- Reduce shockwave ring count from 3-5 to max 2 at 4K.
- The `shouldOptimize` flag already handles low-graphics mode (12 particles); add a middle tier for high-res displays.

## Issue 3: Jerky Level Transition (Hyperspace Jump)

**Root Cause**: The `GameTransition` component uses `setProgress(newProgress)` via React state updates on every `requestAnimationFrame`. This triggers a React re-render on every frame, which is unnecessary and causes micro-stutters. The opacity is also derived from this React state. The hyperspace effect itself (HyperspaceStarfield) renders fine via its own canvas loop, but the containing div's opacity flickers due to state-driven rendering.

Additionally, the transition has a total duration of only 3000ms (200ms fade-out + 2600ms effect + 200ms fade-in) with `setPhase` state changes at each boundary, causing momentary freezes during React reconciliation.

**Fix (rewrite the transition animation in `src/components/game/GameTransition.tsx`)**:
- Replace `setProgress` React state with a ref (`progressRef`) and use direct DOM manipulation (`containerRef.current.style.opacity = ...`) to avoid re-renders during animation.
- Use a single `requestAnimationFrame` loop for the entire transition lifecycle (fade-out -> effect -> fade-in) instead of separate `setTimeout` + `useEffect` chains per phase. Track all timing in refs.
- Smooth the speed ramp on HyperspaceStarfield: instead of jumping from 0.1 to 2.0 at the effect phase start, use a gradual easing curve that accelerates over the first 60% of the effect duration.
- Increase the effect duration slightly from 2600ms to 3200ms for a less rushed feel.
- Remove all `setProgress` and `setPhase` calls from the animation loop. Only call `setCurrentTransition(null)` and `setPhase("complete")` once when fully done.

## Technical Summary

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Tighten wormholeVP clamping, add fallback to (0.5, 0.5) |
| `src/components/game/VectorWormhole.tsx` | Use parent element dimensions for canvas sizing |
| `src/components/game/SurvivalEngine.tsx` | Add resolution-aware particle scaling in `spawnExplosion` and `spawnDebris` |
| `src/components/game/GameTransition.tsx` | Replace state-driven animation with ref-based RAF loop, smooth speed ramp |
