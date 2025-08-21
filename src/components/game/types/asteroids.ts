export interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  av: number; // angular velocity
  size: "large" | "medium" | "small";
  points: { x: number; y: number }[]; // irregular shape vertices
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // time to live
}

export interface AsteroidsGameState {
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    thrust: number;
    invulnerable: number; // invulnerability frames after respawn
  };
  asteroids: Asteroid[];
  projectiles: Projectile[];
  score: number;
  lives: number;
  wave: number;
  ammo: number;
  gameStarted: boolean;
  gameOver: boolean;
  paused: boolean;
}

export interface AsteroidsHUDSnapshot {
  score: number;
  lives: number;
  wave: number;
  ammo: number;
  difficulty: string;
}

export interface AsteroidsGameOverData {
  score: number;
  wave: number;
  cause: "destroyed" | "abort";
  difficulty: string;
  elapsed: number;
}