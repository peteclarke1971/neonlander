 import React, { useRef, useEffect } from "react";
 import { loadStarfieldConfig, NEON_COLORS, lerpColor, StarfieldConfig } from "@/lib/starfieldConfig";
 
 interface TunnelStar {
   ringAngle: number;    // Position on ring (0 to 2π)
   ringRadius: number;   // Ring radius (0.3 to 1.0)
   z: number;            // Depth (0.05 to 2.0)
   zSpeed: number;       // Speed toward viewer
   rotationSpeed: number;// How fast it rotates around ring
   size: number;
   brightness: number;
   colorPhase: number;
   prevX: number;
   prevY: number;
 }
 
 interface CosmicTunnelStarfieldProps {
   starCount?: number;
 }
 
 export const CosmicTunnelStarfield: React.FC<CosmicTunnelStarfieldProps> = ({
   starCount = 280,
 }) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const rafRef = useRef<number>(0);
   const starsRef = useRef<TunnelStar[]>([]);
   const startTimeRef = useRef<number>(0);
   const configRef = useRef<StarfieldConfig>(loadStarfieldConfig());
 
   const FOCAL_LENGTH = 350;
   const NEAR = 0.08;
   const FAR = 2.0;
 
   useEffect(() => {
     const canvas = canvasRef.current;
     if (!canvas) return;
 
     const ctx = canvas.getContext("2d", { alpha: false });
     if (!ctx) return;
 
     startTimeRef.current = performance.now();
     configRef.current = loadStarfieldConfig();
 
     const initStars = (config: StarfieldConfig) => {
       const count = Math.floor(starCount * config.density);
       starsRef.current = [];
       for (let i = 0; i < count; i++) {
         starsRef.current.push({
           ringAngle: Math.random() * Math.PI * 2,
           ringRadius: 0.3 + Math.random() * 0.7,
           z: NEAR + Math.random() * (FAR - NEAR),
           zSpeed: 0.2 + Math.random() * 0.3,
           rotationSpeed: (0.3 + Math.random() * 0.6) * (Math.random() > 0.5 ? 1 : -1),
           size: 0.8 + Math.random() * 1.5,
           brightness: 0.6 + Math.random() * 0.4,
           colorPhase: Math.random() * NEON_COLORS.length,
           prevX: 0,
           prevY: 0,
         });
       }
     };
 
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
     initStars(configRef.current);
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
 
        // Refresh config each frame for live updates
        configRef.current = loadStarfieldConfig();
        const config = configRef.current;
       const elapsed = (now - startTimeRef.current) / 1000;
       const cycleSpeed = config.colorCycle ? 0.1 * config.colorSpeed : 0;
       const globalColorPos = (elapsed * cycleSpeed) % NEON_COLORS.length;
 
       // Clear
       ctx.fillStyle = "hsl(222, 47%, 4%)";
       ctx.fillRect(0, 0, w, h);
 
       // Central wormhole glow
       if (config.bloom > 0.1) {
         const hueShift = config.neonHue - 280;
         const pulseIntensity = 0.7 + 0.3 * Math.sin(elapsed * 2);
         
         // Outer glow ring
         for (let ring = 0; ring < 3; ring++) {
           const ringHue = ((globalColorPos * 60 + ring * 40) + hueShift + 360) % 360;
           const ringRadius = (60 + ring * 25) * config.bloom * pulseIntensity;
           const ringAlpha = (0.15 - ring * 0.04) * config.bloom;
           
           const ringGradient = ctx.createRadialGradient(
             centerX, centerY, ringRadius * 0.6,
             centerX, centerY, ringRadius
           );
           ringGradient.addColorStop(0, `hsla(${ringHue}, 100%, 60%, 0)`);
           ringGradient.addColorStop(0.5, `hsla(${ringHue}, 100%, 60%, ${ringAlpha})`);
           ringGradient.addColorStop(1, `hsla(${ringHue}, 100%, 60%, 0)`);
           
           ctx.beginPath();
           ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
           ctx.fillStyle = ringGradient;
           ctx.fill();
         }
         
         // Central bright core
         const coreRadius = 30 * config.bloom;
         const coreHue = ((globalColorPos * 60) + hueShift + 360) % 360;
         const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
         coreGradient.addColorStop(0, `hsla(${coreHue}, 80%, 90%, ${0.4 * config.bloom})`);
         coreGradient.addColorStop(0.3, `hsla(${coreHue}, 90%, 70%, ${0.25 * config.bloom})`);
         coreGradient.addColorStop(1, `hsla(${coreHue}, 100%, 60%, 0)`);
         
         ctx.beginPath();
         ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
         ctx.fillStyle = coreGradient;
         ctx.fill();
       }
 
       // Draw stars sorted by z (far first)
       const stars = starsRef.current;
       const sortedStars = [...stars].sort((a, b) => b.z - a.z);
 
       for (let i = 0; i < sortedStars.length; i++) {
         const star = sortedStars[i];
 
         const prevX = star.prevX;
         const prevY = star.prevY;
 
         // Move toward viewer
         star.z -= star.zSpeed * config.speed * dt;
 
         // Rotate around ring - faster as closer
         const rotBoost = 1 + 0.5 / Math.max(NEAR, star.z);
         star.ringAngle += star.rotationSpeed * config.speed * dt * rotBoost;
 
         // Respawn when too close
         if (star.z < NEAR) {
           star.z = FAR;
           star.ringAngle = Math.random() * Math.PI * 2;
           star.ringRadius = 0.3 + Math.random() * 0.7;
           star.prevX = centerX;
           star.prevY = centerY;
           continue;
         }
 
         // Calculate 3D position on cylindrical tunnel wall
         const tunnelRadius = star.ringRadius;
         const x3d = Math.cos(star.ringAngle) * tunnelRadius;
         const y3d = Math.sin(star.ringAngle) * tunnelRadius;
 
         // Perspective projection
         const screenX = centerX + (x3d / star.z) * FOCAL_LENGTH;
         const screenY = centerY + (y3d / star.z) * FOCAL_LENGTH;
 
         star.prevX = screenX;
         star.prevY = screenY;
 
         if (screenX < -50 || screenX > w + 50 || screenY < -50 || screenY > h + 50) continue;
 
         // Color based on depth ring
         const hueShift = config.neonHue - 280;
          const depthHue = config.singleColor
            ? config.neonHue
            : config.colorCycle
           ? ((star.z * 180 + globalColorPos * 60) + hueShift + 360) % 360
           : ((star.colorPhase / NEON_COLORS.length * 360) + hueShift + 360) % 360;
 
         const depthScale = Math.min(2.5, 1 / star.z);
         const baseAlpha = star.brightness * (0.5 + depthScale * 0.3);
          const displaySize = star.size * depthScale * 0.7 * config.particleSize;
 
         // Draw trail toward center
         if (config.trail > 0.1 && prevX !== 0 && prevY !== 0) {
           const dx = centerX - screenX;
           const dy = centerY - screenY;
           const dist = Math.sqrt(dx * dx + dy * dy);
           const trailLen = (40 + star.zSpeed * 80) * config.trail * depthScale;
           
           if (dist > 5 && trailLen > 3) {
             const trailEndX = screenX + (dx / dist) * Math.min(trailLen, dist * 0.5);
             const trailEndY = screenY + (dy / dist) * Math.min(trailLen, dist * 0.5);
 
             const trailGradient = ctx.createLinearGradient(trailEndX, trailEndY, screenX, screenY);
             trailGradient.addColorStop(0, `hsla(${depthHue}, 100%, 65%, 0)`);
             trailGradient.addColorStop(0.5, `hsla(${depthHue}, 100%, 65%, ${baseAlpha * 0.4})`);
             trailGradient.addColorStop(1, `hsla(${depthHue}, 100%, 70%, ${baseAlpha * 0.7})`);
 
             ctx.beginPath();
             ctx.moveTo(trailEndX, trailEndY);
             ctx.lineTo(screenX, screenY);
             ctx.strokeStyle = trailGradient;
             ctx.lineWidth = displaySize * 2;
             ctx.lineCap = "round";
             ctx.stroke();
           }
         }
          
          // Motion blur effect - only if enabled and significant movement
          if (config.motionBlur > 0.1 && prevX !== 0 && depthScale > 0.8) {
            const blurSteps = 2;  // Fixed at 2 for performance
            for (let b = 0; b < blurSteps; b++) {
              const blurT = b / blurSteps;
              const blurX = screenX + (centerX - screenX) * blurT * 0.15;
              const blurY = screenY + (centerY - screenY) * blurT * 0.15;
              const blurAlpha = baseAlpha * (1 - blurT) * config.motionBlur * 0.3;
              ctx.beginPath();
              ctx.arc(blurX, blurY, displaySize * 0.4, 0, Math.PI * 2);
              ctx.fillStyle = `hsla(${depthHue}, 100%, 70%, ${blurAlpha})`;
              ctx.fill();
            }
          }
 
         // Draw star glow
         const glowRadius = displaySize * 3 * config.glow;
         if (glowRadius > 1) {
           const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
           gradient.addColorStop(0, `hsla(${depthHue}, 100%, 75%, ${baseAlpha})`);
           gradient.addColorStop(0.3, `hsla(${depthHue}, 100%, 65%, ${baseAlpha * 0.5})`);
           gradient.addColorStop(1, `hsla(${depthHue}, 100%, 60%, 0)`);
 
           ctx.beginPath();
           ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
           ctx.fillStyle = gradient;
           ctx.fill();
         }
 
         // Bright core
         ctx.beginPath();
         ctx.arc(screenX, screenY, displaySize * 0.5, 0, Math.PI * 2);
         ctx.fillStyle = `hsla(${depthHue}, 50%, 95%, ${baseAlpha})`;
         ctx.fill();
       }
 
       // Vignette
       const maxRadius = Math.max(w, h) * 0.7;
       const vignetteGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
       vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
       vignetteGradient.addColorStop(0.65, "rgba(0, 0, 0, 0)");
       vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");
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
       className="cosmic-tunnel-starfield-canvas"
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
 
 export default CosmicTunnelStarfield;