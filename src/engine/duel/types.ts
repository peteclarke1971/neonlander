export interface DuelPlayer {
  id: 1 | 2;
  // Position and physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians
  angularVel: number;
  
  // Game state
  armor: number; // 4 pips max
  fuel: number;
  maxFuel: number;
  
  // Power-up state
  activePowerup: PowerupType | null;
  powerupTimeLeft: number; // seconds
  shieldHitsLeft: number; // for bubble shield
  
  // Combat state
  invulnerable: boolean;
  invulnTime: number; // remaining invuln time in ms
  
  // Control state
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  fire: boolean;
  rotateBoost: boolean;
  
  // Stats
  roundsWon: number;
}

export interface DuelProjectile {
  id: string;
  ownerId: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number; // remaining lifetime in seconds
  damage: number;
}

export interface PowerupPad {
  id: string;
  x: number;
  y: number;
  radius: number;
  powerupType: PowerupType | null;
  cooldownTime: number; // seconds until next spawn
  glowing: boolean;
}

export interface VolcanoVent {
  id: string;
  x: number;
  y: number;
  radius: number;
  cycleTime: number; // current time in cycle (0-6s)
  isErupting: boolean;
  telegraphTime: number; // warning glow time
  particles: VolcanoParticle[];
}

export interface VolcanoParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  bounced: boolean;
  hot: boolean; // still dangerous
}

export interface Arena {
  layout: "twin-isles" | "keyhole" | "bridges";
  terrain: { x: number; y: number }[];
  spawnPoints: [{ x: number; y: number }, { x: number; y: number }]; // P1, P2
  powerupPads: PowerupPad[];
  volcanoVents: VolcanoVent[];
  worldWidth: number;
  worldHeight: number;
}

export type PowerupType = "twin" | "tri" | "shield";

export type DuelPhase = "countdown" | "active" | "round-end" | "match-end";

export interface DuelGameState {
  phase: DuelPhase;
  players: [DuelPlayer, DuelPlayer];
  projectiles: DuelProjectile[];
  arena: Arena;
  
  // Round management
  currentRound: number;
  roundTimer: number; // seconds in current round
  suddenDeath: boolean;
  
  // Match state
  matchWinner: 1 | 2 | null;
  
  // Timing
  phaseTimer: number; // time in current phase
  
  // Options
  wrap: boolean;
  hazards: boolean;
  seed: number;
}

export interface DuelOptions {
  seed: number;
  wrap: boolean;
  hazards: boolean;
}