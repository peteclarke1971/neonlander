import { Difficulty } from "../types";

export interface TimeTrialLevel {
  level: number;
  seed: number;
  numPads: number; // 2-5
  difficulty: "easy" | "hard";
  hasSpaceJunk: boolean;
  hasGravityWells: boolean;
  hasVolcanoes: boolean;
  description?: string;
}

const BASE_SEED = 987654;

export const TIME_TRIAL_LEVELS: TimeTrialLevel[] = [
  // Levels 1-5: 2 pads, easy, no hazards
  { level: 1, seed: BASE_SEED + 1000, numPads: 2, difficulty: "easy", hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, description: "First Steps" },
  { level: 2, seed: BASE_SEED + 2000, numPads: 2, difficulty: "easy", hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, description: "Gentle Hills" },
  { level: 3, seed: BASE_SEED + 3000, numPads: 2, difficulty: "easy", hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, description: "Twin Peaks" },
  { level: 4, seed: BASE_SEED + 4000, numPads: 2, difficulty: "easy", hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, description: "Rocky Start" },
  { level: 5, seed: BASE_SEED + 5000, numPads: 2, difficulty: "easy", hasSpaceJunk: false, hasGravityWells: false, hasVolcanoes: false, description: "Learning Curve" },
  
  // Levels 6-10: 2 pads, introduce space junk
  { level: 6, seed: BASE_SEED + 6000, numPads: 2, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, description: "Debris Field" },
  { level: 7, seed: BASE_SEED + 7000, numPads: 2, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, description: "Junk Yard" },
  { level: 8, seed: BASE_SEED + 8000, numPads: 2, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, description: "Collector's Route" },
  { level: 9, seed: BASE_SEED + 9000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, description: "Triple Threat" },
  { level: 10, seed: BASE_SEED + 10000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: false, hasVolcanoes: false, description: "Scattered Parts" },
  
  // Levels 11-15: 2-3 pads, add gravity wells
  { level: 11, seed: BASE_SEED + 11000, numPads: 2, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, description: "Anomaly Zone" },
  { level: 12, seed: BASE_SEED + 12000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, description: "Gravitational Pull" },
  { level: 13, seed: BASE_SEED + 13000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, description: "Warped Space" },
  { level: 14, seed: BASE_SEED + 14000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, description: "Distortion Field" },
  { level: 15, seed: BASE_SEED + 15000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: false, description: "Bend and Weave" },
  
  // Levels 16-20: 2-3 pads, full easy hazards
  { level: 16, seed: BASE_SEED + 16000, numPads: 2, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Volcanic Activity" },
  { level: 17, seed: BASE_SEED + 17000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Hot Spots" },
  { level: 18, seed: BASE_SEED + 18000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Eruption Dodging" },
  { level: 19, seed: BASE_SEED + 19000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Lava Dance" },
  { level: 20, seed: BASE_SEED + 20000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Fire and Debris" },
  
  // Levels 21-25: 3 pads, increasing difficulty
  { level: 21, seed: BASE_SEED + 21000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Triple Challenge" },
  { level: 22, seed: BASE_SEED + 22000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Chaos Theory" },
  { level: 23, seed: BASE_SEED + 23000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Precision Run" },
  { level: 24, seed: BASE_SEED + 24000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Hazard Course" },
  { level: 25, seed: BASE_SEED + 25000, numPads: 3, difficulty: "easy", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Gauntlet" },
  
  // Levels 26-30: 3-4 pads, harder difficulty
  { level: 26, seed: BASE_SEED + 26000, numPads: 3, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Hard Mode Begins" },
  { level: 27, seed: BASE_SEED + 27000, numPads: 3, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Narrow Landing" },
  { level: 28, seed: BASE_SEED + 28000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Quad Route" },
  { level: 29, seed: BASE_SEED + 29000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Four Corners" },
  { level: 30, seed: BASE_SEED + 30000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Tight Spaces" },
  
  // Levels 31-35: 4 pads, expert territory
  { level: 31, seed: BASE_SEED + 31000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Expert Zone" },
  { level: 32, seed: BASE_SEED + 32000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Gravity Maze" },
  { level: 33, seed: BASE_SEED + 33000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Volcanic Chaos" },
  { level: 34, seed: BASE_SEED + 34000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Debris Storm" },
  { level: 35, seed: BASE_SEED + 35000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "The Crucible" },
  
  // Levels 36-40: 4-5 pads, master difficulty
  { level: 36, seed: BASE_SEED + 36000, numPads: 4, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Master Class" },
  { level: 37, seed: BASE_SEED + 37000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Five Point Landing" },
  { level: 38, seed: BASE_SEED + 38000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Pentagon Path" },
  { level: 39, seed: BASE_SEED + 39000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Maximum Hazard" },
  { level: 40, seed: BASE_SEED + 40000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Trial by Fire" },
  
  // Levels 41-45: 5 pads, extreme challenges
  { level: 41, seed: BASE_SEED + 41000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Extreme Course" },
  { level: 42, seed: BASE_SEED + 42000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Death Valley" },
  { level: 43, seed: BASE_SEED + 43000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Inferno Run" },
  { level: 44, seed: BASE_SEED + 44000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Nightmare Fuel" },
  { level: 45, seed: BASE_SEED + 45000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Insanity Check" },
  
  // Levels 46-50: 5 pads, legendary difficulty
  { level: 46, seed: BASE_SEED + 46000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Legendary Path" },
  { level: 47, seed: BASE_SEED + 47000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Mythic Challenge" },
  { level: 48, seed: BASE_SEED + 48000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Ultimate Trial" },
  { level: 49, seed: BASE_SEED + 49000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "Final Gauntlet" },
  { level: 50, seed: BASE_SEED + 50000, numPads: 5, difficulty: "hard", hasSpaceJunk: true, hasGravityWells: true, hasVolcanoes: true, description: "The Impossible" },
];

export function getTimeTrialLevelConfig(level: number): TimeTrialLevel {
  const config = TIME_TRIAL_LEVELS.find(l => l.level === level);
  if (!config) {
    // Fallback for invalid levels
    return {
      level,
      seed: BASE_SEED + level * 1000,
      numPads: 3,
      difficulty: "easy",
      hasSpaceJunk: false,
      hasGravityWells: false,
      hasVolcanoes: false,
    };
  }
  return config;
}

export function getTimeTrialSeed(level: number): number {
  const config = getTimeTrialLevelConfig(level);
  return config.seed;
}

export function getTimeTrialDescription(level: number): string {
  const config = getTimeTrialLevelConfig(level);
  return config.description || `Level ${level}`;
}
