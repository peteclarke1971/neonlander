import React, { useEffect, useRef } from "react";

export const AsteroidStarfield: React.FC = () => {
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

    // Vector asteroids instead of satellites
    type VectorAsteroid = { 
      x: number; 
      y: number; 
      vx: number; 
      vy: number; 
      rot: number; 
      rotV: number; 
      life: number; 
      max: number; 
      scale: number;
      points: { x: number; y: number }[];
    };
    
    const asteroids: VectorAsteroid[] = [];
    let nextAsteroid = 2 + Math.random() * 4;

    // Generate asteroid shape
    const generateAsteroidShape = (scale: number) => {
      const points = [];
      const numPoints = 6 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radius = (8 + Math.random() * 4) * scale;
        points.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius
        });
      }
      return points;
    };

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

      // Vector asteroids (up to 4)
      if (t >= nextAsteroid && asteroids.length < 4) {
        nextAsteroid = t + 3 + Math.random() * 6;
        const edge = Math.floor(Math.random() * 4); // 0:left,1:right,2:top,3:bottom
        const scale = 0.4 + Math.random() * 2.6; // 0.4x .. 3x
        const speedBase = 25; // base px/sec
        const speed = speedBase * (0.5 + Math.random() * 1.5);
        let x = 0, y = 0, vx = 0, vy = 0;
        if (edge === 0) { x = -80; y = h * (0.1 + Math.random() * 0.8); vx = speed; vy = (Math.random() - 0.5) * speed * 0.3; }
        if (edge === 1) { x = w + 80; y = h * (0.1 + Math.random() * 0.8); vx = -speed; vy = (Math.random() - 0.5) * speed * 0.3; }
        if (edge === 2) { x = w * Math.random(); y = -80; vx = (Math.random() - 0.5) * speed * 0.5; vy = speed; }
        if (edge === 3) { x = w * Math.random(); y = h + 80; vx = (Math.random() - 0.5) * speed * 0.5; vy = -speed; }
        
        asteroids.push({ 
          x, y, vx, vy, 
          rot: Math.random() * Math.PI * 2, 
          rotV: (-1 + Math.random() * 2) * (0.5 + Math.random() * 1.5),
          life: 0, 
          max: 40 + Math.random() * 30, 
          scale,
          points: generateAsteroidShape(scale)
        });
      }
      
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const ast = asteroids[i];
        ast.life += 1 / 60;
        ast.x += ast.vx / 60;
        ast.y += ast.vy / 60;
        ast.rot += ast.rotV / 60;
        
        if (ast.x < -120 || ast.x > w + 120 || ast.y < -120 || ast.y > h + 120 || ast.life > ast.max) { 
          asteroids.splice(i, 1); 
          continue; 
        }
        
        ctx.save();
        ctx.translate(ast.x, ast.y);
        ctx.rotate(ast.rot);
        ctx.scale(ast.scale * dpr, ast.scale * dpr);
        
        // Draw solid asteroid (no stars visible through it)
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; // Dark fill to block stars
        ctx.beginPath();
        for (let j = 0; j < ast.points.length; j++) {
          const p = ast.points[j];
          if (j === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw bright neon outline
        ctx.strokeStyle = neon as any;
        ctx.shadowColor = neon as any;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
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