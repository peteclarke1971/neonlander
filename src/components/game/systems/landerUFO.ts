import type { LanderUFO, UFOProjectile, UFOConfig } from "../types/landerUFO";

// Seeded RNG (for deterministic behavior)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_UFO_CONFIG: UFOConfig = {
  baseSpeed: 50, // px/s at difficulty 1
  weaveAmplitudeMin: 10,
  weaveAmplitudeMax: 30,
  weaveFrequencyMin: 0.5, // Hz
  weaveFrequencyMax: 1.5,
  shotIntervalMin: 2.0, // seconds
  shotIntervalMax: 4.0,
  aimInaccuracyDegrees: 45, // at difficulty 1
  projectileSpeed: 150, // px/s
  projectileLifetime: 3.0, // seconds
  spawnHeight: 150, // px above ground
  spawnMargin: 50, // px off-screen
  trackingThreshold: 4,
  trackingStrengthPerDifficulty: 0.08
};

// Create a new UFO
export function spawnUFO(
  seed: number,
  difficulty: number,
  worldWidth: number,
  baseHeight: number,
  landerX: number,
  landerY: number,
  currentTime: number,
  config: UFOConfig = DEFAULT_UFO_CONFIG
): LanderUFO {
  const rng = mulberry32(seed);
  
  // Choose spawn side (avoid spawning on top of lander)
  const spawnSide: "left" | "right" = landerX < worldWidth / 2 ? "right" : "left";
  
  // Calculate spawn position
  const spawnX = spawnSide === "left" ? -config.spawnMargin : worldWidth + config.spawnMargin;
  const spawnY = baseHeight - config.spawnHeight - rng() * 50; // Slight Y variance
  
  // Scale speed by difficulty (1x at diff 1, 2x at diff 10)
  const speedMultiplier = 1 + (difficulty - 1) * 0.11;
  const baseSpeed = config.baseSpeed * speedMultiplier;
  const vx = spawnSide === "left" ? baseSpeed : -baseSpeed;
  
  // Weaving parameters
  const weaveAmplitude = config.weaveAmplitudeMin + rng() * (config.weaveAmplitudeMax - config.weaveAmplitudeMin);
  const weaveFrequency = config.weaveFrequencyMin + rng() * (config.weaveFrequencyMax - config.weaveFrequencyMin);
  
  // Shooting parameters (scaled by difficulty)
  const shotIntervalBase = config.shotIntervalMin + rng() * (config.shotIntervalMax - config.shotIntervalMin);
  const shotIntervalScaled = shotIntervalBase / (1 + (difficulty - 1) * 0.1); // Faster at high difficulty
  
  // Tracking (difficulty 4+)
  const canTrack = difficulty >= config.trackingThreshold;
  const trackingStrength = Math.min((difficulty - config.trackingThreshold) * config.trackingStrengthPerDifficulty, 0.7);
  
  return {
    id: `ufo_${Date.now()}_${Math.random()}`,
    type: "medium",
    x: spawnX,
    y: spawnY,
    vx,
    vy: 0,
    difficulty,
    scale: 1.0,
    baseY: spawnY,
    weaveAmplitude,
    weaveFrequency,
    weavePhase: rng() * Math.PI * 2,
    bandRotation: rng(),
    bandRotationSpeed: 2.0 + difficulty * 0.2,
    lastShotTime: currentTime,
    nextShotTime: currentTime + shotIntervalScaled,
    canShoot: true,
    active: true,
    spawnSide,
    hasExited: false,
    canTrack,
    trackingStrength,
    attackPhase: "done",
    attackCount: 0,
    maxAttacks: 0,
    targetX: 0,
    targetY: 0,
    isHovering: false,
    hoverX: 0,
    hoverY: 0,
    nextBurstTime: 0,
    burstCooldown: 0,
    isCharging: false,
    chargeStartTime: 0,
    chargeDuration: 0
  };
}

// Update UFO position and behavior
export function updateUFO(
  ufo: LanderUFO,
  dt: number,
  currentTime: number,
  landerX: number,
  landerY: number,
  worldWidth: number,
  config: UFOConfig = DEFAULT_UFO_CONFIG
): UFOProjectile | null {
  if (!ufo.active || ufo.hasExited) return null;
  
  // Update horizontal position
  ufo.x += ufo.vx * dt;
  
  // Check if exited screen
  if ((ufo.spawnSide === "left" && ufo.x > worldWidth + config.spawnMargin) ||
      (ufo.spawnSide === "right" && ufo.x < -config.spawnMargin)) {
    ufo.hasExited = true;
    ufo.active = false;
    return null;
  }
  
  // Update weaving motion (sine wave)
  ufo.weavePhase += ufo.weaveFrequency * dt * Math.PI * 2;
  const weaveOffset = Math.sin(ufo.weavePhase) * ufo.weaveAmplitude;
  
  // Tracking behavior (difficulty 4+)
  if (ufo.canTrack) {
    const targetY = landerY;
    const dy = targetY - ufo.baseY;
    ufo.baseY += dy * ufo.trackingStrength * dt;
  }
  
  ufo.y = ufo.baseY + weaveOffset;
  
  // Update band rotation animation
  ufo.bandRotation = (ufo.bandRotation + ufo.bandRotationSpeed * dt) % 1.0;
  
  // Shooting logic
  if (currentTime >= ufo.nextShotTime) {
    const projectile = fireProjectile(ufo, landerX, landerY, currentTime, config);
    
    // Schedule next shot
    const shotInterval = config.shotIntervalMin + Math.random() * (config.shotIntervalMax - config.shotIntervalMin);
    const scaledInterval = shotInterval / (1 + (ufo.difficulty - 1) * 0.1);
    ufo.nextShotTime = currentTime + scaledInterval;
    
    return projectile;
  }
  
  return null;
}

// Fire a projectile toward the lander
function fireProjectile(
  ufo: LanderUFO,
  landerX: number,
  landerY: number,
  currentTime: number,
  config: UFOConfig
): UFOProjectile {
  // Calculate aim direction with inaccuracy
  const dx = landerX - ufo.x;
  const dy = landerY - ufo.y;
  const baseAngle = Math.atan2(dy, dx);
  
  // Scale inaccuracy inversely with difficulty (more accurate at high difficulty)
  const inaccuracyScale = 1 / (1 + (ufo.difficulty - 1) * 0.15);
  const maxInaccuracy = config.aimInaccuracyDegrees * inaccuracyScale * (Math.PI / 180);
  const inaccuracy = (Math.random() - 0.5) * maxInaccuracy * 2;
  const angle = baseAngle + inaccuracy;
  
  const speed = config.projectileSpeed;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  
  return {
    id: `ufoproj_${Date.now()}_${Math.random()}`,
    x: ufo.x,
    y: ufo.y,
    vx,
    vy,
    lifetime: config.projectileLifetime,
    active: true
  };
}

// Update all projectiles
export function updateProjectiles(
  projectiles: UFOProjectile[],
  dt: number
): void {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    
    if (!proj.active) {
      projectiles.splice(i, 1);
      continue;
    }
    
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.lifetime -= dt;
    
    if (proj.lifetime <= 0) {
      projectiles.splice(i, 1);
    }
  }
}

// Collision detection
export function checkUFOCollision(
  ufos: (LanderUFO | null)[],
  landerX: number,
  landerY: number,
  landerRadius: number
): LanderUFO | null {
  for (const ufo of ufos) {
    if (!ufo || !ufo.active) continue;
    
    const dx = ufo.x - landerX;
    const dy = ufo.y - landerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // UFO hitbox scales with type
    const ufoRadius = ufo.type === "small" ? 8 : ufo.type === "medium" ? 20 : 60;
    
    if (dist < landerRadius + ufoRadius) {
      return ufo;
    }
  }
  
  return null;
}

export function checkProjectileCollision(
  projectiles: UFOProjectile[],
  landerX: number,
  landerY: number,
  landerRadius: number
): UFOProjectile | null {
  for (const proj of projectiles) {
    if (!proj.active) continue;
    
    const dx = proj.x - landerX;
    const dy = proj.y - landerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Small projectile hitbox
    const projRadius = 3;
    
    if (dist < landerRadius + projRadius) {
      return proj;
    }
  }
  
  return null;
}
