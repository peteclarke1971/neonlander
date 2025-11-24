import type { LanderUFO, UFOProjectile, UFOTypeConfig, BulletPattern } from "../types/landerUFO";

// Seeded RNG
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const UFO_CONFIGS: Record<"small" | "medium" | "large", UFOTypeConfig> = {
  small: {
    enabled: true,
    difficulty: 1,
    baseSpeed: 120,
    scale: 0.462,  // 30% smaller than before (0.66 * 0.7)
    spawnInterval: { min: 15, max: 25 },
    hitboxRadius: 11,  // Proportionally smaller (16 * 0.7)
    diveSpeed: 200,
    turnRate: 180,
    maxAttacks: 1
  },
  medium: {
    enabled: true,
    difficulty: 1,
    baseSpeed: 50,
    scale: 1.0,
    spawnInterval: { min: 20, max: 35 },
    hitboxRadius: 20,
    weaveAmplitude: { min: 10, max: 30 },
    shotInterval: { min: 2.0, max: 4.0 }
  },
  large: {
    enabled: true,
    difficulty: 1,
    baseSpeed: 30,
    scale: 4.0,
    spawnInterval: { min: 40, max: 60 },
    hitboxRadius: 60,
    hoverHeight: 100,
    burstCooldown: { min: 4.0, max: 6.0 },
    chargeDuration: 1.5,
    bulletSpeedRange: { min: 100, max: 150 }
  }
};

// Helper function
function getTerrainHeight(terrain: { x: number; y: number }[], x: number): number {
  for (let i = 0; i < terrain.length - 1; i++) {
    if (terrain[i].x <= x && terrain[i + 1].x > x) {
      const t = (x - terrain[i].x) / (terrain[i + 1].x - terrain[i].x);
      return terrain[i].y + (terrain[i + 1].y - terrain[i].y) * t;
    }
  }
  return 1000;
}

// Spawn Small UFO
export function spawnSmallUFO(
  seed: number,
  difficulty: number,
  worldWidth: number,
  baseHeight: number,
  landerX: number,
  landerY: number,
  currentTime: number,
  config: UFOTypeConfig
): LanderUFO {
  const rng = mulberry32(seed);
  const spawnSide: "left" | "right" = landerX < worldWidth / 2 ? "right" : "left";
  const spawnX = spawnSide === "left" ? -50 : worldWidth + 50;
  const spawnY = baseHeight - 200 - rng() * 100;
  
  const targetX = landerX;
  const targetY = landerY;
  
  const speedMultiplier = 1 + (difficulty - 1) * 0.15;
  const speed = config.baseSpeed! * speedMultiplier;
  
  const dx = landerX - spawnX;
  const dy = landerY - spawnY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const vx = (dx / dist) * speed;
  const vy = (dy / dist) * speed;
  
  const maxAttacks = difficulty >= 4 ? 2 : 1;
  
  return {
    id: `ufo_small_${Date.now()}_${Math.random()}`,
    type: "small",
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    difficulty,
    scale: config.scale,
    baseY: spawnY,
    weaveAmplitude: 0,
    weaveFrequency: 0,
    weavePhase: 0,
    bandRotation: rng(),
    bandRotationSpeed: 3.0 + difficulty * 0.3,
    lastShotTime: 0,
    nextShotTime: 0,
    canShoot: false,
    active: true,
    spawnSide,
    hasExited: false,
    canTrack: false,
    trackingStrength: 0,
    attackPhase: "approach",
    attackCount: 0,
    maxAttacks,
    targetX,
    targetY,
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

// Spawn Large UFO
export function spawnLargeUFO(
  seed: number,
  difficulty: number,
  worldWidth: number,
  baseHeight: number,
  landerX: number,
  landerY: number,
  currentTime: number,
  config: UFOTypeConfig,
  terrain: { x: number; y: number }[]
): LanderUFO {
  const rng = mulberry32(seed);
  
  // Choose hover position (away from lander)
  const hoverHeight = config.hoverHeight!;
  let hoverX = worldWidth * 0.3 + rng() * worldWidth * 0.4; // Middle 40% of screen
  
  // Make sure not too close to lander
  if (Math.abs(hoverX - landerX) < 300) {
    hoverX = landerX > worldWidth / 2 ? worldWidth * 0.2 : worldWidth * 0.8;
  }
  
  let hoverY = hoverHeight;
  
  // Scale from 10s at difficulty 1 to 5s at difficulty 10
  const burstCooldown = 10 - ((difficulty - 1) / 9) * 5;
  
  console.log(`🚀 MOTHERSHIP: Spawning directly at hover position (${hoverX.toFixed(0)}, ${hoverY.toFixed(0)}) at t=${currentTime.toFixed(2)}s with difficulty=${difficulty}, burstCooldown=${burstCooldown.toFixed(1)}s`);
  
  return {
    id: `ufo_large_${Date.now()}_${Math.random()}`,
    type: "large",
    x: hoverX,  // Spawn directly at hover position
    y: hoverY,
    vx: 0,  // No movement
    vy: 0,
    difficulty,
    scale: config.scale,
    baseY: hoverY,
    weaveAmplitude: 0,
    weaveFrequency: 0,
    weavePhase: 0,
    bandRotation: rng(),
    bandRotationSpeed: 0.5 + difficulty * 0.05,
    lastShotTime: currentTime,
    nextShotTime: currentTime + burstCooldown,
    canShoot: true,
    active: true,
    spawnSide: rng() > 0.5 ? "right" : "left",
    hasExited: false,
    canTrack: false,
    trackingStrength: 0,
    attackPhase: "done",
    attackCount: 0,
    maxAttacks: 0,
    targetX: hoverX,
    targetY: hoverY,
    isHovering: true,  // Already hovering!
    hoverX,
    hoverY,
    nextBurstTime: currentTime + burstCooldown,  // Schedule first burst immediately
    burstCooldown,
    isCharging: false,
    chargeStartTime: 0,
    chargeDuration: config.chargeDuration!
  };
}

// Update Small UFO
export function updateSmallUFO(
  ufo: LanderUFO,
  dt: number,
  currentTime: number,
  landerX: number,
  landerY: number,
  worldWidth: number,
  config: UFOTypeConfig,
  terrain: { x: number; y: number }[]
): void {
  if (!ufo.active || ufo.type !== "small") return;
  
  const difficulty = ufo.difficulty;
  const turnRateBase = config.turnRate!;
  const turnRate = turnRateBase * (1 + (difficulty - 1) * 0.15);
  const diveSpeed = config.diveSpeed! * (1 + (difficulty - 1) * 0.12);
  
  switch (ufo.attackPhase) {
    case "approach":
      const dx = landerX - ufo.x;
      const dy = landerY - ufo.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 100) {
        ufo.attackPhase = "dive";
        ufo.targetX = landerX;
        ufo.targetY = landerY;
        
        const angle = Math.atan2(dy, dx);
        ufo.vx = Math.cos(angle) * diveSpeed;
        ufo.vy = Math.sin(angle) * diveSpeed;
      } else {
        const currentAngle = Math.atan2(ufo.vy, ufo.vx);
        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - currentAngle;
        
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const maxTurn = (turnRate * Math.PI / 180) * dt;
        angleDiff = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
        
        const newAngle = currentAngle + angleDiff;
        const speed = Math.sqrt(ufo.vx * ufo.vx + ufo.vy * ufo.vy);
        ufo.vx = Math.cos(newAngle) * speed;
        ufo.vy = Math.sin(newAngle) * speed;
      }
      break;
      
    case "dive":
      const dxTarget = ufo.targetX - ufo.x;
      const dyTarget = ufo.targetY - ufo.y;
      const distTarget = Math.sqrt(dxTarget * dxTarget + dyTarget * dyTarget);
      
      if (distTarget > 500 || ufo.y > 320) {
        ufo.attackPhase = "retreat";
        ufo.attackCount++;
        
        const exitSide = ufo.spawnSide === "left" ? "right" : "left";
        const exitX = exitSide === "left" ? -100 : worldWidth + 100;
        const exitY = 160;
        const exitDx = exitX - ufo.x;
        const exitDy = exitY - ufo.y;
        const exitDist = Math.sqrt(exitDx * exitDx + exitDy * exitDy);
        ufo.vx = (exitDx / exitDist) * config.baseSpeed!;
        ufo.vy = (exitDy / exitDist) * config.baseSpeed!;
      }
      break;
      
    case "retreat":
      if (ufo.attackCount < ufo.maxAttacks) {
        const distToLander = Math.sqrt(
          Math.pow(landerX - ufo.x, 2) + Math.pow(landerY - ufo.y, 2)
        );
        
        if (distToLander > 200) {
          ufo.attackPhase = "approach";
        }
      } else {
        if (ufo.x < -100 || ufo.x > worldWidth + 100) {
          ufo.hasExited = true;
          ufo.active = false;
        }
      }
      break;
  }
  
  ufo.x += ufo.vx * dt;
  ufo.y += ufo.vy * dt;
  
  ufo.bandRotation = (ufo.bandRotation + ufo.bandRotationSpeed * dt) % 1.0;
  
  const terrainY = getTerrainHeight(terrain, ufo.x);
  if (ufo.y + config.hitboxRadius >= terrainY) {
    ufo.active = false;
    ufo.hasExited = true;
  }
}

// Update Large UFO
export function updateLargeUFO(
  ufo: LanderUFO,
  dt: number,
  currentTime: number,
  landerX: number,
  landerY: number,
  worldWidth: number,
  config: UFOTypeConfig
): UFOProjectile[] {
  if (!ufo.active || ufo.type !== "large") return [];
  
  const newProjectiles: UFOProjectile[] = [];
  
  // Mothership is always hovering (spawned at hover position) - no movement needed
  
  // Check if should start charging
  if (!ufo.isCharging && currentTime >= ufo.nextBurstTime - ufo.chargeDuration) {
    ufo.isCharging = true;
    ufo.chargeStartTime = currentTime;
    console.log(`⚡ MOTHERSHIP: Charging started at t=${currentTime.toFixed(2)}s. Will fire at t=${ufo.nextBurstTime.toFixed(2)}s (in ${(ufo.nextBurstTime - currentTime).toFixed(1)}s)`);
  }
  
  // Check if should fire
  if (ufo.isCharging && currentTime >= ufo.nextBurstTime) {
    // Fire bullet burst
    const burst = createBulletBurst(ufo, landerX, landerY, config);
    newProjectiles.push(...burst);
    
    // Reset charging and schedule next burst
    ufo.isCharging = false;
    const oldBurstTime = ufo.nextBurstTime;
    ufo.nextBurstTime = currentTime + ufo.burstCooldown;
    
    console.log(`🔫 MOTHERSHIP: FIRED ${burst.length} bullets at t=${currentTime.toFixed(2)}s! Next burst at t=${ufo.nextBurstTime.toFixed(2)}s (in ${ufo.burstCooldown.toFixed(1)}s). Previous burst was at t=${oldBurstTime.toFixed(2)}s`);
  }
  
  // Update band rotation (visual only)
  ufo.bandRotation = (ufo.bandRotation + ufo.bandRotationSpeed * dt) % 1.0;
  
  return newProjectiles;
}

function createBulletBurst(
  ufo: LanderUFO,
  landerX: number,
  landerY: number,
  config: UFOTypeConfig
): UFOProjectile[] {
  const difficulty = ufo.difficulty;
  const projectiles: UFOProjectile[] = [];
  
  let pattern: BulletPattern;
  let bulletCount: number;
  let spreadAngle: number;
  
  if (difficulty <= 3) {
    pattern = "simple_spread";
    bulletCount = 5 + difficulty;
    spreadAngle = 45;
  } else if (difficulty <= 6) {
    pattern = "multi_arc";
    bulletCount = 10 + difficulty * 2;
    spreadAngle = 90;
  } else {
    const patterns: BulletPattern[] = ["spiral", "double_ring", "alternating"];
    pattern = patterns[Math.floor(Math.random() * patterns.length)];
    bulletCount = 20 + difficulty * 3;
    spreadAngle = 360;
  }
  
  console.log(`  📊 BURST: Pattern=${pattern}, Bullets=${bulletCount}, Spread=${spreadAngle}°, Difficulty=${difficulty}, UFO pos=(${ufo.x.toFixed(0)}, ${ufo.y.toFixed(0)})`);

  
  const baseSpeed = config.bulletSpeedRange!.min + 
                    Math.random() * (config.bulletSpeedRange!.max - config.bulletSpeedRange!.min);
  
  switch (pattern) {
    case "simple_spread":
      const baseAngle = Math.atan2(landerY - ufo.y, landerX - ufo.x);
      const startAngle = baseAngle - (spreadAngle / 2) * (Math.PI / 180);
      
      for (let i = 0; i < bulletCount; i++) {
        const angle = startAngle + (i / (bulletCount - 1)) * spreadAngle * (Math.PI / 180);
        projectiles.push({
          id: `proj_${Date.now()}_${i}`,
          x: ufo.x,
          y: ufo.y,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
          lifetime: 4.0,
          active: true
        });
      }
      break;
      
    case "spiral":
      for (let i = 0; i < bulletCount; i++) {
        const angle = (i / bulletCount) * Math.PI * 4;
        const speed = baseSpeed * (0.8 + (i / bulletCount) * 0.4);
        projectiles.push({
          id: `proj_${Date.now()}_${i}`,
          x: ufo.x,
          y: ufo.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          lifetime: 4.0,
          active: true
        });
      }
      break;
      
    case "double_ring":
      const ring1Count = Math.floor(bulletCount * 0.4);
      const ring2Count = bulletCount - ring1Count;
      
      for (let i = 0; i < ring1Count; i++) {
        const angle = (i / ring1Count) * Math.PI * 2;
        projectiles.push({
          id: `proj_${Date.now()}_ring1_${i}`,
          x: ufo.x,
          y: ufo.y,
          vx: Math.cos(angle) * baseSpeed * 0.7,
          vy: Math.sin(angle) * baseSpeed * 0.7,
          lifetime: 4.0,
          active: true
        });
      }
      
      for (let i = 0; i < ring2Count; i++) {
        const angle = (i / ring2Count) * Math.PI * 2 + Math.PI / ring2Count;
        projectiles.push({
          id: `proj_${Date.now()}_ring2_${i}`,
          x: ufo.x,
          y: ufo.y,
          vx: Math.cos(angle) * baseSpeed * 1.2,
          vy: Math.sin(angle) * baseSpeed * 1.2,
          lifetime: 4.0,
          active: true
        });
      }
      break;
      
    case "multi_arc":
      const arcCount = 4;
      const bulletsPerArc = Math.floor(bulletCount / arcCount);
      
      for (let arc = 0; arc < arcCount; arc++) {
        const arcBaseAngle = (arc / arcCount) * Math.PI * 2;
        const arcSpread = 30 * (Math.PI / 180);
        
        for (let i = 0; i < bulletsPerArc; i++) {
          const angle = arcBaseAngle - arcSpread / 2 + (i / (bulletsPerArc - 1)) * arcSpread;
          projectiles.push({
            id: `proj_${Date.now()}_arc${arc}_${i}`,
            x: ufo.x,
            y: ufo.y,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed,
            lifetime: 4.0,
            active: true
          });
        }
      }
      break;
      
    case "alternating":
      for (let i = 0; i < bulletCount; i++) {
        const angle = (i / bulletCount) * Math.PI * 2;
        const speed = i % 2 === 0 ? baseSpeed * 0.6 : baseSpeed * 1.3;
        projectiles.push({
          id: `proj_${Date.now()}_${i}`,
          x: ufo.x,
          y: ufo.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          lifetime: 4.0,
          active: true
        });
      }
      break;
  }
  
  console.log(`  ✅ BURST: Generated ${projectiles.length} projectiles with speed ~${baseSpeed.toFixed(0)}`);
  return projectiles;
}
