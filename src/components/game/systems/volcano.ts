import { Volcano } from "../types";

export interface VolcanoParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0-1, particles fade as life decreases
  maxLife: number;
  size: number;
  temperature: number; // 0-1, affects color (1=hot red, 0=cool dark)
}

export interface VolcanoConfig {
  count: number;
  minSize: number;
  maxSize: number;
  baseInterval: number; // base time between eruptions
  eruptionDuration: number;
  particleCount: number;
  power: number;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function getVolcanoConfigForLevel(level: number): VolcanoConfig {
  if (level <= 3) {
    return {
      count: 1,
      minSize: 8, // quarter of smallest pad (32/4)
      maxSize: 16,
      baseInterval: 8, // 8 seconds between eruptions
      eruptionDuration: 2,
      particleCount: 15,
      power: 0.6
    };
  } else if (level <= 8) {
    return {
      count: 2,
      minSize: 12,
      maxSize: 24,
      baseInterval: 6,
      eruptionDuration: 2.5,
      particleCount: 25,
      power: 0.8
    };
  } else {
    return {
      count: Math.min(4, 2 + Math.floor((level - 8) / 3)),
      minSize: 16,
      maxSize: 32, // max size of smallest pad
      baseInterval: 4,
      eruptionDuration: 3,
      particleCount: 35,
      power: 1.0
    };
  }
}

export function generateVolcanoes(
  seed: number, 
  worldWidth: number, 
  level: number,
  getHeightAt: (x: number) => number,
  terrainPoints: { x: number; y: number }[]
): Volcano[] {
  const config = getVolcanoConfigForLevel(level);
  const rng = mulberry32(seed ^ 0xC0DE);
  const volcanoes: Volcano[] = [];

  // Find suitable locations (peaks or flat areas)
  const candidates: { x: number; y: number; score: number }[] = [];
  
  // Sample terrain points to find good volcano locations
  for (let i = 0; i < terrainPoints.length - 1; i++) {
    const point = terrainPoints[i];
    const nextPoint = terrainPoints[i + 1];
    const prevPoint = terrainPoints[i - 1] || terrainPoints[terrainPoints.length - 2];
    
    // Calculate slope variance (prefer peaks or flat areas)
    const leftSlope = point.y - prevPoint.y;
    const rightSlope = nextPoint.y - point.y;
    const slopeVariance = Math.abs(leftSlope - rightSlope);
    
    // Prefer higher ground and areas with low slope variance
    const heightScore = (400 - point.y) / 400; // higher is better
    const flatnessScore = Math.max(0, 1 - slopeVariance / 50); // flatter is better
    const score = heightScore * 0.6 + flatnessScore * 0.4;
    
    if (score > 0.3) {
      candidates.push({ x: point.x, y: point.y, score });
    }
  }

  // Sort by score and select best locations
  candidates.sort((a, b) => b.score - a.score);
  
  for (let i = 0; i < Math.min(config.count, candidates.length); i++) {
    // Ensure minimum distance between volcanoes
    let candidate = candidates[i];
    let validPlacement = true;
    
    for (const existing of volcanoes) {
      const distance = Math.abs(candidate.x - existing.x);
      const wrappedDistance = Math.min(distance, worldWidth - distance);
      if (wrappedDistance < worldWidth / (config.count + 1)) {
        validPlacement = false;
        break;
      }
    }
    
    if (!validPlacement) {
      // Try next candidates
      for (let j = i + 1; j < candidates.length; j++) {
        candidate = candidates[j];
        validPlacement = true;
        for (const existing of volcanoes) {
          const distance = Math.abs(candidate.x - existing.x);
          const wrappedDistance = Math.min(distance, worldWidth - distance);
          if (wrappedDistance < worldWidth / (config.count + 1)) {
            validPlacement = false;
            break;
          }
        }
        if (validPlacement) break;
      }
    }
    
    if (validPlacement) {
      const size = config.minSize + rng() * (config.maxSize - config.minSize);
      const baseInterval = config.baseInterval * (0.8 + rng() * 0.4); // slight randomization
      
      volcanoes.push({
        x: candidate.x,
        y: candidate.y,
        size,
        nextEruption: baseInterval * (0.5 + rng() * 0.5), // stagger initial eruptions
        eruptionInterval: baseInterval,
        isErupting: false,
        eruptionTimer: 0,
        eruptionDuration: config.eruptionDuration,
        power: config.power
      });
    }
  }

  return volcanoes;
}

export function updateVolcanoes(
  volcanoes: Volcano[],
  particles: VolcanoParticle[],
  dt: number,
  level: number
): { newParticles: VolcanoParticle[]; shouldPlayEruptionSound: boolean } {
  const config = getVolcanoConfigForLevel(level);
  const newParticles: VolcanoParticle[] = [];
  let shouldPlayEruptionSound = false;

  for (const volcano of volcanoes) {
    if (volcano.isErupting) {
      volcano.eruptionTimer -= dt;
      
      // Generate particles during eruption
      if (volcano.eruptionTimer > 0) {
        const particlesThisFrame = Math.floor(config.particleCount * dt / volcano.eruptionDuration);
        
        for (let i = 0; i < particlesThisFrame; i++) {
          const angle = (Math.random() - 0.5) * Math.PI * 0.6 + Math.PI / 2; // mostly upward
          const speed = volcano.power * (80 + Math.random() * 120); // base velocity
          const size = 2 + Math.random() * 4;
          const life = 2 + Math.random() * 2; // particle lifetime
          
          newParticles.push({
            x: volcano.x + (Math.random() - 0.5) * volcano.size,
            y: volcano.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: life,
            size,
            temperature: 0.8 + Math.random() * 0.2 // start hot
          });
        }
      } else {
        // End eruption
        volcano.isErupting = false;
        volcano.nextEruption = volcano.eruptionInterval * (0.8 + Math.random() * 0.4);
      }
    } else {
      // Count down to next eruption
      volcano.nextEruption -= dt;
      if (volcano.nextEruption <= 0) {
        volcano.isErupting = true;
        volcano.eruptionTimer = volcano.eruptionDuration;
        shouldPlayEruptionSound = true;
      }
    }
  }

  // Update existing particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    
    // Physics
    particle.x += particle.vx * dt;
    particle.vy += 200 * dt; // gravity
    particle.y += particle.vy * dt;
    
    // Life and temperature decay
    particle.life -= dt / particle.maxLife;
    particle.temperature = Math.max(0, particle.temperature - dt * 0.5);
    
    // Remove dead particles
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }

  // Add new particles
  particles.push(...newParticles);

  return { newParticles, shouldPlayEruptionSound };
}

export function drawVolcanoes(
  ctx: CanvasRenderingContext2D,
  volcanoes: Volcano[],
  particles: VolcanoParticle[]
) {
  // Draw volcano craters
  ctx.save();
  ctx.strokeStyle = '#8B4513'; // brown crater rim
  ctx.fillStyle = '#2F1B14'; // dark crater interior
  ctx.lineWidth = 2;

  for (const volcano of volcanoes) {
    // Crater rim
    ctx.beginPath();
    ctx.arc(volcano.x, volcano.y, volcano.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Warning glow for imminent eruption
    if (!volcano.isErupting && volcano.nextEruption < 2) {
      const glowIntensity = 1 - (volcano.nextEruption / 2);
      ctx.save();
      ctx.shadowColor = '#FF4500';
      ctx.shadowBlur = 10 * glowIntensity;
      ctx.beginPath();
      ctx.arc(volcano.x, volcano.y, volcano.size / 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 69, 0, ${glowIntensity * 0.5})`;
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw particles
  for (const particle of particles) {
    const alpha = particle.life;
    if (alpha <= 0) continue;
    
    // Color based on temperature
    let color: string;
    if (particle.temperature > 0.7) {
      color = `rgba(255, 69, 0, ${alpha})`; // hot orange-red
    } else if (particle.temperature > 0.4) {
      color = `rgba(255, 140, 0, ${alpha})`; // warm orange
    } else if (particle.temperature > 0.1) {
      color = `rgba(255, 215, 0, ${alpha})`; // cooling yellow
    } else {
      color = `rgba(139, 69, 19, ${alpha})`; // cool brown
    }
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function checkVolcanoParticleCollision(
  particles: VolcanoParticle[],
  landerX: number,
  landerY: number,
  landerRadius: number
): boolean {
  for (const particle of particles) {
    if (particle.life <= 0) continue;
    
    const dx = landerX - particle.x;
    const dy = landerY - particle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= landerRadius + particle.size) {
      return true;
    }
  }
  return false;
}

export function getVolcanoWarningState(volcanoes: Volcano[]): { hasWarning: boolean; timeToEruption: number } {
  let minTime = Infinity;
  let hasWarning = false;
  
  for (const volcano of volcanoes) {
    if (!volcano.isErupting && volcano.nextEruption < 3) {
      hasWarning = true;
      minTime = Math.min(minTime, volcano.nextEruption);
    }
  }
  
  return {
    hasWarning,
    timeToEruption: hasWarning ? minTime : 0
  };
}