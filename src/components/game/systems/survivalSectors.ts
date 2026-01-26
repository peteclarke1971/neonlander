/**
 * Survival Mode Sector Names
 * First sector appears at 100m, then every 750m thereafter
 */

export const SURVIVAL_SECTOR_NAMES = [
  "FORBIDDEN ZONE",
  "SIGNAL LOST",
  "SECTOR DELTA-7",
  "YOU SHOULD TURN BACK",
  "VECTOR RANGE EXCEEDED",
  "UNCHARTED SPACE",
  "THIS WAS A MISTAKE",
  "FINAL APPROACH SECTOR",
  "ECHO REGION",
  "DATA CORRUPTION ZONE",
  "PROCEED WITH CAUTION",
  "LAST KNOWN COORDINATES",
  "NAV GRID DISTORTED",
  "ARE YOU SURE",
  "OUTER PERIMETER",
  "NO RETURN POINT",
  "FLIGHT PATH UNSTABLE",
  "THIS LOOKS BAD",
  "CONTROLLED REGION",
  "TELEMETRY UNRELIABLE",
  "GHOST CORRIDOR",
  "STILL ALIVE… GOOD",
  "RESTRICTED AIRSPACE",
  "ABANDONED TRAJECTORY",
  "MANUAL OVERRIDE ONLY",
  "WHAT COULD GO WRONG",
  "DEEP SURVIVAL REGION",
  "AUTHORIZATION REQUIRED",
  "SYSTEM LATENCY AREA",
  "SILENT ORBIT",
  "HOLD IT TOGETHER",
  "EXTREME ENVIRONMENT",
  "MEMORY SECTOR 3",
  "YOU'RE STILL HERE",
  "DRIFTING TERRITORY",
  "AUTO-CORRECT FAILED",
  "FINAL SURVIVAL BAND",
  "CRITICAL FLIGHT ZONE",
  "DO NOT ENTER",
  "NAVIGATION DEAD ZONE",
  "KEEP IT STEADY",
  "DARK TRANSMISSION",
  "NO FURTHER WARNINGS",
  "GUIDANCE SYSTEM ACTIVE",
  "EXCLUSION RING",
  "MAXIMUM DIFFICULTY",
  "UNSUPPORTED OPERATION",
  "ENDURANCE TEST",
  "BEYOND SAFE LIMITS",
  "SECTOR ALPHA-9"
];

export const FIRST_SECTOR_DISTANCE = 100; // First sector appears at 100m
export const SECTOR_INTERVAL = 750; // Subsequent sectors every 750m after first

/**
 * Calculate sector index for a given distance
 * @param distance - Current distance in meters
 * @returns Sector index (0 = not yet reached first sector, 1+ = sector number)
 */
export function getSectorIndex(distance: number): number {
  if (distance < FIRST_SECTOR_DISTANCE) return 0;
  // First sector at 100m (index 1), then 850m (index 2), 1600m (index 3), etc.
  return 1 + Math.floor((distance - FIRST_SECTOR_DISTANCE) / SECTOR_INTERVAL);
}

/**
 * Get the sector name for a given sector index
 * @param sectorIndex - The sector number (1 = first sector at 100m)
 */
export function getSectorName(sectorIndex: number): string {
  if (sectorIndex <= 0) return "";
  return SURVIVAL_SECTOR_NAMES[(sectorIndex - 1) % SURVIVAL_SECTOR_NAMES.length];
}