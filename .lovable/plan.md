
# Plan: iOS "Add to Home Screen" Prompt for Safari Users

## Summary

Create a neon-styled prompt that appears on iPad/iPhone when running in Safari (not as a PWA), encouraging users to install the app to their Home Screen for full-screen support. This prompt will appear **before** the landscape orientation warning.

## Detection Logic

The existing `isPWA()` function in `src/lib/deviceDetection.ts` already handles detection:
- Returns `true` if `(window.navigator as any).standalone === true` (iOS PWA)
- Returns `true` if `window.matchMedia('(display-mode: standalone)').matches`

We need to show the prompt when:
- `isIOSDevice() === true` (iPad or iPhone)
- `isPWA() === false` (running in Safari, not installed)

## Component Design

### New Component: `AddToHomeScreen.tsx`

Create `src/components/game/AddToHomeScreen.tsx` with the following structure:

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│                      INSTALL THE APP                              │
│                                                                   │
│              Install on your iPhone or iPad:                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 1    Tap [↑] within Safari on iPad or you may need to     │ │
│  │      tap […] on iPhone                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 2    Find & tap [+] "Add to Home Screen"                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│         Launch game from Home Screen for full screen              │
│              support and best experience                          │
│                                                                   │
│                                                                   │
│                    Tap anywhere to dismiss                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Visual Styling

Match the neon green aesthetic from `PortraitWarning.tsx`:
- Background: `bg-background/95 backdrop-blur-md`
- Text color: `hsl(120, 100%, 50%)` (neon green)
- Text shadow: `0 0 10px hsl(120, 100%, 50%), 0 0 20px hsl(120, 100%, 40%)`
- Font: `font-mono` with uppercase tracking
- Step boxes: Semi-transparent background with neon border (`bg-[hsl(120,100%,50%,0.08)]` with `border-[hsl(120,100%,50%,0.3)]`)
- Step numbers: Circular badges with neon styling
- Icons: Unicode characters for share (↑), more (…), and plus (+) with neon styling

### z-index Layering

The new prompt needs to appear **before** the landscape warning:
- `AddToHomeScreen`: `z-[10000]` (higher than PortraitWarning's `z-[9999]`)
- This ensures it blocks the portrait warning until dismissed

### Persistence

- Store dismissal in `localStorage` with key `ll-add-to-homescreen-dismissed`
- Once dismissed, don't show again for that browser session/device
- Could add option to reset this in settings if needed

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/game/AddToHomeScreen.tsx` | **CREATE** | New component for the install prompt |
| `src/pages/Index.tsx` | **MODIFY** | Import and render `AddToHomeScreen` above `PortraitWarning` |
| `src/lib/deviceDetection.ts` | **MODIFY** | Add helper `isIPhoneDevice()` to distinguish iPhone from iPad for text variation |

## Technical Implementation

### AddToHomeScreen.tsx Structure

```typescript
import React, { useState, useEffect } from "react";
import { isIOSDevice, isPWA, isIPadDevice } from "@/lib/deviceDetection";

const DISMISSED_KEY = 'll-add-to-homescreen-dismissed';

export const AddToHomeScreen: React.FC = () => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  
  // Only show on iOS devices running in Safari (not PWA)
  const shouldShow = isIOSDevice() && !isPWA() && !dismissed;
  
  // Detect if iPad vs iPhone for text variation
  const isIPad = isIPadDevice();
  
  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {}
  };
  
  if (!shouldShow) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/95 backdrop-blur-md"
      onClick={handleDismiss}
      style={{ touchAction: 'none' }}
    >
      {/* Content with neon green styling */}
    </div>
  );
};
```

### Icon Rendering

Use inline SVG or Unicode for the icons:
- **Share icon (↑)**: Unicode `\u{2191}` or custom SVG box with arrow
- **Three dots (…)**: Unicode `\u{2026}` or `•••` 
- **Plus icon (+)**: Unicode `+` in a box styling

The icons should be rendered inside small bordered boxes matching the neon aesthetic, similar to the reference screenshot.

### Index.tsx Changes

```tsx
import { AddToHomeScreen } from "@/components/game/AddToHomeScreen";

// In the JSX, render before PortraitWarning:
{/* iOS Add to Home Screen Prompt (shows before portrait warning) */}
<AddToHomeScreen />

{/* Global Portrait Warning for iPhone users */}
<PortraitWarning />
```

## Text Content (Exact Wording)

**Title**: `INSTALL THE APP`

**Subtitle**: `Install on your iPhone or iPad:`

**Step 1**: `Tap` [↑ icon] `within Safari on iPad or you may need to tap` [...icon] `on iPhone`

**Step 2**: `Find & tap` [+ icon] `"Add to Home Screen"`

**Footer**: `Launch game from Home Screen for full screen support and best experience`

**Dismiss hint**: `Tap anywhere to dismiss`

## Testing Checklist

1. **Safari on iPad**: Prompt appears with correct text variant
2. **Safari on iPhone**: Prompt appears with correct text variant  
3. **PWA on iOS**: Prompt does NOT appear (already installed)
4. **Desktop browsers**: Prompt does NOT appear
5. **Android browsers**: Prompt does NOT appear
6. **Dismiss persists**: After dismissing, prompt doesn't show on reload
7. **z-index works**: Prompt blocks portrait warning until dismissed
8. **Styling matches**: Neon green aesthetic consistent with game
