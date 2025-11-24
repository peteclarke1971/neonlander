export type UFOType = "small" | "medium" | "large";

export interface LanderUFO {
  id: string;
  type: UFOType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  difficulty: number; // 1-10 scale
  scale: number; // Visual scale multiplier (0.33, 1.0, 4.0)
  
  // Movement behavior
  baseY: number; // center Y for weaving
  weaveAmplitude: number;
  weaveFrequency: number;
  weavePhase: number;
  
  // Rotation animation for middle band
  bandRotation: number; // 0-1, represents rotation progress
  bandRotationSpeed: number; // units per second
  
  // Shooting behavior (medium + large only)
  lastShotTime: number;
  nextShotTime: number;
  canShoot: boolean; // false for small UFO
  
  // State
  active: boolean;
  spawnSide: "left" | "right";
  hasExited: boolean;
  
  // Tracking (medium UFO at difficulty 4+)
  canTrack: boolean; // difficulty 4+
  trackingStrength: number; // 0-1, how much it follows player
  
  // Small UFO specific
  attackPhase: "approach" | "dive" | "retreat" | "done";
  attackCount: number; // Number of completed attacks
  maxAttacks: number; // Scaled by difficulty (1-2)
  targetX: number; // Dive target position
  targetY: number; // Dive target position
  
  // Large UFO specific
  isHovering: boolean; // true when reached hover position
  hoverX: number; // Target hover position
  hoverY: number; // Target hover position
  nextBurstTime: number; // Time until next bullet burst
  burstCooldown: number; // Seconds between bursts
  isCharging: boolean; // Pre-fire glow state
  chargeStartTime: number; // When charging began
  chargeDuration: number; // How long to glow before firing
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

export type BulletPattern = 
  | "simple_spread"    // Difficulty 1-3: 45° arc
  | "multi_arc"        // Difficulty 4-6: Multiple arcs
  | "spiral"           // Difficulty 7-10: Rotating spiral
  | "double_ring"      // Difficulty 7-10: Two concentric rings
  | "alternating"      // Difficulty 7-10: Alternating bursts

export interface UFOTypeConfig {
  enabled: boolean;
  difficulty: number; // 1-10
  baseSpeed: number;
  scale: number;
  spawnInterval: { min: number; max: number }; // seconds
  hitboxRadius: number;
  
  // Small UFO specific
  diveSpeed?: number;
  turnRate?: number; // degrees per second
  maxAttacks?: number;
  
  // Medium UFO specific
  weaveAmplitude?: { min: number; max: number };
  shotInterval?: { min: number; max: number };
  
  // Large UFO specific
  hoverHeight?: number; // from top of screen
  burstCooldown?: { min: number; max: number };
  chargeDuration?: number;
  bulletSpeedRange?: { min: number; max: number };
}
