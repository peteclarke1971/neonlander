// Power-up system for Asteroids REMIX
export type PowerupType = "double" | "triple" | "shield";

export interface PowerupItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: PowerupType;
  pulseTimer: number;
  collected: boolean;
}

export interface ActivePowerup {
  type: PowerupType;
  timer: number;
  maxTime: number;
}

export interface PowerupState {
  items: PowerupItem[];
  active: ActivePowerup[];
  shieldHits: number; // Track shield hits remaining
}

export const createPowerup = (
  type: PowerupType,
  x: number,
  y: number,
  rng: () => number
): PowerupItem => {
  return {
    x,
    y,
    vx: (rng() - 0.5) * 60, // Slight drift
    vy: 80 + rng() * 40, // Downward movement
    type,
    pulseTimer: 0,
    collected: false
  };
};

export const shouldSpawnPowerup = (
  stageTime: number,
  stageId: number,
  chance: number,
  rng: () => number,
  lastSpawn: number
): boolean => {
  // Minimum time between spawns
  if (stageTime - lastSpawn < 2.0) return false;
  
  // Check chance
  return rng() < chance * 0.016; // Adjust for 60fps frame rate
};

export const spawnPowerupInSafeLane = (
  type: PowerupType,
  worldWidth: number,
  playerX: number,
  rng: () => number
): PowerupItem => {
  // Define three lanes
  const lanes = [
    worldWidth * 0.2,
    worldWidth * 0.5,
    worldWidth * 0.8
  ];
  
  // Choose lane furthest from player
  let bestLane = lanes[0];
  let maxDist = Math.abs(lanes[0] - playerX);
  
  for (const lane of lanes) {
    const dist = Math.abs(lane - playerX);
    if (dist > maxDist) {
      maxDist = dist;
      bestLane = lane;
    }
  }
  
  return createPowerup(type, bestLane + (rng() - 0.5) * 60, -30, rng);
};

export const updatePowerups = (
  powerups: PowerupItem[],
  dt: number,
  worldHeight: number
) => {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const powerup = powerups[i];
    
    powerup.x += powerup.vx * dt;
    powerup.y += powerup.vy * dt;
    powerup.pulseTimer += dt;
    
    // Remove if off screen
    if (powerup.y > worldHeight + 50 || powerup.collected) {
      powerups.splice(i, 1);
    }
  }
};

export const activatePowerup = (
  type: PowerupType,
  activeList: ActivePowerup[]
): void => {
  const duration = 10.0; // 10 seconds for all power-ups
  
  // Remove conflicting power-ups (weapon types don't stack)
  if (type === "double" || type === "triple") {
    for (let i = activeList.length - 1; i >= 0; i--) {
      if (activeList[i].type === "double" || activeList[i].type === "triple") {
        activeList.splice(i, 1);
      }
    }
  }
  
  // Add or refresh the power-up
  const existing = activeList.find(p => p.type === type);
  if (existing) {
    existing.timer = duration;
  } else {
    activeList.push({
      type,
      timer: duration,
      maxTime: duration
    });
  }
};

export const updateActivePowerups = (activeList: ActivePowerup[], dt: number) => {
  for (let i = activeList.length - 1; i >= 0; i--) {
    const powerup = activeList[i];
    powerup.timer -= dt;
    
    if (powerup.timer <= 0) {
      activeList.splice(i, 1);
    }
  }
};

export const getWeaponMultiplier = (activeList: ActivePowerup[]): number => {
  if (activeList.some(p => p.type === "triple")) return 3;
  if (activeList.some(p => p.type === "double")) return 2;
  return 1;
};

export const hasShield = (activeList: ActivePowerup[]): boolean => {
  return activeList.some(p => p.type === "shield");
};

export const checkPowerupCollision = (
  powerups: PowerupItem[],
  playerX: number,
  playerY: number,
  playerRadius: number = 12
): PowerupItem | null => {
  for (const powerup of powerups) {
    if (powerup.collected) continue;
    
    const dx = powerup.x - playerX;
    const dy = powerup.y - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < playerRadius + 8) {
      powerup.collected = true;
      return powerup;
    }
  }
  return null;
};

export const renderPowerups = (
  ctx: CanvasRenderingContext2D,
  powerups: PowerupItem[]
) => {
  for (const powerup of powerups) {
    if (powerup.collected) continue;
    
    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    
    // Pulsing effect
    const pulse = 0.8 + 0.2 * Math.sin(powerup.pulseTimer * 8);
    ctx.scale(pulse, pulse);
    
    // Color based on type
    let color = "#00ffff";
    switch (powerup.type) {
      case "double":
        color = "#00ff00";
        break;
      case "triple":
        color = "#ff6600";
        break;
      case "shield":
        color = "#0066ff";
        break;
    }
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color + "40";
    ctx.lineWidth = 2;
    
    // Render icon based on type
    switch (powerup.type) {
      case "double":
        // Two parallel lines
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.lineTo(-6, 8);
        ctx.moveTo(6, -8);
        ctx.lineTo(6, 8);
        ctx.stroke();
        break;
        
      case "triple":
        // Three parallel lines
        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.lineTo(-8, 8);
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.moveTo(8, -8);
        ctx.lineTo(8, 8);
        ctx.stroke();
        break;
        
      case "shield":
        // Shield shape
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-8, -4);
        ctx.lineTo(-8, 4);
        ctx.lineTo(0, 10);
        ctx.lineTo(8, 4);
        ctx.lineTo(8, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
    
    // Outer glow ring
    ctx.strokeStyle = color + "80";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }
};

export const renderPowerupHUD = (
  ctx: CanvasRenderingContext2D,
  activeList: ActivePowerup[],
  x: number = 20,
  y: number = 120
) => {
  let offsetY = 0;
  
  for (const powerup of activeList) {
    ctx.save();
    ctx.translate(x, y + offsetY);
    
    // Background circle
    ctx.fillStyle = "#000000aa";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    
    // Progress ring
    const progress = powerup.timer / powerup.maxTime;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (progress * Math.PI * 2);
    
    let color = "#00ffff";
    switch (powerup.type) {
      case "double":
        color = "#00ff00";
        break;
      case "triple":
        color = "#ff6600";
        break;
      case "shield":
        color = "#0066ff";
        break;
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, startAngle, endAngle);
    ctx.stroke();
    
    // Icon
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.scale(0.6, 0.6);
    
    switch (powerup.type) {
      case "double":
        ctx.beginPath();
        ctx.moveTo(-4, -6);
        ctx.lineTo(-4, 6);
        ctx.moveTo(4, -6);
        ctx.lineTo(4, 6);
        ctx.stroke();
        break;
        
      case "triple":
        ctx.beginPath();
        ctx.moveTo(-6, -6);
        ctx.lineTo(-6, 6);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.moveTo(6, -6);
        ctx.lineTo(6, 6);
        ctx.stroke();
        break;
        
      case "shield":
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-6, -2);
        ctx.lineTo(-6, 3);
        ctx.lineTo(0, 8);
        ctx.lineTo(6, 3);
        ctx.lineTo(6, -2);
        ctx.closePath();
        ctx.stroke();
        break;
    }
    
    ctx.restore();
    offsetY += 36;
  }
};