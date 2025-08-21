import { Vec2, vec2 } from './sdf';

export interface GridCell {
  x: number;
  y: number;
  value: number; // SDF value
}

export interface MarchingSquaresResult {
  polylines: Vec2[][];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// Marching squares lookup table for edge configuration
const EDGE_TABLE = [
  [], // 0000
  [[0, 3]], // 0001
  [[1, 0]], // 0010
  [[1, 3]], // 0011
  [[2, 1]], // 0100
  [[0, 3], [2, 1]], // 0101 - ambiguous case
  [[2, 0]], // 0110
  [[2, 3]], // 0111
  [[3, 2]], // 1000
  [[0, 2]], // 1001
  [[1, 0], [3, 2]], // 1010 - ambiguous case
  [[1, 2]], // 1011
  [[3, 1]], // 1100
  [[0, 1]], // 1101
  [[3, 0]], // 1110
  [] // 1111
];

export function marchingSquares(
  sdfFunction: (p: Vec2) => number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  cellSize: number
): MarchingSquaresResult {
  const { minX, minY, maxX, maxY } = bounds;
  const width = Math.ceil((maxX - minX) / cellSize);
  const height = Math.ceil((maxY - minY) / cellSize);
  
  // Sample SDF values at grid points
  const grid: number[][] = [];
  for (let y = 0; y <= height; y++) {
    grid[y] = [];
    for (let x = 0; x <= width; x++) {
      const worldX = minX + x * cellSize;
      const worldY = minY + y * cellSize;
      grid[y][x] = sdfFunction(vec2(worldX, worldY));
    }
  }
  
  const polylines: Vec2[][] = [];
  const segments: { start: Vec2; end: Vec2 }[] = [];
  
  // Process each cell
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cellValue = getCellConfiguration(grid, x, y);
      const edges = EDGE_TABLE[cellValue];
      
      if (edges.length === 0) continue;
      
      const cellCorners = [
        vec2(minX + x * cellSize, minY + y * cellSize), // bottom-left
        vec2(minX + (x + 1) * cellSize, minY + y * cellSize), // bottom-right
        vec2(minX + (x + 1) * cellSize, minY + (y + 1) * cellSize), // top-right
        vec2(minX + x * cellSize, minY + (y + 1) * cellSize) // top-left
      ];
      
      const cellValues = [
        grid[y][x], // bottom-left
        grid[y][x + 1], // bottom-right
        grid[y + 1][x + 1], // top-right
        grid[y + 1][x] // top-left
      ];
      
      // Generate line segments for this cell
      for (const edge of edges) {
        const [startEdge, endEdge] = edge;
        const startPoint = interpolateEdge(cellCorners, cellValues, startEdge);
        const endPoint = interpolateEdge(cellCorners, cellValues, endEdge);
        
        segments.push({ start: startPoint, end: endPoint });
      }
    }
  }
  
  // Connect segments into polylines
  const connectedPolylines = connectSegments(segments, cellSize * 0.5);
  
  return {
    polylines: connectedPolylines,
    bounds
  };
}

function getCellConfiguration(grid: number[][], x: number, y: number): number {
  let config = 0;
  
  // Check each corner (clockwise from bottom-left)
  if (grid[y][x] < 0) config |= 1; // bottom-left
  if (grid[y][x + 1] < 0) config |= 2; // bottom-right
  if (grid[y + 1][x + 1] < 0) config |= 4; // top-right
  if (grid[y + 1][x] < 0) config |= 8; // top-left
  
  return config;
}

function interpolateEdge(corners: Vec2[], values: number[], edgeIndex: number): Vec2 {
  // Edge indices: 0=bottom, 1=right, 2=top, 3=left
  let p1: Vec2, p2: Vec2, v1: number, v2: number;
  
  switch (edgeIndex) {
    case 0: // bottom edge
      p1 = corners[0];
      p2 = corners[1];
      v1 = values[0];
      v2 = values[1];
      break;
    case 1: // right edge
      p1 = corners[1];
      p2 = corners[2];
      v1 = values[1];
      v2 = values[2];
      break;
    case 2: // top edge
      p1 = corners[2];
      p2 = corners[3];
      v1 = values[2];
      v2 = values[3];
      break;
    case 3: // left edge
      p1 = corners[3];
      p2 = corners[0];
      v1 = values[3];
      v2 = values[0];
      break;
    default:
      throw new Error(`Invalid edge index: ${edgeIndex}`);
  }
  
  // Linear interpolation to find zero crossing
  const t = Math.abs(v1) < 1e-6 ? 0 : Math.abs(v2) < 1e-6 ? 1 : Math.abs(v1) / (Math.abs(v1) + Math.abs(v2));
  
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  };
}

function connectSegments(segments: { start: Vec2; end: Vec2 }[], tolerance: number): Vec2[][] {
  const polylines: Vec2[][] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    
    const polyline: Vec2[] = [segments[i].start, segments[i].end];
    used.add(i);
    
    // Try to extend the polyline
    let extended = true;
    while (extended) {
      extended = false;
      
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        
        const seg = segments[j];
        const lastPoint = polyline[polyline.length - 1];
        const firstPoint = polyline[0];
        
        // Check if segment connects to end of polyline
        if (distance(lastPoint, seg.start) < tolerance) {
          polyline.push(seg.end);
          used.add(j);
          extended = true;
          break;
        } else if (distance(lastPoint, seg.end) < tolerance) {
          polyline.push(seg.start);
          used.add(j);
          extended = true;
          break;
        }
        // Check if segment connects to start of polyline
        else if (distance(firstPoint, seg.start) < tolerance) {
          polyline.unshift(seg.end);
          used.add(j);
          extended = true;
          break;
        } else if (distance(firstPoint, seg.end) < tolerance) {
          polyline.unshift(seg.start);
          used.add(j);
          extended = true;
          break;
        }
      }
    }
    
    // Check if polyline forms a loop
    if (polyline.length > 2 && distance(polyline[0], polyline[polyline.length - 1]) < tolerance) {
      polyline.pop(); // Remove duplicate endpoint
    }
    
    polylines.push(polyline);
  }
  
  return polylines;
}

function distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Simplify polylines using Ramer-Douglas-Peucker algorithm
export function simplifyPolyline(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length < 3) return points;
  
  // Find the point with maximum distance from line between first and last points
  let maxDistance = 0;
  let maxIndex = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }
  
  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const left = simplifyPolyline(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPolyline(points.slice(maxIndex), epsilon);
    
    // Combine results (remove duplicate middle point)
    return left.slice(0, -1).concat(right);
  } else {
    // Return simplified line with just endpoints
    return [points[0], points[points.length - 1]];
  }
}

function pointToLineDistance(point: Vec2, lineStart: Vec2, lineEnd: Vec2): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length < 1e-6) {
    // Degenerate line - return distance to point
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }
  
  // Calculate distance using cross product
  const cross = Math.abs((point.x - lineStart.x) * dy - (point.y - lineStart.y) * dx);
  return cross / length;
}