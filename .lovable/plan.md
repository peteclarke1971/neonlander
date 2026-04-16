
The user is asking two related questions:

1. **Do we need to wait for a tap?** — Yes, browsers/iOS require a user gesture before audio can play. There's no way around this on the web (or in a Capacitor WebView). However, the tap doesn't have to be an *explicit* "tap to start" screen — any user interaction works (clicking Play, navigating menus, etc.). The current setup already piggybacks on existing taps (HomeScreen, PlayerMenu, Controls), so no extra "tap to enable audio" prompt is needed. That's good.

2. **Can we hardcode all audio mappings from Supabase?** — Yes. The `audioConfigService` already has an `exportAsTypeScript()` method that generates a fully-baked `defaultAudioConfig.ts`. We can:
   - Pull the current `audio_config` + `audio_library` rows from Supabase for all 3 soundtracks (default/retro, modern, hidden)
   - Generate a complete `defaultAudioConfig.ts` with all paths/volumes baked in
   - Add a `skipCloudFetch` flag (already mentioned in memory) so `audioConfigService.loadConfig()` returns the bundled defaults *synchronously* without ever hitting Supabase
   - This eliminates the Supabase round-trip on iOS startup entirely → faster, more reliable audio, works fully offline

This is the ideal solution for the iOS native build.

Let me check the current state of defaultAudioConfig and audioConfigService to confirm the export structure.

## Plan

### Question 1: Do we need to wait for a tap?

**Yes — but no extra prompt is needed.** iOS WebView (and all browsers) require audio to start inside a user gesture. The good news: the existing taps on HomeScreen, PlayerMenu, and Controls already satisfy this — `unlockSync()` runs on those taps. No "tap to enable sound" overlay required. Audio simply won't play *before* the first tap, which is the platform rule, not something we can bypass.

### Question 2: Hardcode all audio mappings — yes, fully feasible

We'll bake the current Supabase config into `defaultAudioConfig.ts` for all 3 soundtracks, and add a flag to skip cloud fetches entirely.

### Steps

1. **Pull current config from Supabase** (read-only query) — fetch all rows from `audio_config` joined with `audio_library` for `default`, `retro`, `modern`, and `hidden` soundtracks. This gives the path + volume for every event_key.

2. **Rewrite `src/lib/defaultAudioConfig.ts`** to contain a `BAKED_AUDIO_CONFIGS` map keyed by soundtrack:
   ```ts
   export const BAKED_AUDIO_CONFIGS: Record<SoundtrackType, AudioConfig> = {
     default: { music: {...}, sfx: {...} },
     retro:   { music: {...}, sfx: {...} },
     modern:  { music: {...}, sfx: {...} },
     hidden:  { music: {...}, sfx: {...} },
   };
   ```
   All 61 music + 38 SFX entries baked in with the exact paths currently in Supabase.

3. **Add `SKIP_CLOUD_AUDIO_FETCH` flag** (default: `true`) at the top of `audioConfigService.ts`.

4. **Modify `audioConfigService.loadConfig()`** so when the flag is true:
   - Return `BAKED_AUDIO_CONFIGS[this.soundtrack]` synchronously (wrapped in `Promise.resolve` to keep the async signature)
   - Never hit Supabase
   - Never `await` anything network-related during gameplay

5. **Keep the Audio Settings page working** — it can still read from cloud (for browsing the library) but the *game itself* uses the baked config. The Audio Settings export-to-TypeScript button still works for future re-bakes.

6. **Result**:
   - No Supabase calls during gameplay → iOS audio unlock is rock-solid
   - Works fully offline (great for native iOS / TestFlight)
   - Faster startup (no network round-trip)
   - To update audio later: change Supabase, then ask me to "re-bake the audio config" and I'll regenerate the file

### Files affected

- `src/lib/defaultAudioConfig.ts` — replace with baked config for all 4 soundtrack variants
- `src/lib/audioConfigService.ts` — add `SKIP_CLOUD_AUDIO_FETCH` flag and short-circuit `loadConfig()`

### Notes

- The current `DEFAULT_AUDIO_CONFIG` only covers one soundtrack. We'll expand it to a per-soundtrack map.
- Audio Settings page will still function (it reads `audio_library` directly for the browser UI).
- If you ever want to switch back to live cloud config, flip `SKIP_CLOUD_AUDIO_FETCH = false`.
- I'll need to run the Supabase read query during implementation to get the actual paths/volumes.
