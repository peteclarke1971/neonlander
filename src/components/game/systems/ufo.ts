import type { UFO, UFOBullet, UFOState, UFOSpawnData, UFOEvents, UFOConfig } from "../types/ufo";
import type { Asteroid, Projectile } from "../types/asteroids";
import { getScaledConfig, createUFOSeed } from "./ufoConfig";
import { splitAsteroid } from "./asteroids";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createUFOState(config: UFOConfig, baseSeed: number, mode: string): UFOState {
  const seed = createUFOSeed(baseSeed, mode, 0, 0);
  return {
    ufos: [],
    bullets: [],
    lastSpawnTime: 0,
    nextSpawnTime: 0,
    lastDeathTime: 0,
    spawnCount: 0,
    config,
    rng: mulberry32(seed)
  };
}

export function updateUFOState(
  state: UFOState,
  dt: number,
  currentTime: number,
  score: number,
  wave: number,
  playerX: number,
  playerY: number,
  worldWidth: number,
  worldHeight: number,
  smallAsteroidCount: number,
  baseSeed: number,
  mode: string,
  events?: UFOEvents
): void {
  if (!state.config.enabled) return;

  const scaledConfig = getScaledConfig(state.config, score, wave);
  
  // Update spawn timing
  if (state.nextSpawnTime === 0) {
    const interval = scaledConfig.spawnIntervalMin + 
      state.rng() * (scaledConfig.spawnIntervalMax - scaledConfig.spawnIntervalMin);
    state.nextSpawnTime = currentTime + interval;
  }

  // Check if we should spawn a UFO
  const timeSinceLastDeath = currentTime - state.lastDeathTime;
  const quietPeriod = scaledConfig.quietPeriodMin + 
    state.rng() * (scaledConfig.quietPeriodMax - scaledConfig.quietPeriodMin);
  
  const canSpawn = state.ufos.length < scaledConfig.maxSimultaneous &&
    currentTime >= state.nextSpawnTime &&
    timeSinceLastDeath >= quietPeriod;

  if (canSpawn) {
    spawnUFO(state, scaledConfig, score, worldWidth, worldHeight, smallAsteroidCount, baseSeed, mode, events);
    
    // Set next spawn time
    const interval = scaledConfig.spawnIntervalMin + 
      state.rng() * (scaledConfig.spawnIntervalMax - scaledConfig.spawnIntervalMin);
    state.nextSpawnTime = currentTime + interval;
    state.lastSpawnTime = currentTime;
  }

  // Update existing UFOs
  for (let i = state.ufos.length - 1; i >= 0; i--) {
    const ufo = state.ufos[i];
    updateUFO(ufo, dt, currentTime, playerX, playerY, worldWidth, worldHeight, scaledConfig, state, events);
    
    // Remove UFOs that have exited
    if (hasUFOExited(ufo, worldWidth, worldHeight)) {
      state.ufos.splice(i, 1);
    }
  }

  // Update UFO bullets
  updateUFOBullets(state.bullets, dt, worldWidth, worldHeight);
}

function spawnUFO(
  state: UFOState,
  config: UFOConfig,
  score: number,
  worldWidth: number,
  worldHeight: number,
  smallAsteroidCount: number,
  baseSeed: number,
  mode: string,
  events?: UFOEvents
): void {
  // Create new RNG for this spawn
  const spawnSeed = createUFOSeed(baseSeed, mode, Math.floor(score / 1000), state.spawnCount);
  const spawnRng = mulberry32(spawnSeed);
  
  // Determine UFO type
  let type: "large" | "small";
  if (score >= config.smallOnlyScoreThreshold) {
    type = "small";
  } else if (smallAsteroidCount <= 1) {
    // Classic gating: prefer small saucer when only tiny asteroids left
    type = spawnRng() < 0.7 ? "small" : "large";
  } else {
    type = spawnRng() < 0.3 ? "small" : "large";
  }

  // Choose entry and exit edges
  const edges = ["left", "right", "top", "bottom"] as const;
  const entryEdge = edges[Math.floor(spawnRng() * edges.length)];
  const exitEdge = getOppositeEdge(entryEdge);

  // Calculate spawn position
  const { x, y, vx, vy, targetY } = calculateSpawnPosition(
    entryEdge,
    exitEdge,
    worldWidth,
    worldHeight,
    type,
    config,
    spawnRng
  );

  // Create UFO
  const ufo: UFO = {
    id: `ufo_${state.spawnCount}`,
    type,
    x,
    y,
    vx,
    vy,
    targetY,
    swayPhase: spawnRng() * Math.PI * 2,
    lastFireTime: 0,
    nextFireTime: 0,
    entryEdge,
    exitEdge,
    alive: true,
    lastPingTime: 0,
    nextPingTime: 0.7 + spawnRng() * 0.5 // First ping in 0.7-1.2s
  };

  state.ufos.push(ufo);
  state.spawnCount++;

  events?.onSpawn?.(ufo);
}

function getOppositeEdge(edge: "left" | "right" | "top" | "bottom"): "left" | "right" | "top" | "bottom" {
  switch (edge) {
    case "left": return "right";
    case "right": return "left";
    case "top": return "bottom";
    case "bottom": return "top";
  }
}

function calculateSpawnPosition(
  entryEdge: "left" | "right" | "top" | "bottom",
  exitEdge: "left" | "right" | "top" | "bottom",
  worldWidth: number,
  worldHeight: number,
  type: "large" | "small",
  config: UFOConfig,
  rng: () => number
): { x: number; y: number; vx: number; vy: number; targetY: number } {
  const speed = type === "large" 
    ? config.largeSpeed.min + rng() * (config.largeSpeed.max - config.largeSpeed.min)
    : config.smallSpeed.min + rng() * (config.smallSpeed.max - config.smallSpeed.min);

  const swayAmplitude = config.swayAmplitude.min + rng() * (config.swayAmplitude.max - config.swayAmplitude.min);

  let x, y, vx, vy, targetY;

  switch (entryEdge) {
    case "left":
      x = -30;
      y = worldHeight * 0.2 + rng() * worldHeight * 0.6;
      vx = speed;
      vy = 0;
      targetY = y;
      break;
    case "right":
      x = worldWidth + 30;
      y = worldHeight * 0.2 + rng() * worldHeight * 0.6;
      vx = -speed;
      vy = 0;
      targetY = y;
      break;
    case "top":
      x = worldWidth * 0.2 + rng() * worldWidth * 0.6;
      y = -30;
      vx = 0;
      vy = speed;
      targetY = y + swayAmplitude;
      break;
    case "bottom":
      x = worldWidth * 0.2 + rng() * worldWidth * 0.6;
      y = worldHeight + 30;
      vx = 0;
      vy = -speed;
      targetY = y - swayAmplitude;
      break;
  }

  return { x, y, vx, vy, targetY };
}

function updateUFO(
  ufo: UFO,
  dt: number,
  currentTime: number,
  playerX: number,
  playerY: number,
  worldWidth: number,
  worldHeight: number,
  config: UFOConfig,
  state: UFOState,
  events?: UFOEvents
): void {
  // Update sway
  const swayPeriod = config.swayPeriod.min + state.rng() * (config.swayPeriod.max - config.swayPeriod.min);
  ufo.swayPhase += dt * (Math.PI * 2) / swayPeriod;
  
  const swayAmplitude = config.swayAmplitude.min + state.rng() * (config.swayAmplitude.max - config.swayAmplitude.min);
  const swayOffset = Math.sin(ufo.swayPhase) * swayAmplitude;

  // Update position with sway
  ufo.x += ufo.vx * dt;
  ufo.y = ufo.targetY + swayOffset;

  // Screen wrapping
  if (ufo.x < -50) ufo.x = worldWidth + 50;
  if (ufo.x > worldWidth + 50) ufo.x = -50;
  if (ufo.y < -50) ufo.y = worldHeight + 50;
  if (ufo.y > worldHeight + 50) ufo.y = -50;

  // Handle ping sound
  if (currentTime >= ufo.nextPingTime) {
    events?.onPing?.(ufo);
    ufo.lastPingTime = currentTime;
    ufo.nextPingTime = currentTime + 0.7 + state.rng() * 0.5;
  }

  // Handle firing
  if (ufo.nextFireTime === 0) {
    const fireInterval = ufo.type === "large"
      ? config.largeFireInterval.min + state.rng() * (config.largeFireInterval.max - config.largeFireInterval.min)
      : config.smallFireInterval.min + state.rng() * (config.smallFireInterval.max - config.smallFireInterval.min);
    ufo.nextFireTime = currentTime + fireInterval;
  }

  if (currentTime >= ufo.nextFireTime && state.bullets.length < config.maxBullets) {
    fireUFOBullet(ufo, playerX, playerY, worldWidth, worldHeight, config, state, events);
    
    const fireInterval = ufo.type === "large"
      ? config.largeFireInterval.min + state.rng() * (config.largeFireInterval.max - config.largeFireInterval.min)
      : config.smallFireInterval.min + state.rng() * (config.smallFireInterval.max - config.smallFireInterval.min);
    ufo.nextFireTime = currentTime + fireInterval;
    ufo.lastFireTime = currentTime;
  }
}

function fireUFOBullet(
  ufo: UFO,
  playerX: number,
  playerY: number,
  worldWidth: number,
  worldHeight: number,
  config: UFOConfig,
  state: UFOState,
  events?: UFOEvents
): void {
  const speed = config.bulletSpeed.min + state.rng() * (config.bulletSpeed.max - config.bulletSpeed.min);
  const lifetime = config.bulletLifetime.min + state.rng() * (config.bulletLifetime.max - config.bulletLifetime.min);

  let angle: number;

  if (ufo.type === "large") {
    // Large saucer fires randomly with jitter
    angle = state.rng() * Math.PI * 2;
    const jitter = (state.rng() - 0.5) * (config.largeAimCone * Math.PI / 180);
    angle += jitter;
  } else {
    // Small saucer aims at player
    let targetX = playerX;
    let targetY = playerY;

    // Deluxe mode: aim through screen wrap
    if (!config.classicMode) {
      // Find shortest path considering screen wrap
      const dx1 = playerX - ufo.x;
      const dx2 = playerX - ufo.x + worldWidth;
      const dx3 = playerX - ufo.x - worldWidth;
      
      const distances = [
        { dx: dx1, dy: playerY - ufo.y },
        { dx: dx2, dy: playerY - ufo.y },
        { dx: dx3, dy: playerY - ufo.y }
      ];
      
      const closest = distances.reduce((min, curr) => 
        (curr.dx * curr.dx + curr.dy * curr.dy) < (min.dx * min.dx + min.dy * min.dy) ? curr : min
      );
      
      targetX = ufo.x + closest.dx;
      targetY = ufo.y + closest.dy;
    }

    angle = Math.atan2(targetY - ufo.y, targetX - ufo.x);
    
    // Apply aim cone inaccuracy based on score
    const aimCone = config.smallAimConeEarly + 
      (config.smallAimConeLate - config.smallAimConeEarly) * Math.min(state.spawnCount / 20, 1);
    const jitter = (state.rng() - 0.5) * (aimCone * Math.PI / 180);
    angle += jitter;
  }

  const bullet: UFOBullet = {
    id: `ufo_bullet_${ufo.id}_${Date.now()}`,
    x: ufo.x,
    y: ufo.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: lifetime,
    fromType: ufo.type
  };

  state.bullets.push(bullet);
  events?.onShotFired?.(ufo, bullet);
}

function hasUFOExited(ufo: UFO, worldWidth: number, worldHeight: number): boolean {
  const margin = 100;
  return ufo.x < -margin || ufo.x > worldWidth + margin || 
         ufo.y < -margin || ufo.y > worldHeight + margin;
}

function updateUFOBullets(bullets: UFOBullet[], dt: number, worldWidth: number, worldHeight: number): void {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    
    // Update position
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    // Screen wrapping
    if (bullet.x < 0) bullet.x = worldWidth;
    if (bullet.x > worldWidth) bullet.x = 0;
    if (bullet.y < 0) bullet.y = worldHeight;
    if (bullet.y > worldHeight) bullet.y = 0;

    // Remove expired bullets
    if (bullet.life <= 0) {
      bullets.splice(i, 1);
    }
  }
}

// Collision detection functions
export function checkUFOPlayerCollision(
  ufos: UFO[],
  playerX: number,
  playerY: number,
  playerRadius: number
): UFO | null {
  for (const ufo of ufos) {
    const dx = playerX - ufo.x;
    const dy = playerY - ufo.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ufoRadius = ufo.type === "large" ? 20 : 12;
    
    if (distance < ufoRadius + playerRadius) {
      return ufo;
    }
  }
  return null;
}

export function checkUFOBulletPlayerCollision(
  bullets: UFOBullet[],
  playerX: number,
  playerY: number,
  playerRadius: number
): UFOBullet | null {
  for (const bullet of bullets) {
    const dx = playerX - bullet.x;
    const dy = playerY - bullet.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 3 + playerRadius) {
      return bullet;
    }
  }
  return null;
}

export function checkPlayerBulletUFOCollision(
  playerBullets: Projectile[],
  ufos: UFO[]
): { ufo: UFO; bulletIndex: number } | null {
  for (let i = 0; i < playerBullets.length; i++) {
    const bullet = playerBullets[i];
    
    for (const ufo of ufos) {
      const dx = bullet.x - ufo.x;
      const dy = bullet.y - ufo.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const ufoRadius = ufo.type === "large" ? 20 : 12;
      
      if (distance < ufoRadius + 2) {
        return { ufo, bulletIndex: i };
      }
    }
  }
  return null;
}

export function checkUFOBulletAsteroidCollision(
  ufoBullets: UFOBullet[],
  asteroids: Asteroid[],
  rng: () => number
): { bulletIndex: number; asteroidIndex: number; newAsteroids: Asteroid[] } | null {
  for (let i = 0; i < ufoBullets.length; i++) {
    const bullet = ufoBullets[i];
    
    for (let j = 0; j < asteroids.length; j++) {
      const asteroid = asteroids[j];
      const dx = bullet.x - asteroid.x;
      const dy = bullet.y - asteroid.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < asteroid.r + 3) {
        // Import splitAsteroid from asteroids system
        const { splitAsteroid } = require("./asteroids");
        const newAsteroids = splitAsteroid(asteroid, rng);
        return { bulletIndex: i, asteroidIndex: j, newAsteroids };
      }
    }
  }
  return null;
}

// Drawing functions
export function drawUFOs(ctx: CanvasRenderingContext2D, ufos: UFO[]): void {
  for (const ufo of ufos) {
    drawUFO(ctx, ufo);
  }
}

function drawUFO(ctx: CanvasRenderingContext2D, ufo: UFO): void {
  ctx.save();
  
  const glowColor = ufo.type === "large" ? "#fbbf24" : "#ef4444"; // amber-400 : red-500
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 2;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 8;
  
  ctx.translate(ufo.x, ufo.y);
  
  // Draw UFO shape
  if (ufo.type === "large") {
    // Large saucer - more complex shape
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(0, -3, 12, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Detail lines
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(15, 0);
    ctx.stroke();
  } else {
    // Small saucer - simpler shape
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(0, -2, 8, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.restore();
}

export function drawUFOBullets(ctx: CanvasRenderingContext2D, bullets: UFOBullet[]): void {
  ctx.save();
  
  for (const bullet of bullets) {
    const glowColor = bullet.fromType === "large" ? "#fbbf24" : "#ef4444";
    ctx.fillStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 6;
    
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}