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
  
  // Debug logging
  console.log("🤖 Demo AI State:", {
    ship: { x: ship.x.toFixed(1), y: ship.y.toFixed(1), vx: ship.vx.toFixed(1), vy: ship.vy.toFixed(1), angle: ship.angle.toFixed(2) },
    phase: ai.phase,
    elapsed: elapsed.toFixed(0),
    pads: terrain.pads.length
  });
  
  // EMERGENCY CRASH PREVENTION - First priority!
  const groundHeight = terrain.getHeightAt ? terrain.getHeightAt(ship.x) : 400; // Fallback if no terrain
  const altitude = groundHeight - ship.y; // Altitude = ground height - ship Y (Y increases downward)
  
  console.log("🤖 Emergency Check:", {
    groundHeight: groundHeight.toFixed(1),
    shipY: ship.y.toFixed(1),
    altitude: altitude.toFixed(1),
    vy: ship.vy.toFixed(1)
  });
  
  // Emergency thrust if falling too fast or too close to ground
  if (altitude < 150 && ship.vy > 30) {
    console.log("🚨 EMERGENCY THRUST - Too fast, too low!");
    controls.thrust = true;
    return controls; // Override everything else
  }
  
  // General "don't fall too fast" control
  if (ship.vy > 60) {
    console.log("🚨 SPEED CONTROL - Falling too fast!");
    controls.thrust = true;
  }
  
  // Basic rotation control - keep upright
  const targetAngle = 0;
  const angleDiff = ((ship.angle - targetAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
  
  if (Math.abs(angleDiff) > 0.2) {
    if (angleDiff > 0) {
      controls.left = true;
    } else {
      controls.right = true;
    }
    console.log("🔄 Rotating to upright, angle:", ship.angle.toFixed(2));
  }
  
  // Skip complex logic if too early or no terrain data
  if (elapsed < 2000 || terrain.pads.length === 0) {
    console.log("⏳ Too early or no pads, basic controls only");
    return controls;
  }
  
  // Get target landing pad
  const targetPad = terrain.pads[ai.targetPadIndex % terrain.pads.length];
  const padCenterX = (targetPad.xStart + targetPad.xEnd) / 2;
  const padY = targetPad.y;
  
  // Calculate distances
  const distanceX = padCenterX - ship.x;
  const padAltitude = groundHeight - padY; // How high the pad is
  
  console.log("🎯 Target:", {
    padCenter: padCenterX.toFixed(1),
    padY: padY.toFixed(1),
    distanceX: distanceX.toFixed(1),
    padAltitude: padAltitude.toFixed(1)
  });
  
  // Different behavior based on level (simpler)
  let maxSpeed = 40; // Conservative falling speed
  let landingSpeed = 25; // Even slower for landing
  
  switch (ai.level) {
    case 1:
      maxSpeed = 35;
      landingSpeed = 20;
      break;
    case 5:
      maxSpeed = 45;
      landingSpeed = 25;
      break;
    case 20:
      maxSpeed = 50;
      landingSpeed = 30;
      break;
    case 50:
      maxSpeed = 55;
      landingSpeed = 35;
      break;
  }
  
  // Phase management
  if (ai.phase === 'descending') {
    // Check if we're getting close to landing area
    if (altitude < 200 && Math.abs(distanceX) < 300) {
      ai.phase = 'landing';
      console.log("🛬 Switching to landing phase");
    }
    
    // Descent speed control
    if (ship.vy > maxSpeed) {
      controls.thrust = true;
      console.log("⬇️ Controlling descent speed");
    }
    
    // Rough horizontal positioning (only if not too close to ground)
    if (altitude > 150 && Math.abs(distanceX) > 200) {
      if (Math.abs(ship.vx) < 60) {
        // Tilt slightly toward target and thrust
        const desiredTilt = distanceX > 0 ? Math.PI / 8 : -Math.PI / 8;
        if (Math.abs(ship.angle - desiredTilt) < Math.PI / 4) {
          controls.thrust = true;
          console.log("➡️ Moving toward pad");
        }
      }
    }
  } else if (ai.phase === 'landing') {
    // Precision landing phase
    if (ship.vy > landingSpeed) {
      controls.thrust = true;
      console.log("🛬 Landing speed control");
    }
    
    // Fine horizontal adjustment
    if (altitude > 50 && Math.abs(distanceX) > 50 && Math.abs(ship.vx) < 40) {
      const desiredTilt = distanceX > 0 ? Math.PI / 12 : -Math.PI / 12;
      if (Math.abs(ship.angle - desiredTilt) < Math.PI / 6) {
        controls.thrust = true;
        console.log("↔️ Fine positioning");
      }
    }
    
    // Check if we've landed successfully
    if (altitude < 20) {
      const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      if (speed < 40 && Math.abs(ship.angle) < Math.PI / 3) {
        ai.phase = 'hovering';
        ai.lastThrust = now + 1500; // Hover longer
        console.log("🎉 Successful landing!");
      } else if (speed > 80) {
        ai.phase = 'crashed';
        console.log("💥 Crash detected");
      }
    }
  } else if (ai.phase === 'hovering') {
    // Gentle hover after landing
    if (now < ai.lastThrust && ship.vy > 15) {
      controls.thrust = true;
      console.log("🚁 Hovering");
    }
  }
  
  // Mistakes (reduce frequency and impact)
  if (ai.shouldMakeMistake && elapsed > ai.mistakeTimer && ai.phase === 'descending' && altitude > 100) {
    if (Math.random() < 0.3) { // Reduced from constant mistakes
      controls.thrust = !controls.thrust; // Simple mistake
      console.log("😅 Making a small mistake");
    }
    
    // Stop making mistakes after a short time
    if (elapsed > ai.mistakeTimer + 1500) {
      ai.shouldMakeMistake = false;
    }
  }
  
  console.log("🎮 Final controls:", controls);
  return controls;
}