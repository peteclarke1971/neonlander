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
  };
  
  // Awarded bonuses this flight (prevent duplicates per flight)
  awarded360ThisFlight: boolean;
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
      lastDistance: 999
    },
    awarded360ThisFlight: false,
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
  
  // Already awarded this flight
  if (state.awarded360ThisFlight) {
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
    
    // Track accumulated rotation
    // Note: angle increases for right rotation, decreases for left
    const angleChange = angle - rot.startAngle;
    
    // Accumulate absolute rotation
    if (rot.direction === 'right') {
      rot.totalRotation = angleChange;
    } else {
      rot.totalRotation = -angleChange;
    }
    
    // Check if completed 360° (2π radians)
    if (Math.abs(rot.totalRotation) >= Math.PI * 2) {
      // Award 360 points!
      state.awarded360ThisFlight = true;
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
  
  // Check if fast enough (>= 2 m/s)
  if (totalVelocity < 2.0) {
    // Too slow, reset tracking
    if (nm.active) {
      nm.active = false;
    }
    return null;
  }
  
  // Calculate distance from terrain
  const terrainHeight = getHeightAt(x);
  const landerBottom = y + 8; // Lander foot approximation
  const distance = Math.abs(landerBottom - terrainHeight);
  
  // Check if within 5px of terrain
  if (distance <= 5) {
    if (!nm.active) {
      // Start tracking
      nm.active = true;
      nm.startTime = currentTime;
      nm.startX = x;
      nm.startY = y;
      nm.lastDistance = distance;
    } else {
      // Continue tracking
      nm.lastDistance = distance;
      
      // Check if maintained for 1.5 seconds
      if (currentTime - nm.startTime >= 1.5) {
        // Award near miss!
        const awardX = x;
        const awardY = terrainHeight; // Position at terrain level
        
        // Reset for next potential near miss
        nm.active = false;
        state.nearMissesThisFlight++;
        
        return { awarded: true, awardX, awardY };
      }
    }
  } else {
    // Too far from terrain, reset
    if (nm.active) {
      nm.active = false;
    }
  }
  
  return null;
}

// Check for perfect landing
// Returns true if landing qualifies as "perfect" (total velocity <= 0.5 m/s)
export function checkPerfectLanding(
  vx: number,
  vy: number,
  okAngle: boolean,
  okVx: boolean,
  okVy: boolean
): boolean {
  // Must pass basic landing checks
  if (!okAngle || !okVx || !okVy) {
    return false;
  }
  
  // Calculate total velocity
  const totalVelocity = Math.sqrt(vx * vx + vy * vy);
  
  // Perfect landing threshold: <= 0.5 m/s
  return totalVelocity <= 0.5;
}

// Reset state for new flight
export function resetStylePoints(state: StylePointsState): void {
  state.rotation360.active = false;
  state.rotation360.keyHeld = false;
  state.rotation360.totalRotation = 0;
  state.nearMiss.active = false;
  state.awarded360ThisFlight = false;
  state.nearMissesThisFlight = 0;
}
