

# Plan: Guide System Updates - Text, Emojis, and Navigation Fix

## Summary

This plan implements the following changes to the Guide popup:
1. Add text under pulsing pad on LANDING page: "The lander must be completely on the pad"
2. Increase all text size by 40% across the entire guide
3. Remove all emoji icons EXCEPT:
   - 🎮 on CONTROLS page (Gamepad supported)
   - ∞ on SURVIVAL page title
4. Fix left/right arrow key navigation for guide pages

---

## Part 1: LANDING Page - Add Text Under Pulsing Pad

### File: `src/components/game/guide/GuidePageLanding.tsx`

Add a text description below the `PulsingPadCanvas` component.

**Current (lines 89-98):**
```tsx
{/* Pulsing landing pad graphic */}
<div 
  className="p-3 rounded border flex justify-center"
  style={{ 
    borderColor: 'hsl(var(--neon) / 0.3)',
    background: 'hsl(var(--neon) / 0.05)'
  }}
>
  <PulsingPadCanvas width={180} />
</div>
```

**After:**
```tsx
{/* Pulsing landing pad graphic */}
<div 
  className="p-3 rounded border flex flex-col items-center gap-2"
  style={{ 
    borderColor: 'hsl(var(--neon) / 0.3)',
    background: 'hsl(var(--neon) / 0.05)'
  }}
>
  <PulsingPadCanvas width={180} />
  <span className="text-base opacity-80" style={{ color: 'hsl(var(--neon))' }}>
    The lander must be completely on the pad
  </span>
</div>
```

---

## Part 2: Increase Text Size by 40% Globally

Current text sizes and their 40% larger equivalents:
- `text-xs` (12px) → `text-base` (16px) - approximately 33% increase, closest Tailwind match
- `text-sm` (14px) → `text-lg` (18px) - approximately 29% increase, closest match
- `text-base` (16px) → `text-xl` (20px) - 25% increase
- `text-2xl` (24px) → `text-4xl` (36px) - 50% increase, close enough

**Changes across all guide pages:**

### GuidePageControls.tsx
- Line 9: `text-sm` → `text-lg`
- Line 88: `text-sm` → `text-lg`

### GuidePageLanding.tsx
- Line 70: `text-sm` → `text-lg`
- Line 81, 85: `text-xs` → `text-base`
- Line 104: `text-sm` → `text-lg`
- Line 110: `text-xs` → `text-base`
- Line 113, 114, 118, 119, 123, 124, 128: various `opacity` spans → `text-base`

### GuidePageFuelShields.tsx
- Line 9: `text-sm` → `text-lg`
- Line 15: `text-sm` → `text-lg`
- Line 34: `text-sm` → `text-lg`
- Line 41: `text-sm` → `text-lg`
- Line 64: `text-xs` → `text-base`

### GuidePageHazards.tsx
- Line 17: `text-sm` → `text-lg`
- Line 22: `text-xs` → `text-base`
- Line 26: `text-xs` → `text-base`
- (Similar changes for all hazard boxes and UFO types section)

### GuidePageScoring.tsx
- Line 9: `text-sm` → `text-lg`
- Line 22: `text-sm` → `text-lg`
- Line 33: `text-xs` → `text-base`
- Line 44: `text-sm` → `text-lg`
- Line 50: `text-sm` → `text-lg`
- (Similar changes throughout)

### GuidePageModes.tsx
- Line 7: `text-sm` → `text-lg`
- Line 22: `text-sm` → `text-lg`
- Line 27: `text-xs` → `text-base`
- (Similar changes for all mode boxes)

### GuidePageSurvival.tsx
- Line 7: `text-2xl` → `text-4xl`
- Line 16: `text-sm` → `text-lg`
- Line 23: `text-sm` → `text-lg`
- Line 37: `text-sm` → `text-lg`
- Line 43: `text-xs` → `text-base`
- (Similar changes throughout)

---

## Part 3: Remove Emoji Icons (Keep Only 🎮 and ∞)

### GuidePageControls.tsx
- Keep 🎮 on line 91 (Gamepad note)

### GuidePageLanding.tsx
Remove emojis from:
- Line 80: `✓ SPEED` → `SPEED`
- Line 84: `✓ ANGLE` → `ANGLE`
- Line 112: `🎯 BULLSEYE` → `BULLSEYE`
- Line 117: `⚡ SPEED` → `SPEED`
- Line 122: `✨ PERFECT` → `PERFECT`

### GuidePageFuelShields.tsx
Remove emojis from:
- Line 17: `⛽` → remove
- Line 21: `↻` → remove
- Line 25: `✦` → remove
- Line 49: `🛡️` → remove
- Line 53: `💥` → remove
- Line 57: `✨` → remove

### GuidePageSurvival.tsx
- Keep `∞` on line 10 (SURVIVAL MODE title)
- Remove from:
  - Line 48: `⛽ FUEL` → `FUEL`
  - Line 55: `📍 SECTORS` → `SECTORS`
  - Line 62: `☄️ COMETS` → `COMETS`
  - Line 69: `🌀 WEATHER` → `WEATHER`
  - Line 93: `🌑` → remove
  - Line 109: `💡` → remove
  - Line 124: `💡 Conserve fuel...` → `Conserve fuel...`

### GuidePageScoring.tsx
Remove emojis from:
- Line 55: `🎯 Bullseye` → `Bullseye`
- Line 62: `⚡ Speed Bonus` → `Speed Bonus`
- Line 69: `✨ Perfect` → `Perfect`
- Line 76: `🔄 360° Rotation` → `360° Rotation`
- Line 83: `💨 Near Miss` → `Near Miss`

### GuidePageModes.tsx
Remove emojis from:
- Line 25: `🚀 CAMPAIGN` → `CAMPAIGN`
- Line 44: `🕹️ CLASSIC` → `CLASSIC`
- Line 63: `⏱️ TIME TRIAL` → `TIME TRIAL`
- Line 82: `🎲 MEDLEY` → `MEDLEY`
- Keep `∞` on line 101 (SURVIVAL)

---

## Part 4: Fix Left/Right Arrow Key Navigation

### Analysis
The keyboard navigation code in `GuidePopup.tsx` (lines 62-81) looks correct:

```tsx
useEffect(() => {
  if (!isOpen) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      goToPrevPage();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      goToNextPage();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isOpen, onClose, goToPrevPage, goToNextPage]);
```

### Issue
The problem could be that other event listeners in the parent component are catching and handling the events first, or the focus is being captured by interactive elements within the guide. 

### Solution
Use the capture phase for event listening to ensure we handle keyboard events before other handlers. Also add `stopPropagation()` to prevent event bubbling:

```tsx
useEffect(() => {
  if (!isOpen) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      e.stopPropagation();
      goToPrevPage();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      e.stopPropagation();
      goToNextPage();
    }
  };

  // Use capture phase to handle events before other listeners
  window.addEventListener('keydown', handleKeyDown, true);
  return () => window.removeEventListener('keydown', handleKeyDown, true);
}, [isOpen, onClose, goToPrevPage, goToNextPage]);
```

The key changes:
1. Add `e.stopPropagation()` to prevent events from reaching other handlers
2. Add `true` as third parameter to `addEventListener` to use capture phase

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/GuidePopup.tsx` | Fix keyboard navigation with capture phase and stopPropagation |
| `src/components/game/guide/GuidePageControls.tsx` | Increase text sizes |
| `src/components/game/guide/GuidePageLanding.tsx` | Add pad text, increase sizes, remove emojis (keep none) |
| `src/components/game/guide/GuidePageFuelShields.tsx` | Increase text sizes, remove all emojis |
| `src/components/game/guide/GuidePageHazards.tsx` | Increase text sizes |
| `src/components/game/guide/GuidePageScoring.tsx` | Increase text sizes, remove all emojis |
| `src/components/game/guide/GuidePageModes.tsx` | Increase text sizes, remove emojis except ∞ |
| `src/components/game/guide/GuidePageSurvival.tsx` | Increase text sizes, remove emojis except ∞ |

---

## Summary of Emoji Changes

| Page | Before | After |
|------|--------|-------|
| CONTROLS | 🎮 | 🎮 (kept) |
| LANDING | ✓, 🎯, ⚡, ✨ | All removed |
| FUEL & SHIELDS | ⛽, ↻, ✦, 🛡️, 💥, ✨ | All removed |
| HAZARDS | None | None |
| SCORING | 🎯, ⚡, ✨, 🔄, 💨 | All removed |
| MODES | 🚀, 🕹️, ⏱️, 🎲, ∞ | Only ∞ kept |
| SURVIVAL | ∞, ⛽, 📍, ☄️, 🌀, 🌑, 💡 | Only ∞ (title) kept |

