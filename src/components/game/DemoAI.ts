// Demo AI for attract mode - pilots the lander with realistic patterns
export interface DemoAIState {
  level: number;
  startTime: number;
  phase: 'descending' | 'landing' | 'hovering' | 'crashed';
  lastThrust: number;
  thrustCooldown: number;
  targetPadIndex: number;
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
    phase: 'descending',
    lastThrust: 0,
    thrustCooldown: 0,
    targetPadIndex: 0,
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
  
  // Update timers
  ai.thrustCooldown = Math.max(0, ai.thrustCooldown - deltaTime);
  
  // Initialize controls
  const controls: DemoControls = { left: false, right: false, thrust: false };
  
  // Skip if too early - let intro/countdown finish
  if (elapsed < 3000) {
    return controls;
  }
  
  // Calculate altitude correctly (Y increases downward)
  const groundHeight = terrain.getHeightAt ? terrain.getHeightAt(ship.x) : 400;
  const altitude = ship.y - groundHeight; // Distance above ground (negative = above ground)
  
  console.log("🤖 AI Debug:", {
    shipY: ship.y.toFixed(1),
    groundHeight: groundHeight.toFixed(1), 
    altitude: altitude.toFixed(1),
    vy: ship.vy.toFixed(1),
    thrustCooldown: ai.thrustCooldown.toFixed(0)
  });
  
  // Emergency crash prevention - only thrust if really falling fast and close to ground
  if (altitude > -100 && ship.vy > 25 && ai.thrustCooldown === 0) {
    console.log("🚨 Emergency thrust - falling too fast!");
    controls.thrust = true;
    ai.thrustCooldown = 800; // 800ms cooldown
    return controls;
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
  
  // Gentle drift around occasionally
  if (elapsed % 6000 < 100) { // Every 6 seconds for 100ms
    // Drift left or right randomly
    if (Math.random() < 0.5) {
      controls.left = true;
    } else {
      controls.right = true;
    }
    
    // Light thrust to move horizontally
    if (Math.abs(ship.vx) < 30 && ai.thrustCooldown === 0) {
      controls.thrust = true;
      ai.thrustCooldown = 400;
      console.log("💨 Gentle drift");
    }
  }
  
  // Small mistakes occasionally
  if (ai.shouldMakeMistake && elapsed > ai.mistakeTimer && elapsed < ai.mistakeTimer + 200) {
    if (Math.random() < 0.1) {
      controls.left = !controls.left;
      controls.right = !controls.right;
      console.log("😅 Small mistake");
    }
  }
  
  return controls;
}