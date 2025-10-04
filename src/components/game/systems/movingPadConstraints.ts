import { MovingPad } from "./movingPads";
import { Pad } from "../types";

export interface PathConstraints {
  minClearance: number;
  minCorridorWidth: number;
  safetyMargin: number;
  maxSlope: number;
}

export class MovingPadConstraints {
  private static readonly SHIP_HEIGHT = 16;
  private static readonly DEFAULT_CONSTRAINTS: PathConstraints = {
    minClearance: MovingPadConstraints.SHIP_HEIGHT * 1.5,
    minCorridorWidth: MovingPadConstraints.SHIP_HEIGHT * 3,
    safetyMargin: MovingPadConstraints.SHIP_HEIGHT * 2,
    maxSlope: 0.3 // Maximum terrain slope ratio
  };

  static validateSurfacePath(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    getHeightAt: (x: number) => number,
    existingPads: Pad[],
    worldWidth: number,
    constraints: Partial<PathConstraints> = {},
    movingPadWidth: number = 40
  ): boolean {
    const config = { ...this.DEFAULT_CONSTRAINTS, ...constraints };
    
    // Check world bounds
    if (!this.checkWorldBounds(pos0, pos1, worldWidth, config.safetyMargin)) {
      return false;
    }

    // Check terrain clearance along entire path
    if (!this.checkTerrainClearance(pos0, pos1, getHeightAt, config.minClearance)) {
      return false;
    }

    // Check for flat regions (avoid cliff crossing)
    if (!this.checkFlatTerrain(pos0, pos1, getHeightAt, config.maxSlope)) {
      return false;
    }

    // Check distance from existing pads
    if (!this.checkPadSeparation(pos0, pos1, existingPads, movingPadWidth, config.safetyMargin)) {
      return false;
    }

    return true;
  }

  static validateCavernPath(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    checkCollision: (x: number, y: number, radius: number) => boolean,
    existingPads: Pad[],
    worldWidth: number,
    worldHeight: number,
    constraints: Partial<PathConstraints> = {},
    movingPadWidth: number = 40
  ): boolean {
    const config = { ...this.DEFAULT_CONSTRAINTS, ...constraints };
    
    // Check world bounds
    if (!this.checkWorldBounds(pos0, pos1, worldWidth, config.safetyMargin, worldHeight)) {
      return false;
    }

    // Check corridor width along path
    if (!this.checkCorridorWidth(pos0, pos1, checkCollision, config.minCorridorWidth)) {
      return false;
    }

    // Check distance from existing pads
    if (!this.checkPadSeparation(pos0, pos1, existingPads, movingPadWidth, config.safetyMargin)) {
      return false;
    }

    return true;
  }

  static checkAcceptanceWindow(
    pad: MovingPad,
    approachCorridor: { start: { x: number; y: number }; end: { x: number; y: number } },
    landingThresholds: { maxVx: number; maxVy: number },
    minWindowDuration: number = 1.2
  ): boolean {
    // Sample the pad's position over time to find safe landing windows
    const sampleDuration = (pad.dwell * 2) + (this.calculateTravelTime(pad.pos0, pad.pos1, pad.speed) * 2);
    const sampleRate = 10; // samples per second
    const samples = Math.floor(sampleDuration * sampleRate);
    
    let consecutiveSafeTime = 0;
    let maxSafeWindow = 0;

    for (let i = 0; i < samples; i++) {
      const time = (i / sampleRate);
      const padState = this.simulatePadPosition(pad, time);
      
      // Check if pad is in a good state for landing
      const isSlowEnough = Math.sqrt(padState.velocity.x ** 2 + padState.velocity.y ** 2) <= 50;
      const isInCorridor = this.isPositionInCorridor(padState.position, approachCorridor);
      
      if (isSlowEnough && isInCorridor) {
        consecutiveSafeTime += 1 / sampleRate;
        maxSafeWindow = Math.max(maxSafeWindow, consecutiveSafeTime);
      } else {
        consecutiveSafeTime = 0;
      }
    }

    return maxSafeWindow >= minWindowDuration;
  }

  private static checkWorldBounds(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    worldWidth: number,
    margin: number,
    worldHeight?: number
  ): boolean {
    const minX = Math.min(pos0.x, pos1.x);
    const maxX = Math.max(pos0.x, pos1.x);
    const minY = Math.min(pos0.y, pos1.y);
    const maxY = Math.max(pos0.y, pos1.y);

    if (minX < margin || maxX > worldWidth - margin) return false;
    if (worldHeight && (minY < margin || maxY > worldHeight - margin)) return false;

    return true;
  }

  private static checkTerrainClearance(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    getHeightAt: (x: number) => number,
    clearance: number
  ): boolean {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = pos0.x + (pos1.x - pos0.x) * t;
      const y = pos0.y + (pos1.y - pos0.y) * t;
      const terrainY = getHeightAt(x);
      
      if (y + clearance > terrainY) return false;
    }
    return true;
  }

  private static checkFlatTerrain(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    getHeightAt: (x: number) => number,
    maxSlope: number
  ): boolean {
    const steps = 10;
    const stepSize = Math.abs(pos1.x - pos0.x) / steps;
    
    for (let i = 0; i < steps; i++) {
      const x1 = pos0.x + (pos1.x - pos0.x) * (i / steps);
      const x2 = x1 + stepSize;
      const y1 = getHeightAt(x1);
      const y2 = getHeightAt(x2);
      const slope = Math.abs(y2 - y1) / stepSize;
      
      if (slope > maxSlope) return false;
    }
    return true;
  }

  private static checkCorridorWidth(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    checkCollision: (x: number, y: number, radius: number) => boolean,
    minWidth: number
  ): boolean {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = pos0.x + (pos1.x - pos0.x) * t;
      const y = pos0.y + (pos1.y - pos0.y) * t;
      
      // Check perpendicular clearance
      const dx = pos1.x - pos0.x;
      const dy = pos1.y - pos0.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length === 0) continue;
      
      const perpX = -dy / length;
      const perpY = dx / length;
      
      // Check clearance in both directions
      const halfWidth = minWidth / 2;
      if (checkCollision(x + perpX * halfWidth, y + perpY * halfWidth, this.SHIP_HEIGHT / 2) ||
          checkCollision(x - perpX * halfWidth, y - perpY * halfWidth, this.SHIP_HEIGHT / 2)) {
        return false;
      }
    }
    return true;
  }

  private static checkPadSeparation(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    existingPads: Pad[],
    movingPadWidth: number,
    margin: number
  ): boolean {
    for (const pad of existingPads) {
      const padCenterX = (pad.xStart + pad.xEnd) / 2;
      const padWidth = pad.width || 50;
      
      // Calculate minimum distance based on pad widths
      const minDistance = Math.max(movingPadWidth, padWidth) + 150;
      
      const dist0 = Math.sqrt((pos0.x - padCenterX) ** 2 + (pos0.y - pad.y) ** 2);
      const dist1 = Math.sqrt((pos1.x - padCenterX) ** 2 + (pos1.y - pad.y) ** 2);
      
      if (dist0 < minDistance || dist1 < minDistance) return false;
    }
    return true;
  }

  private static calculateTravelTime(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    speed: number
  ): number {
    const distance = Math.sqrt((pos1.x - pos0.x) ** 2 + (pos1.y - pos0.y) ** 2);
    return distance / speed;
  }

  private static simulatePadPosition(pad: MovingPad, time: number): {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    phase: "moving" | "dwelling";
  } {
    const cycleTime = pad.dwell * 2 + this.calculateTravelTime(pad.pos0, pad.pos1, pad.speed);
    const normalizedTime = time % cycleTime;
    
    if (normalizedTime < pad.dwell) {
      // Dwelling at pos0
      return {
        position: { ...pad.pos0 },
        velocity: { x: 0, y: 0 },
        phase: "dwelling"
      };
    } else if (normalizedTime < pad.dwell + this.calculateTravelTime(pad.pos0, pad.pos1, pad.speed)) {
      // Moving from pos0 to pos1
      const travelTime = normalizedTime - pad.dwell;
      const totalTravelTime = this.calculateTravelTime(pad.pos0, pad.pos1, pad.speed);
      const progress = travelTime / totalTravelTime;
      
      return {
        position: {
          x: pad.pos0.x + (pad.pos1.x - pad.pos0.x) * progress,
          y: pad.pos0.y + (pad.pos1.y - pad.pos0.y) * progress
        },
        velocity: {
          x: (pad.pos1.x - pad.pos0.x) / totalTravelTime,
          y: (pad.pos1.y - pad.pos0.y) / totalTravelTime
        },
        phase: "moving"
      };
    } else if (normalizedTime < pad.dwell * 2 + this.calculateTravelTime(pad.pos0, pad.pos1, pad.speed)) {
      // Dwelling at pos1
      return {
        position: { ...pad.pos1 },
        velocity: { x: 0, y: 0 },
        phase: "dwelling"
      };
    } else {
      // Moving from pos1 to pos0
      const travelTime = normalizedTime - (pad.dwell * 2 + this.calculateTravelTime(pad.pos0, pad.pos1, pad.speed));
      const totalTravelTime = this.calculateTravelTime(pad.pos1, pad.pos0, pad.speed);
      const progress = travelTime / totalTravelTime;
      
      return {
        position: {
          x: pad.pos1.x + (pad.pos0.x - pad.pos1.x) * progress,
          y: pad.pos1.y + (pad.pos0.y - pad.pos1.y) * progress
        },
        velocity: {
          x: (pad.pos0.x - pad.pos1.x) / totalTravelTime,
          y: (pad.pos0.y - pad.pos1.y) / totalTravelTime
        },
        phase: "moving"
      };
    }
  }

  private static isPositionInCorridor(
    position: { x: number; y: number },
    corridor: { start: { x: number; y: number }; end: { x: number; y: number } }
  ): boolean {
    // Simple rectangular corridor check
    const minX = Math.min(corridor.start.x, corridor.end.x) - 50;
    const maxX = Math.max(corridor.start.x, corridor.end.x) + 50;
    const minY = Math.min(corridor.start.y, corridor.end.y) - 50;
    const maxY = Math.max(corridor.start.y, corridor.end.y) + 50;
    
    return position.x >= minX && position.x <= maxX && position.y >= minY && position.y <= maxY;
  }
}