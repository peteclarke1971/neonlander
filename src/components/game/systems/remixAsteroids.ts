// Enhanced asteroid system for Asteroids REMIX with giant asteroids
export interface RemixAsteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  av: number;
  size: "large" | "medium" | "small" | "giant";
  points: { x: number; y: number }[];
}

export const generateAsteroidShape = (
  size: "large" | "medium" | "small" | "giant",
  rng: () => number
): { x: number; y: number }[] => {
  let radius: number;
  let vertexCount: number;
  
  switch (size) {
    case "giant":
      radius = 72;
      vertexCount = 10 + Math.floor(rng() * 5); // 10-14 vertices
      break;
    case "large":
      radius = 48;
      vertexCount = 8 + Math.floor(rng() * 3); // 8-10 vertices
      break;
    case "medium":
      radius = 32;
      vertexCount = 6 + Math.floor(rng() * 3); // 6-8 vertices
      break;
    case "small":
      radius = 16;
      vertexCount = 5 + Math.floor(rng() * 2); // 5-6 vertices
      break;
  }
  
  const points: { x: number; y: number }[] = [];
  
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2;
    const variation = 0.3 + rng() * 0.4; // 30-70% of base radius
    const r = radius * variation;
    
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r
    });
  }
  
  return points;
};

export const createAsteroid = (
  size: "large" | "medium" | "small" | "giant",
  x: number,
  y: number,
  vx: number,
  vy: number,
  rng: () => number
): RemixAsteroid => {
  const points = generateAsteroidShape(size, rng);
  let radius: number;
  
  switch (size) {
    case "giant":
      radius = 72;
      break;
    case "large":
      radius = 48;
      break;
    case "medium":
      radius = 32;
      break;
    case "small":
      radius = 16;
      break;
  }
  
  return {
    x,
    y,
    vx,
    vy,
    r: radius,
    angle: rng() * Math.PI * 2,
    av: (rng() - 0.5) * 4, // Angular velocity
    size,
    points
  };
};

export const splitAsteroid = (
  asteroid: RemixAsteroid,
  rng: () => number
): RemixAsteroid[] => {
  const fragments: RemixAsteroid[] = [];
  
  if (asteroid.size === "giant") {
    // Giant splits into 8 small pieces
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + (rng() - 0.5) * 0.35; // ±10° jitter
      const speed = 100 + rng() * 50;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      fragments.push(createAsteroid(
        "small",
        asteroid.x + (rng() - 0.5) * 20,
        asteroid.y + (rng() - 0.5) * 20,
        vx,
        vy,
        rng
      ));
    }
  } else if (asteroid.size === "large") {
    // Large splits into 2-3 medium pieces
    const count = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const angle = (rng() * Math.PI * 2);
      const speed = 80 + rng() * 40;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      fragments.push(createAsteroid(
        "medium",
        asteroid.x + (rng() - 0.5) * 30,
        asteroid.y + (rng() - 0.5) * 30,
        vx,
        vy,
        rng
      ));
    }
  } else if (asteroid.size === "medium") {
    // Medium splits into 2-3 small pieces
    const count = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const angle = (rng() * Math.PI * 2);
      const speed = 100 + rng() * 60;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      fragments.push(createAsteroid(
        "small",
        asteroid.x + (rng() - 0.5) * 20,
        asteroid.y + (rng() - 0.5) * 20,
        vx,
        vy,
        rng
      ));
    }
  }
  // Small asteroids don't split further
  
  return fragments;
};

export const updateAsteroids = (
  asteroids: RemixAsteroid[],
  dt: number,
  worldWidth: number,
  worldHeight: number
) => {
  for (const asteroid of asteroids) {
    // Update position
    asteroid.x += asteroid.vx * dt;
    asteroid.y += asteroid.vy * dt;
    asteroid.angle += asteroid.av * dt;
    
    // Screen wrapping
    if (asteroid.x < -asteroid.r) asteroid.x = worldWidth + asteroid.r;
    if (asteroid.x > worldWidth + asteroid.r) asteroid.x = -asteroid.r;
    if (asteroid.y > worldHeight + asteroid.r) asteroid.y = -asteroid.r;
  }
};

export const isAsteroidSafeToSpawn = (
  x: number,
  y: number,
  radius: number,
  playerX: number,
  playerY: number,
  safeDistance: number = 220
): boolean => {
  // Check distance from player
  const dx = x - playerX;
  const dy = y - playerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance > safeDistance + radius;
};

export const spawnAsteroidSafely = (
  size: "large" | "medium" | "small" | "giant",
  worldWidth: number,
  worldHeight: number,
  playerX: number,
  playerY: number,
  rng: () => number
): RemixAsteroid | null => {
  let radius: number;
  switch (size) {
    case "giant": radius = 72; break;
    case "large": radius = 48; break;
    case "medium": radius = 32; break;
    case "small": radius = 16; break;
  }
  
  // Try up to 10 times to find a safe spawn location
  for (let attempts = 0; attempts < 10; attempts++) {
    const x = rng() * worldWidth;
    const y = -radius - 50; // Spawn above screen
    
    if (isAsteroidSafeToSpawn(x, y, radius, playerX, playerY)) {
      const vx = (rng() - 0.5) * 200;
      const vy = 60 + rng() * 140;
      
      return createAsteroid(size, x, y, vx, vy, rng);
    }
  }
  
  return null; // Could not find safe spawn
};

export const getAsteroidScore = (size: "large" | "medium" | "small" | "giant"): number => {
  switch (size) {
    case "giant": return 150;
    case "large": return 120;
    case "medium": return 100;
    case "small": return 100;
  }
};

export const checkAsteroidCollision = (
  asteroid: RemixAsteroid,
  x: number,
  y: number,
  radius: number = 12
): boolean => {
  const dx = asteroid.x - x;
  const dy = asteroid.y - y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < asteroid.r + radius;
};

export const renderAsteroids = (
  ctx: CanvasRenderingContext2D,
  asteroids: RemixAsteroid[],
  neonColor: string = "#00ffff",
  difficulty: string = "Normal"
) => {
  for (const asteroid of asteroids) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.angle);
    
    // Set color based on size
    let color = neonColor;
    if (asteroid.size === "giant") {
      color = "#ff6600"; // Orange for giants
    } else if (asteroid.size === "large") {
      color = "#ff0066"; // Red for large
    }
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color + "20"; // Semi-transparent fill
    ctx.lineWidth = asteroid.size === "giant" ? 3 : 2;
    
    // Draw asteroid shape
    if (asteroid.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(asteroid.points[0].x, asteroid.points[0].y);
      
      for (let i = 1; i < asteroid.points.length; i++) {
        ctx.lineTo(asteroid.points[i].x, asteroid.points[i].y);
      }
      
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Add inner details for giant asteroids
      if (asteroid.size === "giant") {
        ctx.strokeStyle = color + "80";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < asteroid.points.length; i += 2) {
          const p1 = asteroid.points[i];
          const p2 = asteroid.points[(i + 3) % asteroid.points.length];
          ctx.moveTo(p1.x * 0.6, p1.y * 0.6);
          ctx.lineTo(p2.x * 0.6, p2.y * 0.6);
        }
        ctx.stroke();
      }
      
      // Glow effect for giants and large asteroids
      if (asteroid.size === "giant" || asteroid.size === "large") {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = color + "60";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    
    ctx.restore();
  }
  
  // Add debris sparks for Normal/Hard difficulty when asteroids are destroyed
  if (difficulty !== "Easy") {
    // This will be handled in the main game engine when asteroids are destroyed
  }
};