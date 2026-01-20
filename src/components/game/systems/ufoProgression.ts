/**
 * UFO Progression System
 * 
 * Deterministic UFO spawning that gradually introduces UFOs starting from level 10.
 * All UFO behavior (types, timing, difficulty) is seeded for consistent playthrough reproducibility.
 * 
 * NOT used in Time Trial mode.
 */

import type { UFOType } from "../types/landerUFO";

// Seeded RNG (Mulberry32) for deterministic spawn times
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LevelUFOConfig {
  level: number;
  smallEnabled: boolean;
  mediumEnabled: boolean;
  largeEnabled: boolean;
  maxSimultaneous: number;
  difficulty: number; // 1-10 scale
  spawnDelayMin: number; // seconds before first UFO
  spawnDelayMax: number;
  spawnIntervalMin: number; // seconds between UFOs
  spawnIntervalMax: number;
}

export interface UFOSpawnEvent {
  spawnTime: number;      // seconds into level
  ufoType: UFOType;
  difficulty: number;
  seedOffset: number;     // for deterministic UFO behavior
  spawned: boolean;       // tracking flag
}

// Fixed configuration for levels 10-34 (hand-tuned progression)
const UFO_LEVEL_CONFIGS: LevelUFOConfig[] = [
  // Phase 1: Introduction (Levels 10-14) - Small UFO only, easy
  { level: 10, smallEnabled: true, mediumEnabled: false, largeEnabled: false, maxSimultaneous: 1, difficulty: 1, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  // 11 = rest
  { level: 12, smallEnabled: true, mediumEnabled: false, largeEnabled: false, maxSimultaneous: 1, difficulty: 1, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  // 13 = rest
  { level: 14, smallEnabled: true, mediumEnabled: false, largeEnabled: false, maxSimultaneous: 1, difficulty: 2, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  
  // Phase 2: Medium Introduction (Levels 15-19)
  { level: 15, smallEnabled: false, mediumEnabled: true, largeEnabled: false, maxSimultaneous: 1, difficulty: 1, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 16, smallEnabled: true, mediumEnabled: false, largeEnabled: false, maxSimultaneous: 1, difficulty: 2, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  // 17 = rest
  { level: 18, smallEnabled: false, mediumEnabled: true, largeEnabled: false, maxSimultaneous: 1, difficulty: 2, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 19, smallEnabled: true, mediumEnabled: true, largeEnabled: false, maxSimultaneous: 2, difficulty: 2, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  
  // Phase 3: Mothership Introduction (Levels 20-24)
  { level: 20, smallEnabled: false, mediumEnabled: false, largeEnabled: true, maxSimultaneous: 1, difficulty: 1, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 21, smallEnabled: true, mediumEnabled: false, largeEnabled: false, maxSimultaneous: 1, difficulty: 3, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 22, smallEnabled: false, mediumEnabled: true, largeEnabled: false, maxSimultaneous: 1, difficulty: 3, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  // 23 = rest
  { level: 24, smallEnabled: false, mediumEnabled: false, largeEnabled: true, maxSimultaneous: 1, difficulty: 2, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  
  // Phase 4: Mixed Encounters (Levels 25-34)
  { level: 25, smallEnabled: true, mediumEnabled: true, largeEnabled: false, maxSimultaneous: 2, difficulty: 3, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 26, smallEnabled: true, mediumEnabled: false, largeEnabled: true, maxSimultaneous: 2, difficulty: 2, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 27, smallEnabled: false, mediumEnabled: true, largeEnabled: true, maxSimultaneous: 2, difficulty: 2, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  // 28 = rest
  { level: 29, smallEnabled: true, mediumEnabled: true, largeEnabled: false, maxSimultaneous: 2, difficulty: 4, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 30, smallEnabled: true, mediumEnabled: true, largeEnabled: true, maxSimultaneous: 2, difficulty: 3, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 31, smallEnabled: true, mediumEnabled: false, largeEnabled: false, maxSimultaneous: 2, difficulty: 4, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  { level: 32, smallEnabled: false, mediumEnabled: true, largeEnabled: true, maxSimultaneous: 2, difficulty: 4, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
  // 33 = rest
  { level: 34, smallEnabled: true, mediumEnabled: true, largeEnabled: true, maxSimultaneous: 3, difficulty: 4, spawnDelayMin: 5, spawnDelayMax: 10, spawnIntervalMin: 5, spawnIntervalMax: 10 },
];

// Levels that should have no UFOs (rest levels)
const REST_LEVELS = new Set([11, 13, 17, 23, 28, 33]);

/**
 * Generate a deterministic seed for UFO spawning
 */
export function generateUFOSeed(mode: string, level: number, baseSeed: number): number {
  let hash = baseSeed;
  // Mix in mode
  for (let i = 0; i < mode.length; i++) {
    hash = ((hash << 5) - hash + mode.charCodeAt(i)) & 0xffffffff;
  }
  // Mix in level with a prime multiplier
  hash = ((hash << 5) - hash + level * 7919) & 0xffffffff;
  // Mix in "UFO" identifier
  hash = ((hash << 5) - hash + "UFO".charCodeAt(0)) & 0xffffffff;
  hash = ((hash << 5) - hash + "UFO".charCodeAt(1)) & 0xffffffff;
  hash = ((hash << 5) - hash + "UFO".charCodeAt(2)) & 0xffffffff;
  return Math.abs(hash);
}

/**
 * Check if a level should have UFOs (not Time Trial, not a rest level)
 */
export function shouldHaveUFOs(mode: string, level: number, isTimeTrial: boolean): boolean {
  // Never in Time Trial
  if (isTimeTrial || mode === "timetrial") return false;
  
  // Not before level 10
  if (level < 10) return false;
  
  // Check fixed rest levels (10-34)
  if (level <= 34 && REST_LEVELS.has(level)) return false;
  
  // For levels 35+, every 5th level is a rest level (35, 40, 45, 50...)
  if (level >= 35 && level % 5 === 0) return false;
  
  return true;
}

/**
 * Get UFO configuration for a specific level
 * Uses fixed configs for levels 10-34, formula-based for 35+
 */
export function getUFOConfigForLevel(
  level: number,
  mode: string,
  baseSeed: number
): LevelUFOConfig | null {
  // No UFOs before level 10
  if (level < 10) return null;
  
  // Check rest levels
  if (level <= 34 && REST_LEVELS.has(level)) return null;
  if (level >= 35 && level % 5 === 0) return null;
  
  // Look up fixed config
  const fixedConfig = UFO_LEVEL_CONFIGS.find(c => c.level === level);
  if (fixedConfig) return fixedConfig;
  
  // Formula-based config for level 35+
  // All three types enabled
  // Max simultaneous: min(3, floor((level - 30) / 5) + 2)
  // Difficulty: min(10, floor((level - 30) / 3) + 4)
  const maxSimultaneous = Math.min(3, Math.floor((level - 30) / 5) + 2);
  const difficulty = Math.min(10, Math.floor((level - 30) / 3) + 4);
  
  return {
    level,
    smallEnabled: true,
    mediumEnabled: true,
    largeEnabled: true,
    maxSimultaneous,
    difficulty,
    spawnDelayMin: 5,
    spawnDelayMax: 10,
    spawnIntervalMin: 5,
    spawnIntervalMax: 10
  };
}

/**
 * Generate a deterministic spawn schedule for a level
 * Pre-computes all spawn times and UFO types at level start
 */
export function generateUFOSpawnSchedule(
  config: LevelUFOConfig,
  seed: number
): UFOSpawnEvent[] {
  const rng = mulberry32(seed);
  const schedule: UFOSpawnEvent[] = [];
  
  // Collect enabled UFO types
  const enabledTypes: UFOType[] = [];
  if (config.smallEnabled) enabledTypes.push("small");
  if (config.mediumEnabled) enabledTypes.push("medium");
  if (config.largeEnabled) enabledTypes.push("large");
  
  if (enabledTypes.length === 0) return schedule;
  
  // Calculate how many UFOs to spawn over the level
  // Levels typically last 30-90 seconds, so spawn 2-6 UFOs total
  const levelDuration = 60; // Assume average 60 second level
  const spawnInterval = (config.spawnIntervalMin + config.spawnIntervalMax) / 2;
  const maxSpawns = Math.min(
    6, // Cap at 6 UFOs per level
    Math.floor(levelDuration / spawnInterval) + 1
  );
  
  // Generate spawn times
  let currentTime = config.spawnDelayMin + rng() * (config.spawnDelayMax - config.spawnDelayMin);
  
  for (let i = 0; i < maxSpawns; i++) {
    // Pick UFO type (round-robin through enabled types for variety)
    const typeIndex = i % enabledTypes.length;
    const ufoType = enabledTypes[typeIndex];
    
    // Randomize type selection a bit (50% chance to use sequential, 50% random)
    const actualType = rng() > 0.5 ? ufoType : enabledTypes[Math.floor(rng() * enabledTypes.length)];
    
    schedule.push({
      spawnTime: currentTime,
      ufoType: actualType,
      difficulty: config.difficulty,
      seedOffset: i,
      spawned: false
    });
    
    // Calculate next spawn time
    const interval = config.spawnIntervalMin + rng() * (config.spawnIntervalMax - config.spawnIntervalMin);
    currentTime += interval;
  }
  
  return schedule;
}

/**
 * Check Medley-specific UFO logic
 * Only normal levels in Medley get UFOs, with additional progression consideration
 */
export function getMedleyUFOConfigForLevel(
  medleyStage: number,
  normalLevelsCompleted: number,
  baseSeed: number
): LevelUFOConfig | null {
  // Medley normal levels map to game "level" based on how many normals completed
  // First normal level in medley cycle = level 1, etc.
  // We use normalLevelsCompleted + 1 as the effective level
  const effectiveLevel = normalLevelsCompleted + 1;
  
  // No UFOs until the player has completed 9 normal levels (i.e., on their 10th normal level)
  if (effectiveLevel < 10) return null;
  
  // Use the standard progression config
  return getUFOConfigForLevel(effectiveLevel, "medley", baseSeed);
}

/**
 * Get the maximum number of active UFOs allowed for a level
 */
export function getMaxActiveUFOs(config: LevelUFOConfig): number {
  return config.maxSimultaneous;
}

/**
 * Get UFO difficulty for a specific type based on level config
 * All types share the same base difficulty, but types can have modifiers
 */
export function getTypeDifficulty(config: LevelUFOConfig, type: UFOType): number {
  // For now, all types use the same difficulty from config
  // Could add type-specific modifiers in the future
  return config.difficulty;
}
