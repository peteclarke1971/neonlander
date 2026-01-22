/**
 * Default Audio Configuration
 * 
 * This file contains the hardcoded fallback audio paths that match the
 * current game behavior exactly. The audioConfigService will use these
 * as defaults if the cloud configuration is unavailable.
 * 
 * To update defaults: Use the Audio Settings page to configure audio,
 * then export to JSON and replace the contents of this file.
 */

export type SoundtrackType = 'default' | 'retro' | 'modern' | 'hidden';

export interface AudioEventConfig {
  path: string | string[] | null;
  volume?: number;
}

export interface MusicConfig {
  title: AudioEventConfig;
  title2: AudioEventConfig;
  // 20 level tracks (cycle through these for Fixed, Classic, Medley modes)
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
  // 5 Endless mode tracks (shuffled playlist)
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
 * Default audio configuration matching current game behavior.
 * All paths are relative to /public/audio/
 */
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  music: {
    title: { path: '/audio/title.mp3', volume: 0.5 },
    title2: { path: null, volume: 0.5 },
    // 20 level tracks - levels 9-20 fallback to cycling through 1-8
    level1: { path: '/audio/level1.mp3', volume: 0.5 },
    level2: { path: '/audio/level2.mp3', volume: 0.5 },
    level3: { path: '/audio/level3.mp3', volume: 0.5 },
    level4: { path: '/audio/level4.mp3', volume: 0.5 },
    level5: { path: '/audio/level5.mp3', volume: 0.5 },
    level6: { path: '/audio/level6.mp3', volume: 0.5 },
    level7: { path: '/audio/level7.mp3', volume: 0.5 },
    level8: { path: '/audio/level8.mp3', volume: 0.5 },
    level9: { path: '/audio/level1.mp3', volume: 0.5 },
    level10: { path: '/audio/level2.mp3', volume: 0.5 },
    level11: { path: '/audio/level3.mp3', volume: 0.5 },
    level12: { path: '/audio/level4.mp3', volume: 0.5 },
    level13: { path: '/audio/level5.mp3', volume: 0.5 },
    level14: { path: '/audio/level6.mp3', volume: 0.5 },
    level15: { path: '/audio/level7.mp3', volume: 0.5 },
    level16: { path: '/audio/level8.mp3', volume: 0.5 },
    level17: { path: '/audio/level1.mp3', volume: 0.5 },
    level18: { path: '/audio/level2.mp3', volume: 0.5 },
    level19: { path: '/audio/level3.mp3', volume: 0.5 },
    level20: { path: '/audio/level4.mp3', volume: 0.5 },
    // 5 Endless mode tracks - assign unique tracks for survival/endless mode
    endless1: { path: '/audio/Endless_Music_1.mp3', volume: 0.5 },
    endless2: { path: '/audio/Endless_Music_2.mp3', volume: 0.5 },
    endless3: { path: '/audio/Endless_Music_3.mp3', volume: 0.5 },
    endless4: { path: '/audio/Endless_Music_4.mp3', volume: 0.5 },
    endless5: { path: '/audio/Endless_Music_5.mp3', volume: 0.5 },
    missionSuccess: { path: '/audio/mission_success.mp3', volume: 0.5 },
    missionSuccess2: { path: null, volume: 0.5 },
    missionFail: { path: null, volume: 0.5 },
    highScore: { path: null, volume: 0.5 },
  },
  sfx: {
    thruster: { path: '/audio/thruster.mp3', volume: 1.0 },
    // Note: landing_on_pad.mp3 contains explosion sound, crash files contain landing sounds
    crash: { path: '/audio/landing_on_pad.mp3', volume: 0.7 },
    landing: { path: ['/audio/crash1.mp3', '/audio/crash2.mp3'], volume: 0.9 },
    fuelAlarm: { path: '/audio/fuel_10_percent_loop.mp3', volume: 0.6 },
    introTick: { path: '/audio/intro_tick.mp3', volume: 1.0 },
    introGo: { path: '/audio/intro_go.mp3', volume: 1.0 },
    introWarp: { path: '/audio/intro_warp.mp3', volume: 1.0 },
    click: { path: null, volume: 0.1 }, // Synthesized
    abort: { path: null, volume: 0.4 }, // Synthesized
    shieldPickup: { path: null, volume: 0.5 }, // Uses success + click
    shieldBreak: { path: null, volume: 0.2 }, // Synthesized
    junkPickup: { path: null, volume: 0.5 },
    junkSetComplete: { path: null, volume: 0.5 },
    volcanoErupt: { path: null, volume: 0.8 }, // Uses landing sound
    wormholeOpen: { path: null, volume: 0.5 },
    wormholeEnter: { path: null, volume: 0.5 },
    lightningRumble: { path: null, volume: 0.5 },
    lightningCrack: { path: null, volume: 0.5 },
    lightningImpact: { path: null, volume: 0.8 },
    jellyfishBurst: { path: null, volume: 0.5 },
    jellyfishShock: { path: null, volume: 0.5 },
    cometArrival: { path: '/audio/Comet_coming.mp3', volume: 0.7 },
    ufoSmall: { path: '/audio/sfx_hovering_scifi_1.mp3', volume: 0.5 },
    ufoMedium: { path: '/audio/sfx_hovering_scifi_3.mp3', volume: 0.5 },
    ufoLarge: { path: '/audio/sfx_ominous_1.mp3', volume: 0.6 },
  }
};

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
