import type { UFOConfig } from "../types/ufo";

export type UFODifficultyPreset = "easy" | "normal" | "hard" | "brutal";

export const UFO_DIFFICULTY_PRESETS: Record<UFODifficultyPreset, UFOConfig> = {
  easy: {
    enabled: true,
    classicMode: true,
    maxSimultaneous: 1,
    spawnIntervalMin: 22,
    spawnIntervalMax: 30,
    quietPeriodMin: 10,
    quietPeriodMax: 15,
    smallOnlyScoreThreshold: 50000,
    
    largeSpeed: { min: 60, max: 80 },
    largeFireInterval: { min: 1.6, max: 2.0 },
    largeAimCone: 90,
    largePoints: 200,
    
    smallSpeed: { min: 90, max: 120 },
    smallFireInterval: { min: 0.8, max: 1.2 },
    smallAimConeEarly: 45,
    smallAimConeLate: 15,
    smallPoints: 1000,
    
    bulletSpeed: { min: 200, max: 240 },
    bulletLifetime: { min: 1.0, max: 1.2 },
    maxBullets: 4,
    
    swayAmplitude: { min: 8, max: 16 },
    swayPeriod: { min: 3, max: 5 }
  },
  
  normal: {
    enabled: true,
    classicMode: true,
    maxSimultaneous: 1,
    spawnIntervalMin: 18,
    spawnIntervalMax: 25,
    quietPeriodMin: 8,
    quietPeriodMax: 12,
    smallOnlyScoreThreshold: 40000,
    
    largeSpeed: { min: 70, max: 95 },
    largeFireInterval: { min: 1.2, max: 1.6 },
    largeAimCone: 60,
    largePoints: 200,
    
    smallSpeed: { min: 110, max: 140 },
    smallFireInterval: { min: 0.6, max: 0.9 },
    smallAimConeEarly: 30,
    smallAimConeLate: 7,
    smallPoints: 1000,
    
    bulletSpeed: { min: 220, max: 280 },
    bulletLifetime: { min: 1.0, max: 1.4 },
    maxBullets: 6,
    
    swayAmplitude: { min: 6, max: 24 },
    swayPeriod: { min: 2, max: 6 }
  },
  
  hard: {
    enabled: true,
    classicMode: true,
    maxSimultaneous: 2,
    spawnIntervalMin: 12,
    spawnIntervalMax: 20,
    quietPeriodMin: 6,
    quietPeriodMax: 10,
    smallOnlyScoreThreshold: 30000,
    
    largeSpeed: { min: 80, max: 110 },
    largeFireInterval: { min: 1.0, max: 1.4 },
    largeAimCone: 45,
    largePoints: 200,
    
    smallSpeed: { min: 130, max: 170 },
    smallFireInterval: { min: 0.5, max: 0.8 },
    smallAimConeEarly: 25,
    smallAimConeLate: 5,
    smallPoints: 1000,
    
    bulletSpeed: { min: 240, max: 320 },
    bulletLifetime: { min: 1.2, max: 1.6 },
    maxBullets: 8,
    
    swayAmplitude: { min: 4, max: 20 },
    swayPeriod: { min: 1.5, max: 4 }
  },
  
  brutal: {
    enabled: true,
    classicMode: false, // Deluxe targeting
    maxSimultaneous: 2,
    spawnIntervalMin: 8,
    spawnIntervalMax: 15,
    quietPeriodMin: 4,
    quietPeriodMax: 8,
    smallOnlyScoreThreshold: 25000,
    
    largeSpeed: { min: 90, max: 130 },
    largeFireInterval: { min: 0.8, max: 1.2 },
    largeAimCone: 30,
    largePoints: 200,
    
    smallSpeed: { min: 150, max: 200 },
    smallFireInterval: { min: 0.4, max: 0.7 },
    smallAimConeEarly: 20,
    smallAimConeLate: 3,
    smallPoints: 1000,
    
    bulletSpeed: { min: 260, max: 360 },
    bulletLifetime: { min: 1.4, max: 1.8 },
    maxBullets: 10,
    
    swayAmplitude: { min: 2, max: 18 },
    swayPeriod: { min: 1, max: 3 }
  }
};

export function getScaledConfig(baseConfig: UFOConfig, score: number, wave: number): UFOConfig {
  // Scale difficulty based on score and wave
  const scoreFactor = Math.min(1 + score / 50000, 2); // Up to 2x at 50k score
  const waveFactor = Math.min(1 + wave / 10, 1.5); // Up to 1.5x at wave 10
  const combinedFactor = (scoreFactor + waveFactor) / 2;
  
  return {
    ...baseConfig,
    spawnIntervalMin: Math.max(baseConfig.spawnIntervalMin / combinedFactor, 6),
    spawnIntervalMax: Math.max(baseConfig.spawnIntervalMax / combinedFactor, 9),
    
    largeSpeed: {
      min: baseConfig.largeSpeed.min * combinedFactor,
      max: baseConfig.largeSpeed.max * combinedFactor
    },
    smallSpeed: {
      min: baseConfig.smallSpeed.min * combinedFactor,
      max: baseConfig.smallSpeed.max * combinedFactor
    },
    
    largeFireInterval: {
      min: baseConfig.largeFireInterval.min / Math.sqrt(combinedFactor),
      max: baseConfig.largeFireInterval.max / Math.sqrt(combinedFactor)
    },
    smallFireInterval: {
      min: baseConfig.smallFireInterval.min / Math.sqrt(combinedFactor),
      max: baseConfig.smallFireInterval.max / Math.sqrt(combinedFactor)
    },
    
    // Improve small saucer accuracy with score
    smallAimConeLate: Math.max(
      baseConfig.smallAimConeLate - (score / 20000) * 2, 
      baseConfig.classicMode ? 3 : 1
    )
  };
}

export function createUFOSeed(baseSeed: number, mode: string, wave: number, spawnCount: number): number {
  // Create deterministic seed for UFO behavior
  let hash = baseSeed;
  hash = ((hash << 5) - hash + mode.charCodeAt(0)) & 0xffffffff;
  hash = ((hash << 5) - hash + wave) & 0xffffffff;
  hash = ((hash << 5) - hash + spawnCount) & 0xffffffff;
  hash = ((hash << 5) - hash + "UFO".charCodeAt(0)) & 0xffffffff;
  return Math.abs(hash);
}