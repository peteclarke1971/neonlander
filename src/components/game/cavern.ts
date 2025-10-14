import { Pad, CollectiblesData, Volcano } from "./types";
import { CavernBake, CavernBakeResult } from "./systems/cavernBake";
import { Vec2 } from "./systems/sdf";
import { generateCollectibles, PlacementContext } from "./systems/collectibles";
import { generateCavernVolcanoes } from "./systems/cavernVolcano";

export interface CavernWall {
  points: { x: number; y: number }[];
  type: "ceiling" | "floor" | "wall";
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "stalactite" | "stalagmite" | "rock";
}

export interface CavernData {
  worldWidth: number;
  worldHeight: number;
  startPad: Pad;
  endPad: Pad;
  walls: CavernWall[];
  obstacles: Obstacle[];
  pads: Pad[]; // compatibility with TerrainData - ONLY startPad and endPad
  points: { x: number; y: number }[]; // compatibility with TerrainData for rendering
  checkCollision: (x: number, y: number, radius: number) => boolean;
  getHeightAt: (x: number) => number; // simplified for compatibility
  getPadAt: (x: number) => Pad | null; // compatibility with TerrainData
  collectibles?: CollectiblesData;
  volcanoes?: Volcano[]; // Added volcano support for level 5+
  isCavern: true;
  // New mesh-baked data
  bakeResult?: CavernBakeResult;
  outlinePolylines: Vec2[][];
  collisionGrid: boolean[][];
  collisionCellSize: number;
}

export function generateCavern(seed: number, level: number, difficulty: "easy" | "hard"): CavernData {
  // Use new mesh-baked cavern system
  const hShip = 16; // Approximate lander height
  // Progressive world scaling - reduced to 4x larger at max levels (was 8x)
  const baseWidth = 2000;
  const baseHeight = 800;
  const scaleMultiplier = 0.5 + (level / 49) * 3.5; // 0.5x to 4x scaling (halved from original)
  const worldWidth = Math.floor(baseWidth * scaleMultiplier);
  const worldHeight = Math.floor(baseHeight * Math.min(scaleMultiplier, 2)); // Height caps at 2x (was 3x)
  
  const bakeResult = CavernBake.generate({
    level,
    hShip,
    worldBounds: { width: worldWidth, height: worldHeight },
    baseSeed: seed,
    difficulty: difficulty === "hard" ? "hard" : "mid"
  });
  
  // Convert to legacy format for compatibility
  const walls: CavernWall[] = bakeResult.outlinePolylines.map((polyline, index) => ({
    points: polyline.map(p => ({ x: p.x, y: p.y })),
    type: index === 0 ? "ceiling" : index === 1 ? "floor" : "wall"
  }));
  
  // No obstacles in new system (they're baked into the walls)
  const obstacles: Obstacle[] = [];
  
  // Use floor points from first polyline for compatibility
  const floorPoints = bakeResult.outlinePolylines[0] || [];
  const points = floorPoints.map(p => ({ x: p.x, y: p.y }));
  
  // Enhanced collision detection using mesh-baked data
  const checkCollision = (x: number, y: number, radius: number): boolean => {
    // Quick check using collision grid
    const cellSize = bakeResult.collisionCellSize;
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);
    
    // Check surrounding cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = gridX + dx;
        const checkY = gridY + dy;
        
        if (checkX >= 0 && checkX < bakeResult.collisionGrid[0]?.length &&
            checkY >= 0 && checkY < bakeResult.collisionGrid.length) {
          
          if (bakeResult.collisionGrid[checkY][checkX]) {
            // Cell contains solid material, check if lander intersects
            const cellCenterX = checkX * cellSize + cellSize / 2;
            const cellCenterY = checkY * cellSize + cellSize / 2;
            const distToCellCenter = Math.sqrt(
              (x - cellCenterX) ** 2 + (y - cellCenterY) ** 2
            );
            
            if (distToCellCenter < radius + cellSize * 0.7) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  };
  
  // Height detection - find nearest floor point
  const getHeightAt = (x: number): number => {
    if (points.length === 0) return worldHeight / 2;
    
    let closestY = points[0].y;
    let closestDist = Math.abs(x - points[0].x);
    
    for (const point of points) {
      const dist = Math.abs(x - point.x);
      if (dist < closestDist) {
        closestDist = dist;
        closestY = point.y;
      }
    }
    
    return closestY;
  };
  
  // Pad detection
  const getPadAt = (x: number): Pad | null => {
    if (x >= bakeResult.startPad.xStart && x <= bakeResult.startPad.xEnd) {
      return bakeResult.startPad;
    }
    if (x >= bakeResult.endPad.xStart && x <= bakeResult.endPad.xEnd) {
      return bakeResult.endPad;
    }
    return null;
  };

  // Generate collectibles for caverns
  const context: PlacementContext = {
    worldWidth,
    worldHeight,
    getHeightAt,
    pads: [bakeResult.startPad, bakeResult.endPad],
    shipHeight: 32,
    mode: "caverns",
    startPos: { x: bakeResult.startPad.xStart + (bakeResult.startPad.xEnd - bakeResult.startPad.xStart) / 2, y: bakeResult.startPad.y },
    goalPos: { x: bakeResult.endPad.xStart + (bakeResult.endPad.xEnd - bakeResult.endPad.xStart) / 2, y: bakeResult.endPad.y },
    checkCollision,
    chunkNumber: 0 // Not chunk-based (fixed level)
  };
  
  // Use terrain-based color for cavern collectibles
  const terrainColor = "hsl(var(--primary))"; // Use primary color from design system
  const collectibles = generateCollectibles(seed, context, terrainColor);

  // Generate volcanoes for level 5+
  const cavernDataTemp: CavernData = {
    worldWidth,
    worldHeight,
    startPad: bakeResult.startPad,
    endPad: bakeResult.endPad,
    walls,
    obstacles,
    pads: [bakeResult.startPad, bakeResult.endPad],
    points,
    checkCollision,
    getHeightAt,
    getPadAt,
    collectibles,
    isCavern: true,
    bakeResult,
    outlinePolylines: bakeResult.outlinePolylines,
    collisionGrid: bakeResult.collisionGrid,
    collisionCellSize: bakeResult.collisionCellSize
  };
  
  const volcanoes = generateCavernVolcanoes(seed, level, cavernDataTemp);
  
  return {
    worldWidth,
    worldHeight,
    startPad: bakeResult.startPad,
    endPad: bakeResult.endPad,
    walls,
    obstacles,
    pads: [bakeResult.startPad, bakeResult.endPad], // ONLY start and end pads - no extras
    points,
    checkCollision,
    getHeightAt,
    getPadAt,
    collectibles,
    volcanoes,
    isCavern: true,
    bakeResult,
    outlinePolylines: bakeResult.outlinePolylines,
    collisionGrid: bakeResult.collisionGrid,
    collisionCellSize: bakeResult.collisionCellSize
  };
}

// Legacy helper functions (kept for any remaining compatibility needs)
function getPathYAt(x: number, pathPoints: { x: number; y: number }[], worldWidth: number): number {
  if (pathPoints.length === 0) return 400;
  
  let leftPoint = pathPoints[0];
  let rightPoint = pathPoints[pathPoints.length - 1];
  
  for (let i = 0; i < pathPoints.length - 1; i++) {
    if (pathPoints[i].x <= x && pathPoints[i + 1].x >= x) {
      leftPoint = pathPoints[i];
      rightPoint = pathPoints[i + 1];
      break;
    }
  }
  
  if (leftPoint.x === rightPoint.x) return leftPoint.y;
  const t = (x - leftPoint.x) / (rightPoint.x - leftPoint.x);
  return leftPoint.y + (rightPoint.y - leftPoint.y) * t;
}

function getWallYAt(x: number, wallPoints: { x: number; y: number }[], worldWidth: number): number {
  return getPathYAt(x, wallPoints, worldWidth);
}

function pointInPolygon(px: number, py: number, points: { x: number; y: number }[], radius: number): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const dist = distanceToLineSegment(px, py, p1.x, p1.y, p2.x, p2.y);
    if (dist < radius) {
      return true;
    }
  }
  
  return false;
}

function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) {
    return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
  }
  
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
  const projection = {
    x: x1 + t * dx,
    y: y1 + t * dy
  };
  
  return Math.sqrt((px - projection.x) * (px - projection.x) + (py - projection.y) * (py - projection.y));
}
