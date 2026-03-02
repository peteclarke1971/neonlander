

# Fix: iPad Audio Not Starting with Gamepad

## Problem

On iPad, audio often doesn't start for a long time when using a gamepad/joypad. This happens because:

1. **iOS requires a user gesture to unlock AudioContext** -- but gamepad button presses do NOT fire standard DOM events (`pointerdown`, `touchstart`, `keydown`). The Player Menu only listens for those three event types to trigger `audio.resume()`.

2. **The gamepad polling loop in PlayerMenu never calls `audio.resume()`** -- so pressing gamepad buttons navigates menus fine but never unlocks the AudioContext. Audio only starts when the user happens to tap the screen or press a keyboard key.

3. **The iOS silent-buffer unlock only runs once** -- if the first attempt happens before the context is truly ready (e.g., during the auto-start attempt on mount), the `_iosUnlocked` flag gets set to `true` and the silent buffer trick is never retried.

## Solution

### 1. Add `audio.resume()` call to the gamepad polling loop (PlayerMenu.tsx)

At the top of the gamepad loop, after detecting any button press, call `audioRef.current.resume()`. This ensures that every gamepad interaction attempts to unlock/resume the AudioContext. Since `resume()` is cheap (no-op when already running), this has zero performance cost.

### 2. Add `gamepadconnected` to the interaction event listeners (PlayerMenu.tsx)

Add `"gamepadconnected"` to the list of window events that trigger `startOnInteract`. This catches the moment a gamepad is first connected and tries to unlock audio. While this alone may not satisfy iOS's gesture requirement, it provides an additional unlock opportunity.

### 3. Make the iOS silent-buffer unlock retry-able (AudioManager.ts)

Change the `_iosUnlocked` flag logic so it resets when the context is still suspended. This way, if the first unlock attempt didn't actually work (common on iOS when called too early), subsequent `resume()` calls will retry the silent buffer trick until it succeeds.

### 4. Add periodic audio unlock retry in PlayerMenu (PlayerMenu.tsx)

Add a periodic check (every 2 seconds) that detects if a gamepad is connected but the AudioContext is still suspended, and calls `resume()`. This catches edge cases where the user connected the gamepad before the page loaded and hasn't pressed any button yet.

## Technical Details

### File: `src/components/game/PlayerMenu.tsx`

**Change 1 -- Gamepad loop audio unlock (around line 492)**

After the idle reset check, add:
```typescript
// Unlock audio on any gamepad button press (iOS requires user gesture)
if (input.ui.up || input.ui.down || input.ui.left || input.ui.right || input.ui.select || input.ui.back) {
  audioRef.current.resume();
  if (!musicStartedRef.current && musicOn) {
    audioRef.current.playTitleMusic().then(() => {
      audioRef.current.setTitleMusicMuted(false);
      musicStartedRef.current = true;
    }).catch(() => {});
  }
}
```

**Change 2 -- Add gamepadconnected event listener (around line 301)**

Add `"gamepadconnected"` to the interaction listeners:
```typescript
window.addEventListener("gamepadconnected", startOnInteract);
// ... and in cleanup:
window.removeEventListener("gamepadconnected", startOnInteract);
```

### File: `src/components/game/AudioManager.ts`

**Change 3 -- Make iOS unlock retryable (around line 228)**

Change the condition so the silent buffer is replayed if the context is still suspended:
```typescript
// iOS sometimes needs a tiny silent buffer played to truly unlock
const isIOS = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad');
if (isIOS && (!this._iosUnlocked || this.ctx.state === 'suspended')) {
  this.playUnlockBuffer();
  if (this.ctx.state === 'running') {
    this._iosUnlocked = true;
  }
}
```

This ensures the silent buffer trick keeps retrying on iOS until the AudioContext actually transitions to the "running" state, rather than giving up after one attempt.

