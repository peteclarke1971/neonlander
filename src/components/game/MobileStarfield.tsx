import React, { useRef, useEffect } from "react";

interface MobileStar {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  brightness: number;
}

interface MobileStarfieldProps {
  starCount?: number;
  speed?: number;
}

export const MobileStarfield: React.FC<MobileStarfieldProps> = ({
  starCount = 200,
  speed = 0.4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const starsRef = useRef<MobileStar[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Initialize stars
    const initStars = () => {
      starsRef.current = [];
      for (let i = 0; i < starCount; i++) {
        starsRef.current.push({
          angle: Math.random() * Math.PI * 2,
          distance: Math.random(), // Start distributed across the screen
          speed: 0.15 + Math.random() * 0.35,
          size: 0.5 + Math.random() * 1.5,
          brightness: 0.4 + Math.random() * 0.6,
        });
      }
    };

    // Resize handler
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    initStars();
    window.addEventListener("resize", resize);

    let lastTime = performance.now();

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const centerX = w / 2;
      const centerY = h / 2;
      const maxRadius = Math.max(w, h) * 0.8;

      // Clear with background color
      ctx.fillStyle = "hsl(222, 47%, 5%)"; // --background color
      ctx.fillRect(0, 0, w, h);

      // Draw stars
      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Move outward from center
        star.distance += star.speed * speed * dt;

        // Calculate position
        const x = centerX + Math.cos(star.angle) * star.distance * maxRadius;
        const y = centerY + Math.sin(star.angle) * star.distance * maxRadius;

        // Scale size and alpha based on distance (closer = larger + brighter)
        const scale = 0.5 + star.distance * 2.5;
        const alpha = Math.min(1, star.brightness * (0.2 + star.distance * 0.8));

        // Draw star with slight trail
        const trailLength = star.distance * 8 * speed;
        if (trailLength > 1) {
          const trailX = centerX + Math.cos(star.angle) * (star.distance - 0.02) * maxRadius;
          const trailY = centerY + Math.sin(star.angle) * (star.distance - 0.02) * maxRadius;
          
          ctx.beginPath();
          ctx.moveTo(trailX, trailY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = `rgba(200, 220, 255, ${alpha * 0.5})`;
          ctx.lineWidth = star.size * scale * 0.5;
          ctx.stroke();
        }

        // Draw star point
        ctx.beginPath();
        ctx.arc(x, y, star.size * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 235, 255, ${alpha})`;
        ctx.fill();

        // Respawn at center when off-screen
        if (star.distance > 1.3) {
          star.distance = 0.01;
          star.angle = Math.random() * Math.PI * 2;
          star.speed = 0.15 + Math.random() * 0.35;
          star.brightness = 0.4 + Math.random() * 0.6;
        }
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [starCount, speed]);

  return (
    <canvas
      ref={canvasRef}
      className="mobile-starfield-canvas"
      aria-hidden="true"
    />
  );
};

export default MobileStarfield;
