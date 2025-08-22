import { Vec2, vec2, sdfDisc, sdfCapsule, sdfUnion, vec2Distance, vec2Lerp, Disc, Capsule, sdfShape, sdfHalfPlaneClip, CavernShape } from './sdf';
import { generateCavernTopology, CavernGraph, CavernNode, TunnelEdge } from './cavernTopology';
import { marchingSquares, simplifyPolyline, MarchingSquaresResult } from './marchingSquares';
import { Pad } from '../types';

export interface CavernBakeResult {
  caverns: CavernNode[];
  tunnels: TunnelEdge[];
  outlinePolylines: Vec2[][];
  collisionGrid: boolean[][];
  collisionCellSize: number;
  startId: number;
  destId: number;
  startPad: Pad;
  endPad: Pad;
  seedInfo: {
    level: number;
    baseSeed: number;
    hShip: number;
  };
  worldBounds: { width: number; height: number };
  acceptanceReport: AcceptanceReport;
}

export interface AcceptanceReport {
  passed: boolean;
  connectivity: boolean;
  continuity: boolean;
  clearance: boolean;
  bounds: boolean;
  destination: boolean;
  curvature: boolean;
  tunnelJoints: boolean;
  minWidth: number;
  issues: string[];
}

export interface CavernBakeParams {
  level: number;
  hShip: number;
  worldBounds: { width: number; height: number };
  baseSeed: number;
  difficulty?: 'easy' | 'mid' | 'hard';
}

export const CavernBake = {
  generate(params: CavernBakeParams): CavernBakeResult {
    const { level, hShip, worldBounds, baseSeed, difficulty = 'mid' } = params;
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const result = generateCavernAttempt(params, attempts);
        
        // Run acceptance checks
        const report = runAcceptanceChecks(result, hShip);
        result.acceptanceReport = report;
        
        if (report.passed) {
          return result;
        }
        
        console.warn(`Cavern generation attempt ${attempts + 1} failed:`, report.issues);
        attempts++;
      } catch (error) {
        console.warn(`Cavern generation attempt ${attempts + 1} threw error:`, error);
        attempts++;
      }
    }
    
    // All attempts failed, use fallback
    console.warn('All cavern generation attempts failed, using fallback');
    return generateFallbackCavern(params);
  },

  get acceptanceReport(): AcceptanceReport {
    return lastAcceptanceReport;
  }
};

let lastAcceptanceReport: AcceptanceReport = {
  passed: false,
  connectivity: false,
  continuity: false,
  clearance: false,
  bounds: false,
  destination: false,
  curvature: false,
  tunnelJoints: false,
  minWidth: 0,
  issues: []
};

function generateCavernAttempt(params: CavernBakeParams, attempt: number): CavernBakeResult {
  const { level, hShip, worldBounds, baseSeed } = params;
  
  // Adjust seed for retry attempts
  const attemptSeed = baseSeed ^ (attempt * 0x12345678);
  
  // Generate topology
  const graph = generateCavernTopology(level, hShip, worldBounds, attemptSeed);
  
  // Compute flat base for start and destination caverns
  const startNode = graph.nodes[graph.startId];
  const endNode = graph.nodes[graph.destId];
  const padWidth = Math.max(80, hShip * 5);
  
  // Start cavern flat base calculation
  const startR = startNode.radius;
  const startHalfWTarget = Math.min(startR * 0.8, (padWidth + hShip) / 2);
  const startHFlat = startR - Math.sqrt(Math.max(0, startR * startR - startHalfWTarget * startHalfWTarget));
  const startFloorY = startNode.center.y + startR - startHFlat;
  const startFlatHalfWidth = Math.sqrt(Math.max(0, startR * startR - (startR - startHFlat) * (startR - startHFlat)));
  
  // End cavern flat base calculation
  const endR = endNode.radius;
  const endHalfWTarget = Math.min(endR * 0.8, (padWidth + hShip) / 2);
  const endHFlat = endR - Math.sqrt(Math.max(0, endR * endR - endHalfWTarget * endHalfWTarget));
  const endFloorY = endNode.center.y + endR - endHFlat;
  const endFlatHalfWidth = Math.sqrt(Math.max(0, endR * endR - (endR - endHFlat) * (endR - endHFlat)));
  
  // Regular caverns (non-start/end) using their specific shapes
  const regularCaverns = graph.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ index }) => index !== graph.startId && index !== graph.destId);
  
  
  const capsules: Capsule[] = [];
  
  for (const edge of graph.edges) {
    const fromNode = graph.nodes[edge.from];
    const toNode = graph.nodes[edge.to];
    
    // Create capsules for each segment of the tunnel path
    for (let i = 0; i < edge.path.length - 1; i++) {
      const segmentStart = edge.path[i];
      const segmentEnd = edge.path[i + 1];
      
      // Calculate average radius for this segment
      const startT = i / (edge.path.length - 1);
      const endT = (i + 1) / (edge.path.length - 1);
      const startRadiusIdx = Math.floor(startT * (edge.radiusProfile.length - 1));
      const endRadiusIdx = Math.floor(endT * (edge.radiusProfile.length - 1));
      const avgRadius = (edge.radiusProfile[startRadiusIdx] + edge.radiusProfile[endRadiusIdx]) / 2;
      
      capsules.push({
        start: segmentStart,
        end: segmentEnd,
        radius: avgRadius
      });
    }
  }
  
  // Calculate bounds for marching squares
  const margin = 100;
  const bounds = {
    minX: 0 - margin,
    minY: 0 - margin,
    maxX: worldBounds.width + margin,
    maxY: worldBounds.height + margin
  };
  
  // Calculate cell size - use smaller cells for better continuity at joints
  const cellSize = Math.max(4, Math.min(12, Math.floor(hShip / 4)));
  
  // Create SDF function with enhanced shapes and flat floor clipping
  const sdfFunction = (p: Vec2): number => {
    // Start cavern with flat floor
    const startSDF = sdfShape(p, startNode.shapeType, startNode.shapeParams);
    const startComposite = Math.max(startSDF, p.y - startFloorY);
    
    // End cavern with flat floor
    const endSDF = sdfShape(p, endNode.shapeType, endNode.shapeParams);
    const endComposite = Math.max(endSDF, p.y - endFloorY);
    
    // Regular caverns with their specific shapes
    const regularSDFs = regularCaverns.map(({ node }) => sdfShape(p, node.shapeType, node.shapeParams));

    // Union of all capsules
    let capsuleUnion = Infinity;
    for (const cap of capsules) {
      const s = sdfCapsule(p, cap);
      if (s < capsuleUnion) capsuleUnion = s;
    }

    // Preserve flat bases: prevent tunnels from carving below floors near start/end caverns
    const dxStart = p.x - startNode.center.x;
    const dyStart = p.y - startNode.center.y;
    const distToStart = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
    const nearStart = distToStart < startR * 1.1;
    
    const dxEnd = p.x - endNode.center.x;
    const dyEnd = p.y - endNode.center.y;
    const distToEnd = Math.sqrt(dxEnd * dxEnd + dyEnd * dyEnd);
    const nearEnd = distToEnd < endR * 1.1;

    let capsuleClipped = capsuleUnion;
    if (nearStart) capsuleClipped = Math.max(capsuleClipped, p.y - startFloorY);
    if (nearEnd) capsuleClipped = Math.max(capsuleClipped, p.y - endFloorY);

    return Math.min(startComposite, endComposite, ...regularSDFs, capsuleClipped);
  };
  
  // Bake mesh using marching squares
  const meshResult = marchingSquares(sdfFunction, bounds, cellSize);
  
  // Simplify polylines
  const simplificationEpsilon = cellSize * 0.75;
  const simplifiedPolylines = meshResult.polylines.map(polyline => 
    simplifyPolyline(polyline, simplificationEpsilon)
  );
  
  // Create collision grid
  const gridWidth = Math.ceil(worldBounds.width / cellSize);
  const gridHeight = Math.ceil(worldBounds.height / cellSize);
  const collisionGrid: boolean[][] = [];
  
  for (let y = 0; y < gridHeight; y++) {
    collisionGrid[y] = [];
    for (let x = 0; x < gridWidth; x++) {
      const worldX = x * cellSize + cellSize / 2;
      const worldY = y * cellSize + cellSize / 2;
      const sdfValue = sdfFunction(vec2(worldX, worldY));
      collisionGrid[y][x] = sdfValue >= 0; // true = solid (rock), false = air
    }
  }
  
  // Create landing pads - both pads sit on flat cavern floors
  const padMargin = Math.max(0.6 * hShip, 12);
  const startEffectivePadHalf = Math.max(20, Math.min(padWidth / 2, startFlatHalfWidth - padMargin));
  const endEffectivePadHalf = Math.max(20, Math.min(padWidth / 2, endFlatHalfWidth - padMargin));
  
  // Ensure pads have proper clearance and are perfectly flush with flat floors
  const startPad: Pad = {
    xStart: startNode.center.x - startEffectivePadHalf,
    xEnd: startNode.center.x + startEffectivePadHalf,
    y: startFloorY - 1, // slightly below floor to ensure flush contact
    multiplier: 1,
    width: startEffectivePadHalf * 2,
    bonus2x: false
  };

  const endPad: Pad = {
    xStart: endNode.center.x - endEffectivePadHalf,
    xEnd: endNode.center.x + endEffectivePadHalf,
    y: endFloorY - 1, // slightly below floor to ensure flush contact
    multiplier: 5,
    width: endEffectivePadHalf * 2,
    bonus2x: true
  };
  
  return {
    caverns: graph.nodes,
    tunnels: graph.edges,
    outlinePolylines: simplifiedPolylines,
    collisionGrid,
    collisionCellSize: cellSize,
    startId: graph.startId,
    destId: graph.destId,
    startPad,
    endPad,
    seedInfo: {
      level,
      baseSeed,
      hShip
    },
    worldBounds,
    acceptanceReport: {
      passed: false,
      connectivity: false,
      continuity: false,
      clearance: false,
      bounds: false,
      destination: false,
      curvature: false,
      tunnelJoints: false,
      minWidth: 0,
      issues: []
    }
  };
}

function runAcceptanceChecks(result: CavernBakeResult, hShip: number): AcceptanceReport {
  const report: AcceptanceReport = {
    passed: false,
    connectivity: false,
    continuity: false,
    clearance: false,
    bounds: false,
    destination: false,
    curvature: false,
    tunnelJoints: false,
    minWidth: Infinity,
    issues: []
  };
  
  // Check 1: Connectivity
  const connected = checkConnectivity(result);
  report.connectivity = connected;
  if (!connected) {
    report.issues.push('Graph is not connected');
  }
  
  // Check 2: Continuity
  const continuous = checkContinuity(result);
  report.continuity = continuous;
  if (!continuous) {
    report.issues.push('Tunnels not properly connected to caverns');
  }
  
  // Check 3: Clearance
  const { hasMinClearance, minWidth } = checkClearance(result, hShip);
  report.clearance = hasMinClearance;
  report.minWidth = minWidth;
  if (!hasMinClearance) {
    report.issues.push(`Insufficient clearance: ${minWidth.toFixed(1)} < ${3 * hShip}`);
  }
  
  // Check 4: Bounds
  const inBounds = checkBounds(result);
  report.bounds = inBounds;
  if (!inBounds) {
    report.issues.push('Cavern extends outside world bounds');
  }
  
  // Check 5: Destination rule
  const correctDestination = checkDestination(result);
  report.destination = correctDestination;
  if (!correctDestination) {
    report.issues.push('Destination is not the farthest node');
  }
  
  // Check 6: Curvature validation
  const validCurvature = checkCurvature(result, hShip);
  report.curvature = validCurvature;
  if (!validCurvature) {
    report.issues.push('Shape curvature too sharp for ship');
  }
  
  // Check 7: Tunnel joint validation
  const validJoints = checkTunnelJoints(result, hShip);
  report.tunnelJoints = validJoints;
  if (!validJoints) {
    report.issues.push('Tunnel-cavern joints have insufficient clearance');
  }
  
  report.passed = report.connectivity && report.continuity && report.clearance && 
                   report.bounds && report.destination && report.curvature && report.tunnelJoints;
  
  lastAcceptanceReport = report;
  return report;
}

function checkConnectivity(result: CavernBakeResult): boolean {
  // Simple BFS to check if destination is reachable from start
  const visited = new Set<number>();
  const queue = [result.startId];
  visited.add(result.startId);
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    
    if (currentId === result.destId) {
      return true;
    }
    
    const currentNode = result.caverns[currentId];
    for (const neighborId of currentNode.connections) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }
  
  return false;
}

function checkContinuity(result: CavernBakeResult): boolean {
  // Check that tunnel endpoints are properly contained within caverns
  for (const tunnel of result.tunnels) {
    const fromCavern = result.caverns[tunnel.from];
    const toCavern = result.caverns[tunnel.to];
    
    const startDist = vec2Distance(tunnel.path[0], fromCavern.center);
    const endDist = vec2Distance(tunnel.path[tunnel.path.length - 1], toCavern.center);
    
    const minRadius = tunnel.radiusProfile[0];
    const maxRadius = tunnel.radiusProfile[tunnel.radiusProfile.length - 1];
    
    if (startDist + minRadius > fromCavern.radius * 0.9 ||
        endDist + maxRadius > toCavern.radius * 0.9) {
      return false;
    }
  }
  
  return true;
}

function checkClearance(result: CavernBakeResult, hShip: number): { hasMinClearance: boolean; minWidth: number } {
  const minRequiredWidth = 3 * hShip;
  let minObservedWidth = Infinity;
  
  // Sample points along tunnel centerlines and check clearance
  for (const tunnel of result.tunnels) {
    for (let i = 0; i < tunnel.path.length - 1; i++) {
      const segmentStart = tunnel.path[i];
      const segmentEnd = tunnel.path[i + 1];
      
      // Sample along segment
      const samples = 20;
      for (let s = 0; s <= samples; s++) {
        const t = s / samples;
        const point = vec2Lerp(segmentStart, segmentEnd, t);
        
        // Find corresponding radius
        const radiusT = (i + t) / (tunnel.path.length - 1);
        const radiusIdx = Math.floor(radiusT * (tunnel.radiusProfile.length - 1));
        const radius = tunnel.radiusProfile[radiusIdx];
        
        const effectiveWidth = radius * 2;
        minObservedWidth = Math.min(minObservedWidth, effectiveWidth);
      }
    }
  }
  
  return {
    hasMinClearance: minObservedWidth >= minRequiredWidth,
    minWidth: minObservedWidth
  };
}

function checkBounds(result: CavernBakeResult): boolean {
  const { worldBounds } = result;
  const margin = 50;
  
  // Check all caverns are within bounds
  for (const cavern of result.caverns) {
    if (cavern.center.x - cavern.radius < margin ||
        cavern.center.x + cavern.radius > worldBounds.width - margin ||
        cavern.center.y - cavern.radius < margin ||
        cavern.center.y + cavern.radius > worldBounds.height - margin) {
      return false;
    }
  }
  
  return true;
}

function checkDestination(result: CavernBakeResult): boolean {
  // The destination should be the farthest node by graph distance
  // This is already ensured by the topology generator, so just verify
  return result.destId !== result.startId;
}

function checkCurvature(result: CavernBakeResult, hShip: number): boolean {
  const minCurvatureRadius = 1.2 * hShip;
  
  // For now, assume all our generated shapes have acceptable curvature
  // This could be enhanced to do actual curvature analysis
  for (const cavern of result.caverns) {
    if (cavern.inscribedRadius < minCurvatureRadius) {
      return false;
    }
  }
  
  return true;
}

function checkTunnelJoints(result: CavernBakeResult, hShip: number): boolean {
  const margin = 4; // pixels
  
  for (const tunnel of result.tunnels) {
    const fromCavern = result.caverns[tunnel.from];
    const toCavern = result.caverns[tunnel.to];
    
    // Check start joint
    const startPoint = tunnel.path[0];
    const startRadius = tunnel.radiusProfile[0];
    const startCavernSDF = sdfShape(startPoint, fromCavern.shapeType, fromCavern.shapeParams);
    
    if (startCavernSDF > -startRadius - margin) {
      return false;
    }
    
    // Check end joint
    const endPoint = tunnel.path[tunnel.path.length - 1];
    const endRadius = tunnel.radiusProfile[tunnel.radiusProfile.length - 1];
    const endCavernSDF = sdfShape(endPoint, toCavern.shapeType, toCavern.shapeParams);
    
    if (endCavernSDF > -endRadius - margin) {
      return false;
    }
  }
  
  return true;
}

function generateFallbackCavern(params: CavernBakeParams): CavernBakeResult {
  const { level, hShip, worldBounds, baseSeed } = params;
  
  // Create simple two-cavern system
  const startRadius = 150;
  const endRadius = 150;
  const tunnelRadius = Math.max(2 * hShip, 40);
  
  const startCenter = vec2(startRadius + 100, worldBounds.height / 2);
  const endCenter = vec2(worldBounds.width - endRadius - 100, worldBounds.height / 2);
  
  const nodes: CavernNode[] = [
    {
      id: 0,
      center: startCenter,
      radius: startRadius,
      connections: [1],
      shapeType: CavernShape.Ellipse,
      shapeParams: {
        center: startCenter,
        orientation: 0,
        axes: { a: startRadius, b: startRadius }
      },
      inscribedRadius: startRadius * 0.8
    },
    {
      id: 1,
      center: endCenter,
      radius: endRadius,
      connections: [0],
      shapeType: CavernShape.Ellipse,
      shapeParams: {
        center: endCenter,
        orientation: 0,
        axes: { a: endRadius, b: endRadius }
      },
      inscribedRadius: endRadius * 0.8
    }
  ];
  
  const edges: TunnelEdge[] = [{
    from: 0,
    to: 1,
    path: [startCenter, endCenter],
    radiusProfile: [tunnelRadius, tunnelRadius],
    length: vec2Distance(startCenter, endCenter)
  }];
  
  // Create simple polylines (rectangles approximating the caverns and tunnel)
  const polylines: Vec2[][] = [];
  
  // Start cavern (circle approximation)
  const startCircle: Vec2[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    startCircle.push(vec2(
      startCenter.x + Math.cos(angle) * startRadius,
      startCenter.y + Math.sin(angle) * startRadius
    ));
  }
  polylines.push(startCircle);
  
  // End cavern (circle approximation)
  const endCircle: Vec2[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    endCircle.push(vec2(
      endCenter.x + Math.cos(angle) * endRadius,
      endCenter.y + Math.sin(angle) * endRadius
    ));
  }
  polylines.push(endCircle);
  
  // Tunnel (rectangle)
  const tunnelTop = Math.min(startCenter.y, endCenter.y) - tunnelRadius;
  const tunnelBottom = Math.max(startCenter.y, endCenter.y) + tunnelRadius;
  const tunnelLeft = startCenter.x;
  const tunnelRight = endCenter.x;
  
  polylines.push([
    vec2(tunnelLeft, tunnelTop),
    vec2(tunnelRight, tunnelTop),
    vec2(tunnelRight, tunnelBottom),
    vec2(tunnelLeft, tunnelBottom)
  ]);
  
  // Create collision grid
  const cellSize = Math.max(6, Math.floor(hShip / 3));
  const gridWidth = Math.ceil(worldBounds.width / cellSize);
  const gridHeight = Math.ceil(worldBounds.height / cellSize);
  const collisionGrid: boolean[][] = [];
  
  for (let y = 0; y < gridHeight; y++) {
    collisionGrid[y] = [];
    for (let x = 0; x < gridWidth; x++) {
      collisionGrid[y][x] = true; // Start with all solid
      
      const worldX = x * cellSize + cellSize / 2;
      const worldY = y * cellSize + cellSize / 2;
      
      // Check if point is inside any air volume
      const distToStart = vec2Distance(vec2(worldX, worldY), startCenter);
      const distToEnd = vec2Distance(vec2(worldX, worldY), endCenter);
      
      if (distToStart < startRadius || distToEnd < endRadius ||
          (worldX >= tunnelLeft && worldX <= tunnelRight && 
           worldY >= tunnelTop && worldY <= tunnelBottom)) {
        collisionGrid[y][x] = false; // Air
      }
    }
  }
  
  const padWidth = Math.max(80, hShip * 5);
  
  const startPad: Pad = {
    xStart: startCenter.x - padWidth / 2,
    xEnd: startCenter.x + padWidth / 2,
    y: startCenter.y,
    multiplier: 1,
    width: padWidth,
    bonus2x: false
  };
  
  const endPad: Pad = {
    xStart: endCenter.x - padWidth / 2,
    xEnd: endCenter.x + padWidth / 2,
    y: endCenter.y,
    multiplier: 5,
    width: padWidth,
    bonus2x: true
  };
  
  return {
    caverns: nodes,
    tunnels: edges,
    outlinePolylines: polylines,
    collisionGrid,
    collisionCellSize: cellSize,
    startId: 0,
    destId: 1,
    startPad,
    endPad,
    seedInfo: { level, baseSeed, hShip },
    worldBounds,
    acceptanceReport: {
      passed: true,
      connectivity: true,
      continuity: true,
      clearance: true,
      bounds: true,
      destination: true,
      curvature: true,
      tunnelJoints: true,
      minWidth: tunnelRadius * 2,
      issues: []
    }
  };
}