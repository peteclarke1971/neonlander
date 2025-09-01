import type { ColorAsteroid, ColorProjectile } from "../types/asteroidsColor";

// Color palette for the three phases
export const ASTEROID_COLORS = {
  green: "#00FF7A",
  amber: "#FFC400", 
  red: "#FF3750"
} as const;

// Seeded random number generator (Mulberry32)
export function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Mix seeds for deterministic randomness
export function mixSeed(baseSeed: number, category: string, wave: number, index: number): number {
  let hash = baseSeed;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash + category.charCodeAt(i)) & 0xffffffff;
  }
  hash = ((hash << 5) - hash + wave) & 0xffffffff;
  hash = ((hash << 5) - hash + index) & 0xffffffff;
  return Math.abs(hash);
}

// Generate irregular asteroid shape
export function generateAsteroidShape(size: "large" | "medium" | "small" | "giant", rng: () => number): { x: number; y: number }[] {
  const baseRadius = size === "giant" ? 66 : size === "large" ? 40 : size === "medium" ? 25 : 15;
  const vertexCount = size === "giant" ? (10 + Math.floor(rng() * 5)) : (8 + Math.floor(rng() * 4)); // 10-14 for giant, 8-11 for others
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

// Create a new asteroid
export function createAsteroid(
  size: "large" | "medium" | "small" | "giant",
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: "green" | "amber" | "red",
  rng: () => number
): ColorAsteroid {
  const baseRadius = size === "giant" ? 66 : size === "large" ? 40 : size === "medium" ? 25 : 15;
  
  return {
    x,
    y,
    vx,
    vy,
    r: baseRadius,
    angle: rng() * Math.PI * 2,
    av: (rng() - 0.5) * 4, // angular velocity
    size,
    color,
    points: generateAsteroidShape(size, rng),
    penaltyCooldown: 0
  };
}

// Generate asteroid field for a wave with progressive color distribution
export function generateAsteroidField(
  wave: number,
  worldWidth: number,
  worldHeight: number,
  seed: number
): ColorAsteroid[] {
  const asteroids: ColorAsteroid[] = [];
  const count = Math.min(4 + wave * 2, 16); // Max 16 asteroids
  
  // Progressive color distribution based on wave
  let greenPercent: number, amberPercent: number, redPercent: number;
  
  if (wave === 1) {
    greenPercent = 0.8; amberPercent = 0.1; redPercent = 0.1;
  } else if (wave === 2) {
    greenPercent = 0.7; amberPercent = 0.15; redPercent = 0.15;
  } else if (wave === 3) {
    greenPercent = 0.6; amberPercent = 0.2; redPercent = 0.2;
  } else if (wave === 4) {
    greenPercent = 0.5; amberPercent = 0.25; redPercent = 0.25;
  } else if (wave === 5) {
    greenPercent = 0.4; amberPercent = 0.3; redPercent = 0.3;
  } else {
    greenPercent = 0.33; amberPercent = 0.33; redPercent = 0.34;
  }
  
  for (let i = 0; i < count; i++) {
    const colorSeed = mixSeed(seed, "COLOR", wave, i);
    const rng = mulberry32(colorSeed);
    
    // Assign colors based on progressive percentages
    const colorRoll = rng();
    let color: "green" | "amber" | "red";
    if (colorRoll < greenPercent) {
      color = "green";
    } else if (colorRoll < greenPercent + amberPercent) {
      color = "amber";
    } else {
      color = "red";
    }
    
    // Generate safe spawn position (at least 150px from center)
    let x, y;
    do {
      x = rng() * worldWidth;
      y = rng() * worldHeight;
    } while (
      Math.sqrt((x - worldWidth/2)**2 + (y - worldHeight/2)**2) < 150
    );
    
    // Random velocity
    const speed = 30 + rng() * 40; // 30-70 pixels/second
    const angle = rng() * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    // Size distribution: 60% large, 20% medium, 20% small initially
    let size: "large" | "medium" | "small";
    const sizeRoll = rng();
    if (sizeRoll < 0.6) size = "large";
    else if (sizeRoll < 0.8) size = "medium";
    else size = "small";
    
    asteroids.push(createAsteroid(size, x, y, vx, vy, color, rng));
  }
  
  return asteroids;
}

// Update asteroids position and rotation
export function updateAsteroids(
  asteroids: ColorAsteroid[],
  dt: number,
  worldWidth: number,
  worldHeight: number
): void {
  for (const asteroid of asteroids) {
    // Update position
    asteroid.x += asteroid.vx * dt;
    asteroid.y += asteroid.vy * dt;
    
    // Update rotation
    asteroid.angle += asteroid.av * dt;
    
    // Screen wrapping
    if (asteroid.x < 0) asteroid.x += worldWidth;
    if (asteroid.x > worldWidth) asteroid.x -= worldWidth;
    if (asteroid.y < 0) asteroid.y += worldHeight;
    if (asteroid.y > worldHeight) asteroid.y -= worldHeight;
    
    // Update penalty cooldown
    if (asteroid.penaltyCooldown && asteroid.penaltyCooldown > 0) {
      asteroid.penaltyCooldown -= dt * 1000; // Convert to ms
    }
  }
}

// Split asteroid when correctly destroyed
export function splitAsteroid(asteroid: ColorAsteroid, rng: () => number): ColorAsteroid[] {
  const pieces: ColorAsteroid[] = [];
  
  if (asteroid.size === "giant") {
    // Giant splits into 8 small pieces in a ring pattern
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + (rng() - 0.5) * 0.35; // ±10° jitter
      const speed = 60 + rng() * 40; // Faster for dramatic effect
      const distance = 30; // Spawn distance from parent
      
      pieces.push(createAsteroid(
        "small",
        asteroid.x + Math.cos(angle) * distance,
        asteroid.y + Math.sin(angle) * distance,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        asteroid.color,
        rng
      ));
    }
  } else if (asteroid.size === "large") {
    // Large splits into 2-3 medium pieces
    const count = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const speed = Math.sqrt(asteroid.vx**2 + asteroid.vy**2) * 1.4;
      
      pieces.push(createAsteroid(
        "medium",
        asteroid.x,
        asteroid.y,
        Math.cos(angle) * speed + asteroid.vx * 0.3,
        Math.sin(angle) * speed + asteroid.vy * 0.3,
        asteroid.color,
        rng
      ));
    }
  } else if (asteroid.size === "medium") {
    // Medium splits into 2-3 small pieces
    const count = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const speed = Math.sqrt(asteroid.vx**2 + asteroid.vy**2) * 1.4;
      
      pieces.push(createAsteroid(
        "small",
        asteroid.x,
        asteroid.y,
        Math.cos(angle) * speed + asteroid.vx * 0.3,
        Math.sin(angle) * speed + asteroid.vy * 0.3,
        asteroid.color,
        rng
      ));
    }
  }
  // Small asteroids don't split
  
  return pieces;
}

// Apply wrong color penalty
export function applyWrongColorPenalty(
  asteroid: ColorAsteroid,
  difficulty: string,
  rng: () => number,
  playerX: number,
  playerY: number
): ColorAsteroid[] {
  const newAsteroids: ColorAsteroid[] = [];
  
  // Don't apply penalty if cooldown is active
  if (asteroid.penaltyCooldown && asteroid.penaltyCooldown > 0) {
    return [];
  }
  
  // Set cooldown to prevent chain reactions
  asteroid.penaltyCooldown = 300; // 300ms
  
  // Fixed behavior: Amber asteroids always clone, Red asteroids always size up
  if (asteroid.color === "amber") {
    // Clone asteroid at same size
    const offset = 18;
    const angle = rng() * Math.PI * 2;
    const newX = asteroid.x + Math.cos(angle) * offset;
    const newY = asteroid.y + Math.sin(angle) * offset;
    
    // Avoid spawning too close to player
    const distToPlayer = Math.sqrt((newX - playerX)**2 + (newY - playerY)**2);
    if (distToPlayer > 24) {
      const clone = createAsteroid(
        asteroid.size,
        newX,
        newY,
        asteroid.vx + (rng() - 0.5) * 20, // Slight velocity jitter
        asteroid.vy + (rng() - 0.5) * 20,
        asteroid.color,
        rng
      );
      newAsteroids.push(clone);
    }
  } else if (asteroid.color === "red") {
    // Size up the asteroid
    if (asteroid.size === "small") {
      asteroid.size = "medium";
      asteroid.r = 25;
      asteroid.points = generateAsteroidShape("medium", rng);
    } else if (asteroid.size === "medium") {
      asteroid.size = "large";
      asteroid.r = 40;
      asteroid.points = generateAsteroidShape("large", rng);
    } else if (asteroid.size === "large") {
      asteroid.size = "giant";
      asteroid.r = 66;
      asteroid.points = generateAsteroidShape("giant", rng);
    } else if (asteroid.size === "giant") {
      // Split into 2 large asteroids if already giant
      for (let i = 0; i < 2; i++) {
        const angle = rng() * Math.PI * 2;
        const distance = 30;
        const newX = asteroid.x + Math.cos(angle) * distance;
        const newY = asteroid.y + Math.sin(angle) * distance;
        
        const distToPlayer = Math.sqrt((newX - playerX)**2 + (newY - playerY)**2);
        if (distToPlayer > 24) {
          const clone = createAsteroid(
            "large",
            newX,
            newY,
            Math.cos(angle) * 40,
            Math.sin(angle) * 40,
            asteroid.color,
            rng
          );
          newAsteroids.push(clone);
        }
      }
    }
  }
  
  return newAsteroids;
}

// Update projectiles
export function updateProjectiles(
  projectiles: ColorProjectile[],
  dt: number,
  worldWidth: number,
  worldHeight: number
): void {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    
    // Update position
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    
    // Screen wrapping
    if (projectile.x < 0) projectile.x += worldWidth;
    if (projectile.x > worldWidth) projectile.x -= worldWidth;
    if (projectile.y < 0) projectile.y += worldHeight;
    if (projectile.y > worldHeight) projectile.y -= worldHeight;
    
    // Update lifetime
    projectile.life -= dt;
    if (projectile.life <= 0) {
      projectiles.splice(i, 1);
    }
  }
}

// Check projectile-asteroid collisions with color logic
export function checkProjectileAsteroidCollisions(
  projectiles: ColorProjectile[],
  asteroids: ColorAsteroid[],
  targetColor: "green" | "amber" | "red",
  difficulty: string,
  playerX: number,
  playerY: number,
  rng: () => number
): {
  destroyedAsteroids: number[];
  destroyedProjectiles: number[];
  newAsteroids: ColorAsteroid[];
  score: number;
  wrongHits: { x: number; y: number }[];
} {
  const destroyedAsteroids: number[] = [];
  const destroyedProjectiles: number[] = [];
  const newAsteroids: ColorAsteroid[] = [];
  const wrongHits: { x: number; y: number }[] = [];
  let score = 0;
  
  for (let i = 0; i < projectiles.length; i++) {
    const projectile = projectiles[i];
    
    for (let j = 0; j < asteroids.length; j++) {
      const asteroid = asteroids[j];
      
      // Check collision
      const dx = projectile.x - asteroid.x;
      const dy = projectile.y - asteroid.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < asteroid.r + 2) { // 2px projectile radius
        if (asteroid.color === targetColor) {
          // Correct color - destroy and split
          destroyedAsteroids.push(j);
          destroyedProjectiles.push(i);
          
          // Score based on size
          const scoreMap = { giant: 150, large: 20, medium: 50, small: 100 };
          score += scoreMap[asteroid.size];
          
          // Split asteroid
          const pieces = splitAsteroid(asteroid, rng);
          newAsteroids.push(...pieces);
        } else {
          // Wrong color - apply penalty
          destroyedProjectiles.push(i);
          wrongHits.push({ x: projectile.x, y: projectile.y });
          
          // Apply penalty and get new asteroids
          const penaltyAsteroids = applyWrongColorPenalty(asteroid, difficulty, rng, playerX, playerY);
          newAsteroids.push(...penaltyAsteroids);
          
          // Score penalty
          score -= 25;
        }
        break; // Projectile can only hit one asteroid
      }
    }
  }
  
  return {
    destroyedAsteroids: [...new Set(destroyedAsteroids)],
    destroyedProjectiles: [...new Set(destroyedProjectiles)],
    newAsteroids,
    score,
    wrongHits
  };
}

// Check player-asteroid collision
export function checkPlayerAsteroidCollision(
  playerX: number,
  playerY: number,
  playerRadius: number,
  asteroids: ColorAsteroid[]
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

// Get score for asteroid size
export function getAsteroidScore(size: "large" | "medium" | "small" | "giant"): number {
  const scoreMap = { giant: 150, large: 20, medium: 50, small: 100 };
  return scoreMap[size];
}

// Render colored asteroids
export function drawColorAsteroids(
  ctx: CanvasRenderingContext2D,
  asteroids: ColorAsteroid[]
): void {
  for (const asteroid of asteroids) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.angle);
    
    // Set color based on asteroid color
    const color = ASTEROID_COLORS[asteroid.color];
    ctx.strokeStyle = color;
    ctx.fillStyle = "black"; // Keep black fill to occlude stars
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    
    // Draw asteroid shape
    ctx.beginPath();
    const points = asteroid.points;
    if (points.length > 0) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
    }
    
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
  }
}

// Render projectiles (keep standard neon green)
export function drawColorProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: ColorProjectile[],
  neonColor: string
): void {
  ctx.strokeStyle = neonColor;
  ctx.fillStyle = neonColor;
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 6;
  
  for (const projectile of projectiles) {
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
