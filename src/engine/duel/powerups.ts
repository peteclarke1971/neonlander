import { PowerupPad, PowerupType, DuelPlayer } from "./types";
import { mix } from "./arenaGen";

const POWERUP_TYPES: PowerupType[] = ["twin", "tri", "shield"];
const POWERUP_DURATION = 8; // seconds
const SPAWN_INTERVAL_MIN = 7000; // ms
const SPAWN_INTERVAL_MAX = 10000; // ms

export function updatePowerupPads(
  pads: PowerupPad[],
  deltaTime: number,
  gameTime: number,
  seed: number,
  suddenDeath: boolean
): void {
  if (suddenDeath) return; // No new powerups in sudden death
  
  for (const pad of pads) {
    if (pad.cooldownTime > 0) {
      pad.cooldownTime -= deltaTime;
      pad.glowing = false;
    } else if (!pad.powerupType) {
      // Try to spawn a powerup
      const spawnSeed = mix(seed, "DUEL_PUP", pad.id, Math.floor(gameTime / 1000));
      const spawnRng = mulberry32(spawnSeed);
      
      const interval = SPAWN_INTERVAL_MIN + spawnRng() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
      const shouldSpawn = (gameTime % interval) < deltaTime * 1000;
      
      if (shouldSpawn) {
        // Choose a random powerup type, avoiding the last type spawned at this pad
        const availableTypes = POWERUP_TYPES.filter(type => type !== pad.powerupType);
        const typeIndex = Math.floor(spawnRng() * availableTypes.length);
        pad.powerupType = availableTypes[typeIndex];
        pad.glowing = true;
      }
    }
  }
}

export function checkPowerupCollision(
  player: DuelPlayer,
  pads: PowerupPad[],
  shipRadius: number = 12
): PowerupPad | null {
  for (const pad of pads) {
    if (!pad.powerupType) continue;
    
    const dx = player.x - pad.x;
    const dy = player.y - pad.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < (pad.radius + shipRadius)) {
      return pad;
    }
  }
  return null;
}

export function activatePowerup(player: DuelPlayer, powerupType: PowerupType): void {
  // Deactivate existing powerup
  if (player.activePowerup === "shield") {
    player.shieldHitsLeft = 0;
  }
  
  // Activate new powerup
  player.activePowerup = powerupType;
  player.powerupTimeLeft = POWERUP_DURATION;
  
  if (powerupType === "shield") {
    player.shieldHitsLeft = 2; // Absorbs 2 hits
  }
}

export function updatePlayerPowerups(player: DuelPlayer, deltaTime: number): void {
  if (player.powerupTimeLeft > 0) {
    player.powerupTimeLeft -= deltaTime;
    
    if (player.powerupTimeLeft <= 0) {
      // Powerup expired
      player.activePowerup = null;
      player.powerupTimeLeft = 0;
      player.shieldHitsLeft = 0;
    }
  }
}

export function handleShieldHit(player: DuelPlayer): boolean {
  if (player.activePowerup === "shield" && player.shieldHitsLeft > 0) {
    player.shieldHitsLeft--;
    
    if (player.shieldHitsLeft === 0) {
      // Shield depleted, briefly disable firing
      player.activePowerup = null;
      player.powerupTimeLeft = 0;
      // TODO: Add brief fire disable effect (150ms)
    }
    
    return true; // Hit was blocked
  }
  return false; // Hit was not blocked
}

export function renderPowerupPads(
  ctx: CanvasRenderingContext2D,
  pads: PowerupPad[],
  neonColor: string = "hsl(var(--neon))"
): void {
  ctx.save();
  
  for (const pad of pads) {
    // Draw pad base
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, pad.radius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    if (pad.powerupType) {
      // Draw powerup icon
      ctx.fillStyle = neonColor;
      ctx.shadowBlur = pad.glowing ? 12 : 6;
      ctx.shadowColor = neonColor;
      
      drawPowerupIcon(ctx, pad.x, pad.y, pad.powerupType, 20);
    }
  }
  
  ctx.restore();
}

function drawPowerupIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: PowerupType,
  size: number
): void {
  ctx.save();
  ctx.translate(x, y);
  
  switch (type) {
    case "twin":
      // Two parallel lines
      ctx.beginPath();
      ctx.moveTo(-size/2, -size/4);
      ctx.lineTo(size/2, -size/4);
      ctx.moveTo(-size/2, size/4);
      ctx.lineTo(size/2, size/4);
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
      
    case "tri":
      // Three diverging lines
      ctx.beginPath();
      ctx.moveTo(0, -size/2);
      ctx.lineTo(0, size/2);
      ctx.moveTo(-size/3, -size/3);
      ctx.lineTo(size/3, size/3);
      ctx.moveTo(size/3, -size/3);
      ctx.lineTo(-size/3, size/3);
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
      
    case "shield":
      // Shield shape
      ctx.beginPath();
      ctx.arc(0, 0, size/2, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Inner cross
      ctx.beginPath();
      ctx.moveTo(-size/4, 0);
      ctx.lineTo(size/4, 0);
      ctx.moveTo(0, -size/4);
      ctx.lineTo(0, size/4);
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
  }
  
  ctx.restore();
}

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}