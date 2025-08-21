import { LightCycle, LightCyclesDifficulty } from "../types/lightcycles";
import { checkTrailCollision } from "./lightcycle";

export interface AIConfig {
  lookAheadDistance: number;
  reactionTime: number;
  aggressiveness: number;
  trapAttemptChance: number;
}

const AI_CONFIGS: Record<LightCyclesDifficulty, AIConfig> = {
  "Easy": {
    lookAheadDistance: 80,
    reactionTime: 0.3,
    aggressiveness: 0.2,
    trapAttemptChance: 0.1
  },
  "Normal": {
    lookAheadDistance: 120,
    reactionTime: 0.2,
    aggressiveness: 0.4,
    trapAttemptChance: 0.25
  },
  "Hard": {
    lookAheadDistance: 180,
    reactionTime: 0.1,
    aggressiveness: 0.7,
    trapAttemptChance: 0.4
  }
};

interface AIState {
  lastDecisionTime: number;
  targetDirection?: 0 | 1 | 2 | 3;
  isTrapping: boolean;
  trapTarget?: string; // cycle ID
}

const aiStates = new Map<string, AIState>();

export const updateAI = (
  aiCycle: LightCycle,
  allCycles: LightCycle[],
  difficulty: LightCyclesDifficulty,
  currentTime: number
): 0 | 1 | 2 | 3 | null => {
  if (!aiCycle.alive || aiCycle.isPlayer) return null;

  const config = AI_CONFIGS[difficulty];
  let state = aiStates.get(aiCycle.id);
  
  if (!state) {
    state = {
      lastDecisionTime: 0,
      isTrapping: false
    };
    aiStates.set(aiCycle.id, state);
  }

  // Check if enough time has passed for a decision (reaction time)
  if (currentTime - state.lastDecisionTime < config.reactionTime) {
    return state.targetDirection || null;
  }

  const playerCycle = allCycles.find(c => c.isPlayer && c.alive);
  const possibleDirections = getPossibleDirections(aiCycle, allCycles, config.lookAheadDistance);
  
  if (possibleDirections.length === 0) {
    // No safe directions, pick any direction (will likely crash)
    return aiCycle.direction;
  }

  let chosenDirection = aiCycle.direction;

  // Strategic decision making
  if (playerCycle && Math.random() < config.aggressiveness) {
    // Try to intercept or trap player
    const interceptDirection = getInterceptDirection(aiCycle, playerCycle, possibleDirections);
    if (interceptDirection !== null) {
      chosenDirection = interceptDirection;
      state.isTrapping = true;
      state.trapTarget = playerCycle.id;
    }
  }

  // If not intercepting or no player, use safe direction
  if (!state.isTrapping) {
    // Pick direction that maximizes future options
    chosenDirection = getBestSafeDirection(aiCycle, allCycles, possibleDirections, config);
  }

  // Update AI state
  state.lastDecisionTime = currentTime;
  state.targetDirection = chosenDirection;
  
  return chosenDirection;
};

const getPossibleDirections = (
  cycle: LightCycle,
  allCycles: LightCycle[],
  lookAhead: number
): Array<0 | 1 | 2 | 3> => {
  const directions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
  const safeDirections: Array<0 | 1 | 2 | 3> = [];

  for (const dir of directions) {
    // Can't reverse
    if (dir === (cycle.direction + 2) % 4) continue;

    // Simulate movement in this direction
    if (isDirectionSafe(cycle, dir, allCycles, lookAhead)) {
      safeDirections.push(dir);
    }
  }

  return safeDirections;
};

const isDirectionSafe = (
  cycle: LightCycle,
  direction: 0 | 1 | 2 | 3,
  allCycles: LightCycle[],
  distance: number
): boolean => {
  const DIRECTIONS = [
    { dx: 0, dy: -1 },  // up
    { dx: 1, dy: 0 },   // right
    { dx: 0, dy: 1 },   // down
    { dx: -1, dy: 0 }   // left
  ];

  const dir = DIRECTIONS[direction];
  const testCycle = {
    ...cycle,
    direction,
    x: cycle.x + dir.dx * distance,
    y: cycle.y + dir.dy * distance
  };

  return !checkTrailCollision(testCycle, allCycles);
};

const getInterceptDirection = (
  aiCycle: LightCycle,
  playerCycle: LightCycle,
  possibleDirections: Array<0 | 1 | 2 | 3>
): 0 | 1 | 2 | 3 | null => {
  const DIRECTIONS = [
    { dx: 0, dy: -1 },  // up
    { dx: 1, dy: 0 },   // right
    { dx: 0, dy: 1 },   // down
    { dx: -1, dy: 0 }   // left
  ];

  let bestDirection: 0 | 1 | 2 | 3 | null = null;
  let bestScore = -Infinity;

  for (const dir of possibleDirections) {
    const dirVector = DIRECTIONS[dir];
    
    // Calculate how this direction moves toward the player's path
    const playerDir = DIRECTIONS[playerCycle.direction];
    const futurePlayerX = playerCycle.x + playerDir.dx * 100;
    const futurePlayerY = playerCycle.y + playerDir.dy * 100;
    
    const futureAiX = aiCycle.x + dirVector.dx * 100;
    const futureAiY = aiCycle.y + dirVector.dy * 100;
    
    const distanceToPlayerPath = Math.sqrt(
      Math.pow(futureAiX - futurePlayerX, 2) + 
      Math.pow(futureAiY - futurePlayerY, 2)
    );
    
    const score = -distanceToPlayerPath; // Negative because we want minimum distance
    
    if (score > bestScore) {
      bestScore = score;
      bestDirection = dir;
    }
  }

  return bestDirection;
};

const getBestSafeDirection = (
  cycle: LightCycle,
  allCycles: LightCycle[],
  possibleDirections: Array<0 | 1 | 2 | 3>,
  config: AIConfig
): 0 | 1 | 2 | 3 => {
  if (possibleDirections.length === 1) {
    return possibleDirections[0];
  }

  // Continue straight if possible (TRON AI tends to go straight)
  if (possibleDirections.includes(cycle.direction)) {
    return cycle.direction;
  }

  // Otherwise pick the first safe direction
  return possibleDirections[0];
};

export const cleanupAI = (cycleId: string) => {
  aiStates.delete(cycleId);
};
