import { VolcanoParticle } from "./volcano";
import { CavernData } from "../cavern";
import { getCavernVolcanoSurfaceNormal } from "./cavernVolcano";
import { Volcano } from "../types";

export function updateCavernVolcanoParticles(
  particles: VolcanoParticle[],
  dt: number,
  cavernData: CavernData
): void {
  // Update existing particles with cavern collision
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    
    // Physics
    particle.x += particle.vx * dt;
    particle.vy += 200 * dt; // gravity
    particle.y += particle.vy * dt;
    
    // Check collision with cavern walls
    if (cavernData.checkCollision(particle.x, particle.y, particle.size)) {
      // Particle hit cavern wall - fade it out quickly
      particle.life = Math.min(particle.life, 0.2);
      particle.temperature = 0; // Cool down on impact
      
      // Reduce velocity on impact
      particle.vx *= 0.3;
      particle.vy *= 0.3;
    }
    
    // Life and temperature decay
    particle.life -= dt / particle.maxLife;
    particle.temperature = Math.max(0, particle.temperature - dt * 0.5);
    
    // Remove dead particles
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function createCavernVolcanoParticles(
  volcano: Volcano,
  cavernData: CavernData,
  count: number
): VolcanoParticle[] {
  const particles: VolcanoParticle[] = [];
  
  // Get surface normal for this volcano
  const normal = getCavernVolcanoSurfaceNormal(volcano, cavernData);
  
  for (let i = 0; i < count; i++) {
    // Base emission angle from surface normal
    const baseAngle = Math.atan2(normal.y, normal.x);
    
    // Add variation around the normal direction
    const variation = (Math.random() - 0.5) * Math.PI * 0.6; // 60 degree spread
    const angle = baseAngle + variation;
    
    // Speed scaling based on volcano power
    const speed = volcano.power * (80 + Math.random() * 120);
    const size = 2 + Math.random() * 4;
    const life = 2 + Math.random() * 2;
    
    particles.push({
      x: volcano.x + (Math.random() - 0.5) * volcano.size * 0.5,
      y: volcano.y + (Math.random() - 0.5) * volcano.size * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: life,
      size,
      temperature: 0.8 + Math.random() * 0.2 // start hot
    });
  }
  
  return particles;
}