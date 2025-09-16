export interface OrbitalState {
  r: number;     // radial distance from planet center
  theta: number; // angular position (radians)
  rdot: number;  // radial velocity
  thetadot: number; // angular velocity
}

export interface ShipState extends OrbitalState {
  psi: number;   // ship orientation relative to local tangent (0 = prograde)
  fuel: number;  // 0-1000 units
  thrust: number; // current thrust level 0-1
}

export interface Planet {
  radius: number;        // planet radius
  gravity: number;       // surface gravity (μ = g0 * R²)
  rotationRate: number;  // planet rotation (rad/s)
  mu: number;           // gravitational parameter
}

export interface LandingPad {
  width: number;         // pad width in radians
  position: number;      // current angular position
  basePosition: number;  // initial angular position
}

export interface OrbitalPhysicsConfig {
  planet: Planet;
  pad: LandingPad;
  startAltitude: number;     // starting altitude above surface
  landingTolerance: {
    radialVelocity: number;  // max radial velocity for landing
    tangentialVelocity: number; // max tangential velocity
    positionTolerance: number;   // position tolerance in world units
    angleTolerance: number;      // ship angle tolerance (degrees)
  };
  timeLimit: number;        // mission time limit (seconds)
  crashTolerance: number;   // how close to surface before crash
}

export interface OrbitalDockingGameOverData {
  score: number;
  time: number;
  fuelRemaining: number;
  cause: "crash" | "fuel" | "timeout" | "success";
  cleanCapture: boolean;  // landed on first try within thresholds
  seed: number;
  isNewBestTime?: boolean;  // whether this was a new best time for ghost recording
}

export interface OrbitalDockingHUDSnapshot {
  altitude: number;           // height above surface
  angularDiff: number;        // angular difference to pad (degrees)
  radialVelocity: number;     // radial velocity component
  tangentialVelocity: number; // tangential velocity component  
  fuel: number;               // fuel remaining
  time: number;               // time remaining
  level: number;              // current level
  padPosition: number;        // pad angular position (degrees)
}

export interface DebrisParticle {
  r: number;
  theta: number;
  rdot: number;
  thetadot: number;
  size: number;
}

export interface LevelConfig {
  planet: {
    radius: number;
    gravity: number;
    rotationRate: number;
  };
  pad: {
    width: number; // in degrees
  };
  startAltitude: number;
  debris: {
    count: number;
    minOrbit: number; // minimum orbital radius
    maxOrbit: number; // maximum orbital radius
  };
  scoring: {
    baseScore: number;
    timeBonus: number;
    fuelBonus: number;
    cleanBonus: number;
  };
}