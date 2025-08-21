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