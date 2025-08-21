export type LightCyclesDifficulty = "Easy" | "Normal" | "Hard";

export interface LightCycle {
  x: number;
  y: number;
  direction: 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left
  speed: number;
  color: string;
  trail: TrailSegment[];
  alive: boolean;
  isPlayer: boolean;
  id: string;
}

export interface TrailSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  glow: boolean;
}

export interface LightCyclesGameOverData {
  score: number;
  wave: number;
  cause: "collision" | "abort";
  difficulty: LightCyclesDifficulty;
  elapsed: number;
  cyclesDestroyed: number;
}

export interface LightCyclesHUDSnapshot {
  score: number;
  wave: number;
  time: number;
  difficulty: LightCyclesDifficulty;
  cyclesRemaining: number;
  speed: number;
  accelerating: boolean;
}

export interface GameArena {
  width: number;
  height: number;
  gridSize: number;
  bounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}