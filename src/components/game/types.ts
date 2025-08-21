export type Difficulty = "easy" | "hard";
export type Mode = "classic" | "fixed" | "caverns";

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
  volcanoes?: Volcano[];
  getHeightAt: (x: number) => number;
  getPadAt: (x: number) => Pad | null;
  isCavern?: false;
}

export interface HUDSnapshot {
  altitude: number;
  vx: number;
  vy: number;
  fuel: number;
  score: number;
  time: number;
  difficulty: Difficulty;
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
}

export interface HighScore {
  initials: string; // up to 3 chars
  score: number;
  difficulty: Difficulty;
  date: number; // epoch ms
}