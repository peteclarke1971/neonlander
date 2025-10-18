/**
 * Progressive Color Zones for Survival Mode
 * Creates smooth color transitions based on distance traveled
 */

export interface ColorPalette {
  hue: number;           // Primary hue (0-360)
  saturation: number;    // 0-100
  lightness: number;     // 0-100
  accent: string;        // Formatted HSL string for direct use
  name: string;          // Zone name for display
}

interface ColorZone {
  startDistance: number;
  endDistance: number;
  hue: number;
  name: string;
}

// Define color zones with smooth transitions (3x longer zones)
const COLOR_ZONES: ColorZone[] = [
  { startDistance: 0, endDistance: 6000, hue: 180, name: "CYAN SECTOR" },        // Classic cyan-green
  { startDistance: 6000, endDistance: 15000, hue: 300, name: "MAGENTA SECTOR" },  // Electric magenta
  { startDistance: 15000, endDistance: 27000, hue: 180, name: "CYAN SECTOR" },     // Bright cyan
  { startDistance: 27000, endDistance: 42000, hue: 30, name: "AMBER SECTOR" },    // Deep orange
  { startDistance: 42000, endDistance: 60000, hue: 270, name: "VIOLET SECTOR" }, // Royal purple
  { startDistance: 60000, endDistance: Infinity, hue: 210, name: "AZURE SECTOR" } // Electric blue
];

// Default palette (classic cyan)
export const DEFAULT_PALETTE: ColorPalette = {
  hue: 180,
  saturation: 100,
  lightness: 50,
  accent: "hsla(180, 100%, 50%, 1)",
  name: "CYAN SECTOR"
};

// Transition speed (seconds to complete a full fade between zones)
const TRANSITION_DURATION = 8; // 8 seconds for smooth fade

/**
 * Interpolate between two hue values, taking the shortest path around the color wheel
 */
function interpolateHue(hue1: number, hue2: number, t: number): number {
  const diff = ((hue2 - hue1 + 180) % 360) - 180;
  return (hue1 + diff * t + 360) % 360;
}

/**
 * Get the current color zone index based on distance
 */
export function getCurrentZone(distance: number): number {
  for (let i = 0; i < COLOR_ZONES.length; i++) {
    if (distance >= COLOR_ZONES[i].startDistance && distance < COLOR_ZONES[i].endDistance) {
      return i;
    }
  }
  return COLOR_ZONES.length - 1;
}

/**
 * Get progress through the current zone (0-1)
 */
export function getZoneProgress(distance: number): number {
  const zoneIndex = getCurrentZone(distance);
  const zone = COLOR_ZONES[zoneIndex];
  
  if (zone.endDistance === Infinity) return 1;
  
  const zoneDistance = distance - zone.startDistance;
  const zoneLength = zone.endDistance - zone.startDistance;
  return Math.min(1, zoneDistance / zoneLength);
}

/**
 * Get the color palette for the current distance with smooth transitions
 * Uses easing to make transitions feel more natural
 */
export function getColorForDistance(distance: number, deltaTime: number = 0): ColorPalette {
  const currentZoneIndex = getCurrentZone(distance);
  const currentZone = COLOR_ZONES[currentZoneIndex];
  
  // Calculate transition progress based on distance within zone
  const zoneProgress = getZoneProgress(distance);
  
  // Apply easing for smoother transitions (ease-in-out)
  const easedProgress = zoneProgress < 0.5 
    ? 2 * zoneProgress * zoneProgress 
    : 1 - Math.pow(-2 * zoneProgress + 2, 2) / 2;
  
  // Determine if we're transitioning to next zone
  let finalHue = currentZone.hue;
  let finalName = currentZone.name;
  
  // Start transition in the first 80% of the zone (4x slower transitions)
  const transitionStart = 0.2;
  if (zoneProgress >= transitionStart && currentZoneIndex < COLOR_ZONES.length - 1) {
    const nextZone = COLOR_ZONES[currentZoneIndex + 1];
    const transitionProgress = (zoneProgress - transitionStart) / (1 - transitionStart);
    const smoothTransition = transitionProgress < 0.5
      ? 2 * transitionProgress * transitionProgress
      : 1 - Math.pow(-2 * transitionProgress + 2, 2) / 2;
    
    finalHue = interpolateHue(currentZone.hue, nextZone.hue, smoothTransition);
    
    // Update name halfway through transition
    if (transitionProgress > 0.5) {
      finalName = nextZone.name;
    }
  }
  
  const saturation = 100;
  const lightness = 50;
  
  return {
    hue: Math.round(finalHue),
    saturation,
    lightness,
    accent: `hsla(${Math.round(finalHue)}, ${saturation}%, ${lightness}%, 1)`,
    name: finalName
  };
}

/**
 * Get zone name for display
 */
export function getZoneName(distance: number): string {
  const palette = getColorForDistance(distance);
  return palette.name;
}

/**
 * Check if classic colors mode is enabled (from localStorage)
 */
export function isClassicColorsMode(): boolean {
  try {
    return localStorage.getItem('survival-classic-colors') === 'true';
  } catch {
    return false;
  }
}

/**
 * Set classic colors mode
 */
export function setClassicColorsMode(enabled: boolean): void {
  try {
    localStorage.setItem('survival-classic-colors', enabled.toString());
  } catch {
    // Ignore storage errors
  }
}
