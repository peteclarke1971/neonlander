// Demo AI for attract mode - pilots the lander with realistic patterns
export interface DemoAIState {
  level: number;
  startTime: number;
  thrustActive: boolean;
  thrustStartTime: number;
  thrustDuration: number; // 0.5 seconds
  mistakeTimer: number;
  shouldMakeMistake: boolean;
  avoidanceRotation: number; // target rotation when avoiding terrain
  isAvoiding: boolean; // currently in avoidance maneuver
}

export interface DemoControls {
  left: boolean;
  right: boolean;
  thrust: boolean;
}

interface TerrainLike {
  pads: Array<{ xStart: number; xEnd: number; y: number }>;
  worldWidth: number;
  getHeightAt: (x: number) => number;
}

export function createDemoAI(level: number): DemoAIState {
  return {
    level,
    startTime: performance.now(),
    thrustActive: false,
    thrustStartTime: 0,
    thrustDuration: 50, // 0.05 seconds in milliseconds - half the previous burst
    mistakeTimer: Math.random() * 8000 + 5000, // Make mistake after 5-13 seconds
    shouldMakeMistake: Math.random() < 0.3, // 30% chance to make a mistake
    avoidanceRotation: 0,
    isAvoiding: false
  };
}

export function updateDemoAI(
  ai: DemoAIState,
  ship: { x: number; y: number; vx: number; vy: number; angle: number; fuel: number },
  terrain: TerrainLike,
  deltaTime: number
): DemoControls {
  const now = performance.now();
  const elapsed = now - ai.startTime;
  
  // Initialize controls
  const controls: DemoControls = { left: false, right: false, thrust: false };
  
  // Skip if too early - let intro/countdown finish
  if (elapsed < 3000) {
    return controls;
  }
  
  // Calculate altitude correctly (Y increases downward)
  const groundHeight = terrain.getHeightAt ? terrain.getHeightAt(ship.x) : 400;
  const altitude = ship.y - groundHeight; // Distance above ground (negative = above ground)
  
  // Check if thrust is currently active
  if (ai.thrustActive) {
    if (now - ai.thrustStartTime >= ai.thrustDuration) {
      // 0.1 seconds have passed, turn off thrust and stop avoidance
      ai.thrustActive = false;
      ai.isAvoiding = false;
      console.log("🔥 Thrust off after 0.05s");
    } else {
      // Still within 0.5 second window, keep thrusting
      controls.thrust = true;
    }
  }
  
  // Check if too close to landscape and not already avoiding
  const dangerAltitude = -300; // 300 units above ground (trigger very early)
  if (altitude > dangerAltitude && !ai.thrustActive && !ai.isAvoiding) {
    // Start avoidance maneuver: random direction and angle between 30-60 degrees
    const rotationDirection = Math.random() < 0.5 ? -1 : 1;
    const randomAngle = 30 + Math.random() * 30; // Random angle between 30-60 degrees
    ai.avoidanceRotation = rotationDirection * (randomAngle * Math.PI / 180);
    ai.isAvoiding = true;
    console.log(`🚨 Too close to ground! Starting avoidance: ${rotationDirection > 0 ? 'right' : 'left'} rotation then thrust`);
  }
  
  // Handle avoidance rotation when avoiding terrain
  if (ai.isAvoiding) {
    const currentAngle = ((ship.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
    const targetAngle = ai.avoidanceRotation;
    const angleDiff = targetAngle - currentAngle;
    
    // Apply rotation towards target - this makes the lander visibly rotate
    if (Math.abs(angleDiff) > 0.1) {
      if (angleDiff > 0) {
        controls.right = true;
      } else {
        controls.left = true;
      }
    }
    
    // Start thrust after small initial rotation (when we've rotated at least 10 degrees)
    const rotatedAmount = Math.abs(targetAngle - angleDiff);
    if (rotatedAmount > (10 * Math.PI / 180) && !ai.thrustActive) {
      ai.thrustActive = true;
      ai.thrustStartTime = now;
      console.log("🔥 Started thrust after initial rotation");
    }
  } else {
    // Keep somewhat upright when not avoiding
    const angleDiff = ((ship.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
    if (Math.abs(angleDiff) > 0.3) {
      if (angleDiff > 0) {
        controls.left = true;
      } else {
        controls.right = true;
      }
    }
  }
  
  // Gentle horizontal drift occasionally  
  if (elapsed % 8000 < 100) { // Every 8 seconds for 100ms
    if (Math.random() < 0.5) {
      controls.left = true;
    } else {
      controls.right = true;
    }
  }
  
  // Small mistakes occasionally
  if (ai.shouldMakeMistake && elapsed > ai.mistakeTimer && elapsed < ai.mistakeTimer + 200) {
    if (Math.random() < 0.1) {
      controls.left = !controls.left;
      controls.right = !controls.right;
    }
  }
  
  return controls;
}