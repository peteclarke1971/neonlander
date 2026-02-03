
# Plan: Style Points, Leaderboard Fixes, UI Cleanup & Survival Countdown

## Summary

This plan addresses 6 distinct improvements:
1. Enable stunt modes (360/720/1080 spins, near misses) in Time Trial mode
2. Fix leaderboard position numbers to use neon color instead of white
3. Remove leaderboard cycle dots from Player Menu
4. Remove demo level indicator dots from demo mode
5. Alternate fullscreen reminder text between two messages
6. Add 3, 2, 1, GO countdown to Survival mode

---

## 1. Enable Style Points in Time Trial Mode

### Current State
In `GameEngine.tsx` line 2132, style points are only enabled for `classic`, `fixed`, and `medley` modes:
```typescript
if ((mode === "classic" || mode === "fixed" || mode === "medley") && running && !crashed && !playerLockedRef.current)
```

### Solution
Add `timetrial` to the condition:
```typescript
if ((mode === "classic" || mode === "fixed" || mode === "medley" || mode === "timetrial") && running && !crashed && !playerLockedRef.current)
```

This single change enables:
- 360°, 720°, 1080° rotation bonuses
- Near miss detection and scoring
- Associated visual effects (particle bursts, floating score text)

---

## 2. Fix Leaderboard Position Number Colors

### Current State
In `PlayerMenuLeaderboard.tsx` lines 65-68, the position number uses foreground color:
```typescript
<span 
  className="w-5 text-right font-mono opacity-60"
  style={{ color: "hsl(var(--foreground))" }}
>
```

### Solution
Change to use neon color with matching styling:
```typescript
<span 
  className="w-5 text-right font-mono opacity-60"
  style={{ 
    color: "hsl(var(--neon))",
    textShadow: isEmpty ? "none" : "0 0 8px hsl(var(--neon) / 0.5)"
  }}
>
```

---

## 3. Remove Leaderboard Cycle Indicator Dots

### Current State
In `PlayerMenu.tsx` lines 740-753, dots show which leaderboard is active:
```tsx
{/* Cycle indicator dots */}
<div className="flex justify-center gap-2">
  {leaderboardCycle.map((_, i) => (
    <span 
      key={i}
      className="w-2 h-2 rounded-full ..."
    />
  ))}
</div>
```

### Solution
Delete the entire `<div className="flex justify-center gap-2">` block containing the dots.

---

## 4. Remove Demo Level Indicator Dots

### Current State
In `Index.tsx` lines 971-985, dots in the top-right show current demo level:
```tsx
{/* Demo indicators */}
<div className="absolute top-4 right-4 z-50 opacity-70">
  <div className="flex gap-2">
    {demoSequence.map((_, idx) => (
      <div ... />
    ))}
  </div>
</div>
```

### Solution
Delete the entire demo indicators div (lines 971-985).

---

## 5. Alternate Fullscreen Reminder Text

### Current State
In `PlayerMenu.tsx` line 724, the reminder always shows the same text:
```
PILOTS: This simulation is best played FULL SCREEN
```

### Solution
Add a counter ref and alternate between two messages:

1. Add a ref to track which message to show:
```typescript
const fullscreenMessageIndexRef = useRef(0);
```

2. Update the display logic to alternate:
```tsx
const fullscreenMessages = [
  "PILOTS: This simulation is best played FULL SCREEN",
  "ENABLE FULL SCREEN USING THE BUTTON OR THE F11 KEY"
];

// In the render section:
{fullscreenMessages[fullscreenMessageIndexRef.current % 2]}
```

3. Increment the counter each time the reminder is shown (in the interval check):
```typescript
if (timeSinceLast >= requiredTime) {
  setShowFullscreenReminder(true);
  fullscreenMessageIndexRef.current += 1; // Alternate message
  lastReminderTimeRef.current = Date.now();
  ...
}
```

---

## 6. Add 3, 2, 1, GO Countdown to Survival Mode

This is the most complex change, requiring several additions to `SurvivalEngine.tsx`.

### Required Imports
```typescript
import { createCountdownIntro, IntroHandle, mix } from "./intro/CountdownIntro";
import { CountdownOverlay } from "./intro/CountdownOverlay";
```

### State Additions
```typescript
// Countdown intro state
const introRef = useRef<IntroHandle | null>(null);
const [introState, setIntroState] = useState<IntroState>({
  phase: "inactive",
  text: "",
  alpha: 0,
  scale: 1,
  variant: "warp"
});
const [worldPaused, setWorldPaused] = useState(true);
const worldPausedRef = useRef(true);
```

### Initialization in Game Loop Effect
```typescript
// Initialize countdown intro
if (!introRef.current) {
  introRef.current = createCountdownIntro();
  introRef.current.onDone(() => {
    setWorldPaused(false);
    worldPausedRef.current = false;
  });
  // Start with "warp" variant like other modes
  introRef.current.start("warp");
}
```

### Update Intro in Game Loop
```typescript
// Update countdown intro
if (introRef.current) {
  introRef.current.update(dt);
  setIntroState(introRef.current.getCurrentState());
}
```

### Render CountdownOverlay Component
Add to the return JSX, after the canvas but before controls:
```tsx
<CountdownOverlay 
  state={introState} 
  canvasRef={canvasRef}
  lowGraphics={lowGraphics}
  shipPosition={/* ship screen position */}
  shieldColor={/* current neon color */}
  goFillEnabled={/* from localStorage */}
  goColorCycle={/* from localStorage */}
  goColorCycleSpeed={/* from localStorage */}
  goFont={/* from localStorage */}
  goSizeMultiplier={/* from localStorage */}
/>
```

### Block Input During Countdown
Update the game loop to check `worldPausedRef.current` before processing physics and player input.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/game/GameEngine.tsx` | Add `timetrial` to style points condition (line 2132) |
| `src/components/game/PlayerMenuLeaderboard.tsx` | Change position number color to neon (lines 65-68) |
| `src/components/game/PlayerMenu.tsx` | Remove cycle dots (lines 740-753), add alternating fullscreen message |
| `src/pages/Index.tsx` | Remove demo level indicator dots (lines 971-985) |
| `src/components/game/SurvivalEngine.tsx` | Add countdown intro system with CountdownOverlay |

---

## Testing Checklist

1. **Time Trial stunts**: Play Time Trial mode and perform 360° rotation - verify points awarded
2. **Near miss in Time Trial**: Fly close to terrain at speed - verify "NEAR MISS" appears
3. **Leaderboard numbers**: Wait for idle carousel - verify position numbers are neon colored
4. **No leaderboard dots**: Verify no dots appear below the leaderboard display
5. **No demo dots**: Enter demo mode - verify no dots in top-right corner
6. **Alternating fullscreen message**: Wait for fullscreen reminder - verify messages alternate
7. **Survival countdown**: Start Survival mode - verify "3, 2, 1, GO" countdown appears with proper styling
