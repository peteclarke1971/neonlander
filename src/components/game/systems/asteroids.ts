import type { Asteroid, Projectile } from "../types/asteroids";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateAsteroidShape(size: "large" | "medium" | "small", rng: () => number): { x: number; y: number }[] {
  const baseRadius = size === "large" ? 40 : size === "medium" ? 25 : 15;
  const vertexCount = 8 + Math.floor(rng() * 4); // 8-11 vertices for irregular shape
  const points: { x: number; y: number }[] = [];
  
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2;
    const radiusVariation = 0.7 + rng() * 0.6; // 70%-130% of base radius
    const radius = baseRadius * radiusVariation;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  
  return points;
}

export function generateAsteroidField(wave: number, worldWidth: number, worldHeight: number, seed: number): Asteroid[] {
  const rng = mulberry32(seed);
  const asteroidCount = Math.min(4 + wave * 2, 16); // Start with 4, add 2 per wave, max 16
  const asteroids: Asteroid[] = [];
  
  for (let i = 0; i < asteroidCount; i++) {
    const size: Asteroid["size"] = rng() < 0.6 ? "large" : rng() < 0.8 ? "medium" : "small";
    const radius = size === "large" ? 40 : size === "medium" ? 25 : 15;
    
    // Spawn away from center (where player starts)
    const centerX = worldWidth / 2;
    const centerY = worldHeight / 2;
    let x, y;
    do {
      x = rng() * worldWidth;
      y = rng() * worldHeight;
    } while (Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) < 150); // Min distance from center
    
    const speed = 30 + rng() * 40; // Base speed
    const angle = rng() * Math.PI * 2;
    
    asteroids.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      angle: rng() * Math.PI * 2,
      av: (rng() - 0.5) * 2, // Angular velocity
      size,
      points: generateAsteroidShape(size, rng)
    });
  }
  
  return asteroids;
}

export function updateAsteroids(asteroids: Asteroid[], dt: number, worldWidth: number, worldHeight: number) {
  for (const asteroid of asteroids) {
    // Update position
    asteroid.x += asteroid.vx * dt;
    asteroid.y += asteroid.vy * dt;
    
    // Wrap around screen edges
    if (asteroid.x < -asteroid.r) asteroid.x = worldWidth + asteroid.r;
    if (asteroid.x > worldWidth + asteroid.r) asteroid.x = -asteroid.r;
    if (asteroid.y < -asteroid.r) asteroid.y = worldHeight + asteroid.r;
    if (asteroid.y > worldHeight + asteroid.r) asteroid.y = -asteroid.r;
    
    // Update rotation
    asteroid.angle += asteroid.av * dt;
  }
}

export function splitAsteroid(asteroid: Asteroid, rng: () => number): Asteroid[] {
  if (asteroid.size === "small") return []; // Small asteroids don't split
  
  const newSize: Asteroid["size"] = asteroid.size === "large" ? "medium" : "small";
  const newRadius = newSize === "medium" ? 25 : 15;
  const splitCount = 2 + Math.floor(rng()); // 2-3 pieces
  const fragments: Asteroid[] = [];
  
  for (let i = 0; i < splitCount; i++) {
    const splitAngle = (i / splitCount) * Math.PI * 2 + (rng() - 0.5) * Math.PI * 0.5;
    const speed = 40 + rng() * 30;
    
    fragments.push({
      x: asteroid.x + (rng() - 0.5) * 20,
      y: asteroid.y + (rng() - 0.5) * 20,
      vx: asteroid.vx * 1.4 + Math.cos(splitAngle) * speed,
      vy: asteroid.vy * 1.4 + Math.sin(splitAngle) * speed,
      r: newRadius,
      angle: rng() * Math.PI * 2,
      av: (rng() - 0.5) * 3,
      size: newSize,
      points: generateAsteroidShape(newSize, rng)
    });
  }
  
  return fragments;
}

export function updateProjectiles(projectiles: Projectile[], dt: number, worldWidth: number, worldHeight: number) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    
    // Update position
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.life -= dt;
    
    // Wrap around screen edges
    if (proj.x < 0) proj.x = worldWidth;
    if (proj.x > worldWidth) proj.x = 0;
    if (proj.y < 0) proj.y = worldHeight;
    if (proj.y > worldHeight) proj.y = 0;
    
    // Remove expired projectiles
    if (proj.life <= 0) {
      projectiles.splice(i, 1);
    }
  }
}

export function checkProjectileAsteroidCollisions(
  projectiles: Projectile[],
  asteroids: Asteroid[],
  rng: () => number
): { destroyedAsteroids: number[]; destroyedProjectiles: number[]; newAsteroids: Asteroid[]; score: number } {
  const destroyedAsteroids: number[] = [];
  const destroyedProjectiles: number[] = [];
  const newAsteroids: Asteroid[] = [];
  let score = 0;
  
  for (let i = 0; i < projectiles.length; i++) {
    const proj = projectiles[i];
    
    for (let j = 0; j < asteroids.length; j++) {
      const asteroid = asteroids[j];
      const dx = proj.x - asteroid.x;
      const dy = proj.y - asteroid.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < asteroid.r) {
        // Collision detected
        destroyedProjectiles.push(i);
        destroyedAsteroids.push(j);
        
        // Add score based on asteroid size
        const scoreValue = asteroid.size === "large" ? 20 : asteroid.size === "medium" ? 50 : 100;
        score += scoreValue;
        
        // Split asteroid if not small
        const fragments = splitAsteroid(asteroid, rng);
        newAsteroids.push(...fragments);
        
        break; // Projectile can only hit one asteroid
      }
    }
  }
  
  return { destroyedAsteroids, destroyedProjectiles, newAsteroids, score };
}

export function checkPlayerAsteroidCollision(
  playerX: number,
  playerY: number,
  playerRadius: number,
  asteroids: Asteroid[]
): boolean {
  for (const asteroid of asteroids) {
    const dx = playerX - asteroid.x;
    const dy = playerY - asteroid.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < asteroid.r + playerRadius) {
      return true;
    }
  }
  return false;
}

export function drawAsteroids(ctx: CanvasRenderingContext2D, asteroids: Asteroid[], neonColor: string) {
  ctx.save();
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  // Add glow effect for brighter vectors like lander
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 8;
  
  for (const asteroid of asteroids) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.angle);
    
    ctx.beginPath();
    if (asteroid.points.length > 0) {
      ctx.moveTo(asteroid.points[0].x, asteroid.points[0].y);
      for (let i = 1; i < asteroid.points.length; i++) {
        ctx.lineTo(asteroid.points[i].x, asteroid.points[i].y);
      }
      ctx.closePath();
    }
    // Fill to occlude stars behind asteroids
    ctx.fillStyle = "black";
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[], neonColor: string) {
  ctx.save();
  ctx.fillStyle = neonColor;
  ctx.globalAlpha = 0.9;
  // Add glow effect for brighter vectors like lander
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 6;
  
  for (const proj of projectiles) {
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
}