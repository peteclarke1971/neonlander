// Style Points System - Rewards for skilled flying
// Active only in classic and fixed modes

export interface StylePointsState {
  // 360° Rotation tracking
  rotation360: {
    active: boolean;
    startAngle: number;
    startTime: number;
    direction: 'left' | 'right' | null;
    totalRotation: number;
    keyHeld: boolean;
  };
  
  // Near Miss tracking
  nearMiss: {
    active: boolean;
    startTime: number;
    startX: number;
    startY: number;
    lastDistance: number;
    lastAwardTime: number; // Cooldown tracking
  };
  
  // Track near misses this flight
  nearMissesThisFlight: number;
}

// Initialize state
export function createStylePointsState(): StylePointsState {
  return {
    rotation360: {
      active: false,
      startAngle: 0,
      startTime: 0,
      direction: null,
      totalRotation: 0,
      keyHeld: false
    },
    nearMiss: {
      active: false,
      startTime: 0,
      startX: 0,
      startY: 0,
      lastDistance: 999,
      lastAwardTime: 0 // Initialize cooldown
    },
    nearMissesThisFlight: 0
  };
}

// Update 360° rotation tracking
// Returns { awarded: true, currentAngle } if 360° completed
export function update360Tracking(
  state: StylePointsState,
  angle: number,
  rotateLeft: boolean,
  rotateRight: boolean,
  dt: number,
  abortActive: boolean,
  currentTime: number
): { awarded: boolean; currentAngle: number } | null {
  const rot = state.rotation360;
  
  // Reset if abort is used
  if (abortActive && rot.active) {
    rot.active = false;
    rot.keyHeld = false;
    return null;
  }
  
  // Check if rotation key is pressed
  const leftPressed = rotateLeft;
  const rightPressed = rotateRight;
  const anyPressed = leftPressed || rightPressed;
  
  // Start tracking when key first pressed
  if (!rot.active && anyPressed) {
    rot.active = true;
    rot.startAngle = angle;
    rot.startTime = currentTime;
    rot.direction = leftPressed ? 'left' : 'right';
    rot.totalRotation = 0;
    rot.keyHeld = true;
    return null;
  }
  
  // Key released or direction changed - reset
  if (rot.active && (!anyPressed || (leftPressed && rot.direction === 'right') || (rightPressed && rot.direction === 'left'))) {
    rot.active = false;
    rot.keyHeld = false;
    return null;
  }
  
  // Active tracking
  if (rot.active && rot.keyHeld) {
    // Check time limit (2 seconds)
    if (currentTime - rot.startTime > 2.0) {
      // Time expired, reset
      rot.active = false;
      rot.keyHeld = false;
      return null;
    }
    
    // Track accumulated rotation with proper angle wrapping
    let angleChange = angle - rot.startAngle;
    
    // Normalize to [-π, π] range to handle wrapping at 0/2π boundary
    while (angleChange > Math.PI) angleChange -= 2 * Math.PI;
    while (angleChange < -Math.PI) angleChange += 2 * Math.PI;
    
    // Accumulate rotation based on direction
    if (rot.direction === 'right' && angleChange > 0) {
      rot.totalRotation += angleChange;
    } else if (rot.direction === 'left' && angleChange < 0) {
      rot.totalRotation += Math.abs(angleChange);
    }
    
    // Update start angle for next frame
    rot.startAngle = angle;
    
    // Check if completed 360° (2π radians)
    if (rot.totalRotation >= Math.PI * 2) {
      // Award 360 points! Reset tracking so another 360 can be earned
      rot.active = false;
      rot.keyHeld = false;
      
      return { awarded: true, currentAngle: angle };
    }
  }
  
  return null;
}

// Update near miss tracking
// Returns { awarded: true, awardX, awardY } if near miss completed
export function updateNearMiss(
  state: StylePointsState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  getHeightAt: (x: number) => number,
  dt: number,
  currentTime: number
): { awarded: boolean; awardX: number; awardY: number } | null {
  const nm = state.nearMiss;
  
  // Calculate total velocity
  const totalVelocity = Math.sqrt(vx * vx + vy * vy);
  
  // Check if fast enough (>= 1 m/s) - Much easier now!
  if (totalVelocity < 1.0) {
    // Too slow, reset tracking
    if (nm.active) {
      nm.active = false;
    }
    return null;
  }
  
  // Check multiple points on lander for near miss (left foot, center, right foot)
  const checkPoints = [
    { x: x - 6, y: y + 8 }, // Left foot
    { x: x, y: y + 8 },     // Center bottom
    { x: x + 6, y: y + 8 }  // Right foot
  ];
  
  let minDistance = Infinity;
  for (const point of checkPoints) {
    const terrainHeight = getHeightAt(point.x);
    const distance = Math.abs(point.y - terrainHeight);
    minDistance = Math.min(minDistance, distance);
  }
  
  // Check if within 30px of terrain (much easier!)
  if (minDistance <= 30) {
    if (!nm.active) {
      // Start tracking
      nm.active = true;
      nm.startTime = currentTime;
      nm.startX = x;
      nm.startY = y;
      nm.lastDistance = minDistance;
      console.log("🎯 Near miss tracking started", { distance: minDistance, velocity: totalVelocity });
    } else {
      // Continue tracking
      nm.lastDistance = minDistance;
      const elapsed = currentTime - nm.startTime;
      console.log("🎯 Near miss tracking...", { distance: minDistance, elapsed, needed: 0.3 });
      
      // Check if maintained for 0.3 seconds (much easier!)
      if (elapsed >= 0.3) {
        // Check cooldown - must be 1 second since last award
        const timeSinceLastAward = currentTime - nm.lastAwardTime;
        const COOLDOWN = 1.0;
        
        if (timeSinceLastAward >= COOLDOWN) {
          // Award near miss!
          const awardX = x;
          const awardY = y + 8; // Position at lander bottom
          
          console.log("✅ NEAR MISS AWARDED!");
          
          // Reset for next potential near miss
          nm.active = false;
          nm.lastAwardTime = currentTime;
          state.nearMissesThisFlight++;
          
          return { awarded: true, awardX, awardY };
        } else {
          console.log("⏱️ Near miss on cooldown. Time remaining:", (COOLDOWN - timeSinceLastAward).toFixed(2));
          nm.active = false; // Reset but don't award
        }
      }
    }
  } else {
    // Too far from terrain, reset
    if (nm.active) {
      console.log("❌ Near miss lost - too far from terrain", { distance: minDistance });
      nm.active = false;
    }
  }
  
  return null;
}

// Check for perfect landing
// Returns true if landing qualifies as "perfect" (total velocity <= 0.2 m/s AND bullseye)
export function checkPerfectLanding(
  vx: number,
  vy: number,
  okAngle: boolean,
  okVx: boolean,
  okVy: boolean,
  bullseye: boolean
): boolean {
  // Must pass basic landing checks
  if (!okAngle || !okVx || !okVy) {
    return false;
  }
  
  // Must be a bullseye landing (centered on pad)
  if (!bullseye) {
    return false;
  }
  
  // Calculate total velocity
  const totalVelocity = Math.sqrt(vx * vx + vy * vy);
  
  // Perfect landing threshold: <= 0.2 m/s (feather light touchdown)
  return totalVelocity <= 0.2;
}

// Reset state for new flight
export function resetStylePoints(state: StylePointsState): void {
  state.rotation360.active = false;
  state.rotation360.keyHeld = false;
  state.rotation360.totalRotation = 0;
  state.nearMiss.active = false;
  state.nearMissesThisFlight = 0;
}
