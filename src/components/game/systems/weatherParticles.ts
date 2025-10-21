import { WeatherType, WeatherParticle, getParticleLimit } from "./weather";

/**
 * Spawn rain particles (screen-space, vertical fall)
 */
export function spawnRainParticles(
  particles: WeatherParticle[],
  canvasWidth: number,
  canvasHeight: number,
  spawnRate: number,
  intensity: number,
  lowGraphics: boolean
): void {
  const limit = getParticleLimit("neon-rain", lowGraphics);
  const colors = ['hsl(120, 90%, 60%)', 'hsl(210, 90%, 60%)', 'hsl(300, 90%, 60%)'];
  
  for (let i = 0; i < spawnRate * intensity; i++) {
    if (particles.length >= limit) break;
    
    particles.push({
      x: Math.random() * canvasWidth,
      y: -20,
      vx: (Math.random() - 0.5) * 40, // Slight horizontal drift
      vy: 300 + Math.random() * 300, // 300-600 px/s
      size: 1 + Math.random(), // 1-2px width
      alpha: 0.5 + Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      maxLife: 10, // Long lifetime (screen-space)
      type: "rain"
    });
  }
}

/**
 * Spawn dust cloud particles (world-space, drifting)
 */
export function spawnDustParticles(
  particles: WeatherParticle[],
  cameraX: number,
  canvasWidth: number,
  canvasHeight: number,
  spawnRate: number,
  intensity: number,
  terrainColor: string,
  lowGraphics: boolean
): void {
  const limit = getParticleLimit("dust-clouds", lowGraphics);
  
  for (let i = 0; i < spawnRate * intensity; i++) {
    if (particles.length >= limit) break;
    
    // Spawn within 2x viewport width around camera
    const spawnX = cameraX - canvasWidth + Math.random() * canvasWidth * 3;
    
    particles.push({
      x: spawnX,
      y: Math.random() * canvasHeight,
      vx: 20 + Math.random() * 60, // 20-80 px/s horizontal drift
      vy: (Math.random() - 0.5) * 20, // ±10 px/s vertical drift
      size: 10 + Math.random() * 30, // 10-40px radius
      alpha: 0.3 + Math.random() * 0.3,
      color: terrainColor,
      life: 0,
      maxLife: 20, // Long lifetime
      type: "dust",
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5
    });
  }
}

/**
 * Spawn plasma drizzle particles (screen-space, diagonal fall)
 */
export function spawnPlasmaParticles(
  particles: WeatherParticle[],
  canvasWidth: number,
  canvasHeight: number,
  spawnRate: number,
  intensity: number,
  lowGraphics: boolean
): void {
  const limit = getParticleLimit("plasma-drizzle", lowGraphics);
  const colors = ['hsl(330, 100%, 70%)', 'hsl(30, 100%, 65%)'];
  
  for (let i = 0; i < spawnRate * intensity; i++) {
    if (particles.length >= limit) break;
    
    // Spawn from top-left, falling diagonally
    const angle = (30 + Math.random() * 15) * Math.PI / 180; // 30-45°
    const speed = 200 + Math.random() * 150; // 200-350 px/s
    
    particles.push({
      x: Math.random() * canvasWidth * 1.2,
      y: -50,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 3, // 3-6px radius
      alpha: 0.7 + Math.random() * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      maxLife: 10,
      type: "spark"
    });
  }
}

/**
 * Update rain particles (screen-space)
 */
export function updateRainParticles(
  particles: WeatherParticle[],
  dt: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    
    // Remove if off-screen or expired
    if (p.y > canvasHeight + 50 || p.x < -50 || p.x > canvasWidth + 50 || p.life >= p.maxLife) {
      particles.splice(i, 1);
    }
  }
}

/**
 * Update dust particles (world-space) with thruster interaction
 */
export function updateDustParticles(
  particles: WeatherParticle[],
  dt: number,
  cameraX: number,
  canvasWidth: number,
  canvasHeight: number,
  shipX: number,
  shipY: number,
  thrusting: boolean,
  thrusterColor: string
): void {
  const thrusterRange = 100;
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    
    if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
      p.rotation += p.rotationSpeed * dt;
    }
    
    // Thruster interaction: push dust away and illuminate
    if (thrusting) {
      const dx = p.x - shipX;
      const dy = p.y - shipY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < thrusterRange) {
        const force = (1 - dist / thrusterRange) * 200;
        p.vx += (dx / dist) * force * dt;
        p.vy += (dy / dist) * force * dt;
        
        // Tint toward thruster color
        p.color = thrusterColor;
        p.alpha = Math.min(1, p.alpha + 0.3);
      }
    }
    
    // Cull if too far from camera
    const screenX = p.x - cameraX;
    if (screenX < -canvasWidth || screenX > canvasWidth * 2 || p.y < -100 || p.y > canvasHeight + 100 || p.life >= p.maxLife) {
      particles.splice(i, 1);
    }
  }
}

/**
 * Update plasma particles with shield interaction
 */
export function updatePlasmaParticles(
  particles: WeatherParticle[],
  dt: number,
  canvasWidth: number,
  canvasHeight: number,
  shipX: number,
  shipY: number,
  shieldActive: boolean,
  shieldRadius: number,
  onShieldHit?: () => void
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    
    // Check shield collision
    if (shieldActive) {
      const dx = p.x - shipX;
      const dy = p.y - shipY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < shieldRadius) {
        // Hit shield - remove particle and trigger effect
        particles.splice(i, 1);
        if (onShieldHit) onShieldHit();
        continue;
      }
    }
    
    // Remove if off-screen or expired
    if (p.y > canvasHeight + 50 || p.x < -50 || p.x > canvasWidth + 50 || p.life >= p.maxLife) {
      particles.splice(i, 1);
    }
  }
}

/**
 * Apply transition alpha to particles during weather changes
 */
export function applyTransitionAlpha(
  particles: WeatherParticle[],
  transitionProgress: number,
  fadingOut: boolean
): void {
  const targetAlpha = fadingOut ? (1 - transitionProgress) : transitionProgress;
  
  for (const p of particles) {
    p.alpha = Math.min(p.alpha, targetAlpha);
  }
}

/**
 * Clear all particles
 */
export function clearParticles(particles: WeatherParticle[]): void {
  particles.length = 0;
}
