import React, { useRef, useEffect } from "react";
import { loadStarfieldConfig, NEON_COLORS, lerpColor, StarfieldConfig } from "@/lib/starfieldConfig";

interface VoidRing {
  z: number;              // Depth (0.05 to 2.5)
  zSpeed: number;         // Speed toward viewer
  rotationAngle: number;  // Ring rotation
  rotationSpeed: number;  // How fast ring rotates
  starCount: number;      // Number of stars on this ring
  baseRadius: number;     // Ring radius (0.3 to 0.8)
  colorPhase: number;     // Color offset
  starAngles: number[];   // Position of each star on ring
  starSizes: number[];    // Size of each star
}

interface IntoTheVoidStarfieldProps {
  ringCount?: number;
}

export const IntoTheVoidStarfield: React.FC<IntoTheVoidStarfieldProps> = ({
  ringCount = 40,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const ringsRef = useRef<VoidRing[]>([]);
  const startTimeRef = useRef<number>(0);
  const configRef = useRef<StarfieldConfig>(loadStarfieldConfig());

  const FOCAL_LENGTH = 400;
  const NEAR = 0.08;
  const FAR = 2.5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    startTimeRef.current = performance.now();
    configRef.current = loadStarfieldConfig();

    const initRings = (config: StarfieldConfig) => {
      const count = Math.floor(ringCount * config.density);
      ringsRef.current = [];
      
      for (let i = 0; i < count; i++) {
        const starsOnRing = 8 + Math.floor(Math.random() * 12);
        const starAngles: number[] = [];
        const starSizes: number[] = [];
        
        for (let s = 0; s < starsOnRing; s++) {
          starAngles.push((s / starsOnRing) * Math.PI * 2 + Math.random() * 0.3);
          starSizes.push(0.8 + Math.random() * 1.5);
        }
        
        ringsRef.current.push({
          z: NEAR + (i / count) * (FAR - NEAR) + Math.random() * 0.2,
          zSpeed: 0.15 + Math.random() * 0.2,
          rotationAngle: Math.random() * Math.PI * 2,
          rotationSpeed: (0.2 + Math.random() * 0.4) * (Math.random() > 0.5 ? 1 : -1),
          starCount: starsOnRing,
          baseRadius: 0.35 + Math.random() * 0.45,
          colorPhase: (i / count) * NEON_COLORS.length,
          starAngles,
          starSizes,
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
    initRings(configRef.current);
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

      // Refresh config each frame for live updates
      configRef.current = loadStarfieldConfig();
      const config = configRef.current;
      const elapsed = (now - startTimeRef.current) / 1000;
      const cycleSpeed = config.colorCycle ? 0.08 * config.colorSpeed : 0;
      const globalColorPos = (elapsed * cycleSpeed) % NEON_COLORS.length;

      // Clear with dark background
      ctx.fillStyle = "hsl(222, 47%, 3%)";
      ctx.fillRect(0, 0, w, h);

      // Draw concentric ring outlines (tunnel effect)
      const hueShift = config.neonHue - 280;
      const tunnelRingCount = 8;
      for (let r = 0; r < tunnelRingCount; r++) {
        const ringZ = 0.3 + (r / tunnelRingCount) * 1.5;
        const ringRadius = (0.5 / ringZ) * FOCAL_LENGTH;
        const ringHue = config.singleColor 
          ? config.neonHue 
          : ((r / tunnelRingCount * 360 + globalColorPos * 60 + hueShift) + 360) % 360;
        const ringAlpha = (0.08 + 0.04 * Math.sin(elapsed * 2 + r)) * config.glow;
        
        if (ringRadius > 10 && ringAlpha > 0.01) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${ringHue}, 100%, 60%, ${ringAlpha})`;
          ctx.lineWidth = 2 * config.particleSize;
          ctx.stroke();
        }
      }

      // Central void glow
      if (config.bloom > 0.1) {
        const pulseIntensity = 0.7 + 0.3 * Math.sin(elapsed * 1.5);
        const coreRadius = 50 * config.bloom * pulseIntensity;
        const coreHue = config.singleColor 
          ? config.neonHue 
          : ((globalColorPos * 60 + hueShift) + 360) % 360;
        
        // Outer glow
        const outerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 2);
        outerGlow.addColorStop(0, `hsla(${coreHue}, 100%, 80%, ${0.3 * config.bloom})`);
        outerGlow.addColorStop(0.3, `hsla(${coreHue}, 100%, 60%, ${0.15 * config.bloom})`);
        outerGlow.addColorStop(0.7, `hsla(${coreHue}, 80%, 50%, ${0.05 * config.bloom})`);
        outerGlow.addColorStop(1, `hsla(${coreHue}, 100%, 50%, 0)`);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreRadius * 2, 0, Math.PI * 2);
        ctx.fillStyle = outerGlow;
        ctx.fill();
        
        // Bright core
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 0.5);
        coreGrad.addColorStop(0, `hsla(${coreHue}, 60%, 95%, ${0.5 * config.bloom})`);
        coreGrad.addColorStop(0.5, `hsla(${coreHue}, 80%, 80%, ${0.3 * config.bloom})`);
        coreGrad.addColorStop(1, `hsla(${coreHue}, 100%, 60%, 0)`);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreRadius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();
      }

      // Draw rings sorted by z (far first)
      const rings = ringsRef.current;
      const sortedRings = [...rings].sort((a, b) => b.z - a.z);

      for (let r = 0; r < sortedRings.length; r++) {
        const ring = sortedRings[r];

        // Move toward viewer
        ring.z -= ring.zSpeed * config.speed * dt;

        // Rotate ring - faster as it gets closer
        const rotBoost = 1 + 0.3 / Math.max(NEAR, ring.z);
        ring.rotationAngle += ring.rotationSpeed * config.speed * dt * rotBoost;

        // Respawn when too close
        if (ring.z < NEAR) {
          ring.z = FAR;
          ring.rotationAngle = Math.random() * Math.PI * 2;
          ring.colorPhase = Math.random() * NEON_COLORS.length;
          continue;
        }

        // Calculate ring properties
        const scale = 1 / ring.z;
        const screenRadius = ring.baseRadius * scale * FOCAL_LENGTH;
        
        // Skip if too small
        if (screenRadius < 5) continue;

        // Ring color
        let ringHue: number;
        let ringS: number;
        let ringL: number;
        
        if (config.singleColor) {
          ringHue = config.neonHue;
          ringS = 100;
          ringL = 65;
        } else {
          const colorPos = config.colorCycle 
            ? (globalColorPos + ring.colorPhase) % NEON_COLORS.length
            : ring.colorPhase;
          const colorIndex = Math.floor(colorPos);
          const colorT = colorPos - colorIndex;
          const c1 = NEON_COLORS[colorIndex];
          const c2 = NEON_COLORS[(colorIndex + 1) % NEON_COLORS.length];
          const color = lerpColor(c1, c2, colorT);
          ringHue = (color.h + hueShift + 360) % 360;
          ringS = color.s;
          ringL = color.l;
        }

        const depthAlpha = Math.min(1, 0.4 + scale * 0.5);
        const baseAlpha = depthAlpha * 0.8;

        // Draw ring outline (circle)
        if (config.glow > 0.3) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, screenRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${ringHue}, ${ringS}%, ${ringL}%, ${baseAlpha * 0.15 * config.glow})`;
          ctx.lineWidth = 1.5 * config.particleSize;
          ctx.stroke();
        }

        // Draw stars on this ring
        for (let s = 0; s < ring.starCount; s++) {
          const starAngle = ring.starAngles[s] + ring.rotationAngle;
          const starSize = ring.starSizes[s] * scale * config.particleSize;
          
          const screenX = centerX + Math.cos(starAngle) * screenRadius;
          const screenY = centerY + Math.sin(starAngle) * screenRadius;

          // Skip if off-screen
          if (screenX < -50 || screenX > w + 50 || screenY < -50 || screenY > h + 50) continue;

          // Motion blur - only if enabled and scale is significant
          if (config.motionBlur > 0.1 && scale > 0.5) {
            const blurSteps = 2;  // Fixed at 2 for performance
            for (let b = 0; b < blurSteps; b++) {
              const blurT = b / blurSteps;
              const blurX = screenX + (centerX - screenX) * blurT * 0.2;
              const blurY = screenY + (centerY - screenY) * blurT * 0.2;
              const blurAlpha = baseAlpha * (1 - blurT) * config.motionBlur * 0.25;
              ctx.beginPath();
              ctx.arc(blurX, blurY, starSize * 0.4, 0, Math.PI * 2);
              ctx.fillStyle = `hsla(${ringHue}, ${ringS}%, ${ringL}%, ${blurAlpha})`;
              ctx.fill();
            }
          }

          // Draw trail toward center
          if (config.trail > 0.1) {
            const trailLen = (20 + ring.zSpeed * 60) * config.trail * scale;
            const dx = centerX - screenX;
            const dy = centerY - screenY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 5 && trailLen > 2) {
              const trailEndX = screenX + (dx / dist) * Math.min(trailLen, dist * 0.4);
              const trailEndY = screenY + (dy / dist) * Math.min(trailLen, dist * 0.4);

              const trailGradient = ctx.createLinearGradient(trailEndX, trailEndY, screenX, screenY);
              trailGradient.addColorStop(0, `hsla(${ringHue}, ${ringS}%, ${ringL}%, 0)`);
              trailGradient.addColorStop(0.5, `hsla(${ringHue}, ${ringS}%, ${ringL}%, ${baseAlpha * 0.3})`);
              trailGradient.addColorStop(1, `hsla(${ringHue}, ${ringS}%, ${ringL}%, ${baseAlpha * 0.6})`);

              ctx.beginPath();
              ctx.moveTo(trailEndX, trailEndY);
              ctx.lineTo(screenX, screenY);
              ctx.strokeStyle = trailGradient;
              ctx.lineWidth = starSize * 1.5;
              ctx.lineCap = "round";
              ctx.stroke();
            }
          }

          // Draw star glow
          const glowRadius = starSize * 3 * config.glow;
          if (glowRadius > 1) {
            const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
            gradient.addColorStop(0, `hsla(${ringHue}, ${ringS}%, ${ringL + 15}%, ${baseAlpha})`);
            gradient.addColorStop(0.3, `hsla(${ringHue}, ${ringS}%, ${ringL}%, ${baseAlpha * 0.5})`);
            gradient.addColorStop(1, `hsla(${ringHue}, ${ringS}%, ${ringL}%, 0)`);

            ctx.beginPath();
            ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
          }

          // Bright core
          ctx.beginPath();
          ctx.arc(screenX, screenY, starSize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${ringHue}, ${ringS * 0.3}%, ${Math.min(100, ringL + 35)}%, ${baseAlpha})`;
          ctx.fill();
        }
      }

      // Vignette
      const maxRadius = Math.max(w, h) * 0.7;
      const vignetteGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
      vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignetteGradient.addColorStop(0.6, "rgba(0, 0, 0, 0)");
      vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.65)");
      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, w, h);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [ringCount]);

  return (
    <canvas
      ref={canvasRef}
      className="into-the-void-starfield-canvas"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
};

export default IntoTheVoidStarfield;