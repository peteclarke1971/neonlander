// Boss system for Asteroids REMIX
import { BossConfig, BossPattern } from "./stageConfig";

export interface RemixBoss {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  pattern: number;
  patternTimer: number;
  attackTimer: number;
  telegraphTimer: number;
  phase: number;
  parts?: RemixBossPart[]; // For multi-part bosses
  active: boolean;
  oscillationTimer: number;
  config: BossConfig;
}

export interface RemixBossPart {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  active: boolean;
  angle?: number; // For orbiting parts
  orbitRadius?: number;
}

export interface BossProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  type: "normal" | "spread" | "laser" | "ring";
}

export const createBoss = (
  config: BossConfig,
  x: number,
  y: number,
  difficulty: string
): RemixBoss => {
  const difficultyKey = difficulty.toLowerCase() as keyof typeof config.hp;
  const hp = config.hp[difficultyKey] || config.hp.normal;
  
  const boss: RemixBoss = {
    id: config.id,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    pattern: 0,
    patternTimer: 0,
    attackTimer: 2.0, // Initial delay
    telegraphTimer: 0,
    phase: 1,
    active: true,
    oscillationTimer: 0,
    config
  };
  
  // Create parts for multi-part bosses
  if (config.multiPart && config.parts) {
    boss.parts = [];
    for (let i = 0; i < config.parts; i++) {
      boss.parts.push({
        id: i,
        x: x + Math.cos((i / config.parts) * Math.PI * 2) * 100,
        y: y + Math.sin((i / config.parts) * Math.PI * 2) * 50,
        hp,
        maxHp: hp,
        active: true,
        angle: (i / config.parts) * Math.PI * 2,
        orbitRadius: 100
      });
    }
    
    // Special setup for specific bosses
    if (config.id === "hexa_core_array") {
      // 6 cores + central hub
      boss.hp = config.hp.normal; // Hub HP
      boss.maxHp = config.hp.normal;
    }
  }
  
  return boss;
};

export const updateBoss = (
  boss: RemixBoss,
  dt: number,
  worldWidth: number,
  worldHeight: number,
  playerX: number,
  playerY: number
): BossProjectile[] => {
  if (!boss.active) return [];
  
  const projectiles: BossProjectile[] = [];
  boss.oscillationTimer += dt;
  boss.patternTimer += dt;
  boss.attackTimer -= dt;
  boss.telegraphTimer -= dt;
  
  // Movement patterns based on boss type
  switch (boss.id) {
    case "twin_forges":
      // Mirrored horizontal oscillation
      if (boss.parts && boss.parts.length === 2) {
        const amp = boss.config.movement.ampX;
        const centerX = worldWidth / 2;
        boss.parts[0].x = centerX - amp + Math.sin(boss.oscillationTimer) * amp * 0.5;
        boss.parts[1].x = centerX + amp - Math.sin(boss.oscillationTimer) * amp * 0.5;
        boss.x = centerX; // Main boss position
      }
      break;
      
    case "carrier_swarm":
      // Slow zig-zag across top third
      boss.x += Math.sin(boss.oscillationTimer * 0.5) * 60 * dt;
      boss.y = worldHeight * 0.15 + Math.sin(boss.oscillationTimer * 0.3) * 20;
      break;
      
    case "wormhole_guardian":
      // Small bob with rotating parts
      boss.y = worldHeight * 0.2 + Math.sin(boss.oscillationTimer * 2) * boss.config.movement.bob;
      if (boss.parts) {
        for (let i = 0; i < boss.parts.length; i++) {
          const part = boss.parts[i];
          if (part.active && part.angle !== undefined && part.orbitRadius !== undefined) {
            part.angle += dt * 0.5; // 20-40°/s rotation
            part.x = boss.x + Math.cos(part.angle) * part.orbitRadius;
            part.y = boss.y + Math.sin(part.angle) * part.orbitRadius * 0.5;
          }
        }
      }
      break;
      
    case "hexa_core_array":
      // Orbital cores with ramping speed
      const activeCores = boss.parts?.filter(p => p.active).length || 0;
      const speedMultiplier = Math.max(0.5, 1.0 - (6 - activeCores) * 0.1);
      
      if (boss.parts) {
        for (let i = 0; i < boss.parts.length; i++) {
          const part = boss.parts[i];
          if (part.active && part.angle !== undefined && part.orbitRadius !== undefined) {
            part.angle += dt * speedMultiplier;
            part.x = boss.x + Math.cos(part.angle) * part.orbitRadius;
            part.y = boss.y + Math.sin(part.angle) * part.orbitRadius * 0.6;
          }
        }
      }
      break;
      
    case "vector_titan":
      // Phase-based movement
      if (boss.phase === 1) {
        // Ease left-right
        boss.x = worldWidth * 0.5 + Math.sin(boss.oscillationTimer * 0.4) * boss.config.movement.ampX;
      } else if (boss.phase === 3) {
        // Lock center for mini-core phase
        boss.x = worldWidth * 0.5;
        boss.y = worldHeight * 0.15;
      }
      break;
  }
  
  // Attack patterns
  if (boss.attackTimer <= 0) {
    const pattern = boss.config.patterns[boss.pattern % boss.config.patterns.length];
    projectiles.push(...executeBossPattern(boss, pattern, playerX, playerY));
    
    // Cycle to next pattern
    boss.pattern = (boss.pattern + 1) % boss.config.patterns.length;
    boss.attackTimer = 2.0 + Math.random() * 1.5; // 2-3.5s between attacks
  }
  
  return projectiles;
};

const executeBossPattern = (
  boss: RemixBoss,
  pattern: BossPattern,
  playerX: number,
  playerY: number
): BossProjectile[] => {
  const projectiles: BossProjectile[] = [];
  
  switch (pattern.name) {
    case "spiral_spread":
      // Spiral of bullets
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + boss.oscillationTimer;
        const speed = 150;
        projectiles.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 4.0,
          type: "normal"
        });
      }
      break;
      
    case "direct_volley":
      // Aimed shots at player
      for (let i = 0; i < 3; i++) {
        const dx = playerX - boss.x;
        const dy = playerY - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 200;
        const spread = (i - 1) * 0.3; // ±0.3 radian spread
        
        const angle = Math.atan2(dy, dx) + spread;
        projectiles.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 5.0,
          type: "normal"
        });
      }
      break;
      
    case "ring_burst":
      // Ring of bullets expanding outward
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const speed = 120;
        projectiles.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 4.0,
          type: "ring"
        });
      }
      break;
      
    case "crossfire_volley":
      // Twin forges cross-shooting
      if (boss.parts && boss.parts.length >= 2) {
        for (let partIndex = 0; partIndex < 2; partIndex++) {
          const part = boss.parts[partIndex];
          if (!part.active) continue;
          
          // Shoot towards other part's position to create crossing pattern
          const otherPart = boss.parts[1 - partIndex];
          const dx = otherPart.x - part.x;
          const dy = otherPart.y - part.y + 200; // Offset downward
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = 180;
          
          projectiles.push({
            x: part.x,
            y: part.y,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            life: 3.0,
            type: "normal"
          });
        }
      }
      break;
      
    case "drone_swarm":
      // Spawn drone enemies (handled in main game engine)
      break;
      
    case "mine_barrage":
      // Drop mines with safe pockets
      for (let i = 0; i < 3; i++) {
        const x = boss.x + (i - 1) * 100;
        projectiles.push({
          x,
          y: boss.y + 50,
          vx: 0,
          vy: 100,
          life: 5.0,
          type: "normal"
        });
      }
      break;
      
    case "rotating_laser_gates":
      // Two 90° beams with rotating gaps
      const beamCount = 16;
      const gapSize = 4; // Number of missing beams for gaps
      
      for (let i = 0; i < beamCount; i++) {
        // Create gaps
        const gapStart1 = Math.floor(boss.oscillationTimer * 2) % beamCount;
        const gapStart2 = (gapStart1 + beamCount / 2) % beamCount;
        
        if ((i >= gapStart1 && i < gapStart1 + gapSize) ||
            (i >= gapStart2 && i < gapStart2 + gapSize)) {
          continue; // Skip this beam (create gap)
        }
        
        const angle = (i / beamCount) * Math.PI * 2;
        const speed = 160;
        projectiles.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 3.0,
          type: "laser"
        });
      }
      break;
  }
  
  return projectiles;
};

export const renderBoss = (
  ctx: CanvasRenderingContext2D,
  boss: RemixBoss,
  neonColor: string = "#ff6600"
) => {
  if (!boss.active) return;
  
  ctx.strokeStyle = neonColor;
  ctx.fillStyle = neonColor + "20";
  ctx.lineWidth = 3;
  
  switch (boss.id) {
    case "twin_forges":
      if (boss.parts) {
        for (const part of boss.parts) {
          if (!part.active) continue;
          
          ctx.save();
          ctx.translate(part.x, part.y);
          
          // Large saucer shape
          ctx.beginPath();
          ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          // Inner details
          ctx.strokeStyle = neonColor + "80";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.restore();
        }
      }
      break;
      
    case "wormhole_guardian":
      // Central ring core
      ctx.save();
      ctx.translate(boss.x, boss.y);
      
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
      
      // Cross pattern
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.moveTo(0, -20);
      ctx.lineTo(0, 20);
      ctx.stroke();
      
      ctx.restore();
      
      // Orbiting nodes
      if (boss.parts) {
        for (const part of boss.parts) {
          if (!part.active) continue;
          
          ctx.save();
          ctx.translate(part.x, part.y);
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
      
    default:
      // Default boss rendering
      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
  }
};

export const renderBossHUD = (
  ctx: CanvasRenderingContext2D,
  boss: RemixBoss,
  worldWidth: number
) => {
  if (!boss.active) return;
  
  const barWidth = 300;
  const barHeight = 20;
  const x = (worldWidth - barWidth) / 2;
  const y = 60;
  
  // Background
  ctx.fillStyle = "#000000aa";
  ctx.fillRect(x - 5, y - 5, barWidth + 10, barHeight + 10);
  
  // Border
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barWidth, barHeight);
  
  if (boss.parts && boss.config.multiPart) {
    // Multi-part boss - individual HP bars
    const partWidth = barWidth / boss.parts.length;
    
    for (let i = 0; i < boss.parts.length; i++) {
      const part = boss.parts[i];
      if (!part.active) continue;
      
      const partX = x + i * partWidth;
      const hpPercent = part.hp / part.maxHp;
      const fillWidth = (partWidth - 2) * hpPercent;
      
      // HP fill
      ctx.fillStyle = hpPercent > 0.5 ? "#ff6600" : hpPercent > 0.25 ? "#ffaa00" : "#ff0000";
      ctx.fillRect(partX + 1, y + 1, fillWidth, barHeight - 2);
      
      // Part divider
      if (i > 0) {
        ctx.strokeStyle = "#ffffff80";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(partX, y);
        ctx.lineTo(partX, y + barHeight);
        ctx.stroke();
      }
    }
  } else {
    // Single HP bar
    const hpPercent = boss.hp / boss.maxHp;
    const fillWidth = (barWidth - 2) * hpPercent;
    
    ctx.fillStyle = hpPercent > 0.5 ? "#ff6600" : hpPercent > 0.25 ? "#ffaa00" : "#ff0000";
    ctx.fillRect(x + 1, y + 1, fillWidth, barHeight - 2);
  }
  
  // Boss name
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(boss.id.replace(/_/g, " ").toUpperCase(), worldWidth / 2, y - 10);
};