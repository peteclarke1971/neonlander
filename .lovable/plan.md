

# Add "Show FPS" Toggle Implementation Plan

## Overview
Add a new toggle in Settings (Controls page) that allows users to show FPS independently of the main HUD visibility. When enabled, FPS will display in the bottom-right corner across all game modes including Survival, even when the "Full HUD" toggle is off.

---

## Current Behavior
- **GameEngine**: FPS is displayed when `showFullHUD` is true (line 6010-6016)
- **SurvivalEngine**: FPS is always displayed (lines 3474-3481), independent of HUD setting
- Both engines already calculate FPS and have the `fps` state variable

---

## Implementation

### 1. Add Setting State in Controls.tsx

**Location**: After `liquidFuelEnabled` state declaration (~line 46)

Add new state:
```typescript
const [showFPS, setShowFPS] = useState<boolean>(() => {
  try {
    const saved = localStorage.getItem('ll-show-fps');
    return saved ? JSON.parse(saved) : true; // Default to true
  } catch {
    return true;
  }
});
```

Add corresponding useEffect to persist (~after line 212):
```typescript
useEffect(() => {
  try {
    localStorage.setItem('ll-show-fps', JSON.stringify(showFPS));
  } catch {}
}, [showFPS]);
```

---

### 2. Add UI Toggle in Controls.tsx

**Location**: After the "Full HUD" toggle (~line 752), add a new toggle:

```tsx
<div className="flex items-center justify-between">
  <div>
    <Label>Show FPS</Label>
    <div className="text-xs text-muted-foreground">Display FPS counter in bottom-right (visible even when HUD is hidden)</div>
  </div>
  <Switch 
    checked={showFPS}
    onCheckedChange={setShowFPS}
  />
</div>
```

---

### 3. Update GameEngine.tsx

**Add showFPS prop** to Props interface (~line 92-110):
```typescript
showFPS?: boolean;
```

**Read showFPS from localStorage** as fallback if not passed (~line 274):
```typescript
const [showFPSSetting] = useState<boolean>(() => {
  try {
    const saved = localStorage.getItem('ll-show-fps');
    return saved ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
});
```

**Update FPS display condition** (line 6010-6016):

Change from:
```tsx
{showFullHUD && (
  <div className="pointer-events-none absolute bottom-2 right-3 z-40">
    ...FPS: {Math.round(fps)}...
  </div>
)}
```

To:
```tsx
{showFPSSetting && (
  <div className="pointer-events-none absolute bottom-2 right-3 z-40">
    <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded px-2 py-1 text-[20px] font-mono text-muted-foreground">
      FPS: {Math.round(fps)}{showFullHUD && <> • Seed: {hud.levelSeed ?? "-"}{mode === "fixed" || mode === "caverns" ? `:${level}` : ""}</>}
    </div>
  </div>
)}
```

This shows:
- FPS only → when HUD is hidden but showFPS is true
- FPS + Seed → when both showFullHUD and showFPS are true

---

### 4. Update SurvivalEngine.tsx

**Read showFPS from localStorage** (~after line 73):
```typescript
const [showFPS] = useState<boolean>(() => {
  try {
    const saved = localStorage.getItem('ll-show-fps');
    return saved ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
});
```

**Update FPS display condition** (lines 3474-3481):

Change from:
```tsx
{/* FPS Counter */}
<div className="fixed bottom-4 right-4 z-20 pointer-events-none select-none">
  <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded px-3 py-1.5">
    <div className="text-xs font-mono text-muted-foreground">
      {fps} FPS
    </div>
  </div>
</div>
```

To:
```tsx
{/* FPS Counter - Independent of HUD setting */}
{showFPS && (
  <div className="fixed bottom-4 right-4 z-20 pointer-events-none select-none">
    <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded px-3 py-1.5">
      <div className="text-xs font-mono text-muted-foreground">
        FPS: {fps}
      </div>
    </div>
  </div>
)}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/Controls.tsx` | Add `showFPS` state, useEffect for persistence, and UI toggle |
| `src/components/game/GameEngine.tsx` | Read `showFPS` from localStorage, update FPS display condition |
| `src/components/game/SurvivalEngine.tsx` | Read `showFPS` from localStorage, conditionally render FPS |

---

## Expected Behavior

| Full HUD | Show FPS | Result |
|----------|----------|--------|
| ON | ON | FPS + Seed displayed (current behavior) |
| ON | OFF | No FPS displayed |
| OFF | ON | **Only FPS displayed** (new behavior) |
| OFF | OFF | Nothing displayed |

---

## Technical Notes
- localStorage key: `ll-show-fps`
- Default value: `true` (matches current behavior where FPS is shown)
- Format: `FPS: XX` (consistent across all engines)
- Position: Bottom-right corner, z-index ensures visibility over game canvas

