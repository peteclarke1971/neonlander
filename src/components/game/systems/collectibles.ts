import { Vec2 } from './sdf';
import { Pad, MovingPad } from '../types';
import { COLLECTIBLES_CONFIG, WORMHOLE_CONFIG, JUNK_TINTS, SHAPE_WEIGHTS, CollectiblesMode } from './collectiblesConfig';
import { SpaceJunkShape } from './spaceJunkAssets';

export interface SpaceJunk {
  id: string;
  pos: Vec2;
  shape: SpaceJunkShape;
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
  pos: Vec2;
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

export interface PlacementContext {
  worldWidth: number;
  worldHeight: number;
  getHeightAt: (x: number) => number;
  pads: Pad[];
  movingPads?: MovingPad[];
  shipHeight: number;
  mode: CollectiblesMode;
  startPos: Vec2;
  goalPos: Vec2;
  // For caverns
  checkCollision?: (x: number, y: number, radius: number) => boolean;
  // For hazards/volcanoes
  hasHazardAt?: (x: number, y: number, radius: number) => boolean;
}

// Seeded random number generator
function mulberry32(seed: number) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Create deterministic seed for junk item
function createJunkSeed(levelSeed: number, index: number): number {
  // Mix level seed with junk prefix and index
  let seed = levelSeed;
  const prefix = COLLECTIBLES_CONFIG.junkSeedPrefix;
  for (let i = 0; i < prefix.length; i++) {
    seed = (seed * 31 + prefix.charCodeAt(i)) | 0;
  }
  return (seed + index * 1337) | 0;
}

// Select random shape based on weights
function selectShape(rng: () => number): SpaceJunkShape {
  const shapes = Object.keys(SHAPE_WEIGHTS) as SpaceJunkShape[];
  const totalWeight = Object.values(SHAPE_WEIGHTS).reduce((sum, w) => sum + w, 0);
  
  let rand = rng() * totalWeight;
  for (const shape of shapes) {
    rand -= SHAPE_WEIGHTS[shape];
    if (rand <= 0) return shape;
  }
  return shapes[shapes.length - 1]; // fallback
}

// Check if position is safe for surface placement
function isSafeSurfacePosition(
  x: number, y: number,
  context: PlacementContext
): boolean {
  const { worldWidth, getHeightAt, pads, movingPads, shipHeight } = context;
  const config = COLLECTIBLES_CONFIG;
  
  // Check world bounds
  if (x < 50 || x > worldWidth - 50) return false;
  
  // Check height above terrain - prevent embedding in terrain
  const terrainY = getHeightAt(x);
  const minHeight = terrainY - shipHeight * config.minClearWallFactor;
  if (y >= minHeight) return false; // Must be clearly above terrain
  
  // Check terrain slope
  const slopeWindow = 30;
  const leftY = getHeightAt(x - slopeWindow);
  const rightY = getHeightAt(x + slopeWindow);
  const slope = Math.abs(rightY - leftY) / (slopeWindow * 2);
  const slopeAngle = Math.atan(slope) * 180 / Math.PI;
  if (slopeAngle > config.slopeCapDegSurface) return false;
  
  // Check distance from pads
  const minPadDist = shipHeight * config.minDistPadFactor;
  for (const pad of pads) {
    const padCenterX = (pad.xStart + pad.xEnd) / 2;
    const dist = Math.sqrt((x - padCenterX) ** 2 + (y - pad.y) ** 2);
    if (dist < minPadDist) return false;
  }
  
  // Check distance from moving pads
  if (movingPads) {
    for (const mp of movingPads) {
      const dist = Math.sqrt((x - mp.currentPos.x) ** 2 + (y - mp.currentPos.y) ** 2);
      if (dist < minPadDist) return false;
    }
  }
  
  // Check hazards if available
  if (context.hasHazardAt && context.hasHazardAt(x, y, shipHeight * config.minDistHazardFactor)) {
    return false;
  }
  
  return true;
}

// Check if position is safe for cavern placement
function isSafeCavernPosition(
  x: number, y: number,
  context: PlacementContext
): boolean {
  const { worldWidth, worldHeight, pads, movingPads, shipHeight, checkCollision } = context;
  const config = COLLECTIBLES_CONFIG;
  
  // Check world bounds
  if (x < 50 || x > worldWidth - 50 || y < 50 || y > worldHeight - 50) return false;
  
  // Check collision with walls
  if (checkCollision) {
    const clearRadius = shipHeight * config.minClearWallFactor;
    if (checkCollision(x, y, clearRadius)) return false;
  }
  
  // Check distance from pads
  const minPadDist = shipHeight * config.minDistPadFactor;
  for (const pad of pads) {
    const padCenterX = (pad.xStart + pad.xEnd) / 2;
    const dist = Math.sqrt((x - padCenterX) ** 2 + (y - pad.y) ** 2);
    if (dist < minPadDist) return false;
  }
  
  // Check distance from moving pads
  if (movingPads) {
    for (const mp of movingPads) {
      const dist = Math.sqrt((x - mp.currentPos.x) ** 2 + (y - mp.currentPos.y) ** 2);
      if (dist < minPadDist) return false;
    }
  }
  
  return true;
}

// Generate a single space junk item
function generateSpaceJunkItem(
  levelSeed: number,
  index: number,
  context: PlacementContext,
  terrainColor?: string
): SpaceJunk | null {
  const seed = createJunkSeed(levelSeed, index);
  const rng = mulberry32(seed);
  
  const shape = selectShape(rng);
  const config = COLLECTIBLES_CONFIG;
  
  // Try to find a safe position
  for (let attempt = 0; attempt < config.maxPlacementAttempts; attempt++) {
    const x = 100 + rng() * (context.worldWidth - 200);
    const y = context.mode === "surface" 
      ? 100 + rng() * (context.worldHeight / 2) // Upper half for surface
      : 100 + rng() * (context.worldHeight - 200); // Anywhere for caverns
    
    const isSafe = context.mode === "surface"
      ? isSafeSurfacePosition(x, y, context)
      : isSafeCavernPosition(x, y, context);
    
    if (isSafe) {
      return {
        id: `junk_${index}_${seed}`,
        pos: { x, y },
        shape,
        spinDegPerSec: (rng() - 0.5) * 60, // -30 to +30 degrees per second
        tint: terrainColor || JUNK_TINTS[shape],
        radius: config.pickupRadius * 0.5,
        fuelRewardPct: config.fuelRewardPct,
        points: config.pointsPerPickup,
        collected: false,
        seed
      };
    }
  }
  
  return null; // Failed to place
}

// Repair placement for failed items
function repairSpaceJunkPlacement(
  junk: SpaceJunk,
  context: PlacementContext,
  attempt: number
): SpaceJunk | null {
  const config = COLLECTIBLES_CONFIG;
  const repairSeed = createJunkSeed(junk.seed, attempt + 1000);
  const rng = mulberry32(repairSeed);
  
  if (attempt < 3) {
    // Try nudging position
    const nudgeX = (rng() - 0.5) * config.nudgeMaxDistance;
    const nudgeY = (rng() - 0.5) * config.nudgeMaxDistance;
    const newX = Math.max(50, Math.min(context.worldWidth - 50, junk.pos.x + nudgeX));
    const newY = Math.max(50, Math.min(context.worldHeight - 50, junk.pos.y + nudgeY));
    
    const isSafe = context.mode === "surface"
      ? isSafeSurfacePosition(newX, newY, context)
      : isSafeCavernPosition(newX, newY, context);
    
    if (isSafe) {
      return { ...junk, pos: { x: newX, y: newY } };
    }
  }
  
  if (attempt < 6) {
    // Boost fuel reward
    const extraReward = (attempt - 2) * 1; // +1% per attempt
    return { ...junk, fuelRewardPct: junk.fuelRewardPct + extraReward };
  }
  
  // Last resort: place near start position
  const startOffset = 100 + rng() * 50;
  const angle = rng() * Math.PI * 2;
  const safeX = context.startPos.x + Math.cos(angle) * startOffset;
  const safeY = context.startPos.y + Math.sin(angle) * startOffset;
  
  return {
    ...junk,
    pos: { x: safeX, y: safeY },
    fuelRewardPct: Math.min(junk.fuelRewardPct + 2, config.fuelRewardPctCap)
  };
}

// Main collectibles generation function
export function generateCollectibles(
  levelSeed: number,
  context: PlacementContext,
  terrainColor?: string
): CollectiblesData {
  const config = COLLECTIBLES_CONFIG;
  const spaceJunk: SpaceJunk[] = [];
  
  if (!config.enabled) {
    return {
      spaceJunk: [],
      collected: new Set(),
      totalCollected: 0,
      setComplete: false
    };
  }
  
  // Generate space junk items
  for (let i = 0; i < config.count; i++) {
    let junk = generateSpaceJunkItem(levelSeed, i, context, terrainColor);
    
    // Try repairs if initial placement failed
    if (!junk) {
      for (let repair = 0; repair < config.maxRepairAttempts && !junk; repair++) {
        // Create a dummy junk for repair attempts
        const dummyJunk: SpaceJunk = {
          id: `junk_${i}_repair`,
          pos: { x: context.worldWidth / 2, y: context.worldHeight / 2 },
          shape: selectShape(mulberry32(levelSeed + i)),
          spinDegPerSec: 0,
          tint: terrainColor || JUNK_TINTS.panel,
          radius: config.pickupRadius * 0.5,
          fuelRewardPct: config.fuelRewardPct,
          points: config.pointsPerPickup,
          collected: false,
          seed: createJunkSeed(levelSeed, i)
        };
        
        junk = repairSpaceJunkPlacement(dummyJunk, context, repair);
      }
    }
    
    if (junk) {
      spaceJunk.push(junk);
    }
  }
  
  // Ensure minimum guaranteed items
  while (spaceJunk.length < config.minItemsGuaranteed) {
    const fallbackJunk: SpaceJunk = {
      id: `junk_fallback_${spaceJunk.length}`,
      pos: {
        x: context.startPos.x + 120 + spaceJunk.length * 80,
        y: context.startPos.y - 60
      },
      shape: "panel",
      spinDegPerSec: 15,
      tint: terrainColor || JUNK_TINTS.panel,
      radius: config.pickupRadius * 0.5,
      fuelRewardPct: config.fuelRewardPct + 2, // Extra reward for fallback
      points: config.pointsPerPickup,
      collected: false,
      seed: levelSeed + spaceJunk.length + 9999
    };
    
    spaceJunk.push(fallbackJunk);
  }
  
  return {
    spaceJunk,
    collected: new Set(),
    totalCollected: 0,
    setComplete: false
  };
}

// Generate wormhole door when set is complete
export function generateWormholeDoor(
  levelSeed: number,
  context: PlacementContext
): WormholeDoor | null {
  const config = WORMHOLE_CONFIG;
  
  if (!config.enabled) return null;
  
  const rng = mulberry32(levelSeed + 12345);
  
  // Try to place near goal position
  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = rng() * Math.PI * 2;
    const distance = config.preferredDistanceFromGoal + rng() * (config.maxDistanceFromGoal - config.preferredDistanceFromGoal);
    
    const x = context.goalPos.x + Math.cos(angle) * distance;
    const y = context.goalPos.y + Math.sin(angle) * distance;
    
    // Check bounds
    if (x < config.radius || x > context.worldWidth - config.radius) continue;
    if (y < config.radius || y > context.worldHeight - config.radius) continue;
    
    // Check clearance
    const clearance = context.shipHeight * config.placementClearanceFactor;
    
    if (context.mode === "surface") {
      const terrainY = context.getHeightAt(x);
      if (y > terrainY - config.minAltitudeAboveTerrain) continue;
    } else if (context.checkCollision) {
      if (context.checkCollision(x, y, clearance)) continue;
    }
    
    // Valid position found
    return {
      id: `wormhole_${levelSeed}`,
      pos: { x, y },
      radius: config.radius,
      open: false,
      seed: levelSeed + 54321,
      targetBonus: config.targetPool[Math.floor(rng() * config.targetPool.length)]
    };
  }
  
  return null; // Failed to place
}

// Check if player can collect junk item
export function checkJunkPickup(
  playerPos: Vec2,
  playerRadius: number,
  junk: SpaceJunk
): boolean {
  if (junk.collected) return false;
  
  const dx = playerPos.x - junk.pos.x;
  const dy = playerPos.y - junk.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance <= junk.radius + playerRadius;
}

// Check if player can enter wormhole
export function checkWormholeEntry(
  playerPos: Vec2,
  playerRadius: number,
  wormhole: WormholeDoor
): boolean {
  if (!wormhole.open) return false;
  
  const dx = playerPos.x - wormhole.pos.x;
  const dy = playerPos.y - wormhole.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance <= wormhole.radius * 0.7; // Smaller trigger area than visual
}

// Update collectibles state after pickup
export function collectJunk(
  collectibles: CollectiblesData,
  junkId: string
): { fuelReward: number; points: number; setComplete: boolean } {
  const junk = collectibles.spaceJunk.find(j => j.id === junkId);
  if (!junk || junk.collected) {
    return { fuelReward: 0, points: 0, setComplete: false };
  }
  
  junk.collected = true;
  collectibles.collected.add(junkId);
  collectibles.totalCollected++;
  
  let points = junk.points;
  let setComplete = false;
  
  // Check if set is complete
  if (collectibles.totalCollected >= collectibles.spaceJunk.length) {
    collectibles.setComplete = true;
    setComplete = true;
    points += COLLECTIBLES_CONFIG.setBonus;
    
    // Open wormhole if it exists
    if (collectibles.wormholeDoor) {
      collectibles.wormholeDoor.open = true;
    }
  }
  
  return {
    fuelReward: junk.fuelRewardPct,
    points,
    setComplete
  };
}