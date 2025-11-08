// Time Trial Level Configuration System
// Defines 50 fixed campaign-style levels with deterministic seeds and progressive difficulty

import { Difficulty } from '../types';

export interface TimeTrialLevelConfig {
  level: number;
  seed: number;
  padCount: 2 | 3 | 4 | 5;
  hasSpaceJunk: boolean;
  hasGravityWells: boolean;
  hasVolcanoes: boolean;
  colorIndex: number; // 0-5 for color progression
  description: string;
}

const BASE_SEED = 42000; // Different from main game to avoid overlap

/**
 * Generate deterministic seed for a Time Trial level
 */
function getTimeTrialSeed(level: number, difficulty: Difficulty): number {
  const difficultyOffset = difficulty === "hard" ? 500000 : 0;
  return BASE_SEED + difficultyOffset + level * 7919;
}

/**
 * Define all 50 Time Trial levels with progressive complexity
 */
// VALIDATED SEEDS - All seeds tested to produce correct pad counts
export const TIME_TRIAL_LEVELS: TimeTrialLevelConfig[] = [
  { level: 0, seed: 42000, padCount: 2, hasSpaceJunk: false, hasVolcanoes: false, hasGravityWells: false, colorIndex: 0, description: "First Steps" }, // ✅ Validated
  { level: 1, seed: 49919, padCount: 2, hasSpaceJunk: false, hasVolcanoes: false, hasGravityWells: false, colorIndex: 0, description: "Getting Started" }, // ✅ Validated
  { level: 2, seed: 57838, padCount: 2, hasSpaceJunk: false, hasVolcanoes: false, hasGravityWells: false, colorIndex: 1, description: "Building Speed" }, // ✅ Validated
  { level: 3, seed: 65757, padCount: 2, hasSpaceJunk: false, hasVolcanoes: false, hasGravityWells: false, colorIndex: 1, description: "Quick Hops" }, // ✅ Validated
  { level: 4, seed: 73676, padCount: 3, hasSpaceJunk: false, hasVolcanoes: false, hasGravityWells: false, colorIndex: 2, description: "Triple Run" }, // ✅ Validated
  { level: 5, seed: 81595, padCount: 3, hasSpaceJunk: false, hasVolcanoes: false, hasGravityWells: false, colorIndex: 2, description: "Three Points" }, // ✅ Validated
  { level: 6, seed: 89514, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: false, colorIndex: 3, description: "Junk Field" }, // ✅ Validated
  { level: 7, seed: 97433, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: false, colorIndex: 3, description: "Debris Zone" }, // ✅ Validated
  { level: 8, seed: 105352, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: false, colorIndex: 4, description: "Salvage Run" }, // ✅ Validated
  { level: 9, seed: 113271, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: false, colorIndex: 4, description: "Circuit Practice" }, // ✅ Validated
  { level: 10, seed: 1099730, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: false, colorIndex: 5, description: "Three Hop" }, // ✅ Validated (replaced, +0 attempts)
  { level: 11, seed: 1109703, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: false, colorIndex: 5, description: "Quick Collection" }, // ✅ Validated (replaced, +0 attempts)
  { level: 12, seed: 1119676, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: false, colorIndex: 0, description: "Scavenger" }, // ✅ Validated (replaced, +0 attempts)
  { level: 13, seed: 1129649, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: true, colorIndex: 0, description: "Gravity Introduction" }, // ✅ Validated (replaced, +0 attempts)
  { level: 14, seed: 1139622, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: true, colorIndex: 1, description: "Distortion Run" }, // ✅ Validated (replaced, +0 attempts)
  { level: 15, seed: 1149595, padCount: 3, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: true, colorIndex: 1, description: "Mega Introduction" }, // ✅ Validated (replaced, +0 attempts)
  { level: 16, seed: 1159568, padCount: 4, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: true, colorIndex: 2, description: "Quad Challenge" }, // ✅ Validated (replaced, +0 attempts)
  { level: 17, seed: 1169541, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 2, description: "Volcanic Entry" }, // ✅ Validated (replaced, +0 attempts)
  { level: 18, seed: 1179514, padCount: 5, hasSpaceJunk: true, hasVolcanoes: false, hasGravityWells: true, colorIndex: 3, description: "Five Point" }, // ✅ Validated (replaced, +0 attempts)
  { level: 19, seed: 1189487, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 3, description: "Lava Quad" }, // ✅ Validated (replaced, +0 attempts)
  { level: 20, seed: 1199460, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 4, description: "Hot Route" }, // ✅ Validated (replaced, +0 attempts)
  { level: 21, seed: 1209433, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 4, description: "Pentathlon" }, // ✅ Validated (replaced, +0 attempts)
  { level: 22, seed: 1219406, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 5, description: "Gravity Pull" }, // ✅ Validated (replaced, +0 attempts)
  { level: 23, seed: 1229379, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 5, description: "Triple Inferno" }, // ✅ Validated (replaced, +0 attempts)
  { level: 24, seed: 1239352, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 0, description: "Five Star" }, // ✅ Validated (replaced, +0 attempts)
  { level: 25, seed: 1249325, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 0, description: "Anomaly Field" }, // ✅ Validated (replaced, +0 attempts)
  { level: 26, seed: 1259298, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 1, description: "Volcanic Circuit" }, // ✅ Validated (replaced, +0 attempts)
  { level: 27, seed: 1269271, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 1, description: "Expert Five" }, // ✅ Validated (replaced, +0 attempts)
  { level: 28, seed: 1279244, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 2, description: "Warped Space" }, // ✅ Validated (replaced, +0 attempts)
  { level: 29, seed: 1289217, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 2, description: "Danger Triple" }, // ✅ Validated (replaced, +0 attempts)
  { level: 30, seed: 1299190, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 3, description: "Ultimate Five" }, // ✅ Validated (replaced, +0 attempts)
  { level: 31, seed: 1309163, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 3, description: "Eruption Zone" }, // ✅ Validated (replaced, +0 attempts)
  { level: 32, seed: 1319136, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 4, description: "Elite Triple" }, // ✅ Validated (replaced, +0 attempts)
  { level: 33, seed: 1329109, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 4, description: "Master Course" }, // ✅ Validated (replaced, +0 attempts)
  { level: 34, seed: 1339082, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 5, description: "Inferno Path" }, // ✅ Validated (replaced, +0 attempts)
  { level: 35, seed: 1349055, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 5, description: "Hot Landing" }, // ✅ Validated (replaced, +0 attempts)
  { level: 36, seed: 1359028, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 0, description: "Champion Five" }, // ✅ Validated (replaced, +0 attempts)
  { level: 37, seed: 1369001, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 0, description: "Molten Path" }, // ✅ Validated (replaced, +0 attempts)
  { level: 38, seed: 1378974, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 1, description: "Triple Threat" }, // ✅ Validated (replaced, +0 attempts)
  { level: 39, seed: 1388947, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 1, description: "Legendary Five" }, // ✅ Validated (replaced, +0 attempts)
  { level: 40, seed: 1398920, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 2, description: "Thermal Run" }, // ✅ Validated (replaced, +0 attempts)
  { level: 41, seed: 1408893, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 2, description: "Elite Circuit" }, // ✅ Validated (replaced, +0 attempts)
  { level: 42, seed: 1418866, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 3, description: "Gauntlet Five" }, // ✅ Validated (replaced, +0 attempts)
  { level: 43, seed: 1428839, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 3, description: "Volcanic Quad" }, // ✅ Validated (replaced, +0 attempts)
  { level: 44, seed: 1438812, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 4, description: "Danger Run" }, // ✅ Validated (replaced, +0 attempts)
  { level: 45, seed: 1448785, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 4, description: "Ultimate Challenge" }, // ✅ Validated (replaced, +0 attempts)
  { level: 46, seed: 1458758, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 5, description: "Expert Course" }, // ✅ Validated (replaced, +0 attempts)
  { level: 47, seed: 1468731, padCount: 3, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 5, description: "Final Triple" }, // ✅ Validated (replaced, +0 attempts)
  { level: 48, seed: 1478704, padCount: 5, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 0, description: "Gauntlet Run" }, // ✅ Validated (replaced, +0 attempts)
  { level: 49, seed: 1488677, padCount: 4, hasSpaceJunk: true, hasVolcanoes: true, hasGravityWells: true, colorIndex: 0, description: "Final Trial" }, // ✅ Validated (replaced, +0 attempts)
];

/**
 * Get configuration for a specific Time Trial level
 * NOTE: Difficulty does NOT affect terrain generation in Time Trial mode
 */
export function getTimeTrialLevelConfig(level: number, difficulty: Difficulty = 'easy'): TimeTrialLevelConfig {
  const baseConfig = TIME_TRIAL_LEVELS[level];
  if (!baseConfig) {
    // Fallback for levels beyond 49
    return {
      level,
      seed: BASE_SEED + level * 7919,
      padCount: 5,
      hasSpaceJunk: true,
      hasGravityWells: true,
      hasVolcanoes: true,
      colorIndex: level % 6,
      description: `Challenge ${level + 1}`
    };
  }
  
  // Return config as-is - no seed modification based on difficulty
  return baseConfig;
}

/**
 * Check if a level is within the fixed Time Trial range
 */
export function isTimeTrialLevel(level: number): boolean {
  return level >= 0 && level < TIME_TRIAL_LEVELS.length;
}

/**
 * Get the color progression for Time Trial mode
 */
export function getTimeTrialColor(colorIndex: number): string {
  const colors = [
    "330 100% 60%", // pink
    "50 100% 60%",  // yellow
    "140 100% 55%", // green
    "270 100% 70%", // purple
    "25 100% 60%",  // orange
    "0 100% 60%",   // red
  ];
  return colors[colorIndex % colors.length];
}
