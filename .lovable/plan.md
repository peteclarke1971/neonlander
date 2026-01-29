

# Plan: Add Splash Screen, Default to Player Menu, Remove Diamond

## Summary

This plan implements three changes:
1. **Splash screen** on first playthrough showing "bemoreian" company branding video
2. **Change default view** to Player Menu instead of Developer Menu
3. **Remove diamond twinkle** from Player Menu footer

---

## Part 1: Bemoreian Splash Screen

### Design
- Show a full-screen video splash on the **very first visit** to the game
- Video automatically plays and advances after completion, OR skips immediately on any input
- Use `localStorage` key `ll-splash-seen` to track if user has seen the splash
- Once seen, the splash never shows again (goes straight to Player Menu)

### Implementation

**Step 1: Copy video to public folder**

Copy the uploaded video file to `public/video/bemoreian-splash.mp4` for direct access.

**Step 2: Create SplashScreen component**

New file: `src/components/game/SplashScreen.tsx`

```typescript
import React, { useEffect, useRef, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadeOut, setFadeOut] = useState(false);
  
  // Handle skip on any input
  useEffect(() => {
    const handleSkip = () => {
      setFadeOut(true);
      setTimeout(onComplete, 500);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => handleSkip();
    const handleClick = () => handleSkip();
    const handleTouch = () => handleSkip();
    const handleGamepad = () => {
      // Poll gamepad for any button
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (gp && gp.buttons.some(b => b.pressed)) {
          handleSkip();
          break;
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleTouch);
    const gpInterval = setInterval(handleGamepad, 100);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleTouch);
      clearInterval(gpInterval);
    };
  }, [onComplete]);
  
  // Auto-complete when video ends
  const handleVideoEnd = () => {
    setFadeOut(true);
    setTimeout(onComplete, 500);
  };
  
  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <video
        ref={videoRef}
        src="/video/bemoreian-splash.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
};
```

**Step 3: Integrate into Index.tsx**

Add splash state and logic:

```typescript
// Add new view type
const [view, setView] = useState<"splash" | "home" | "playermenu" | "game" | "gameover" | "demo">(() => {
  // Check if splash has been seen
  try {
    const seen = localStorage.getItem('ll-splash-seen');
    if (seen === 'true') {
      return "playermenu"; // Default to player menu
    }
  } catch {}
  return "splash"; // Show splash on first visit
});

// Handle splash completion
const handleSplashComplete = () => {
  try {
    localStorage.setItem('ll-splash-seen', 'true');
  } catch {}
  setView("playermenu");
};

// In render, add splash screen
{view === "splash" && (
  <SplashScreen onComplete={handleSplashComplete} />
)}
```

---

## Part 2: Default to Player Menu

### Current State (line 33)
```typescript
const [view, setView] = useState<"home" | "playermenu" | "game" | "gameover" | "demo">("home");
```

### Change
After splash is implemented, returning visitors (who have seen splash) will default to `"playermenu"` instead of `"home"`.

The logic is integrated into Part 1 - the useState initializer checks `ll-splash-seen`:
- If seen → start at `"playermenu"`
- If not seen → start at `"splash"` (which transitions to `"playermenu"`)

---

## Part 3: Remove Diamond Twinkle

### Location
`src/components/game/PlayerMenu.tsx` lines 812-817

### Current Code
```tsx
<span 
  className="text-sm opacity-30"
  style={{ color: "hsl(var(--neon))" }}
>
  ✦
</span>
```

### Change
Delete this span element entirely.

---

## Files Modified

| File | Changes |
|------|---------|
| `public/video/bemoreian-splash.mp4` | New file - copy from user upload |
| `src/components/game/SplashScreen.tsx` | New component - full-screen splash video |
| `src/pages/Index.tsx` | Add splash state, import SplashScreen, change default view logic |
| `src/components/game/PlayerMenu.tsx` | Remove diamond twinkle span (lines 812-817) |

---

## User Flow After Changes

```text
First Visit:
  → Splash screen (bemoreian video)
  → Any input OR video ends
  → Player Menu

Returning Visit:
  → Player Menu (directly)

Dev Portal accessible via "Dev Portal" link in footer
```

---

## Technical Notes

- Video plays muted (no audio context issues on mobile)
- Splash uses `playsInline` for iOS compatibility
- Fade-out animation (500ms) for smooth transition
- Gamepad polling (100ms interval) for controller skip support
- localStorage key `ll-splash-seen` persists across sessions

