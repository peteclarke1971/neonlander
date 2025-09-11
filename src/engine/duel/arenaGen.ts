import { Arena, PowerupPad, VolcanoVent } from "./types";

// Simple deterministic random number generator
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Mix function for deterministic seeding
export function mix(seed: number, ...parts: (string | number)[]): number {
  let h = seed >>> 0;
  for (const part of parts) {
    const str = String(part);
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995) >>> 0;
    }
  }
  return h >>> 0;
}

export function generateArena(seed: number, hazards: boolean): Arena {
  const arenaSeed = mix(seed, "DUEL_ARENA");
  const rng = mulberry32(arenaSeed);
  
  const worldWidth = 1920;
  const worldHeight = 1080;
  
  // Choose layout based on seed
  const layoutIndex = Math.floor(rng() * 3);
  const layouts = ["twin-isles", "keyhole", "bridges"] as const;
  const layout = layouts[layoutIndex];
  
  let terrain: { x: number; y: number }[] = [];
  let spawnPoints: [{ x: number; y: number }, { x: number; y: number }];
  let powerupPads: PowerupPad[] = [];
  let volcanoVents: VolcanoVent[] = [];
  
  switch (layout) {
    case "twin-isles":
      terrain = generateTwinIsles(worldWidth, worldHeight);
      spawnPoints = [
        { x: worldWidth * 0.2, y: worldHeight * 0.3 },
        { x: worldWidth * 0.8, y: worldHeight * 0.3 }
      ];
      powerupPads = [
        createPowerupPad("pad1", worldWidth * 0.5, worldHeight * 0.7),
        createPowerupPad("pad2", worldWidth * 0.3, worldHeight * 0.5),
        createPowerupPad("pad3", worldWidth * 0.7, worldHeight * 0.5)
      ];
      if (hazards) {
        volcanoVents = [
          createVolcanoVent("vent1", worldWidth * 0.4, worldHeight * 0.85, mix(arenaSeed, "VENT1")),
          createVolcanoVent("vent2", worldWidth * 0.6, worldHeight * 0.85, mix(arenaSeed, "VENT2"))
        ];
      }
      break;
      
    case "keyhole":
      terrain = generateKeyhole(worldWidth, worldHeight);
      spawnPoints = [
        { x: worldWidth * 0.15, y: worldHeight * 0.25 },
        { x: worldWidth * 0.85, y: worldHeight * 0.25 }
      ];
      powerupPads = [
        createPowerupPad("pad1", worldWidth * 0.5, worldHeight * 0.6),
        createPowerupPad("pad2", worldWidth * 0.25, worldHeight * 0.4),
        createPowerupPad("pad3", worldWidth * 0.75, worldHeight * 0.4)
      ];
      if (hazards) {
        volcanoVents = [
          createVolcanoVent("vent1", worldWidth * 0.35, worldHeight * 0.8, mix(arenaSeed, "VENT1")),
          createVolcanoVent("vent2", worldWidth * 0.65, worldHeight * 0.8, mix(arenaSeed, "VENT2")),
          createVolcanoVent("vent3", worldWidth * 0.5, worldHeight * 0.9, mix(arenaSeed, "VENT3"))
        ];
      }
      break;
      
    case "bridges":
      terrain = generateBridges(worldWidth, worldHeight);
      spawnPoints = [
        { x: worldWidth * 0.1, y: worldHeight * 0.2 },
        { x: worldWidth * 0.9, y: worldHeight * 0.2 }
      ];
      powerupPads = [
        createPowerupPad("pad1", worldWidth * 0.3, worldHeight * 0.35),
        createPowerupPad("pad2", worldWidth * 0.5, worldHeight * 0.75),
        createPowerupPad("pad3", worldWidth * 0.7, worldHeight * 0.35)
      ];
      if (hazards) {
        volcanoVents = [
          createVolcanoVent("vent1", worldWidth * 0.2, worldHeight * 0.65, mix(arenaSeed, "VENT1")),
          createVolcanoVent("vent2", worldWidth * 0.8, worldHeight * 0.65, mix(arenaSeed, "VENT2"))
        ];
      }
      break;
  }
  
  return {
    layout,
    terrain,
    spawnPoints,
    powerupPads,
    volcanoVents,
    worldWidth,
    worldHeight
  };
}

function generateTwinIsles(width: number, height: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  
  // Left island (20% - 45% width)
  const leftStart = width * 0.2;
  const leftEnd = width * 0.45;
  const leftTop = height * 0.4;
  const leftBottom = height * 0.9;
  
  // Right island (55% - 80% width)  
  const rightStart = width * 0.55;
  const rightEnd = width * 0.8;
  const rightTop = height * 0.4;
  const rightBottom = height * 0.9;
  
  // Left island outline
  points.push(
    { x: leftStart, y: leftBottom },
    { x: leftStart, y: leftTop },
    { x: leftEnd, y: leftTop },
    { x: leftEnd, y: leftBottom }
  );
  
  // Right island outline  
  points.push(
    { x: rightStart, y: rightBottom },
    { x: rightStart, y: rightTop },
    { x: rightEnd, y: rightTop },
    { x: rightEnd, y: rightBottom }
  );
  
  // Floor
  points.push(
    { x: 0, y: height },
    { x: width, y: height }
  );
  
  return points;
}

function generateKeyhole(width: number, height: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  
  // Main chamber walls
  const chamberTop = height * 0.3;
  const chamberBottom = height * 0.9;
  const keyholeStart = width * 0.45;
  const keyholeEnd = width * 0.55;
  const keyholeTop = height * 0.5;
  
  // Left wall
  points.push(
    { x: width * 0.1, y: height },
    { x: width * 0.1, y: chamberTop },
    { x: keyholeStart, y: chamberTop },
    { x: keyholeStart, y: keyholeTop }
  );
  
  // Right wall  
  points.push(
    { x: keyholeEnd, y: keyholeTop },
    { x: keyholeEnd, y: chamberTop },
    { x: width * 0.9, y: chamberTop },
    { x: width * 0.9, y: height }
  );
  
  // Floor
  points.push(
    { x: 0, y: height },
    { x: width, y: height }
  );
  
  return points;
}

function generateBridges(width: number, height: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  
  // Upper ledges
  const upperY = height * 0.3;
  const lowerY = height * 0.6;
  const pillar1X = width * 0.3;
  const pillar2X = width * 0.5;
  const pillar3X = width * 0.7;
  const pillarWidth = 40;
  
  // Left upper ledge
  points.push(
    { x: 0, y: upperY },
    { x: pillar1X - pillarWidth, y: upperY }
  );
  
  // Right upper ledge
  points.push(
    { x: pillar3X + pillarWidth, y: upperY },
    { x: width, y: upperY }
  );
  
  // Lower ledges
  points.push(
    { x: 0, y: lowerY },
    { x: pillar1X - pillarWidth, y: lowerY }
  );
  
  points.push(
    { x: pillar1X + pillarWidth, y: lowerY },
    { x: pillar2X - pillarWidth, y: lowerY }
  );
  
  points.push(
    { x: pillar2X + pillarWidth, y: lowerY },
    { x: pillar3X - pillarWidth, y: lowerY }
  );
  
  points.push(
    { x: pillar3X + pillarWidth, y: lowerY },
    { x: width, y: lowerY }
  );
  
  // Pillars
  for (const pillarX of [pillar1X, pillar2X, pillar3X]) {
    points.push(
      { x: pillarX - pillarWidth/2, y: height },
      { x: pillarX - pillarWidth/2, y: upperY },
      { x: pillarX + pillarWidth/2, y: upperY },
      { x: pillarX + pillarWidth/2, y: height }
    );
  }
  
  // Floor
  points.push(
    { x: 0, y: height },
    { x: width, y: height }
  );
  
  return points;
}

function createPowerupPad(id: string, x: number, y: number): PowerupPad {
  return {
    id,
    x,
    y,
    radius: 30,
    powerupType: null,
    cooldownTime: 0,
    glowing: false
  };
}

function createVolcanoVent(id: string, x: number, y: number, seed: number): VolcanoVent {
  const rng = mulberry32(seed);
  
  return {
    id,
    x,
    y,
    radius: 40,
    cycleTime: rng() * 6, // Random initial phase
    isErupting: false,
    telegraphTime: 0,
    particles: []
  };
}