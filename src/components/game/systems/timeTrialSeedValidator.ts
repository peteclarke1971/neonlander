import { generateTerrain } from "../terrain";
import { TIME_TRIAL_LEVELS, TimeTrialLevelConfig } from "./timeTrialLevels";

export interface SeedValidationResult {
  level: number;
  seed: number;
  expectedPads: number;
  actualPads: number;
  isValid: boolean;
  validatedSeed?: number;
  attempts?: number;
  error?: string;
}

/**
 * Validate a seed by running terrain generation in validation mode
 * Returns the number of pads generated, or -1 if generation failed
 */
function testSeed(level: number, seed: number, padCount: number): number {
  try {
    // Match GameEngine.tsx constants
    const WORLD_WIDTH = 4000;
    const BASE_HEIGHT = 360;
    const AMPLITUDE = 180;
    
    // Match GameEngine.tsx levelVar calculation
    const levelVar = Math.min(Math.max(0, level), 20);
    const terrainAmp = AMPLITUDE * (1 + 0.2 * levelVar);
    
    // Get the actual config object that will be used in-game
    const config = TIME_TRIAL_LEVELS[level];
    
    const terrain = generateTerrain(
      seed,
      WORLD_WIDTH,      // 4000 instead of 8000
      BASE_HEIGHT,      // 360 instead of 400
      terrainAmp,       // Dynamic (180-900) instead of fixed 150
      levelVar,         // Dynamic (0-20) instead of fixed 1
      level,
      'easy',           // Difficulty doesn't matter for Time Trial
      true,             // isTimeTrial
      padCount,
      'timetrial',
      config,           // Pass the actual config, not undefined
      true              // validationMode - suppress errors
    );
    
    // Check if terrain generation succeeded
    if (!terrain || !terrain.sequencedPads) {
      return -1;
    }
    
    return terrain.sequencedPads.length;
  } catch (error) {
    // Validation mode should not throw, but catch just in case
    return -1;
  }
}

/**
 * Validate a single seed - returns true if it generates the correct number of pads
 */
export function validateSeed(level: number, seed: number, padCount: number): boolean {
  const actualPads = testSeed(level, seed, padCount);
  return actualPads === padCount;
}

/**
 * Find a valid seed by testing incremental variations
 * Returns a valid seed or null if none found within maxAttempts
 */
export function findValidSeed(
  level: number, 
  baseSeed: number, 
  padCount: number, 
  maxAttempts: number = 1000
): { seed: number; attempts: number } | null {
  // Try the base seed first
  if (validateSeed(level, baseSeed, padCount)) {
    return { seed: baseSeed, attempts: 0 };
  }
  
  // Try incremental variations
  for (let offset = 1; offset <= maxAttempts; offset++) {
    const candidateSeed = baseSeed + offset;
    if (validateSeed(level, candidateSeed, padCount)) {
      return { seed: candidateSeed, attempts: offset };
    }
  }
  
  return null; // No valid seed found
}

/**
 * Validate all Time Trial level seeds
 * Returns a map of level -> validation results
 */
export function validateAllTimeTrialSeeds(
  onProgress?: (level: number, total: number) => void,
  forceRegenerate: (level: number) => boolean = () => false
): SeedValidationResult[] {
  const results: SeedValidationResult[] = [];
  
  for (let i = 0; i < TIME_TRIAL_LEVELS.length; i++) {
    const config = TIME_TRIAL_LEVELS[i];
    const level = config.level;
    const seed = config.seed;
    const expectedPads = config.padCount;
    
    if (onProgress) {
      onProgress(level + 1, TIME_TRIAL_LEVELS.length);
    }
    
    // Force regeneration for specified levels (10-49)
    if (forceRegenerate(level)) {
      console.log(`[Validator] Level ${level}: Forcing new seed generation`);
      const newBaseSeed = 1000000 + level * 9973; // Completely different base
      const replacement = findValidSeed(level, newBaseSeed, expectedPads);
      
      if (replacement) {
        results.push({
          level,
          seed: replacement.seed,
          expectedPads,
          actualPads: expectedPads,
          isValid: true,
          validatedSeed: replacement.seed,
          attempts: replacement.attempts
        });
        console.log(`[Validator] Level ${level}: Found new valid seed ${replacement.seed} after ${replacement.attempts} attempts`);
      } else {
        results.push({
          level,
          seed,
          expectedPads,
          actualPads: -1,
          isValid: false,
          error: `Failed to find valid seed after 1000 attempts`
        });
        console.error(`[Validator] Level ${level}: Failed to find new valid seed`);
      }
      continue;
    }
    
    // Normal validation for other levels
    const actualPads = testSeed(level, seed, expectedPads);
    const isValid = actualPads === expectedPads;
    
    if (isValid) {
      // Seed is valid, no changes needed
      results.push({
        level,
        seed,
        expectedPads,
        actualPads,
        isValid: true
      });
    } else {
      // Seed is invalid, find a replacement
      console.log(`[Validator] Level ${level}: Seed ${seed} invalid (${actualPads}/${expectedPads} pads), searching...`);
      
      const replacement = findValidSeed(level, seed, expectedPads);
      
      if (replacement) {
        results.push({
          level,
          seed: replacement.seed,
          expectedPads,
          actualPads: expectedPads,
          isValid: true,
          validatedSeed: replacement.seed,
          attempts: replacement.attempts
        });
        console.log(`[Validator] Level ${level}: Found valid seed ${replacement.seed} after ${replacement.attempts} attempts`);
      } else {
        results.push({
          level,
          seed,
          expectedPads,
          actualPads,
          isValid: false,
          error: `No valid seed found after 1000 attempts`
        });
        console.error(`[Validator] Level ${level}: Failed to find valid seed`);
      }
    }
  }
  
  return results;
}

/**
 * Generate updated TIME_TRIAL_LEVELS configuration with validated seeds
 */
export function generateValidatedConfig(results: SeedValidationResult[]): string {
  let config = `// VALIDATED SEEDS - All seeds tested to produce correct pad counts\n`;
  config += `export const TIME_TRIAL_LEVELS: TimeTrialLevelConfig[] = [\n`;
  
  for (const result of results) {
    const originalConfig = TIME_TRIAL_LEVELS[result.level];
    const status = result.isValid ? '✅ Validated' : '❌ INVALID';
    const seedNote = result.validatedSeed && result.validatedSeed !== originalConfig.seed 
      ? ` (replaced, +${result.attempts} attempts)`
      : '';
    
    config += `  { level: ${result.level}, seed: ${result.seed}, padCount: ${result.expectedPads}, `;
    config += `hasSpaceJunk: ${originalConfig.hasSpaceJunk}, hasVolcanoes: ${originalConfig.hasVolcanoes}, hasGravityWells: ${originalConfig.hasGravityWells}, `;
    config += `colorIndex: ${originalConfig.colorIndex}, `;
    config += `description: "${originalConfig.description}" }, // ${status}${seedNote}\n`;
  }
  
  config += `];\n`;
  
  return config;
}
