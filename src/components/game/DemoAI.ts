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
  
  // Check if we should make a mistake
  if (ai.shouldMakeMistake && elapsed > ai.mistakeTimer && ai.phase === 'descending') {
    // Make a mistake - either over-thrust or poor rotation
    if (Math.random() < 0.5) {
      // Over-thrust mistake
      controls.thrust = true;
    } else {
      // Poor rotation - spin randomly
      controls.left = Math.random() < 0.5;
      controls.right = !controls.left;
    }
    
    // Only make mistake for a short time
    if (elapsed > ai.mistakeTimer + 2000) {
      ai.shouldMakeMistake = false;
    }
    
    return controls;
  }
  
  // Get target landing pad
  if (terrain.pads.length === 0) {
    return controls; // No pads to land on
  }
  
  const targetPad = terrain.pads[ai.targetPadIndex % terrain.pads.length];
  const padCenterX = (targetPad.xStart + targetPad.xEnd) / 2;
  const padY = targetPad.y;
  
  // Calculate distances and velocities
  const distanceX = padCenterX - ship.x;
  const distanceY = padY - ship.y;
  const altitude = ship.y - terrain.getHeightAt(ship.x);
  
  // Different behavior based on level
  let aggressiveness = 1.0;
  let precision = 1.0;
  
  switch (ai.level) {
    case 1:
      // Level 1: Very conservative, smooth landings
      aggressiveness = 0.6;
      precision = 0.8;
      break;
    case 5:
      // Level 5: More confident, show off moving pads
      aggressiveness = 0.8;
      precision = 0.9;
      break;
    case 20:
      // Level 20: Skilled, navigate complex terrain
      aggressiveness = 0.9;
      precision = 0.95;
      break;
    case 50:
      // Level 50: Expert level, show advanced techniques
      aggressiveness = 1.0;
      precision = 0.98;
      break;
  }
  
  // Rotation control
  const targetAngle = 0; // Want to be upright
  const angleDiff = ((ship.angle - targetAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
  
  if (Math.abs(angleDiff) > 0.1 * precision) {
    if (angleDiff > 0) {
      controls.left = true;
    } else {
      controls.right = true;
    }
  }
  
  // Thrust control based on phase
  if (ai.phase === 'descending') {
    // Check if we're getting close to landing
    if (altitude < 100 && Math.abs(distanceX) < 200) {
      ai.phase = 'landing';
    }
    
    // Gentle descent control
    if (ship.vy > 50 * aggressiveness) { // Falling too fast
      if (ai.thrustCooldown <= 0) {
        controls.thrust = true;
        ai.thrustCooldown = 200 + Math.random() * 300; // Vary thrust timing
      }
    }
    
    // Horizontal positioning
    if (Math.abs(distanceX) > 100 && altitude > 200) {
      // Move towards target pad
      if (Math.abs(ship.vx) < 80 * aggressiveness) {
        if (distanceX > 0 && ship.angle < Math.PI / 6) {
          controls.thrust = ship.angle > -Math.PI / 6;
        } else if (distanceX < 0 && ship.angle > -Math.PI / 6) {
          controls.thrust = ship.angle < Math.PI / 6;
        }
      }
    }
  } else if (ai.phase === 'landing') {
    // Precision landing phase
    const landingThreshold = 30 + (20 * (1 - precision));
    
    if (altitude < landingThreshold) {
      // Very close to ground - be very careful
      if (ship.vy > 20) {
        controls.thrust = true;
      }
      
      // Fine horizontal adjustment
      if (Math.abs(distanceX) > 10) {
        if (Math.abs(ship.vx) < 30) {
          const thrustAngle = distanceX > 0 ? Math.PI / 8 : -Math.PI / 8;
          if (Math.abs(ship.angle - thrustAngle) < Math.PI / 6) {
            controls.thrust = true;
          }
        }
      }
    } else {
      // Approaching landing - moderate thrust
      if (ship.vy > 40 * aggressiveness) {
        controls.thrust = true;
      }
    }
    
    // Check if we've landed or crashed
    if (altitude < 5) {
      const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      if (speed < 50 && Math.abs(ship.angle) < Math.PI / 4) {
        ai.phase = 'hovering';
        ai.lastThrust = now + 1000; // Hover for a second
      } else {
        ai.phase = 'crashed';
      }
    }
  } else if (ai.phase === 'hovering') {
    // Gentle hover after landing
    if (now < ai.lastThrust) {
      if (ship.vy > 10) {
        controls.thrust = true;
      }
    }
  }
  
  // Add some random variation to make it look more human
  if (Math.random() < 0.05) { // 5% chance each frame
    if (Math.random() < 0.5) {
      controls.thrust = !controls.thrust;
    }
  }
  
  return controls;
}