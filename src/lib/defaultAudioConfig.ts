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
  level1: AudioEventConfig;
  level2: AudioEventConfig;
  level3: AudioEventConfig;
  level4: AudioEventConfig;
  level5: AudioEventConfig;
  level6: AudioEventConfig;
  level7: AudioEventConfig;
  level8: AudioEventConfig;
  missionSuccess: AudioEventConfig;
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
    level1: { path: '/audio/level1.mp3', volume: 0.5 },
    level2: { path: '/audio/level2.mp3', volume: 0.5 },
    level3: { path: '/audio/level3.mp3', volume: 0.5 },
    level4: { path: '/audio/level4.mp3', volume: 0.5 },
    level5: { path: '/audio/level5.mp3', volume: 0.5 },
    level6: { path: '/audio/level6.mp3', volume: 0.5 },
    level7: { path: '/audio/level7.mp3', volume: 0.5 },
    level8: { path: '/audio/level8.mp3', volume: 0.5 },
    missionSuccess: { path: '/audio/mission_success.mp3', volume: 0.5 },
    missionFail: { path: null, volume: 0.5 },
    highScore: { path: null, volume: 0.5 },
  },
  sfx: {
    thruster: { path: '/audio/thruster.mp3', volume: 1.0 },
    crash: { path: ['/audio/crash1.mp3', '/audio/crash2.mp3'], volume: 0.7 },
    landing: { path: '/audio/landing_on_pad.mp3', volume: 0.9 },
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
  }
};

/**
 * Human-readable labels for audio events
 */
export const AUDIO_EVENT_LABELS: Record<AudioEventKey, string> = {
  // Music
  title: 'Title Screen',
  level1: 'Level 1',
  level2: 'Level 2',
  level3: 'Level 3',
  level4: 'Level 4',
  level5: 'Level 5',
  level6: 'Level 6',
  level7: 'Level 7',
  level8: 'Level 8',
  missionSuccess: 'Mission Success',
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
};

/**
 * Lists of keys for iteration
 */
export const MUSIC_EVENT_KEYS: MusicEventKey[] = [
  'title', 'level1', 'level2', 'level3', 'level4', 
  'level5', 'level6', 'level7', 'level8', 
  'missionSuccess', 'missionFail', 'highScore'
];

export const SFX_EVENT_KEYS: SfxEventKey[] = [
  'thruster', 'crash', 'landing', 'fuelAlarm',
  'introTick', 'introGo', 'introWarp',
  'click', 'abort', 'shieldPickup', 'shieldBreak',
  'junkPickup', 'junkSetComplete', 'volcanoErupt',
  'wormholeOpen', 'wormholeEnter',
  'lightningRumble', 'lightningCrack', 'lightningImpact',
  'jellyfishBurst', 'jellyfishShock'
];
