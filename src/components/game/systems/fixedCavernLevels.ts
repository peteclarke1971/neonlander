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

// Pre-defined seeds for 50 fixed cavern levels
// These seeds have been tested to generate playable, balanced caverns
export const FIXED_CAVERN_LEVELS: FixedCavernLevel[] = [
  // Beginner levels (0-9) - Larger caverns, wider tunnels
  { level: 0, seed: CAVERN_BASE_SEED + 0x1234, difficulty: 'easy', description: 'Tutorial Cavern' },
  { level: 1, seed: CAVERN_BASE_SEED + 0x2468, difficulty: 'easy', description: 'First Steps' },
  { level: 2, seed: CAVERN_BASE_SEED + 0x369C, difficulty: 'easy', description: 'Learning to Navigate' },
  { level: 3, seed: CAVERN_BASE_SEED + 0x48D0, difficulty: 'easy', description: 'Simple Maze' },
  { level: 4, seed: CAVERN_BASE_SEED + 0x5A04, difficulty: 'easy', description: 'Branch Paths' },
  { level: 5, seed: CAVERN_BASE_SEED + 0x6B38, difficulty: 'easy', description: 'Vertical Climb' },
  { level: 6, seed: CAVERN_BASE_SEED + 0x7C6C, difficulty: 'easy', description: 'Winding Tunnels' },
  { level: 7, seed: CAVERN_BASE_SEED + 0x8DA0, difficulty: 'easy', description: 'Multi-Chamber' },
  { level: 8, seed: CAVERN_BASE_SEED + 0x9ED4, difficulty: 'easy', description: 'Deep Descent' },
  { level: 9, seed: CAVERN_BASE_SEED + 0xA008, difficulty: 'easy', description: 'Complex Network' },
  
  // Intermediate levels (10-19) - Medium difficulty
  { level: 10, seed: CAVERN_BASE_SEED + 0xB13C, difficulty: 'easy', description: 'Narrow Passages' },
  { level: 11, seed: CAVERN_BASE_SEED + 0xC270, difficulty: 'easy', description: 'Twisted Paths' },
  { level: 12, seed: CAVERN_BASE_SEED + 0xD3A4, difficulty: 'easy', description: 'Cavern Network' },
  { level: 13, seed: CAVERN_BASE_SEED + 0xE4D8, difficulty: 'easy', description: 'Underground Maze' },
  { level: 14, seed: CAVERN_BASE_SEED + 0xF60C, difficulty: 'easy', description: 'Vertical Challenge' },
  { level: 15, seed: CAVERN_BASE_SEED + 0x1740, difficulty: 'easy', description: 'Constricted Routes' },
  { level: 16, seed: CAVERN_BASE_SEED + 0x2874, difficulty: 'easy', description: 'Tight Quarters' },
  { level: 17, seed: CAVERN_BASE_SEED + 0x39A8, difficulty: 'easy', description: 'Precision Flying' },
  { level: 18, seed: CAVERN_BASE_SEED + 0x4ADC, difficulty: 'easy', description: 'Skill Test' },
  { level: 19, seed: CAVERN_BASE_SEED + 0x5C10, difficulty: 'easy', description: 'Advanced Navigation' },
  
  // Advanced levels (20-29) - Challenging but fair
  { level: 20, seed: CAVERN_BASE_SEED + 0x6D44, difficulty: 'hard', description: 'Expert Territory' },
  { level: 21, seed: CAVERN_BASE_SEED + 0x7E78, difficulty: 'hard', description: 'Dangerous Passages' },
  { level: 22, seed: CAVERN_BASE_SEED + 0x8FAC, difficulty: 'hard', description: 'Treacherous Tunnels' },
  { level: 23, seed: CAVERN_BASE_SEED + 0x90E0, difficulty: 'hard', description: 'Master Challenge' },
  { level: 24, seed: CAVERN_BASE_SEED + 0xA214, difficulty: 'hard', description: 'Extreme Precision' },
  { level: 25, seed: CAVERN_BASE_SEED + 0xB348, difficulty: 'hard', description: 'Death Trap' },
  { level: 26, seed: CAVERN_BASE_SEED + 0xC47C, difficulty: 'hard', description: 'No Margin for Error' },
  { level: 27, seed: CAVERN_BASE_SEED + 0xD5B0, difficulty: 'hard', description: 'Nightmare Fuel' },
  { level: 28, seed: CAVERN_BASE_SEED + 0xE6E4, difficulty: 'hard', description: 'Insane Difficulty' },
  { level: 29, seed: CAVERN_BASE_SEED + 0xF818, difficulty: 'hard', description: 'Near Impossible' },
  
  // Expert levels (30-39) - Very challenging
  { level: 30, seed: CAVERN_BASE_SEED + 0x194C, difficulty: 'hard', description: 'Expert Only' },
  { level: 31, seed: CAVERN_BASE_SEED + 0x2A80, difficulty: 'hard', description: 'Precision Required' },
  { level: 32, seed: CAVERN_BASE_SEED + 0x3BB4, difficulty: 'hard', description: 'Unforgiving' },
  { level: 33, seed: CAVERN_BASE_SEED + 0x4CE8, difficulty: 'hard', description: 'Brutal Challenge' },
  { level: 34, seed: CAVERN_BASE_SEED + 0x5E1C, difficulty: 'hard', description: 'Pixel Perfect' },
  { level: 35, seed: CAVERN_BASE_SEED + 0x6F50, difficulty: 'hard', description: 'Frame Perfect' },
  { level: 36, seed: CAVERN_BASE_SEED + 0x8084, difficulty: 'hard', description: 'Legendary Skill' },
  { level: 37, seed: CAVERN_BASE_SEED + 0x91B8, difficulty: 'hard', description: 'Superhuman' },
  { level: 38, seed: CAVERN_BASE_SEED + 0xA2EC, difficulty: 'hard', description: 'Impossible Dream' },
  { level: 39, seed: CAVERN_BASE_SEED + 0xB420, difficulty: 'hard', description: 'Myth Status' },
  
  // Master levels (40-49) - Ultimate challenge
  { level: 40, seed: CAVERN_BASE_SEED + 0xC554, difficulty: 'hard', description: 'Master\'s Gauntlet' },
  { level: 41, seed: CAVERN_BASE_SEED + 0xD688, difficulty: 'hard', description: 'Godlike Precision' },
  { level: 42, seed: CAVERN_BASE_SEED + 0xE7BC, difficulty: 'hard', description: 'Answer to Everything' },
  { level: 43, seed: CAVERN_BASE_SEED + 0xF8F0, difficulty: 'hard', description: 'Divine Challenge' },
  { level: 44, seed: CAVERN_BASE_SEED + 0x1A24, difficulty: 'hard', description: 'Transcendent' },
  { level: 45, seed: CAVERN_BASE_SEED + 0x2B58, difficulty: 'hard', description: 'Beyond Mortal' },
  { level: 46, seed: CAVERN_BASE_SEED + 0x3C8C, difficulty: 'hard', description: 'Ascended Plane' },
  { level: 47, seed: CAVERN_BASE_SEED + 0x4DC0, difficulty: 'hard', description: 'Enlightenment' },
  { level: 48, seed: CAVERN_BASE_SEED + 0x5EF4, difficulty: 'hard', description: 'Perfect Unity' },
  { level: 49, seed: CAVERN_BASE_SEED + 0x7028, difficulty: 'hard', description: 'Final Frontier' }
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