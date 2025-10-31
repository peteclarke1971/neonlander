// Background Decoration System for Lunar Lander
// Place atmospheric images (planets, nebulas, black holes) on specific levels

export interface BackgroundDecoration {
  id: string;
  imagePath: string;
  position: { x: number; y: number }; // Screen-space percentages (0-1)
  scale: number | { min: number; max: number }; // Relative to screen height
  opacity?: number; // 0-1
  glow?: { color: string; blur: number }; // CSS color and blur radius
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
  // Future additions:
  // 'nebula-purple': { ... },
  // 'blackhole-01': { ... },
};

// Level configuration map
const levelConfigurations: LevelDecorationConfig[] = [
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
 */
export function renderDecorations(
  ctx: CanvasRenderingContext2D,
  decorations: BackgroundDecoration[],
  imageMap: Map<string, HTMLImageElement>,
  screenWidth: number,
  screenHeight: number
): void {
  ctx.save();
  
  for (const decoration of decorations) {
    const img = imageMap.get(decoration.id);
    if (!img || !img.complete) continue;

    // Calculate position in screen-space
    const x = decoration.position.x * screenWidth;
    const y = decoration.position.y * screenHeight;

    // Calculate size based on screen height
    const scale = typeof decoration.scale === 'number' ? decoration.scale : 0.4;
    const size = screenHeight * scale;
    const drawWidth = size;
    const drawHeight = size;

    // Apply opacity
    ctx.globalAlpha = decoration.opacity ?? 1.0;

    // Apply glow effect
    if (decoration.glow) {
      ctx.shadowColor = decoration.glow.color;
      ctx.shadowBlur = decoration.glow.blur;
    }

    // Draw image centered at position
    ctx.drawImage(
      img,
      x - drawWidth / 2,
      y - drawHeight / 2,
      drawWidth,
      drawHeight
    );

    // Reset effects
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  
  ctx.restore();
}
