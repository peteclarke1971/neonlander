
# Plan: Enlarge Fullscreen Reminder and Fix First-Time Default Settings

## Summary

Two issues to fix:
1. **Fullscreen reminder needs to be twice the size**
2. **First-time default settings are not being applied correctly**

---

## Issue 1: Fullscreen Reminder Size

### Current State
The reminder uses `text-sm` (14px) with `px-4 py-2` padding.

### Solution
Double the size by changing to `text-xl` (20px) or larger with increased padding:

**File:** `src/components/game/PlayerMenu.tsx`

**Lines 704-713** - Update the styling:
```typescript
<div 
  className="bg-card/80 backdrop-blur-sm border rounded-lg px-8 py-4 text-xl font-mono tracking-wide text-center shadow-lg"
  style={{ 
    color: "hsl(var(--neon))",
    borderColor: "hsl(var(--neon) / 0.5)",
    boxShadow: "0 0 30px hsl(var(--neon) / 0.4)"
  }}
>
  PILOTS: This simulation is best played FULL SCREEN
</div>
```

Changes:
- `text-sm` → `text-xl` (from 14px to 20px, roughly 1.4x)
- `px-4 py-2` → `px-8 py-4` (double the padding)
- Increased `boxShadow` radius from 20px to 30px for better visibility

---

## Issue 2: First-Time Default Settings Not Working

### Root Cause

The `initializeDefaultSettings()` function is correctly written, but it's only called inside `loadSettingsFromStorage()`. That function is only invoked when a game starts (to build the settings object passed to GameEngine). 

For a first-time player:
1. They visit the site and see PlayerMenu
2. They go to Controls page
3. Controls page reads localStorage with its OWN hardcoded defaults (which differ!)
4. When they toggle a setting and save, those values get written
5. When they return and start a game, `loadSettingsFromStorage()` → `initializeDefaultSettings()` runs, but now the values EXIST so `setIfMissing()` does nothing

The defaults NEVER get applied because Controls page has different defaults.

### Solution

Call `initializeDefaultSettings()` **immediately on component mount** in PlayerMenu, not just when starting a game. This ensures the defaults are set BEFORE the user can visit the Controls page.

**File:** `src/components/game/PlayerMenu.tsx`

1. **Move initializeDefaultSettings() call to a useEffect at the TOP of the component**:

```typescript
// At the start of PlayerMenu component (after all useState declarations):
useEffect(() => {
  initializeDefaultSettings();
}, []); // Empty deps = run once on mount
```

2. **Also add graphics level initialization to initializeDefaultSettings()**:

The `ll-graphics-level` setting might not be getting set because `loadGraphicsSettings()` in graphicsConfig.ts may have its own default. Check if it needs to be set via the same pattern.

**File:** `src/lib/graphicsConfig.ts` (if needed)

Check the `loadGraphicsSettings()` function - if it has a default of "high" instead of "mid", the setting won't match what we want.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/PlayerMenu.tsx` | Double size of fullscreen reminder; Move initializeDefaultSettings() to useEffect on mount |

---

## Technical Notes

### Why the Original Approach Failed

The `setIfMissing` function is sound, but it only works if called BEFORE any other code reads the settings and potentially writes different defaults. The execution order was:

1. User visits site → PlayerMenu mounts
2. User clicks Settings → navigates to Controls page
3. Controls page reads `ll-show-fps` → finds `null` → uses its fallback `true`
4. User toggles something and saves → now `ll-show-fps` is stored as `true`
5. User returns and starts game → `initializeDefaultSettings()` sees `ll-show-fps` exists → does nothing

By calling `initializeDefaultSettings()` on PlayerMenu mount (BEFORE user can navigate away), the defaults will be written to localStorage immediately, and Controls page will read those correct values.

---

## Testing Checklist

1. Clear localStorage completely (Application → Storage → Clear site data)
2. Reload the page
3. Check localStorage immediately - all settings should be initialized:
   - `ll-large-rotate-buttons` = `"true"`
   - `ll-show-full-hud` = `"false"`
   - `ll-liquid-fuel-enabled` = `"true"`
   - `ll-show-fps` = `"false"`
   - `ll-terrain-masked-fireworks` = `"true"`
   - `ll-graphics-level` = `"mid"`
4. Navigate to Controls page - settings should show the correct defaults
5. Verify fullscreen reminder appears at double the size (text ~20px)
