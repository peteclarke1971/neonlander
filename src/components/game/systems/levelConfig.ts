// Level type configuration system
// Allows any level to be configured as water, lightning, volcanic, etc.

import { Mode } from '../types';
import { getMedleyLevelType } from './medleyConfig';

export type LevelType = "water" | "lightning" | "volcanic" | "collection" | "normal";

export interface LevelConfig {
  type: LevelType;
}

/**
 * Get the classic mode level type for a given level number.
 * Level 1: collection
 * Level 5: storm (1st storm)
 * Level 8: water (1st water)
 * Level 17, 27, 37, ...: water (every 10 from 17+)
 * Level 20, 30, 40, ...: storm (every 10 from 20+)
 */
function getClassicLevelType(level: number): LevelType {
  if (level === 1) return "collection";
  if (level === 5) return "lightning";
  if (level === 8) return "water";
  // Recurring patterns (from level 17+ for water, 20+ for storms)
  if (level >= 20 && level % 10 === 0) return "lightning";
  if (level >= 17 && level % 10 === 7) return "water";
  return "normal";
}

/**
 * Get which storm occurrence a given classic level is (1-based).
 * Level 5 = 1st storm, Level 20 = 2nd, Level 30 = 3rd, etc.
 */
export function getStormOccurrence(level: number): number {
  if (level < 5) return 0;
  if (level === 5) return 1;
  if (level < 20) return 1; // only level 5 before 20
  // Level 20 = 2nd, 30 = 3rd, 40 = 4th, ...
  return 2 + Math.floor((level - 20) / 10);
}

/**
 * Get which water occurrence a given classic level is (1-based).
 * Level 8 = 1st water, Level 17 = 2nd, Level 27 = 3rd, etc.
 */
export function getWaterOccurrence(level: number): number {
  if (level < 8) return 0;
  if (level === 8) return 1;
  if (level < 17) return 1; // only level 8 before 17
  // Level 17 = 2nd, 27 = 3rd, 37 = 4th, ...
  return 2 + Math.floor((level - 17) / 10);
}

/**
 * Get the configuration for a medley stage
 */
export function getMedleyLevelConfig(stage: number): LevelConfig {
  const medleyType = getMedleyLevelType(stage);
  
  // Map medley types to level config types
  switch (medleyType) {
    case 'storm': return { type: 'lightning' };
    case 'underwater': return { type: 'water' };
    case 'collection': return { type: 'collection' };
    default: return { type: 'normal' };
  }
}

/**
 * Get the configuration for a specific level
 */
export function getLevelConfig(mode: Mode, level: number): LevelConfig {
  // Handle medley mode
  if (mode === "medley") {
    return getMedleyLevelConfig(level);
  }
  
  // Only apply special configs in classic mode
  if (mode === "classic") {
    return { type: getClassicLevelType(level) };
  }
  return { type: "normal" };
}

/**
 * Check if the current level is a water level
 */
export function isWaterLevel(mode: Mode, level: number): boolean {
  if (mode === "medley") {
    return getMedleyLevelType(level) === 'underwater';
  }
  return getLevelConfig(mode, level).type === "water";
}

/**
 * Check if the current level is a lightning level
 */
export function isLightningLevel(mode: Mode, level: number): boolean {
  if (mode === "medley") {
    return getMedleyLevelType(level) === 'storm';
  }
  return getLevelConfig(mode, level).type === "lightning";
}

/**
 * Check if the current level is a volcanic level
 */
export function isVolcanicLevel(mode: Mode, level: number): boolean {
  return getLevelConfig(mode, level).type === "volcanic";
}

/**
 * Check if the current level is a collection level
 */
export function isCollectionLevel(mode: Mode, level: number): boolean {
  if (mode === "medley") {
    return getMedleyLevelType(level) === 'collection';
  }
  return getLevelConfig(mode, level).type === "collection";
}
