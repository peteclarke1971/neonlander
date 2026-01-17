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
  // Thruster particles per burst
  thrusterParticles: { low: 2, mid: 8, high: 25 },
  
  // Max thruster particles in pool
  maxThrusterParticles: { low: 30, mid: 100, high: 300 },
  
  // Star count for backgrounds
  starCount: { low: 150, mid: 220, high: 320 },
  
  // Hyperspace density
  hyperspaceDensity: { low: 400, mid: 800, high: 1200 },
  
  // Nozzle count for thrust effect
  nozzleCount: { low: 1, mid: 2, high: 3 },
  
  // Debris count for explosions
  debrisCount: { low: 12, mid: 16, high: 20 },
  
  // Particle count per explosion
  explosionParticles: { low: 2, mid: 3, high: 4 },
  
  // Shadow blur radius
  shadowBlur: { low: 0, mid: 8, high: 25 },
  
  // Particle lifespan multiplier
  particleLifespan: { low: 0.5, mid: 1.0, high: 1.6 },
  
  // Shield break shards
  shieldBreakShards: { low: 8, mid: 20, high: 40 },
  
  // Max concurrent lightning
  maxLightning: { low: 1, mid: 2, high: 3 },
  
  // Fireworks particle scale
  fireworksScale: { low: 0.5, mid: 0.75, high: 1.0 },
  
  // Background satellites
  enableBackgroundSats: { low: false, mid: true, high: true },
  
  // Glow effects
  enableGlow: { low: false, mid: true, high: true },
  
  // CRT scanlines
  enableScanlines: { low: false, mid: false, high: true },
} as const;
