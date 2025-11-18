/**
 * 5x7 Bitmap Letter Definitions for Fireworks Display
 * true = particle position, false = empty space
 */

export const LETTER_BITMAPS: Record<string, boolean[][]> = {
  'A': [
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  true,  true,  true,  true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
  ],
  'B': [
    [true,  true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  true,  true,  true,  false],
  ],
  'C': [
    [false, true,  true,  true,  true ],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [false, true,  true,  true,  true ],
  ],
  'D': [
    [true,  true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  true,  true,  true,  false],
  ],
  'E': [
    [true,  true,  true,  true,  true ],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  true,  true,  true,  false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  true,  true,  true,  true ],
  ],
  'F': [
    [true,  true,  true,  true,  true ],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  true,  true,  true,  false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
  ],
  'G': [
    [false, true,  true,  true,  true ],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, true,  true,  true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  'H': [
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  true,  true,  true,  true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
  ],
  'I': [
    [true,  true,  true,  true,  true ],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [true,  true,  true,  true,  true ],
  ],
  'J': [
    [false, false, false, false, true ],
    [false, false, false, false, true ],
    [false, false, false, false, true ],
    [false, false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  'K': [
    [true,  false, false, false, true ],
    [true,  false, false, true,  false],
    [true,  false, true,  false, false],
    [true,  true,  false, false, false],
    [true,  false, true,  false, false],
    [true,  false, false, true,  false],
    [true,  false, false, false, true ],
  ],
  'L': [
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  true,  true,  true,  true ],
  ],
  'M': [
    [true,  false, false, false, true ],
    [true,  true,  false, true,  true ],
    [true,  false, true,  false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
  ],
  'N': [
    [true,  false, false, false, true ],
    [true,  true,  false, false, true ],
    [true,  false, true,  false, true ],
    [true,  false, false, true,  true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
  ],
  'O': [
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  'P': [
    [true,  true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  true,  true,  true,  false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
  ],
  'Q': [
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, true,  false, true ],
    [true,  false, false, true,  false],
    [false, true,  true,  false, true ],
  ],
  'R': [
    [true,  true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  true,  true,  true,  false],
    [true,  false, true,  false, false],
    [true,  false, false, true,  false],
    [true,  false, false, false, true ],
  ],
  'S': [
    [false, true,  true,  true,  true ],
    [true,  false, false, false, false],
    [true,  false, false, false, false],
    [false, true,  true,  true,  false],
    [false, false, false, false, true ],
    [false, false, false, false, true ],
    [true,  true,  true,  true,  false],
  ],
  'T': [
    [true,  true,  true,  true,  true ],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
  ],
  'U': [
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  'V': [
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  false, true,  false],
    [false, false, true,  false, false],
  ],
  'W': [
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [true,  false, true,  false, true ],
    [true,  true,  false, true,  true ],
    [true,  false, false, false, true ],
  ],
  'X': [
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  false, true,  false],
    [false, false, true,  false, false],
    [false, true,  false, true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
  ],
  'Y': [
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  false, true,  false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
  ],
  'Z': [
    [true,  true,  true,  true,  true ],
    [false, false, false, false, true ],
    [false, false, false, true,  false],
    [false, false, true,  false, false],
    [false, true,  false, false, false],
    [true,  false, false, false, false],
    [true,  true,  true,  true,  true ],
  ],
  '0': [
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, true,  true ],
    [true,  false, true,  false, true ],
    [true,  true,  false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  '1': [
    [false, false, true,  false, false],
    [false, true,  true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, true,  true,  true,  false],
  ],
  '2': [
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [false, false, false, false, true ],
    [false, false, false, true,  false],
    [false, false, true,  false, false],
    [false, true,  false, false, false],
    [true,  true,  true,  true,  true ],
  ],
  '3': [
    [true,  true,  true,  true,  true ],
    [false, false, false, true,  false],
    [false, false, true,  false, false],
    [false, false, false, true,  false],
    [false, false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  '4': [
    [false, false, false, true,  false],
    [false, false, true,  true,  false],
    [false, true,  false, true,  false],
    [true,  false, false, true,  false],
    [true,  true,  true,  true,  true ],
    [false, false, false, true,  false],
    [false, false, false, true,  false],
  ],
  '5': [
    [true,  true,  true,  true,  true ],
    [true,  false, false, false, false],
    [true,  true,  true,  true,  false],
    [false, false, false, false, true ],
    [false, false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  '6': [
    [false, false, true,  true,  false],
    [false, true,  false, false, false],
    [true,  false, false, false, false],
    [true,  true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  '7': [
    [true,  true,  true,  true,  true ],
    [false, false, false, false, true ],
    [false, false, false, true,  false],
    [false, false, true,  false, false],
    [false, true,  false, false, false],
    [false, true,  false, false, false],
    [false, true,  false, false, false],
  ],
  '8': [
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  false],
  ],
  '9': [
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [true,  false, false, false, true ],
    [false, true,  true,  true,  true ],
    [false, false, false, false, true ],
    [false, false, false, true,  false],
    [false, true,  true,  false, false],
  ],
  '!': [
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [false, false, false, false, false],
    [false, false, true,  false, false],
  ],
  '?': [
    [false, true,  true,  true,  false],
    [true,  false, false, false, true ],
    [false, false, false, false, true ],
    [false, false, false, true,  false],
    [false, false, true,  false, false],
    [false, false, false, false, false],
    [false, false, true,  false, false],
  ],
  '*': [
    [false, false, true,  false, false],
    [true,  false, true,  false, true ],
    [false, true,  true,  true,  false],
    [true,  true,  true,  true,  true ],
    [false, true,  true,  true,  false],
    [true,  false, true,  false, true ],
    [false, false, true,  false, false],
  ],
  '.': [
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, true,  true,  false, false],
    [false, true,  true,  false, false],
  ],
};

export interface ParticleTarget {
  x: number;
  y: number;
}

/**
 * Converts initials string to particle target positions
 * @param initials - 1-3 character string (e.g., "ABC")
 * @param centerX - Screen center X coordinate
 * @param centerY - Screen center Y coordinate
 * @param dotSize - Size of each dot in pixels
 * @param letterSpacing - Spacing between letters in pixels
 * @returns Array of target positions for particles
 */
export function getInitialsPositions(
  initials: string,
  centerX: number,
  centerY: number,
  dotSize: number,
  letterSpacing: number
): ParticleTarget[] {
  const targets: ParticleTarget[] = [];
  const chars = initials.toUpperCase().slice(0, 3).split('');
  
  // Calculate total width of all letters
  const letterWidth = 5 * dotSize;
  const totalWidth = (letterWidth * chars.length) + (letterSpacing * (chars.length - 1));
  const startX = centerX - (totalWidth / 2);
  
  // Calculate letter height and starting Y
  const letterHeight = 7 * dotSize;
  const startY = centerY - (letterHeight / 2);
  
  // Generate particle targets for each letter
  chars.forEach((char, letterIndex) => {
    const bitmap = LETTER_BITMAPS[char] || LETTER_BITMAPS['A']; // Fallback to 'A'
    const letterStartX = startX + (letterIndex * (letterWidth + letterSpacing));
    
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (bitmap[row][col]) {
          targets.push({
            x: letterStartX + (col * dotSize),
            y: startY + (row * dotSize)
          });
        }
      }
    }
  });
  
  return targets;
}
