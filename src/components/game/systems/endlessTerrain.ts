import { Pad, MovingPad } from "../types";

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
    
    // Generate moving pads at higher difficulty
    const movingPads: MovingPad[] = [];
    
    if (difficulty > 0.3 && rand() > 0.6) {
      const centerIdx = Math.floor(rand() * (segments - 10)) + 5;
      const padX = startX + centerIdx * step;
      const padY = points[centerIdx].y - 100;
      
      const width = 35 - difficulty * 10; // 35 to 25
      const speed = 60 + difficulty * 80; // 60 to 140
      
      movingPads.push({
        xStart: padX - width / 2,
        xEnd: padX + width / 2,
        y: padY,
        multiplier: 3,
        width,
        bonus2x: false,
        motion: "shuttle",
        pos0: { x: padX - 60, y: padY },
        pos1: { x: padX + 60, y: padY },
        speed,
        dwell: 0.5,
        currentPos: { x: padX - 60, y: padY },
        currentVelocity: { x: 0, y: 0 },
        phase: "dwelling",
        phaseTimer: 0,
        direction: 1,
        scoreMult: 2.0,
        enabledInCaverns: false,
        zIndex: 1,
        seed: seed
      });
    }
    
    // Store the last Y coordinate for the next chunk
    this.lastEndY = points[points.length - 1].y;
    
    return {
      startX,
      endX,
      points,
      pads,
      movingPads,
      difficulty
    };
  }
}
