// SDF (Signed Distance Field) functions for cavern generation
export interface Vec2 {
  x: number;
  y: number;
}

export interface Disc {
  center: Vec2;
  radius: number;
}

export interface Capsule {
  start: Vec2;
  end: Vec2;
  radius: number;
}

// Enhanced shape types for cavern generation
export enum CavernShape {
  Ellipse = 'ellipse',
  Superellipse = 'superellipse',
  RoundedBox = 'roundedBox',
  RoundedPolygon = 'roundedPolygon',
  Metaball = 'metaball',
  RadialNoise = 'radialNoise',
  HalfPlaneClip = 'halfPlaneClip',
  OrthLRoom = 'orthLRoom'
}

export interface ShapeParams {
  // Common
  center: Vec2;
  orientation: number; // rotation angle
  
  // Ellipse/Superellipse
  axes?: { a: number; b: number };
  pow?: number; // for superellipse
  
  // RoundedBox/OrthLRoom
  halfSize?: Vec2;
  cornerRadius?: number;
  
  // RoundedPolygon
  vertices?: Vec2[];
  
  // Metaball
  discs?: Disc[];
  smoothK?: number;
  
  // RadialNoise
  baseRadius?: number;
  noiseAmplitude?: number;
  noiseBands?: number;
  
  // HalfPlaneClip
  clipPlane?: { normal: Vec2; distance: number };
}

// SDF for a disc/circle
export function sdfDisc(p: Vec2, disc: Disc): number {
  const dx = p.x - disc.center.x;
  const dy = p.y - disc.center.y;
  return Math.sqrt(dx * dx + dy * dy) - disc.radius;
}

// SDF for a capsule (line segment with rounded ends)
export function sdfCapsule(p: Vec2, capsule: Capsule): number {
  const { start, end, radius } = capsule;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length < 1e-6) {
    // Degenerate case - treat as circle
    const pdx = p.x - start.x;
    const pdy = p.y - start.y;
    return Math.sqrt(pdx * pdx + pdy * pdy) - radius;
  }
  
  // Normalize direction vector
  const dirX = dx / length;
  const dirY = dy / length;
  
  // Vector from start to point
  const px = p.x - start.x;
  const py = p.y - start.y;
  
  // Project onto line segment
  const t = Math.max(0, Math.min(length, px * dirX + py * dirY));
  
  // Closest point on line segment
  const closestX = start.x + t * dirX;
  const closestY = start.y + t * dirY;
  
  // Distance to closest point minus radius
  const distX = p.x - closestX;
  const distY = p.y - closestY;
  return Math.sqrt(distX * distX + distY * distY) - radius;
}

// SDF union (minimum of all shapes)
export function sdfUnion(sdfs: number[]): number {
  return Math.min(...sdfs);
}

// Helper functions
export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

// Enhanced SDF functions for cavern shapes

// Transform point by rotation and translation
export function transformPoint(p: Vec2, center: Vec2, rotation: number): Vec2 {
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos
  };
}

// SDF for ellipse
export function sdfEllipse(p: Vec2, center: Vec2, axes: { a: number; b: number }, rotation = 0): number {
  const tp = transformPoint(p, center, rotation);
  const px = tp.x / axes.a;
  const py = tp.y / axes.b;
  return (Math.sqrt(px * px + py * py) - 1) * Math.min(axes.a, axes.b);
}

// SDF for superellipse
export function sdfSuperellipse(p: Vec2, center: Vec2, axes: { a: number; b: number }, pow: number, rotation = 0): number {
  const tp = transformPoint(p, center, rotation);
  const px = Math.abs(tp.x) / axes.a;
  const py = Math.abs(tp.y) / axes.b;
  return (Math.pow(Math.pow(px, pow) + Math.pow(py, pow), 1 / pow) - 1) * Math.min(axes.a, axes.b);
}

// SDF for rounded box
export function sdfRoundedBox(p: Vec2, center: Vec2, halfSize: Vec2, cornerRadius: number, rotation = 0): number {
  const tp = transformPoint(p, center, rotation);
  const dx = Math.max(0, Math.abs(tp.x) - halfSize.x + cornerRadius);
  const dy = Math.max(0, Math.abs(tp.y) - halfSize.y + cornerRadius);
  return Math.sqrt(dx * dx + dy * dy) - cornerRadius;
}

// SDF for rounded polygon (convex only)
export function sdfRoundedPolygon(p: Vec2, vertices: Vec2[], cornerRadius: number): number {
  if (vertices.length < 3) return Infinity;
  
  let minDist = Infinity;
  const n = vertices.length;
  
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    
    // Distance to edge
    const edgeDist = pointToSegmentDistance(p, v1, v2);
    minDist = Math.min(minDist, edgeDist);
  }
  
  return minDist - cornerRadius;
}

// Helper function for point to line segment distance
function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length < 1e-6) {
    const pdx = p.x - a.x;
    const pdy = p.y - a.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }
  
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (length * length)));
  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  const distX = p.x - closestX;
  const distY = p.y - closestY;
  return Math.sqrt(distX * distX + distY * distY);
}

// SDF for metaball (smooth union of discs)
export function sdfMetaball(p: Vec2, discs: Disc[], k: number): number {
  if (discs.length === 0) return Infinity;
  
  let result = sdfDisc(p, discs[0]);
  for (let i = 1; i < discs.length; i++) {
    result = sdfSmoothUnion(result, sdfDisc(p, discs[i]), k);
  }
  return result;
}

// SDF for radial noise
export function sdfRadialNoise(p: Vec2, center: Vec2, baseRadius: number, amplitude: number, bands: number): number {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const angle = Math.atan2(dy, dx);
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Simple sinusoidal noise
  const noise = Math.sin(angle * bands) * amplitude;
  const radiusWithNoise = baseRadius * (1 + noise);
  
  return distance - radiusWithNoise;
}

// SDF for orthogonal L-room (union of two rounded boxes)
export function sdfOrthLRoom(p: Vec2, center: Vec2, box1: { halfSize: Vec2; cornerRadius: number }, box2: { halfSize: Vec2; cornerRadius: number }, rotation = 0): number {
  const sdf1 = sdfRoundedBox(p, center, box1.halfSize, box1.cornerRadius, rotation);
  const offset = rotation === 0 ? vec2(box1.halfSize.x, box1.halfSize.y) : vec2(-box1.halfSize.y, box1.halfSize.x);
  const box2Center = vec2Add(center, offset);
  const sdf2 = sdfRoundedBox(p, box2Center, box2.halfSize, box2.cornerRadius, rotation);
  return Math.min(sdf1, sdf2);
}

// Smooth union operation
export function sdfSmoothUnion(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Smooth intersection operation
export function sdfSmoothIntersection(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

// Half-plane clipping (intersection with half-space)
export function sdfHalfPlaneClip(sdf: number, p: Vec2, plane: { normal: Vec2; distance: number }): number {
  const planeDist = p.x * plane.normal.x + p.y * plane.normal.y - plane.distance;
  return Math.max(sdf, planeDist);
}

// Main shape evaluation function
export function sdfShape(p: Vec2, shapeType: CavernShape, params: ShapeParams): number {
  switch (shapeType) {
    case CavernShape.Ellipse:
      return sdfEllipse(p, params.center, params.axes!, params.orientation);
    
    case CavernShape.Superellipse:
      return sdfSuperellipse(p, params.center, params.axes!, params.pow!, params.orientation);
    
    case CavernShape.RoundedBox:
      return sdfRoundedBox(p, params.center, params.halfSize!, params.cornerRadius!, params.orientation);
    
    case CavernShape.RoundedPolygon:
      return sdfRoundedPolygon(p, params.vertices!, params.cornerRadius!);
    
    case CavernShape.Metaball:
      return sdfMetaball(p, params.discs!, params.smoothK!);
    
    case CavernShape.RadialNoise:
      return sdfRadialNoise(p, params.center, params.baseRadius!, params.noiseAmplitude!, params.noiseBands!);
    
    case CavernShape.OrthLRoom:
      const box1 = { halfSize: params.halfSize!, cornerRadius: params.cornerRadius! };
      const box2 = { halfSize: vec2Scale(params.halfSize!, 0.7), cornerRadius: params.cornerRadius! };
      return sdfOrthLRoom(p, params.center, box1, box2, params.orientation);
    
    case CavernShape.HalfPlaneClip:
      // This should be applied as a post-process to another shape
      return Infinity;
    
    default:
      return sdfDisc(p, { center: params.center, radius: 100 }); // fallback
  }
}