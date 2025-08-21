import { Vec2, vec2 } from './sdf';

export interface MineralElement {
  type: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  data?: any; // Type-specific additional data
}

export interface MineralCluster {
  center: Vec2;
  radius: number;
  elements: MineralElement[];
}

export interface MineralVein {
  points: Vec2[];
  thickness: number;
  nuggetPositions: number[]; // t values along spline for nugget placement
}

export interface MineralRings {
  center: Vec2;
  rings: { radius: number; thickness: number }[];
  rotation: number;
  sparklePoints: Vec2[];
}

// Mineral element type definitions
export const MINERAL_TYPES = {
  DIAMOND_FACETS: 'DiamondFacets',
  GOLD_VEINS: 'GoldVeins', 
  CRYSTAL_SPIKES: 'CrystalSpikes',
  GEODE_RINGS: 'GeodeRings',
  BASALT_COLUMNS: 'BasaltColumns',
  IRON_NODULES: 'IronNodules',
  ICE_SHARDS: 'IceShards',
  MAGMA_POCKETS: 'MagmaPockets',
  ALIEN_LATTICE: 'AlienLattice',
  GLOW_DUST: 'GlowDust'
} as const;

export type MineralType = typeof MINERAL_TYPES[keyof typeof MINERAL_TYPES];

// Color themes for each mineral type
export const MINERAL_COLORS = {
  [MINERAL_TYPES.DIAMOND_FACETS]: { primary: 'hsl(180, 100%, 90%)', secondary: 'hsl(200, 100%, 95%)', glow: 'hsl(180, 100%, 70%)' },
  [MINERAL_TYPES.GOLD_VEINS]: { primary: 'hsl(45, 100%, 65%)', secondary: 'hsl(50, 100%, 75%)', glow: 'hsl(45, 100%, 50%)' },
  [MINERAL_TYPES.CRYSTAL_SPIKES]: { primary: 'hsl(160, 80%, 70%)', secondary: 'hsl(180, 90%, 75%)', glow: 'hsl(170, 85%, 60%)' },
  [MINERAL_TYPES.GEODE_RINGS]: { primary: 'hsl(280, 70%, 70%)', secondary: 'hsl(260, 80%, 80%)', glow: 'hsl(270, 75%, 60%)' },
  [MINERAL_TYPES.BASALT_COLUMNS]: { primary: 'hsl(0, 0%, 40%)', secondary: 'hsl(0, 0%, 50%)', glow: 'hsl(0, 0%, 30%)' },
  [MINERAL_TYPES.IRON_NODULES]: { primary: 'hsl(200, 30%, 50%)', secondary: 'hsl(210, 40%, 60%)', glow: 'hsl(200, 35%, 40%)' },
  [MINERAL_TYPES.ICE_SHARDS]: { primary: 'hsl(200, 80%, 85%)', secondary: 'hsl(220, 90%, 90%)', glow: 'hsl(210, 85%, 75%)' },
  [MINERAL_TYPES.MAGMA_POCKETS]: { primary: 'hsl(15, 90%, 60%)', secondary: 'hsl(30, 95%, 70%)', glow: 'hsl(20, 85%, 50%)' },
  [MINERAL_TYPES.ALIEN_LATTICE]: { primary: 'hsl(120, 60%, 60%)', secondary: 'hsl(140, 70%, 70%)', glow: 'hsl(130, 65%, 50%)' },
  [MINERAL_TYPES.GLOW_DUST]: { primary: 'hsl(60, 40%, 70%)', secondary: 'hsl(70, 50%, 80%)', glow: 'hsl(65, 45%, 60%)' }
};

// Rendering functions for each mineral type
export const MineralRenderers = {
  [MINERAL_TYPES.DIAMOND_FACETS]: (ctx: CanvasRenderingContext2D, element: MineralElement, colors: any, glintPhase?: number) => {
    ctx.save();
    ctx.translate(element.x, element.y);
    ctx.rotate(element.rotation);
    ctx.scale(element.scale, element.scale);
    
    // Draw triangular facet cluster
    const numFacets = 6 + Math.floor((element.data?.seed || 0) * 4);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1;
    
    for (let i = 0; i < numFacets; i++) {
      const angle = (i / numFacets) * Math.PI * 2;
      const dist = 3 + (element.data?.seed || 0) * 8;
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist;
      
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 2);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.lineTo(cx, cy + 2);
      ctx.closePath();
      ctx.stroke();
      
      // Enhanced sparkle effect - more frequent and brighter
      if (i === Math.floor(glintPhase * numFacets) % numFacets || 
          i === Math.floor((glintPhase * 2.5) * numFacets) % numFacets) {
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = colors.secondary;
        ctx.stroke();
        ctx.shadowBlur = 8;
        ctx.strokeStyle = colors.glow;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = colors.primary;
      }
    }
    ctx.restore();
  },

  [MINERAL_TYPES.GOLD_VEINS]: (ctx: CanvasRenderingContext2D, vein: MineralVein, colors: any) => {
    if (vein.points.length < 2) return;
    
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = vein.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw spline path
    ctx.beginPath();
    ctx.moveTo(vein.points[0].x, vein.points[0].y);
    
    for (let i = 1; i < vein.points.length; i++) {
      ctx.lineTo(vein.points[i].x, vein.points[i].y);
    }
    ctx.stroke();
    
    // Draw nuggets at specified positions
    ctx.fillStyle = colors.secondary;
    for (const t of vein.nuggetPositions) {
      const idx = Math.floor(t * (vein.points.length - 1));
      const point = vein.points[Math.min(idx, vein.points.length - 1)];
      ctx.beginPath();
      ctx.arc(point.x, point.y, vein.thickness * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  [MINERAL_TYPES.CRYSTAL_SPIKES]: (ctx: CanvasRenderingContext2D, element: MineralElement, colors: any) => {
    ctx.save();
    ctx.translate(element.x, element.y);
    ctx.rotate(element.rotation);
    ctx.scale(element.scale, element.scale);
    
    const numSpikes = 5 + Math.floor((element.data?.seed || 0) * 7); // 5-12 spikes
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1.5;
    
    for (let i = 0; i < numSpikes; i++) {
      const angle = (i / numSpikes) * Math.PI * 2;
      const length = 8 + (element.data?.seed || 0) * 12;
      const endX = Math.cos(angle) * length;
      const endY = Math.sin(angle) * length;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(endX, endY);
      
      // Add secondary color for alternating spikes
      if (i % 2 === 0) {
        ctx.strokeStyle = colors.secondary;
      } else {
        ctx.strokeStyle = colors.primary;
      }
      ctx.stroke();
    }
    ctx.restore();
  },

  [MINERAL_TYPES.GEODE_RINGS]: (ctx: CanvasRenderingContext2D, rings: MineralRings, colors: any, pulsePhase?: number) => {
    ctx.save();
    ctx.translate(rings.center.x, rings.center.y);
    ctx.rotate(rings.rotation);
    
    // Draw concentric rings
    for (let i = 0; i < rings.rings.length; i++) {
      const ring = rings.rings[i];
      ctx.strokeStyle = i === rings.rings.length - 1 ? colors.secondary : colors.primary;
      ctx.lineWidth = ring.thickness;
      
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.radius, ring.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Enhanced sparkle points with pulsing
    ctx.fillStyle = colors.glow;
    ctx.shadowColor = colors.secondary;
    ctx.shadowBlur = 6;
    for (const sparkle of rings.sparklePoints) {
      // Pulsing sparkle size based on position
      const sparklePhase = (sparkle.x + sparkle.y) * 0.01;
      const sparkleSize = 1.5 + 0.8 * Math.sin(sparklePhase + (pulsePhase || 0) * 3);
      ctx.beginPath();
      ctx.arc(sparkle.x, sparkle.y, sparkleSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    
    ctx.restore();
  },

  [MINERAL_TYPES.BASALT_COLUMNS]: (ctx: CanvasRenderingContext2D, element: MineralElement, colors: any) => {
    ctx.save();
    ctx.translate(element.x, element.y);
    ctx.rotate(element.rotation);
    ctx.scale(element.scale, element.scale);
    
    // Draw hexagonal column stubs in lattice
    const cols = element.data?.cols || 3;
    const rows = element.data?.rows || 2;
    const hexSize = 4;
    
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const offsetX = col * hexSize * 1.5 + (row % 2) * hexSize * 0.75;
        const offsetY = row * hexSize * Math.sqrt(3) * 0.5;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = offsetX + Math.cos(angle) * hexSize;
          const y = offsetY + Math.sin(angle) * hexSize;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  [MINERAL_TYPES.IRON_NODULES]: (ctx: CanvasRenderingContext2D, element: MineralElement, colors: any) => {
    ctx.save();
    ctx.translate(element.x, element.y);
    ctx.scale(element.scale, element.scale);
    
    // Draw metallic blob
    const size = 4 + (element.data?.seed || 0) * 6;
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Add wire highlights
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const startR = size * 0.6;
      const endR = size * 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * startR, Math.sin(angle) * startR);
      ctx.lineTo(Math.cos(angle) * endR, Math.sin(angle) * endR);
      ctx.stroke();
    }
    
    ctx.restore();
  },

  [MINERAL_TYPES.ICE_SHARDS]: (ctx: CanvasRenderingContext2D, element: MineralElement, colors: any) => {
    ctx.save();
    ctx.translate(element.x, element.y);
    ctx.rotate(element.rotation);
    ctx.scale(element.scale, element.scale);
    
    const length = 12 + (element.data?.seed || 0) * 8;
    
    // Main shard line
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -length);
    ctx.lineTo(0, length);
    ctx.stroke();
    
    // Inner ribs
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      const y = -length + (i + 1) * (length * 2 / 4);
      ctx.beginPath();
      ctx.moveTo(-2, y);
      ctx.lineTo(2, y);
      ctx.stroke();
    }
    
    ctx.restore();
  },

  [MINERAL_TYPES.MAGMA_POCKETS]: (ctx: CanvasRenderingContext2D, element: MineralElement, colors: any, pulsePhase?: number) => {
    ctx.save();
    ctx.translate(element.x, element.y);
    ctx.scale(element.scale, element.scale);
    
    const baseSize = 6 + (element.data?.seed || 0) * 4;
    const pulseIntensity = 0.2 + 0.4 * Math.sin(pulsePhase || 0); // Enhanced pulsing
    const size = baseSize * (1 + pulseIntensity);
    
    // Enhanced glow effect with breathing intensity
    const glowIntensity = 8 + 6 * Math.sin((pulsePhase || 0) * 1.5);
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = glowIntensity;
    
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.restore();
  },

  [MINERAL_TYPES.ALIEN_LATTICE]: (ctx: CanvasRenderingContext2D, element: MineralElement, colors: any) => {
    ctx.save();
    ctx.translate(element.x, element.y);
    ctx.rotate(element.rotation);
    ctx.scale(element.scale, element.scale);
    
    const gridSize = 8;
    const lines = 4;
    
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 0.8;
    
    // Diagonal grid pattern
    for (let i = -lines; i <= lines; i++) {
      // Primary diagonal
      ctx.beginPath();
      ctx.moveTo(i * gridSize - gridSize * 2, -gridSize * 2);
      ctx.lineTo(i * gridSize + gridSize * 2, gridSize * 2);
      ctx.stroke();
      
      // Secondary diagonal
      ctx.beginPath();
      ctx.moveTo(i * gridSize - gridSize * 2, gridSize * 2);
      ctx.lineTo(i * gridSize + gridSize * 2, -gridSize * 2);
      ctx.stroke();
    }
    
    ctx.restore();
  },

  [MINERAL_TYPES.GLOW_DUST]: (ctx: CanvasRenderingContext2D, element: MineralElement, colors: any, driftOffset?: Vec2) => {
    ctx.save();
    ctx.translate(element.x + (driftOffset?.x || 0), element.y + (driftOffset?.y || 0));
    
    ctx.fillStyle = colors.primary;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 4;
    
    ctx.beginPath();
    ctx.arc(0, 0, element.scale * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.restore();
  }
};