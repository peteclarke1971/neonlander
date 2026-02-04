
# Plan: Dev Portal Toggle, Invert Rotation Expansion, and Touch Controls Enhancements

## Summary

This plan addresses four main features:
1. Hide Dev Portal button by default, reveal with CTRL+F8 secret key combo
2. Rename "Analog Settings" to "Control Settings" and extend invert rotation to keyboard and d-pad
3. Improve touch control positioning, arrow centering, and add ABORT text styling
4. Add touch control position/size customization sliders in developer settings

---

## Part 1: Dev Portal Hidden by Default with CTRL+F8 Toggle

### Current Behavior
- Dev Portal button is always visible in the Player Menu footer (bottom right)
- Clicking it calls `onDevPortal()` which navigates to the developer home screen

### New Behavior
- Dev Portal button is hidden by default
- Pressing CTRL+F8 anywhere in the Player Menu enables dev mode and shows the button
- State persists for the session (using localStorage key: `ll-dev-portal-enabled`)

### Files to Modify
| File | Change |
|------|--------|
| `src/components/game/PlayerMenu.tsx` | Add `devPortalEnabled` state, add keyboard listener for CTRL+F8, conditionally render Dev Portal button |

### Implementation Details
```typescript
// Add state for dev portal visibility
const [devPortalEnabled, setDevPortalEnabled] = useState(() => {
  try {
    return localStorage.getItem('ll-dev-portal-enabled') === 'true';
  } catch { return false; }
});

// Add keyboard listener in useEffect
useEffect(() => {
  const handleKeyCombo = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'F8') {
      e.preventDefault();
      setDevPortalEnabled(true);
      localStorage.setItem('ll-dev-portal-enabled', 'true');
    }
  };
  window.addEventListener('keydown', handleKeyCombo);
  return () => window.removeEventListener('keydown', handleKeyCombo);
}, []);

// Conditionally render button
{devPortalEnabled && (
  <button onClick={() => onDevPortal()}>Dev Portal</button>
)}
```

---

## Part 2: Rename "Analog Settings" and Extend Invert Rotation

### Current Behavior
- Section header reads "Analog Settings"
- Invert Rotation only affects gamepad analog stick (via `profile.invertRotation`)
- Keyboard left/right and d-pad LB/RB are not inverted

### New Behavior
- Section header reads "Control Settings"
- Invert Rotation applies to:
  - Analog stick rotation (existing)
  - Keyboard A/D and Arrow Left/Right keys
  - D-pad LB/RB buttons on gamepad

### Approach
The invert rotation setting is stored in the gamepad profile object. For keyboard and d-pad, we need to:
1. Store a separate localStorage key for "global" invert rotation: `ll-invert-rotation`
2. Read this in GameEngine.tsx and swap the key assignments when inverted
3. In `use-gamepad.ts`, also swap the `rotateLeft` and `rotateRight` button outputs when inverted

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/Controls.tsx` | Rename section header; add separate localStorage save for invert rotation |
| `src/hooks/use-gamepad.ts` | Swap `rotateLeft` and `rotateRight` in output when `profile.invertRotation` is true |
| `src/components/game/GameEngine.tsx` | Read `ll-invert-rotation` from localStorage and swap keyboard left/right handling |
| `src/components/game/SurvivalEngine.tsx` | Apply same keyboard inversion logic |

### Implementation in GameEngine.tsx
```typescript
// Read invert rotation setting
const invertRotation = useRef(false);
useEffect(() => {
  try {
    invertRotation.current = localStorage.getItem('ll-invert-rotation') === 'true';
  } catch {}
}, [level]); // Re-read on level change

// In keyboard handler, swap keys when inverted
if (["a", "arrowleft"].includes(k)) {
  if (invertRotation.current) {
    keys.current.right = down; // Swapped
  } else {
    keys.current.left = down;
  }
}
```

### Implementation in use-gamepad.ts
```typescript
// At the end of readGamepad, swap LB/RB if inverted
let finalLeft = left;
let finalRight = right;
if (profile.invertRotation) {
  finalLeft = right;
  finalRight = left;
}

return {
  // ...
  buttons: { abort, pause, rotateLeft: finalLeft, rotateRight: finalRight },
};
```

---

## Part 3: Touch Control Visual Improvements

### Current Issues
1. Touch controls positioned too low (bottom-4 = 16px)
2. Arrow symbols (◄ ►) not vertically centered in buttons
3. Abort button says "Abort" instead of "ABORT"
4. Font not explicitly set to Orbitron

### Changes Required

| Issue | Solution |
|-------|----------|
| Position too low | Change `bottom-4` to `bottom-6` or `bottom-8` |
| Arrows not centered | Add explicit flexbox centering and adjust line-height |
| Abort casing | Change "Abort" to "ABORT" |
| Font | Add `font-orbitron` class or inline style |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/game/GameEngine.tsx` | Update touch control div positioning and button styles |
| `src/components/game/SurvivalEngine.tsx` | Apply same changes if touch controls exist there |

### Updated Touch Controls JSX
```jsx
<div className="absolute bottom-8 left-4 right-4 z-20 flex items-end justify-between gap-3 select-none" 
     style={{ opacity: 0.025 + (touchOpacity - 1) * 0.108333 }}>
  <div className="flex gap-2">
    <Button 
      variant="neon" 
      className={`select-none font-['Orbitron'] ${largeRotateButtons ? 'text-5xl px-8 py-9 min-w-[80px] flex items-center justify-center leading-none' : ''}`}
    >
      <span className="select-none flex items-center justify-center">{largeRotateButtons ? '◄' : 'Rotate ◄'}</span>
    </Button>
    {/* ... similar for right button ... */}
    <Button variant="destructive" className="select-none font-['Orbitron'] uppercase">
      <span className="select-none">ABORT</span>
    </Button>
  </div>
</div>
```

---

## Part 4: Touch Control Position/Size Settings (Developer Menu Only)

### New Settings
Add three new sliders in the developer menu (not player menu) for customizing touch controls:

| Setting | localStorage Key | Default | Range |
|---------|-----------------|---------|-------|
| Vertical Offset | `ll-touch-controls-offset-y` | 0 | -50 to 100 (px from base position) |
| Horizontal Offset | `ll-touch-controls-offset-x` | 0 | -100 to 100 (px from base position) |
| Button Scale | `ll-touch-controls-scale` | 1.0 | 0.5 to 2.0 |

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/Controls.tsx` | Add new section "Touch Control Layout" with three sliders (hidden in player menu mode) |
| `src/components/game/GameEngine.tsx` | Read settings from localStorage and apply to touch controls container |
| `src/components/game/SurvivalEngine.tsx` | Apply same settings |

### Settings UI (Controls.tsx)
```jsx
{/* Touch Control Layout - Developer only */}
{!isPlayerMenuMode && (
  <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
    <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Touch Control Layout</h2>
    <div className="grid grid-cols-1 gap-4">
      <div>
        <Label>Vertical Position</Label>
        <div className="flex items-center gap-3">
          <div className="w-56">
            <Slider value={[touchOffsetY]} min={-50} max={100} step={5} 
                    onValueChange={(v) => setTouchOffsetY(v[0])} />
          </div>
          <span className="text-xs text-muted-foreground">{touchOffsetY}px</span>
        </div>
      </div>
      <div>
        <Label>Horizontal Position</Label>
        <div className="flex items-center gap-3">
          <div className="w-56">
            <Slider value={[touchOffsetX]} min={-100} max={100} step={5} 
                    onValueChange={(v) => setTouchOffsetX(v[0])} />
          </div>
          <span className="text-xs text-muted-foreground">{touchOffsetX}px</span>
        </div>
      </div>
      <div>
        <Label>Button Scale</Label>
        <div className="flex items-center gap-3">
          <div className="w-56">
            <Slider value={[touchScale]} min={0.5} max={2.0} step={0.1} 
                    onValueChange={(v) => setTouchScale(v[0])} />
          </div>
          <span className="text-xs text-muted-foreground">{touchScale.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  </div>
)}
```

### Application in GameEngine.tsx
```jsx
// Read settings
const touchOffsetY = useRef(0);
const touchOffsetX = useRef(0);
const touchScale = useRef(1.0);

useEffect(() => {
  try {
    touchOffsetY.current = parseInt(localStorage.getItem('ll-touch-controls-offset-y') || '0');
    touchOffsetX.current = parseInt(localStorage.getItem('ll-touch-controls-offset-x') || '0');
    touchScale.current = parseFloat(localStorage.getItem('ll-touch-controls-scale') || '1.0');
  } catch {}
}, []);

// Apply to container
<div 
  className="absolute z-20 flex items-end justify-between gap-3 select-none"
  style={{ 
    bottom: `${32 + touchOffsetY.current}px`,
    left: `${16 + touchOffsetX.current}px`,
    right: `${16 - touchOffsetX.current}px`,
    transform: `scale(${touchScale.current})`,
    transformOrigin: 'bottom left',
    opacity: 0.025 + (touchOpacity - 1) * 0.108333 
  }}
>
```

---

## Implementation Order

1. **PlayerMenu.tsx**: Add CTRL+F8 dev portal toggle
2. **Controls.tsx**: Rename section, add invert rotation localStorage sync, add touch control sliders
3. **use-gamepad.ts**: Swap LB/RB when inverted
4. **GameEngine.tsx**: Keyboard inversion, touch control styling improvements, position/scale application
5. **SurvivalEngine.tsx**: Apply same changes for consistency

---

## Technical Notes

### Session vs Persistent Storage
- Dev Portal enabled: Uses localStorage for persistence across sessions (secret code stays unlocked)
- Invert Rotation: Syncs to localStorage key `ll-invert-rotation` separate from gamepad profile for cross-device consistency
- Touch control position/scale: localStorage for persistence

### Keyboard Inversion Approach
The keyboard handler currently directly sets `keys.current.left` and `keys.current.right`. With inversion:
- When "A" or "ArrowLeft" is pressed with inversion ON, it sets `keys.current.right = true` instead
- This is the cleanest approach as it happens at the input layer

### D-Pad Button Inversion
In `use-gamepad.ts`, the `rotateLeft` and `rotateRight` buttons are mapped from button indices 4 (LB) and 5 (RB). When `profile.invertRotation` is true, we simply swap the output values before returning.

### Touch Controls Transform Origin
Using `transformOrigin: 'bottom left'` ensures the scale transformation anchors to the bottom-left corner, preventing the controls from shifting unexpectedly when scaled.
