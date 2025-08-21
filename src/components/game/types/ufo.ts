export interface UFO {
  id: string;
  type: "large" | "small";
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number; // for vertical sway
  swayPhase: number; // for oscillation
  lastFireTime: number;
  nextFireTime: number;
  entryEdge: "left" | "right" | "top" | "bottom";
  exitEdge: "left" | "right" | "top" | "bottom";
  alive: boolean;
  lastPingTime: number;
  nextPingTime: number;
}

export interface UFOBullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  fromType: "large" | "small";
}

export interface UFOConfig {
  enabled: boolean;
  classicMode: boolean; // true = classic on-screen aim, false = deluxe cross-wrap
  maxSimultaneous: number;
  spawnIntervalMin: number; // seconds
  spawnIntervalMax: number;
  quietPeriodMin: number; // seconds after death
  quietPeriodMax: number;
  smallOnlyScoreThreshold: number;
  
  // Large saucer settings
  largeSpeed: { min: number; max: number };
  largeFireInterval: { min: number; max: number };
  largeAimCone: number; // degrees of inaccuracy
  largePoints: number;
  
  // Small saucer settings  
  smallSpeed: { min: number; max: number };
  smallFireInterval: { min: number; max: number };
  smallAimConeEarly: number; // degrees at start
  smallAimConeLate: number; // degrees at high score
  smallPoints: number;
  
  // Bullet settings
  bulletSpeed: { min: number; max: number };
  bulletLifetime: { min: number; max: number };
  maxBullets: number;
  
  // Movement settings
  swayAmplitude: { min: number; max: number };
  swayPeriod: { min: number; max: number }; // seconds for full oscillation
}

export interface UFOSpawnData {
  type: "large" | "small";
  spawnTime: number;
  entryEdge: "left" | "right" | "top" | "bottom";
  exitEdge: "left" | "right" | "top" | "bottom";
  speed: number;
  swayAmplitude: number;
  swayPeriod: number;
}

export interface UFOState {
  ufos: UFO[];
  bullets: UFOBullet[];
  lastSpawnTime: number;
  nextSpawnTime: number;
  lastDeathTime: number;
  spawnCount: number;
  config: UFOConfig;
  rng: () => number;
}

export interface UFOEvents {
  onSpawn?: (ufo: UFO) => void;
  onShotFired?: (ufo: UFO, bullet: UFOBullet) => void;
  onDestroyed?: (ufo: UFO, destroyedBy: "player" | "asteroid") => void;
  onPing?: (ufo: UFO) => void;
}