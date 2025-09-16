export type Difficulty = "easy" | "hard";
export type Mode = "classic" | "fixed" | "caverns";

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

export interface TerrainData {
  worldWidth: number;
  points: { x: number; y: number }[];
  pads: Pad[];
  movingPads?: MovingPad[];
  volcanoes?: Volcano[];
  collectibles?: CollectiblesData;
  getHeightAt: (x: number) => number;
  getPadAt: (x: number) => Pad | null;
  getMovingPadAt?: (x: number, y: number, level?: number) => MovingPad | null;
  isCavern?: false;
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

export interface CollectiblesData {
  spaceJunk: SpaceJunk[];
  wormholeDoor?: WormholeDoor;
  collected: Set<string>;
  totalCollected: number;
  setComplete: boolean;
}