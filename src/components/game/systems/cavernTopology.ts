import { Vec2, vec2, vec2Distance, CavernShape } from './sdf';
import { selectShapeType, generateShapeParams, getInscribedRadius, validateShapeParams, degradeShape } from './cavernShapes';

export interface CavernNode {
  id: number;
  center: Vec2;
  radius: number; // bounding radius for legacy compatibility
  connections: number[];
  // Enhanced shape data
  shapeType: import('./sdf').CavernShape;
  shapeParams: import('./sdf').ShapeParams;
  inscribedRadius: number; // for tunnel attachment validation
}

export interface TunnelEdge {
  from: number;
  to: number;
  path: Vec2[];
  radiusProfile: number[];
  length: number;
}

export interface CavernGraph {
  nodes: CavernNode[];
  edges: TunnelEdge[];
  startId: number;
  destId: number;
}

// Simple seeded PRNG
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCavernTopology(
  level: number,
  hShip: number,
  worldBounds: { width: number; height: number },
  baseSeed: number
): CavernGraph {
  // Create level-specific seed
  const levelSeed = baseSeed ^ (level * 0x9e3779b9) ^ 0x12345678;
  const rand = mulberry32(levelSeed);
  
  // Determine number of caverns based on level
  let cavernCount: number;
  if (level <= 3) {
    cavernCount = 2 + Math.floor(rand() * 2); // 2-3 caverns
  } else if (level <= 9) {
    cavernCount = 3 + Math.floor(rand() * 4); // 3-6 caverns
  } else {
    cavernCount = 5 + Math.floor(rand() * 5); // 5-9 caverns
  }
  
  // Progressive scaling - 4x growth from level 0 to 49 (was 8x)
  const scaleMultiplier = 0.5 + (level / 49) * 3.5; // 0.5x to 4x scaling (halved from original)
  
  // Calculate cavern radii with progressive scaling and shape-aware sizing
  const getRadius = () => {
    let baseRadius: number;
    const variation = rand();
    
    if (level <= 9) {
      // Early levels: consistent medium-large caverns
      if (variation < 0.3) {
        baseRadius = (160 + rand() * 80) * scaleMultiplier; // Large caverns
      } else {
        baseRadius = (100 + rand() * 60) * scaleMultiplier; // Medium caverns
      }
    } else if (level <= 19) {
      // Mid levels: more variation with complex shapes
      if (variation < 0.2) {
        baseRadius = (200 + rand() * 100) * scaleMultiplier; // Huge caverns
      } else if (variation < 0.5) {
        baseRadius = (130 + rand() * 70) * scaleMultiplier; // Large caverns
      } else {
        baseRadius = (80 + rand() * 50) * scaleMultiplier; // Medium caverns
      }
    } else {
      // Advanced levels: extreme variation for complex layouts
      if (variation < 0.15) {
        baseRadius = (250 + rand() * 150) * scaleMultiplier; // Massive caverns
      } else if (variation < 0.4) {
        baseRadius = (150 + rand() * 100) * scaleMultiplier; // Large caverns
      } else {
        baseRadius = (60 + rand() * 80) * scaleMultiplier; // Variable caverns
      }
    }
    
    // Ensure minimum size for ship navigation
    return Math.max(baseRadius, hShip * 4 * Math.sqrt(scaleMultiplier));
  };
  
  const nodes: CavernNode[] = [];
  const edges: TunnelEdge[] = [];
  
  // Generate nodes with non-overlapping placement
  const attempts = 100;
  let attempt = 0;
  
  while (nodes.length < cavernCount && attempt < attempts) {
    const radius = getRadius();
    const margin = radius + 100; // Safety margin
    
    const center: Vec2 = {
      x: margin + rand() * (worldBounds.width - 2 * margin),
      y: margin + rand() * (worldBounds.height - 2 * margin)
    };
    
    // Check for overlaps with existing nodes
    let overlaps = false;
    for (const existing of nodes) {
      const distance = vec2Distance(center, existing.center);
      const minDistance = radius + existing.radius + 50; // Minimum separation
      if (distance < minDistance) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      // Generate shape for this cavern
      const shapeSeed = levelSeed ^ (nodes.length * 0x87654321);
      const shapeType = selectShapeType(level, shapeSeed);
      let shapeParams = generateShapeParams(shapeType, center, radius, level, shapeSeed, hShip);
      let currentShapeType = shapeType;
      
      // Validate and potentially degrade shape
      let attempts = 0;
      while (!validateShapeParams(currentShapeType, shapeParams, hShip) && attempts < 3) {
        const degraded = degradeShape(currentShapeType, shapeParams);
        currentShapeType = degraded.shapeType;
        shapeParams = degraded.params;
        attempts++;
      }
      
      const inscribedRadius = getInscribedRadius(currentShapeType, shapeParams);
      
      nodes.push({
        id: nodes.length,
        center,
        radius,
        connections: [],
        shapeType: currentShapeType,
        shapeParams,
        inscribedRadius
      });
    }
    
    attempt++;
  }
  
  // If we couldn't place enough nodes, use fallback positions
  if (nodes.length < 2) {
    nodes.length = 0;
    const fallbackRadius = 150;
    
    // Start node
    const startCenter = vec2(fallbackRadius + 100, worldBounds.height / 2);
    const startShapeParams = generateShapeParams(CavernShape.Ellipse, startCenter, fallbackRadius, level, levelSeed, hShip);
    nodes.push({
      id: 0,
      center: startCenter,
      radius: fallbackRadius,
      connections: [],
      shapeType: CavernShape.Ellipse,
      shapeParams: startShapeParams,
      inscribedRadius: getInscribedRadius(CavernShape.Ellipse, startShapeParams)
    });
    
    // End node
    const endCenter = vec2(worldBounds.width - fallbackRadius - 100, worldBounds.height / 2);
    const endShapeParams = generateShapeParams(CavernShape.Ellipse, endCenter, fallbackRadius, level, levelSeed ^ 0x12345678, hShip);
    nodes.push({
      id: 1,
      center: endCenter,
      radius: fallbackRadius,
      connections: [],
      shapeType: CavernShape.Ellipse,
      shapeParams: endShapeParams,
      inscribedRadius: getInscribedRadius(CavernShape.Ellipse, endShapeParams)
    });
  }
  
  // Generate connectivity - ensure connected graph
  const connected = new Set<number>();
  connected.add(0); // Start with first node
  
  while (connected.size < nodes.length) {
    // Find closest unconnected node to any connected node
    let bestFrom = -1;
    let bestTo = -1;
    let bestDistance = Infinity;
    
    for (const fromId of connected) {
      for (let toId = 0; toId < nodes.length; toId++) {
        if (!connected.has(toId)) {
          const distance = vec2Distance(nodes[fromId].center, nodes[toId].center);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestFrom = fromId;
            bestTo = toId;
          }
        }
      }
    }
    
    if (bestFrom >= 0 && bestTo >= 0) {
      // Create edge
      const edge = createTunnel(nodes[bestFrom], nodes[bestTo], level, hShip, rand);
      edges.push(edge);
      
      // Update connections
      nodes[bestFrom].connections.push(bestTo);
      nodes[bestTo].connections.push(bestFrom);
      connected.add(bestTo);
    } else {
      break; // Safety break
    }
  }
  
  // Add some additional edges for higher levels (but avoid cycles for now)
  if (level > 6 && nodes.length > 3) {
    const additionalEdges = Math.min(2, Math.floor((level - 6) / 3));
    for (let i = 0; i < additionalEdges; i++) {
      const fromId = Math.floor(rand() * nodes.length);
      const toId = Math.floor(rand() * nodes.length);
      
      if (fromId !== toId && !nodes[fromId].connections.includes(toId)) {
        const edge = createTunnel(nodes[fromId], nodes[toId], level, hShip, rand);
        edges.push(edge);
        nodes[fromId].connections.push(toId);
        nodes[toId].connections.push(fromId);
      }
    }
  }
  
  // Find start and destination nodes
  const startId = 0;
  const destId = findFarthestNode(nodes, startId);
  
  return {
    nodes,
    edges,
    startId,
    destId
  };
}

function createTunnel(
  fromNode: CavernNode,
  toNode: CavernNode,
  level: number,
  hShip: number,
  rand: () => number
): TunnelEdge {
  const path: Vec2[] = [fromNode.center, toNode.center];
  
  // Add elbows with strong vertical bias starting from level 5
  if (level >= 5) {
    const elbowChance = level >= 6 ? 0.85 : 0.75; // Much higher chance for levels 5+
    if (rand() < elbowChance) {
      // Strong bias towards vertical tunnels from level 5+
      const dx = toNode.center.x - fromNode.center.x;
      const dy = toNode.center.y - fromNode.center.y;
      
      // Create strong vertical emphasis with multiple midpoints for more vertical tunnels
      const verticalBias = level >= 5 ? 0.9 : 0.3; // Very strong vertical bias from level 5
      const horizontalVariation = (rand() - 0.5) * 60; // Much reduced horizontal variation
      const verticalVariation = (rand() - 0.5) * 400 * (rand() < verticalBias ? 3 : 0.3); // Heavily favor vertical
      
      // Add primary vertical midpoint
      const midPoint = vec2(
        (fromNode.center.x + toNode.center.x) / 2 + horizontalVariation,
        (fromNode.center.y + toNode.center.y) / 2 + verticalVariation
      );
      path.splice(1, 0, midPoint);
      
      // For levels 6+, occasionally add a second midpoint for more complex vertical paths
      if (level >= 6 && rand() < 0.4) {
        const secondVerticalVariation = (rand() - 0.5) * 350 * (rand() < 0.8 ? 2.5 : 0.2);
        const secondMidPoint = vec2(
          (fromNode.center.x + midPoint.x) / 2 + (rand() - 0.5) * 40,
          (fromNode.center.y + midPoint.y) / 2 + secondVerticalVariation
        );
        path.splice(1, 0, secondMidPoint);
      }
    }
  }
  
  // Calculate radius profile
  const minRadius = Math.max(1.5 * hShip, 20);
  let baseRadius: number;
  
  // Much wider starting tunnels with gradual difficulty progression
  if (level <= 2) {
    baseRadius = 4.0 * hShip + rand() * 1.0 * hShip; // 4.0-5.0 * hShip (very wide)
  } else if (level <= 5) {
    baseRadius = 3.2 * hShip + rand() * 0.8 * hShip; // 3.2-4.0 * hShip (wide)
  } else if (level <= 10) {
    baseRadius = 2.4 * hShip + rand() * 0.8 * hShip; // 2.4-3.2 * hShip (moderate)
  } else if (level <= 15) {
    baseRadius = 2.0 * hShip + rand() * 0.6 * hShip; // 2.0-2.6 * hShip (narrow)
  } else {
    baseRadius = 1.8 * hShip + rand() * 0.4 * hShip; // 1.8-2.2 * hShip (very narrow)
  }
  
  baseRadius = Math.max(baseRadius, minRadius);
  
  const radiusProfile: number[] = [];
  const segments = path.length - 1;
  const totalSegments = segments * 10; // 10 points per segment
  
  for (let i = 0; i <= totalSegments; i++) {
    let radius = baseRadius;
    
    // Add constrictions for higher levels
    const constrictionCount = Math.min(2, Math.floor((level - 5) / 3));
    for (let c = 0; c < constrictionCount; c++) {
      const constrictionPos = (c + 1) / (constrictionCount + 1);
      const t = i / totalSegments;
      const dist = Math.abs(t - constrictionPos);
      const influence = Math.max(0, 1 - dist * 8);
      radius = Math.min(radius, minRadius + (baseRadius - minRadius) * (1 - influence * 0.5));
    }
    
    radiusProfile.push(Math.max(radius, minRadius));
  }
  
  const length = vec2Distance(fromNode.center, toNode.center);
  
  return {
    from: fromNode.id,
    to: toNode.id,
    path,
    radiusProfile,
    length
  };
}

function findFarthestNode(nodes: CavernNode[], startId: number): number {
  // Simple BFS to find graph distances
  const distances = new Map<number, number>();
  const queue = [startId];
  distances.set(startId, 0);
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentDist = distances.get(currentId)!;
    
    for (const neighborId of nodes[currentId].connections) {
      if (!distances.has(neighborId)) {
        distances.set(neighborId, currentDist + 1);
        queue.push(neighborId);
      }
    }
  }
  
  // Find node with maximum graph distance, break ties with Euclidean distance
  let bestId = startId;
  let bestGraphDist = 0;
  let bestEuclideanDist = 0;
  
  for (const [nodeId, graphDist] of distances) {
    const euclideanDist = vec2Distance(nodes[startId].center, nodes[nodeId].center);
    
    if (graphDist > bestGraphDist || 
        (graphDist === bestGraphDist && euclideanDist > bestEuclideanDist)) {
      bestId = nodeId;
      bestGraphDist = graphDist;
      bestEuclideanDist = euclideanDist;
    }
  }
  
  return bestId;
}