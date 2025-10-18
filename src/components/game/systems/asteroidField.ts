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

export function initAsteroidField(startX: number, difficulty: number, seed: number, fieldNumber: number = 0): AsteroidFieldState {
  // Start with half density on first field, then ramp up with 50% compound scaling
  const baseWidth = 4800;  // Standard width (traversable in 30-45 seconds)
  const baseInitialCount = 138;  // 6× more asteroids
  const baseMaxY = 800;  // Height range matching viewport (400 to -400)
  
  // First field has 50% density, subsequent fields scale from baseline
  const firstFieldMultiplier = fieldNumber === 0 ? 0.5 : 1.0;
  const scale = Math.pow(1.5, Math.max(0, fieldNumber - 1)) * firstFieldMultiplier;
  
  const scaledWidth = Math.floor(baseWidth * scale);
  const scaledInitialCount = Math.floor(baseInitialCount * scale);
  const scaledMaxY = Math.floor(baseMaxY * scale);
  
  const fieldState = {
    active: true,
    phase: "entry" as const,
    phaseTimer: 0,
    startX,
    endX: startX + scaledWidth,
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
  for (let i = 0; i < scaledInitialCount; i++) {
    const x = startX + 100 + initialRng() * (scaledWidth - 200); // Spread across scaled field width
    
    // COORDINATE SYSTEM: Negative Y = above terrain, Positive Y = below terrain
    // Spawn asteroids from just below terrain (y=400) up to top of screen (y=-400)
    // Bias towards upper 80-90% using power distribution
    const yRoll = initialRng();
    const yBias = Math.pow(yRoll, 0.35); // Power curve: 90% of values < 0.5
    // Range: y=400 (just below terrain) to y=(400-scaledMaxY) (high up)
    const y = 400 - yBias * scaledMaxY;
    
    const sizeRoll = initialRng();
    const size: "small" | "medium" | "large" = 
      sizeRoll < 0.5 ? "small" : sizeRoll < 0.85 ? "medium" : "large";
    
    // Determine if this is a "fast chaos" asteroid (15% chance)
    const isFastAsteroid = initialRng() < 0.15;
    
    const radius = size === "large" ? 40 : size === "medium" ? 25 : 15;
    const speedMult = size === "large" ? 0.6 : size === "medium" ? 0.8 : 1.0;
    
    // Apply chaos multiplier if fast asteroid (3-4× speed)
    const chaosMultiplier = isFastAsteroid ? (3 + initialRng() * 1) : 1;
    
    const baseSpeed = 20 + initialRng() * 30;
    const angleVariation = (initialRng() - 0.5) * Math.PI / 6;
    const vx = -baseSpeed * speedMult * chaosMultiplier * Math.cos(angleVariation);
    const vy = baseSpeed * speedMult * chaosMultiplier * Math.sin(angleVariation);
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
  rng: () => number,
  fieldNumber: number = 0
): void {
  const { difficulty, phase } = state;
  
  // Calculate scaled vertical range based on field number
  const baseMaxY = 800;  // Updated to match new base
  const firstFieldMultiplier = fieldNumber === 0 ? 0.5 : 1.0;
  const scaledMaxY = Math.floor(baseMaxY * Math.pow(1.5, Math.max(0, fieldNumber - 1)) * firstFieldMultiplier);
  
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
  
  // Determine if this is a "fast chaos" asteroid (15% chance)
  const isFastAsteroid = rng() < 0.15;
  
  // Apply chaos multiplier if fast asteroid (3-4× speed)
  const chaosMultiplier = isFastAsteroid ? (3 + rng() * 1) : 1;
  
  // Spawn ahead of player, off-screen
  const spawnX = playerX + viewWidth + 100 + rng() * 200;
  
  // Bias towards upper 80-90% using power distribution
  const yRoll = rng();
  const yBias = Math.pow(yRoll, 0.35); // Power curve: 90% of values < 0.5
  // Spawn asteroids from just below terrain upward into visible area
  const spawnY = 400 - yBias * scaledMaxY;
  
  // Drift velocity: mostly horizontal (left), slight vertical variation
  const baseSpeed = 20 + rng() * 30;
  const angleVariation = (rng() - 0.5) * Math.PI / 6; // ±30 degrees
  const vx = -baseSpeed * speedMult * chaosMultiplier * Math.cos(angleVariation);
  const vy = baseSpeed * speedMult * chaosMultiplier * Math.sin(angleVariation);
  
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
  viewWidth: number,
  fieldNumber: number = 0
): { collision: boolean; nearMiss: boolean; bonusScore: number; collidingAsteroid: FieldAsteroid | null } {
  const rng = mulberry32(state.seed + Math.floor(state.phaseTimer * 1000));
  
  let collision = false;
  let nearMiss = false;
  let bonusScore = 0;
  
  // Update phase timer
  state.phaseTimer += dt;
  
  // Phase transitions based on player position
  if (state.phase === "entry" && playerX > state.startX + 600) {
    state.phase = "active";
  } else if (state.phase === "active" && playerX > state.endX - 600) {
    state.phase = "exit";
  }
  
  // Update spawn timer and spawn new asteroids
  if (state.phase !== "exit") {
    state.spawnTimer += dt;
    
    if (state.spawnTimer >= state.nextSpawnDelay) {
      // Scale max asteroids with field number (50% compound growth, half density on first field)
      const baseInitialCount = 138;  // Updated to match new base
      const baseMaxActive = 300;  // Increased from 90 to support much larger fields
      const firstFieldMultiplier = fieldNumber === 0 ? 0.5 : 1.0;
      const scale = Math.pow(1.5, Math.max(0, fieldNumber - 1)) * firstFieldMultiplier;
      const scaledInitialCount = Math.floor(baseInitialCount * scale);
      const scaledMaxActive = Math.floor((180 + Math.floor(state.difficulty * 3.75)) * scale);
      const maxAsteroids = state.phase === "entry" ? scaledInitialCount : Math.min(scaledMaxActive, Math.floor(baseMaxActive * scale));
      
      if (state.asteroids.length < maxAsteroids) {
        spawnFieldAsteroid(state, playerX, viewWidth, rng, fieldNumber);
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
    
    // Keep asteroids roughly in vertical bounds (negative Y = higher up)
    // Calculate scaled max height for this field
    const firstFieldMultiplier = fieldNumber === 0 ? 0.5 : 1.0;
    const scale = Math.pow(1.5, Math.max(0, fieldNumber - 1)) * firstFieldMultiplier;
    const scaledMaxY = Math.floor(800 * scale);
    const minY = 400 - scaledMaxY - 100; // Upper bound (allow some overshoot)
    const maxY = 500; // Lower bound (just below terrain)
    
    if (asteroid.y < minY) {
      asteroid.y = minY;
      asteroid.vy = Math.abs(asteroid.vy); // Bounce downward
    } else if (asteroid.y > maxY) {
      asteroid.y = maxY;
      asteroid.vy = -Math.abs(asteroid.vy); // Bounce upward
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
