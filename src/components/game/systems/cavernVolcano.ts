import { Volcano } from "../types";
import { CavernData } from "../cavern";
import { Vec2 } from "./sdf";

export interface CavernVolcanoConfig {
  power: number;
  baseInterval: number;
  eruptionDuration: number;
  particleCount: number;
  size: number;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function getCavernVolcanoConfigForLevel(level: number): CavernVolcanoConfig {
  // Start at level 5, scale difficulty with level
  const baseLevel = Math.max(0, level - 5);
  
  if (baseLevel <= 3) {
    return {
      power: 2.4, // 4x power (300% more)
      baseInterval: 8, // 8 seconds between eruptions
      eruptionDuration: 2,
      particleCount: 15,
      size: 12
    };
  } else if (baseLevel <= 8) {
    return {
      power: 3.2, // 4x power (300% more)
      baseInterval: 6,
      eruptionDuration: 2.5,
      particleCount: 25,
      size: 16
    };
  } else if (baseLevel <= 35) {
    return {
      power: 4.0, // 4x power (300% more)
      baseInterval: 4,
      eruptionDuration: 3,
      particleCount: 35,
      size: 20
    };
  } else {
    // Level 40+ equivalent (level 45+ in caverns)
    return {
      power: 4.8, // 4x power (300% more)
      baseInterval: 3,
      eruptionDuration: 3.5,
      particleCount: 45,
      size: 24
    };
  }
}

export function generateCavernVolcanoes(
  seed: number,
  level: number,
  cavernData: CavernData
): Volcano[] {
  // Only generate volcanoes from level 5 onwards
  if (level < 5) {
    return [];
  }

  const config = getCavernVolcanoConfigForLevel(level);
  const rng = mulberry32(seed ^ 0xC0DE);
  const volcanoes: Volcano[] = [];

  // Find suitable placement points on cavern surfaces
  const candidates = findCavernVolcanoPlacementPoints(cavernData, rng);
  
  if (candidates.length === 0) {
    console.warn("No suitable volcano placement points found in cavern");
    return [];
  }

  // Filter candidates that are too close to landing pads
  const validCandidates = candidates.filter(candidate => {
    const distToStart = Math.sqrt(
      Math.pow(candidate.x - (cavernData.startPad.xStart + cavernData.startPad.xEnd) / 2, 2) +
      Math.pow(candidate.y - cavernData.startPad.y, 2)
    );
    const distToEnd = Math.sqrt(
      Math.pow(candidate.x - (cavernData.endPad.xStart + cavernData.endPad.xEnd) / 2, 2) +
      Math.pow(candidate.y - cavernData.endPad.y, 2)
    );
    return distToStart > 150 && distToEnd > 150;
  });

  if (validCandidates.length === 0) {
    console.warn("No valid volcano placement points found after filtering near pads");
    return [];
  }

  // Select one placement point (only one volcano per level)
  const selectedCandidate = validCandidates[Math.floor(rng() * validCandidates.length)];
  
  const baseInterval = config.baseInterval * (0.8 + rng() * 0.4);
  
  volcanoes.push({
    x: selectedCandidate.x,
    y: selectedCandidate.y,
    size: config.size,
    nextEruption: baseInterval * (0.5 + rng() * 0.5), // stagger initial eruption
    eruptionInterval: baseInterval,
    isErupting: false,
    eruptionTimer: 0,
    eruptionDuration: config.eruptionDuration,
    power: config.power,
    emissionCarry: 0
  });

  return volcanoes;
}

function findCavernVolcanoPlacementPoints(
  cavernData: CavernData,
  rng: () => number
): Array<{ x: number; y: number; surfaceNormal: Vec2 }> {
  const candidates: Array<{ x: number; y: number; surfaceNormal: Vec2 }> = [];
  
  // Sample points along all cavern outline polylines
  for (const polyline of cavernData.outlinePolylines) {
    if (polyline.length < 2) continue;
    
    // Sample every 30 pixels along the polyline
    const sampleDistance = 30;
    
    for (let i = 0; i < polyline.length - 1; i++) {
      const p1 = polyline[i];
      const p2 = polyline[i + 1];
      
      const segmentLength = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
      );
      
      const numSamples = Math.max(1, Math.floor(segmentLength / sampleDistance));
      
      for (let j = 0; j <= numSamples; j++) {
        const t = j / numSamples;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        
        // Calculate surface normal (perpendicular to segment, pointing outward)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          // Normal vector pointing "outward" from the surface
          const nx = -dy / length;
          const ny = dx / length;
          
          // Add some randomness to placement but bias towards certain areas
          if (rng() < 0.3) { // Sample only 30% of points to avoid overcrowding
            candidates.push({
              x: x + (rng() - 0.5) * 10, // Small random offset
              y: y + (rng() - 0.5) * 10,
              surfaceNormal: { x: nx, y: ny }
            });
          }
        }
      }
    }
  }
  
  return candidates;
}

export function getCavernVolcanoSurfaceNormal(
  volcano: Volcano,
  cavernData: CavernData
): Vec2 {
  // Find the closest point on any outline polyline to determine surface normal
  let closestNormal = { x: 0, y: -1 }; // Default upward
  let closestDistance = Infinity;
  
  for (const polyline of cavernData.outlinePolylines) {
    for (let i = 0; i < polyline.length - 1; i++) {
      const p1 = polyline[i];
      const p2 = polyline[i + 1];
      
      // Find closest point on segment to volcano
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length === 0) continue;
      
      const t = Math.max(0, Math.min(1, 
        ((volcano.x - p1.x) * dx + (volcano.y - p1.y) * dy) / (length * length)
      ));
      
      const closestX = p1.x + t * dx;
      const closestY = p1.y + t * dy;
      
      const distance = Math.sqrt(
        Math.pow(volcano.x - closestX, 2) + Math.pow(volcano.y - closestY, 2)
      );
      
      if (distance < closestDistance) {
        closestDistance = distance;
        
        // Calculate normal (perpendicular to segment, pointing outward)
        const nx = -dy / length;
        const ny = dx / length;
        closestNormal = { x: nx, y: ny };
      }
    }
  }
  
  return closestNormal;
}