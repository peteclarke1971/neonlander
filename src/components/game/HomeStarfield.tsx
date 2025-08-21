import React, { useEffect, useRef } from "react";

export const HomeStarfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.floor(c.clientWidth * dpr);
      c.height = Math.floor(c.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const styles = getComputedStyle(document.documentElement);
    const starColor = `hsl(${styles.getPropertyValue('--foreground')})`;
    const neon = `hsl(${styles.getPropertyValue('--neon')})`;

    type Star = { x: number; y: number; r: number; s: number; tw: number; ph: number; layer: number };
    const stars: Star[] = [];
    const spawnStars = (count: number, layer: number) => {
      const base = layer === 0 ? 20 : layer === 1 ? 40 : 70; // px/sec per layer
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: (layer + 1) * 0.5 + Math.random() * 0.8,
          s: base * (0.6 + Math.random() * 0.8), // absolute px/sec
          tw: 0.5 + Math.random() * 1.5,
          ph: Math.random() * Math.PI * 2,
          layer,
        });
      }
    };
    spawnStars(150, 0); // far
    spawnStars(120, 1); // mid
    spawnStars(80, 2); // near

// Shooting stars, comets, and drifting satellites (up to 3)
type Streak = { x: number; y: number; vx: number; vy: number; life: number; max: number };
type Comet = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };
type Satellite = { x: number; y: number; vx: number; vy: number; rot: number; rotV: number; life: number; max: number; scale: number; kind: "sat" | "iss" };
const streaks: Streak[] = [];
const comets: Comet[] = [];
const sats: Satellite[] = [];
let nextStreak = 2 + Math.random() * 6;
let nextComet = 8 + Math.random() * 12;
let nextSat = 6 + Math.random() * 10;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);

      // background gradient subtle
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // stars - layered parallax, seamless left->right
      ctx.fillStyle = starColor as any;
      ctx.shadowColor = starColor as any;
      ctx.shadowBlur = 8;
      const t = performance.now() / 1000;
      for (const s of stars) {
        const twinkle = 0.7 + 0.3 * Math.sin(s.ph + t * s.tw);
        const px = (s.x * w + (t * s.s) % w + w) % w; // left->right seamless
        const py = s.y * h;
        ctx.globalAlpha = Math.max(0.4, Math.min(1, twinkle));
        ctx.beginPath();
        ctx.arc(px, py, s.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

// Shooting stars (occasional, left -> right)
if (t >= nextStreak) {
  nextStreak = t + 6 + Math.random() * 8;
  const sy = Math.random() * h * 0.5;
  streaks.push({ x: -40, y: sy, vx: 300 + Math.random() * 220, vy: 30 + Math.random() * 40, life: 0, max: 0.9 });
}
for (let i = streaks.length - 1; i >= 0; i--) {
  const s = streaks[i];
  s.life += 1 / 60;
  s.x += s.vx / 60;
  s.y += s.vy / 60;
  const a = 1 - s.life / s.max;
  if (a <= 0 || s.x > w + 100 || s.y > h + 100) { streaks.splice(i, 1); continue; }
  ctx.globalAlpha = a;
  ctx.strokeStyle = neon as any;
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x - s.vx * 0.08, s.y - s.vy * 0.08);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Comets (brighter nucleus with tail)
if (t >= nextComet) {
  nextComet = t + 10 + Math.random() * 14;
  comets.push({
    x: -80,
    y: Math.random() * h * 0.6,
    vx: 140 + Math.random() * 120,
    vy: 10 + Math.random() * 20,
    life: 0,
    max: 5 + Math.random() * 3,
    size: 3 + Math.random() * 2
  });
}
for (let i = comets.length - 1; i >= 0; i--) {
  const cmt = comets[i];
  cmt.life += 1 / 60;
  cmt.x += cmt.vx / 60;
  cmt.y += cmt.vy / 60;
  if (cmt.x > w + 120 || cmt.y > h + 80 || cmt.life > cmt.max) { comets.splice(i, 1); continue; }
  const tailLen = 0.12;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = neon as any;
  ctx.shadowColor = neon as any;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cmt.x, cmt.y, cmt.size * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(cmt.x, cmt.y);
  ctx.lineTo(cmt.x - cmt.vx * tailLen, cmt.y - cmt.vy * tailLen);
  ctx.strokeStyle = neon as any;
  ctx.stroke();
  ctx.restore();
}

// Satellites (up to 3), random direction/speed/angle/size; bigger = faster
if (t >= nextSat && sats.length < 3) {
  nextSat = t + 8 + Math.random() * 12; // 50% frequency (double interval)
  const edge = Math.floor(Math.random() * 4); // 0:left,1:right,2:top,3:bottom
  const scale = 0.25 + Math.random() * 7.25; // 0.25x .. 7.5x
  const speedBase = 18; // base px/sec
  const speed = speedBase * scale * (1 + Math.random() * 1.8);
  const kind: Satellite["kind"] = Math.random() < 0.5 ? "sat" : "iss";
  let x = 0, y = 0, vx = 0, vy = 0;
  if (edge === 0) { x = -120; y = h * (0.15 + Math.random() * 0.7); vx = speed; vy = (Math.random() - 0.5) * speed * 0.2; }
  if (edge === 1) { x = w + 120; y = h * (0.15 + Math.random() * 0.7); vx = -speed; vy = (Math.random() - 0.5) * speed * 0.2; }
  if (edge === 2) { x = w * Math.random(); y = -120; vx = (Math.random() - 0.5) * speed * 0.6; vy = speed; }
  if (edge === 3) { x = w * Math.random(); y = h + 120; vx = (Math.random() - 0.5) * speed * 0.6; vy = -speed; }
  sats.push({ x, y, vx, vy, rot: Math.random() * Math.PI * 2, rotV: (-0.6 + Math.random() * 1.2) * (scale > 1 ? 1.4 : 0.7), life: 0, max: 50 + Math.random() * 40, scale, kind });
}
for (let i = sats.length - 1; i >= 0; i--) {
  const s = sats[i];
  s.life += 1 / 60;
  s.x += s.vx / 60;
  s.y += s.vy / 60;
  s.rot += s.rotV / 60;
  if (s.x < -200 || s.x > w + 200 || s.y < -200 || s.y > h + 200 || s.life > s.max) { sats.splice(i, 1); continue; }
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);
  ctx.scale(s.scale * dpr, s.scale * dpr);
  ctx.strokeStyle = starColor as any;
  ctx.fillStyle = starColor as any;
  ctx.shadowColor = starColor as any;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.5;
  if (s.kind === "iss") {
    // Rough ISS silhouette: central truss, modules, large panels
    ctx.beginPath();
    ctx.rect(-10, -2, 20, 4); // truss
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-28, -6, 14, 12); // left panel
    ctx.rect(14, -6, 14, 12); // right panel
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-6, -8, 12, 4); // module
    ctx.rect(-6, 4, 12, 4); // module
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2); // node
    ctx.fill();
  } else {
    // Simple satellite with panels and dish
    ctx.beginPath();
    ctx.rect(-8, -3, 16, 6); // body
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-22, -4, 10, 8); // left panel
    ctx.rect(12, -4, 10, 8); // right panel
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -6, 3, 0, Math.PI * 2); // dish
    ctx.fill();
  }
  ctx.restore();
}
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" aria-hidden />;
};
