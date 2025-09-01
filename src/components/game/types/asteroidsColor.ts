export interface ColorAsteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  av: number; // angular velocity
  size: "large" | "medium" | "small" | "giant";
  color: "green" | "amber" | "red";
  points: { x: number; y: number }[]; // irregular shape vertices
  penaltyCooldown?: number; // cooldown to prevent chain penalties
}

export interface ColorProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // time to live
}

export interface ColorOrderGameState {
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    thrust: number;
    invulnerable: number; // invulnerability frames after respawn
  };
  asteroids: ColorAsteroid[];
  projectiles: ColorProjectile[];
  score: number;
  lives: number;
  wave: number;
  ammo: number;
  target: "green" | "amber" | "red";
  gameStarted: boolean;
  gameOver: boolean;
  paused: boolean;
  phaseAdvanceEffect?: {
    startTime: number;
    color: string;
  };
  wrongHitEffect?: {
    startTime: number;
    x: number;
    y: number;
  };
}

export interface ColorOrderHUDSnapshot {
  score: number;
  lives: number;
  wave: number;
  ammo: number;
  difficulty: string;
  target: "green" | "amber" | "red";
}

export interface ColorOrderGameOverData {
  score: number;
  wave: number;
  cause: "destroyed" | "abort";
  difficulty: string;
  elapsed: number;
  seed: number;
}