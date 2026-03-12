/**
 * Graphics Configuration System
 * Manages Low/Mid/High graphics tiers across the application
 */

export type GraphicsLevel = "low" | "mid" | "high";

export interface GraphicsSettings {
  graphicsLevel: GraphicsLevel;
}

/**
 * Load graphics settings with migration from legacy boolean format
 */
export function loadGraphicsSettings(): GraphicsLevel {
  try {
    const saved = localStorage.getItem("ll-graphics-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate from legacy boolean format
      if (typeof parsed.lowGraphics === "boolean") {
        const migrated = parsed.lowGraphics ? "low" : "high";
        // Save in new format
        saveGraphicsSettings(migrated);
        return migrated;
      }
      // New format
      if (parsed.graphicsLevel) {
        return parsed.graphicsLevel as GraphicsLevel;
      }
    }
  } catch {}
  return "high"; // Default to high
}

/**
 * Save graphics settings to localStorage
 */
export function saveGraphicsSettings(level: GraphicsLevel): void {
  try {
    localStorage.setItem("ll-graphics-settings", JSON.stringify({ graphicsLevel: level }));
  } catch {}
}

/**
 * Cycle to next graphics level: low → mid → high → low
 */
export function cycleGraphicsLevel(current: GraphicsLevel): GraphicsLevel {
  if (current === "low") return "mid";
  if (current === "mid") return "high";
  return "low";
}

/**
 * Get display label for graphics level
 */
export function getGraphicsLabel(level: GraphicsLevel): string {
  if (level === "low") return "Low-GFX";
  if (level === "mid") return "Mid-GFX";
  return "High-GFX";
}

/**
 * Helper to get tier-specific values for graphics settings
 * @param level - Current graphics level
 * @param low - Value for low graphics
 * @param mid - Value for mid graphics
 * @param high - Value for high graphics
 */
export function getGraphicsValue<T>(level: GraphicsLevel, low: T, mid: T, high: T): T {
  if (level === "low") return low;
  if (level === "mid") return mid;
  return high;
}

/**
 * Check if current level should be treated as "optimized" (low or mid)
 */
export function isOptimizedGraphics(level: GraphicsLevel): boolean {
  return level === "low" || level === "mid";
}

/**
 * Get boolean for legacy compatibility (treats mid as low for safety)
 */
export function toLegacyLowGraphics(level: GraphicsLevel): boolean {
  return level === "low";
}

// ============================================
// Graphics tier value constants
// ============================================

export const GRAPHICS_VALUES = {
  // Thruster particles per burst (mid reduced from 8 to 4)
  thrusterParticles: { low: 2, mid: 4, high: 25 },
  
  // Max thruster particles in pool (mid reduced from 100 to 50)
  maxThrusterParticles: { low: 30, mid: 50, high: 300 },
  
  // Star count for backgrounds (mid reduced from 220 to 170)
  starCount: { low: 150, mid: 170, high: 320 },
  
  // Hyperspace density (mid reduced from 800 to 500)
  hyperspaceDensity: { low: 400, mid: 500, high: 1200 },
  
  // Nozzle count for thrust effect (mid stays at 2 for visual improvement over low)
  nozzleCount: { low: 1, mid: 2, high: 3 },
  
  // Debris count for explosions (mid reduced from 16 to 14)
  debrisCount: { low: 12, mid: 14, high: 20 },
  
  // Particle count per explosion (mid reduced from 3 to 2)
  explosionParticles: { low: 2, mid: 2, high: 4 },
  
  // Shadow blur radius (mid reduced from 8 to 4 - major perf impact)
  shadowBlur: { low: 0, mid: 4, high: 25 },
  
  // Particle lifespan multiplier (mid reduced from 1.0 to 0.7)
  particleLifespan: { low: 0.5, mid: 0.7, high: 1.6 },
  
  // Shield break shards (mid reduced from 20 to 12)
  shieldBreakShards: { low: 8, mid: 12, high: 40 },
  
  // Max concurrent lightning (mid reduced from 2 to 1)
  maxLightning: { low: 1, mid: 1, high: 3 },
  
  // Fireworks particle scale (mid reduced from 0.75 to 0.6)
  fireworksScale: { low: 0.5, mid: 0.6, high: 1.0 },
  
  // Background satellites (mid disabled - significant perf impact on mobile)
  enableBackgroundSats: { low: false, mid: false, high: true },
  
  // Glow effects (mid disabled - shadowBlur is expensive on mobile GPU)
  enableGlow: { low: false, mid: false, high: true },
  
  // CRT scanlines
  enableScanlines: { low: false, mid: false, high: true },
  
  // Light beam effect settings (iPad optimizations for mid/low)
  lightBeamBloomPass: { low: false, mid: false, high: true },
  lightBeamGradientStops: { low: 3, mid: 3, high: 5 },
  lightBeamShadowBlur: { low: 0, mid: 0, high: 1.5 }, // multiplier applied to base shadowBlur
} as const;

// ============================================
// Auto-detect optimal graphics benchmark
// ============================================

export interface BenchmarkResult {
  level: GraphicsLevel;
  avgFrameTime: number;
  recommendation: string;
}

/**
 * Run a canvas-based performance benchmark to detect optimal graphics level.
 * Renders particle effects with varying complexity and measures frame times.
 * 
 * Thresholds:
 * - < 8ms average → HIGH graphics
 * - 8-16ms average → MID graphics
 * - > 16ms average → LOW graphics
 */
export function detectOptimalGraphics(): Promise<BenchmarkResult> {
  return new Promise((resolve) => {
    // Create offscreen canvas for benchmarking
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve({ level: 'mid', avgFrameTime: 16, recommendation: 'Mid (fallback - no canvas context)' });
      return;
    }
    
    const frameTimes: number[] = [];
    const totalFrames = 100;
    let frameCount = 0;
    
    // Particle simulation data
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      hue: number;
      alpha: number;
    }> = [];
    
    // Initialize particles
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: 2 + Math.random() * 8,
        hue: Math.random() * 360,
        alpha: 0.5 + Math.random() * 0.5,
      });
    }
    
    const renderFrame = () => {
      const startTime = performance.now();
      
      // Clear with semi-transparent black (motion blur effect)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and render particles with expensive effects
      for (const p of particles) {
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        
        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        
        // Expensive glow effect (shadowBlur)
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 60%, ${p.alpha})`;
        
        // Gradient fill
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, p.size
        );
        gradient.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${p.alpha})`);
        gradient.addColorStop(0.5, `hsla(${p.hue}, 100%, 50%, ${p.alpha * 0.5})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 100%, 30%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Update hue for color cycling
        p.hue = (p.hue + 1) % 360;
      }
      
      // Add some additional expensive operations
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(255, 100, 255, 0.5)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        ctx.moveTo(particles[i * 10].x, particles[i * 10].y);
        ctx.lineTo(particles[i * 10 + 1].x, particles[i * 10 + 1].y);
      }
      ctx.stroke();
      ctx.restore();
      
      const endTime = performance.now();
      frameTimes.push(endTime - startTime);
      frameCount++;
      
      if (frameCount < totalFrames) {
        requestAnimationFrame(renderFrame);
      } else {
        // Calculate results
        const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        
        let level: GraphicsLevel;
        let recommendation: string;
        
        if (avgFrameTime < 8) {
          level = 'high';
          recommendation = `High (${avgFrameTime.toFixed(1)}ms avg - excellent performance)`;
        } else if (avgFrameTime < 16) {
          level = 'mid';
          recommendation = `Mid (${avgFrameTime.toFixed(1)}ms avg - good performance)`;
        } else {
          level = 'low';
          recommendation = `Low (${avgFrameTime.toFixed(1)}ms avg - optimized for this device)`;
        }
        
        resolve({ level, avgFrameTime, recommendation });
      }
    };
    
    // Start benchmark after a small delay to let the page settle
    setTimeout(() => {
      requestAnimationFrame(renderFrame);
    }, 100);
  });
}
