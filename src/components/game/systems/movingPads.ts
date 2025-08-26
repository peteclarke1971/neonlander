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

// Track which pads have been logged on first render
const loggedRenderIds: Set<number> = new Set();

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

    // Speed band based on difficulty (reduced by another 50%)
    const speedBands = {
      slow: { min: 15, max: 20 },
      medium: { min: 22, max: 30 },
      fast: { min: 32, max: 40 }
    };
    const speedBand = rand() < 0.4 ? "slow" : rand() < 0.8 ? "medium" : "fast";
    const speedRange = speedBands[speedBand];
    const speed = forced ? (32 + rand() * 12) : (speedRange.min + rand() * (speedRange.max - speedRange.min));

    // Dwell time
    const dwell = forced ? 0 : 1.6 + rand() * 1.2; // 0 when forced (start moving immediately)

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
    const baseClearance = shipHeight * 1.5;

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
        // For forced generation, find flat terrain for flush placement
        const samples = 30;
        let bestX = worldWidth * 0.5;
        let bestFlatness = Infinity;
        
        // Find the flattest area in the middle section
        for (let i = 0; i < samples; i++) {
          const centerX = worldWidth * (0.3 + (i / samples) * 0.4); // Sample middle 40%
          const sampleWidth = 50; // Check 50 pixels of terrain flatness
          let maxVariation = 0;
          const baseHeight = getHeightAt(centerX);
          
          for (let j = -sampleWidth; j <= sampleWidth; j += 5) {
            const variation = Math.abs(getHeightAt(centerX + j) - baseHeight);
            maxVariation = Math.max(maxVariation, variation);
          }
          
          if (maxVariation < bestFlatness) {
            bestFlatness = maxVariation;
            bestX = centerX;
          }
        }
        
        const y = getHeightAt(bestX); // Place flush with terrain
        const width = 100 + rand() * 60; // 100-160 pixel width (reduced by 2/3)
        
        pos0 = { x: bestX - width / 2, y };
        pos1 = { x: bestX + width / 2, y };
      } else {
        const centerX = worldWidth * (0.2 + rand() * 0.6);
        const y = getHeightAt(centerX); // Place flush with terrain
        const width = 130 + rand() * 200; // 130-330 pixel width (reduced by 2/3)
        
        pos0 = { x: centerX - width / 2, y };
        pos1 = { x: centerX + width / 2, y };
      }
    }

    // Validate path safety (simplified for now)
    const pathClearance = motion === "shuttle" ? 4 : baseClearance;
    const pathIsValid = this.validatePath(pos0, pos1, pathClearance, getHeightAt, existingPads, worldWidth, worldHeight, motion);
    if (!pathIsValid && !forced) {
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
      phase: "moving",
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
    worldHeight: number,
    motion?: "shuttle" | "elevator" | "arc"
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

  // Check distance from existing pads - ensure moving pad is on isolated flat terrain
    for (const pad of existingPads) {
      const padCenterX = (pad.xStart + pad.xEnd) / 2;
      const padWidth = pad.xEnd - pad.xStart;
      
      // For horizontal moving pads, ensure significant separation on same terrain level
      if (motion === "shuttle") {
        const minX = Math.min(pos0.x, pos1.x) - (24 + 16) / 2; // moving pad half-width
        const maxX = Math.max(pos0.x, pos1.x) + (24 + 16) / 2; // moving pad half-width
        const padMinX = pad.xStart;
        const padMaxX = pad.xEnd;
        
        // Check horizontal overlap with buffer
        const horizontalBuffer = Math.max(100, padWidth * 2); // At least 100px or 2x pad width
        if (!(maxX + horizontalBuffer < padMinX || minX - horizontalBuffer > padMaxX)) {
          // Check if on similar terrain level (within 20px height difference)
          const heightDiff = Math.abs(pos0.y - pad.y);
          if (heightDiff < 20) {
            return false; // Too close on same terrain level
          }
        }
      } else {
        // For vertical/arc moving pads, use original distance check
        const dist0 = Math.sqrt((pos0.x - padCenterX) ** 2 + (pos0.y - pad.y) ** 2);
        const dist1 = Math.sqrt((pos1.x - padCenterX) ** 2 + (pos1.y - pad.y) ** 2);
        
        if (dist0 < clearance * 2 || dist1 < clearance * 2) return false;
      }
    }

    return true;
  }

  // Render moving pad and its path (draw in WORLD COORDINATES; camera transform already applied)
  renderMovingPad(
    ctx: CanvasRenderingContext2D,
    pad: MovingPad,
    _cameraX: number,
    _cameraY: number,
    _zoom: number,
    _canvasWidth: number,
    _canvasHeight: number,
    neonColor: string
  ): void {
    // Safety: log first render per pad to verify visibility
    try {
      (loggedRenderIds as Set<number>);
    } catch {}
    if (!loggedRenderIds.has(pad.seed)) {
      console.log("[MovingPad] Render", { pos: pad.currentPos, pos0: pad.pos0, pos1: pad.pos1, width: pad.width, speed: pad.speed, phase: pad.phase });
      loggedRenderIds.add(pad.seed);
    }

    const x = pad.currentPos.x;
    const y = pad.currentPos.y;
    const padWidth = pad.width || 32;

    // Render path (faint rail line)
    ctx.save();
    ctx.strokeStyle = neonColor as any;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);

    if (pad.motion === "arc" && pad.arcCenter && pad.arcRadius && pad.arcAngle0 !== undefined && pad.arcAngle1 !== undefined) {
      // Draw arc path
      ctx.beginPath();
      ctx.arc(pad.arcCenter.x, pad.arcCenter.y, pad.arcRadius, pad.arcAngle0, pad.arcAngle1);
      ctx.stroke();
    } else {
      // Draw linear path
      ctx.beginPath();
      ctx.moveTo(pad.pos0.x, pad.pos0.y);
      ctx.lineTo(pad.pos1.x, pad.pos1.y);
      ctx.stroke();
    }
    ctx.restore();

    // Render the pad itself with strong glow to be obvious
    ctx.save();
    ctx.fillStyle = neonColor as any;
    ctx.shadowColor = neonColor as any;
    ctx.shadowBlur = 24;
    ctx.globalAlpha = 0.95;

    // Pad base
    ctx.fillRect(x - padWidth / 2, y - 2, padWidth, 4);

    // MEGA indicator label
    ctx.font = `700 12px "Orbitron", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.globalAlpha = 0.95;
    ctx.fillText("MEGA", x, y - 8);

    // Movement indicator arrow (horizontal or vertical)
    if (pad.phase === "moving") {
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const vx = pad.currentVelocity.x;
      const vy = pad.currentVelocity.y;
      const arrow = 6;
      if (Math.abs(vx) >= Math.abs(vy)) {
        const dir = Math.sign(vx) || 1;
        ctx.moveTo(x - arrow * dir, y + 10);
        ctx.lineTo(x + arrow * dir, y + 10);
        ctx.lineTo(x + (arrow * 0.5) * dir, y + 10 - arrow * 0.5);
        ctx.moveTo(x + arrow * dir, y + 10);
        ctx.lineTo(x + (arrow * 0.5) * dir, y + 10 + arrow * 0.5);
      } else {
        const dir = Math.sign(vy) || 1;
        ctx.moveTo(x, y + 10 - arrow * dir);
        ctx.lineTo(x, y + 10 + arrow * dir);
        ctx.lineTo(x - arrow * 0.5, y + 10 + (arrow * 0.5) * dir);
        ctx.moveTo(x, y + 10 + arrow * dir);
        ctx.lineTo(x + arrow * 0.5, y + 10 + (arrow * 0.5) * dir);
      }
      ctx.strokeStyle = neonColor as any;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    // Optional debug info
    if (this.settings.debug) {
      ctx.save();
      ctx.fillStyle = "white";
      ctx.font = `10px monospace`;
      ctx.textAlign = "left";
      const debugY = y + 22;
      ctx.fillText(`Phase: ${pad.phase}`, x - padWidth / 2, debugY);
      ctx.fillText(`Speed: ${pad.speed.toFixed(0)} px/s`, x - padWidth / 2, debugY + 12);
      ctx.restore();
    }
  }

  // Check if a position is on the moving pad (for landing detection)
  isOnMovingPad(x: number, y: number, pad: MovingPad): boolean {
    const padHalfWidth = (pad.width || 32) / 2;
    const padThickness = 8; // Increased for better collision detection
    
    // Check horizontal bounds
    const onPadHorizontally = x >= pad.currentPos.x - padHalfWidth && 
                              x <= pad.currentPos.x + padHalfWidth;
    
    // Check vertical bounds - more generous for landing detection
    const onPadVertically = y >= pad.currentPos.y - padThickness && 
                            y <= pad.currentPos.y + padThickness;
    
    return onPadHorizontally && onPadVertically;
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