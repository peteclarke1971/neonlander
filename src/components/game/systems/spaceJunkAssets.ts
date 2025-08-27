import { Vec2 } from './sdf';

export type SpaceJunkShape = "panel" | "toolbox" | "antenna" | "circuit" | "canister" | "crystal";

export interface AssetData {
  path: Vec2[];
  baseSize: number;
  spinSpeed: number; // degrees per second
}

export interface SparkleEffect {
  pos: Vec2;
  angle: number;
  alpha: number;
  phase: number;
}

// Vector path definitions for each space junk shape
export const SPACE_JUNK_ASSETS: Record<SpaceJunkShape, AssetData> = {
  panel: {
    path: [
      { x: -15, y: -8 }, { x: 15, y: -8 }, { x: 18, y: 8 }, { x: -12, y: 8 }, { x: -15, y: -8 },
      // Diagonal lines
      { x: -8, y: -8 }, { x: -5, y: 8 },
      { x: 0, y: -8 }, { x: 3, y: 8 },
      { x: 8, y: -8 }, { x: 11, y: 8 }
    ],
    baseSize: 38,
    spinSpeed: 15
  },
  
  toolbox: {
    path: [
      // Main body (rounded rectangle)
      { x: -18, y: -8 }, { x: 18, y: -8 }, { x: 20, y: -6 }, { x: 20, y: 6 }, 
      { x: 18, y: 8 }, { x: -18, y: 8 }, { x: -20, y: 6 }, { x: -20, y: -6 }, { x: -18, y: -8 },
      // Handle
      { x: -6, y: -12 }, { x: 6, y: -12 }, { x: 6, y: -8 }, { x: -6, y: -8 }, { x: -6, y: -12 }
    ],
    baseSize: 42,
    spinSpeed: -12
  },
  
  antenna: {
    path: [
      // Dish
      { x: -12, y: -4 }, { x: -8, y: -8 }, { x: 8, y: -8 }, { x: 12, y: -4 },
      { x: 8, y: 0 }, { x: -8, y: 0 }, { x: -12, y: -4 },
      // Mast
      { x: 0, y: 0 }, { x: 0, y: 16 },
      // Support struts
      { x: -4, y: 4 }, { x: 0, y: 16 }, { x: 4, y: 4 }
    ],
    baseSize: 40,
    spinSpeed: 8
  },
  
  circuit: {
    path: [
      // PCB outline
      { x: -16, y: -10 }, { x: 16, y: -10 }, { x: 16, y: 10 }, { x: -16, y: 10 }, { x: -16, y: -10 },
      // Traces
      { x: -12, y: -6 }, { x: 12, y: -6 },
      { x: -12, y: 0 }, { x: 12, y: 0 },
      { x: -12, y: 6 }, { x: 12, y: 6 },
      // Components
      { x: -8, y: -4 }, { x: -6, y: -4 }, { x: -6, y: -2 }, { x: -8, y: -2 }, { x: -8, y: -4 },
      { x: 6, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 2 }
    ],
    baseSize: 36,
    spinSpeed: -20
  },
  
  canister: {
    path: [
      // Body
      { x: -8, y: -12 }, { x: 8, y: -12 }, { x: 10, y: -10 }, { x: 10, y: 8 },
      { x: 8, y: 10 }, { x: -8, y: 10 }, { x: -10, y: 8 }, { x: -10, y: -10 }, { x: -8, y: -12 },
      // Cap
      { x: -6, y: -16 }, { x: 6, y: -16 }, { x: 6, y: -12 }, { x: -6, y: -12 }, { x: -6, y: -16 },
      // Ridges
      { x: -8, y: -4 }, { x: 8, y: -4 },
      { x: -8, y: 2 }, { x: 8, y: 2 }
    ],
    baseSize: 34,
    spinSpeed: 25
  },
  
  crystal: {
    path: [
      // Diamond facets
      { x: 0, y: -18 }, { x: -12, y: -6 }, { x: -8, y: 6 }, { x: 0, y: 12 },
      { x: 8, y: 6 }, { x: 12, y: -6 }, { x: 0, y: -18 },
      // Inner facets
      { x: 0, y: -18 }, { x: 0, y: 0 }, { x: -8, y: 6 },
      { x: 0, y: 0 }, { x: 8, y: 6 },
      { x: 0, y: 0 }, { x: -12, y: -6 },
      { x: 0, y: 0 }, { x: 12, y: -6 }
    ],
    baseSize: 44,
    spinSpeed: -30
  }
};

// Wormhole door ring configuration
export const WORMHOLE_RINGS = [
  { radius: 45, speed: 10, opacity: 0.8 },
  { radius: 35, speed: -15, opacity: 0.9 },
  { radius: 25, speed: 20, opacity: 1.0 },
  { radius: 15, speed: -25, opacity: 0.9 },
  { radius: 8, speed: 30, opacity: 0.7 }
];

export const WORMHOLE_GLYPH = "◆";

// Generate sparkle effects for a junk item
export function generateSparkles(seed: number, count: number = 3): SparkleEffect[] {
  const sparkles: SparkleEffect[] = [];
  let rng = seed;
  
  for (let i = 0; i < count; i++) {
    rng = (rng * 1664525 + 1013904223) % 0x100000000;
    const angle = (rng / 0x100000000) * Math.PI * 2;
    
    rng = (rng * 1664525 + 1013904223) % 0x100000000;
    const radius = 20 + (rng / 0x100000000) * 15;
    
    rng = (rng * 1664525 + 1013904223) % 0x100000000;
    const phase = (rng / 0x100000000) * Math.PI * 2;
    
    sparkles.push({
      pos: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      },
      angle: angle,
      alpha: 0,
      phase: phase
    });
  }
  
  return sparkles;
}

// Update sparkle animation
export function updateSparkles(sparkles: SparkleEffect[], time: number): void {
  sparkles.forEach(sparkle => {
    const cycle = Math.sin(time * 2 + sparkle.phase) * 0.5 + 0.5;
    sparkle.alpha = cycle * cycle; // Ease in/out
  });
}

// Render space junk asset to canvas context
export function renderSpaceJunk(
  ctx: CanvasRenderingContext2D,
  shape: SpaceJunkShape,
  x: number,
  y: number,
  rotation: number,
  scale: number,
  tint: string,
  sparkles?: SparkleEffect[]
): void {
  // Reduce size by 50%
  const adjustedScale = scale * 0.5;
  const asset = SPACE_JUNK_ASSETS[shape];
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(adjustedScale, adjustedScale);
  
  // Main shape with glow
  ctx.strokeStyle = tint;
  ctx.lineWidth = 2;
  ctx.shadowColor = tint;
  ctx.shadowBlur = 8;
  
  ctx.beginPath();
  const path = asset.path;
  if (path.length > 0) {
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
  }
  ctx.stroke();
  
  // Sparkles
  if (sparkles) {
    ctx.shadowBlur = 4;
    sparkles.forEach(sparkle => {
      if (sparkle.alpha > 0.1) {
        ctx.globalAlpha = sparkle.alpha;
        ctx.strokeStyle = tint;
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.moveTo(sparkle.pos.x - 4, sparkle.pos.y);
        ctx.lineTo(sparkle.pos.x + 4, sparkle.pos.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(sparkle.pos.x, sparkle.pos.y - 4);
        ctx.lineTo(sparkle.pos.x, sparkle.pos.y + 4);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }
  
  ctx.restore();
}

// Render wormhole door
export function renderWormholeDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  open: boolean,
  scale: number = 1
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  const openness = open ? 1 : 0.3;
  
  // Rings
  WORMHOLE_RINGS.forEach(ring => {
    const rotation = (time * ring.speed * Math.PI) / 180;
    const radius = ring.radius * openness;
    
    ctx.save();
    ctx.rotate(rotation);
    ctx.strokeStyle = `hsl(180, 100%, 50%)`;
    ctx.globalAlpha = ring.opacity * openness;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = `hsl(180, 100%, 50%)`;
    ctx.shadowBlur = 6;
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  
  // Center glyph
  if (open) {
    ctx.fillStyle = `hsl(180, 100%, 50%)`;
    ctx.shadowColor = `hsl(180, 100%, 50%)`;
    ctx.shadowBlur = 10;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(WORMHOLE_GLYPH, 0, 0);
  }
  
  ctx.restore();
}