import { LightCycle, TrailSegment, GameArena } from "../types/lightcycles";

const DIRECTIONS = [
  { dx: 0, dy: -1, name: "up" },    // 0
  { dx: 1, dy: 0, name: "right" },  // 1
  { dx: 0, dy: 1, name: "down" },   // 2
  { dx: -1, dy: 0, name: "left" }   // 3
];

export const createLightCycle = (
  x: number, 
  y: number, 
  direction: 0 | 1 | 2 | 3, 
  color: string, 
  speed: number, 
  isPlayer: boolean,
  id: string
): LightCycle => ({
  x,
  y,
  direction,
  speed,
  color,
  trail: [],
  alive: true,
  isPlayer,
  id
});

export const updateLightCycle = (cycle: LightCycle, dt: number, arena: GameArena): LightCycle => {
  if (!cycle.alive) return cycle;

  const dir = DIRECTIONS[cycle.direction];
  const prevX = cycle.x;
  const prevY = cycle.y;
  
  // Move cycle
  const newX = cycle.x + dir.dx * cycle.speed * dt;
  const newY = cycle.y + dir.dy * cycle.speed * dt;

  // Check arena bounds
  if (newX < arena.bounds.left || newX > arena.bounds.right || 
      newY < arena.bounds.top || newY > arena.bounds.bottom) {
    return { ...cycle, alive: false };
  }

  // Add trail segment if moved far enough (creates continuous line)
  const newTrail = [...cycle.trail];
  if (cycle.trail.length === 0 || 
      Math.abs(newX - prevX) > 0.1 || Math.abs(newY - prevY) > 0.1) {
    newTrail.push({
      x1: prevX,
      y1: prevY,
      x2: newX,
      y2: newY,
      color: cycle.color,
      glow: cycle.isPlayer
    });
  }

  return {
    ...cycle,
    x: newX,
    y: newY,
    trail: newTrail
  };
};

export const turnLightCycle = (cycle: LightCycle, direction: 0 | 1 | 2 | 3): LightCycle => {
  if (!cycle.alive) return cycle;
  
  // Prevent 180-degree turns (can't reverse)
  const opposite = (cycle.direction + 2) % 4;
  if (direction === opposite) return cycle;
  
  return { ...cycle, direction };
};

export const checkTrailCollision = (
  cycle: LightCycle, 
  allCycles: LightCycle[]
): boolean => {
  if (!cycle.alive) return false;

  const cycleHead = { x: cycle.x, y: cycle.y };
  const tolerance = 1; // pixels - tighten to reduce false positives

  // Check collision with all trails (including own trail, but skip recent segments more aggressively)
  for (const otherCycle of allCycles) {
    const isSelf = otherCycle.id === cycle.id;
    const skipRecent = isSelf ? 12 : 0; // ignore the most recent segments of own trail
    const trailToCheck = isSelf 
      ? otherCycle.trail.slice(0, Math.max(0, otherCycle.trail.length - skipRecent))
      : otherCycle.trail;

    for (const segment of trailToCheck) {
      if (pointToLineDistance(cycleHead, segment) < tolerance) {
        return true;
      }
    }
  }

  return false;
};

const pointToLineDistance = (point: { x: number; y: number }, line: TrailSegment): number => {
  const { x1, y1, x2, y2 } = line;
  const A = point.x - x1;
  const B = point.y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return Math.sqrt(A * A + B * B);

  let param = dot / lenSq;
  param = Math.max(0, Math.min(1, param));

  const xx = x1 + param * C;
  const yy = y1 + param * D;

  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
};

export const getSpawnPositions = (arena: GameArena, count: number): Array<{x: number, y: number, direction: 0 | 1 | 2 | 3}> => {
  const positions = [];
  const margin = 50;
  const centerX = arena.width / 2;
  const centerY = arena.height / 2;
  
  if (count === 1) {
    // Player starts in center, facing up
    positions.push({ x: centerX, y: centerY, direction: 0 as const });
  } else {
    // Multiple cycles start from corners/edges
    const spawns = [
      { x: margin, y: margin, direction: 1 as const }, // top-left, facing right
      { x: arena.width - margin, y: margin, direction: 2 as const }, // top-right, facing down
      { x: arena.width - margin, y: arena.height - margin, direction: 3 as const }, // bottom-right, facing left
      { x: margin, y: arena.height - margin, direction: 0 as const }, // bottom-left, facing up
      { x: centerX, y: margin, direction: 2 as const }, // top-center, facing down
      { x: centerX, y: arena.height - margin, direction: 0 as const }, // bottom-center, facing up
    ];
    
    for (let i = 0; i < count && i < spawns.length; i++) {
      positions.push(spawns[i]);
    }
  }
  
  return positions;
};