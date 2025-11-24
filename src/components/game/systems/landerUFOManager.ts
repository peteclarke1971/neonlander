import type { LanderUFO, UFOType, UFOTypeConfig } from "../types/landerUFO";

export interface UFOSpawnState {
  smallSpawnTimer: number;
  mediumSpawnTimer: number;
  largeSpawnTimer: number;
  activeSmall: LanderUFO | null;
  activeMedium: LanderUFO | null;
  activeLarge: LanderUFO | null;
}

export function initUFOSpawnState(): UFOSpawnState {
  return {
    smallSpawnTimer: 0,
    mediumSpawnTimer: 0,
    largeSpawnTimer: 0,
    activeSmall: null,
    activeMedium: null,
    activeLarge: null
  };
}

export function getActiveUFOCount(state: UFOSpawnState): number {
  let count = 0;
  if (state.activeSmall?.active) count++;
  if (state.activeMedium?.active) count++;
  if (state.activeLarge?.active) count++;
  return count;
}

export function canSpawnUFO(
  type: UFOType,
  state: UFOSpawnState,
  config: UFOTypeConfig
): boolean {
  // Check if enabled
  if (!config.enabled) return false;
  
  // Check if this type is already active
  switch (type) {
    case "small":
      return !state.activeSmall || !state.activeSmall.active;
    case "medium":
      return !state.activeMedium || !state.activeMedium.active;
    case "large":
      return !state.activeLarge || !state.activeLarge.active;
  }
}

export function updateSpawnTimers(
  state: UFOSpawnState,
  dt: number
): void {
  // Decrement all spawn timers
  state.smallSpawnTimer -= dt;
  state.mediumSpawnTimer -= dt;
  state.largeSpawnTimer -= dt;
}

export function shouldSpawnType(
  type: UFOType,
  state: UFOSpawnState
): boolean {
  switch (type) {
    case "small":
      return state.smallSpawnTimer <= 0;
    case "medium":
      return state.mediumSpawnTimer <= 0;
    case "large":
      return state.largeSpawnTimer <= 0;
  }
}

export function resetSpawnTimer(
  type: UFOType,
  state: UFOSpawnState,
  config: UFOTypeConfig
): void {
  const interval = config.spawnInterval.min + 
                   Math.random() * (config.spawnInterval.max - config.spawnInterval.min);
  
  switch (type) {
    case "small":
      state.smallSpawnTimer = interval;
      break;
    case "medium":
      state.mediumSpawnTimer = interval;
      break;
    case "large":
      state.largeSpawnTimer = interval;
      break;
  }
}
