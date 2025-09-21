// Demo AI for attract mode - pilots the lander with realistic patterns
export interface DemoAIState {
  level: number;
  startTime: number;
  thrustActive: boolean;
  thrustStartTime: number;
  thrustDuration: number; // 0.5 seconds
  mistakeTimer: number;
  shouldMakeMistake: boolean;
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
    thrustDuration: 500, // 0.5 seconds in milliseconds
    mistakeTimer: Math.random() * 8000 + 5000, // Make mistake after 5-13 seconds
    shouldMakeMistake: Math.random() < 0.3 // 30% chance to make a mistake
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
      // 0.5 seconds have passed, turn off thrust
      ai.thrustActive = false;
      console.log("🔥 Thrust off after 0.5s");
    } else {
      // Still within 0.5 second window, keep thrusting
      controls.thrust = true;
    }
  }
  
  // Check if too close to landscape and not already thrusting
  const dangerAltitude = -50; // 50 units above ground
  if (altitude > dangerAltitude && !ai.thrustActive) {
    // Start 0.5 second thrust burst
    ai.thrustActive = true;
    ai.thrustStartTime = now;
    controls.thrust = true;
    console.log("🚨 Too close to ground! Starting 0.5s thrust burst");
  }
  
  // Keep somewhat upright
  const angleDiff = ((ship.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (Math.abs(angleDiff) > 0.3) {
    if (angleDiff > 0) {
      controls.left = true;
    } else {
      controls.right = true;
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