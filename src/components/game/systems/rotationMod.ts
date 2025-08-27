export interface RotationModConfig {
  enabled: boolean;
  multiplier: number; // 1.5-3.0 allowed range
  rampInMs: number;
  rampOutMs: number;
  capScale: number; // max angular velocity cap multiplier
  fuelCostPerSec: number; // extra fuel cost per second (0 = no extra cost)
}

export const DEFAULT_ROTATION_MOD_CONFIG: RotationModConfig = {
  enabled: true,
  multiplier: 2.0,
  rampInMs: 150,
  rampOutMs: 150,
  capScale: 2.0,
  fuelCostPerSec: 0
};

export function updateRotationModifier(
  currentMultiplier: number,
  isHeld: boolean,
  deltaTimeMs: number,
  config: RotationModConfig
): number {
  if (!config.enabled) return 1.0;
  
  const targetMultiplier = isHeld ? config.multiplier : 1.0;
  const rampTimeMs = isHeld ? config.rampInMs : config.rampOutMs;
  
  if (Math.abs(currentMultiplier - targetMultiplier) < 0.01) {
    return targetMultiplier;
  }
  
  // Smooth interpolation with time constant
  const alpha = Math.min(1.0, deltaTimeMs / rampTimeMs);
  return currentMultiplier + (targetMultiplier - currentMultiplier) * alpha;
}

export function applyRotationModifier(
  baseAngularAccel: number,
  baseMaxAngularVel: number,
  currentMultiplier: number,
  config: RotationModConfig
): { angularAccel: number; maxAngularVel: number } {
  if (!config.enabled) {
    return { angularAccel: baseAngularAccel, maxAngularVel: baseMaxAngularVel };
  }
  
  const angularAccel = baseAngularAccel * currentMultiplier;
  const maxAngularVel = baseMaxAngularVel * Math.min(currentMultiplier * config.capScale, config.capScale);
  
  return { angularAccel, maxAngularVel };
}