import { Pad, TerrainData, MovingPad, CollectiblesData, SequencedPad, Mode, CoralFormation } from "./types";
import { generateVolcanoes } from "./systems/volcano";
import { movingPadSystem } from "./systems/movingPads";
import { generateCollectibles, PlacementContext } from "./systems/collectibles";
import { TimeTrialLevelConfig } from "./systems/timeTrialLevels";

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate coral formations for Level 5 (underwater)
export function generateCoral(
  seed: number,
  worldWidth: number,
  getHeightAt: (x: number) => number,
  pads: Pad[]
): CoralFormation[] {
  const rand = mulberry32(seed ^ 0xC04A1); // "CORAL" in hex
  const coral: CoralFormation[] = [];
  
  // Coral colors: bright neon underwater palette
  const colors = [
    '#00ffff', // cyan
    '#ff00ff', // magenta
    '#00ff88', // lime-cyan
    '#ff0088', // hot pink
    '#ffaa00', // orange-yellow
  ];
  
  const types: CoralFormation['type'][] = ['branch', 'frond', 'fan', 'tube', 'anemone'];
  
  // Generate ~20 coral clusters across the world
  const clusterCount = 18 + Math.floor(rand() * 6); // 18-23 clusters
  
  for (let i = 0; i < clusterCount; i++) {
    const x = rand() * worldWidth;
    const terrainY = getHeightAt(x);
    
    // Check if too close to any landing pad (150px clearance)
    let tooClose = false;
    for (const pad of pads) {
      const padCenterX = (pad.xStart + pad.xEnd) / 2;
      const dx = Math.abs(x - padCenterX);
      const wrappedDx = Math.min(dx, worldWidth - dx);
      
      if (wrappedDx < 150 && Math.abs(terrainY - pad.y) < 80) {
        tooClose = true;
        break;
      }
    }
    
    if (tooClose) continue;
    
    // Create coral formation
    coral.push({
      x,
      y: terrainY,
      type: types[Math.floor(rand() * types.length)],
      height: 30 + rand() * 90, // 30-120px
      width: 20 + rand() * 60,  // 20-80px
      color: colors[Math.floor(rand() * colors.length)],
      seed: seed ^ (i * 0x1234),
      segments: 3 + Math.floor(rand() * 5), // 3-7 segments/branches
      swayPhase: rand() * Math.PI * 2, // Random animation phase
    });
  }
  
  return coral;
}

export function generateTerrain(
  seed: number, 
  worldWidth: number, 
  base: number, 
  amplitude: number, 
  complexity = 0, 
  level = 1, 
  difficulty: "easy" | "hard" = "easy", 
  isTimeTrial = false, 
  timeTrialPadCount?: number,
  mode?: Mode,
  timeTrialLevelConfig?: TimeTrialLevelConfig,
  validationMode = false
): TerrainData | null {
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
  // In Time Trial mode, use specified pad count for sequenced pads
  const padCount = isTimeTrial && timeTrialPadCount ? timeTrialPadCount : 4;
  const pads: Pad[] = [];
  const sequencedPads: SequencedPad[] = [];
  
  if (isTimeTrial && timeTrialPadCount) {
    // Generate sequenced pads for Time Trial mode
    // Space them evenly across the world and make them all medium-sized for fairness
    const spacing = worldWidth / (timeTrialPadCount + 1);
    
    for (let i = 0; i < timeTrialPadCount; i++) {
      const sequenceNumber = i + 1;
      const xCenter = spacing * (i + 1);
      const centerIdx = Math.floor((xCenter / worldWidth) * segments);
      
      // Make all sequenced pads medium-sized (fair and visible)
      const width = step * (1.0 + rand() * 0.4); // ~50-70px
      const multiplier = 3; // Standard medium pad multiplier
      
      const xStart = (xCenter - width / 2 + worldWidth) % worldWidth;
      const xEnd = (xCenter + width / 2 + worldWidth) % worldWidth;
      const targetY = originalHeights.get(centerIdx) || points[centerIdx].y;
      
      // Flatten terrain around the pad
      const halfCount = Math.max(1, Math.round((width / step) * 1.2));
      for (let j = -halfCount; j <= halfCount; j++) {
        const idx = ((centerIdx + j) % (segments + 1) + (segments + 1)) % (segments + 1);
        points[idx].y = targetY;
      }
      
      sequencedPads.push({
        xStart,
        xEnd,
        y: targetY,
        multiplier,
        width,
        bonus2x: false,
        sequenceNumber,
        completed: false
      });
      
      // Also add to regular pads array for terrain compatibility
      pads.push({
        xStart,
        xEnd,
        y: targetY,
        multiplier,
        width,
        bonus2x: false
      });
    }
    
    // ===== HAZARD PROXIMITY VALIDATION =====
    // Check sequenced pads are not too close to hazards (200px minimum)
    const MIN_HAZARD_DISTANCE = 200;
    
    for (let i = sequencedPads.length - 1; i >= 0; i--) {
      const pad = sequencedPads[i];
      const padCenterX = (pad.xStart + pad.xEnd) / 2;
      let tooCloseToHazard = false;
      
      // Check gravity wells (if collectibles generated)
      // Note: collectibles are generated after terrain, so we can't check them here yet
      // This will be handled in post-processing after collectibles are generated
      
      if (tooCloseToHazard) {
        console.warn(`[TimeTrial] Pad ${pad.sequenceNumber} too close to hazard, will validate after collectibles`);
      }
    }
    
    // ===== SEQUENCE COMPLETENESS VALIDATION =====
    // Verify all numbered pads are present and continuous
    const expectedCount = timeTrialPadCount;
    const actualCount = sequencedPads.length;
    
    if (actualCount !== expectedCount) {
      console.error(`[TimeTrial] ❌ CRITICAL: Missing pads! Generated ${actualCount}/${expectedCount} pads`);
      console.error(`[TimeTrial] ❌ Level cannot start with missing pads. This is a critical generation error.`);
      
      // In validation mode, return null instead of throwing
      if (validationMode) {
        return null;
      }
      
      // Throw error to prevent level from starting with missing pads
      throw new Error(`Time Trial level generation failed: Expected ${expectedCount} pads but only generated ${actualCount}. This level is unplayable.`);
    }
    
    // Check sequence continuity (1, 2, 3, ..., N)
    const sequences = sequencedPads.map(p => p.sequenceNumber).sort((a, b) => a - b);
    let continuous = true;
    for (let i = 0; i < sequences.length; i++) {
      if (sequences[i] !== i + 1) {
        continuous = false;
        console.error(`[TimeTrial] ❌ CRITICAL: Sequence gap detected! Expected ${i + 1}, got ${sequences[i]}`);
      }
    }
    
    if (!continuous) {
      console.error(`[TimeTrial] ❌ Level cannot start with non-continuous pad sequence. This is a critical generation error.`);
      
      // In validation mode, return null instead of throwing
      if (validationMode) {
        return null;
      }
      
      throw new Error(`Time Trial level generation failed: Pad sequence is not continuous. This level is unplayable.`);
    }
    
    console.log(`[TimeTrial] ✅ All ${actualCount} pads generated successfully (sequence 1-${actualCount})`);
  } else {
    // Regular pad generation for non-Time Trial modes
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
      width = 28 + rand() * 8; // 28-36
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
  } // End regular pad generation

  // Mark smallest pad as 2x bonus pad (most difficult) - NOT in Time Trial mode
  if (!isTimeTrial && pads.length > 0) {
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
  // In Time Trial mode, limit to 1 volcano maximum
  const volcanoes = generateVolcanoes(seed ^ 0xCAFE, worldWidth, level, (x) => {
    const xx = ((x % worldWidth) + worldWidth) % worldWidth;
    let i = Math.floor((xx / worldWidth) * segments);
    i = Math.max(0, Math.min(segments - 1, i));
    const x0 = i * step;
    const x1 = (i + 1) * step;
    const t = (xx - x0) / (x1 - x0);
    return points[i].y * (1 - t) + points[i + 1].y * t;
  }, points, pads, isTimeTrial);

  // Generate moving pads for this level
  const movingPads: MovingPad[] = [];
  
  // Never generate moving pads (mega pads) in Time Trial mode
  const allowMovingPads = !isTimeTrial;
  
  if (allowMovingPads) {
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
        
        // PROTECT SEQUENCED PADS: Never remove numbered pads in Time Trial mode
        if (isTimeTrial && sequencedPads.some(sp => 
          sp.xStart === pad.xStart && 
          sp.xEnd === pad.xEnd && 
          sp.y === pad.y
        )) {
          console.log("[MovingPad] Protected sequenced pad from removal", { pad });
          continue;
        }
        
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
    
    // PROTECT SEQUENCED PADS: Never remove numbered pads in Time Trial mode
    const isSequencedPad = isTimeTrial && sequencedPads.some(sp => 
      sp.xStart === pad.xStart && 
      sp.xEnd === pad.xEnd && 
      sp.y === pad.y
    );
    
    const padCenterX = (pad.xStart + pad.xEnd) / 2;
    const padIdx = Math.floor((padCenterX / worldWidthLocal) * segments);
    const clampedIdx = Math.max(0, Math.min(segments - 1, padIdx));
    
    // Get original terrain height at pad center (before any modifications)
    const originalTerrainY = originalHeights.get(clampedIdx) || points[clampedIdx].y;
    
    if (isSequencedPad) {
      // For sequenced pads: FORCE-ADJUST terrain to accommodate the pad instead of removing it
      console.log(`[TimeTrial] Protected sequenced pad from post-processing removal at (${padCenterX.toFixed(1)}, ${pad.y.toFixed(1)})`);
      
      // Force terrain to be flat at pad location
      const padWidth = pad.xEnd - pad.xStart;
      const halfCount = Math.max(2, Math.round((padWidth / step) * 1.5));
      
      for (let j = -halfCount; j <= halfCount; j++) {
        const idx = ((clampedIdx + j) % (segments + 1) + (segments + 1)) % (segments + 1);
        points[idx].y = pad.y; // Force terrain to match pad height
      }
      
      continue; // Skip normal validation logic for sequenced pads
    }
    
    // Normal pad validation for non-sequenced pads
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
      chunkNumber: 0, // Not chunk-based (fixed level)
      level: level, // Pass level for difficulty-based placement
      volcanoes: volcanoes // Pass volcanoes for tricky placement
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
      
      // ===== TIME TRIAL: VALIDATE HAZARD PROXIMITY TO SEQUENCED PADS =====
      if (isTimeTrial && sequencedPads.length > 0) {
        const MIN_HAZARD_DISTANCE = 200;
        let hazardWarnings = 0;
        
        // Check volcanoes proximity to numbered pads
        for (const pad of sequencedPads) {
          const padCenterX = (pad.xStart + pad.xEnd) / 2;
          
          for (const volcano of volcanoes) {
            const dx = Math.abs(padCenterX - volcano.x);
            const wrappedDx = Math.min(dx, worldWidthLocal - dx);
            const dy = Math.abs(pad.y - volcano.y);
            const distance = Math.sqrt(wrappedDx * wrappedDx + dy * dy);
            
            if (distance < MIN_HAZARD_DISTANCE) {
              console.warn(`[TimeTrial] ⚠️ Pad ${pad.sequenceNumber} only ${distance.toFixed(0)}px from volcano (min: ${MIN_HAZARD_DISTANCE}px)`);
              hazardWarnings++;
            }
          }
        }
        
        if (hazardWarnings === 0) {
          console.log(`[TimeTrial] ✅ All ${sequencedPads.length} pads have safe volcano clearance (${MIN_HAZARD_DISTANCE}px+)`);
        } else {
          console.warn(`[TimeTrial] ⚠️ ${hazardWarnings} volcano proximity warnings detected`);
        }
      }
    }
  }

  // ===== FINAL VALIDATION: SEQUENCED PADS =====
  if (isTimeTrial && sequencedPads.length > 0) {
    // Verify all sequenced pads still exist in pads array after post-processing
    for (const seqPad of sequencedPads) {
      const exists = pads.some(p => 
        p.xStart === seqPad.xStart && 
        p.xEnd === seqPad.xEnd && 
        p.y === seqPad.y
      );
      
      if (!exists) {
        console.error(`[TimeTrial] ❌ CRITICAL: Sequenced pad ${seqPad.sequenceNumber} was removed during post-processing!`);
        if (validationMode) {
          return null;
        }
        throw new Error(`Time Trial level generation failed: Sequenced pad ${seqPad.sequenceNumber} was removed. This level is unplayable.`);
      }
    }
    
    console.log(`[TimeTrial] ✅ Final validation: All ${sequencedPads.length} sequenced pads present after post-processing`);
  }

  // Generate coral for level 5 (underwater)
  const coral = (mode === "classic" && level === 5) 
    ? generateCoral(seed, worldWidthLocal, getHeightAt, pads)
    : undefined;

  return { 
    worldWidth: worldWidthLocal, 
    points, 
    pads, 
    movingPads, 
    volcanoes, 
    collectibles,
    coral,
    getHeightAt, 
    getPadAt, 
    getMovingPadAt,
    isCavern: false,
    sequencedPads: isTimeTrial ? sequencedPads : undefined
  };
}
