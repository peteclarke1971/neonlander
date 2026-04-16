/**
 * Default Audio Configuration (BAKED FROM SUPABASE)
 *
 * This file contains a fully baked, hardcoded snapshot of the audio
 * configuration for every soundtrack. It is shipped with the build so
 * that the game (especially the iOS Capacitor native build) NEVER needs
 * to hit Supabase to play sounds.
 *
 * To update: change settings in Supabase via the Audio Settings page,
 * then ask the AI to "re-bake the audio config" — it will regenerate
 * this file from the current cloud state.
 *
 * Last baked: 2026-04-16 from Supabase audio_config + audio_library.
 */

export type SoundtrackType = 'default' | 'retro' | 'modern' | 'hidden';

export interface AudioEventConfig {
  path: string | string[] | null;
  volume?: number;
}

export interface MusicConfig {
  title: AudioEventConfig;
  title2: AudioEventConfig;
  level1: AudioEventConfig;
  level2: AudioEventConfig;
  level3: AudioEventConfig;
  level4: AudioEventConfig;
  level5: AudioEventConfig;
  level6: AudioEventConfig;
  level7: AudioEventConfig;
  level8: AudioEventConfig;
  level9: AudioEventConfig;
  level10: AudioEventConfig;
  level11: AudioEventConfig;
  level12: AudioEventConfig;
  level13: AudioEventConfig;
  level14: AudioEventConfig;
  level15: AudioEventConfig;
  level16: AudioEventConfig;
  level17: AudioEventConfig;
  level18: AudioEventConfig;
  level19: AudioEventConfig;
  level20: AudioEventConfig;
  endless1: AudioEventConfig;
  endless2: AudioEventConfig;
  endless3: AudioEventConfig;
  endless4: AudioEventConfig;
  endless5: AudioEventConfig;
  missionSuccess: AudioEventConfig;
  missionSuccess2: AudioEventConfig;
  missionFail: AudioEventConfig;
  highScore: AudioEventConfig;
}

export interface SfxConfig {
  thruster: AudioEventConfig;
  crash: AudioEventConfig;
  landing: AudioEventConfig;
  fuelAlarm: AudioEventConfig;
  introTick: AudioEventConfig;
  introGo: AudioEventConfig;
  introWarp: AudioEventConfig;
  click: AudioEventConfig;
  abort: AudioEventConfig;
  shieldPickup: AudioEventConfig;
  shieldBreak: AudioEventConfig;
  junkPickup: AudioEventConfig;
  junkSetComplete: AudioEventConfig;
  volcanoErupt: AudioEventConfig;
  wormholeOpen: AudioEventConfig;
  wormholeEnter: AudioEventConfig;
  lightningRumble: AudioEventConfig;
  lightningCrack: AudioEventConfig;
  lightningImpact: AudioEventConfig;
  jellyfishBurst: AudioEventConfig;
  jellyfishShock: AudioEventConfig;
  cometArrival: AudioEventConfig;
  ufoSmall: AudioEventConfig;
  ufoMedium: AudioEventConfig;
  ufoLarge: AudioEventConfig;
}

export interface AudioConfig {
  music: MusicConfig;
  sfx: SfxConfig;
}

export type MusicEventKey = keyof MusicConfig;
export type SfxEventKey = keyof SfxConfig;
export type AudioEventKey = MusicEventKey | SfxEventKey;

/**
 * BAKED 'default' soundtrack config — reflects current Supabase state.
 * Cloud-overridden entries use the cloud-assigned files; everything
 * else falls back to the original hardcoded file paths.
 */
const DEFAULT_SOUNDTRACK: AudioConfig = {
  music: {
    title: { path: '/audio/Dramatic_Music_-_Theme_Title_Screen_1.mp3', volume: 0.5 },
    title2: { path: '/audio/Vocal_Track_3.mp3', volume: 0.475 },
    level1: { path: '/audio/level1.mp3', volume: 0.5 },
    level2: { path: '/audio/Short_Level_Music_1.mp3', volume: 0.5 },
    level3: { path: '/audio/Short_Level_Music_2.mp3', volume: 0.5 },
    level4: { path: '/audio/Short_Level_Music_3.mp3', volume: 0.5 },
    level5: { path: '/audio/Short_Level_Music_4.mp3', volume: 0.5 },
    level6: { path: '/audio/Dark_Level_Music_1.mp3', volume: 0.5 },
    level7: { path: '/audio/Short_Level_Music_5.mp3', volume: 0.5 },
    level8: { path: '/audio/Short_Level_Music_6.mp3', volume: 0.5 },
    level9: { path: '/audio/Short_Level_Music_7.mp3', volume: 0.5 },
    level10: { path: '/audio/Short_Level_Music_8.mp3', volume: 0.5 },
    level11: { path: '/audio/Dark_Level_Music_2.mp3', volume: 0.5 },
    level12: { path: '/audio/Short_Level_Music_9.mp3', volume: 0.5 },
    level13: { path: '/audio/Short_Level_Music_10.mp3', volume: 0.5 },
    level14: { path: '/audio/level6.mp3', volume: 0.5 },
    level15: { path: '/audio/level7.mp3', volume: 0.5 },
    level16: { path: '/audio/level8.mp3', volume: 0.5 },
    level17: { path: '/audio/Race_Music_2.mp3', volume: 0.5 },
    level18: { path: '/audio/Vocal_Track_2.mp3', volume: 0.5 },
    level19: { path: '/audio/Vocal_Track_3.mp3', volume: 0.5 },
    level20: { path: '/audio/level2.mp3', volume: 0.5 },
    endless1: { path: '/audio/Endless_Music_1.mp3', volume: 0.5 },
    endless2: { path: '/audio/Endless_Music_2.mp3', volume: 0.5 },
    endless3: { path: '/audio/Endless_Music_3.mp3', volume: 0.5 },
    endless4: { path: '/audio/Endless_Music_4.mp3', volume: 0.5 },
    endless5: { path: '/audio/Endless_Music_5.mp3', volume: 0.5 },
    missionSuccess: { path: '/audio/Bonus_Mode_2.mp3', volume: 0.5 },
    missionSuccess2: { path: null, volume: 0.5 },
    missionFail: { path: '/audio/Settings_Screen_Music_option.mp3', volume: 0.5 },
    highScore: { path: '/audio/Bonus_Mode_1.mp3', volume: 0.5 },
  },
  sfx: {
    thruster: { path: '/audio/thruster.mp3', volume: 1.0 },
    crash: { path: '/audio/landing_on_pad.mp3', volume: 0.7 },
    landing: { path: '/audio/fuel_10_percent_loop.mp3', volume: 1.0 },
    fuelAlarm: { path: '/audio/crash2.mp3', volume: 1.0 },
    introTick: { path: '/audio/sfx_video_game.mp3', volume: 1.0 },
    introGo: { path: '/audio/intro_go.mp3', volume: 1.0 },
    introWarp: { path: '/audio/intro_warp.mp3', volume: 1.0 },
    click: { path: null, volume: 0.1 },
    abort: { path: null, volume: 0.4 },
    shieldPickup: { path: '/audio/sfx_retro_game_2.mp3', volume: 1.0 },
    shieldBreak: { path: '/audio/sfx_success_fanfare_4.mp3', volume: 1.0 },
    junkPickup: { path: '/audio/sfx_short_retro_1.mp3', volume: 1.0 },
    junkSetComplete: { path: '/audio/sfx_retro_sound.mp3', volume: 1.0 },
    volcanoErupt: { path: null, volume: 0.8 },
    wormholeOpen: { path: '/audio/sfx_success_fanfare_4.mp3', volume: 1.0 },
    wormholeEnter: { path: null, volume: 0.5 },
    lightningRumble: { path: null, volume: 0.5 },
    lightningCrack: { path: null, volume: 0.5 },
    lightningImpact: { path: null, volume: 0.8 },
    jellyfishBurst: { path: null, volume: 0.5 },
    jellyfishShock: { path: null, volume: 0.5 },
    cometArrival: { path: '/audio/sfx_comet_1.mp3', volume: 1.0 },
    ufoSmall: { path: '/audio/sfx_comet_2.mp3', volume: 1.0 },
    ufoMedium: { path: '/audio/sfx_hovering_scifi_4.mp3', volume: 1.0 },
    ufoLarge: { path: '/audio/sfx_hovering_scifi_4b.mp3', volume: 1.0 },
  }
};

/**
 * Baked configurations for every soundtrack variant.
 * Currently only `default` has cloud overrides — the others use the
 * same baseline. Update this map when more soundtracks are configured.
 */
export const BAKED_AUDIO_CONFIGS: Record<SoundtrackType, AudioConfig> = {
  default: DEFAULT_SOUNDTRACK,
  retro: DEFAULT_SOUNDTRACK,
  modern: DEFAULT_SOUNDTRACK,
  hidden: DEFAULT_SOUNDTRACK,
};

/**
 * Backwards-compatible export — used by audioConfigService for
 * fallback when no soundtrack is specified.
 */
export const DEFAULT_AUDIO_CONFIG: AudioConfig = DEFAULT_SOUNDTRACK;

/**
 * Human-readable labels for audio events
 */
export const AUDIO_EVENT_LABELS: Record<AudioEventKey, string> = {
  // Music - Title & Menus
  title: 'Title Screen',
  title2: 'Title Screen 2',
  // Music - Level Tracks (1-20)
  level1: 'Level 1',
  level2: 'Level 2',
  level3: 'Level 3',
  level4: 'Level 4',
  level5: 'Level 5',
  level6: 'Level 6',
  level7: 'Level 7',
  level8: 'Level 8',
  level9: 'Level 9',
  level10: 'Level 10',
  level11: 'Level 11',
  level12: 'Level 12',
  level13: 'Level 13',
  level14: 'Level 14',
  level15: 'Level 15',
  level16: 'Level 16',
  level17: 'Level 17',
  level18: 'Level 18',
  level19: 'Level 19',
  level20: 'Level 20',
  // Music - Endless Mode
  endless1: 'Endless 1',
  endless2: 'Endless 2',
  endless3: 'Endless 3',
  endless4: 'Endless 4',
  endless5: 'Endless 5',
  // Music - Game Events
  missionSuccess: 'Mission Success',
  missionSuccess2: 'Mission Success 2',
  missionFail: 'Mission Fail',
  highScore: 'High Score',
  // SFX
  thruster: 'Thruster Engine',
  crash: 'Crash/Explosion',
  landing: 'Landing on Pad',
  fuelAlarm: 'Fuel Low Alarm',
  introTick: 'Countdown Tick',
  introGo: 'Countdown Go',
  introWarp: 'Level Warp',
  click: 'UI Click',
  abort: 'Abort/Cancel',
  shieldPickup: 'Shield Pickup',
  shieldBreak: 'Shield Break',
  junkPickup: 'Junk Pickup',
  junkSetComplete: 'Junk Set Complete',
  volcanoErupt: 'Volcano Eruption',
  wormholeOpen: 'Wormhole Open',
  wormholeEnter: 'Wormhole Enter',
  lightningRumble: 'Lightning Rumble',
  lightningCrack: 'Lightning Crack',
  lightningImpact: 'Lightning Impact',
  jellyfishBurst: 'Jellyfish Burst',
  jellyfishShock: 'Jellyfish Shock',
  cometArrival: 'Comet Arrival',
  ufoSmall: 'Small UFO',
  ufoMedium: 'Medium UFO',
  ufoLarge: 'Large UFO (Mothership)',
};

/**
 * Lists of keys for iteration
 */
export const MUSIC_EVENT_KEYS: MusicEventKey[] = [
  'title', 'title2',
  'level1', 'level2', 'level3', 'level4', 'level5',
  'level6', 'level7', 'level8', 'level9', 'level10',
  'level11', 'level12', 'level13', 'level14', 'level15',
  'level16', 'level17', 'level18', 'level19', 'level20',
  'endless1', 'endless2', 'endless3', 'endless4', 'endless5',
  'missionSuccess', 'missionSuccess2', 'missionFail', 'highScore'
];

export const SFX_EVENT_KEYS: SfxEventKey[] = [
  'thruster', 'crash', 'landing', 'fuelAlarm',
  'introTick', 'introGo', 'introWarp',
  'click', 'abort', 'shieldPickup', 'shieldBreak',
  'junkPickup', 'junkSetComplete', 'volcanoErupt',
  'wormholeOpen', 'wormholeEnter',
  'lightningRumble', 'lightningCrack', 'lightningImpact',
  'jellyfishBurst', 'jellyfishShock',
  'cometArrival', 'ufoSmall', 'ufoMedium', 'ufoLarge'
];
