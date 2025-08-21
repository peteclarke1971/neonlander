export type Anomaly = {
  x: number;
  y: number;
  radius: number; // visual influence radius
  strength: number; // acceleration magnitude scaling
  falloff: number; // power falloff
  kind: "attract" | "repel";
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

export function generateAnomalies(seed: number, worldWidth: number, baseHeight: number): Anomaly[] {
  const rng = mulberry32(seed ^ 0xBEEF);
  const count = 2 + Math.floor(rng() * 3);
  const arr: Anomaly[] = [];
  for (let i = 0; i < count; i++) {
    const x = rng() * worldWidth;
    const y = baseHeight - (200 + rng() * 250); // in the sky above ground baseline
    const radius = 140 + rng() * 160;
    const strength = 10 + rng() * 14; // gentle but noticeable
    const falloff = 1.6 + rng() * 0.8;
    const kind: Anomaly["kind"] = rng() < 0.5 ? "attract" : "repel";
    arr.push({ x, y, radius, strength, falloff, kind });
  }
  return arr;
}

export function anomalyAccelAt(anoms: Anomaly[], x: number, y: number, _t: number): { ax: number; ay: number } {
  let ax = 0, ay = 0;
  for (const a of anoms) {
    const dx = a.x - x;
    const dy = a.y - y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq) + 0.0001;
    // influence fades outside ~2*radius
    const influence = Math.max(0, 1 - Math.pow(dist / (a.radius * 2), a.falloff));
    if (influence <= 0) continue;
    const dir = a.kind === "attract" ? 1 : -1;
    const mag = (a.strength * influence) / Math.pow(dist, 0.25); // mild nonlinear falloff
    ax += dir * (dx / dist) * mag;
    ay += dir * (dy / dist) * mag;
  }
  return { ax, ay };
}

export function drawAnomaliesField(ctx: CanvasRenderingContext2D, anoms: Anomaly[], _elapsed: number, neonColor: string) {
  const elapsed = _elapsed;
  ctx.save();
  ctx.strokeStyle = neonColor as any;

  // Animated radial wave indicating push (repel) vs pull (attract)
  // Repel: bright band moves outward. Attract: bright band moves inward.
  const RINGS = 6; // more rings for smoother motion
  const SPEED = 0.35; // cycles per second
  for (const a of anoms) {
    const t = (elapsed * SPEED) % 1;
    const target = a.kind === "repel" ? t : 1 - t; // 0..1 position of bright band

    for (let i = 1; i <= RINGS; i++) {
      const r = (a.radius * i) / RINGS;
      const norm = i / RINGS; // 0..1
      const dist = Math.abs(norm - target);
      // Narrow gaussian-ish pulse centered at `target`
      const pulse = Math.exp(-Math.pow(dist * 6, 2)); // width factor
      const alpha = 0.08 + 0.38 * pulse; // base + peak

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Polarity indicator: "+" for attract, "-" for repel
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(a.x - 6, a.y);
    ctx.lineTo(a.x + 6, a.y);
    if (a.kind === "attract") {
      ctx.moveTo(a.x, a.y - 6);
      ctx.lineTo(a.x, a.y + 6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
