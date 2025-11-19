/**
 * Arcade Character Bitmap Definitions for Fireworks Display
 * Classic Pac-Man style ghosts and Pac-Man himself
 * true = particle position, false = empty space
 */

export const ARCADE_BITMAPS: Record<string, boolean[][]> = {
  // Classic Pac-Man ghost (11x13)
  'GHOST': [
    [false, false, false, true,  true,  true,  true,  true,  false, false, false],
    [false, false, true,  true,  true,  true,  true,  true,  true,  false, false],
    [false, true,  true,  true,  true,  true,  true,  true,  true,  true,  false],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
    [true,  true,  false, false, true,  true,  true,  false, false, true,  true ],
    [true,  true,  false, false, true,  true,  true,  false, false, true,  true ],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
    [true,  true,  false, true,  false, true,  false, true,  false, true,  true ],
    [true,  false, true,  false, true,  false, true,  false, true,  false, true ],
    [true,  false, false, false, false, false, false, false, false, false, true ],
  ],
  
  // Pac-Man (facing right, mouth open) (11x11)
  'PACMAN': [
    [false, false, true,  true,  true,  true,  true,  true,  true,  false, false],
    [false, true,  true,  true,  true,  true,  true,  true,  true,  true,  false],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  false, false],
    [true,  true,  true,  true,  true,  true,  true,  true,  false, false, false],
    [true,  true,  true,  true,  true,  true,  true,  false, false, false, false],
    [true,  true,  true,  true,  true,  true,  true,  false, false, false, false],
    [true,  true,  true,  true,  true,  true,  true,  true,  false, false, false],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  false, false],
    [false, true,  true,  true,  true,  true,  true,  true,  true,  true,  false],
    [false, false, true,  true,  true,  true,  true,  true,  true,  false, false],
    [false, false, false, true,  true,  true,  true,  true,  false, false, false],
  ],
  
  // Scared ghost (blue/white) (11x13)
  'GHOST_SCARED': [
    [false, false, false, true,  true,  true,  true,  true,  false, false, false],
    [false, false, true,  true,  true,  true,  true,  true,  true,  false, false],
    [false, true,  true,  true,  true,  true,  true,  true,  true,  true,  false],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
    [false, false, true,  false, false, true,  false, false, true,  false, false],
    [false, false, true,  false, false, true,  false, false, true,  false, false],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
    [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
    [true,  true,  false, false, true,  true,  true,  false, false, true,  true ],
    [true,  false, false, true,  false, true,  false, true,  false, false, true ],
    [true,  true,  false, true,  false, true,  false, true,  false, true,  true ],
    [true,  false, true,  false, true,  false, true,  false, true,  false, true ],
    [true,  false, false, false, false, false, false, false, false, false, true ],
  ],
};

export interface ParticleTarget {
  x: number;
  y: number;
}

/**
 * Converts arcade character to particle target positions
 * @param character - Character name (e.g., "GHOST", "PACMAN")
 * @param centerX - Screen center X coordinate
 * @param centerY - Screen center Y coordinate
 * @param dotSize - Size of each dot in pixels
 * @returns Array of target positions for particles
 */
export function getArcadeShapePositions(
  character: string,
  centerX: number,
  centerY: number,
  dotSize: number
): ParticleTarget[] {
  const targets: ParticleTarget[] = [];
  const bitmap = ARCADE_BITMAPS[character];
  
  if (!bitmap) {
    console.warn(`Unknown arcade character: ${character}`);
    return targets;
  }
  
  const height = bitmap.length;
  const width = bitmap[0].length;
  
  // Calculate total dimensions
  const totalWidth = width * dotSize;
  const totalHeight = height * dotSize;
  const startX = centerX - (totalWidth / 2);
  const startY = centerY - (totalHeight / 2);
  
  // Generate particle targets
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (bitmap[row][col]) {
        targets.push({
          x: startX + (col * dotSize),
          y: startY + (row * dotSize)
        });
      }
    }
  }
  
  return targets;
}
