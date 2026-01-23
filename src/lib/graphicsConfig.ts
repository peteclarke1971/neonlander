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
  return "low"; // Default to low for mobile safety
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
