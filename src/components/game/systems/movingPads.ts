import { Pad } from "../types";

export interface MovingPad extends Pad {
  motion: "shuttle" | "elevator" | "arc";
  pos0: { x: number; y: number };
  pos1: { x: number; y: number };
  speed: number; // px/s
  baseSpeed?: number; // baseline 1x speed for fairness checks
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
    // allow on easy difficulty; no early return
    if (isCavern && !this.settings.enabledInCaverns && !forced) return null;

    const rand = mulberry32(seed ^ 0x4D4F5649); // "MOVI" in hex

    // Spawn chance based on difficulty and settings
    let spawnChance = 0.1 + (level * 0.015); // 10% base, +1.5% per level
    if (this.settings.enabled === "more") spawnChance *= 2;
    spawnChance = Math.min(spawnChance, 0.25); // Cap at 25%

    if (!forced && rand() > spawnChance) return null;

    // Choose motion type - only shuttle for survival mode, elevator/shuttle for caverns
    const motionTypes: MovingPad["motion"][] = isCavern 
      ? ["elevator", "shuttle"] 
      : ["shuttle"]; // Only horizontal shuttle pads for survival mode
    const motion = motionTypes[Math.floor(rand() * motionTypes.length)];

    // Speed band based on difficulty (reduced to 25% of original)
    // Speed increases with level up to 5x starting speed
    const levelSpeedMultiplier = Math.min(5, 1 + (level - 1) * 0.5); // 1x to 5x based on level
    const speedBands = {
      slow: { min: 4 * levelSpeedMultiplier, max: 5 * levelSpeedMultiplier },
      medium: { min: 6 * levelSpeedMultiplier, max: 8 * levelSpeedMultiplier },
      fast: { min: 8 * levelSpeedMultiplier, max: 10 * levelSpeedMultiplier }
    };
    const speedBand = rand() < 0.4 ? "slow" : rand() < 0.8 ? "medium" : "fast";
    const speedRange = speedBands[speedBand];
    const speed = speedRange.min + rand() * (speedRange.max - speedRange.min);

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
      // Vertical movement - ensure bottom position is flush with terrain
      const x = worldWidth * (0.2 + rand() * 0.6); // Middle 60% of world
      const baseY = getHeightAt(x);
      
      // Bottom position should be flush with terrain
      const bottomY = baseY;
      const topY = Math.max(50, baseY - 150 - rand() * 100); // 150-250 pixels above terrain
      
      pos0 = { x, y: topY };    // Top position
      pos1 = { x, y: bottomY }; // Bottom position flush with terrain
    } else if (motion === "arc") {
      // Circular arc movement - ensure bottom of arc is flush with flat terrain
      // Pick a center in middle 40% of world and choose radius/angles
      let centerX = worldWidth * (0.3 + rand() * 0.4);
      const radius = 80 + rand() * 120; // 80-200 pixel radius
      const angle0 = -Math.PI / 3 + rand() * (Math.PI / 6); // -60° to -30°
      const angle1 = Math.PI / 3 - rand() * (Math.PI / 6);   // 30° to 60°

      // Helper to measure flatness around bottom point
      const flatnessAt = (cx: number) => {
        const baseY = getHeightAt(cx);
        let maxVar = 0;
        for (let dx = -30; dx <= 30; dx += 5) {
          const v = Math.abs(getHeightAt(cx + dx) - baseY);
          if (v > maxVar) maxVar = v;
        }
        return maxVar;
      };

      // Ensure the bottom section is reasonably flat; if forced, search a better spot
      let maxVar = flatnessAt(centerX);
      if (maxVar > 5) {
        if (forced) {
          let bestX = centerX;
          let bestVar = maxVar;
          const samples = 24;
          for (let i = 0; i < samples; i++) {
            const cx = worldWidth * (0.3 + (i + rand()) / samples * 0.4);
            const v = flatnessAt(cx);
            if (v < bestVar) { bestVar = v; bestX = cx; }
          }
          centerX = bestX;
        } else {
          return null;
        }
      }

      // Place center so lowest point is flush with terrain
      const lowestY = getHeightAt(centerX) + radius; // Bottom point should touch terrain
      const centerY = lowestY - radius;

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
      // For forced generation, find flat terrain for flush placement with STRICTER requirements
        const samples = 40; // More samples for better placement
        let bestX = worldWidth * 0.5;
        let bestFlatness = Infinity;
        
        // Find the flattest area in the middle section
        for (let i = 0; i < samples; i++) {
          const centerX = worldWidth * (0.3 + (i / samples) * 0.4); // Sample middle 40%
          const sampleWidth = 80; // Check larger area for terrain flatness
          let maxVariation = 0;
          const baseHeight = getHeightAt(centerX);
          
          for (let j = -sampleWidth; j <= sampleWidth; j += 3) {
            const variation = Math.abs(getHeightAt(centerX + j) - baseHeight);
            maxVariation = Math.max(maxVariation, variation);
          }
          
          if (maxVariation < bestFlatness) {
            bestFlatness = maxVariation;
            bestX = centerX;
          }
        }
        
        // Use the maximum terrain height across the pad width for perfect flush placement
        const width = 105 + rand() * 60; // 105-165 pixel width (50% bigger)
        let maxTerrainY = getHeightAt(bestX);
        for (let checkX = bestX - width/2; checkX <= bestX + width/2; checkX += 5) {
          maxTerrainY = Math.max(maxTerrainY, getHeightAt(checkX));
        }
        
        pos0 = { x: bestX - width / 2, y: maxTerrainY };
        pos1 = { x: bestX + width / 2, y: maxTerrainY };
        
        console.log(`[MovingPad] Forced shuttle pad at y=${maxTerrainY.toFixed(1)}, flatness=${bestFlatness.toFixed(1)}`);
      } else {
        const centerX = worldWidth * (0.2 + rand() * 0.6);
        const width = 150 + rand() * 120; // 150-270 pixel width (50% bigger)
        
        // Use the maximum terrain height across the pad width for perfect flush placement
        let maxTerrainY = getHeightAt(centerX);
        for (let checkX = centerX - width/2; checkX <= centerX + width/2; checkX += 5) {
          maxTerrainY = Math.max(maxTerrainY, getHeightAt(checkX));
        }
        
        pos0 = { x: centerX - width / 2, y: maxTerrainY };
        pos1 = { x: centerX + width / 2, y: maxTerrainY };
      }
    }

    // Create pad dimensions
    const width = 24 + rand() * 16; // 24-40 pixels
    
    // Validate path safety (simplified for now)
    const pathClearance = motion === "shuttle" ? 4 : baseClearance;
    const pathIsValid = this.validatePath(pos0, pos1, pathClearance, getHeightAt, existingPads, worldWidth, worldHeight, motion, width);
    if (!pathIsValid && !forced) {
      return null;
    }
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
      baseSpeed: speed / levelSpeedMultiplier,
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
    motion?: "shuttle" | "elevator" | "arc",
    padWidth: number = 40
  ): boolean {
    // Check bounds
    const minX = Math.min(pos0.x, pos1.x);
    const maxX = Math.max(pos0.x, pos1.x);
    const minY = Math.min(pos0.y, pos1.y);
    const maxY = Math.max(pos0.y, pos1.y);
    
    if (minX < clearance || maxX > worldWidth - clearance) return false;
    if (minY < clearance || maxY > worldHeight - clearance) return false;

    // Enhanced terrain validation for different motion types
    if (motion === "shuttle") {
      // For horizontal movement, ensure both endpoints are on safe, flat terrain with STRICTER tolerance
      const padWidth = 40; // Safer buffer for pad width
      
      // Check pos0 endpoint - require better terrain match
      const terrainY0 = getHeightAt(pos0.x);
      if (pos0.y > terrainY0 + 0.5) return false; // Must be nearly flush with terrain
      
      // Check terrain flatness around pos0 - MUCH stricter
      const checkRadius = Math.max(padWidth, 60); // Larger safety area
      let maxVariation = 0;
      for (let dx = -checkRadius; dx <= checkRadius; dx += 4) {
        const checkX = pos0.x + dx;
        const checkTerrainY = getHeightAt(checkX);
        const variation = Math.abs(checkTerrainY - terrainY0);
        maxVariation = Math.max(maxVariation, variation);
      }
      if (maxVariation > 2.0) return false; // Much stricter: max 2px variation
      
      // Check pos1 endpoint - require better terrain match
      const terrainY1 = getHeightAt(pos1.x);
      if (pos1.y > terrainY1 + 0.5) return false; // Must be nearly flush with terrain
      
      // Check terrain flatness around pos1 - MUCH stricter
      maxVariation = 0;
      for (let dx = -checkRadius; dx <= checkRadius; dx += 4) {
        const checkX = pos1.x + dx;
        const checkTerrainY = getHeightAt(checkX);
        const variation = Math.abs(checkTerrainY - terrainY1);
        maxVariation = Math.max(maxVariation, variation);
      }
      if (maxVariation > 2.0) return false; // Much stricter: max 2px variation
      
      // For shuttle pads, ensure they're placed at the HIGHEST point of their track to prevent sinking
      const trackMaxY = Math.max(terrainY0, terrainY1);
      pos0.y = trackMaxY;
      pos1.y = trackMaxY;
    } else if (motion === "elevator") {
      // For vertical movement, ensure bottom position is on flat terrain
      const terrainY = getHeightAt(pos1.x); // pos1 is bottom for elevator
      if (Math.abs(pos1.y - terrainY) > 2.0) return false; // Bottom must be flush with terrain
      
      // Check terrain flatness around bottom position
      for (let dx = -30; dx <= 30; dx += 5) {
        const checkX = pos1.x + dx;
        const checkTerrainY = getHeightAt(checkX);
        if (Math.abs(checkTerrainY - terrainY) > 5) {
          return false; // Bottom terrain must be reasonably flat
        }
      }
    } else if (motion === "arc") {
      // For arc movement, verify the lowest point of arc doesn't intersect terrain
      // Note: The arc parameters are not available in this scope, so we do basic validation
      // Check that both endpoints are above terrain
      const terrainY0 = getHeightAt(pos0.x);
      const terrainY1 = getHeightAt(pos1.x);
      if (pos0.y > terrainY0 - 5 || pos1.y > terrainY1 - 5) return false;
    }

    // Check terrain clearance at several points along path
    const steps = 20; // increased for better checking
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = pos0.x + (pos1.x - pos0.x) * t;
      const y = pos0.y + (pos1.y - pos0.y) * t;
      const terrainY = getHeightAt(x);
      
      if (motion === "shuttle" || motion === "elevator" || motion === "arc") {
        // Allow flush tracks: permit pad path to be at ground height (not below it)
        if (y > terrainY + 0.5) return false; // below terrain -> invalid
      }
    }

  // Check distance from existing pads with width-aware spacing
    for (const pad of existingPads) {
      const padCenterX = (pad.xStart + pad.xEnd) / 2;
      const existingPadWidth = pad.width || (pad.xEnd - pad.xStart);
      const minSeparation = Math.max(padWidth, existingPadWidth) + 150;
      
      const dist0 = Math.sqrt((pos0.x - padCenterX) ** 2 + (pos0.y - pad.y) ** 2);
      const dist1 = Math.sqrt((pos1.x - padCenterX) ** 2 + (pos1.y - pad.y) ** 2);
      
      if (dist0 < minSeparation || dist1 < minSeparation) return false;
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

  // Check if lander is on moving pad (with generous tolerance for moving pads)
  isOnMovingPad(x: number, y: number, pad: MovingPad, level?: number): boolean {
    const padWidth = pad.width || 32;
    const footY = y + 8; // Lander foot is ~8 pixels below center
    
    // Performance optimization: removed debug logging
    
    // Check horizontal bounds with appropriate tolerance
    const horizontalTolerance = pad.motion === "shuttle" ? 2 : 6; // More generous for vertical pads
    if (x < pad.currentPos.x - padWidth / 2 - horizontalTolerance || 
        x > pad.currentPos.x + padWidth / 2 + horizontalTolerance) {
      return false;
    }
    
    // Check vertical bounds - be extra generous for moving pads
    let verticalTolerance = 16; // Base tolerance for all moving pads
    
    // Increase tolerance after level 5 for high-level forgiveness
    if (level && level > 5) {
      verticalTolerance = 20; // Increased to 20px for levels 6+
    }
    
    return Math.abs(footY - pad.currentPos.y) <= verticalTolerance;
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