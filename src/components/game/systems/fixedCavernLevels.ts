// Fixed cavern level definitions for consistent gameplay across sessions
// Each level uses a specific seed to ensure identical cavern generation

export interface FixedCavernLevel {
  level: number;
  seed: number;
  difficulty: 'easy' | 'hard';
  description?: string;
}

// Base seed for all fixed cavern levels
const CAVERN_BASE_SEED = 982734;

// Enhanced 50 fixed cavern levels utilizing new shape archetypes and progressive scaling
// Each level carefully designed with specific shape combinations and balanced difficulty curves
export const FIXED_CAVERN_LEVELS: FixedCavernLevel[] = [
  // Tutorial levels (0-4) - Simple ellipses and rounded boxes, 1x scale
  { level: 0, seed: CAVERN_BASE_SEED + 0x1001, difficulty: 'easy', description: 'Simple Ellipse Tutorial' },
  { level: 1, seed: CAVERN_BASE_SEED + 0x1102, difficulty: 'easy', description: 'Rounded Box Intro' },
  { level: 2, seed: CAVERN_BASE_SEED + 0x1203, difficulty: 'easy', description: 'Wide Passages' },
  { level: 3, seed: CAVERN_BASE_SEED + 0x1304, difficulty: 'easy', description: 'Gentle Curves' },
  { level: 4, seed: CAVERN_BASE_SEED + 0x1405, difficulty: 'easy', description: 'Basic Navigation' },
  
  // Beginner levels (5-9) - Add superellipses, 1.5x scale
  { level: 5, seed: CAVERN_BASE_SEED + 0x2106, difficulty: 'easy', description: 'Superellipse Introduction' },
  { level: 6, seed: CAVERN_BASE_SEED + 0x2207, difficulty: 'easy', description: 'Boxy Chambers' },
  { level: 7, seed: CAVERN_BASE_SEED + 0x2308, difficulty: 'easy', description: 'Mixed Shapes' },
  { level: 8, seed: CAVERN_BASE_SEED + 0x2409, difficulty: 'easy', description: 'Shape Variety' },
  { level: 9, seed: CAVERN_BASE_SEED + 0x250A, difficulty: 'easy', description: 'First Challenges' },
  
  // Intermediate levels (10-14) - Rounded polygons and L-rooms, 2x scale
  { level: 10, seed: CAVERN_BASE_SEED + 0x310B, difficulty: 'easy', description: 'Triangle Chambers' },
  { level: 11, seed: CAVERN_BASE_SEED + 0x320C, difficulty: 'easy', description: 'Square Rooms' },
  { level: 12, seed: CAVERN_BASE_SEED + 0x330D, difficulty: 'easy', description: 'Pentagon Maze' },
  { level: 13, seed: CAVERN_BASE_SEED + 0x340E, difficulty: 'easy', description: 'L-Shaped Caverns' },
  { level: 14, seed: CAVERN_BASE_SEED + 0x350F, difficulty: 'easy', description: 'Angular Passages' },
  
  // Advanced levels (15-19) - Metaballs and noise, 3x scale
  { level: 15, seed: CAVERN_BASE_SEED + 0x4110, difficulty: 'easy', description: 'Organic Blobs' },
  { level: 16, seed: CAVERN_BASE_SEED + 0x4211, difficulty: 'easy', description: 'Flowing Caves' },
  { level: 17, seed: CAVERN_BASE_SEED + 0x4312, difficulty: 'easy', description: 'Noisy Boundaries' },
  { level: 18, seed: CAVERN_BASE_SEED + 0x4413, difficulty: 'easy', description: 'Irregular Shapes' },
  { level: 19, seed: CAVERN_BASE_SEED + 0x4514, difficulty: 'easy', description: 'Natural Caverns' },
  
  // Expert entry (20-24) - All shapes with rotations, 4x scale
  { level: 20, seed: CAVERN_BASE_SEED + 0x5115, difficulty: 'hard', description: 'Rotated Geometries' },
  { level: 21, seed: CAVERN_BASE_SEED + 0x5216, difficulty: 'hard', description: 'Tilted Chambers' },
  { level: 22, seed: CAVERN_BASE_SEED + 0x5317, difficulty: 'hard', description: 'Complex Orientations' },
  { level: 23, seed: CAVERN_BASE_SEED + 0x5418, difficulty: 'hard', description: 'Spatial Reasoning' },
  { level: 24, seed: CAVERN_BASE_SEED + 0x5519, difficulty: 'hard', description: 'Disorienting Angles' },
  
  // Expert mid (25-29) - High complexity combinations, 5x scale
  { level: 25, seed: CAVERN_BASE_SEED + 0x611A, difficulty: 'hard', description: 'Metaball Clusters' },
  { level: 26, seed: CAVERN_BASE_SEED + 0x621B, difficulty: 'hard', description: 'Noise Amplification' },
  { level: 27, seed: CAVERN_BASE_SEED + 0x631C, difficulty: 'hard', description: 'Polygon Gauntlet' },
  { level: 28, seed: CAVERN_BASE_SEED + 0x641D, difficulty: 'hard', description: 'Shape Fusion' },
  { level: 29, seed: CAVERN_BASE_SEED + 0x651E, difficulty: 'hard', description: 'Morphing Boundaries' },
  
  // Master entry (30-34) - Maximum noise and complexity, 6x scale
  { level: 30, seed: CAVERN_BASE_SEED + 0x711F, difficulty: 'hard', description: 'Chaotic Geometries' },
  { level: 31, seed: CAVERN_BASE_SEED + 0x7220, difficulty: 'hard', description: 'Turbulent Shapes' },
  { level: 32, seed: CAVERN_BASE_SEED + 0x7321, difficulty: 'hard', description: 'Fractal Boundaries' },
  { level: 33, seed: CAVERN_BASE_SEED + 0x7422, difficulty: 'hard', description: 'Impossible Geometries' },
  { level: 34, seed: CAVERN_BASE_SEED + 0x7523, difficulty: 'hard', description: 'Quantum Caves' },
  
  // Master advanced (35-39) - Extreme combinations, 7x scale
  { level: 35, seed: CAVERN_BASE_SEED + 0x8124, difficulty: 'hard', description: 'Hyperdimensional' },
  { level: 36, seed: CAVERN_BASE_SEED + 0x8225, difficulty: 'hard', description: 'Non-Euclidean' },
  { level: 37, seed: CAVERN_BASE_SEED + 0x8326, difficulty: 'hard', description: 'Reality Breach' },
  { level: 38, seed: CAVERN_BASE_SEED + 0x8427, difficulty: 'hard', description: 'Spacetime Fold' },
  { level: 39, seed: CAVERN_BASE_SEED + 0x8528, difficulty: 'hard', description: 'Dimensional Rift' },
  
  // Grandmaster (40-44) - Legendary difficulty, 7.5x scale
  { level: 40, seed: CAVERN_BASE_SEED + 0x9129, difficulty: 'hard', description: 'Cosmic Horror' },
  { level: 41, seed: CAVERN_BASE_SEED + 0x922A, difficulty: 'hard', description: 'Void Geometry' },
  { level: 42, seed: CAVERN_BASE_SEED + 0x932B, difficulty: 'hard', description: 'Universal Answer' },
  { level: 43, seed: CAVERN_BASE_SEED + 0x942C, difficulty: 'hard', description: 'Beyond Comprehension' },
  { level: 44, seed: CAVERN_BASE_SEED + 0x952D, difficulty: 'hard', description: 'Transcendent Maze' },
  
  // Ultimate (45-49) - Maximum scale and complexity, 8x scale
  { level: 45, seed: CAVERN_BASE_SEED + 0xA12E, difficulty: 'hard', description: 'Perfect Symmetry' },
  { level: 46, seed: CAVERN_BASE_SEED + 0xA22F, difficulty: 'hard', description: 'Infinite Recursion' },
  { level: 47, seed: CAVERN_BASE_SEED + 0xA330, difficulty: 'hard', description: 'Paradox Engine' },
  { level: 48, seed: CAVERN_BASE_SEED + 0xA431, difficulty: 'hard', description: 'Final Genesis' },
  { level: 49, seed: CAVERN_BASE_SEED + 0xA532, difficulty: 'hard', description: 'Ultimate Mastery' }
];

// Get the fixed seed for a specific level
export function getFixedCavernSeed(level: number, difficulty: 'easy' | 'hard'): number {
  // Clamp level to valid range
  const clampedLevel = Math.max(0, Math.min(49, level));
  
  // Find the level definition
  const levelDef = FIXED_CAVERN_LEVELS.find(l => l.level === clampedLevel);
  if (!levelDef) {
    // Fallback for any missing definitions
    return CAVERN_BASE_SEED + (clampedLevel * 0x1337) + (difficulty === 'hard' ? 0x100000 : 0);
  }
  
  // Apply difficulty modifier to the base seed
  return levelDef.seed + (difficulty === 'hard' ? 0x100000 : 0);
}

// Get level description for UI display
export function getCavernLevelDescription(level: number): string {
  const clampedLevel = Math.max(0, Math.min(49, level));
  const levelDef = FIXED_CAVERN_LEVELS.find(l => l.level === clampedLevel);
  return levelDef?.description || `Cavern Level ${clampedLevel + 1}`;
}

// Check if a level is in the fixed range
export function isFixedCavernLevel(level: number): boolean {
  return level >= 0 && level <= 49;
}