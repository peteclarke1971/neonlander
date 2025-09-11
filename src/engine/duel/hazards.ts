import { VolcanoVent, VolcanoParticle, DuelPlayer } from "./types";
import { mix } from "./arenaGen";

const ERUPTION_CYCLE = 6000; // ms total cycle
const ERUPTION_DURATION = 2000; // ms erupting
const TELEGRAPH_TIME = 600; // ms warning before eruption
const PARTICLE_SPEED_MIN = 200; // px/s
const PARTICLE_SPEED_MAX = 400; // px/s
const PARTICLE_LIFETIME = 3000; // ms
const PARTICLES_PER_ERUPTION = 8;

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function updateVolcanoVents(
  vents: VolcanoVent[],
  deltaTime: number,
  seed: number,
  suddenDeath: boolean,
  worldHeight: number
): void {
  const deltaMs = deltaTime * 1000;
  
  for (const vent of vents) {
    vent.cycleTime += deltaMs;
    
    // Reset cycle
    if (vent.cycleTime >= ERUPTION_CYCLE) {
      vent.cycleTime -= ERUPTION_CYCLE;
    }
    
    // Check eruption state
    const timeInCycle = vent.cycleTime;
    const shouldTelegraph = timeInCycle >= (ERUPTION_CYCLE - ERUPTION_DURATION - TELEGRAPH_TIME) &&
                           timeInCycle < (ERUPTION_CYCLE - ERUPTION_DURATION);
    const shouldErupt = timeInCycle >= (ERUPTION_CYCLE - ERUPTION_DURATION);
    
    vent.telegraphTime = shouldTelegraph ? TELEGRAPH_TIME - (timeInCycle - (ERUPTION_CYCLE - ERUPTION_DURATION - TELEGRAPH_TIME)) : 0;
    
    // Start eruption
    if (shouldErupt && !vent.isErupting) {
      vent.isErupting = true;
      spawnVolcanoParticles(vent, seed, suddenDeath);
    } else if (!shouldErupt && vent.isErupting) {
      vent.isErupting = false;
    }
    
    // Update particles
    updateVolcanoParticles(vent.particles, deltaTime, worldHeight);
  }
}

function spawnVolcanoParticles(vent: VolcanoVent, seed: number, suddenDeath: boolean): void {
  const particleSeed = mix(seed, "DUEL_VOLCANO", vent.id, Date.now());
  const rng = mulberry32(particleSeed);
  
  const particleCount = suddenDeath ? Math.floor(PARTICLES_PER_ERUPTION * 1.2) : PARTICLES_PER_ERUPTION;
  
  for (let i = 0; i < particleCount; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = PARTICLE_SPEED_MIN + rng() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
    
    // Bias angles upward
    const biasedAngle = angle * 0.6 - Math.PI * 0.8; // Mostly upward and outward
    
    const particle: VolcanoParticle = {
      id: `${vent.id}_${Date.now()}_${i}`,
      x: vent.x + (rng() - 0.5) * vent.radius,
      y: vent.y + (rng() - 0.5) * vent.radius * 0.5,
      vx: Math.cos(biasedAngle) * speed,
      vy: Math.sin(biasedAngle) * speed,
      lifetime: PARTICLE_LIFETIME,
      bounced: false,
      hot: true
    };
    
    vent.particles.push(particle);
  }
}

function updateVolcanoParticles(
  particles: VolcanoParticle[],
  deltaTime: number,
  worldHeight: number
): void {
  const gravity = 800; // px/s²
  const deltaMs = deltaTime * 1000;
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    
    // Update position
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    
    // Apply gravity
    particle.vy += gravity * deltaTime;
    
    // Ground collision (simple)
    if (particle.y >= worldHeight - 20 && !particle.bounced) {
      particle.vy *= -0.3; // Bounce with energy loss
      particle.vx *= 0.7; // Friction
      particle.y = worldHeight - 20;
      particle.bounced = true;
      particle.hot = false; // Cool down after bouncing
    }
    
    // Update lifetime
    particle.lifetime -= deltaMs;
    
    // Remove expired particles
    if (particle.lifetime <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function checkVolcanoCollision(
  player: DuelPlayer,
  vents: VolcanoVent[],
  shipRadius: number = 12
): boolean {
  for (const vent of vents) {
    for (const particle of vent.particles) {
      if (!particle.hot) continue; // Only hot particles are dangerous
      
      const dx = player.x - particle.x;
      const dy = player.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < (shipRadius + 8)) {
        return true; // Hit by lava particle = instant KO
      }
    }
  }
  return false;
}

export function renderVolcanoVents(
  ctx: CanvasRenderingContext2D,
  vents: VolcanoVent[],
  neonColor: string = "hsl(var(--neon))"
): void {
  ctx.save();
  
  for (const vent of vents) {
    // Draw vent base
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(vent.x, vent.y, vent.radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Telegraph warning
    if (vent.telegraphTime > 0) {
      ctx.fillStyle = `hsl(0 100% 60% / ${vent.telegraphTime / 600})`;
      ctx.shadowBlur = 16;
      ctx.shadowColor = "hsl(0 100% 60%)";
      
      ctx.beginPath();
      ctx.arc(vent.x, vent.y, vent.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Render particles
    renderVolcanoParticles(ctx, vent.particles);
  }
  
  ctx.restore();
}

function renderVolcanoParticles(
  ctx: CanvasRenderingContext2D,
  particles: VolcanoParticle[]
): void {
  for (const particle of particles) {
    const alpha = particle.lifetime / PARTICLE_LIFETIME;
    const color = particle.hot ? `hsl(20 100% 60% / ${alpha})` : `hsl(0 100% 40% / ${alpha * 0.5})`;
    
    ctx.fillStyle = color;
    ctx.shadowBlur = particle.hot ? 8 : 4;
    ctx.shadowColor = color;
    
    const size = particle.hot ? 4 : 2;
    
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}