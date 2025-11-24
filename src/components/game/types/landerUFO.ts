export interface LanderUFO {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  difficulty: number; // 1-10 scale
  
  // Movement behavior
  baseY: number; // center Y for weaving
  weaveAmplitude: number;
  weaveFrequency: number;
  weavePhase: number;
  
  // Rotation animation for middle band
  bandRotation: number; // 0-1, represents rotation progress
  bandRotationSpeed: number; // units per second
  
  // Shooting behavior
  lastShotTime: number;
  nextShotTime: number;
  
  // State
  active: boolean;
  spawnSide: "left" | "right";
  hasExited: boolean;
  
  // At higher difficulties
  canTrack: boolean; // difficulty 4+
  trackingStrength: number; // 0-1, how much it follows player
}

export interface UFOProjectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  active: boolean;
}

export interface UFOConfig {
  // Movement
  baseSpeed: number; // Scaled by difficulty
  weaveAmplitudeMin: number;
  weaveAmplitudeMax: number;
  weaveFrequencyMin: number;
  weaveFrequencyMax: number;
  
  // Shooting
  shotIntervalMin: number; // Scaled by difficulty
  shotIntervalMax: number;
  aimInaccuracyDegrees: number; // Scaled inversely by difficulty
  projectileSpeed: number;
  projectileLifetime: number;
  
  // Spawning
  spawnHeight: number; // Relative to base height
  spawnMargin: number; // Distance off-screen
  
  // Tracking (difficulty 4+)
  trackingThreshold: number; // difficulty level when tracking starts
  trackingStrengthPerDifficulty: number;
}
