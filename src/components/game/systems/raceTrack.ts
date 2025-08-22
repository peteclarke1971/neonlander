import { 
  RaceTrack, 
  TrackSegment, 
  RaceGate, 
  TrackObstacle, 
  Vec3, 
  WireframeLine, 
  SpaceRaceDifficulty 
} from "../types/spaceracing";

// Simple PRNG for deterministic generation
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function generateTrack(seed: string, difficulty: SpaceRaceDifficulty): RaceTrack {
  const rng = mulberry32(hashString(seed));
  
  const trackLength = difficulty === "Easy" ? 3000 : difficulty === "Normal" ? 4000 : 5000;
  const segmentCount = difficulty === "Easy" ? 4 : difficulty === "Normal" ? 6 : 8;
  const gateSpacing = difficulty === "Easy" ? 200 : difficulty === "Normal" ? 150 : 120;
  
  // Generate centerline using Catmull-Rom spline
  const controlPoints: Vec3[] = [];
  const segmentLength = trackLength / segmentCount;
  
  // Start straight
  controlPoints.push({ x: 0, y: 0, z: 0 });
  controlPoints.push({ x: 0, y: 0, z: segmentLength * 0.25 });
  
  // Generate curved path
  let currentX = 0;
  let currentY = 0;
  let currentZ = segmentLength * 0.25;
  
  for (let i = 0; i < segmentCount - 1; i++) {
    const curvature = (rng() - 0.5) * 400; // ±200 units lateral
    const elevation = (rng() - 0.5) * 200; // ±100 units vertical
    
    currentX += curvature;
    currentY += elevation;
    currentZ += segmentLength;
    
    // Clamp to reasonable bounds
    currentX = Math.max(-800, Math.min(800, currentX));
    currentY = Math.max(-400, Math.min(400, currentY));
    
    controlPoints.push({ x: currentX, y: currentY, z: currentZ });
  }
  
  // End straight
  controlPoints.push({ x: currentX, y: currentY, z: trackLength });
  
  // Generate smooth centerline from control points
  const centerline: Vec3[] = [];
  const resolution = 50; // points per segment
  
  for (let i = 0; i < controlPoints.length - 1; i++) {
    for (let t = 0; t < resolution; t++) {
      const u = t / resolution;
      
      // Linear interpolation between control points (simplified)
      const p0 = controlPoints[i];
      const p1 = controlPoints[i + 1];
      
      centerline.push({
        x: p0.x + (p1.x - p0.x) * u,
        y: p0.y + (p1.y - p0.y) * u,
        z: p0.z + (p1.z - p0.z) * u
      });
    }
  }
  
  // Generate track segments
  const segments: TrackSegment[] = [];
  const segmentTypes = [
    "star-trench", "asteroid-belt", "ring-corridor", 
    "wormhole-tube", "satellite-slalom", "debris-chicane"
  ] as const;
  
  const pointsPerSegment = Math.floor(centerline.length / segmentCount);
  
  for (let i = 0; i < segmentCount; i++) {
    const segmentType = segmentTypes[Math.floor(rng() * segmentTypes.length)];
    const startIndex = i * pointsPerSegment;
    const endIndex = Math.min((i + 1) * pointsPerSegment, centerline.length - 1);
    
    const segment: TrackSegment = {
      type: segmentType,
      startIndex,
      endIndex,
      width: 100 + rng() * 100, // 100-200 unit wide corridor
      bankAngle: (rng() - 0.5) * 30, // ±15 degrees banking
      hazardDensity: difficulty === "Easy" ? rng() * 0.3 : difficulty === "Normal" ? rng() * 0.6 : rng() * 0.8,
      gateSpacing: gateSpacing + (rng() - 0.5) * 40,
      obstacles: []
    };
    
    // Generate obstacles for this segment
    segment.obstacles = generateSegmentObstacles(
      centerline.slice(startIndex, endIndex + 1),
      segment,
      rng
    );
    
    segments.push(segment);
  }
  
  // Generate gates along the track
  const gates: RaceGate[] = [];
  let gateId = 0;
  
  for (let z = gateSpacing; z < trackLength; z += gateSpacing + (rng() - 0.5) * 40) {
    // Find closest centerline point
    const gatePoint = centerline.find(p => p.z >= z) || centerline[centerline.length - 1];
    
    const gate: RaceGate = {
      id: `gate_${gateId++}`,
      position: { ...gatePoint },
      normal: { x: 0, y: 0, z: 1 }, // facing forward
      width: 80 + rng() * 40, // 80-120 units wide
      height: 60 + rng() * 30, // 60-90 units high
      passed: false,
      wireframe: generateGateWireframe(gatePoint, 80 + rng() * 40, 60 + rng() * 30)
    };
    
    gates.push(gate);
  }
  
  // Calculate world bounds
  const worldBounds = {
    minX: Math.min(...centerline.map(p => p.x)) - 200,
    maxX: Math.max(...centerline.map(p => p.x)) + 200,
    minY: Math.min(...centerline.map(p => p.y)) - 200,
    maxY: Math.max(...centerline.map(p => p.y)) + 200,
    minZ: 0,
    maxZ: trackLength
  };
  
  return {
    seed,
    centerline,
    segments,
    gates,
    worldBounds,
    length: trackLength
  };
}

function generateSegmentObstacles(
  segmentPath: Vec3[], 
  segment: TrackSegment, 
  rng: () => number
): TrackObstacle[] {
  const obstacles: TrackObstacle[] = [];
  
  // Generate walls/boundaries for the corridor
  for (let i = 0; i < segmentPath.length; i += 5) {
    const point = segmentPath[i];
    const width = segment.width;
    
    // Left and right walls
    const leftWall: TrackObstacle = {
      id: `wall_left_${i}`,
      type: "wall",
      position: { x: point.x - width/2, y: point.y, z: point.z },
      size: { x: 5, y: 40, z: 5 },
      wireframe: generateWallWireframe({ x: point.x - width/2, y: point.y, z: point.z })
    };
    
    const rightWall: TrackObstacle = {
      id: `wall_right_${i}`,
      type: "wall", 
      position: { x: point.x + width/2, y: point.y, z: point.z },
      size: { x: 5, y: 40, z: 5 },
      wireframe: generateWallWireframe({ x: point.x + width/2, y: point.y, z: point.z })
    };
    
    obstacles.push(leftWall, rightWall);
  }
  
  // Add segment-specific obstacles
  if (segment.type === "asteroid-belt" && rng() < segment.hazardDensity) {
    const asteroidCount = Math.floor(rng() * 8 + 2);
    for (let i = 0; i < asteroidCount; i++) {
      const pathIndex = Math.floor(rng() * segmentPath.length);
      const basePoint = segmentPath[pathIndex];
      
      obstacles.push({
        id: `asteroid_${i}_${pathIndex}`,
        type: "asteroid",
        position: {
          x: basePoint.x + (rng() - 0.5) * segment.width * 0.8,
          y: basePoint.y + (rng() - 0.5) * 60,
          z: basePoint.z
        },
        size: { x: 20, y: 20, z: 20 },
        rotation: { x: rng() * Math.PI * 2, y: rng() * Math.PI * 2, z: rng() * Math.PI * 2 },
        velocity: { 
          x: (rng() - 0.5) * 20, 
          y: (rng() - 0.5) * 20, 
          z: (rng() - 0.5) * 10 
        },
        wireframe: generateAsteroidWireframe({ x: 0, y: 0, z: 0 }, 20)
      });
    }
  }
  
  return obstacles;
}

function generateGateWireframe(position: Vec3, width: number, height: number): WireframeLine[] {
  const hw = width / 2;
  const hh = height / 2;
  
  // Octagonal gate
  const points: Vec3[] = [
    { x: position.x - hw, y: position.y, z: position.z },
    { x: position.x - hw * 0.7, y: position.y + hh, z: position.z },
    { x: position.x + hw * 0.7, y: position.y + hh, z: position.z },
    { x: position.x + hw, y: position.y, z: position.z },
    { x: position.x + hw * 0.7, y: position.y - hh, z: position.z },
    { x: position.x - hw * 0.7, y: position.y - hh, z: position.z }
  ];
  
  const lines: WireframeLine[] = [];
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    lines.push({
      start: points[i],
      end: points[next],
      color: "#00ffff",
      glow: true
    });
  }
  
  return lines;
}

function generateWallWireframe(position: Vec3): WireframeLine[] {
  return [{
    start: { x: position.x, y: position.y - 20, z: position.z },
    end: { x: position.x, y: position.y + 20, z: position.z },
    color: "#666666",
    glow: false
  }];
}

function generateAsteroidWireframe(center: Vec3, size: number): WireframeLine[] {
  const lines: WireframeLine[] = [];
  const points = 8;
  const radius = size / 2;
  
  // Generate irregular asteroid shape
  for (let i = 0; i < points; i++) {
    const angle1 = (i / points) * Math.PI * 2;
    const angle2 = ((i + 1) / points) * Math.PI * 2;
    
    const r1 = radius * (0.7 + Math.random() * 0.6); // Irregular radius
    const r2 = radius * (0.7 + Math.random() * 0.6);
    
    const p1 = {
      x: center.x + Math.cos(angle1) * r1,
      y: center.y + Math.sin(angle1) * r1,
      z: center.z
    };
    
    const p2 = {
      x: center.x + Math.cos(angle2) * r2,
      y: center.y + Math.sin(angle2) * r2,
      z: center.z
    };
    
    lines.push({
      start: p1,
      end: p2,
      color: "#888888",
      glow: false
    });
  }
  
  return lines;
}