import { Pad, TerrainData, MovingPad, CollectiblesData } from "./types";
import { generateVolcanoes } from "./systems/volcano";
import { movingPadSystem } from "./systems/movingPads";
import { generateCollectibles, PlacementContext } from "./systems/collectibles";

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTerrain(seed: number, worldWidth: number, base: number, amplitude: number, complexity = 0, level = 1, difficulty: "easy" | "hard" = "easy"): TerrainData {
  const rand = mulberry32(seed);
  const points: { x: number; y: number }[] = [];
  
  // Store original terrain heights before any pad modifications
  const originalHeights = new Map<number, number>();

  // Generate control points and interpolate for a jagged mountainous profile
  const segments = 80; // number of segments across the world
  const step = worldWidth / segments;
  const controls: number[] = [];
  let current = base + (rand() - 0.5) * amplitude;
  for (let i = 0; i <= segments; i++) {
    const drift = (rand() - 0.5) * amplitude * 0.4;
    current = base * 0.9 + current * 0.1 + drift; // smooth wander
    controls.push(current);
  }

  // Interpolate controls with slight sine variation for more natural shapes
  for (let i = 0; i <= segments; i++) {
    const x = i * step;
    const yBase = controls[i];
    const y = yBase + Math.sin((i / segments) * Math.PI * 6) * (amplitude * 0.2);
    points.push({ x, y });
  }

  // Ensure seamless wrap
  points[segments].y = points[0].y;

  // Add caverns as complexity increases
  const cavernCount = Math.min(3, Math.floor(complexity));
  for (let k = 0; k < cavernCount; k++) {
    const center = Math.floor(rand() * (segments - 10)) + 5;
    const widthIdx = 3 + Math.floor(rand() * (4 + complexity));
    const depth = amplitude * (0.25 + rand() * 0.35);
    for (let j = -widthIdx; j <= widthIdx; j++) {
      const idx = ((center + j) % (segments + 1) + (segments + 1)) % (segments + 1);
      const falloff = 1 - Math.abs(j) / (widthIdx + 1);
      points[idx].y += -depth * (0.6 + 0.4 * falloff);
    }
  }

  // Place landing pads sized from tiny to large
  const padCount = 4;
  const pads: Pad[] = [];
  for (let i = 0; i < padCount; i++) {
    // Prefer steep areas for some pads to create cliff platforms
    let centerIdx = Math.floor(rand() * (segments - 6)) + 3;
    if (i < 2) {
      // try to find a steep segment for a platform pad
      for (let attempt = 0; attempt < 20; attempt++) {
        const cand = Math.floor(rand() * (segments - 6)) + 3;
        const slope = Math.abs(points[cand + 1].y - points[cand - 1].y);
        if (slope > amplitude * 0.45) { centerIdx = cand; break; }
      }
    }

    // Choose width category
    const r = rand();
    let width: number;
    if (r < 0.35) {
      // Small pads: ~1.5x lander width (lander ~16px wide)
      width = 24 + rand() * 8; // 24-32
    } else if (r < 0.75) {
      // Medium pads
      width = step * (0.8 + rand() * 0.8); // ~40-80 if step≈50
    } else {
      // Large pads
      width = step * (1.6 + rand() * 1.8); // ~80-170 if step≈50
    }

    const multiplier = width <= 32 ? 5 : width <= step * 1.2 ? 3 : width <= step * 2 ? 2 : 1;

    const xCenter = centerIdx * step;
    const xStart = (xCenter - width / 2 + worldWidth) % worldWidth;
    const xEnd = (xCenter + width / 2 + worldWidth) % worldWidth;
    // Use original terrain height (don't bury the pad)
    const targetY = originalHeights.get(centerIdx) || points[centerIdx].y;
    
    // Flatten nearby points to create a pad region (broader than visual width for playability)
    const halfCount = Math.max(1, Math.round((width / step) * 1.2));
    for (let j = -halfCount; j <= halfCount; j++) {
      const idx = ((centerIdx + j) % (segments + 1) + (segments + 1)) % (segments + 1);
      points[idx].y = targetY;
    }
    
    const y = targetY; // use the exact flattened height

    // Check for overlap with existing pads before adding (handle world wrap + vertical proximity)
    let overlaps = false;
    for (const existingPad of pads) {
      // Calculate horizontal distance with world wrapping
      const newPadCenterX = xStart <= xEnd ? (xStart + xEnd) / 2 : ((xStart + xEnd + worldWidth) / 2) % worldWidth;
      const existingPadCenterX = existingPad.xStart <= existingPad.xEnd 
        ? (existingPad.xStart + existingPad.xEnd) / 2 
        : ((existingPad.xStart + existingPad.xEnd + worldWidth) / 2) % worldWidth;
      
      const dx = Math.abs(newPadCenterX - existingPadCenterX);
      const wrappedDx = Math.min(dx, worldWidth - dx);
      
      // Calculate vertical distance
      const dy = Math.abs(y - existingPad.y);
      
      // Require separation of at least 1.5x combined widths horizontally
      const combinedWidth = (width + (existingPad.width || 50)) * 0.75; // 1.5x with 0.5x buffer
      
      // Check if pads are too close horizontally AND vertically
      if (wrappedDx < combinedWidth && dy < 50) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      pads.push({ xStart, xEnd, y, multiplier, width, bonus2x: false });
    }
  }

  // Mark smallest pad as 2x bonus pad (most difficult)
  if (pads.length > 0) {
    let minIdx = 0;
    let minW = pads[0].width;
    for (let i = 1; i < pads.length; i++) {
      if (pads[i].width < minW) { minW = pads[i].width; minIdx = i; }
    }
    pads[minIdx].bonus2x = true;
  }

  // Store original terrain heights before pad modifications
  for (let i = 0; i <= segments; i++) {
    originalHeights.set(i, points[i].y);
  }
  
  // Re-sync seam after all modifications
  points[segments].y = points[0].y;

  const worldWidthLocal = worldWidth;
  const wrapX = (x: number) => {
    let xx = x % worldWidthLocal;
    if (xx < 0) xx += worldWidthLocal;
    return xx;
  };

  const getHeightAt = (x: number) => {
    const xx = wrapX(x);
    // Find segment indices
    let i = Math.floor((xx / worldWidthLocal) * segments);
    i = Math.max(0, Math.min(segments - 1, i));
    const x0 = i * step;
    const x1 = (i + 1) * step;
    const t = (xx - x0) / (x1 - x0);
    const y = points[i].y * (1 - t) + points[i + 1].y * t;
    return y;
  };

  // Generate volcanoes for this level
  const volcanoes = generateVolcanoes(seed ^ 0xCAFE, worldWidth, level, (x) => {
    const xx = ((x % worldWidth) + worldWidth) % worldWidth;
    let i = Math.floor((xx / worldWidth) * segments);
    i = Math.max(0, Math.min(segments - 1, i));
    const x0 = i * step;
    const x1 = (i + 1) * step;
    const t = (xx - x0) / (x1 - x0);
    return points[i].y * (1 - t) + points[i + 1].y * t;
  }, points, pads);

  // Generate moving pads for this level
  const movingPads: MovingPad[] = [];
  
  // Generate moving pads for every level with increasing speed
  const shouldGenerateMovingPad = true; // Always generate moving pads
  
  if (shouldGenerateMovingPad) {
    let movingPad = movingPadSystem.generateMovingPad(
      seed ^ 0x4D4F5649, // "MOVI" in hex
      level,
      difficulty,
      worldWidth,
      800, // worldHeight estimate for surface
      getHeightAt,
      pads,
      false, // not cavern
      false // no forced generation
    );

    // Reduced fallback attempts to prevent too many retries
    if (!movingPad) {
      for (let i = 1; i <= 2 && !movingPad; i++) {
        movingPad = movingPadSystem.generateMovingPad(
          (seed ^ 0x4D4F5649) + i * 1000, // More varied seeds
          level,
          difficulty,
          worldWidth,
          800,
          getHeightAt,
          pads,
          false,
          false
        );
      }
    }

    // Guarantee one mega moving pad on ALL levels with increasing speed
    if (!movingPad) {
      movingPad = movingPadSystem.generateMovingPad(
        (seed ^ 0x4D4F5649) + 77777,
        level,
        difficulty,
        worldWidth,
        800,
        getHeightAt,
        pads,
        false,
        true // forced generation
      );
    }

    if (movingPad) {
      movingPads.push(movingPad);
      
      // Remove any static pads that overlap with moving pad area (handle world wrap)
      const movingPadBuffer = 150; // Buffer zone around moving pad
      const minMovingX = Math.min(movingPad.pos0.x, movingPad.pos1.x) - movingPadBuffer;
      const maxMovingX = Math.max(movingPad.pos0.x, movingPad.pos1.x) + movingPadBuffer;
      
      for (let i = pads.length - 1; i >= 0; i--) {
        const pad = pads[i];
        let padOverlaps = false;
        
        // Check overlap considering world wrap
        if (minMovingX >= 0 && maxMovingX < worldWidthLocal) {
          // Moving pad doesn't wrap
          if (pad.xStart <= pad.xEnd) {
            // Static pad doesn't wrap
            padOverlaps = !(pad.xEnd < minMovingX || pad.xStart > maxMovingX);
          } else {
            // Static pad wraps
            padOverlaps = (pad.xStart <= maxMovingX || pad.xEnd >= minMovingX);
          }
        } else {
          // Moving pad area might wrap - be conservative and check overlap
          const padCenterX = (pad.xStart + pad.xEnd) / 2;
          const movingCenterX = (movingPad.pos0.x + movingPad.pos1.x) / 2;
          const dist = Math.min(
            Math.abs(padCenterX - movingCenterX),
            worldWidthLocal - Math.abs(padCenterX - movingCenterX)
          );
          padOverlaps = dist < movingPadBuffer * 2;
        }
        
        const heightDiff = Math.abs(pad.y - movingPad.currentPos.y);
        
        if (padOverlaps && heightDiff < 30) {
          console.log("[MovingPad] Removing overlapping static pad", { staticPad: pad, movingPad });
          pads.splice(i, 1);
        }
      }
    }
  }

  const getPadAt = (x: number): Pad | null => {
    const xx = wrapX(x);
    for (const p of pads) {
      if (p.xStart <= p.xEnd) {
        if (xx >= p.xStart && xx <= p.xEnd) return p;
      } else {
        // wrapped pad
        if (xx >= p.xStart || xx <= p.xEnd) return p;
      }
    }
    return null;
  };

  const getMovingPadAt = (x: number, y: number, level?: number): MovingPad | null => {
    // Pass lander center Y; collision fn computes foot offset internally
    for (const mp of movingPads) {
      if (movingPadSystem.isOnMovingPad(x, y, mp, level)) {
        return mp;
      }
    }
    return null;
  };

  // ===== POST-PROCESS TERRAIN FIXES =====
  // Final validation: ensure pads are properly placed and not overlapping
  for (let i = pads.length - 1; i >= 0; i--) {
    const pad = pads[i];
    const padCenterX = (pad.xStart + pad.xEnd) / 2;
    const padIdx = Math.floor((padCenterX / worldWidthLocal) * segments);
    const clampedIdx = Math.max(0, Math.min(segments - 1, padIdx));
    
    // Get original terrain height at pad center (before any modifications)
    const originalTerrainY = originalHeights.get(clampedIdx) || points[clampedIdx].y;
    
    // Verify pad is not buried below original terrain
    if (pad.y > originalTerrainY + 5) {
      console.warn(`[Terrain] Removing buried pad at (${padCenterX.toFixed(1)}, ${pad.y.toFixed(1)}), original terrain=${originalTerrainY.toFixed(1)}`);
      pads.splice(i, 1);
      continue;
    }
    
    // Use original terrain height for proper placement
    pad.y = originalTerrainY;
    
    // Re-flatten terrain around pad using original height
    const padWidth = pad.xEnd - pad.xStart;
    const halfCount = Math.max(2, Math.round((padWidth / step) * 1.5));
    
    for (let j = -halfCount; j <= halfCount; j++) {
      const idx = ((clampedIdx + j) % (segments + 1) + (segments + 1)) % (segments + 1);
      points[idx].y = originalTerrainY;
    }
    
    console.log(`[Terrain] Validated static pad at (${padCenterX.toFixed(1)}, ${originalTerrainY.toFixed(1)}) width=${padWidth.toFixed(1)}`);
  }

  // ===== Generate collectibles =====
  let collectibles: CollectiblesData | undefined;
  
  if (level !== undefined) {
    const context: PlacementContext = {
      worldWidth: worldWidthLocal,
      worldHeight: 800,
      getHeightAt,
      pads,
      movingPads,
      shipHeight: 32,
      mode: "surface",
      startPos: { x: worldWidthLocal / 2, y: 200 },
      goalPos: { 
        x: pads.length > 0 ? (pads[pads.length - 1].xStart + pads[pads.length - 1].xEnd) / 2 : worldWidthLocal - 100, 
        y: pads.length > 0 ? pads[pads.length - 1].y : 400 
      },
      chunkNumber: 0 // Not chunk-based (fixed level)
    };
    
    // Use a terrain-based color for collectibles
    const terrainColor = "hsl(var(--primary))"; // Use primary color from design system
    collectibles = generateCollectibles(seed, context, terrainColor);
    
    // ===== SANITIZE COLLECTIBLES =====
    // Ensure no collectibles are buried under terrain
    if (collectibles) {
      let fixCount = 0;
      for (const junk of collectibles.spaceJunk) {
        const terrainY = getHeightAt(junk.pos.x);
        const minAllowedY = terrainY - 40; // Must be 40px above terrain
        
        if (junk.pos.y >= minAllowedY) {
          const oldY = junk.pos.y;
          junk.pos.y = minAllowedY - 5; // Place safely above terrain
          fixCount++;
          console.log(`[Terrain] Raised buried collectible from y=${oldY.toFixed(1)} to y=${junk.pos.y.toFixed(1)} (terrain=${terrainY.toFixed(1)})`);
        }
      }
      if (fixCount > 0) {
        console.log(`[Terrain] Fixed ${fixCount} buried collectibles`);
      }
    }
  }

  return { 
    worldWidth: worldWidthLocal, 
    points, 
    pads, 
    movingPads, 
    volcanoes, 
    collectibles,
    getHeightAt, 
    getPadAt, 
    getMovingPadAt,
    isCavern: false 
  };
}
