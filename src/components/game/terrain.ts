import { Pad, TerrainData } from "./types";
import { generateVolcanoes } from "./systems/volcano";

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTerrain(seed: number, worldWidth: number, base: number, amplitude: number, complexity = 0, level = 1): TerrainData {
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
    const y = points[centerIdx].y - 8; // slightly flattened lower than surrounding

    // Flatten nearby points to create a pad region (broader than visual width for playability)
    const halfCount = Math.max(1, Math.round((width / step) * 1.2));
    for (let j = -halfCount; j <= halfCount; j++) {
      const idx = ((centerIdx + j) % (segments + 1) + (segments + 1)) % (segments + 1);
      points[idx].y = y;
    }

    pads.push({ xStart, xEnd, y, multiplier, width, bonus2x: false });
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

  return { worldWidth: worldWidthLocal, points, pads, volcanoes, getHeightAt, getPadAt };
}
