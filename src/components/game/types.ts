export type Difficulty = "easy" | "hard";
export type Mode = "classic" | "fixed" | "caverns" | "survival" | "timetrial";

export interface MovingPad extends Pad {
  motion: "shuttle" | "elevator" | "arc";
  pos0: { x: number; y: number };
  pos1: { x: number; y: number };
  speed: number; // px/s
  baseSpeed?: number; // baseline 1x speed for fairness checks
  dwell: number; // seconds at each end
  currentPos: { x: number; y: number };
  currentVelocity: { x: number; y: number };
  phase: "moving" | "dwelling";
  phaseTimer: number;
  direction: 1 | -1; // movement direction
  scoreMult: number; // MEGA multiplier (2.0x or 3.0x)
  enabledInCaverns: boolean;
  zIndex: number;
  seed: number; // for deterministic behavior
  // Arc-specific properties (optional)
  arcCenter?: { x: number; y: number };
  arcRadius?: number;
  arcAngle0?: number;
  arcAngle1?: number;
  frozen?: boolean; // Flag to freeze pad movement when lander is on it
}

export interface Volcano {
  x: number;
  y: number;
  size: number;
  nextEruption: number;
  eruptionInterval: number;
  isErupting: boolean;
  eruptionTimer: number;
  eruptionDuration: number;
  power: number;
  emissionCarry?: number;
}

export interface Pad {
  xStart: number;
  xEnd: number;
  y: number;
  multiplier: number; // size-based score multiplier
  width?: number; // computed visual width in world units (optional)
  bonus2x?: boolean; // special 2x pad bonus flag
}

export interface SequencedPad extends Pad {
  sequenceNumber: number; // 1-5 for time trial mode
  completed?: boolean;
}

export interface TerrainData {
  worldWidth: number;
  points: { x: number; y: number }[];
  pads: Pad[];
  movingPads?: MovingPad[];
  volcanoes?: Volcano[];
  collectibles?: CollectiblesData;
  coral?: CoralFormation[];
  jellyfish?: Jellyfish[];
  getHeightAt: (x: number) => number;
  getPadAt: (x: number) => Pad | null;
  getMovingPadAt?: (x: number, y: number, level?: number) => MovingPad | null;
  isCavern?: false;
  sequencedPads?: SequencedPad[]; // For time trial mode
}

export interface HUDSnapshot {
  altitude: number;
  vx: number;
  vy: number;
  fuel: number;
  fuelCap?: number;
  score: number;
  time: number;
  difficulty: Difficulty;
  levelSeed?: number;
  rotateBoostActive?: boolean;
  ghostTimeDiff?: number;
  // Time Trial specific fields
  timeTrialTarget?: number;
  timeTrialTotalPads?: number;
  timeTrialRaceTime?: number;
  timeTrialRaceActive?: boolean;
  timeTrialLevel?: number;
}

export interface GameOverData {
  score: number;
  landings: number;
  cause: "crash" | "fuel" | "abort" | "success";
  difficulty: Difficulty;
  elapsed: number;
  // Optional: last landing breakdown for richer presentation
  lastEarned?: number;
  padBonus2x?: boolean;
  bullseye?: boolean;
  speedBonus?: boolean;
  levelSeed?: number;
  level?: number;
  // Ghost-related data
  isNewBestTime?: boolean;
  ghostTimeDiff?: number;
  isWorldRecord?: boolean;
  // Time Trial specific data
  completedSequence?: number[];
  totalPadsRequired?: number;
  timeTrialCompletionTime?: number;
  timeTrialGhostFrames?: any[];
  // Spawn position for retry
  initialSpawnX?: number;
  initialSpawnY?: number;
}

export interface HighScore {
  initials: string; // up to 3 chars
  score: number;
  difficulty: Difficulty;
  date: number; // epoch ms
}

// Collectibles system types
export interface SpaceJunk {
  id: string;
  pos: { x: number; y: number };
  shape: "panel" | "toolbox" | "antenna" | "circuit" | "canister" | "crystal";
  spinDegPerSec: number;
  tint: string;
  radius: number;
  fuelRewardPct: number;
  points: number;
  collected: boolean;
  seed: number;
}

export interface WormholeDoor {
  id: string;
  pos: { x: number; y: number };
  radius: number;
  open: boolean;
  seed: number;
  targetBonus: "Asteroids" | "LightCycles" | "Random";
}

export interface ShieldPickup {
  id: string;
  pos: { x: number; y: number };
  collected: boolean;
  seed: number;
  radius: number;
  pulsePhase: number;
}

export interface CollectiblesData {
  spaceJunk: SpaceJunk[];
  wormholeDoor?: WormholeDoor;
  shieldPickup?: ShieldPickup;
  collected: Set<string>;
  totalCollected: number;
  setComplete: boolean;
}

export interface CoralFormation {
  x: number;           // World X position (base on terrain)
  y: number;           // World Y position (base on terrain)
  type: 'branch' | 'frond' | 'fan' | 'tube' | 'anemone';
  height: number;      // 30-120px
  width: number;       // 20-80px
  color: string;       // Neon coral colors
  seed: number;        // For deterministic rendering
  segments?: number;   // Number of branches/segments (for branching types)
  swayPhase: number;   // For animation phase offset
}

export interface Jellyfish {
  id: string;
  x: number;
  y: number;
  vx: number; // Horizontal drift velocity
  vy: number; // Vertical bobbing velocity
  size: number; // 20-60px (bell diameter)
  targetY: number; // For bobbing motion
  bobbingPhase: number; // Sine wave offset
  bobbingSpeed: number; // How fast it bobs (0.3-0.8)
  bobbingAmplitude: number; // How far it bobs (20-40px)
  
  // Electric burst state
  burstTimer: number; // Countdown to next burst
  burstInterval: number; // Time between bursts (4-8 seconds)
  telegraphTimer: number; // 1.5s warning before burst
  isTelegraphing: boolean; // Glowing brighter
  isBursting: boolean; // Active shockwave
  burstDuration: number; // How long burst lasts (0.3s)
  burstProgress: number; // 0-1 for animation
  
  // Rendering
  tentaclePhase: number; // Animation offset
  glowIntensity: number; // 0.5-1.0 normal, 1.5+ when telegraphing
}