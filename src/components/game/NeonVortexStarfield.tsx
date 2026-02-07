 import React, { useRef, useEffect, useMemo } from "react";
 import { loadStarfieldConfig, NEON_COLORS, lerpColor, StarfieldConfig } from "@/lib/starfieldConfig";
 
 interface VortexStar {
   angle: number;
   baseRadius: number; // Radial offset from center (0-1)
   angularSpeed: number;
   zSpeed: number;
   z: number; // Depth (0.05 to 1.5)
   size: number;
   brightness: number;
   colorPhase: number;
   layer: number;
   // Trail history
   prevScreenX: number;
   prevScreenY: number;
 }
 
 interface NeonVortexStarfieldProps {
   starCount?: number;
 }
 
 export const NeonVortexStarfield: React.FC<NeonVortexStarfieldProps> = ({
   starCount = 300,
 }) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const rafRef = useRef<number>(0);
   const starsRef = useRef<VortexStar[]>([]);
   const startTimeRef = useRef<number>(0);
   const pulseRef = useRef<{ time: number; active: boolean }>({
     time: 0,
     active: false,
   });
   const lastPulseRef = useRef<number>(0);
   const configRef = useRef<StarfieldConfig>(loadStarfieldConfig());
 
   // Constants for perspective projection
   const FOCAL_LENGTH = 400;
   const NEAR = 0.05;
   const FAR = 1.5;
 
   useEffect(() => {
     const canvas = canvasRef.current;
     if (!canvas) return;
 
     const ctx = canvas.getContext("2d", { alpha: false });
     if (!ctx) return;
 
     startTimeRef.current = performance.now();
     lastPulseRef.current = performance.now();
     configRef.current = loadStarfieldConfig();
 
     // Initialize stars with Z-axis depth
     const initStars = (config: StarfieldConfig) => {
       const count = Math.floor(starCount * config.density);
       starsRef.current = [];
       for (let i = 0; i < count; i++) {
         const layer = 1 + Math.floor(Math.random() * 3); // 1-3
         starsRef.current.push({
           angle: Math.random() * Math.PI * 2,
           baseRadius: 0.1 + Math.random() * 0.6,
           angularSpeed: (0.3 + Math.random() * 0.5) * (4 - layer) * 0.3,
           zSpeed: (0.15 + Math.random() * 0.25) * layer * 0.4,
           z: NEAR + Math.random() * (FAR - NEAR),
           size: (0.8 + Math.random() * 1.8) * (layer * 0.5 + 0.5),
           brightness: 0.7 + Math.random() * 0.3,
           colorPhase: Math.random() * NEON_COLORS.length,
           layer,
           prevScreenX: 0,
           prevScreenY: 0,
         });
       }
     };
 
     // Resize handler
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
     initStars(configRef.current);
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
       const cycleSpeed = config.colorCycle ? 0.12 * config.colorSpeed : 0;
       const globalColorPos = (elapsed * cycleSpeed) % NEON_COLORS.length;
 
       // Clear with dark background
       ctx.fillStyle = "hsl(222, 47%, 5%)";
       ctx.fillRect(0, 0, w, h);
 
       // Trigger pulse wave periodically (scales with bloom setting)
       if (config.bloom > 0.1 && now - lastPulseRef.current > 4000 + Math.random() * 2000) {
         pulseRef.current = { time: now, active: true };
         lastPulseRef.current = now;
       }
 
       // Draw pulse wave if active
       const pulse = pulseRef.current;
       if (pulse.active) {
         const pulseAge = (now - pulse.time) / 1000;
         const pulseRadius = pulseAge * Math.max(w, h) * 0.5;
         const pulseAlpha = Math.max(0, 0.3 * config.bloom - pulseAge * 0.15);
 
         if (pulseAlpha > 0) {
           const gradient = ctx.createRadialGradient(
             centerX, centerY, Math.max(0, pulseRadius - 20),
             centerX, centerY, pulseRadius + 30
           );
           const hueShift = config.neonHue - 280;
           const pulseHue = ((globalColorPos * 60) + hueShift + 360) % 360;
           gradient.addColorStop(0, `hsla(${pulseHue}, 100%, 70%, 0)`);
           gradient.addColorStop(0.5, `hsla(${pulseHue}, 100%, 70%, ${pulseAlpha})`);
           gradient.addColorStop(1, `hsla(${pulseHue}, 100%, 70%, 0)`);
 
           ctx.beginPath();
           ctx.arc(centerX, centerY, pulseRadius + 30, 0, Math.PI * 2);
           ctx.fillStyle = gradient;
           ctx.fill();
         } else {
           pulse.active = false;
         }
       }
 
       // Central bloom effect
       if (config.bloom > 0.1) {
         const bloomRadius = 80 * config.bloom;
         const hueShift = config.neonHue - 280;
         const bloomHue = ((globalColorPos * 60) + hueShift + 360) % 360;
         const bloomGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, bloomRadius);
         bloomGradient.addColorStop(0, `hsla(${bloomHue}, 80%, 60%, ${0.15 * config.bloom})`);
         bloomGradient.addColorStop(0.5, `hsla(${bloomHue}, 80%, 50%, ${0.08 * config.bloom})`);
         bloomGradient.addColorStop(1, `hsla(${bloomHue}, 80%, 50%, 0)`);
         ctx.beginPath();
         ctx.arc(centerX, centerY, bloomRadius, 0, Math.PI * 2);
         ctx.fillStyle = bloomGradient;
         ctx.fill();
       }
 
       // Draw stars - sorted by z for proper depth (far first)
       const stars = starsRef.current;
       const sortedStars = [...stars].sort((a, b) => b.z - a.z);
 
       for (let i = 0; i < sortedStars.length; i++) {
         const star = sortedStars[i];
 
         // Store previous screen position for trail
         const prevX = star.prevScreenX;
         const prevY = star.prevScreenY;
 
         // Move toward viewer (decreasing z)
         star.z -= star.zSpeed * config.speed * dt;
 
         // Spiral rotation - faster as star gets closer
         const angularBoost = 1 + 0.5 / Math.max(NEAR, star.z);
         star.angle += star.angularSpeed * config.speed * dt * angularBoost;
 
         // Respawn when too close
         if (star.z < NEAR) {
           star.z = FAR;
           star.angle = Math.random() * Math.PI * 2;
           star.baseRadius = 0.1 + Math.random() * 0.6;
           star.prevScreenX = centerX;
           star.prevScreenY = centerY;
           continue;
         }
 
         // Calculate 3D position with spiral expansion
         const spiralRadius = star.baseRadius * (1 / star.z);
         const x3d = Math.cos(star.angle) * spiralRadius;
         const y3d = Math.sin(star.angle) * spiralRadius;
 
         // Perspective projection
         const screenX = centerX + (x3d / star.z) * FOCAL_LENGTH;
         const screenY = centerY + (y3d / star.z) * FOCAL_LENGTH;
 
         // Store for next frame's trail
         star.prevScreenX = screenX;
         star.prevScreenY = screenY;
 
         // Skip if off-screen
         if (screenX < -50 || screenX > w + 50 || screenY < -50 || screenY > h + 50) continue;
 
         // Calculate color
         const hueShift = config.neonHue - 280;
          let finalHue: number;
          let finalS: number;
          let finalL: number;
          
          if (config.singleColor) {
            finalHue = config.neonHue;
            finalS = 100;
            finalL = 65;
          } else {
            const starColorPos = config.colorCycle 
           ? (globalColorPos + star.colorPhase) % NEON_COLORS.length
           : star.colorPhase;
            const colorIndex = Math.floor(starColorPos);
            const colorT = starColorPos - colorIndex;
            const c1 = NEON_COLORS[colorIndex];
            const c2 = NEON_COLORS[(colorIndex + 1) % NEON_COLORS.length];
            const color = lerpColor(c1, c2, colorT);
            finalHue = (color.h + hueShift + 360) % 360;
            finalS = color.s;
            finalL = color.l;
          }
 
         // Depth-based alpha and size (closer = bigger and brighter)
         const depthScale = Math.min(2, 1 / star.z);
         const layerAlpha = 0.4 + (star.layer / 3) * 0.5 * depthScale;
         const baseAlpha = star.brightness * layerAlpha;
          const displaySize = star.size * depthScale * 0.8 * config.particleSize;
 
         // Draw trail toward center (motion blur)
         if (config.trail > 0.1 && prevX !== 0 && prevY !== 0) {
           const trailLength = Math.sqrt((screenX - prevX) ** 2 + (screenY - prevY) ** 2) * config.trail;
           if (trailLength > 2) {
             // Trail points toward center
             const dx = centerX - screenX;
             const dy = centerY - screenY;
             const dist = Math.sqrt(dx * dx + dy * dy);
             const trailEndX = screenX + (dx / dist) * Math.min(trailLength * 2, dist * 0.3);
             const trailEndY = screenY + (dy / dist) * Math.min(trailLength * 2, dist * 0.3);
 
             const trailGradient = ctx.createLinearGradient(trailEndX, trailEndY, screenX, screenY);
              trailGradient.addColorStop(0, `hsla(${finalHue}, ${finalS}%, ${finalL}%, 0)`);
              trailGradient.addColorStop(1, `hsla(${finalHue}, ${finalS}%, ${finalL}%, ${baseAlpha * 0.5})`);
 
           ctx.beginPath();
             ctx.moveTo(trailEndX, trailEndY);
             ctx.lineTo(screenX, screenY);
             ctx.strokeStyle = trailGradient;
             ctx.lineWidth = displaySize * 1.5;
             ctx.lineCap = "round";
           ctx.stroke();
           }
         }
          
          // Motion blur effect - only if enabled and significant movement
          if (config.motionBlur > 0.1 && prevX !== 0 && depthScale > 0.5) {
            const blurSteps = 2;  // Fixed at 2 for performance
            for (let b = 0; b < blurSteps; b++) {
              const blurT = b / blurSteps;
              const blurX = screenX + (centerX - screenX) * blurT * 0.15;
              const blurY = screenY + (centerY - screenY) * blurT * 0.15;
              const blurAlpha = baseAlpha * (1 - blurT) * config.motionBlur * 0.3;
              ctx.beginPath();
              ctx.arc(blurX, blurY, displaySize * 0.4, 0, Math.PI * 2);
              ctx.fillStyle = `hsla(${finalHue}, ${finalS}%, ${finalL}%, ${blurAlpha})`;
              ctx.fill();
            }
          }
 
         // Draw star with glow
         const glowRadius = displaySize * 3 * config.glow;
         if (glowRadius > 1) {
           const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
            gradient.addColorStop(0, `hsla(${finalHue}, ${finalS}%, ${finalL}%, ${baseAlpha})`);
            gradient.addColorStop(0.3, `hsla(${finalHue}, ${finalS}%, ${finalL}%, ${baseAlpha * 0.5})`);
            gradient.addColorStop(1, `hsla(${finalHue}, ${finalS}%, ${finalL}%, 0)`);
 
           ctx.beginPath();
           ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
           ctx.fillStyle = gradient;
           ctx.fill();
         }
 
         // Draw bright core
         ctx.beginPath();
         ctx.arc(screenX, screenY, displaySize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${finalHue}, ${finalS * 0.3}%, ${Math.min(100, finalL + 30)}%, ${baseAlpha})`;
         ctx.fill();
       }
 
       // Subtle vignette
       const maxRadius = Math.max(w, h) * 0.7;
       const vignetteGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
       vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
       vignetteGradient.addColorStop(0.7, "rgba(0, 0, 0, 0)");
       vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.5)");
       ctx.fillStyle = vignetteGradient;
       ctx.fillRect(0, 0, w, h);
     };
 
     rafRef.current = requestAnimationFrame(loop);
 
     return () => {
       cancelAnimationFrame(rafRef.current);
       window.removeEventListener("resize", resize);
     };
   }, [starCount]);
 
   return (
     <canvas
       ref={canvasRef}
       className="neon-vortex-starfield-canvas"
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
 
 export default NeonVortexStarfield;