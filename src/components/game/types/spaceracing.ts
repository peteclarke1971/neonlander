export type SpaceRaceDifficulty = "Easy" | "Normal" | "Hard";
export type RaceMode = "time-trial" | "grand-prix" | "endless";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SpaceShip {
  position: Vec3;
  velocity: Vec3;
  rotation: Vec3; // pitch, yaw, roll in radians
  speed: number;
  baseSpeed: number;
  maxSpeed: number;
  alive: boolean;
  boostMeter: number; // 0-3 stored boosts
  isPlayer: boolean;
  id: string;
}

export interface RaceTrack {
  seed: string;
  centerline: Vec3[];
  segments: TrackSegment[];
  gates: RaceGate[];
  worldBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  length: number;
}

export interface TrackSegment {
  type: "star-trench" | "asteroid-belt" | "ring-corridor" | "wormhole-tube" | "satellite-slalom" | "debris-chicane";
  startIndex: number;
  endIndex: number;
  width: number;
  bankAngle: number; // degrees
  hazardDensity: number; // 0-1
  gateSpacing: number; // seconds between gates
  obstacles: TrackObstacle[];
}

export interface TrackObstacle {
  id: string;
  type: "wall" | "asteroid" | "gate" | "satellite" | "debris";
  position: Vec3;
  size: Vec3;
  rotation?: Vec3;
  velocity?: Vec3;
  wireframe: WireframeLine[];
}

export interface WireframeLine {
  start: Vec3;
  end: Vec3;
  color: string;
  glow?: boolean;
}

export interface RaceGate {
  id: string;
  position: Vec3;
  normal: Vec3; // direction facing
  width: number;
  height: number;
  passed: boolean;
  wireframe: WireframeLine[];
}

export interface RaceCamera {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number; // degrees
  near: number;
  far: number;
}

export interface SpaceRaceGameOverData {
  score: number;
  tracksCompleted: number;
  cause: "crash" | "timeout" | "abort" | "success";
  difficulty: SpaceRaceDifficulty;
  elapsed: number;
  bestLapTime?: number;
  gatesPassed: number;
  totalGates: number;
}

export interface SpaceRaceHUDSnapshot {
  score: number;
  track: number;
  time: number;
  lapTime?: number;
  bestLap?: number;
  difficulty: SpaceRaceDifficulty;
  speed: number;
  gatesPassed: number;
  totalGates: number;
  boostMeter: number;
  nextGateDistance?: number;
  position?: number; // race position vs AI
}

export interface RaceAI {
  ship: SpaceShip;
  targetPoint: Vec3;
  lookAheadDistance: number;
  aggressiveness: number; // 0-1
  errorNoise: number; // variance in path following
  reactionDelay: number; // seconds
  lastDecisionTime: number;
}

export interface RaceAssists {
  gateMagnet: boolean; // subtle centering force toward gates
  horizonLock: boolean; // keep camera level except in banked segments
  autoRoll: boolean; // auto-match banking angle
}

export interface Matrix4 {
  elements: number[]; // 16-element array in column-major order
}

export interface ProjectionResult {
  x: number;
  y: number;
  z: number; // depth for sorting
  visible: boolean; // within view frustum
}

// Race seed system types
export interface RaceSeed {
  base: string;
  track: number;
  variant: string;
}

// Performance optimization types
export interface RenderBatch {
  lines: WireframeLine[];
  color: string;
  glow: boolean;
}

export interface LODConfig {
  maxDistance: number;
  lineReduction: number; // 0-1, how much to reduce line density
  skipSmallObjects: boolean;
}