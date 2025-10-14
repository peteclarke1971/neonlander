import { generateAsteroidShape } from "./asteroids";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FieldAsteroid {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  av: number;
  size: "small" | "medium" | "large";
  points: { x: number; y: number }[];
  nearMissTriggered: boolean;
}

export interface AsteroidFieldState {
  active: boolean;
  phase: "entry" | "active" | "exit" | "none";
  phaseTimer: number;
  startX: number;
  endX: number;
  asteroids: FieldAsteroid[];
  spawnTimer: number;
  nextSpawnDelay: number;
  nearMissCount: number;
  nearMissThreshold: number;
  clearedWithoutHit: boolean;
  difficulty: number;
  seed: number;
  lastAsteroidId: number;
}

export function initAsteroidField(startX: number, difficulty: number, seed: number): AsteroidFieldState {
  const fieldState = {
    active: true,
    phase: "entry" as const,
    phaseTimer: 0,
    startX,
    endX: startX + 4800, // About 6 chunks (50% longer than 3200px)
    asteroids: [] as FieldAsteroid[],
    spawnTimer: 0,
    nextSpawnDelay: 2.0,
    nearMissCount: 0,
    nearMissThreshold: 15,
    clearedWithoutHit: true,
    difficulty,
    seed,
    lastAsteroidId: 0
  };
  
  // Pre-spawn asteroids to create immediate dense field
  const initialRng = mulberry32(seed);
  const initialCount = 23; // Start with 23 asteroids immediately (50% more density)
  for (let i = 0; i < initialCount; i++) {
    const x = startX + 100 + initialRng() * 3600; // Spread across longer field width
    const y = 20 + initialRng() * 1350; // Spread from very top (y=20) to bottom (y=1370)
    const sizeRoll = initialRng();
    const size: "small" | "medium" | "large" = 
      sizeRoll < 0.5 ? "small" : sizeRoll < 0.85 ? "medium" : "large";
    
    const radius = size === "large" ? 40 : size === "medium" ? 25 : 15;
    const speedMult = size === "large" ? 0.6 : size === "medium" ? 0.8 : 1.0;
    const baseSpeed = 20 + initialRng() * 30;
    const angleVariation = (initialRng() - 0.5) * Math.PI / 6;
    const vx = -baseSpeed * speedMult * Math.cos(angleVariation);
    const vy = baseSpeed * speedMult * Math.sin(angleVariation);
    const maxSpin = size === "large" ? 1 : size === "medium" ? 2 : 3;
    const av = (initialRng() - 0.5) * maxSpin;
    
    const asteroidSeed = seed + fieldState.lastAsteroidId;
    const shapeRng = mulberry32(asteroidSeed);
    const points = generateAsteroidShape(size, shapeRng);
    
    fieldState.asteroids.push({
      id: `field-asteroid-${fieldState.lastAsteroidId++}`,
      x,
      y,
      vx,
      vy,
      r: radius,
      angle: initialRng() * Math.PI * 2,
      av,
      size,
      points,
      nearMissTriggered: false
    });
  }
  
  return fieldState;
}

export function spawnFieldAsteroid(
  state: AsteroidFieldState,
  playerX: number,
  viewWidth: number,
  rng: () => number
): void {
  const { difficulty, phase } = state;
  
  // Size distribution based on difficulty and phase
  let sizeRoll = rng();
  let size: "small" | "medium" | "large";
  
  if (phase === "entry") {
    // Entry: mostly small and medium
    size = sizeRoll < 0.6 ? "small" : "medium";
  } else {
    // Active: scale with difficulty
    const difficultyFactor = Math.min(difficulty / 10, 1);
    const smallChance = 0.6 - difficultyFactor * 0.2;
    const mediumChance = 0.3 + difficultyFactor * 0.1;
    
    if (sizeRoll < smallChance) size = "small";
    else if (sizeRoll < smallChance + mediumChance) size = "medium";
    else size = "large";
  }
  
  // Size-based properties
  const radius = size === "large" ? 40 : size === "medium" ? 25 : 15;
  const speedMult = size === "large" ? 0.6 : size === "medium" ? 0.8 : 1.0;
  
  // Spawn ahead of player, off-screen
  const spawnX = playerX + viewWidth + 100 + rng() * 200;
  // Spawn above terrain - lower Y values = higher on screen
  const spawnY = 20 + rng() * 1350; // Spread from very top (y=20) to bottom (y=1370)
  
  // Drift velocity: mostly horizontal (left), slight vertical variation
  const baseSpeed = 20 + rng() * 30;
  const angleVariation = (rng() - 0.5) * Math.PI / 6; // ±30 degrees
  const vx = -baseSpeed * speedMult * Math.cos(angleVariation);
  const vy = baseSpeed * speedMult * Math.sin(angleVariation);
  
  // Angular velocity for spin
  const maxSpin = size === "large" ? 1 : size === "medium" ? 2 : 3;
  const av = (rng() - 0.5) * maxSpin;
  
  // Generate shape
  const asteroidSeed = state.seed + state.lastAsteroidId;
  const shapeRng = mulberry32(asteroidSeed);
  const points = generateAsteroidShape(size, shapeRng);
  
  state.asteroids.push({
    id: `field-asteroid-${state.lastAsteroidId++}`,
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    r: radius,
    angle: rng() * Math.PI * 2,
    av,
    size,
    points,
    nearMissTriggered: false
  });
}

export function updateAsteroidField(
  state: AsteroidFieldState,
  dt: number,
  playerX: number,
  playerY: number,
  shipRadius: number,
  viewWidth: number
): { collision: boolean; nearMiss: boolean; bonusScore: number; collidingAsteroid: FieldAsteroid | null } {
  const rng = mulberry32(state.seed + Math.floor(state.phaseTimer * 1000));
  
  let collision = false;
  let nearMiss = false;
  let bonusScore = 0;
  
  // Update phase timer
  state.phaseTimer += dt;
  
  // Phase transitions based on player position (adjusted for longer field)
  if (state.phase === "entry" && playerX > state.startX + 1200) {
    state.phase = "active";
  } else if (state.phase === "active" && playerX > state.endX - 1200) {
    state.phase = "exit";
  }
  
  // Update spawn timer and spawn new asteroids
  if (state.phase !== "exit") {
    state.spawnTimer += dt;
    
    if (state.spawnTimer >= state.nextSpawnDelay) {
      // 50% more asteroids: 23 in entry, 60-90 in active phase
      const maxAsteroids = state.phase === "entry" ? 23 : Math.min(60 + Math.floor(state.difficulty * 3.75), 90);
      
      if (state.asteroids.length < maxAsteroids) {
        spawnFieldAsteroid(state, playerX, viewWidth, rng);
      }
      
      // Set next spawn delay - much faster spawning for dense field
      if (state.phase === "entry") {
        state.nextSpawnDelay = 0.3 + rng() * 0.4; // 0.3-0.7 seconds
      } else {
        state.nextSpawnDelay = 0.15 + rng() * 0.25; // 0.15-0.4 seconds
      }
      
      state.spawnTimer = 0;
    }
  }
  
  // Update existing asteroids
  for (let i = state.asteroids.length - 1; i >= 0; i--) {
    const asteroid = state.asteroids[i];
    
    // Update position
    asteroid.x += asteroid.vx * dt;
    asteroid.y += asteroid.vy * dt;
    asteroid.angle += asteroid.av * dt;
    
    // Remove asteroids that are far behind the player
    if (asteroid.x < playerX - viewWidth - 200) {
      state.asteroids.splice(i, 1);
      continue;
    }
    
    // Keep asteroids roughly in vertical bounds
    if (asteroid.y < 50) {
      asteroid.y = 50;
      asteroid.vy = Math.abs(asteroid.vy);
    } else if (asteroid.y > 1400) {
      asteroid.y = 1400;
      asteroid.vy = -Math.abs(asteroid.vy);
    }
    
    // Check collision with player
    const dx = playerX - asteroid.x;
    const dy = playerY - asteroid.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < asteroid.r + shipRadius) {
      collision = true;
      state.clearedWithoutHit = false;
      return { collision: true, nearMiss: false, bonusScore: 0, collidingAsteroid: asteroid };
    } else if (!asteroid.nearMissTriggered && distance < asteroid.r + shipRadius + state.nearMissThreshold) {
      // Near miss detection
      asteroid.nearMissTriggered = true;
      nearMiss = true;
      state.nearMissCount++;
    }
  }
  
  return { collision, nearMiss, bonusScore, collidingAsteroid: null };
}

export function renderAsteroidField(
  ctx: CanvasRenderingContext2D,
  state: AsteroidFieldState,
  neonColor: string
): void {
  ctx.save();
  
  // Rim lighting effect for asteroids
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 2;
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 10;
  
  for (const asteroid of state.asteroids) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.angle);
    
    // Draw asteroid shape
    ctx.beginPath();
    if (asteroid.points.length > 0) {
      ctx.moveTo(asteroid.points[0].x, asteroid.points[0].y);
      for (let i = 1; i < asteroid.points.length; i++) {
        ctx.lineTo(asteroid.points[i].x, asteroid.points[i].y);
      }
      ctx.closePath();
    }
    
    // Fill black to occlude stars
    ctx.fillStyle = "black";
    ctx.fill();
    
    // Stroke with neon glow
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    
    ctx.restore();
  }
  
  ctx.restore();
}
