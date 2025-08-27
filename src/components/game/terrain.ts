import { Pad, TerrainData, MovingPad } from "./types";
import { generateVolcanoes } from "./systems/volcano";
import { movingPadSystem } from "./systems/movingPads";

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
    // Flatten nearby points first to create a pad region (broader than visual width for playability)
    const halfCount = Math.max(1, Math.round((width / step) * 1.2));
    const targetY = points[centerIdx].y - 8; // slightly flattened lower than surrounding
    
    // Ensure perfect flattening for pads
    for (let j = -halfCount; j <= halfCount; j++) {
      const idx = ((centerIdx + j) % (segments + 1) + (segments + 1)) % (segments + 1);
      points[idx].y = targetY;
    }
    
    const y = targetY; // use the exact flattened height

    // Check for overlap with existing pads before adding
    let overlaps = false;
    for (const existingPad of pads) {
      const existingWidth = existingPad.xEnd - existingPad.xStart;
      const overlap = !(xEnd < existingPad.xStart || xStart > existingPad.xEnd);
      if (overlap) {
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
  
  // Generate moving pads for both easy and hard difficulties
  const shouldGenerateMovingPad = true; // Always try to generate moving pads
  
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

    // Guarantee one moving pad on early levels (L1-5) for both difficulties
    if (!movingPad && level <= 5) {
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
      
      // Remove any static pads that overlap with moving pad area
      const movingPadBuffer = 150; // Buffer zone around moving pad
      const minMovingX = Math.min(movingPad.pos0.x, movingPad.pos1.x) - movingPadBuffer;
      const maxMovingX = Math.max(movingPad.pos0.x, movingPad.pos1.x) + movingPadBuffer;
      
      for (let i = pads.length - 1; i >= 0; i--) {
        const pad = pads[i];
        const padOverlaps = !(pad.xEnd < minMovingX || pad.xStart > maxMovingX);
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

  const getMovingPadAt = (x: number, y: number): MovingPad | null => {
    // Pass lander center Y; collision fn computes foot offset internally
    for (const mp of movingPads) {
      if (movingPadSystem.isOnMovingPad(x, y, mp)) {
        return mp;
      }
    }
    return null;
  };

  return { worldWidth: worldWidthLocal, points, pads, movingPads, volcanoes, getHeightAt, getPadAt, getMovingPadAt };
}
