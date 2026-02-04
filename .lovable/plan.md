# Plan: iPad Touch Controls Auto-Hide, Restricted Player Menu Settings, and Auto-Detect Graphics

## Status: ✅ COMPLETED

## Summary

Three interconnected features:
1. Auto-hide touch controls on iPad when keyboard/gamepad input is detected (per-session)
2. Create a restricted settings view when accessed from Player Menu
3. Add an "AUTO DETECT BEST GRAPHICS" button with performance benchmarking

---

## Part 1: iPad Touch Controls Auto-Hide

### Current Behavior
- Line 6376 in GameEngine.tsx: `(!isUsingPCControls || isIPad)` always shows touch controls on iPad
- Keyboard/gamepad detection already sets `isUsingPCControls = true` but it's ignored for iPad

### Solution
Remove the `|| isIPad` override and rely on the existing `isUsingPCControls` state. iPad will:
- Default to showing touch controls (already does via `isIPadDevice() ? false : ...` at line 265-268)
- Hide touch controls when keyboard or gamepad input is detected
- Stay hidden for that game session (but not persisted - user's preference in localStorage remains unchanged)

### Files to Modify
| File | Change |
|------|--------|
| `src/components/game/GameEngine.tsx` | Remove `\|\| isIPad` from touch controls visibility condition (line 6376) |
| `src/components/game/SurvivalEngine.tsx` | Apply same fix (search for similar pattern) |

---

## Part 2: Restricted Player Menu Settings

### Approach
Create a query parameter system to filter the Controls page based on origin:
- When accessed from Player Menu: Show only the player-focused subset
- When accessed from Developer Menu: Show full settings

### Settings to Include in Player Menu View
| Setting | Section |
|---------|---------|
| Invert Rotation | Analog Settings |
| Vibration | Analog Settings |
| Auto-Hide Cursor | Mouse & Cursor |
| Idle Time | Mouse & Cursor |
| Full HUD | Gameplay Settings |
| Show FPS | Gameplay Settings |
| Liquid Fuel Display | Gameplay Settings |
| Mute Music | Gameplay Settings |
| Touch Screen Translucency (+ Opacity Slider) | Gameplay Settings |
| CRT Scanlines (+ all sub-options) | Gameplay Settings |
| Graphics Quality | Gameplay Settings |
| Thruster Optimization | Gameplay Settings |
| All Remap Controls | Remap Controls section |
| Clear Local Data | Clear Local Data section |

### Settings to HIDE from Player Menu View
- Deadzone slider
- Invert Thrust
- Mouse Lock
- Rotation Boost (disabled anyway)
- Rotation Multiplier (disabled anyway)
- Moving Pads
- Large Buttons
- Terrain-Masked Fireworks
- Countdown Display (GO) settings (all sub-options)
- All UFO configuration (Small/Medium/Large UFO sections)
- Music Testing section
- Sound Effects Testing section

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/Controls.tsx` | Add `isPlayerMenuMode` state based on `ll-settings-origin`, conditionally render sections |

---

## Part 3: Auto Detect Best Graphics Button

### Performance Benchmark Approach
Run a simple canvas rendering benchmark to measure device capability:

1. **Test Method**: Render 100 frames of particle effects with varying complexity
2. **Metrics**: Average frame time (ms per frame)
3. **Thresholds**:
   - < 8ms average → HIGH graphics
   - 8-16ms average → MID graphics  
   - > 16ms average → LOW graphics

### Implementation
```text
┌────────────────────────────────────────────────────┐
│  AUTO DETECT BEST GRAPHICS                         │
│  ┌──────────────────────────────────────────────┐  │
│  │  [AUTO DETECT BEST GRAPHICS]  ← Button       │  │
│  │                                              │  │
│  │  Runs a quick benchmark to determine the    │  │
│  │  optimal graphics setting for your device   │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  When clicked:                                     │
│  1. Show "Testing..." state with spinner          │
│  2. Run ~1 second benchmark                       │
│  3. Set graphics level based on result            │
│  4. Show result: "Detected: HIGH" (or MID/LOW)    │
└────────────────────────────────────────────────────┘
```

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/Controls.tsx` | Add `runGraphicsBenchmark()` function and button (only visible in Player Menu mode) |
| `src/lib/graphicsConfig.ts` | Add `detectOptimalGraphics()` benchmark function |

---

## Part 4: Default Settings Reference

Here is the complete list of current default settings for first-time players:

| Setting | localStorage Key | Default Value |
|---------|-----------------|---------------|
| Large Buttons | `ll-large-rotate-buttons` | `true` (ON) |
| Full HUD | `ll-show-full-hud` | `false` (OFF) |
| Liquid Fuel Display | `ll-liquid-fuel-enabled` | `true` (ON) |
| Show FPS | `ll-show-fps` | `false` (OFF) |
| Terrain Masked Fireworks | `ll-terrain-masked-fireworks` | `true` (ON) |
| Graphics Quality | `ll-graphics-level` | `"mid"` (Medium) |
| GO Fill | `ll-go-fill-enabled` | `"false"` (OFF) |
| GO Color Cycle | `ll-go-color-cycle` | `"false"` (OFF) |
| GO Color Cycle Speed | `ll-go-color-cycle-speed` | `"5"` |
| GO Font | `ll-go-font` | `"Orbitron", sans-serif` |
| GO Size Multiplier | `ll-go-size-multiplier` | `"1"` (1x) |

### Other Settings (not initialized by defaults, use code fallbacks)
| Setting | Default Fallback |
|---------|------------------|
| Scanlines | `false` (OFF) |
| Scanline Spacing | `2` |
| Scanline Opacity | `0.15` |
| Scanline Intensity | `0.5` |
| Scanline Blend Mode | `"multiply"` |
| Touch Opacity | `10` (full) |
| Music Muted | `false` (OFF) |
| Small UFO Enabled | `true` (ON) |
| Small/Medium/Large UFO Difficulty | `1` |
| Thruster Optimization | `false` (OFF) |
| Invert Rotation | `false` (OFF) |
| Vibration | `true` (ON) |
| Deadzone | `0.12` |
| Auto-Hide Cursor | `true` (ON) |
| Cursor Idle Time | `2000ms` |

---

## Implementation Order

1. **GameEngine.tsx + SurvivalEngine.tsx**: Fix iPad touch controls auto-hide
2. **Controls.tsx**: Add `isPlayerMenuMode` state and conditional rendering
3. **graphicsConfig.ts**: Add benchmark function
4. **Controls.tsx**: Add Auto Detect button (only in Player Menu mode)

---

## Technical Notes

### Session-Only Touch Hide for iPad
The key insight is that we want the touch controls to HIDE when PC controls are detected during gameplay, but NOT persist this preference. The existing code already handles this:
- `isUsingPCControls` is React state (session-only)
- `setPCControlsPreference(true)` saves to localStorage (persistent)

For iPad, we need to:
1. Remove the `|| isIPad` override that forces controls visible
2. Keep the default `isUsingPCControls = false` for iPad
3. Let keyboard/gamepad detection set it to `true` during the session

### Player Menu Settings Detection
```typescript
const [isPlayerMenuMode] = useState(() => {
  try {
    return localStorage.getItem('ll-settings-origin') === 'playermenu';
  } catch {
    return false;
  }
});
```

### Graphics Benchmark Algorithm
```typescript
function detectOptimalGraphics(): Promise<GraphicsLevel> {
  // Create offscreen canvas
  // Render 100 frames of particles with shadowBlur, gradients, etc.
  // Measure average frame time
  // Return "low" | "mid" | "high" based on thresholds
}
```
