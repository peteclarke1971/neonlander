import { 
  RaceAI, 
  SpaceShip, 
  RaceTrack, 
  Vec3, 
  SpaceRaceDifficulty 
} from "../types/spaceracing";

// AI state tracking
const aiStates = new Map<string, {
  lastDecisionTime: number;
  targetPoint: Vec3;
  lookAheadDistance: number;
  aggressiveness: number;
  errorNoise: number;
  reactionDelay: number;
}>();

export function createAI(ship: SpaceShip, difficulty: SpaceRaceDifficulty): RaceAI {
  let aggressiveness: number;
  let errorNoise: number;
  let reactionDelay: number;
  
  switch (difficulty) {
    case "Easy":
      aggressiveness = 0.3 + Math.random() * 0.3; // 0.3-0.6
      errorNoise = 0.4 + Math.random() * 0.3; // 0.4-0.7
      reactionDelay = 0.3 + Math.random() * 0.4; // 0.3-0.7s
      break;
    case "Normal":
      aggressiveness = 0.5 + Math.random() * 0.3; // 0.5-0.8
      errorNoise = 0.2 + Math.random() * 0.3; // 0.2-0.5
      reactionDelay = 0.1 + Math.random() * 0.3; // 0.1-0.4s
      break;
    case "Hard":
      aggressiveness = 0.7 + Math.random() * 0.3; // 0.7-1.0
      errorNoise = 0.1 + Math.random() * 0.2; // 0.1-0.3
      reactionDelay = 0.05 + Math.random() * 0.15; // 0.05-0.2s
      break;
  }
  
  const lookAheadDistance = 100 + aggressiveness * 100; // 100-200 units
  
  const aiData = {
    lastDecisionTime: 0,
    targetPoint: { ...ship.position },
    lookAheadDistance,
    aggressiveness,
    errorNoise,
    reactionDelay
  };
  
  aiStates.set(ship.id, aiData);
  
  return {
    ship,
    targetPoint: aiData.targetPoint,
    lookAheadDistance: aiData.lookAheadDistance,
    aggressiveness: aiData.aggressiveness,
    errorNoise: aiData.errorNoise,
    reactionDelay: aiData.reactionDelay,
    lastDecisionTime: 0
  };
}

export function updateAI(
  ai: RaceAI, 
  track: RaceTrack, 
  allShips: SpaceShip[], 
  deltaTime: number
): void {
  const now = performance.now() / 1000; // Convert to seconds
  const aiData = aiStates.get(ai.ship.id);
  
  if (!aiData || !ai.ship.alive) return;
  
  // Check if enough time has passed for next decision
  if (now - aiData.lastDecisionTime < aiData.reactionDelay) {
    return;
  }
  
  // Update target point along track centerline
  const lookAheadZ = ai.ship.position.z + aiData.lookAheadDistance;
  const targetPoint = findTrackPoint(track, lookAheadZ);
  
  if (targetPoint) {
    // Add error/noise to make AI imperfect
    const errorX = (Math.random() - 0.5) * aiData.errorNoise * 50;
    const errorY = (Math.random() - 0.5) * aiData.errorNoise * 30;
    
    aiData.targetPoint = {
      x: targetPoint.x + errorX,
      y: targetPoint.y + errorY,
      z: targetPoint.z
    };
  }
  
  // Basic obstacle avoidance
  const avoidanceForce = calculateAvoidanceForce(ai.ship, allShips, track);
  
  // Apply steering towards target with avoidance
  const steering = calculateSteering(ai.ship, aiData.targetPoint, avoidanceForce);
  applyAISteering(ai.ship, steering, deltaTime, aiData.aggressiveness);
  
  aiData.lastDecisionTime = now;
}

function findTrackPoint(track: RaceTrack, targetZ: number): Vec3 | null {
  // Find the closest centerline point at or beyond targetZ
  for (let i = 0; i < track.centerline.length; i++) {
    const point = track.centerline[i];
    if (point.z >= targetZ) {
      return point;
    }
  }
  
  // If beyond track, return last point
  return track.centerline[track.centerline.length - 1] || null;
}

function calculateAvoidanceForce(
  ship: SpaceShip, 
  allShips: SpaceShip[], 
  track: RaceTrack
): Vec3 {
  const avoidance: Vec3 = { x: 0, y: 0, z: 0 };
  const avoidanceRadius = 40;
  
  // Avoid other ships
  for (const otherShip of allShips) {
    if (otherShip.id === ship.id || !otherShip.alive) continue;
    
    const dx = otherShip.position.x - ship.position.x;
    const dy = otherShip.position.y - ship.position.y;
    const dz = otherShip.position.z - ship.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance < avoidanceRadius && distance > 0) {
      const strength = (avoidanceRadius - distance) / avoidanceRadius;
      avoidance.x -= (dx / distance) * strength * 100;
      avoidance.y -= (dy / distance) * strength * 100;
    }
  }
  
  // Avoid track obstacles (simplified)
  for (const segment of track.segments) {
    for (const obstacle of segment.obstacles) {
      if (obstacle.type === "wall" || obstacle.type === "asteroid") {
        const dx = obstacle.position.x - ship.position.x;
        const dy = obstacle.position.y - ship.position.y;
        const dz = obstacle.position.z - ship.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        const obstacleRadius = Math.max(obstacle.size.x, obstacle.size.y, obstacle.size.z) / 2 + 15;
        
        if (distance < obstacleRadius && distance > 0) {
          const strength = (obstacleRadius - distance) / obstacleRadius;
          avoidance.x -= (dx / distance) * strength * 150;
          avoidance.y -= (dy / distance) * strength * 150;
        }
      }
    }
  }
  
  return avoidance;
}

function calculateSteering(
  ship: SpaceShip, 
  targetPoint: Vec3, 
  avoidanceForce: Vec3
): Vec3 {
  // Direction to target
  const dx = targetPoint.x - ship.position.x;
  const dy = targetPoint.y - ship.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  const steering: Vec3 = { x: 0, y: 0, z: 0 };
  
  if (distance > 5) { // Dead zone to prevent oscillation
    steering.x = (dx / distance) * 100; // Base steering force
    steering.y = (dy / distance) * 100;
  }
  
  // Add avoidance force
  steering.x += avoidanceForce.x;
  steering.y += avoidanceForce.y;
  
  return steering;
}

function applyAISteering(
  ship: SpaceShip, 
  steering: Vec3, 
  deltaTime: number, 
  aggressiveness: number
): void {
  const responsiveness = 800 * aggressiveness; // How quickly AI responds
  
  // Apply lateral forces (strafe)
  ship.velocity.x += steering.x * deltaTime * responsiveness * 0.01;
  ship.velocity.y += steering.y * deltaTime * responsiveness * 0.01;
  
  // Speed control - aggressive AI goes faster
  const targetSpeed = ship.baseSpeed * (0.9 + aggressiveness * 0.2);
  if (ship.speed < targetSpeed) {
    ship.speed = Math.min(targetSpeed, ship.speed + 400 * deltaTime);
  } else if (ship.speed > targetSpeed) {
    ship.speed = Math.max(targetSpeed, ship.speed - 200 * deltaTime);
  }
  
  // Rotation towards movement direction (simplified)
  if (Math.abs(steering.x) > 10) {
    const targetYaw = Math.atan2(steering.x, 100) * 0.3; // Gentle turning
    ship.rotation.y += (targetYaw - ship.rotation.y) * deltaTime * 3;
  }
  
  // Use boost occasionally when aggressive
  if (aggressiveness > 0.7 && Math.random() < 0.02 && ship.boostMeter > 1) {
    ship.speed = Math.min(ship.maxSpeed, ship.speed + 200);
    ship.boostMeter -= 1;
  }
}

export function cleanupAI(shipId: string): void {
  aiStates.delete(shipId);
}