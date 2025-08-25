import React, { useEffect, useRef } from "react";

export const CavernStarfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.floor(c.clientWidth * dpr);
      c.height = Math.floor(c.clientHeight * dpr);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const styles = getComputedStyle(document.documentElement);
    const starColor = `hsl(${styles.getPropertyValue('--foreground')})`;
    const neonColor = `hsl(${styles.getPropertyValue('--neon')})`;

    // Starfield (static twinkles) and shooting stars
    type Star = { x: number; y: number; size: number; baseA: number; tw: number; ph: number; bright: boolean };
    type Shooting = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    type BgSat = { x: number; y: number; vx: number; vy: number; life: number; max: number; scale: number; rot: number; rotV: number };
    const stars: Star[] = [];
    const shooting: Shooting[] = [];
    const bgSats: BgSat[] = [];
    let nextShooting = 0.6 + Math.random() * 1.6;
    let nextBgSat = 5 + Math.random() * 7;

    const dprInit = Math.min(2, window.devicePixelRatio || 1);
    const pxW = c.width / dprInit;
    const pxH = c.height / dprInit;
    
    // Screen-space static stars covering full screen
    const STAR_COUNT = 320;
    for (let i = 0; i < STAR_COUNT; i++) {
      const sx = Math.random() * pxW;
      const sy = Math.random() * pxH;
      const bright = Math.random() < 0.15;
      stars.push({ 
        x: sx, 
        y: sy, 
        size: bright ? 2.4 : 1.4, 
        baseA: bright ? 0.95 : 0.6, 
        tw: 0.5 + Math.random() * 1.5, 
        ph: Math.random() * Math.PI * 2, 
        bright 
      });
    }

    let last = performance.now();

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.width / dpr;
      const h = c.height / dpr;

      ctx.clearRect(0, 0, w, h);

      // Draw starfield
      ctx.fillStyle = starColor;
      for (const s of stars) {
        const twinkle = s.baseA + 0.3 * Math.sin(s.ph + now * 0.001 * s.tw);
        ctx.globalAlpha = Math.max(0.2, Math.min(1, twinkle));
        ctx.shadowColor = s.bright ? neonColor : starColor;
        ctx.shadowBlur = s.bright ? 8 : 4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Shooting stars
      if (now * 0.001 >= nextShooting) {
        nextShooting = now * 0.001 + 2 + Math.random() * 4;
        const angle = Math.random() * Math.PI * 2;
        const speed = 200 + Math.random() * 300;
        const sx = Math.random() * w;
        const sy = Math.random() * h * 0.3; // Upper part of screen
        shooting.push({
          x: sx,
          y: sy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + 50, // Slight downward bias
          life: 0,
          max: 0.8 + Math.random() * 0.4
        });
      }

      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        
        const alpha = 1 - (s.life / s.max);
        if (alpha <= 0 || s.x < -50 || s.x > w + 50 || s.y > h + 50) {
          shooting.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Background satellites
      if (now * 0.001 >= nextBgSat && bgSats.length < 2) {
        nextBgSat = now * 0.001 + 8 + Math.random() * 12;
        const edge = Math.floor(Math.random() * 4);
        const scale = 0.3 + Math.random() * 0.7;
        const speed = 20 + Math.random() * 40;
        let x = 0, y = 0, vx = 0, vy = 0;
        
        if (edge === 0) { x = -50; y = h * (0.2 + Math.random() * 0.6); vx = speed; vy = (Math.random() - 0.5) * speed * 0.3; }
        if (edge === 1) { x = w + 50; y = h * (0.2 + Math.random() * 0.6); vx = -speed; vy = (Math.random() - 0.5) * speed * 0.3; }
        if (edge === 2) { x = w * Math.random(); y = -50; vx = (Math.random() - 0.5) * speed * 0.6; vy = speed; }
        if (edge === 3) { x = w * Math.random(); y = h + 50; vx = (Math.random() - 0.5) * speed * 0.6; vy = -speed; }
        
        bgSats.push({ 
          x, y, vx, vy, 
          life: 0, 
          max: 15 + Math.random() * 20, 
          scale, 
          rot: Math.random() * Math.PI * 2, 
          rotV: (Math.random() - 0.5) * 2 
        });
      }

      for (let i = bgSats.length - 1; i >= 0; i--) {
        const s = bgSats[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.rotV * dt;
        
        if (s.x < -100 || s.x > w + 100 || s.y < -100 || s.y > h + 100 || s.life > s.max) {
          bgSats.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.scale(s.scale, s.scale);
        ctx.strokeStyle = starColor;
        ctx.fillStyle = starColor;
        ctx.shadowColor = starColor;
        ctx.shadowBlur = 4;
        ctx.lineWidth = 1.5;
        
        // Simple satellite shape
        ctx.beginPath();
        ctx.rect(-8, -3, 16, 6); // body
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(-18, -4, 8, 8); // left panel
        ctx.rect(10, -4, 8, 8); // right panel
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -5, 2, 0, Math.PI * 2); // antenna
        ctx.fill();
        
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