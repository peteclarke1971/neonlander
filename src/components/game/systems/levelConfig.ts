// Level type configuration system
// Allows any level to be configured as water, lightning, volcanic, etc.

import { Mode } from '../types';

export type LevelType = "water" | "lightning" | "volcanic" | "collection" | "normal";

export interface LevelConfig {
  type: LevelType;
}

// Define which levels have special types
export const LEVEL_CONFIGURATIONS: Record<number, LevelConfig> = {
  1: { type: "collection" }, // Collection level for testing
  4: { type: "lightning" },
  5: { type: "water" },
  6: { type: "water" },
};

/**
 * Get the configuration for a specific level
 */
export function getLevelConfig(mode: Mode, level: number): LevelConfig {
  // Only apply special configs in classic mode
  if (mode === "classic") {
    return LEVEL_CONFIGURATIONS[level] || { type: "normal" };
  }
  return { type: "normal" };
}

/**
 * Check if the current level is a water level
 */
export function isWaterLevel(mode: Mode, level: number): boolean {
  return getLevelConfig(mode, level).type === "water";
}

/**
 * Check if the current level is a lightning level
 */
export function isLightningLevel(mode: Mode, level: number): boolean {
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
  return getLevelConfig(mode, level).type === "collection";
}
