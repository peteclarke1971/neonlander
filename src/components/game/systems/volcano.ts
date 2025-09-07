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
  } else if (level <= 40) {
    return {
      count: Math.min(4, 2 + Math.floor((level - 8) / 3)),
      minSize: 16,
      maxSize: 32, // max size of smallest pad
      baseInterval: 4,
      eruptionDuration: 3,
      particleCount: 35,
      power: 1.0
    };
  } else {
    // Level 40+ with mega volcanoes
    return {
      count: Math.min(4, 2 + Math.floor((level - 8) / 3)),
      minSize: 16,
      maxSize: 32,
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
  terrainPoints: { x: number; y: number }[],
  pads: { xStart: number; xEnd: number; y: number }[]
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
      // Check if location overlaps with any landing pad
      let overlapsWithPad = false;
      for (const pad of pads) {
        const padCenterX = (pad.xStart + pad.xEnd) / 2;
        const padWidth = pad.xEnd - pad.xStart;
        const distance = Math.abs(candidate.x - padCenterX);
        const wrappedDistance = Math.min(distance, worldWidth - distance);
        
        // Ensure volcano doesn't spawn within pad area + safety margin
        if (wrappedDistance < (padWidth / 2) + 50) {
          overlapsWithPad = true;
          break;
        }
      }
      
      if (!overlapsWithPad) {
        const size = config.minSize + rng() * (config.maxSize - config.minSize);
        const baseInterval = config.baseInterval * (0.8 + rng() * 0.4); // slight randomization
        
        // Mega volcano chance for level 40+
        const isMegaVolcano = level > 40 && rng() < 0.3;
        const finalSize = isMegaVolcano ? size * 1.5 : size;
        const finalPower = isMegaVolcano ? config.power * 2 : config.power;
        
        volcanoes.push({
          x: candidate.x,
          y: candidate.y,
          size: finalSize,
          nextEruption: baseInterval * (0.5 + rng() * 0.5), // stagger initial eruptions
          eruptionInterval: baseInterval,
          isErupting: false,
          eruptionTimer: 0,
          eruptionDuration: config.eruptionDuration,
          power: finalPower,
          emissionCarry: 0
        });
      }
    }
  }

  return volcanoes;
}

export function updateVolcanoes(
  volcanoes: Volcano[],
  particles: VolcanoParticle[],
  dt: number,
  level: number,
  viewLeft?: number,
  viewRight?: number
): { newParticles: VolcanoParticle[]; shouldPlayEruptionSound: boolean; eruptingVolcanoes: { x: number }[] } {
  const config = getVolcanoConfigForLevel(level);
  const newParticles: VolcanoParticle[] = [];
  let shouldPlayEruptionSound = false;
  const eruptingVolcanoes: { x: number }[] = [];
  
  // Level-based particle limit to prevent performance degradation
  const maxParticles = Math.min(config.particleCount, level > 20 ? 25 : level > 10 ? 30 : 35);

  for (const volcano of volcanoes) {
    if (volcano.isErupting) {
      volcano.eruptionTimer -= dt;
      
      // Generate particles during eruption
      if (volcano.eruptionTimer > 0) {
        // Emit particles at a steady rate across frames using an accumulator
        const rate = config.particleCount / volcano.eruptionDuration; // particles per second
        volcano.emissionCarry = (volcano.emissionCarry ?? 0) + rate * dt;
        const particlesThisFrame = Math.floor(volcano.emissionCarry);
        volcano.emissionCarry -= particlesThisFrame;
        
        // Respect particle limit to prevent performance issues
        const actualParticles = Math.min(particlesThisFrame, maxParticles - newParticles.length);
        
        for (let i = 0; i < actualParticles; i++) {
          // Canvas Y increases downward; to shoot upward use -PI/2 as the base angle
          const angle = (Math.random() - 0.5) * Math.PI * 0.6 - Math.PI / 2; // mostly upward
          
          // Height scaling by level: 1-10 (2x), 10-30 (3x), 30+ (4x)
          let heightMultiplier = 2; // default 2x for levels 1-10
          if (level >= 30) {
            heightMultiplier = 4;
          } else if (level >= 10) {
            heightMultiplier = 3;
          }
          
          const speed = volcano.power * (80 + Math.random() * 120) * heightMultiplier;
          const size = 2 + Math.random() * 4;
          const life = 2 + Math.random() * 2; // particle lifetime
          
          newParticles.push({
            x: volcano.x + (Math.random() - 0.5) * volcano.size,
            y: volcano.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed, // negative initially (upward), then gravity pulls down
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
        volcano.emissionCarry = 0;
        shouldPlayEruptionSound = true;
        eruptingVolcanoes.push({ x: volcano.x });
      }
    }
  }

  // Update existing particles with aggressive viewport culling
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    
    // Aggressive viewport culling for performance
    const margin = 50; // Reduced margin for better performance
    const inViewport = viewLeft === undefined || viewRight === undefined || 
      (particle.x >= viewLeft - margin && particle.x <= viewRight + margin);
    
    if (!inViewport && particle.life < 0.95) {
      // More aggressive culling - remove particles sooner when off-screen
      particles.splice(i, 1);
      continue;
    }
    
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

  return { newParticles, shouldPlayEruptionSound, eruptingVolcanoes };
}

export function drawVolcanoes(
  ctx: CanvasRenderingContext2D,
  volcanoes: Volcano[],
  particles: VolcanoParticle[],
  levelColor?: string,
  viewLeft?: number,
  viewRight?: number
) {
  // Draw volcano craters with viewport culling
  ctx.save();
  ctx.strokeStyle = '#8B4513'; // brown crater rim
  ctx.fillStyle = '#2F1B14'; // dark crater interior
  ctx.lineWidth = 2;

  for (const volcano of volcanoes) {
    // Skip volcanoes outside viewport
    if (viewLeft !== undefined && viewRight !== undefined) {
      if (volcano.x + volcano.size < viewLeft || volcano.x - volcano.size > viewRight) {
        continue;
      }
    }
    
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

  // Draw particles with viewport culling
  for (const particle of particles) {
    const alpha = particle.life;
    if (alpha <= 0) continue;
    
    // Skip particles outside viewport
    if (viewLeft !== undefined && viewRight !== undefined) {
      if (particle.x < viewLeft - 50 || particle.x > viewRight + 50) {
        continue;
      }
    }
    
    // Color based on temperature - use level color shades if provided
    let color: string;
    if (levelColor) {
      // Parse the level color (expected to be HSL format like "hsl(180, 100%, 50%)")
      const hslMatch = levelColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        const [, h, s, l] = hslMatch.map(Number);
        if (particle.temperature > 0.7) {
          color = `hsla(${h}, ${s}%, ${Math.min(90, l + 20)}%, ${alpha})`; // bright shade
        } else if (particle.temperature > 0.4) {
          color = `hsla(${h}, ${s}%, ${l}%, ${alpha})`; // base shade  
        } else if (particle.temperature > 0.1) {
          color = `hsla(${h}, ${Math.max(30, s - 20)}%, ${Math.max(30, l - 10)}%, ${alpha})`; // darker shade
        } else {
          color = `hsla(${h}, ${Math.max(20, s - 40)}%, ${Math.max(20, l - 30)}%, ${alpha})`; // darkest shade
        }
      } else {
        // Fallback to default colors if level color can't be parsed
        if (particle.temperature > 0.7) {
          color = `rgba(255, 69, 0, ${alpha})`;
        } else if (particle.temperature > 0.4) {
          color = `rgba(255, 140, 0, ${alpha})`;
        } else if (particle.temperature > 0.1) {
          color = `rgba(255, 215, 0, ${alpha})`;
        } else {
          color = `rgba(139, 69, 19, ${alpha})`;
        }
      }
    } else {
      // Default color scheme when no level color provided
      if (particle.temperature > 0.7) {
        color = `rgba(255, 69, 0, ${alpha})`; // hot orange-red
      } else if (particle.temperature > 0.4) {
        color = `rgba(255, 140, 0, ${alpha})`; // warm orange
      } else if (particle.temperature > 0.1) {
        color = `rgba(255, 215, 0, ${alpha})`; // cooling yellow
      } else {
        color = `rgba(139, 69, 19, ${alpha})`; // cool brown
      }
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
    
    // Skip the two smallest particle sizes (< 4) as they're too small to cause damage
    if (particle.size < 4) continue;
    
    // Skip particles that are over 70% faded (too faint to cause damage)
    if (particle.life < 0.3) continue;
    
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