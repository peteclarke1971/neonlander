import { DuelProjectile, DuelPlayer, PowerupType } from "./types";

export function createProjectile(
  ownerId: 1 | 2,
  x: number,
  y: number,
  angle: number,
  powerupType: PowerupType | null
): DuelProjectile[] {
  const projectiles: DuelProjectile[] = [];
  const speed = 360; // px/s (doubled speed)
  const lifetime = 3.2; // seconds (doubled distance)
  const damage = 1;
  
  switch (powerupType) {
    case "twin": {
      // Two parallel shots with lateral offset
      const offsetDistance = 12; // pixels
      const perpAngle = angle + Math.PI / 2;
      const offsetX = Math.cos(perpAngle) * offsetDistance;
      const offsetY = Math.sin(perpAngle) * offsetDistance;
      
      for (let i = -1; i <= 1; i += 2) {
        projectiles.push({
          id: `${ownerId}_${Date.now()}_${i}`,
          ownerId,
          x: x + offsetX * i,
          y: y + offsetY * i,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          lifetime,
          damage
        });
      }
      break;
    }
    
    case "tri": {
      // Three shots with angular spread
      const spreadAngle = Math.PI / 18; // 10 degrees
      const angles = [angle - spreadAngle, angle, angle + spreadAngle];
      
      angles.forEach((shotAngle, index) => {
        projectiles.push({
          id: `${ownerId}_${Date.now()}_${index}`,
          ownerId,
          x,
          y,
          vx: Math.cos(shotAngle) * speed,
          vy: Math.sin(shotAngle) * speed,
          lifetime,
          damage
        });
      });
      break;
    }
    
    default: {
      // Standard single shot
      projectiles.push({
        id: `${ownerId}_${Date.now()}`,
        ownerId,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime,
        damage
      });
      break;
    }
  }
  
  return projectiles;
}

export function updateProjectiles(
  projectiles: DuelProjectile[],
  deltaTime: number,
  worldWidth: number,
  worldHeight: number,
  wrap: boolean
): DuelProjectile[] {
  return projectiles
    .map(projectile => {
      // Update position
      const newProjectile = {
        ...projectile,
        x: projectile.x + projectile.vx * deltaTime,
        y: projectile.y + projectile.vy * deltaTime,
        lifetime: projectile.lifetime - deltaTime
      };
      
      // Handle wrapping
      if (wrap) {
        if (newProjectile.x < 0) newProjectile.x += worldWidth;
        if (newProjectile.x > worldWidth) newProjectile.x -= worldWidth;
        if (newProjectile.y < 0) newProjectile.y += worldHeight;
        if (newProjectile.y > worldHeight) newProjectile.y -= worldHeight;
      }
      
      return newProjectile;
    })
    .filter(projectile => {
      // Remove expired projectiles
      if (projectile.lifetime <= 0) return false;
      
      // Remove off-screen projectiles (if not wrapping)
      if (!wrap) {
        const margin = 64;
        if (projectile.x < -margin || projectile.x > worldWidth + margin ||
            projectile.y < -margin || projectile.y > worldHeight + margin) {
          return false;
        }
      }
      
      return true;
    });
}

export function checkProjectileCollision(
  projectile: DuelProjectile,
  target: DuelPlayer,
  shipRadius: number = 12
): boolean {
  if (projectile.ownerId === target.id) return false;
  if (target.invulnerable) return false;
  if (target.activePowerup === "shield" && target.shieldHitsLeft > 0) return false;
  
  const dx = projectile.x - target.x;
  const dy = projectile.y - target.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < (shipRadius + 4); // Projectile has small collision radius
}

export function checkProjectileTerrainCollision(
  projectile: DuelProjectile,
  terrain: { x: number; y: number }[]
): boolean {
  // Simple point-in-polygon test for terrain collision
  // For now, just check if projectile is below terrain line
  // This is a simplified implementation - you might want more sophisticated collision
  
  // Find terrain segments near the projectile
  for (let i = 0; i < terrain.length - 1; i++) {
    const p1 = terrain[i];
    const p2 = terrain[i + 1];
    
    // Check if projectile is between the x coordinates of this segment
    if ((projectile.x >= Math.min(p1.x, p2.x) && projectile.x <= Math.max(p1.x, p2.x))) {
      // Interpolate y position on the terrain line
      const t = (projectile.x - p1.x) / (p2.x - p1.x);
      const terrainY = p1.y + t * (p2.y - p1.y);
      
      // Check if projectile is below terrain
      if (projectile.y >= terrainY) {
        return true;
      }
    }
  }
  
  return false;
}

export function renderProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: DuelProjectile[],
  neonColor: string = "hsl(210, 100%, 70%)"
) {
  ctx.save();
  
  for (const projectile of projectiles) {
    ctx.fillStyle = neonColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = neonColor;
    
    // Render as small glowing circle (smaller like Asteroids)
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Add trail effect
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(
      projectile.x - projectile.vx * 0.01,
      projectile.y - projectile.vy * 0.01,
      1.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  
  ctx.restore();
}