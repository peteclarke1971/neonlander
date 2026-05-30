## Goal

Produce the exact, most up-to-date sound effects + music configuration from this version so it can be handed to the remastered app and reproduce the audio mapping 1:1.

## Source of truth

This version reads audio from a **baked snapshot**, not live from the database. `src/lib/audioConfigService.ts` has `SKIP_CLOUD_AUDIO_FETCH = true`, so the game always uses `BAKED_AUDIO_CONFIGS.default` (i.e. `DEFAULT_SOUNDTRACK`) inside `src/lib/defaultAudioConfig.ts`. That baked config — not the raw DB rows — is what actually plays.

Important detail: the database stores every entry at `volume: 1.0` and only covers file *assignments*. The baked config carries the real runtime volumes (music ≈ `0.5`, SFX varies) and fills in events the DB never had (`thruster`, `crash`, `introGo`, `introWarp`, `level14–16`, `missionSuccess2`, lightning/jellyfish, etc.). I cross-checked the DB against the baked file and the file assignments match; the baked file is newer and authoritative.

## What I'll deliver

Generate portable export files in `/mnt/documents/` that the remastered version can read or copy from:

1. `neonlander-audio-config.json` — the complete resolved config:
   - `music`: all 31 keys (`title`, `title2`, `level1–20`, `endless1–5`, `missionSuccess`, `missionSuccess2`, `missionFail`, `highScore`) each with `path` + `volume`.
   - `sfx`: all 25 keys (`thruster`, `crash`, `landing`, `fuelAlarm`, `introTick`, `introGo`, `introWarp`, `click`, `abort`, `shieldPickup`, `shieldBreak`, `junkPickup`, `junkSetComplete`, `volcanoErupt`, `wormholeOpen`, `wormholeEnter`, lightning/jellyfish set, `cometArrival`, `ufoSmall/Medium/Large`) each with `path` + `volume`.
   - A header block with export date and a note that `null` paths mean "use the app's built-in synthesized fallback".

2. `neonlander-audio-config.md` — a human-readable table (Event | Type | File | Volume) so you can eyeball the mapping before importing.

3. Optionally `neonlander-audio-config.ts` — a ready-to-paste TypeScript object matching the existing `AudioConfig` shape, in case the remastered app uses the same structure.

## Steps

1. Read the baked `DEFAULT_SOUNDTRACK` from `src/lib/defaultAudioConfig.ts` (already have it).
2. Write a small script that serializes that exact object into JSON, Markdown table, and TS files under `/mnt/documents/`.
3. QA the JSON for completeness (all 31 music + 25 sfx keys present, paths/volumes correct).
4. Surface the files as downloadable artifacts.

## Notes / things to confirm

- The audio files themselves (the `.mp3`s under `/audio/...`) must also exist in the remastered app's `public/audio` folder with the same filenames, otherwise the paths won't resolve. The config only maps event → filename + volume; it doesn't bundle the audio binaries.
- `null` entries are intentional (no custom file; the engine plays a synthesized fallback). I'll keep them as `null` and document it.
