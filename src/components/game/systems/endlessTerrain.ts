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

  generateChunk(difficulty: number): TerrainChunk {
    const seed = this.config.seed + this.chunkCounter * 9973;
    const rand = mulberry32(seed);
    const startX = this.chunkCounter * this.config.chunkWidth;
    const endX = startX + this.config.chunkWidth;
    
    this.chunkCounter++;
    
    // Generate terrain points with increasing complexity
    const points: { x: number; y: number }[] = [];
    const segments = 40;
    const step = this.config.chunkWidth / segments;
    
    // Increase amplitude and variation with difficulty
    const amplitude = this.config.amplitude * (1 + difficulty * 0.5);
    const variation = amplitude * (0.3 + difficulty * 0.4);
    
    // Start from the last chunk's end Y to ensure seamless connection
    let current = this.lastEndY !== null 
      ? this.lastEndY 
      : this.config.baseHeight + (rand() - 0.5) * amplitude;
    
    for (let i = 0; i <= segments; i++) {
      const x = startX + i * step;
      
      // First point: exact match with lastEndY for seamless connection
      if (i === 0 && this.lastEndY !== null) {
        points.push({ x, y: this.lastEndY });
        continue;
      }
      
      // Subsequent points: apply blending and variation
      const drift = (rand() - 0.5) * variation;
      current = this.config.baseHeight * 0.9 + current * 0.1 + drift;
      
      // Add some sine variation for natural look
      const y = current + Math.sin((i / segments) * Math.PI * 4) * (amplitude * 0.15);
      points.push({ x, y });
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
    
    // Generate pads with decreasing size based on difficulty
    const pads: Pad[] = [];
    const padCount = Math.max(1, Math.floor(2 - difficulty)); // 1-2 pads per chunk
    
    for (let i = 0; i < padCount; i++) {
      const centerIdx = Math.floor(rand() * (segments - 6)) + 3;
      const padX = startX + centerIdx * step;
      
      // Pad size decreases with difficulty
      const maxWidth = 80 - difficulty * 50; // 80 to 30
      const minWidth = 40 - difficulty * 20; // 40 to 20
      const width = minWidth + rand() * (maxWidth - minWidth);
      
      const multiplier = width <= 30 ? 5 : width <= 50 ? 3 : 2;
      
      // Flatten terrain for pad
      const targetY = points[centerIdx].y - 8;
      const halfCount = Math.max(1, Math.round((width / step) * 1.2));
      
      for (let j = -halfCount; j <= halfCount; j++) {
        const idx = centerIdx + j;
        if (idx >= 0 && idx <= segments) {
          points[idx].y = targetY;
        }
      }
      
      pads.push({
        xStart: padX - width / 2,
        xEnd: padX + width / 2,
        y: targetY,
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
    
    // Generate moving pads at higher difficulty using advanced system
    const movingPads: MovingPad[] = [];
    
    if (difficulty > 0.1 && rand() > 0.4) {
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
      
      // Generate moving pad using advanced system
      const level = Math.floor(difficulty * 10) + 1; // Convert difficulty to level (1-10)
      const movingPad = movingPadSystem.generateMovingPad(
        seed,
        level,
        "easy",
        this.config.chunkWidth,
        600, // worldHeight
        getHeightAt,
        pads,
        false // isCavern
      );
      
      if (movingPad) {
        movingPads.push(movingPad);
      }
    }
    
    // Generate volcanoes at higher difficulty
    const volcanoes: Volcano[] = [];
    if (difficulty > 0.2 && rand() > 0.5) {
      const level = Math.floor(difficulty * 10) + 1;
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
