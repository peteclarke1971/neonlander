import React, { useRef, useEffect } from "react";

// Neon color palette for cycling
const NEON_COLORS = [
  { h: 330, s: 100, l: 65 }, // pink
  { h: 50, s: 100, l: 55 },  // yellow
  { h: 140, s: 100, l: 55 }, // green
  { h: 270, s: 100, l: 70 }, // purple
  { h: 25, s: 100, l: 60 },  // orange
  { h: 0, s: 100, l: 60 },   // red
  { h: 180, s: 100, l: 60 }, // cyan
];

interface MobileStar {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  brightness: number;
  isFast: boolean;        // Occasional fast "shooting star"
  colorOffset: number;    // Individual color offset for variety
}

interface MobileStarfieldProps {
  starCount?: number;
  speed?: number;
}

// Interpolate between two colors
function lerpColor(c1: typeof NEON_COLORS[0], c2: typeof NEON_COLORS[0], t: number) {
  // Handle hue wrapping for smooth transitions
  let h1 = c1.h, h2 = c2.h;
  if (Math.abs(h2 - h1) > 180) {
    if (h2 > h1) h1 += 360;
    else h2 += 360;
  }
  return {
    h: ((h1 + (h2 - h1) * t) % 360 + 360) % 360,
    s: c1.s + (c2.s - c1.s) * t,
    l: c1.l + (c2.l - c1.l) * t,
  };
}

export const MobileStarfield: React.FC<MobileStarfieldProps> = ({
  starCount = 400,
  speed = 0.4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const starsRef = useRef<MobileStar[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    startTimeRef.current = performance.now();

    // Initialize stars
    const initStars = () => {
      starsRef.current = [];
      for (let i = 0; i < starCount; i++) {
        const isFast = Math.random() < 0.05; // 5% are fast stars
        starsRef.current.push({
          angle: Math.random() * Math.PI * 2,
          distance: Math.random(), // Start distributed across the screen
          speed: isFast 
            ? 0.6 + Math.random() * 0.8  // Fast stars: 3-5x speed
            : 0.15 + Math.random() * 0.35,
          size: isFast
            ? 1.2 + Math.random() * 2.5  // Fast stars slightly larger
            : 0.8 + Math.random() * 2,
          brightness: isFast
            ? 0.95 + Math.random() * 0.05  // Fast stars brighter
            : 0.85 + Math.random() * 0.15,
          isFast,
          colorOffset: Math.random() * NEON_COLORS.length, // Random start position in color cycle
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

      // Calculate global color cycle position (slower cycle for subtlety)
      const elapsed = (now - startTimeRef.current) / 1000;
      const cycleSpeed = 0.08; // Full cycle every ~12 seconds
      const globalColorPos = (elapsed * cycleSpeed) % NEON_COLORS.length;

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
        const scale = 0.6 + star.distance * 2.5;
        const alpha = Math.min(1, star.brightness * (0.5 + star.distance * 0.5));

        // Calculate individual star's color position
        const starColorPos = (globalColorPos + star.colorOffset) % NEON_COLORS.length;
        const colorIndex = Math.floor(starColorPos);
        const colorT = starColorPos - colorIndex;
        const color1 = NEON_COLORS[colorIndex];
        const color2 = NEON_COLORS[(colorIndex + 1) % NEON_COLORS.length];
        const color = lerpColor(color1, color2, colorT);

        // Blend with white based on distance (further = more colored, closer = whiter)
        const colorBlend = star.distance * 0.6; // How much color to apply
        const finalL = color.l + (100 - color.l) * (1 - colorBlend); // Approach white
        const finalS = color.s * colorBlend; // Reduce saturation for whiter stars

        // Draw star with slight trail
        const trailLength = star.distance * 8 * speed * (star.isFast ? 2.5 : 1);
        if (trailLength > 1) {
          const trailDist = star.isFast ? 0.05 : 0.02;
          const trailX = centerX + Math.cos(star.angle) * (star.distance - trailDist) * maxRadius;
          const trailY = centerY + Math.sin(star.angle) * (star.distance - trailDist) * maxRadius;
          
          ctx.beginPath();
          ctx.moveTo(trailX, trailY);
          ctx.lineTo(x, y);
          // Trail uses the neon color with reduced alpha
          ctx.strokeStyle = star.isFast
            ? `hsla(${color.h}, ${finalS}%, ${finalL}%, ${alpha * 0.85})`
            : `hsla(${color.h}, ${finalS * 0.5}%, ${finalL}%, ${alpha * 0.7})`;
          ctx.lineWidth = star.size * scale * (star.isFast ? 0.7 : 0.5);
          ctx.stroke();
        }

        // Draw star point
        ctx.beginPath();
        ctx.arc(x, y, star.size * scale, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${color.h}, ${finalS}%, ${finalL}%, ${alpha})`;
        ctx.fill();

        // Respawn at center when off-screen
        if (star.distance > 1.3) {
          const wasFast = star.isFast;
          star.distance = 0.01;
          star.angle = Math.random() * Math.PI * 2;
          star.isFast = Math.random() < 0.05; // 5% chance to become fast
          star.speed = star.isFast 
            ? 0.6 + Math.random() * 0.8 
            : 0.15 + Math.random() * 0.35;
          star.brightness = star.isFast
            ? 0.95 + Math.random() * 0.05
            : 0.4 + Math.random() * 0.6;
          star.size = star.isFast
            ? 1.2 + Math.random() * 2.5
            : 0.8 + Math.random() * 2;
          star.colorOffset = Math.random() * NEON_COLORS.length;
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
