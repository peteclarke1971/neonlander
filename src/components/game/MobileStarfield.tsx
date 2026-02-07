import React, { useRef, useEffect } from "react";
import { loadStarfieldConfig, NEON_COLORS, lerpColor } from "@/lib/starfieldConfig";

interface MobileStar {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  brightness: number;
  isFast: boolean;
  colorOffset: number;
}

interface MobileStarfieldProps {
  starCount?: number;
  speed?: number;
}

export const MobileStarfield: React.FC<MobileStarfieldProps> = ({
  starCount = 400,
  speed = 0.4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const starsRef = useRef<MobileStar[]>([]);
  const startTimeRef = useRef<number>(0);
  const configRef = useRef(loadStarfieldConfig());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    startTimeRef.current = performance.now();
    
    // Load config and apply density/speed multipliers
    configRef.current = loadStarfieldConfig();
    
    // Periodic config refresh for same-tab changes
    const configRefreshInterval = setInterval(() => {
      configRef.current = loadStarfieldConfig();
    }, 500);
    
    // Listen for storage events (cross-tab changes)
    const handleStorageChange = () => {
      configRef.current = loadStarfieldConfig();
    };
    window.addEventListener('storage', handleStorageChange);

    // Initialize stars
    const initStars = () => {
      starsRef.current = [];
      const config = configRef.current;
      const effectiveStarCount = Math.floor(starCount * config.density);
      for (let i = 0; i < effectiveStarCount; i++) {
        const isFast = Math.random() < 0.05;
        starsRef.current.push({
          angle: Math.random() * Math.PI * 2,
          distance: Math.random(),
          speed: isFast ? 0.6 + Math.random() * 0.8 : 0.15 + Math.random() * 0.35,
          size: isFast ? 1.2 + Math.random() * 2.5 : 0.8 + Math.random() * 2,
          brightness: isFast ? 0.95 + Math.random() * 0.05 : 0.85 + Math.random() * 0.15,
          isFast,
          colorOffset: Math.random() * NEON_COLORS.length,
        });
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
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

      const parent = canvas.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      const centerX = w / 2;
      const centerY = h / 2;
      const maxRadius = Math.max(w, h) * 0.8;

      const config = configRef.current;
      const effectiveSpeed = speed * config.speed;
      
      // Calculate global color cycle position
      const elapsed = (now - startTimeRef.current) / 1000;
      const baseCycleSpeed = 0.08;
      const colorCycleSpeed = config.colorCycle ? (baseCycleSpeed * config.colorSpeed) : 0;
      const globalColorPos = config.colorCycle 
        ? (elapsed * colorCycleSpeed) % NEON_COLORS.length 
        : 0;
      
      // Apply base hue shift from config
      const hueShift = config.neonHue - 280;

      // Clear with background color
      ctx.fillStyle = "hsl(222, 47%, 5%)";
      ctx.fillRect(0, 0, w, h);

      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Move outward from center
        star.distance += star.speed * effectiveSpeed * dt;

        const x = centerX + Math.cos(star.angle) * star.distance * maxRadius;
        const y = centerY + Math.sin(star.angle) * star.distance * maxRadius;

        const scale = 0.6 + star.distance * 2.5;
        const alpha = Math.min(1, star.brightness * (0.5 + star.distance * 0.5));

        // Calculate color - use single color if enabled
        let finalHue: number;
        let finalS: number;
        let finalL: number;
        
        if (config.singleColor) {
          finalHue = config.neonHue;
          finalS = 100;
          finalL = 65;
        } else {
          const starColorPos = (globalColorPos + star.colorOffset) % NEON_COLORS.length;
          const colorIndex = Math.floor(starColorPos);
          const colorT = starColorPos - colorIndex;
          const color1 = NEON_COLORS[colorIndex];
          const color2 = NEON_COLORS[(colorIndex + 1) % NEON_COLORS.length];
          const baseColor = lerpColor(color1, color2, colorT);
          finalHue = (baseColor.h + hueShift + 360) % 360;
          finalS = baseColor.s;
          finalL = baseColor.l;
        }

        const colorBlend = star.distance * 0.6;
        const displayL = finalL + (100 - finalL) * (1 - colorBlend);
        const displayS = finalS * colorBlend;
        
        // Apply particle size
        const sizeMultiplier = config.particleSize;

        // Draw star with trail (respecting config.trail)
        const trailLength = star.distance * 8 * effectiveSpeed * config.trail * (star.isFast ? 2.5 : 1);
        if (trailLength > 1) {
          const trailDist = star.isFast ? 0.05 : 0.02;
          const trailX = centerX + Math.cos(star.angle) * (star.distance - trailDist) * maxRadius;
          const trailY = centerY + Math.sin(star.angle) * (star.distance - trailDist) * maxRadius;
          
          ctx.beginPath();
          ctx.moveTo(trailX, trailY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = star.isFast
            ? `hsla(${finalHue}, ${displayS}%, ${displayL}%, ${alpha * 0.85})`
            : `hsla(${finalHue}, ${displayS * 0.5}%, ${displayL}%, ${alpha * 0.7})`;
          ctx.lineWidth = star.size * scale * (star.isFast ? 0.7 : 0.5) * sizeMultiplier;
          ctx.stroke();
        }
        
        // Motion blur effect
        if (config.motionBlur > 0.1 && star.distance > 0.1) {
          const blurSteps = Math.floor(2 + config.motionBlur * 2);
          const blurDist = star.distance * 0.1 * config.motionBlur;
          for (let b = 0; b < blurSteps; b++) {
            const blurT = b / blurSteps;
            const blurRadius = star.distance - blurDist * blurT;
            const blurX = centerX + Math.cos(star.angle) * blurRadius * maxRadius;
            const blurY = centerY + Math.sin(star.angle) * blurRadius * maxRadius;
            const blurAlpha = alpha * (1 - blurT) * config.motionBlur * 0.4;
            ctx.beginPath();
            ctx.arc(blurX, blurY, star.size * scale * sizeMultiplier * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${finalHue}, ${displayS}%, ${displayL}%, ${blurAlpha})`;
            ctx.fill();
          }
        }

        // Draw star point
        ctx.beginPath();
        ctx.arc(x, y, star.size * scale * sizeMultiplier, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${finalHue}, ${displayS}%, ${displayL}%, ${alpha})`;
        ctx.fill();

        // Respawn at center when off-screen
        if (star.distance > 1.3) {
          star.distance = 0.01;
          star.angle = Math.random() * Math.PI * 2;
          star.isFast = Math.random() < 0.05;
          star.speed = star.isFast ? 0.6 + Math.random() * 0.8 : 0.15 + Math.random() * 0.35;
          star.brightness = star.isFast ? 0.95 + Math.random() * 0.05 : 0.4 + Math.random() * 0.6;
          star.size = star.isFast ? 1.2 + Math.random() * 2.5 : 0.8 + Math.random() * 2;
          star.colorOffset = Math.random() * NEON_COLORS.length;
        }
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      clearInterval(configRefreshInterval);
      window.removeEventListener('storage', handleStorageChange);
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