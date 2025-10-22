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
  allowMegaPad: boolean; // Whether moving pads (MEGA pads) are allowed
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
export const TIME_TRIAL_LEVELS: TimeTrialLevelConfig[] = [
  // Levels 0-3: 2 pads, no hazards, no mega pads
  { level: 0, seed: getTimeTrialSeed(0, 'easy'), padCount: 2, hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 0, description: "First Steps" },
  { level: 1, seed: getTimeTrialSeed(1, 'easy'), padCount: 2, hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 0, description: "Getting Started" },
  { level: 2, seed: getTimeTrialSeed(2, 'easy'), padCount: 2, hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 1, description: "Building Speed" },
  { level: 3, seed: getTimeTrialSeed(3, 'easy'), padCount: 2, hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 1, description: "Quick Hops" },

  // Levels 4-14: 3 pads, introducing hazards, no mega pads
  { level: 4, seed: getTimeTrialSeed(4, 'easy'), padCount: 3, hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 2, description: "Triple Run" },
  { level: 5, seed: getTimeTrialSeed(5, 'easy'), padCount: 3, hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 2, description: "Three Points" },
  { level: 6, seed: getTimeTrialSeed(6, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 3, description: "Junk Field" },
  { level: 7, seed: getTimeTrialSeed(7, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 3, description: "Debris Zone" },
  { level: 8, seed: getTimeTrialSeed(8, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 4, description: "Salvage Run" },
  { level: 9, seed: getTimeTrialSeed(9, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 4, description: "Circuit Practice" },
  { level: 10, seed: getTimeTrialSeed(10, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 5, description: "Three Hop" },
  { level: 11, seed: getTimeTrialSeed(11, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 5, description: "Quick Collection" },
  { level: 12, seed: getTimeTrialSeed(12, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, allowMegaPad: false, colorIndex: 0, description: "Scavenger" },
  { level: 13, seed: getTimeTrialSeed(13, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, allowMegaPad: false, colorIndex: 0, description: "Gravity Introduction" },
  { level: 14, seed: getTimeTrialSeed(14, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, allowMegaPad: false, colorIndex: 1, description: "Distortion Run" },

  // Levels 15-49: 3-5 pads randomized, all hazards, mega pads allowed
  { level: 15, seed: getTimeTrialSeed(15, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, allowMegaPad: true, colorIndex: 1, description: "Mega Introduction" },
  { level: 16, seed: getTimeTrialSeed(16, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, allowMegaPad: true, colorIndex: 2, description: "Quad Challenge" },
  { level: 17, seed: getTimeTrialSeed(17, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 2, description: "Volcanic Entry" },
  { level: 18, seed: getTimeTrialSeed(18, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, allowMegaPad: true, colorIndex: 3, description: "Five Point" },
  { level: 19, seed: getTimeTrialSeed(19, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 3, description: "Lava Quad" },
  { level: 20, seed: getTimeTrialSeed(20, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 4, description: "Hot Route" },
  { level: 21, seed: getTimeTrialSeed(21, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 4, description: "Pentathlon" },
  { level: 22, seed: getTimeTrialSeed(22, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 5, description: "Gravity Pull" },
  { level: 23, seed: getTimeTrialSeed(23, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 5, description: "Triple Inferno" },
  { level: 24, seed: getTimeTrialSeed(24, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 0, description: "Five Star" },
  { level: 25, seed: getTimeTrialSeed(25, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 0, description: "Anomaly Field" },
  { level: 26, seed: getTimeTrialSeed(26, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 1, description: "Volcanic Circuit" },
  { level: 27, seed: getTimeTrialSeed(27, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 1, description: "Expert Five" },
  { level: 28, seed: getTimeTrialSeed(28, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 2, description: "Warped Space" },
  { level: 29, seed: getTimeTrialSeed(29, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 2, description: "Danger Triple" },
  { level: 30, seed: getTimeTrialSeed(30, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 3, description: "Ultimate Five" },
  { level: 31, seed: getTimeTrialSeed(31, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 3, description: "Eruption Zone" },
  { level: 32, seed: getTimeTrialSeed(32, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 4, description: "Elite Triple" },
  { level: 33, seed: getTimeTrialSeed(33, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 4, description: "Master Course" },
  { level: 34, seed: getTimeTrialSeed(34, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 5, description: "Inferno Path" },
  { level: 35, seed: getTimeTrialSeed(35, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 5, description: "Hot Landing" },
  { level: 36, seed: getTimeTrialSeed(36, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 0, description: "Champion Five" },
  { level: 37, seed: getTimeTrialSeed(37, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 0, description: "Molten Path" },
  { level: 38, seed: getTimeTrialSeed(38, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 1, description: "Triple Threat" },
  { level: 39, seed: getTimeTrialSeed(39, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 1, description: "Legendary Five" },
  { level: 40, seed: getTimeTrialSeed(40, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 2, description: "Thermal Run" },
  { level: 41, seed: getTimeTrialSeed(41, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 2, description: "Elite Circuit" },
  { level: 42, seed: getTimeTrialSeed(42, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 3, description: "Gauntlet Five" },
  { level: 43, seed: getTimeTrialSeed(43, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 3, description: "Volcanic Quad" },
  { level: 44, seed: getTimeTrialSeed(44, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 4, description: "Danger Run" },
  { level: 45, seed: getTimeTrialSeed(45, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 4, description: "Ultimate Challenge" },
  { level: 46, seed: getTimeTrialSeed(46, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 5, description: "Expert Course" },
  { level: 47, seed: getTimeTrialSeed(47, 'easy'), padCount: 3, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 5, description: "Final Triple" },
  { level: 48, seed: getTimeTrialSeed(48, 'easy'), padCount: 5, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 0, description: "Gauntlet Run" },
  { level: 49, seed: getTimeTrialSeed(49, 'easy'), padCount: 4, hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, allowMegaPad: true, colorIndex: 0, description: "Final Trial" },
];

/**
 * Get configuration for a specific Time Trial level
 */
export function getTimeTrialLevelConfig(level: number, difficulty: Difficulty = 'easy'): TimeTrialLevelConfig {
  const baseConfig = TIME_TRIAL_LEVELS[level];
  if (!baseConfig) {
    // Fallback for levels beyond 49
    return {
      level,
      seed: getTimeTrialSeed(level, difficulty),
      padCount: 5,
      hasSpaceJunk: true,
      hasGravityWells: true,
      hasVolcanoes: true,
      allowMegaPad: true,
      colorIndex: level % 6,
      description: `Challenge ${level + 1}`
    };
  }
  
  // Update seed based on difficulty
  return {
    ...baseConfig,
    seed: getTimeTrialSeed(level, difficulty)
  };
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
