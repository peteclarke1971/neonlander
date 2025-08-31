// Stage configuration system for Asteroids REMIX
export type EnemyType = "grunt" | "saucer" | "sniper" | "interceptor" | "minelayer" | "shieldCarrier" | "teleporter" | "snake";
export type Formation = "lanes" | "wedge" | "ring" | "stream" | "wall" | "zigzag" | "vortex" | "gate";

export interface PowerupSpec {
  kind: "double" | "triple" | "shield";
  tStart: number;
  tEnd: number;
  chance: number;
}

export interface AsteroidRule {
  kinds: ("large" | "medium" | "small" | "giant")[];
  density: number;
  drift: number;
}

export interface BossPattern {
  name: string;
  params?: Record<string, number | string>;
}

export interface BossConfig {
  id: string;
  hp: { easy: number; normal: number; hard: number };
  movement: { ampX: number; bob: number };
  patterns: BossPattern[];
  multiPart?: boolean;
  parts?: number;
  introWarning?: string;
  bonusScore: number;
}

export interface StageConfig {
  id: number;
  name: string;
  duration: number;
  scrollProfile: { start: number; mid: number; end: number };
  asteroid: AsteroidRule;
  formations: { at: number; type: Formation; density: number; len: number }[];
  enemies: { at: number; type: EnemyType; rate: number; extra?: any }[];
  powerups: PowerupSpec[];
  ufoTuning?: { fireScale: number; accuracy: number };
  boss: BossConfig;
}

export const REMIX_STAGES: StageConfig[] = [
  // Stage 1 - existing stage converted to config format
  {
    id: 1,
    name: "Asteroid Fields",
    duration: 60,
    scrollProfile: { start: 100, mid: 130, end: 120 },
    asteroid: {
      kinds: ["large", "medium", "small"],
      density: 0.8,
      drift: 1.0
    },
    formations: [
      { at: 12, type: "lanes", density: 0.8, len: 8 },
      { at: 25, type: "stream", density: 1.0, len: 12 },
      { at: 40, type: "ring", density: 0.9, len: 10 }
    ],
    enemies: [
      { at: 15, type: "grunt", rate: 0.5 },
      { at: 25, type: "saucer", rate: 0.3 }
    ],
    powerups: [],
    boss: {
      id: "guardian",
      hp: { easy: 180, normal: 220, hard: 280 },
      movement: { ampX: 120, bob: 20 },
      patterns: [
        { name: "spiral_spread" },
        { name: "direct_volley" },
        { name: "ring_burst" }
      ],
      bonusScore: 2500
    }
  },
  // Stage 2 - Ring Forge
  {
    id: 2,
    name: "Ring Forge",
    duration: 60,
    scrollProfile: { start: 120, mid: 150, end: 135 },
    asteroid: {
      kinds: ["large", "medium"],
      density: 1.0,
      drift: 1.1
    },
    formations: [
      { at: 12, type: "lanes", density: 0.9, len: 8 },
      { at: 18, type: "ring", density: 1.0, len: 12 },
      { at: 26, type: "wedge", density: 0.8, len: 10 },
      { at: 34, type: "stream", density: 1.2, len: 14 },
      { at: 42, type: "lanes", density: 1.0, len: 8 }
    ],
    enemies: [
      { at: 10, type: "interceptor", rate: 0.7 },
      { at: 20, type: "saucer", rate: 0.35 }
    ],
    powerups: [
      { kind: "double", tStart: 14, tEnd: 18, chance: 0.4 },
      { kind: "shield", tStart: 31, tEnd: 36, chance: 0.35 }
    ],
    boss: {
      id: "twin_forges",
      hp: { easy: 200, normal: 260, hard: 320 },
      movement: { ampX: 180, bob: 15 },
      patterns: [
        { name: "spiral_spread" },
        { name: "crossfire_volley" },
        { name: "tag_teleport" }
      ],
      multiPart: true,
      parts: 2,
      bonusScore: 3500
    }
  },
  // Stage 3 - Minefield Gauntlet
  {
    id: 3,
    name: "Minefield Gauntlet",
    duration: 60,
    scrollProfile: { start: 125, mid: 155, end: 140 },
    asteroid: {
      kinds: ["medium", "small"],
      density: 1.2,
      drift: 1.2
    },
    formations: [
      { at: 12, type: "zigzag", density: 1.0, len: 10 },
      { at: 20, type: "wall", density: 0.9, len: 12 },
      { at: 30, type: "stream", density: 1.3, len: 15 },
      { at: 40, type: "ring", density: 1.1, len: 8 }
    ],
    enemies: [
      { at: 12, type: "minelayer", rate: 0.45 },
      { at: 18, type: "snake", rate: 0.30 },
      { at: 24, type: "saucer", rate: 0.30 }
    ],
    powerups: [
      { kind: "shield", tStart: 9, tEnd: 14, chance: 0.35 },
      { kind: "double", tStart: 25, tEnd: 30, chance: 0.4 },
      { kind: "double", tStart: 37, tEnd: 42, chance: 0.35 }
    ],
    boss: {
      id: "carrier_swarm",
      hp: { easy: 240, normal: 300, hard: 380 },
      movement: { ampX: 100, bob: 25 },
      patterns: [
        { name: "drone_swarm" },
        { name: "shield_front_arc" },
        { name: "mine_barrage" }
      ],
      bonusScore: 4000
    }
  },
  // Stage 4 - Wormhole Siege
  {
    id: 4,
    name: "Wormhole Siege",
    duration: 60,
    scrollProfile: { start: 130, mid: 165, end: 145 },
    asteroid: {
      kinds: ["large", "medium", "small", "giant"],
      density: 1.1,
      drift: 1.3
    },
    formations: [
      { at: 14, type: "vortex", density: 1.2, len: 12 },
      { at: 24, type: "lanes", density: 1.0, len: 8 },
      { at: 34, type: "ring", density: 1.1, len: 10 },
      { at: 44, type: "stream", density: 1.3, len: 14 }
    ],
    enemies: [
      { at: 15, type: "teleporter", rate: 0.40 },
      { at: 20, type: "sniper", rate: 0.20 }
    ],
    powerups: [
      { kind: "triple", tStart: 16, tEnd: 20, chance: 0.30 },
      { kind: "shield", tStart: 28, tEnd: 33, chance: 0.35 }
    ],
    boss: {
      id: "wormhole_guardian",
      hp: { easy: 260, normal: 320, hard: 420 },
      movement: { ampX: 80, bob: 30 },
      patterns: [
        { name: "rotating_laser_gates" },
        { name: "portal_spawns" },
        { name: "ring_barrage" }
      ],
      bonusScore: 4500
    }
  },
  // Stage 5 - Crystal Armada
  {
    id: 5,
    name: "Crystal Armada",
    duration: 60,
    scrollProfile: { start: 135, mid: 170, end: 150 },
    asteroid: {
      kinds: ["medium", "small"],
      density: 1.3,
      drift: 1.4
    },
    formations: [
      { at: 10, type: "wedge", density: 1.0, len: 10 },
      { at: 18, type: "wall", density: 1.1, len: 12 },
      { at: 28, type: "lanes", density: 1.2, len: 8 },
      { at: 38, type: "zigzag", density: 1.0, len: 10 },
      { at: 48, type: "stream", density: 1.3, len: 14 }
    ],
    enemies: [
      { at: 12, type: "shieldCarrier", rate: 0.45 },
      { at: 18, type: "interceptor", rate: 0.55 },
      { at: 24, type: "teleporter", rate: 0.30 }
    ],
    powerups: [
      { kind: "double", tStart: 13, tEnd: 18, chance: 0.40 },
      { kind: "triple", tStart: 31, tEnd: 36, chance: 0.30 },
      { kind: "shield", tStart: 41, tEnd: 46, chance: 0.35 }
    ],
    boss: {
      id: "hexa_core_array",
      hp: { easy: 90, normal: 110, hard: 130 }, // per core
      movement: { ampX: 60, bob: 20 },
      patterns: [
        { name: "shield_cycle" },
        { name: "shot_lattice" },
        { name: "core_dash" }
      ],
      multiPart: true,
      parts: 6,
      bonusScore: 6000
    }
  },
  // Stage 6 - Vector Titan
  {
    id: 6,
    name: "Vector Titan",
    duration: 60,
    scrollProfile: { start: 140, mid: 175, end: 155 },
    asteroid: {
      kinds: ["large", "medium", "giant"],
      density: 1.2,
      drift: 1.5
    },
    formations: [
      { at: 12, type: "vortex", density: 1.3, len: 14 },
      { at: 22, type: "wall", density: 1.2, len: 12 },
      { at: 32, type: "lanes", density: 1.1, len: 8 },
      { at: 42, type: "ring", density: 1.3, len: 10 },
      { at: 52, type: "zigzag", density: 1.2, len: 12 }
    ],
    enemies: [
      { at: 14, type: "teleporter", rate: 0.45 },
      { at: 16, type: "shieldCarrier", rate: 0.50 },
      { at: 20, type: "snake", rate: 0.35 }
    ],
    powerups: [
      { kind: "triple", tStart: 9, tEnd: 13, chance: 0.30 },
      { kind: "shield", tStart: 24, tEnd: 28, chance: 0.35 },
      { kind: "triple", tStart: 39, tEnd: 43, chance: 0.25 }
    ],
    boss: {
      id: "vector_titan",
      hp: { easy: 240, normal: 300, hard: 380 },
      movement: { ampX: 100, bob: 15 },
      patterns: [
        { name: "alternating_laser_sweeps" },
        { name: "bombard_rings" },
        { name: "spiral_curtains" },
        { name: "mini_core_orbits" }
      ],
      bonusScore: 8000
    }
  }
];

// Utility functions for seeded randomness
export const mulberry32 = (seed: number) => {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

export const mix = (...args: (string | number)[]) => {
  const str = args.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

export const getStageConfig = (stageId: number): StageConfig | null => {
  return REMIX_STAGES.find(stage => stage.id === stageId) || null;
};