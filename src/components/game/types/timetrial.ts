export type Difficulty = "easy" | "hard";

export interface TimeTrialGameOverData {
  cause: "crash" | "fuel" | "success";
  completionTime: number; // milliseconds
  level: number;
  difficulty: Difficulty;
  levelSeed: number;
  isNewBestTime?: boolean;
  ghostTimeDiff?: number;
  isWorldRecord?: boolean;
  padsLanded: number;
  totalPads: number;
}

export interface TimeTrialPad {
  xStart: number;
  xEnd: number;
  y: number;
  sequenceNumber: number; // 1-5
  isActive: boolean; // false = already landed on
  glowIntensity: number; // for next target animation
  width?: number;
}

export interface RespawnState {
  active: boolean;
  startTime: number;
  checkpointPad: TimeTrialPad;
  progress: number; // 0-1 for materialization animation
  x: number;
  y: number;
}

export interface TimeTrialSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  fuel: number;
  time: number;
  padsLanded: number;
}
