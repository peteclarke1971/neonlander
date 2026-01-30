
# Plan: Guide System Final Tweaks

## Summary

This plan implements several refinements to the Guide popup:
1. **Scroll to top on page change** - Reset scroll position when navigating between pages
2. **Always start at first page** - Reset to page 0 when opening the guide
3. **Pause demo timer** - Emit callback to pause demo timer when guide is open
4. **Auto-scroll feature** - After 3 seconds, slowly scroll down; at bottom, wait 3s and scroll back up
5. **Landing page text** - Add "Land in the glowing pads" above existing pad text
6. **Hazards page text** - Update Gravity Wells description

---

## Part 1: Scroll to Top on Page Change

### File: `src/components/game/GuidePopup.tsx`

Add a ref for the scroll container and reset scroll position whenever `currentPage` changes.

**Changes:**
- Add `scrollContainerRef` ref for the content div
- Add useEffect that resets scrollTop to 0 when `currentPage` changes

```typescript
const scrollContainerRef = useRef<HTMLDivElement>(null);

// Scroll to top when page changes
useEffect(() => {
  if (scrollContainerRef.current) {
    scrollContainerRef.current.scrollTop = 0;
  }
}, [currentPage]);
```

**Apply ref to content div (line 220):**
```tsx
<div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 guide-scroll">
```

---

## Part 2: Always Start at First Page

### File: `src/components/game/GuidePopup.tsx`

Currently the guide loads the last viewed page from localStorage (lines 33-45). Change this to always start at page 0.

**Before (lines 33-45):**
```typescript
useEffect(() => {
  if (isOpen) {
    try {
      const saved = localStorage.getItem('ll-guide-last-page');
      if (saved) {
        const pageIndex = parseInt(saved, 10);
        if (pageIndex >= 0 && pageIndex < PAGES.length) {
          setCurrentPage(pageIndex);
        }
      }
    } catch {}
  }
}, [isOpen]);
```

**After:**
```typescript
useEffect(() => {
  if (isOpen) {
    setCurrentPage(0); // Always start at first page
  }
}, [isOpen]);
```

Also remove the "save current page to storage" effect (lines 47-52) since we no longer persist page position.

---

## Part 3: Pause Demo Timer When Guide is Open

### File: `src/components/game/GuidePopup.tsx`

Add an optional `onOpenChange` callback prop that notifies parent when guide opens/closes.

**Updated props interface:**
```typescript
interface GuidePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange?: (isOpen: boolean) => void; // New prop
}
```

**Add effect to notify parent:**
```typescript
useEffect(() => {
  onOpenChange?.(isOpen);
}, [isOpen, onOpenChange]);
```

### File: `src/components/game/PlayerMenu.tsx`

Track when guide is open and pass to parent via `onInteraction` or a new callback.

**Add state (around line 118):**
```typescript
const [guideOpen, setGuideOpen] = useState(false);
```

**Pass callback to GuidePopup:**
```tsx
<GuidePopup 
  isOpen={showGuidePopup} 
  onClose={() => setShowGuidePopup(false)}
  onOpenChange={setGuideOpen}
/>
```

**Modify idle timer effect (around line 251) to not run when guide is open:**
```typescript
useEffect(() => {
  // Don't run idle timer if mode/level menu is open, assets not loaded, showing leaderboards, or guide is open
  if (showModeMenu || showLevelMenu || !assetsLoaded || showLeaderboards || showGuidePopup) {
    return;
  }
  // ... rest of effect
}, [showModeMenu, showLevelMenu, assetsLoaded, showLeaderboards, showGuidePopup]);
```

### File: `src/pages/Index.tsx`

The demo timer runs based on `lastInteractionTime`. When guide is open, we need to pause it.

**Option: Pass guideOpen state up from PlayerMenu and pause demo timer**

Add prop to PlayerMenu:
```typescript
interface PlayerMenuProps {
  // ... existing props
  onGuideOpen?: (isOpen: boolean) => void;
}
```

In Index.tsx, track guide state:
```typescript
const [guideOpen, setGuideOpen] = useState(false);
```

In demo timer effect (line 733), add condition:
```typescript
useEffect(() => {
  // Don't run demo timer during active gameplay or when guide is open
  if (view === "game" || view === "gameover" || guideOpen) {
    return;
  }
  // ... rest of effect
}, [view, lastInteractionTime, demoSequenceIndex, demoStartTime, demoOriginView, guideOpen]);
```

Also reset lastInteractionTime when guide closes to restart the 60-second countdown.

---

## Part 4: Auto-Scroll Feature

### File: `src/components/game/GuidePopup.tsx`

Add auto-scroll logic that:
1. Waits 3 seconds after page loads
2. Slowly scrolls down
3. Waits 3 seconds at bottom
4. Slowly scrolls back up
5. Repeats

**Implementation:**

```typescript
// Auto-scroll state
const autoScrollRef = useRef<{
  direction: 'down' | 'up' | 'waiting';
  waitStart: number;
  rafId: number;
}>({ direction: 'waiting', waitStart: 0, rafId: 0 });

useEffect(() => {
  if (!isOpen) return;
  
  const container = scrollContainerRef.current;
  if (!container) return;
  
  // Check if scrolling is needed
  const hasScroll = container.scrollHeight > container.clientHeight;
  if (!hasScroll) return;
  
  const SCROLL_SPEED = 30; // pixels per second
  const WAIT_TIME = 3000; // 3 seconds
  
  let lastTime = performance.now();
  autoScrollRef.current = { direction: 'waiting', waitStart: performance.now(), rafId: 0 };
  
  const animate = (time: number) => {
    const delta = time - lastTime;
    lastTime = time;
    
    const state = autoScrollRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    
    if (state.direction === 'waiting') {
      if (time - state.waitStart >= WAIT_TIME) {
        // Determine direction based on current position
        if (scrollTop >= maxScroll - 1) {
          state.direction = 'up';
        } else if (scrollTop <= 1) {
          state.direction = 'down';
        } else {
          state.direction = 'down'; // Default to down
        }
      }
    } else if (state.direction === 'down') {
      const newScroll = scrollTop + (SCROLL_SPEED * delta / 1000);
      container.scrollTop = newScroll;
      if (container.scrollTop >= maxScroll - 1) {
        state.direction = 'waiting';
        state.waitStart = time;
      }
    } else if (state.direction === 'up') {
      const newScroll = scrollTop - (SCROLL_SPEED * delta / 1000);
      container.scrollTop = newScroll;
      if (container.scrollTop <= 1) {
        state.direction = 'waiting';
        state.waitStart = time;
      }
    }
    
    state.rafId = requestAnimationFrame(animate);
  };
  
  autoScrollRef.current.rafId = requestAnimationFrame(animate);
  
  return () => {
    cancelAnimationFrame(autoScrollRef.current.rafId);
  };
}, [isOpen, currentPage]); // Reset on page change
```

**User interaction pauses auto-scroll:**
Add touch/scroll event listeners that reset the wait timer when user manually scrolls.

---

## Part 5: Landing Page Text Update

### File: `src/components/game/guide/GuidePageLanding.tsx`

Add "Land in the glowing pads" text above "The lander must be completely on the pad".

**Current (lines 96-101):**
```tsx
<PulsingPadCanvas width={180} />
<span className="text-xs sm:text-base opacity-80" style={{ color: 'hsl(var(--neon))' }}>
  The lander must be completely on the pad
</span>
```

**After:**
```tsx
<PulsingPadCanvas width={180} />
<span className="text-xs sm:text-base opacity-80" style={{ color: 'hsl(var(--neon))' }}>
  Land in the glowing pads
</span>
<span className="text-xs sm:text-base opacity-80" style={{ color: 'hsl(var(--neon))' }}>
  The lander must be completely on the pad
</span>
```

---

## Part 6: Hazards Page Text Update

### File: `src/components/game/guide/GuidePageHazards.tsx`

Update Gravity Wells section text.

**Current (lines 47-55):**
```tsx
<div className="text-xs sm:text-base opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>
  Pull your ship toward them. Fight the pull!
</div>
<div 
  className="text-xs sm:text-base mt-2"
  style={{ color: 'hsl(var(--neon))' }}
>
  Purple swirl effect
</div>
```

**After:**
```tsx
<div className="text-xs sm:text-base opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>
  Pulls or pushes your Lander
</div>
<div 
  className="text-xs sm:text-base mt-2"
  style={{ color: 'hsl(var(--neon))' }}
>
  Size equals power
</div>
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/GuidePopup.tsx` | Scroll to top, always start at page 0, auto-scroll, notify parent of open state |
| `src/components/game/PlayerMenu.tsx` | Track guide open state, pause idle timer when guide open, pass callback to parent |
| `src/pages/Index.tsx` | Pause demo timer when guide is open |
| `src/components/game/guide/GuidePageLanding.tsx` | Add "Land in the glowing pads" text |
| `src/components/game/guide/GuidePageHazards.tsx` | Update Gravity Wells text |

---

## Technical Notes

### Auto-Scroll Behavior
- Uses `requestAnimationFrame` for smooth animation
- Scroll speed: 30 pixels/second (adjustable)
- Wait time: 3 seconds at top and bottom
- Resets when user changes page or manually scrolls
- Only activates if page has scrollable content

### Demo Timer Pause
- When guide opens, the demo timer is effectively paused by not running the interval
- When guide closes, `lastInteractionTime` is reset to restart the 60-second countdown
- This prevents demo mode from triggering while reading the guide

### Scroll Reset
- Every page change resets scroll to top immediately
- This ensures users always see the beginning of each page
- Works on both touch swipe and button/keyboard navigation

---

## Result After Changes

| Feature | Before | After |
|---------|--------|-------|
| Page scroll position | Retained between pages | Resets to top on each page |
| Initial page | Loads last viewed page | Always starts at page 1 (Controls) |
| Demo timer | Runs while guide is open | Pauses when guide is open |
| Auto-scroll | None | Scrolls down after 3s, back up after reaching bottom |
| Landing page | Single line of text | Two lines: "Land in the glowing pads" + "The lander must be completely on the pad" |
| Gravity Wells | "Pull your ship toward them" + "Purple swirl effect" | "Pulls or pushes your Lander" + "Size equals power" |
