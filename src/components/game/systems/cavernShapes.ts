// Shape selection and parameter generation for cavern archetypes
import { CavernShape, ShapeParams, Vec2, vec2 } from './sdf';

export interface ShapeWeights {
  ellipse: number;
  superellipse: number;
  roundedBox: number;
  roundedPolygon: number;
  metaball: number;
  radialNoise: number;
  orthLRoom: number;
}

// Default shape weights by difficulty level
const LEVEL_WEIGHTS: { [key: string]: ShapeWeights } = {
  // L0-4: Simple shapes, wide passages
  beginner: {
    ellipse: 0.7,
    superellipse: 0.0,
    roundedBox: 0.3,
    roundedPolygon: 0.0,
    metaball: 0.0,
    radialNoise: 0.0,
    orthLRoom: 0.0
  },
  
  // L5-9: Add variety, mild complexity  
  intermediate: {
    ellipse: 0.3,
    superellipse: 0.25,
    roundedBox: 0.25,
    roundedPolygon: 0.15,
    metaball: 0.0,
    radialNoise: 0.05,
    orthLRoom: 0.0
  },
  
  // L10-19: More variety, higher complexity
  advanced: {
    ellipse: 0.15,
    superellipse: 0.2,
    roundedBox: 0.15,
    roundedPolygon: 0.25,
    metaball: 0.15,
    radialNoise: 0.05,
    orthLRoom: 0.05
  },
  
  // L20+: All shapes, maximum complexity and exotic shapes
  expert: {
    ellipse: 0.1,
    superellipse: 0.15,
    roundedBox: 0.1,
    roundedPolygon: 0.25,
    metaball: 0.25,
    radialNoise: 0.1,
    orthLRoom: 0.05
  }
};

// Simple seeded PRNG
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getShapeWeightsForLevel(level: number): ShapeWeights {
  if (level <= 4) return LEVEL_WEIGHTS.beginner;
  if (level <= 9) return LEVEL_WEIGHTS.intermediate;
  if (level <= 19) return LEVEL_WEIGHTS.advanced;
  return LEVEL_WEIGHTS.expert;
}

export function selectShapeType(level: number, seed: number): CavernShape {
  const rand = mulberry32(seed);
  const weights = getShapeWeightsForLevel(level);
  
  const choices: { shape: CavernShape; weight: number }[] = [
    { shape: CavernShape.Ellipse, weight: weights.ellipse },
    { shape: CavernShape.Superellipse, weight: weights.superellipse },
    { shape: CavernShape.RoundedBox, weight: weights.roundedBox },
    { shape: CavernShape.RoundedPolygon, weight: weights.roundedPolygon },
    { shape: CavernShape.Metaball, weight: weights.metaball },
    { shape: CavernShape.RadialNoise, weight: weights.radialNoise },
    { shape: CavernShape.OrthLRoom, weight: weights.orthLRoom }
  ];
  
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let randomValue = rand() * totalWeight;
  
  for (const choice of choices) {
    randomValue -= choice.weight;
    if (randomValue <= 0 || choice.weight > 0) {
      return choice.shape;
    }
  }
  
  return CavernShape.Ellipse; // fallback
}

export function generateShapeParams(
  shapeType: CavernShape, 
  center: Vec2, 
  baseRadius: number, 
  level: number, 
  seed: number,
  hShip: number
): ShapeParams {
  const rand = mulberry32(seed);
  const minInscribedRadius = 1.6 * hShip;
  
  // Ensure minimum inscribed radius
  const safeRadius = Math.max(baseRadius, minInscribedRadius * 1.5);
  
  const params: ShapeParams = {
    center,
    orientation: level >= 8 ? rand() * Math.PI * 2 : 0
  };
  
  switch (shapeType) {
    case CavernShape.Ellipse: {
      // Much more variety in aspect ratios
      const aspectRatio = level <= 4 ? (0.8 + rand() * 0.4) : (0.5 + rand() * 1.0); // 0.5 to 1.5 for higher levels
      const majorAxis = safeRadius;
      const minorAxis = majorAxis * aspectRatio;
      params.axes = { a: majorAxis, b: minorAxis };
      break;
    }
    
    case CavernShape.Superellipse: {
      // More extreme aspect ratios and power values
      const aspectRatio = level <= 9 ? (0.7 + rand() * 0.6) : (0.4 + rand() * 1.2); // 0.4 to 1.6 for higher levels
      const pow = level <= 9 ? (2 + rand() * 3) : (1.5 + rand() * 6); // 1.5 to 7.5 for higher levels
      const majorAxis = safeRadius;
      const minorAxis = majorAxis * aspectRatio;
      params.axes = { a: majorAxis, b: minorAxis };
      params.pow = pow;
      break;
    }
    
    case CavernShape.RoundedBox: {
      // More extreme aspect ratios and corner variations
      const aspectRatio = level <= 9 ? (0.6 + rand() * 0.8) : (0.3 + rand() * 1.4); // 0.3 to 1.7 for higher levels
      const cornerRadius = Math.max(8, safeRadius * (0.05 + rand() * 0.3)); // More variation in corners
      params.halfSize = vec2(safeRadius, safeRadius * aspectRatio);
      params.cornerRadius = cornerRadius;
      break;
    }
    
    case CavernShape.RoundedPolygon: {
      // More variety in sides and much more irregular shapes
      const sides = level <= 9 ? (3 + Math.floor(rand() * 4)) : (3 + Math.floor(rand() * 6)); // 3-8 sides for higher levels
      const vertices: Vec2[] = [];
      const cornerRadius = Math.max(6, safeRadius * (0.03 + rand() * 0.2)); // More corner variation
      
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        // Much more irregular shapes for higher levels
        const radiusJitter = level <= 9 ? (1 + (rand() - 0.5) * 0.3) : (1 + (rand() - 0.5) * 0.6); // ±30% variation for higher levels
        const radius = safeRadius * radiusJitter;
        vertices.push(vec2(
          center.x + Math.cos(angle) * radius,
          center.y + Math.sin(angle) * radius
        ));
      }
      
      params.vertices = vertices;
      params.cornerRadius = cornerRadius;
      break;
    }
    
    case CavernShape.Metaball: {
      // More metaballs and variety for higher levels
      const numDiscs = level <= 9 ? (2 + Math.floor(rand() * 3)) : (2 + Math.floor(rand() * 5)); // 2-6 discs for higher levels
      const discs = [];
      const smoothK = level <= 9 ? (0.15 + rand() * 0.1) : (0.1 + rand() * 0.2); // More variation in smoothness
      
      for (let i = 0; i < numDiscs; i++) {
        // More spread for higher levels
        const maxOffset = level <= 9 ? 0.6 : 0.8;
        const offset = vec2(
          (rand() - 0.5) * safeRadius * maxOffset,
          (rand() - 0.5) * safeRadius * maxOffset
        );
        // More size variation for higher levels
        const minSize = level <= 9 ? 0.4 : 0.3;
        const maxSize = level <= 9 ? 0.7 : 0.8;
        const discRadius = safeRadius * (minSize + rand() * (maxSize - minSize));
        discs.push({
          center: vec2(center.x + offset.x, center.y + offset.y),
          radius: discRadius
        });
      }
      
      params.discs = discs;
      params.smoothK = smoothK;
      break;
    }
    
    case CavernShape.RadialNoise: {
      // Much more aggressive noise for higher levels
      const maxAmplitude = level <= 4 ? 0.05 : level <= 9 ? 0.15 : level <= 19 ? 0.25 : 0.35;
      const amplitude = rand() * maxAmplitude;
      const bands = level <= 9 ? (2 + Math.floor(rand() * 3)) : (3 + Math.floor(rand() * 5)); // 3-7 bands for higher levels
      
      params.baseRadius = safeRadius;
      params.noiseAmplitude = amplitude;
      params.noiseBands = bands;
      break;
    }
    
    case CavernShape.OrthLRoom: {
      // More extreme L-room variations
      const aspectRatio = level <= 9 ? (0.5 + rand() * 1.0) : (0.3 + rand() * 1.4); // 0.3 to 1.7 for higher levels
      const cornerRadius = Math.max(10, safeRadius * (0.05 + rand() * 0.15));
      params.halfSize = vec2(safeRadius, safeRadius * aspectRatio);
      params.cornerRadius = cornerRadius;
      break;
    }
  }
  
  return params;
}

// Calculate inscribed radius for a shape (approximate)
export function getInscribedRadius(shapeType: CavernShape, params: ShapeParams): number {
  switch (shapeType) {
    case CavernShape.Ellipse:
    case CavernShape.Superellipse:
      return Math.min(params.axes!.a, params.axes!.b) * 0.8;
    
    case CavernShape.RoundedBox:
    case CavernShape.OrthLRoom:
      return Math.min(params.halfSize!.x, params.halfSize!.y) * 0.9;
    
    case CavernShape.RoundedPolygon: {
      if (!params.vertices) return 50;
      let minDist = Infinity;
      const center = params.vertices.reduce((sum, v) => vec2(sum.x + v.x, sum.y + v.y), vec2(0, 0));
      center.x /= params.vertices.length;
      center.y /= params.vertices.length;
      
      for (const vertex of params.vertices) {
        const dist = Math.sqrt((vertex.x - center.x) ** 2 + (vertex.y - center.y) ** 2);
        minDist = Math.min(minDist, dist);
      }
      return minDist * 0.7;
    }
    
    case CavernShape.Metaball: {
      if (!params.discs) return 50;
      return Math.min(...params.discs.map(d => d.radius)) * 0.8;
    }
    
    case CavernShape.RadialNoise:
      return params.baseRadius! * (1 - params.noiseAmplitude!) * 0.9;
    
    default:
      return 50;
  }
}

// Validation functions
export function validateShapeParams(shapeType: CavernShape, params: ShapeParams, hShip: number): boolean {
  const inscribedRadius = getInscribedRadius(shapeType, params);
  const minRequired = 1.6 * hShip;
  
  if (inscribedRadius < minRequired) return false;
  
  // Additional shape-specific validations
  switch (shapeType) {
    case CavernShape.RoundedPolygon:
      if (!params.vertices || params.vertices.length < 3) return false;
      // Check minimum angle between edges
      for (let i = 0; i < params.vertices.length; i++) {
        const prev = params.vertices[(i - 1 + params.vertices.length) % params.vertices.length];
        const curr = params.vertices[i];
        const next = params.vertices[(i + 1) % params.vertices.length];
        
        // Calculate angle (simplified check)
        const v1 = vec2(prev.x - curr.x, prev.y - curr.y);
        const v2 = vec2(next.x - curr.x, next.y - curr.y);
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        if (mag1 > 0 && mag2 > 0) {
          const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
          if (angle < Math.PI / 180 * 55) return false; // less than 55 degrees
        }
      }
      break;
  }
  
  return true;
}

export function degradeShape(shapeType: CavernShape, params: ShapeParams): { shapeType: CavernShape; params: ShapeParams } {
  // Attempt to fix the shape by reducing complexity
  const newParams = { ...params };
  
  switch (shapeType) {
    case CavernShape.RadialNoise:
      newParams.noiseAmplitude = (params.noiseAmplitude || 0) * 0.5;
      if (newParams.noiseAmplitude! < 0.01) {
        // Convert to ellipse
        return {
          shapeType: CavernShape.Ellipse,
          params: {
            ...newParams,
            axes: { a: params.baseRadius! || 100, b: params.baseRadius! || 100 }
          }
        };
      }
      break;
      
    case CavernShape.RoundedPolygon:
      newParams.cornerRadius = Math.max(newParams.cornerRadius! * 1.5, 20);
      break;
      
    case CavernShape.Metaball:
      if (params.discs && params.discs.length > 2) {
        newParams.discs = params.discs.slice(0, 2);
      } else {
        // Convert to ellipse
        return {
          shapeType: CavernShape.Ellipse,
          params: {
            ...newParams,
            axes: { a: 120, b: 120 }
          }
        };
      }
      break;
      
    default:
      // Convert complex shapes to rounded box as fallback
      return {
        shapeType: CavernShape.RoundedBox,
        params: {
          ...newParams,
          halfSize: vec2(100, 100),
          cornerRadius: 20
        }
      };
  }
  
  return { shapeType, params: newParams };
}