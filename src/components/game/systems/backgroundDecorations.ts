// Background Decoration System for Lunar Lander
// Place atmospheric images (planets, nebulas, black holes) on specific levels

/**
 * Grid-based positioning system:
 * - Screen divided into 4 rows × 8 columns = 32 boxes
 * - Box numbering: 1 (top-left) to 32 (bottom-right)
 * - Example: Box 15 = row 2, column 7 (middle-right area)
 * 
 * Box Layout:
 * Row 1: [1][2][3][4][5][6][7][8]
 * Row 2: [9][10][11][12][13][14][15][16]
 * Row 3: [17][18][19][20][21][22][23][24]
 * Row 4: [25][26][27][28][29][30][31][32]
 */

/**
 * Convert grid box number to screen position
 * @param boxNumber - Box number (1-32)
 * @returns Position object with x, y coordinates (0-1)
 */
export function boxToPosition(boxNumber: number): { x: number; y: number } {
  if (boxNumber < 1 || boxNumber > 32) {
    console.warn(`Invalid box number: ${boxNumber}. Must be 1-32.`);
    return { x: 0.5, y: 0.5 };
  }
  
  const row = Math.floor((boxNumber - 1) / 8);
  const col = (boxNumber - 1) % 8;
  
  // Center of box
  const x = (col + 0.5) / 8;
  const y = (row + 0.5) / 4;
  
  return { x, y };
}

/**
 * Calculate scale based on box fraction
 * @param boxFraction - Fraction of box size (e.g., 0.25 = quarter, 0.5 = half, 1.0 = full box)
 * @returns Scale value relative to screen height
 */
export function boxScale(boxFraction: number): number {
  const boxHeight = 0.25; // Each box is 1/4 of screen height
  return boxHeight * boxFraction;
}

export interface BackgroundDecoration {
  id: string;
  imagePath: string;
  position: { x: number; y: number }; // Screen-space percentages (0-1)
  scale: number | { min: number; max: number }; // Relative to screen height
  opacity?: number; // 0-1
  glow?: { color: string; blur: number }; // CSS color and blur radius
  rotationSpeed?: number; // Degrees per second (positive = clockwise, negative = counter-clockwise)
  movement?: {
    direction: 'left' | 'right' | 'up' | 'down';
    speed: number; // 1-10 scale (1=very gentle, 10=crosses screen in 10s)
  };
}

export interface LevelDecorationConfig {
  levelRange?: { min: number; max: number };
  specificLevels?: number[];
  decorations: BackgroundDecoration[];
  randomPool?: string[]; // IDs to randomly select from decoration library
}

// Library of all available decorations
const decorationLibrary: Record<string, Omit<BackgroundDecoration, 'id'>> = {
  'planet-pink-neon': {
    imagePath: '/images/bg-decorations/planet-pink-neon.png',
    position: { x: 0.75, y: 0.25 }, // Top-right
    scale: 0.4,
    opacity: 0.9,
    glow: { color: '#ff006e', blur: 20 }
  },
  'planet-pink-purple': {
    imagePath: '/images/bg-decorations/planet-pink-purple.png',
    position: boxToPosition(15), // Box 15 (row 2, column 7)
    scale: boxScale(0.25), // Quarter of box size
    opacity: 0.85,
    glow: { color: '#ff006e', blur: 25 },
    rotationSpeed: 360 / 69, // One full rotation every 69 seconds
    movement: {
      direction: 'left',
      speed: 2 // Gentle movement, crosses screen in 50 seconds
    }
  },
  'test-transparency': {
    imagePath: '/images/bg-decorations/test-transparency.png',
    position: boxToPosition(10), // Box 10 (row 2, column 2)
    scale: boxScale(0.5), // Half of box size
    opacity: 1.0,
  },
  // Future additions:
  // 'nebula-purple': { ... },
  // 'blackhole-01': { ... },
};

// Level configuration map
const levelConfigurations: LevelDecorationConfig[] = [
  {
    // Level 0: Pink-purple gas giant + test transparency
    specificLevels: [0],
    decorations: [
      {
        id: 'planet-pink-purple',
        ...decorationLibrary['planet-pink-purple']
      },
      {
        id: 'test-transparency',
        ...decorationLibrary['test-transparency']
      }
    ]
  },
  // Future level configs:
  // {
  //   levelRange: { min: 0, max: 5 },
  //   decorations: [
  //     {
  //       id: 'planet-pink-neon',
  //       ...decorationLibrary['planet-pink-neon']
  //     }
  //   ]
  // },
  // {
  //   levelRange: { min: 6, max: 10 },
  //   decorations: [],
  //   randomPool: ['nebula-purple', 'planet-pink-neon'] // Random selection
  // }
];

// Seeded random number generator (same as used elsewhere in the game)
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 23);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Get decorations for a specific level
 * @param level - Level number
 * @param seed - Level seed for consistent random selection
 * @returns Array of decorations to render
 */
export function getDecorationsForLevel(level: number, seed: number): BackgroundDecoration[] {
  const decorations: BackgroundDecoration[] = [];
  const rng = mulberry32(seed + 9999); // Offset to avoid collision with other seeded randoms

  for (const config of levelConfigurations) {
    let matches = false;

    // Check if level matches this config
    if (config.levelRange) {
      matches = level >= config.levelRange.min && level <= config.levelRange.max;
    }
    if (config.specificLevels) {
      matches = matches || config.specificLevels.includes(level);
    }

    if (matches) {
      // Add configured decorations
      decorations.push(...config.decorations);

      // Add random selections from pool
      if (config.randomPool && config.randomPool.length > 0) {
        const poolIndex = Math.floor(rng() * config.randomPool.length);
        const selectedId = config.randomPool[poolIndex];
        const template = decorationLibrary[selectedId];
        
        if (template) {
          const decoration: BackgroundDecoration = {
            id: selectedId,
            ...template
          };

          // Apply random scale if configured
          if (typeof decoration.scale === 'object') {
            const scaleRange = decoration.scale;
            decoration.scale = scaleRange.min + rng() * (scaleRange.max - scaleRange.min);
          }

          decorations.push(decoration);
        }
      }
    }
  }

  return decorations;
}

/**
 * Pre-load decoration images
 * @param decorations - Array of decorations to load
 * @returns Promise that resolves when all images are loaded
 */
export function preloadDecorationImages(decorations: BackgroundDecoration[]): Promise<Map<string, HTMLImageElement>> {
  const imageMap = new Map<string, HTMLImageElement>();
  const promises: Promise<void>[] = [];

  for (const decoration of decorations) {
    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageMap.set(decoration.id, img);
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load decoration image: ${decoration.imagePath}`);
        resolve(); // Don't fail the whole loading process
      };
      img.src = decoration.imagePath;
    });
    promises.push(promise);
  }

  return Promise.all(promises).then(() => imageMap);
}

/**
 * Render decorations to canvas in screen-space
 * @param ctx - Canvas rendering context
 * @param decorations - Array of decorations to render
 * @param imageMap - Map of loaded images
 * @param screenWidth - Screen width in CSS pixels
 * @param screenHeight - Screen height in CSS pixels
 * @param currentTime - Current time in seconds (for rotation)
 */
export function renderDecorations(
  ctx: CanvasRenderingContext2D,
  decorations: BackgroundDecoration[],
  imageMap: Map<string, HTMLImageElement>,
  screenWidth: number,
  screenHeight: number,
  currentTime: number = 0
): void {
  ctx.save();
  
  for (const decoration of decorations) {
    const img = imageMap.get(decoration.id);
    if (!img || !img.complete) continue;

    // Calculate base position in screen-space
    let x = decoration.position.x * screenWidth;
    let y = decoration.position.y * screenHeight;

    // Calculate size first (needed for bounds checking)
    const scale = typeof decoration.scale === 'number' ? decoration.scale : 0.4;
    const size = screenHeight * scale;
    const drawWidth = size;
    const drawHeight = size;

    // Apply movement if configured
    if (decoration.movement) {
      const { direction, speed } = decoration.movement;
      const screenPerSecond = speed / 100; // Speed scale conversion
      
      switch (direction) {
        case 'left':
          x -= currentTime * screenPerSecond * screenWidth;
          break;
        case 'right':
          x += currentTime * screenPerSecond * screenWidth;
          break;
        case 'up':
          y -= currentTime * screenPerSecond * screenHeight;
          break;
        case 'down':
          y += currentTime * screenPerSecond * screenHeight;
          break;
      }
    }

    // Skip rendering if decoration is off screen
    const margin = Math.max(drawWidth, drawHeight) / 2;
    if (x < -margin || x > screenWidth + margin || 
        y < -margin || y > screenHeight + margin) {
      continue;
    }

    // Apply opacity
    ctx.globalAlpha = decoration.opacity ?? 1.0;

    // Apply glow effect
    if (decoration.glow) {
      ctx.shadowColor = decoration.glow.color;
      ctx.shadowBlur = decoration.glow.blur;
    }

    // Handle rotation if specified
    if (decoration.rotationSpeed) {
      const rotationAngle = (currentTime * decoration.rotationSpeed * Math.PI) / 180;
      ctx.translate(x, y);
      ctx.rotate(rotationAngle);
      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    } else {
      // Draw image centered at position (non-rotating)
      ctx.drawImage(
        img,
        x - drawWidth / 2,
        y - drawHeight / 2,
        drawWidth,
        drawHeight
      );
    }

    // Reset effects
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  
  ctx.restore();
}
