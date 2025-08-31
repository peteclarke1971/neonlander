// New enemy archetypes for Asteroids REMIX
import { EnemyType } from "./stageConfig";

export interface RemixEnemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  shootTimer: number;
  pattern?: number;
  zigzagTimer?: number;
  shieldOpen?: boolean;
  shieldTimer?: number;
  teleportCharging?: boolean;
  teleportTimer?: number;
  mineDropTimer?: number;
  segments?: { x: number; y: number; vx: number; vy: number }[]; // for snake
}

export interface Mine {
  x: number;
  y: number;
  timer: number;
  blinkTimer: number;
  active: boolean;
}

export const createEnemy = (
  type: EnemyType,
  x: number,
  y: number,
  rng: () => number,
  difficulty: string
): RemixEnemy => {
  const diffMultiplier = difficulty === "Easy" ? 0.8 : difficulty === "Hard" ? 1.2 : 1.0;
  
  switch (type) {
    case "interceptor":
      return {
        x,
        y,
        vx: (rng() - 0.5) * 400 * diffMultiplier, // Fast zig-zag
        vy: 200 * diffMultiplier,
        type,
        hp: 1,
        maxHp: 1,
        shootTimer: 1.0 + rng() * 0.5,
        zigzagTimer: 0
      };
      
    case "minelayer":
      return {
        x,
        y,
        vx: (rng() - 0.5) * 100 * diffMultiplier,
        vy: 120 * diffMultiplier,
        type,
        hp: 2,
        maxHp: 2,
        shootTimer: 0,
        mineDropTimer: 2.0 + rng() * 1.0
      };
      
    case "shieldCarrier":
      return {
        x,
        y,
        vx: (rng() - 0.5) * 160 * diffMultiplier,
        vy: 100 * diffMultiplier,
        type,
        hp: 3,
        maxHp: 3,
        shootTimer: 2.0 + rng() * 1.0,
        shieldOpen: false,
        shieldTimer: 2.4
      };
      
    case "teleporter":
      return {
        x,
        y,
        vx: 0,
        vy: 80 * diffMultiplier,
        type,
        hp: 2,
        maxHp: 2,
        shootTimer: 0,
        teleportCharging: false,
        teleportTimer: 3.0 + rng() * 2.0
      };
      
    case "snake":
      const segmentCount = Math.floor(5 + rng() * 4); // 5-8 segments
      const segments = [];
      for (let i = 0; i < segmentCount; i++) {
        segments.push({
          x: x - i * 20,
          y: y + (rng() - 0.5) * 40,
          vx: (rng() - 0.5) * 120 * diffMultiplier,
          vy: 100 * diffMultiplier
        });
      }
      return {
        x,
        y,
        vx: (rng() - 0.5) * 120 * diffMultiplier,
        vy: 100 * diffMultiplier,
        type,
        hp: segmentCount,
        maxHp: segmentCount,
        shootTimer: 1.5 + rng() * 1.0,
        segments
      };
      
    default:
      // Fallback to existing enemy types
      return {
        x,
        y,
        vx: (rng() - 0.5) * 200 * diffMultiplier,
        vy: 120 * diffMultiplier,
        type,
        hp: 1,
        maxHp: 1,
        shootTimer: 1.0 + rng() * 1.0
      };
  }
};

export const updateEnemies = (
  enemies: RemixEnemy[],
  dt: number,
  worldWidth: number,
  worldHeight: number,
  rng: () => number
) => {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    
    // Update position
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    
    // Remove if off screen
    if (enemy.y > worldHeight + 100 || enemy.x < -100 || enemy.x > worldWidth + 100) {
      enemies.splice(i, 1);
      continue;
    }
    
    // Type-specific behavior
    switch (enemy.type) {
      case "interceptor":
        // Zig-zag movement
        if (enemy.zigzagTimer !== undefined) {
          enemy.zigzagTimer += dt;
          if (enemy.zigzagTimer > 0.5) {
            enemy.vx *= -0.8; // Change direction
            enemy.zigzagTimer = 0;
          }
        }
        break;
        
      case "minelayer":
        // Mine dropping logic handled in game engine
        if (enemy.mineDropTimer !== undefined) {
          enemy.mineDropTimer -= dt;
        }
        break;
        
      case "shieldCarrier":
        // Shield cycling
        if (enemy.shieldTimer !== undefined) {
          enemy.shieldTimer -= dt;
          if (enemy.shieldTimer <= 0) {
            enemy.shieldOpen = !enemy.shieldOpen;
            enemy.shieldTimer = enemy.shieldOpen ? 0.6 : 2.4; // Open 0.6s, closed 2.4s
          }
        }
        break;
        
      case "teleporter":
        // Teleport charging and execution
        if (enemy.teleportTimer !== undefined) {
          enemy.teleportTimer -= dt;
          if (enemy.teleportTimer <= 1.0 && !enemy.teleportCharging) {
            enemy.teleportCharging = true;
          }
          if (enemy.teleportTimer <= 0) {
            // Teleport
            enemy.x += (rng() - 0.5) * 200;
            enemy.y += (rng() - 0.5) * 100;
            enemy.x = Math.max(50, Math.min(worldWidth - 50, enemy.x));
            enemy.y = Math.max(50, Math.min(enemy.y, worldHeight * 0.7));
            enemy.teleportCharging = false;
            enemy.teleportTimer = 3.0 + rng() * 2.0;
            enemy.shootTimer = 0.5; // Shoot after teleport
          }
        }
        break;
        
      case "snake":
        // Update snake segments
        if (enemy.segments) {
          for (let j = 0; j < enemy.segments.length; j++) {
            const segment = enemy.segments[j];
            segment.x += segment.vx * dt;
            segment.y += segment.vy * dt;
            
            // Follow previous segment
            if (j > 0) {
              const prev = enemy.segments[j - 1];
              const dx = prev.x - segment.x;
              const dy = prev.y - segment.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 25) {
                segment.x += (dx / dist) * 50 * dt;
                segment.y += (dy / dist) * 50 * dt;
              }
            }
          }
        }
        break;
    }
    
    // Update shoot timer
    enemy.shootTimer -= dt;
  }
};

export const renderEnemies = (
  ctx: CanvasRenderingContext2D,
  enemies: RemixEnemy[],
  neonColor: string = "#00ffff"
) => {
  ctx.strokeStyle = neonColor;
  ctx.fillStyle = neonColor;
  ctx.lineWidth = 2;
  
  for (const enemy of enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    
    // Render based on type
    switch (enemy.type) {
      case "interceptor":
        // Small triangular shape
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-6, 8);
        ctx.lineTo(6, 8);
        ctx.closePath();
        ctx.stroke();
        break;
        
      case "minelayer":
        // Rectangular carrier
        ctx.strokeRect(-12, -8, 24, 16);
        ctx.strokeRect(-8, -4, 16, 8);
        break;
        
      case "shieldCarrier":
        // Saucer with shield arc
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        // Shield arc
        if (!enemy.shieldOpen) {
          ctx.strokeStyle = "#ff6600";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 20, -Math.PI * 0.3, Math.PI * 0.3);
          ctx.stroke();
          ctx.strokeStyle = neonColor;
          ctx.lineWidth = 2;
        } else if (enemy.shieldTimer !== undefined && enemy.shieldTimer < 0.2) {
          // Blink when opening/closing
          ctx.strokeStyle = "#ffff00";
          ctx.beginPath();
          ctx.arc(0, 0, 20, -Math.PI * 0.3, Math.PI * 0.3);
          ctx.stroke();
          ctx.strokeStyle = neonColor;
        }
        break;
        
      case "teleporter":
        // Small saucer with charge effect
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        if (enemy.teleportCharging) {
          ctx.strokeStyle = "#ffff00";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = neonColor;
          ctx.lineWidth = 2;
        }
        break;
        
      case "snake":
        // Render snake segments
        if (enemy.segments) {
          ctx.strokeStyle = "#00ff00";
          for (let i = 0; i < enemy.segments.length; i++) {
            const segment = enemy.segments[i];
            ctx.save();
            ctx.translate(segment.x - enemy.x, segment.y - enemy.y);
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            
            // Draw connection lines
            if (i > 0) {
              const prev = enemy.segments[i - 1];
              ctx.beginPath();
              ctx.moveTo(prev.x - enemy.x, prev.y - enemy.y);
              ctx.lineTo(segment.x - enemy.x, segment.y - enemy.y);
              ctx.stroke();
            }
          }
          ctx.strokeStyle = neonColor;
        }
        break;
        
      default:
        // Default enemy rendering
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    
    ctx.restore();
  }
};

export const createMine = (x: number, y: number): Mine => {
  return {
    x,
    y,
    timer: 5.0, // 5 second fuse
    blinkTimer: 0,
    active: true
  };
};

export const updateMines = (mines: Mine[], dt: number) => {
  for (let i = mines.length - 1; i >= 0; i--) {
    const mine = mines[i];
    mine.timer -= dt;
    mine.blinkTimer += dt;
    
    if (mine.timer <= 0) {
      mines.splice(i, 1);
      // Return mine for explosion handling
      return mine;
    }
  }
  return null;
};

export const renderMines = (ctx: CanvasRenderingContext2D, mines: Mine[]) => {
  for (const mine of mines) {
    ctx.save();
    ctx.translate(mine.x, mine.y);
    
    // Blinking effect - faster as timer runs down
    const blinkRate = Math.max(0.1, mine.timer * 0.2);
    const shouldBlink = Math.floor(mine.blinkTimer / blinkRate) % 2 === 0;
    
    if (shouldBlink) {
      ctx.strokeStyle = mine.timer < 1.0 ? "#ff0000" : "#ffff00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      
      // Cross pattern
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.moveTo(0, -4);
      ctx.lineTo(0, 4);
      ctx.stroke();
    }
    
    ctx.restore();
  }
};