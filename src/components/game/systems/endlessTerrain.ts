import { Pad, MovingPad, Volcano } from "../types";
import { movingPadSystem } from "./movingPads";
import { generateVolcanoes, getVolcanoConfigForLevel } from "./volcano";
import { generateAnomalies, Anomaly } from "./anomalies";

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TerrainChunk {
  startX: number;
  endX: number;
  points: { x: number; y: number }[];
  pads: Pad[];
  movingPads: MovingPad[];
  volcanoes: Volcano[];
  anomalies: Anomaly[];
  difficulty: number; // 0-1 difficulty factor
}

export interface EndlessTerrainConfig {
  chunkWidth: number;
  baseHeight: number;
  amplitude: number;
  seed: number;
}

export class EndlessTerrainGenerator {
  private config: EndlessTerrainConfig;
  private chunkCounter: number = 0;
  private lastEndY: number | null = null;

  constructor(config: EndlessTerrainConfig) {
    this.config = config;
  }

  generateChunk(difficulty: number, isFirstChunk = false): TerrainChunk {
    const seed = this.config.seed + this.chunkCounter * 9973;
    const rand = mulberry32(seed);
    const startX = this.chunkCounter * this.config.chunkWidth;
    const endX = startX + this.config.chunkWidth;
    
    this.chunkCounter++;
    
    // Generate terrain points with more variety
    const points: { x: number; y: number }[] = [];
    const segments = 40;
    const step = this.config.chunkWidth / segments;
    
    // Increase amplitude and variation with difficulty
    const amplitude = this.config.amplitude * (1 + difficulty * 0.5);
    const variation = amplitude * (0.5 + difficulty * 0.6); // More variation
    
    // Start from the last chunk's end Y to ensure seamless connection
    let current = this.lastEndY !== null 
      ? this.lastEndY 
      : this.config.baseHeight + (rand() - 0.5) * amplitude;
    
    // Choose terrain type for this chunk
    const terrainType = rand();
    const isPlateauChunk = terrainType > 0.7;
    const isValleyChunk = terrainType < 0.15;
    const isSteepChunk = terrainType > 0.5 && terrainType <= 0.7;
    
    for (let i = 0; i <= segments; i++) {
      const x = startX + i * step;
      
      // First point: exact match with lastEndY for seamless connection
      if (i === 0 && this.lastEndY !== null) {
        points.push({ x, y: this.lastEndY });
        continue;
      }
      
      // Apply terrain type shaping
      let drift = (rand() - 0.5) * variation;
      
      if (isPlateauChunk && i > 5 && i < segments - 5) {
        // Plateau: flat elevated section
        drift *= 0.2;
        current = this.config.baseHeight * 0.85 + current * 0.15;
      } else if (isValleyChunk && i > segments * 0.3 && i < segments * 0.7) {
        // Valley: deeper section
        drift *= 1.5;
        current = this.config.baseHeight * 1.15 + current * -0.15;
      } else if (isSteepChunk) {
        // Steep terrain: sharp transitions
        drift *= 1.8;
        current = this.config.baseHeight * 0.85 + current * 0.15 + drift;
      } else {
        // Rolling hills: smooth transitions
        current = this.config.baseHeight * 0.9 + current * 0.1 + drift;
      }
      
      // Add multi-frequency sine waves for natural look
      const y = current + 
        Math.sin((i / segments) * Math.PI * 4) * (amplitude * 0.15) +
        Math.sin((i / segments) * Math.PI * 2) * (amplitude * 0.08);
      points.push({ x, y });
    }
    
    // Add occasional steep walls
    if (rand() > 0.7 && !isPlateauChunk) {
      const wallCenter = Math.floor(rand() * (segments - 12)) + 6;
      const wallHeight = amplitude * (0.4 + rand() * 0.4);
      const isCliff = rand() > 0.5;
      
      for (let j = 0; j < 6; j++) {
        const idx = wallCenter + j;
        if (idx > 0 && idx <= segments) {
          const t = j / 6;
          points[idx].y += isCliff ? -wallHeight * t : wallHeight * t;
        }
      }
    }
    
    // Add caverns based on difficulty
    const cavernCount = Math.floor(difficulty * 2);
    for (let k = 0; k < cavernCount; k++) {
      const center = Math.floor(rand() * (segments - 8)) + 4;
      const width = 3 + Math.floor(rand() * (3 + difficulty * 2));
      const depth = amplitude * (0.25 + rand() * 0.35);
      
      for (let j = -width; j <= width; j++) {
        const idx = center + j;
        if (idx >= 0 && idx <= segments) {
          const falloff = 1 - Math.abs(j) / (width + 1);
          points[idx].y += -depth * (0.6 + 0.4 * falloff);
        }
      }
    }
    
    // Generate pads with varied sizes
    const pads: Pad[] = [];
    
    // Force a large, flat starting pad for the first chunk
    if (isFirstChunk) {
      const centerIdx = Math.floor(segments / 2);
      const startPadWidth = 120; // Large starting pad
      const startPadY = this.config.baseHeight - 50; // Safe starting height
      
      // Flatten a large area for the starting pad
      const flattenRadius = Math.round((startPadWidth / step) * 1.5);
      for (let j = -flattenRadius; j <= flattenRadius; j++) {
        const idx = centerIdx + j;
        if (idx >= 0 && idx <= segments) {
          points[idx].y = startPadY;
        }
      }
      
      const padX = startX + centerIdx * step;
      pads.push({
        xStart: padX - startPadWidth / 2,
        xEnd: padX + startPadWidth / 2,
        y: startPadY,
        multiplier: 1, // No bonus on starting pad
        width: startPadWidth,
        bonus2x: false
      });
    }
    
    const padCount = isFirstChunk ? 1 : Math.max(2, Math.floor(3 - difficulty)); // 2-3 pads per chunk
    
    // Define 3 distinct size categories
    const padSizes = [
      { min: 24, max: 32, multiplier: 5 },  // Small
      { min: 40, max: 80, multiplier: 3 },  // Medium
      { min: 80, max: 170, multiplier: 2 }  // Large
    ];
    
    // Helper: Check if new pad would overlap with existing pads
    const checkPadCollision = (newPadX: number, newPadWidth: number, existingPads: Pad[]) => {
      for (const pad of existingPads) {
        const padCenterX = (pad.xStart + pad.xEnd) / 2;
        const padWidth = pad.width || 50;
        const minDistance = (newPadWidth + padWidth) / 2 + 100;
        if (Math.abs(newPadX - padCenterX) < minDistance) {
          return true; // Collision detected
        }
      }
      return false;
    };
    
    for (let i = (isFirstChunk ? 1 : 0); i < padCount; i++) {
      let attempts = 0;
      let centerIdx, padX, width, multiplier, sizeCategory;
      
      // Try up to 10 times to find non-overlapping position
      do {
        centerIdx = Math.floor(rand() * (segments - 6)) + 3;
        padX = startX + centerIdx * step;
        
        // Pick size category
        sizeCategory = padSizes[Math.floor(rand() * padSizes.length)];
        width = sizeCategory.min + rand() * (sizeCategory.max - sizeCategory.min);
        multiplier = sizeCategory.multiplier;
        attempts++;
      } while (checkPadCollision(padX, width, pads) && attempts < 10);
      
      // Skip this pad if we couldn't find a valid position
      if (attempts >= 10) continue;
      
      // Check if this is on a steep incline (jutting pad)
      const isJuttingPad = i === 0 && isSteepChunk && rand() > 0.5;
      
      // Flatten terrain for pad
      const targetY = points[centerIdx].y - 8;
      const flattenRadius = isJuttingPad 
        ? Math.round(width / step / 2) // Minimal flattening for jutting pads
        : Math.max(1, Math.round((width / step) * 1.2));
      
      for (let j = -flattenRadius; j <= flattenRadius; j++) {
        const idx = centerIdx + j;
        if (idx >= 0 && idx <= segments) {
          points[idx].y = targetY;
        }
      }
      
      pads.push({
        xStart: padX - width / 2,
        xEnd: padX + width / 2,
        y: targetY - 2, // Place pad ON TOP of terrain
        multiplier,
        width,
        bonus2x: false
      });
    }
    
    // Mark smallest pad as bonus
    if (pads.length > 1) {
      let minIdx = 0;
      let minW = pads[0].width!;
      for (let i = 1; i < pads.length; i++) {
        if (pads[i].width! < minW) {
          minW = pads[i].width!;
          minIdx = i;
        }
      }
      pads[minIdx].bonus2x = true;
    }
    
    // Generate moving pads at higher difficulty using advanced system with guaranteed MEGA pads
    const movingPads: MovingPad[] = [];
    
    if (difficulty > 0.05) {
      // Helper to get height at x within this chunk
      const getHeightAt = (x: number) => {
        if (x < startX || x > endX) return this.config.baseHeight;
        const localX = x - startX;
        const idx = Math.floor(localX / step);
        if (idx >= 0 && idx < points.length - 1) {
          const t = (localX - idx * step) / step;
          return points[idx].y * (1 - t) + points[idx + 1].y * t;
        }
        return points[Math.max(0, Math.min(idx, points.length - 1))].y;
      };
      
      // Convert difficulty to level (1-10)
      const level = Math.floor(difficulty * 10) + 1;
      
      // Try multiple times to generate moving pad (guarantees MEGA pads)
      let movingPad: MovingPad | null = null;
      const maxAttempts = 3;
      
      for (let attempt = 0; attempt < maxAttempts && !movingPad; attempt++) {
        const attemptSeed = seed + attempt * 1337;
        movingPad = movingPadSystem.generateMovingPad(
          attemptSeed,
          level,
          "easy",
          this.config.chunkWidth,
          600, // worldHeight
          getHeightAt,
          pads,
          false // isCavern
        );
      }
      
      // Force generation if all attempts failed - create longer flat stretch for shuttle pad
      if (!movingPad && difficulty > 0.2) {
        // Create a long flat stretch for shuttle motion
        const flatStart = Math.floor(segments * 0.3);
        const flatEnd = Math.floor(segments * 0.7);
        const flatY = this.config.baseHeight - 50;
        
        for (let i = flatStart; i <= flatEnd; i++) {
          if (i >= 0 && i <= segments) {
            points[i].y = flatY;
          }
        }
        
        // Force generate moving pad on this flat stretch
        movingPad = movingPadSystem.generateMovingPad(
          seed + 9999,
          level,
          "easy",
          this.config.chunkWidth,
          600,
          getHeightAt,
          pads,
          false
        );
      }
      
      if (movingPad) {
        movingPads.push(movingPad);
        
        // Flatten terrain beneath shuttle moving pads
        if (movingPad.motion === "shuttle") {
          const shuttleY = movingPad.pos0.y;
          const startPadX = Math.min(movingPad.pos0.x, movingPad.pos1.x) - startX;
          const endPadX = Math.max(movingPad.pos0.x, movingPad.pos1.x) - startX;
          
          // Flatten all terrain points beneath the shuttle path
          for (let i = 0; i < points.length; i++) {
            const pointX = points[i].x;
            if (pointX >= startPadX - 20 && pointX <= endPadX + 20) {
              points[i].y = shuttleY + 2; // Terrain at bottom of pad
            }
          }
        }
      }
    }
    
    // Generate volcanoes at higher difficulty
    const volcanoes: Volcano[] = [];
    if (difficulty > 0.1 && rand() > 0.5) {
      const level = Math.max(1, Math.floor(difficulty * 8));
      const config = getVolcanoConfigForLevel(level);
      
      // Find suitable volcano placement
      const volcIdx = Math.floor(rand() * (segments - 10)) + 5;
      const volcX = startX + volcIdx * step;
      const volcY = points[volcIdx].y;
      
      const size = config.minSize + rand() * (config.maxSize - config.minSize);
      
      volcanoes.push({
        x: volcX,
        y: volcY,
        size: size,
        nextEruption: 2 + rand() * 3,
        eruptionInterval: config.baseInterval,
        isErupting: false,
        eruptionTimer: 0,
        eruptionDuration: config.eruptionDuration,
        power: config.power,
        emissionCarry: 0
      });
    }
    
    // Generate anomalies (gravity wells) at medium difficulty
    const anomalies: Anomaly[] = [];
    if (difficulty > 0.15) {
      const anomCount = Math.floor(difficulty * 2); // 0-2 anomalies
      for (let i = 0; i < anomCount; i++) {
        const anomIdx = Math.floor(rand() * (segments - 8)) + 4;
        const anomX = startX + anomIdx * step;
        const anomY = points[anomIdx].y - 100 - rand() * 150;
        
        const kind = rand() > 0.5 ? "attract" : "repel";
        anomalies.push({
          x: anomX,
          y: anomY,
          radius: 60 + rand() * 40,
          strength: (0.3 + rand() * 0.4) * (kind === "attract" ? 1 : -1),
          falloff: 1.5 + rand() * 0.5,
          kind
        });
      }
    }
    
    // Store the last Y coordinate for the next chunk
    this.lastEndY = points[points.length - 1].y;
    
    return {
      startX,
      endX,
      points,
      pads,
      movingPads,
      volcanoes,
      anomalies,
      difficulty
    };
  }
}
