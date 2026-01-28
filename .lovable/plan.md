
# Implement Abort Button in Survival Mode

## Overview
Add the abort system from Classic/Fixed modes to Survival mode, including:
- Emergency leveling and stabilization
- Fixed 50 fuel penalty on activation
- Smooth rotation animation
- Camera shake and audio feedback
- Keyboard and gamepad support

---

## Current Implementation in GameEngine.tsx

### Constants (lines 124-127)
```typescript
const ABORT_ROTATION_DURATION = 0.4; // seconds to smoothly rotate to level
const ABORT_BOOST_VELOCITY = -180; // instant upward velocity change (NOT USED - just dampens)
const ABORT_FUEL_COST = 50; // fixed fuel cost per abort activation
const ABORT_CAMERA_SHAKE = 12; // visual impact intensity
```

### State Variables
- `keys.current.abort` - Keyboard abort state
- `abortAssist.current` - Latch for abort behavior
- `abortRotationActive.current` - Animation in progress
- `abortStartAngle.current` - Starting angle for smooth rotation
- `abortRotationProgress.current` - Animation progress (0-1)
- `abortPenaltyCharged.current` - Prevent charging fuel multiple times

### Abort Behavior (lines 2233-2292)
1. **On activation**: Charge 50 fuel, dampen velocities (vx *= 0.5, vy *= 0.4), start rotation animation, play sound, camera shake
2. **During animation**: Smooth cubic ease-out rotation to 0 degrees, lock angular velocity
3. **Hover thrust**: Apply gentle thrust to maintain altitude while stabilizing
4. **Auto turn-off**: When stabilized (angle < 0.08, vx < 8, vy < 8)
5. **Reset**: When abort button released, reset penalty flag

---

## Implementation for SurvivalEngine.tsx

### 1. Add Abort Constants

Add after existing constants (line 46):
```typescript
// Abort system configuration (matching GameEngine)
const ABORT_ROTATION_DURATION = 0.4;
const ABORT_FUEL_COST = 50;
const ABORT_CAMERA_SHAKE = 12;
```

### 2. Add Keys State

Update keys ref (line 246):
```typescript
const keys = useRef({ left: false, right: false, thrust: false, rotateBoost: false, abort: false });
```

### 3. Add Abort State Refs

Add after keys ref (around line 248):
```typescript
// Abort system state
const abortAssist = useRef(false);
const abortRotationActive = useRef(false);
const abortStartAngle = useRef(0);
const abortRotationProgress = useRef(0);
const abortPenaltyCharged = useRef(false);
```

### 4. Add Keyboard Handling

In the `onKey` handler (around line 370), add after the rotateBoost handling:
```typescript
// Abort: Spacebar or Arrow Down
if (["arrowdown", "x"].includes(k)) {
  keys.current.abort = down;
  if (down) {
    abortAssist.current = true;
    setIsUsingPCControls(true);
    setPCControlsPreference(true);
  }
}
```

### 5. Add Gamepad Abort Detection

In the gamepad input section (around line 1265), add:
```typescript
// Abort button handling (matches main game - Y/Triangle button)
if (input.buttons.abort && !lastAbortDown.current) {
  abortAssist.current = true;
  keys.current.abort = true;
}
lastAbortDown.current = input.buttons.abort;
```

Add ref for edge detection (around line 257):
```typescript
const lastAbortDown = useRef(false);
```

### 6. Add Abort Logic in Physics Loop

In the physics update section, after rotation handling and before thrust controls (around line 1375), add:

```typescript
// Enhanced abort assist: smooth rotation, instant boost, fixed fuel penalty
if (!isLanded && !isDead && (keys.current.abort || abortAssist.current) && fuelAmount > 0) {
  // On first activation frame: charge fuel penalty and stabilize
  if (keys.current.abort && !abortPenaltyCharged.current) {
    // Charge fixed fuel penalty once per activation
    fuelAmount -= ABORT_FUEL_COST;
    fuelAmount = Math.max(0, fuelAmount);
    
    // Rapidly dampen velocities to stabilize
    shipVx *= 0.5;
    shipVy *= 0.4;
    
    // Start smooth rotation animation
    abortRotationActive.current = true;
    abortStartAngle.current = shipAngle;
    abortRotationProgress.current = 0;
    abortPenaltyCharged.current = true;
    
    // Camera shake and audio
    cameraShake = Math.max(cameraShake, ABORT_CAMERA_SHAKE);
    audio.current.abort();
    
    // Reset style points (rotation tracking)
    resetStylePoints(stylePointsStateRef.current);
  }
  
  // Animate rotation smoothly with cubic ease-out
  if (abortRotationActive.current) {
    abortRotationProgress.current += dt / ABORT_ROTATION_DURATION;
    const t = Math.min(1, abortRotationProgress.current);
    const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out curve
    shipAngle = abortStartAngle.current * (1 - eased);
    shipAngularVel = 0; // Lock angular velocity during rotation
    
    if (t >= 1) {
      shipAngle = 0; // Ensure exactly level at end
      abortRotationActive.current = false;
    }
  } else {
    // If not animating, keep level
    shipAngle = 0;
    shipAngularVel = 0;
  }
  
  // Apply hover thrust to maintain altitude
  const hoverThrust = Math.min(1, (GRAVITY * 60) / THRUST_ACCEL);
  const thrustX = Math.sin(shipAngle) * THRUST_ACCEL * hoverThrust;
  const thrustY = -Math.cos(shipAngle) * THRUST_ACCEL * hoverThrust;
  shipVx += thrustX * dt;
  shipVy += thrustY * dt;
  
  // Consume hover fuel
  if (!unlimitedFuelRef.current) {
    fuelAmount -= 25 * dt;
    fuelAmount = Math.max(0, fuelAmount);
  }
  
  // Auto turn off when stabilized
  const stabilized = Math.abs(shipAngle) < 0.08 && Math.abs(shipAngularVel) < 0.05 && Math.abs(shipVx) < 8 && shipVy < 8;
  if (stabilized) {
    abortAssist.current = false;
    keys.current.abort = false;
    abortRotationActive.current = false;
  }
}

// Reset penalty flag when abort button released
if (!keys.current.abort) {
  abortPenaltyCharged.current = false;
}
```

### 7. Pass Abort State to Style Points Tracking

Update the `update360Tracking` call (around line 1320) to pass abort state:
```typescript
const rotation360Result = update360Tracking(
  stylePointsStateRef.current,
  shipAngle,
  isRotatingLeft,
  isRotatingRight,
  dt,
  abortRotationActive.current, // Pass abort state to reset rotation tracking
  currentTime
);
```

### 8. Declare cameraShake Variable

Ensure `cameraShake` is declared in the physics loop (find existing `shake` variable and rename or add alongside):
```typescript
let cameraShake = 0; // Will be used for abort effect
```

Update the existing shake calculation to incorporate `cameraShake`:
```typescript
shake = (shake + cameraShake) * Math.pow(0.9, dt * 60); // Decay combined shake
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/SurvivalEngine.tsx` | Add abort constants, state refs, keyboard/gamepad handling, physics logic |

---

## Abort System Summary

| Aspect | Value |
|--------|-------|
| Fuel Cost | 50 (one-time on activation) |
| Hover Fuel | 25/second while stabilizing |
| Rotation Duration | 0.4 seconds (cubic ease-out) |
| Camera Shake | 12 intensity |
| Stabilization Thresholds | angle < 0.08, vx < 8, vy < 8 |

---

## Controls

| Input | Key/Button |
|-------|------------|
| Keyboard | Arrow Down or X |
| Gamepad | Y / Triangle (button 3) |

---

## Behavior

1. **Activation**: Ship rapidly levels, velocities dampen, 50 fuel deducted
2. **During**: Ship stays level, gentle hover thrust maintains altitude
3. **Auto-off**: When ship is stable (low velocity and level angle)
4. **Audio/Visual**: Abort sound plays, camera shakes on activation
