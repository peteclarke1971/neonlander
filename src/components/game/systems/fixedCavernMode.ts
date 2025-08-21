// Integration layer for fixed cavern mode support
// This module handles the logic for determining when to use fixed vs procedural cavern generation

import { getFixedCavernSeed, isFixedCavernLevel } from './fixedCavernLevels';
import { Mode, Difficulty } from '../types';

/**
 * Determines the appropriate seed for cavern generation based on game mode and level
 */
export function getCavernSeed(mode: Mode, level: number, difficulty: Difficulty, baseSeed: number): number {
  // For caverns mode, use fixed seeds for levels 0-49 when in fixed mode
  if (mode === "caverns") {
    if (isFixedCavernLevel(level)) {
      return getFixedCavernSeed(level, difficulty);
    } else {
      // For levels beyond 49, use procedural generation with base seed
      const fixedSeed = baseSeed + (difficulty === "hard" ? 100000 : 0) + level * 9973;
      return fixedSeed;
    }
  }
  
  // For fixed mode (non-cavern levels), use deterministic seeds
  if (mode === "fixed") {
    const fixedSeed = baseSeed + (difficulty === "hard" ? 100000 : 0) + level * 9973;
    return fixedSeed;
  }
  
  // For classic mode, use truly random seeds
  return Math.floor(Math.random() * 1e9);
}

/**
 * Checks if the current configuration should use deterministic generation
 */
export function shouldUseDeterministicGeneration(mode: Mode, level: number): boolean {
  if (mode === "fixed") {
    return true;
  }
  
  if (mode === "caverns" && isFixedCavernLevel(level)) {
    return true;
  }
  
  return false;
}

/**
 * Gets the display name for the current mode
 */
export function getModeDisplayName(mode: Mode): string {
  switch (mode) {
    case "classic":
      return "Classic (Procedural)";
    case "fixed":
      return "Fixed Levels";
    case "caverns":
      return "Cavern Explorer";
    default:
      return mode;
  }
}