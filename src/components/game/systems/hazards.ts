export type Hazard = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  av: number;
  kind: "debris" | "rock" | "sat";
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateHazards(seed: number, worldWidth: number, baseHeight: number): Hazard[] {
  const rng = mulberry32(seed ^ 0xCAFE);
  const count = 4 + Math.floor(rng() * 4);
  const arr: Hazard[] = [];
  for (let i = 0; i < count; i++) {
    const x = rng() * worldWidth;
    const y = baseHeight - (120 + rng() * 320);
    const vx = (rng() < 0.5 ? -1 : 1) * (40 + rng() * 60);
    const vy = (rng() - 0.5) * 20;
    const r = 10 + rng() * 12;
    const angle = rng() * Math.PI * 2;
    const av = (rng() - 0.5) * 1.5;
    const kind: Hazard["kind"] = rng() < 0.33 ? "debris" : rng() < 0.66 ? "rock" : "sat";
    arr.push({ x, y, vx, vy, r, angle, av, kind });
  }
  return arr;
}

export function updateHazards(hazards: Hazard[], dt: number, worldWidth: number, baseHeight: number, skipPhysics = false) {
  if (skipPhysics) return; // Allow skipping physics for off-screen hazards
  
  const yMin = baseHeight - 440; // keep within sky band
  const yMax = baseHeight - 100;
  for (const h of hazards) {
    // wrap horizontally
    h.x = ((h.x + h.vx * dt) % worldWidth + worldWidth) % worldWidth;
    // vertical motion with soft bounds (bounce)
    h.y += h.vy * dt;
    if (h.y < yMin) { h.y = yMin; h.vy = Math.abs(h.vy); }
    if (h.y > yMax) { h.y = yMax; h.vy = -Math.abs(h.vy); }
    // rotation
    h.angle += h.av * dt;
  }
}

export function drawHazards(
  ctx: CanvasRenderingContext2D, 
  hazards: Hazard[], 
  neonColor: string, 
  shadowBlur = 0,
  cameraX = 0,
  viewWidth = 800,
  worldWidth = 4000
) {
  if (hazards.length === 0) return;
  
  const margin = 100;
  ctx.save();
  ctx.strokeStyle = neonColor as any;
  ctx.globalAlpha = 0.9;
  
  if (shadowBlur > 0) {
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = shadowBlur;
  }
  
  for (const h of hazards) {
    // Try each wrap offset to find the visible position
    for (const offset of [-worldWidth, 0, worldWidth]) {
      const screenX = h.x + offset - cameraX;
      const halfView = viewWidth / 2;
      if (screenX > -halfView - margin && screenX < halfView + margin) {
        ctx.save();
        ctx.translate(h.x + offset, h.y); // World coords
        ctx.rotate(h.angle);
        ctx.beginPath();
        if (h.kind === "debris") {
          ctx.moveTo(-h.r, -h.r * 0.6);
          ctx.lineTo(h.r * 0.9, -h.r * 0.3);
          ctx.lineTo(-h.r * 0.3, h.r);
          ctx.closePath();
        } else if (h.kind === "rock") {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const rr = h.r * (0.7 + (i % 2 ? 0.4 : 0.2));
            const px = Math.cos(a) * rr;
            const py = Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        } else {
          ctx.arc(0, 0, h.r * 0.8, 0, Math.PI * 2);
          ctx.moveTo(-h.r * 1.6, 0); ctx.lineTo(h.r * 1.6, 0);
          ctx.moveTo(0, -h.r * 1.2); ctx.lineTo(0, h.r * 1.2);
        }
        ctx.stroke();
        ctx.restore();
        break; // Only draw once per hazard
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function checkHazardCollision(hazards: Hazard[], x: number, y: number, landerR: number): { collided: boolean; hazard: Hazard | null } {
  for (const h of hazards) {
    const dx = ((x - h.x));
    const dy = (y - h.y);
    if (dx * dx + dy * dy <= (h.r + landerR) * (h.r + landerR)) {
      return { collided: true, hazard: h };
    }
  }
  return { collided: false, hazard: null };
}
