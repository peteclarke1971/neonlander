 // Shared configuration for all starfield effects
 
 export interface StarfieldConfig {
   density: number;      // 0.3 - 2.0, multiplier for particle count
   speed: number;        // 0.3 - 3.0, animation speed multiplier
   colorCycle: boolean;  // Enable neon color cycling
   colorSpeed: number;   // 0.2 - 3.0, speed of color transitions
   neonHue: number;      // 0 - 360, base hue
   glow: number;         // 0 - 2.0, glow radius multiplier
   trail: number;        // 0 - 2.0, trail length multiplier
   bloom: number;        // 0 - 1.0, central bloom intensity
 }
 
 export const DEFAULT_STARFIELD_CONFIG: StarfieldConfig = {
   density: 1.0,
   speed: 1.0,
   colorCycle: true,
   colorSpeed: 1.0,
   neonHue: 280,
   glow: 1.0,
   trail: 1.0,
   bloom: 0.5,
 };
 
 const STORAGE_KEYS = {
   density: 'll-starfield-density',
   speed: 'll-starfield-speed',
   colorCycle: 'll-starfield-color-cycle',
   colorSpeed: 'll-starfield-color-speed',
   neonHue: 'll-starfield-neon-hue',
   glow: 'll-starfield-glow',
   trail: 'll-starfield-trail',
   bloom: 'll-starfield-bloom',
 } as const;
 
 export function loadStarfieldConfig(): StarfieldConfig {
   try {
     return {
       density: parseFloat(localStorage.getItem(STORAGE_KEYS.density) || '') || DEFAULT_STARFIELD_CONFIG.density,
       speed: parseFloat(localStorage.getItem(STORAGE_KEYS.speed) || '') || DEFAULT_STARFIELD_CONFIG.speed,
       colorCycle: localStorage.getItem(STORAGE_KEYS.colorCycle) !== 'false',
       colorSpeed: parseFloat(localStorage.getItem(STORAGE_KEYS.colorSpeed) || '') || DEFAULT_STARFIELD_CONFIG.colorSpeed,
       neonHue: parseInt(localStorage.getItem(STORAGE_KEYS.neonHue) || '') || DEFAULT_STARFIELD_CONFIG.neonHue,
       glow: parseFloat(localStorage.getItem(STORAGE_KEYS.glow) || '') || DEFAULT_STARFIELD_CONFIG.glow,
       trail: parseFloat(localStorage.getItem(STORAGE_KEYS.trail) || '') || DEFAULT_STARFIELD_CONFIG.trail,
       bloom: parseFloat(localStorage.getItem(STORAGE_KEYS.bloom) || '') || DEFAULT_STARFIELD_CONFIG.bloom,
     };
   } catch {
     return { ...DEFAULT_STARFIELD_CONFIG };
   }
 }
 
 export function saveStarfieldConfig(config: Partial<StarfieldConfig>): void {
   try {
     if (config.density !== undefined) localStorage.setItem(STORAGE_KEYS.density, config.density.toString());
     if (config.speed !== undefined) localStorage.setItem(STORAGE_KEYS.speed, config.speed.toString());
     if (config.colorCycle !== undefined) localStorage.setItem(STORAGE_KEYS.colorCycle, config.colorCycle ? 'true' : 'false');
     if (config.colorSpeed !== undefined) localStorage.setItem(STORAGE_KEYS.colorSpeed, config.colorSpeed.toString());
     if (config.neonHue !== undefined) localStorage.setItem(STORAGE_KEYS.neonHue, config.neonHue.toString());
     if (config.glow !== undefined) localStorage.setItem(STORAGE_KEYS.glow, config.glow.toString());
     if (config.trail !== undefined) localStorage.setItem(STORAGE_KEYS.trail, config.trail.toString());
     if (config.bloom !== undefined) localStorage.setItem(STORAGE_KEYS.bloom, config.bloom.toString());
   } catch {}
 }
 
 export function resetStarfieldConfig(): void {
   try {
     Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
   } catch {}
 }
 
 // Neon color palette - shared across all starfield components
 export const NEON_COLORS = [
   { h: 330, s: 100, l: 65 }, // pink
   { h: 270, s: 100, l: 70 }, // purple
   { h: 180, s: 100, l: 60 }, // cyan
   { h: 140, s: 100, l: 55 }, // green
   { h: 50, s: 100, l: 55 },  // yellow
   { h: 25, s: 100, l: 60 },  // orange
 ];
 
 // Interpolate between two colors with proper hue wrapping
 export function lerpColor(
   c1: { h: number; s: number; l: number },
   c2: { h: number; s: number; l: number },
   t: number
 ): { h: number; s: number; l: number } {
   let h1 = c1.h, h2 = c2.h;
   if (Math.abs(h2 - h1) > 180) {
     if (h2 > h1) h1 += 360;
     else h2 += 360;
   }
   return {
     h: ((h1 + (h2 - h1) * t) % 360 + 360) % 360,
     s: c1.s + (c2.s - c1.s) * t,
     l: c1.l + (c2.l - c1.l) * t,
   };
 }
 
 // Get color from palette with optional base hue shift
 export function getColorAtPosition(
   position: number,
   baseHue: number,
   colors: typeof NEON_COLORS = NEON_COLORS
 ): { h: number; s: number; l: number } {
   const colorPos = (position % colors.length + colors.length) % colors.length;
   const colorIndex = Math.floor(colorPos);
   const colorT = colorPos - colorIndex;
   const c1 = colors[colorIndex];
   const c2 = colors[(colorIndex + 1) % colors.length];
   const interpolated = lerpColor(c1, c2, colorT);
   
   // Apply base hue shift
   const hueShift = baseHue - 280; // 280 is default purple
   return {
     h: (interpolated.h + hueShift + 360) % 360,
     s: interpolated.s,
     l: interpolated.l,
   };
 }