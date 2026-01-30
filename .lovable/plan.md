

# Fix: Player Menu Music Not Starting on First Visit

## Problem
Music does not play on the Player Menu when first starting the game. Even after interacting with menus like "Game Modes" or "Guide", the music still doesn't start. It only works correctly after playing a game mode and returning to the Player Menu.

## Root Cause Analysis

The current implementation in PlayerMenu uses `{ once: true }` event listeners:

```typescript
window.addEventListener("pointerdown", startOnInteract, { once: true });
window.addEventListener("touchstart", startOnInteract, { once: true });
window.addEventListener("keydown", startOnInteract, { once: true });
```

**Problems:**
1. `{ once: true }` removes the listener after the FIRST event fires
2. The first click (e.g., on "Game Modes") triggers the listener, but `tryStart()` might fail silently because:
   - AudioContext might not fully resume synchronously
   - Title music buffer is still loading asynchronously
   - The async `playTitleMusic()` call hasn't completed when the click event completes
3. Subsequent clicks don't trigger music start because the listeners are already removed

**Why it works after playing a game:** The game mode (GameEngine) properly warms up the AudioContext with actual audio playback. When returning to PlayerMenu, the AudioContext is already in "running" state and buffers may be cached.

**HomeScreen has an additional safety:** It proactively initializes audio config and preloads SFX in the background, giving the async operations time to complete before user interaction.

---

## Solution

### Part 1: Add Proactive Audio Initialization (like HomeScreen)

Add background audio config initialization that runs after page load:

```typescript
// Proactively preload audio config and SFX for faster music start
useEffect(() => {
  const timer = setTimeout(() => {
    audioRef.current.initializeConfig().then(() => {
      audioRef.current.preloadSFX().catch(() => {});
    }).catch(() => {});
  }, 1500); // Slight delay to let page render
  
  return () => clearTimeout(timer);
}, []);
```

### Part 2: Track Music Started State and Remove `{ once: true }`

Replace the problematic pattern with one that:
1. Tracks whether music has successfully started
2. Keeps retrying on each interaction until successful
3. Only removes listeners after confirmed success

```typescript
const musicStartedRef = useRef(false);

useEffect(() => {
  const tryStart = async () => {
    if (musicStartedRef.current) return; // Already started
    try {
      if (!musicOn) return;
      await audioRef.current.resume();
      await audioRef.current.playTitleMusic();
      audioRef.current.setTitleMusicMuted(false);
      musicStartedRef.current = true;
      console.log('🎵 Player Menu music started');
    } catch (e) {
      console.warn('Music start attempt failed, will retry on next interaction');
    }
  };
  
  // Attempt immediately
  tryStart();
  
  const startOnInteract = () => {
    tryStart();
    if (!musicStartedRef.current) {
      audioRef.current.preloadSFX();
    }
  };
  
  // Don't use { once: true } - keep trying until music starts
  window.addEventListener("pointerdown", startOnInteract);
  window.addEventListener("touchstart", startOnInteract);
  window.addEventListener("keydown", startOnInteract);
  
  return () => {
    window.removeEventListener("pointerdown", startOnInteract);
    window.removeEventListener("touchstart", startOnInteract);
    window.removeEventListener("keydown", startOnInteract);
  };
}, [musicOn]);
```

### Part 3: Add Direct Trigger on Menu Button Clicks

As a belt-and-suspenders approach, also trigger music start directly when any menu action is taken:

```typescript
const handleAction = (id: string) => {
  resetIdle();
  onInteraction?.();
  
  // Ensure music starts on any menu interaction
  if (!musicStartedRef.current && musicOn) {
    audioRef.current.resume().then(() => {
      audioRef.current.playTitleMusic().then(() => {
        audioRef.current.setTitleMusicMuted(false);
        musicStartedRef.current = true;
      }).catch(() => {});
    }).catch(() => {});
  }
  
  // ... rest of handleAction
};
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/PlayerMenu.tsx` | Add proactive audio init, fix listener pattern, add direct trigger |

---

## Technical Notes

- The `await` in `tryStart` now properly waits for `resume()` to complete before playing music
- The `musicStartedRef` ref persists across re-renders without causing effect re-runs
- Removing `{ once: true }` means listeners stay active but only trigger music start attempts until successful
- Adding direct trigger in `handleAction` ensures menu clicks also try to start music
- Proactive config initialization (1.5s delay) gives async operations time to complete before typical user interaction

## Result After Fix

| Scenario | Before | After |
|----------|--------|-------|
| First page load, click "Game Modes" | No music | Music starts |
| Open Guide, close Guide | No music | Music starts |
| Click any menu item | No music | Music starts |
| Return from game mode | Music works | Music works |

