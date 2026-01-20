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

// Helper function for terrain height lookup (medium UFO)
function getTerrainHeightMedium(
  terrain: { x: number; y: number }[], 
  x: number, 
  worldWidth: number
): number {
  if (terrain.length < 2) return 1000;
  
  let wrappedX = x % worldWidth;
  if (wrappedX < 0) wrappedX += worldWidth;
  
  for (let i = 0; i < terrain.length - 1; i++) {
    if (terrain[i].x <= wrappedX && terrain[i + 1].x > wrappedX) {
      const t = (wrappedX - terrain[i].x) / (terrain[i + 1].x - terrain[i].x);
      return terrain[i].y + (terrain[i + 1].y - terrain[i].y) * t;
    }
  }
  return 1000;
}

// Create a new UFO (medium type)
export function spawnUFO(
  seed: number,
  difficulty: number,
  worldWidth: number,
  baseHeight: number,
  landerX: number,
  landerY: number,
  currentTime: number,
  config: UFOConfig = DEFAULT_UFO_CONFIG,
  terrain?: { x: number; y: number }[]
): LanderUFO {
  const rng = mulberry32(seed);
  
  // Choose spawn side (avoid spawning on top of lander)
  const spawnSide: "left" | "right" = landerX < worldWidth / 2 ? "right" : "left";
  
  // Calculate spawn position
  const spawnX = spawnSide === "left" ? -config.spawnMargin : worldWidth + config.spawnMargin;
  
  // Calculate safe spawn Y based on terrain
  let spawnY: number;
  const minClearance = 60;
  
  if (terrain && terrain.length > 0) {
    // Find highest terrain point across entire level (UFO crosses full width)
    let minTerrainY = baseHeight;
    for (let checkX = 0; checkX < worldWidth; checkX += 100) {
      const terrainY = getTerrainHeightMedium(terrain, checkX, worldWidth);
      if (terrainY < minTerrainY) {
        minTerrainY = terrainY;
      }
    }
    
    // Spawn above highest terrain with clearance + variance
    spawnY = Math.min(minTerrainY - minClearance - rng() * 30, 160);
  } else {
    // Fallback to old behavior
    spawnY = baseHeight - config.spawnHeight - rng() * 50;
  }
  
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

// UFO-to-UFO collision detection
export function checkUFOToUFOCollisions(
  activeUFOs: (LanderUFO | null)[]
): { destroyed: LanderUFO[], collisions: Array<{ ufo1: LanderUFO, ufo2: LanderUFO }> } {
  const destroyed: LanderUFO[] = [];
  const collisions: Array<{ ufo1: LanderUFO, ufo2: LanderUFO }> = [];
  
  const active = activeUFOs.filter(u => u?.active) as LanderUFO[];
  
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const ufo1 = active[i];
      const ufo2 = active[j];
      
      const dx = ufo1.x - ufo2.x;
      const dy = ufo1.y - ufo2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Get collision radii (approximation based on scale)
      const radius1 = ufo1.type === "small" ? 11 : ufo1.type === "medium" ? 20 : 60;
      const radius2 = ufo2.type === "small" ? 11 : ufo2.type === "medium" ? 20 : 60;
      
      if (distance < radius1 + radius2) {
        // Collision detected!
        collisions.push({ ufo1, ufo2 });
        
        // Determine what gets destroyed
        if (ufo1.type === "small" && ufo2.type === "large") {
          // Small destroyed, Large survives
          if (!destroyed.includes(ufo1)) destroyed.push(ufo1);
        } else if (ufo1.type === "large" && ufo2.type === "small") {
          // Small destroyed, Large survives
          if (!destroyed.includes(ufo2)) destroyed.push(ufo2);
        } else if (ufo1.type === "small" && ufo2.type === "medium") {
          // Both destroyed
          if (!destroyed.includes(ufo1)) destroyed.push(ufo1);
          if (!destroyed.includes(ufo2)) destroyed.push(ufo2);
        } else if (ufo1.type === "medium" && ufo2.type === "small") {
          // Both destroyed
          if (!destroyed.includes(ufo1)) destroyed.push(ufo1);
          if (!destroyed.includes(ufo2)) destroyed.push(ufo2);
        } else if (ufo1.type === "medium" && ufo2.type === "large") {
          // Both destroyed
          if (!destroyed.includes(ufo1)) destroyed.push(ufo1);
          if (!destroyed.includes(ufo2)) destroyed.push(ufo2);
        } else if (ufo1.type === "large" && ufo2.type === "medium") {
          // Both destroyed
          if (!destroyed.includes(ufo1)) destroyed.push(ufo1);
          if (!destroyed.includes(ufo2)) destroyed.push(ufo2);
        }
      }
    }
  }
  
  return { destroyed, collisions };
}
