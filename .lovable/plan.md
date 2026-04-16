

## Diagnosis

You confirmed the smoking gun: synthesized fallback sounds (oscillators / white noise via `playNoise`) play fine in TestFlight, but every MP3-backed sound and music track is silent. That tells us:

- The AudioContext IS unlocking and running on iOS.
- The user-gesture chain IS intact.
- The problem is **specifically loading the audio files**.

Looking at `AudioManager.loadBuffer()`:

```ts
private async loadBuffer(url: string): Promise<AudioBuffer | null> {
  this.ensureCtx();
  if (!this.ctx) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return await this.ctx.decodeAudioData(arr);
  } catch {
    return null;            // <— silently swallows ALL errors
  }
}
```

In Capacitor iOS the WebView serves files from `capacitor://localhost`. WKWebView's `fetch()` is well-known to misbehave on local binary assets — it can return empty/malformed `ArrayBuffer`s for MP3s, causing `decodeAudioData` to reject. The blanket `catch` then sets every buffer to `null`, every `playOneShot` skips, and the synth fallbacks play instead. Exactly what you're seeing.

## Fix plan

### 1. Replace `loadBuffer` with a robust 3-tier loader

Try in order:
1. `XMLHttpRequest` with `responseType: 'arraybuffer'` (works reliably on WKWebView for local assets)
2. `fetch()` (web/PWA fallback)
3. Log any failure with the URL + error so it's visible in Xcode console

This single change should restore all SFX and music in the iOS build.

### 2. Add a diagnostic logger
Replace the silent `catch {}` with `console.error('[audio] failed to load', url, err)`. In production builds these are stripped, but warn/error survive enough for native debugging via Safari Web Inspector when attached to the device.

### 3. Ensure file paths resolve correctly under capacitor://
Use `new URL(path, document.baseURI).toString()` inside `loadBuffer` so relative `/audio/foo.mp3` resolves to `capacitor://localhost/audio/foo.mp3` rather than a malformed URL.

### 4. Optional safety net for music
For long music files, fall back to an `HTMLAudioElement`-based player (via `MediaElementAudioSourceNode`) if `decodeAudioData` still fails. `<audio>` uses iOS's native media pipeline and handles streaming MP3s reliably even when WebAudio decode can't.

### Files affected
- `src/components/game/AudioManager.ts` — rewrite `loadBuffer` with XHR-first strategy + URL resolution + error logging.

### What this does NOT change
- The baked Supabase config (kept).
- The synchronous `unlockSync()` gesture handling (kept).
- Public web build behavior (XHR works fine in browsers too, fetch fallback covers any edge case).

### Expected outcome
After rebuild + TestFlight: all SFX (thruster, crash, intro tick/go, comet, UFO loops) and music (title, level, endless, mission success) start playing normally on iOS native.

