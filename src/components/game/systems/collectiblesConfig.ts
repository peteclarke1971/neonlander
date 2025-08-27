export const COLLECTIBLES_CONFIG = {
  enabled: true,
  count: 3, // target per level
  minItemsGuaranteed: 1, // always place at least this many
  pointsPerPickup: 150,
  setBonus: 1000, // bonus for collecting all 3
  fuelRewardPct: 3, // percentage of tank per pickup
  fuelRewardPctCap: 10, // max total fuel reward per level
  minClearWallFactor: 1.5, // × shipHeight clearance from walls
  minDistPadFactor: 3.0, // × shipHeight from pads
  minDistHazardFactor: 3.0, // × shipHeight from hazards
  slopeCapDegSurface: 22, // max terrain slope under surface items
  safeWindowSec: 1.2, // minimum safe window vs hazards
  fuelMarginMinPctTank: 8, // minimum fuel margin after collection route
  
  // Placement attempt limits
  maxPlacementAttempts: 50,
  maxRepairAttempts: 10,
  nudgeMaxDistance: 120, // max nudge distance in pixels
  
  // Visual settings
  pickupRadius: 24, // collision radius for pickup
  glowRadius: 32, // visual glow effect radius
  animationSpeed: 1.0, // global animation speed multiplier
  
  // Seeding
  junkSeedPrefix: "SPACEJUNK",
  fixSeedPrefix: "JUNK_FIX"
};

export const WORMHOLE_CONFIG = {
  enabled: true,
  radius: 60, // approximately 1.9×shipHeight
  placementClearanceFactor: 2.0, // × shipHeight from walls/hazards
  targetPool: ["Asteroids", "LightCycles", "Random"] as const,
  
  // Animation settings
  ringAnimationSpeed: 1.0,
  openAnimationDuration: 800, // ms
  glowIntensity: 1.2,
  
  // Placement preferences
  preferredDistanceFromGoal: 150, // pixels from destination pad
  maxDistanceFromGoal: 300, // fallback limit
  minAltitudeAboveTerrain: 80, // minimum height above ground
  
  // Bonus challenge settings
  bonusDuration: 90, // seconds
  bonusPointsMultiplier: 1.5
};

// Tint colors for different space junk types (HSL format matching design system)
export const JUNK_TINTS = {
  panel: "hsl(200, 90%, 50%)", // primary blue
  toolbox: "hsl(180, 100%, 50%)", // accent cyan
  antenna: "hsl(160, 80%, 45%)", // green-cyan
  circuit: "hsl(220, 85%, 55%)", // purple-blue
  canister: "hsl(40, 90%, 55%)", // orange
  crystal: "hsl(300, 85%, 60%)" // magenta
};

// Shape selection weights (higher = more likely to appear)
export const SHAPE_WEIGHTS = {
  panel: 1.0,
  toolbox: 1.0,
  antenna: 0.8,
  circuit: 1.2,
  canister: 0.9,
  crystal: 0.6 // rarest
};

export type CollectiblesMode = "surface" | "caverns";
export type WormholeTarget = typeof WORMHOLE_CONFIG.targetPool[number];