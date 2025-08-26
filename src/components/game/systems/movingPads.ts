import { Pad } from "../types";

export interface MovingPad extends Pad {
  motion: "shuttle" | "elevator" | "arc";
  pos0: { x: number; y: number };
  pos1: { x: number; y: number };
  speed: number; // px/s
  dwell: number; // seconds at each end
  currentPos: { x: number; y: number };
  currentVelocity: { x: number; y: number };
  phase: "moving" | "dwelling";
  phaseTimer: number;
  direction: 1 | -1; // movement direction
  scoreMult: number; // MEGA multiplier (2.0x or 3.0x)
  enabledInCaverns: boolean;
  zIndex: number;
  seed: number; // for deterministic behavior
  // Arc-specific properties (optional)
  arcCenter?: { x: number; y: number };
  arcRadius?: number;
  arcAngle0?: number;
  arcAngle1?: number;
}

export interface MovingPadSettings {
  enabled: "off" | "default" | "more";
  enabledInCaverns: boolean;
  debug: boolean;
}

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MovingPadSystem {
  private settings: MovingPadSettings = {
    enabled: "default",
    enabledInCaverns: false,
    debug: false
  };

  updateSettings(newSettings: Partial<MovingPadSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): MovingPadSettings {
    return { ...this.settings };
  }

  // Generate a moving pad for the given level and terrain
  generateMovingPad(
    seed: number,
    level: number,
    difficulty: "easy" | "hard",
    worldWidth: number,
    worldHeight: number,
    getHeightAt: (x: number) => number,
    existingPads: Pad[],
    isCavern: boolean = false,
    forced: boolean = false
  ): MovingPad | null {
    if (this.settings.enabled === "off" && !forced) return null;
    if (difficulty === "easy" && !forced) return null; // Only on hard difficulty unless forced
    if (isCavern && !this.settings.enabledInCaverns && !forced) return null;

    const rand = mulberry32(seed ^ 0x4D4F5649); // "MOVI" in hex

    // Spawn chance based on difficulty and settings
    let spawnChance = 0.1 + (level * 0.015); // 10% base, +1.5% per level
    if (this.settings.enabled === "more") spawnChance *= 2;
    spawnChance = Math.min(spawnChance, 0.25); // Cap at 25%

    if (!forced && rand() > spawnChance) return null;

    // Choose motion type (prefer shuttle for forced generation)
    const motionTypes: MovingPad["motion"][] = isCavern 
      ? ["elevator", "shuttle"] 
      : forced ? ["shuttle"] : ["shuttle", "arc"];
    const motion = motionTypes[Math.floor(rand() * motionTypes.length)];

    // Speed band based on difficulty
    const speedBands = {
      slow: { min: 60, max: 80 },
      medium: { min: 90, max: 120 },
      fast: { min: 130, max: 160 }
    };
    const speedBand = rand() < 0.4 ? "slow" : rand() < 0.8 ? "medium" : "fast";
    const speedRange = speedBands[speedBand];
    const speed = speedRange.min + rand() * (speedRange.max - speedRange.min);

    // Dwell time
    const dwell = 1.6 + rand() * 1.2; // 1.6-2.8 seconds

    // Score multiplier
    const scoreMult = speedBand === "fast" ? 3.0 : 2.0;

    // Generate path based on motion type
    let pos0: { x: number; y: number };
    let pos1: { x: number; y: number };
    let arcCenter: { x: number; y: number } | undefined;
    let arcRadius: number | undefined;
    let arcAngle0: number | undefined;
    let arcAngle1: number | undefined;

    const shipHeight = 16;
    const clearance = shipHeight * 1.5;

    if (motion === "elevator") {
      // Vertical movement in caverns
      const x = worldWidth * (0.2 + rand() * 0.6); // Middle 60% of world
      const baseY = getHeightAt(x);
      const minY = Math.max(50, baseY - 200);
      const maxY = Math.min(worldHeight - 50, baseY + 100);
      
      pos0 = { x, y: minY };
      pos1 = { x, y: maxY };
    } else if (motion === "arc") {
      // Circular arc movement
      const centerX = worldWidth * (0.3 + rand() * 0.4); // Middle 40% of world
      const centerY = getHeightAt(centerX) - 100;
      const radius = 80 + rand() * 120; // 80-200 pixel radius
      
      const angle0 = -Math.PI / 3 + rand() * (Math.PI / 6); // -60° to -30°
      const angle1 = Math.PI / 3 - rand() * (Math.PI / 6);   // 30° to 60°
      
      pos0 = {
        x: centerX + Math.cos(angle0) * radius,
        y: centerY + Math.sin(angle0) * radius
      };
      pos1 = {
        x: centerX + Math.cos(angle1) * radius,
        y: centerY + Math.sin(angle1) * radius
      };
      
      arcCenter = { x: centerX, y: centerY };
      arcRadius = radius;
      arcAngle0 = angle0;
      arcAngle1 = angle1;
    } else {
      // Shuttle movement (horizontal)
      if (forced) {
        // For forced generation, use terrain minimum for safe placement
        const samples = 20;
        let minHeight = Infinity;
        for (let i = 0; i < samples; i++) {
          const x = worldWidth * (0.3 + (i / samples) * 0.4); // Sample middle 40%
          minHeight = Math.min(minHeight, getHeightAt(x));
        }
        const y = minHeight - (80 + rand() * 40); // 80-120 pixels above lowest terrain
        const width = 160 + rand() * 80; // 160-240 pixel width for forced pads
        const centerX = worldWidth * (0.4 + rand() * 0.2); // Middle 20% for safety
        
        pos0 = { x: centerX - width / 2, y };
        pos1 = { x: centerX + width / 2, y };
      } else {
        const y = getHeightAt(worldWidth / 2) - (100 + rand() * 100);
        const width = 200 + rand() * 300; // 200-500 pixel width
        const centerX = worldWidth * (0.2 + rand() * 0.6);
        
        pos0 = { x: centerX - width / 2, y };
        pos1 = { x: centerX + width / 2, y };
      }
    }

    // Validate path safety (simplified for now)
    if (!this.validatePath(pos0, pos1, clearance, getHeightAt, existingPads, worldWidth, worldHeight)) {
      return null;
    }

    // Create pad dimensions
    const width = 24 + rand() * 16; // 24-40 pixels
    const padSeed = Math.floor(rand() * 1000000);

    const movingPad: MovingPad = {
      xStart: pos0.x - width / 2,
      xEnd: pos0.x + width / 2,
      y: pos0.y,
      multiplier: 1, // Base multiplier, MEGA comes from scoreMult
      width,
      motion,
      pos0,
      pos1,
      speed,
      dwell,
      currentPos: { ...pos0 },
      currentVelocity: { x: 0, y: 0 },
      phase: "dwelling",
      phaseTimer: 0,
      direction: 1,
      scoreMult,
      enabledInCaverns: isCavern,
      zIndex: 10,
      seed: padSeed,
      arcCenter,
      arcRadius,
      arcAngle0,
      arcAngle1
    };

    return movingPad;
  }

  // Update moving pad physics
  updateMovingPad(pad: MovingPad, deltaTime: number): void {
    pad.phaseTimer += deltaTime;

    if (pad.phase === "dwelling") {
      // Stopped at one end
      pad.currentVelocity = { x: 0, y: 0 };
      
      if (pad.phaseTimer >= pad.dwell) {
        // Start moving
        pad.phase = "moving";
        pad.phaseTimer = 0;
      }
    } else {
      // Moving between positions
      const progress = this.calculateProgress(pad);
      
      if (progress >= 1) {
        // Reached destination, switch direction and start dwelling
        pad.direction *= -1;
        pad.phase = "dwelling";
        pad.phaseTimer = 0;
        
        // Snap to exact position
        if (pad.direction === 1) {
          pad.currentPos = { ...pad.pos0 };
        } else {
          pad.currentPos = { ...pad.pos1 };
        }
        pad.currentVelocity = { x: 0, y: 0 };
      } else {
        // Continue moving with easing
        const easedProgress = this.easeInOutCubic(progress);
        this.updatePosition(pad, easedProgress);
        this.updateVelocity(pad, deltaTime);
      }
    }

    // Update pad bounds based on current position
    pad.xStart = pad.currentPos.x - (pad.width || 32) / 2;
    pad.xEnd = pad.currentPos.x + (pad.width || 32) / 2;
    pad.y = pad.currentPos.y;
  }

  private calculateProgress(pad: MovingPad): number {
    const distance = this.calculateDistance(pad.pos0, pad.pos1);
    const timeToTravel = distance / pad.speed;
    return Math.min(1, pad.phaseTimer / timeToTravel);
  }

  private calculateDistance(pos0: { x: number; y: number }, pos1: { x: number; y: number }): number {
    return Math.sqrt((pos1.x - pos0.x) ** 2 + (pos1.y - pos0.y) ** 2);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private updatePosition(pad: MovingPad, easedProgress: number): void {
    const from = pad.direction === 1 ? pad.pos0 : pad.pos1;
    const to = pad.direction === 1 ? pad.pos1 : pad.pos0;

    if (pad.motion === "arc" && pad.arcCenter && pad.arcAngle0 !== undefined && pad.arcAngle1 !== undefined) {
      // Arc motion
      const fromAngle = pad.direction === 1 ? pad.arcAngle0 : pad.arcAngle1;
      const toAngle = pad.direction === 1 ? pad.arcAngle1 : pad.arcAngle0;
      const angle = fromAngle + (toAngle - fromAngle) * easedProgress;
      
      pad.currentPos = {
        x: pad.arcCenter.x + Math.cos(angle) * (pad.arcRadius || 100),
        y: pad.arcCenter.y + Math.sin(angle) * (pad.arcRadius || 100)
      };
    } else {
      // Linear motion (shuttle or elevator)
      pad.currentPos = {
        x: from.x + (to.x - from.x) * easedProgress,
        y: from.y + (to.y - from.y) * easedProgress
      };
    }
  }

  private updateVelocity(pad: MovingPad, deltaTime: number): void {
    // Calculate velocity based on recent position change
    // This is approximate but sufficient for landing calculations
    const distance = this.calculateDistance(pad.pos0, pad.pos1);
    const timeToTravel = distance / pad.speed;
    
    if (timeToTravel > 0) {
      const totalVelocity = distance / timeToTravel;
      const direction = {
        x: (pad.pos1.x - pad.pos0.x) / distance,
        y: (pad.pos1.y - pad.pos0.y) / distance
      };
      
      pad.currentVelocity = {
        x: direction.x * totalVelocity * pad.direction,
        y: direction.y * totalVelocity * pad.direction
      };
    }
  }

  private validatePath(
    pos0: { x: number; y: number },
    pos1: { x: number; y: number },
    clearance: number,
    getHeightAt: (x: number) => number,
    existingPads: Pad[],
    worldWidth: number,
    worldHeight: number
  ): boolean {
    // Check bounds
    const minX = Math.min(pos0.x, pos1.x);
    const maxX = Math.max(pos0.x, pos1.x);
    const minY = Math.min(pos0.y, pos1.y);
    const maxY = Math.max(pos0.y, pos1.y);
    
    if (minX < clearance || maxX > worldWidth - clearance) return false;
    if (minY < clearance || maxY > worldHeight - clearance) return false;

    // Check terrain clearance at several points along path
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = pos0.x + (pos1.x - pos0.x) * t;
      const y = pos0.y + (pos1.y - pos0.y) * t;
      const terrainY = getHeightAt(x);
      
      if (y + clearance > terrainY) return false; // Too close to ground
    }

    // Check distance from existing pads
    for (const pad of existingPads) {
      const padCenterX = (pad.xStart + pad.xEnd) / 2;
      const dist0 = Math.sqrt((pos0.x - padCenterX) ** 2 + (pos0.y - pad.y) ** 2);
      const dist1 = Math.sqrt((pos1.x - padCenterX) ** 2 + (pos1.y - pad.y) ** 2);
      
      if (dist0 < clearance * 2 || dist1 < clearance * 2) return false;
    }

    return true;
  }

  // Render moving pad and its path
  renderMovingPad(
    ctx: CanvasRenderingContext2D,
    pad: MovingPad,
    cameraX: number,
    cameraY: number,
    zoom: number,
    canvasWidth: number,
    canvasHeight: number,
    neonColor: string
  ): void {
    const screenX = (pad.currentPos.x - cameraX) * zoom + canvasWidth / 2;
    const screenY = (pad.currentPos.y - cameraY) * zoom + canvasHeight / 2;
    const padWidth = (pad.width || 32) * zoom;

    // Render path (faint rail line)
    if (this.settings.debug || true) { // Always show path for now
      ctx.save();
      ctx.strokeStyle = neonColor;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      const path0X = (pad.pos0.x - cameraX) * zoom + canvasWidth / 2;
      const path0Y = (pad.pos0.y - cameraY) * zoom + canvasHeight / 2;
      const path1X = (pad.pos1.x - cameraX) * zoom + canvasWidth / 2;
      const path1Y = (pad.pos1.y - cameraY) * zoom + canvasHeight / 2;

      if (pad.motion === "arc" && pad.arcCenter && pad.arcRadius && pad.arcAngle0 !== undefined && pad.arcAngle1 !== undefined) {
        // Draw arc path
        const centerX = (pad.arcCenter.x - cameraX) * zoom + canvasWidth / 2;
        const centerY = (pad.arcCenter.y - cameraY) * zoom + canvasHeight / 2;
        const radius = pad.arcRadius * zoom;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, pad.arcAngle0, pad.arcAngle1);
        ctx.stroke();
      } else {
        // Draw linear path
        ctx.beginPath();
        ctx.moveTo(path0X, path0Y);
        ctx.lineTo(path1X, path1Y);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render the pad itself (same style as regular pads but with MEGA indicator)
    ctx.save();
    ctx.fillStyle = neonColor;
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = 8;
    
    // Pad base
    ctx.fillRect(screenX - padWidth / 2, screenY - 2, padWidth, 4);
    
    // MEGA indicator
    ctx.font = `${8 * zoom}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MEGA", screenX, screenY - 8 * zoom);
    
    // Movement indicator arrow
    if (pad.phase === "moving") {
      const arrowSize = 4 * zoom;
      const arrowY = screenY + 10 * zoom;
      const direction = pad.currentVelocity.x > 0 ? 1 : pad.currentVelocity.x < 0 ? -1 : 0;
      
      if (direction !== 0) {
        ctx.beginPath();
        ctx.moveTo(screenX - arrowSize * direction, arrowY);
        ctx.lineTo(screenX + arrowSize * direction, arrowY);
        ctx.lineTo(screenX + arrowSize * direction * 0.5, arrowY - arrowSize * 0.5);
        ctx.moveTo(screenX + arrowSize * direction, arrowY);
        ctx.lineTo(screenX + arrowSize * direction * 0.5, arrowY + arrowSize * 0.5);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Debug info
    if (this.settings.debug) {
      ctx.save();
      ctx.fillStyle = "white";
      ctx.font = `${10 * zoom}px monospace`;
      ctx.textAlign = "left";
      const debugY = screenY + 25 * zoom;
      ctx.fillText(`Phase: ${pad.phase}`, screenX - padWidth / 2, debugY);
      ctx.fillText(`Timer: ${pad.phaseTimer.toFixed(1)}s`, screenX - padWidth / 2, debugY + 12 * zoom);
      ctx.fillText(`Vel: ${Math.sqrt(pad.currentVelocity.x ** 2 + pad.currentVelocity.y ** 2).toFixed(0)}px/s`, screenX - padWidth / 2, debugY + 24 * zoom);
      ctx.restore();
    }
  }

  // Check if a position is on the moving pad (for landing detection)
  isOnMovingPad(x: number, y: number, pad: MovingPad): boolean {
    const padHalfWidth = (pad.width || 32) / 2;
    const padThickness = 4;
    
    return (
      x >= pad.currentPos.x - padHalfWidth &&
      x <= pad.currentPos.x + padHalfWidth &&
      y >= pad.currentPos.y - padThickness &&
      y <= pad.currentPos.y + padThickness
    );
  }

  // Calculate relative velocity for landing checks
  getRelativeVelocity(shipVx: number, shipVy: number, pad: MovingPad): { x: number; y: number } {
    return {
      x: shipVx - pad.currentVelocity.x,
      y: shipVy - pad.currentVelocity.y
    };
  }
}

export const movingPadSystem = new MovingPadSystem();