// Medley Mode Configuration System
// Defines the 14-level cycle pattern with progressive difficulty and UFO introduction

import { Difficulty } from '../types';

export type MedleyLevelType = 
  | 'normal' 
  | 'timetrial' 
  | 'darkside' 
  | 'storm' 
  | 'collection' 
  | 'search' 
  | 'underwater';

/**
 * The fixed 14-level cycle that repeats in Medley Mode
 */
export const MEDLEY_CYCLE: MedleyLevelType[] = [
  'normal',      // 1
  'normal',      // 2
  'timetrial',   // 3
  'normal',      // 4
  'darkside',    // 5
  'normal',      // 6
  'storm',       // 7
  'normal',      // 8
  'collection',  // 9
  'normal',      // 10
  'search',      // 11
  'timetrial',   // 12
  'normal',      // 13
  'underwater'   // 14
];

/**
 * Get the level type for a specific medley stage (1-indexed)
 */
export function getMedleyLevelType(medleyStage: number): MedleyLevelType {
  // Normalize 0-indexed level to 1-indexed stage
  const normalizedStage = Math.max(1, medleyStage);
  const cycleIndex = (normalizedStage - 1) % MEDLEY_CYCLE.length;
  return MEDLEY_CYCLE[cycleIndex];
}

/**
 * Get the linear difficulty for a medley stage
 * Stage 1 = difficulty 1, stage 15 = difficulty 15, etc.
 */
export function getMedleyDifficulty(medleyStage: number): number {
  return Math.max(1, medleyStage);
}

/**
 * Get which cycle number (1-indexed) the stage is in
 * Stages 1-14 = cycle 1, stages 15-28 = cycle 2, etc.
 */
export function getMedleyCycle(medleyStage: number): number {
  const normalizedStage = Math.max(1, medleyStage);
  return Math.floor((normalizedStage - 1) / MEDLEY_CYCLE.length) + 1;
}

/**
 * Get the stage within the current cycle (1-14)
 */
export function getMedleyCycleStage(medleyStage: number): number {
  const normalizedStage = Math.max(1, medleyStage);
  return ((normalizedStage - 1) % MEDLEY_CYCLE.length) + 1;
}

/**
 * Count how many 'normal' levels have been completed before this stage
 */
export function countNormalLevelsCompleted(currentStage: number): number {
  const normalizedStage = Math.max(1, currentStage);
  let count = 0;
  for (let stage = 1; stage < normalizedStage; stage++) {
    if (getMedleyLevelType(stage) === 'normal') {
      count++;
    }
  }
  return count;
}

/**
 * UFO configuration for Medley Mode based on normal levels completed
 */
export interface MedleyUFOConfig {
  smallEnabled: boolean;
  mediumEnabled: boolean;
  largeEnabled: boolean;
  maxSimultaneous: number;
  allowCombinations: boolean; // Whether to allow mixed UFO types
}

/**
 * Get UFO spawn configuration based on progression
 * - After 5 normal levels: Small UFO
 * - After 7 normal levels: Medium UFO  
 * - After 10 normal levels: Large (Mothership)
 * - After all introduced: Random combinations (1-3 UFOs)
 */
export function getMedleyUFOConfig(
  normalLevelsCompleted: number,
  difficulty: number
): MedleyUFOConfig {
  const baseConfig: MedleyUFOConfig = {
    smallEnabled: false,
    mediumEnabled: false,
    largeEnabled: false,
    maxSimultaneous: 0,
    allowCombinations: false
  };

  // No UFOs until 5 normal levels completed
  if (normalLevelsCompleted < 5) {
    return baseConfig;
  }

  // Small UFO after 5 normal levels
  if (normalLevelsCompleted >= 5) {
    baseConfig.smallEnabled = true;
    baseConfig.maxSimultaneous = 1;
  }

  // Add Medium UFO after 7 normal levels
  if (normalLevelsCompleted >= 7) {
    baseConfig.mediumEnabled = true;
    baseConfig.maxSimultaneous = 2;
  }

  // Add Large (Mothership) after 10 normal levels
  if (normalLevelsCompleted >= 10) {
    baseConfig.largeEnabled = true;
    baseConfig.maxSimultaneous = 2;
  }

  // After all introduced (12+ normal levels), allow combinations
  if (normalLevelsCompleted >= 12) {
    baseConfig.allowCombinations = true;
    baseConfig.maxSimultaneous = 3;
  }

  return baseConfig;
}

/**
 * Check if the current medley stage should spawn UFOs
 * Only normal levels spawn UFOs
 */
export function shouldSpawnUFOsInMedley(medleyStage: number): boolean {
  return getMedleyLevelType(medleyStage) === 'normal';
}

/**
 * Get which Regular Landing level number this is within the current cycle (1-7)
 * Returns 0 if not a normal level
 */
export function getMedleyNormalLevelNumber(medleyStage: number): number {
  if (getMedleyLevelType(medleyStage) !== 'normal') return 0;
  
  const cycleStage = getMedleyCycleStage(medleyStage);
  // Map cycle positions to normal level numbers: 1→1, 2→2, 4→3, 6→4, 8→5, 10→6, 13→7
  const normalPositions = [1, 2, 4, 6, 8, 10, 13];
  return normalPositions.indexOf(cycleStage) + 1;
}

/**
 * Check if this is one of the first 5 Regular Landing levels in cycle 1
 */
export function isEarlyMedleyNormalLevel(medleyStage: number): boolean {
  const cycle = getMedleyCycle(medleyStage);
  const normalNum = getMedleyNormalLevelNumber(medleyStage);
  const result = cycle === 1 && normalNum >= 1 && normalNum <= 5;
  console.log('🔍 Early Medley Check:', { medleyStage, cycle, normalNum, result });
  return result;
}

/**
 * Seed fixups for specific medley stages where the default seed produces
 * bad terrain/mega-pad placement (e.g. pad extending off terrain edge).
 * Values are arbitrary offsets that shift the seed enough to get new terrain.
 */
const MEDLEY_SEED_FIXUPS: Record<number, number> = {
  2: 31337,   // Level 2 (3rd played) - mega pad was going off terrain
  6: 71093,   // Level 6 (7th played) - mega pad was going off terrain
};

/**
 * Generate a deterministic seed for a medley stage
 */
export function getMedleySeed(medleyStage: number, difficulty: Difficulty): number {
  const normalizedStage = Math.max(1, medleyStage);
  const baseSeed = 942735; // Medley-specific base seed
  const difficultyOffset = difficulty === "hard" ? 200000 : 0;
  
  // Add unique offset for early cycle 1 levels to force new terrain generation
  const earlyMedleyOffset = isEarlyMedleyNormalLevel(normalizedStage) ? 500000 : 0;
  const fixupOffset = MEDLEY_SEED_FIXUPS[normalizedStage] || 0;
  
  const finalSeed = baseSeed + difficultyOffset + earlyMedleyOffset + fixupOffset + normalizedStage * 7919;
  console.log('🌱 Medley Seed:', { medleyStage, normalizedStage, earlyMedleyOffset, finalSeed });
  
  return finalSeed;
}
