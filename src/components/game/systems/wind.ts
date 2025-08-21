export type WindZone = {
  id: number;
  xStart: number;
  xEnd: number;
  yMin: number;
  yMax: number;
  type: "constant" | "pulse" | "shift";
  dir: 1 | -1; // direction along +x or -x
  base: number; // base lateral accel
  amplitude: number; // for pulsing strength
  speed: number; // pulse frequency
  shiftSpeed: number; // for shifting zones
};

// Simple seeded RNG (mulberry32)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function generateWindZones(seed: number, worldWidth: number, level: number): WindZone[] {
  const rng = mulberry32(seed ^ 0xA11CE);
  const count = Math.min(6, 3 + Math.floor((level + 1) / 3));
  const zones: WindZone[] = [];
  let x = 0;
  for (let i = 0; i < count; i++) {
    const w = worldWidth / count * (0.6 + rng() * 0.8);
    const xStart = (x + rng() * 60) % worldWidth;
    const xEnd = (xStart + w) % worldWidth;
    x += w;
    const typeRand = rng();
    const type: WindZone["type"] = typeRand < 0.5 ? "constant" : typeRand < 0.8 ? "pulse" : "shift";
    const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
    const base = 0.6 + rng() * 0.8; // gentle by default
    const amplitude = type === "constant" ? 0 : 0.6 + rng() * 0.8;
    const speed = 0.5 + rng() * 1.5; // pulse freq
    const shiftSpeed = 10 + rng() * 20; // px/sec for shifting border
    zones.push({ id: i, xStart, xEnd, yMin: -2000, yMax: 2000, type, dir, base, amplitude, speed, shiftSpeed });
  }
  return zones;
}

function inWrappedInterval(x: number, a: number, b: number, worldWidth: number) {
  // returns how far inside the interval [a,b] the x is (0..1 blend for edges)
  const wrap = (v: number) => ((v % worldWidth) + worldWidth) % worldWidth;
  x = wrap(x); a = wrap(a); b = wrap(b);
  if (a <= b) return x >= a && x <= b;
  // wrapped interval
  return x >= a || x <= b;
}

export function windAccelAt(zones: WindZone[], x: number, y: number, t: number, worldWidth?: number): { ax: number; ay: number } {
  let ax = 0;
  for (const z of zones) {
    if (y < z.yMin || y > z.yMax) continue;
    // dynamic edges for shift type
    let xStart = z.xStart;
    let xEnd = z.xEnd;
    if (z.type === "shift") {
      const shift = Math.sin(t * 0.2) * z.shiftSpeed; // oscillate
      xStart += shift; xEnd += shift;
    }
    if (!worldWidth || inWrappedInterval(x, xStart, xEnd, worldWidth)) {
      // soften at edges (within 120px)
      let edgeBlend = 1;
      if (worldWidth) {
        const distToA = Math.min(Math.abs(((x - xStart + worldWidth) % worldWidth)), Math.abs(((xStart - x + worldWidth) % worldWidth)));
        const distToB = Math.min(Math.abs(((x - xEnd + worldWidth) % worldWidth)), Math.abs(((xEnd - x + worldWidth) % worldWidth)));
        const edge = Math.min(distToA, distToB);
        edgeBlend = smoothstep(0, 120, Math.min(120, edge));
      }
      const tPulse = z.type === "pulse" ? (z.base + z.amplitude * Math.sin(t * z.speed + z.id)) : z.base;
      const tShift = z.type === "shift" ? (z.base + 0.5 * Math.sin(t * 0.8 + z.id)) : tPulse;
      ax += z.dir * tShift * edgeBlend;
    }
  }
  return { ax, ay: 0 };
}

export function drawWindVectors(ctx: CanvasRenderingContext2D, zones: WindZone[], worldWidth: number, elapsed: number, neonColor: string) {
  ctx.save();
  ctx.strokeStyle = neonColor as any;
  ctx.globalAlpha = 0.35;
  for (const z of zones) {
    // sample arrows every 80 px across the zone
    const step = 80;
    const lengthBase = 18;
    const yBandTop = -80; // draw slightly above terrain baseline
    const yBandBottom = -280;
    // determine dynamic bounds for shift
    let xStart = z.xStart;
    let xEnd = z.xEnd;
    if (z.type === "shift") {
      const shift = Math.sin(elapsed * 0.2) * z.shiftSpeed;
      xStart += shift; xEnd += shift;
    }
    // normalize for looping
    const span = ((xEnd - xStart + worldWidth) % worldWidth) || worldWidth;
    for (let i = 0; i <= span; i += step) {
      const sx = ((xStart + i) % worldWidth + worldWidth) % worldWidth;
      const tPulse = z.type === "pulse" ? (z.base + z.amplitude * Math.sin(elapsed * z.speed + z.id)) : z.base;
      const tShift = z.type === "shift" ? (z.base + 0.5 * Math.sin(elapsed * 0.8 + z.id)) : tPulse;
      const len = lengthBase + tShift * 6;
      const dir = z.dir;
      // scatter a few rows
      for (let row = 0; row < 2; row++) {
        const sy = yBandTop - row * 80;
        ctx.beginPath();
        const x1 = sx - (dir < 0 ? len : 0);
        const x2 = x1 + dir * len;
        ctx.moveTo(x1, sy);
        ctx.lineTo(x2, sy);
        // arrow head
        ctx.lineTo(x2 - dir * 6, sy - 3);
        ctx.moveTo(x2, sy);
        ctx.lineTo(x2 - dir * 6, sy + 3);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
