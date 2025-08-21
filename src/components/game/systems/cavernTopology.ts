import { Vec2, vec2, vec2Distance } from './sdf';

export interface CavernNode {
  id: number;
  center: Vec2;
  radius: number;
  connections: number[];
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
  
  // Calculate cavern radii based on level with much more variation
  const getRadius = () => {
    let baseRadius: number;
    const variation = rand();
    
    if (level <= 3) {
      // More variation: some very large caverns, some smaller
      if (variation < 0.2) {
        baseRadius = 300 + rand() * 100; // 20% chance for huge caverns (300-400)
      } else if (variation < 0.5) {
        baseRadius = 200 + rand() * 80; // 30% chance for large caverns (200-280) 
      } else {
        baseRadius = 140 + rand() * 60; // 50% chance for medium caverns (140-200)
      }
    } else if (level <= 9) {
      if (variation < 0.15) {
        baseRadius = 280 + rand() * 80; // 15% chance for huge caverns (280-360)
      } else if (variation < 0.4) {
        baseRadius = 180 + rand() * 70; // 25% chance for large caverns (180-250)
      } else {
        baseRadius = 120 + rand() * 60; // 60% chance for medium caverns (120-180)
      }
    } else {
      if (variation < 0.1) {
        baseRadius = 250 + rand() * 70; // 10% chance for huge caverns (250-320)
      } else if (variation < 0.3) {
        baseRadius = 160 + rand() * 60; // 20% chance for large caverns (160-220)
      } else {
        baseRadius = 100 + rand() * 50; // 70% chance for smaller caverns (100-150)
      }
    }
    return baseRadius;
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
      nodes.push({
        id: nodes.length,
        center,
        radius,
        connections: []
      });
    }
    
    attempt++;
  }
  
  // If we couldn't place enough nodes, use fallback positions
  if (nodes.length < 2) {
    nodes.length = 0;
    const fallbackRadius = 150;
    
    // Start node
    nodes.push({
      id: 0,
      center: vec2(fallbackRadius + 100, worldBounds.height / 2),
      radius: fallbackRadius,
      connections: []
    });
    
    // End node
    nodes.push({
      id: 1,
      center: vec2(worldBounds.width - fallbackRadius - 100, worldBounds.height / 2),
      radius: fallbackRadius,
      connections: []
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
  
  // Add elbows with vertical bias starting from level 5
  if (level >= 5) {
    const elbowChance = level >= 6 ? 0.7 : 0.5; // Higher chance for levels 6+
    if (rand() < elbowChance) {
      // Bias towards vertical tunnels from level 5+
      const dx = toNode.center.x - fromNode.center.x;
      const dy = toNode.center.y - fromNode.center.y;
      
      // Create vertical emphasis by making midpoint favor Y movement
      const verticalBias = level >= 5 ? 0.7 : 0.3; // Strong vertical bias from level 5
      const horizontalVariation = (rand() - 0.5) * 100; // Reduced horizontal variation
      const verticalVariation = (rand() - 0.5) * 300 * (rand() < verticalBias ? 2 : 0.5); // Favor vertical
      
      const midPoint = vec2(
        (fromNode.center.x + toNode.center.x) / 2 + horizontalVariation,
        (fromNode.center.y + toNode.center.y) / 2 + verticalVariation
      );
      path.splice(1, 0, midPoint);
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