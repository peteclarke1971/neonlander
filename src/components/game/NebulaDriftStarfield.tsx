 import React, { useRef, useEffect } from "react";
 import { loadStarfieldConfig, NEON_COLORS, lerpColor, StarfieldConfig } from "@/lib/starfieldConfig";
 
 interface NebulaPuff {
   x: number;       // 3D position
   y: number;
   z: number;
   zSpeed: number;
   radius: number;  // Base size
   rotation: number;
   rotationSpeed: number;
   colorIndex: number;
   opacity: number;
 }
 
 interface NebulaStar {
   angle: number;
   baseRadius: number;
   z: number;
   zSpeed: number;
   size: number;
   brightness: number;
   colorPhase: number;
   prevX: number;
   prevY: number;
   isShootingStar: boolean;
 }
 
 interface NebulaDriftStarfieldProps {
   starCount?: number;
 }
 
 export const NebulaDriftStarfield: React.FC<NebulaDriftStarfieldProps> = ({
   starCount = 250,
 }) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const rafRef = useRef<number>(0);
   const starsRef = useRef<NebulaStar[]>([]);
   const nebulasRef = useRef<NebulaPuff[]>([]);
   const startTimeRef = useRef<number>(0);
   const configRef = useRef<StarfieldConfig>(loadStarfieldConfig());
 
   const FOCAL_LENGTH = 400;
   const NEAR = 0.08;
   const FAR = 1.8;
 
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
         const isShootingStar = Math.random() < 0.05; // 5% shooting stars
         starsRef.current.push({
           angle: Math.random() * Math.PI * 2,
           baseRadius: 0.05 + Math.random() * 0.8,
           z: NEAR + Math.random() * (FAR - NEAR),
           zSpeed: isShootingStar 
             ? 0.6 + Math.random() * 0.4 
             : 0.1 + Math.random() * 0.2,
           size: isShootingStar 
             ? 1.5 + Math.random() * 1.0
             : 0.6 + Math.random() * 1.2,
           brightness: 0.6 + Math.random() * 0.4,
           colorPhase: Math.random() * NEON_COLORS.length,
           prevX: 0,
           prevY: 0,
           isShootingStar,
         });
       }
 
       // Initialize nebula puffs
       nebulasRef.current = [];
       const nebulaCount = Math.floor(12 * config.density);
       for (let i = 0; i < nebulaCount; i++) {
         nebulasRef.current.push({
           x: (Math.random() - 0.5) * 2,
           y: (Math.random() - 0.5) * 2,
           z: NEAR + Math.random() * (FAR - NEAR),
           zSpeed: 0.03 + Math.random() * 0.05,
           radius: 0.15 + Math.random() * 0.25,
           rotation: Math.random() * Math.PI * 2,
           rotationSpeed: (Math.random() - 0.5) * 0.1,
           colorIndex: Math.floor(Math.random() * NEON_COLORS.length),
           opacity: 0.15 + Math.random() * 0.15,
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
       const cycleSpeed = config.colorCycle ? 0.08 * config.colorSpeed : 0;
       const globalColorPos = (elapsed * cycleSpeed) % NEON_COLORS.length;
 
       // Clear
       ctx.fillStyle = "hsl(222, 47%, 4%)";
       ctx.fillRect(0, 0, w, h);
 
       // Draw nebula puffs (back layer first)
       const nebulas = nebulasRef.current;
       const sortedNebulas = [...nebulas].sort((a, b) => b.z - a.z);
 
       for (const neb of sortedNebulas) {
         // Move toward viewer
         neb.z -= neb.zSpeed * config.speed * dt;
         neb.rotation += neb.rotationSpeed * dt;
 
         // Respawn
         if (neb.z < NEAR * 2) {
           neb.z = FAR;
           neb.x = (Math.random() - 0.5) * 2;
           neb.y = (Math.random() - 0.5) * 2;
           neb.colorIndex = Math.floor(Math.random() * NEON_COLORS.length);
           continue;
         }
 
         // Project
         const screenX = centerX + (neb.x / neb.z) * FOCAL_LENGTH;
         const screenY = centerY + (neb.y / neb.z) * FOCAL_LENGTH;
         const scale = 1 / neb.z;
         const displayRadius = neb.radius * scale * FOCAL_LENGTH * config.glow;
 
         if (displayRadius < 10) continue;
         if (screenX < -displayRadius || screenX > w + displayRadius) continue;
         if (screenY < -displayRadius || screenY > h + displayRadius) continue;
 
         // Get nebula color with hue shift
         const hueShift = config.neonHue - 280;
         const colorIdx = config.colorCycle 
           ? (neb.colorIndex + globalColorPos) % NEON_COLORS.length
           : neb.colorIndex;
         const colorIdxFloor = Math.floor(colorIdx);
         const colorT = colorIdx - colorIdxFloor;
         const c1 = NEON_COLORS[colorIdxFloor];
         const c2 = NEON_COLORS[(colorIdxFloor + 1) % NEON_COLORS.length];
         const color = lerpColor(c1, c2, colorT);
         const finalHue = (color.h + hueShift + 360) % 360;
 
         // Draw nebula as soft radial gradient
         const nebGradient = ctx.createRadialGradient(
           screenX, screenY, 0,
           screenX, screenY, displayRadius
         );
         const nebAlpha = neb.opacity * config.bloom * Math.min(1, scale);
         nebGradient.addColorStop(0, `hsla(${finalHue}, ${color.s}%, ${color.l}%, ${nebAlpha * 0.8})`);
         nebGradient.addColorStop(0.3, `hsla(${finalHue}, ${color.s}%, ${color.l - 10}%, ${nebAlpha * 0.5})`);
         nebGradient.addColorStop(0.6, `hsla(${finalHue}, ${color.s - 10}%, ${color.l - 15}%, ${nebAlpha * 0.2})`);
         nebGradient.addColorStop(1, `hsla(${finalHue}, ${color.s}%, ${color.l}%, 0)`);
 
         ctx.beginPath();
         ctx.arc(screenX, screenY, displayRadius, 0, Math.PI * 2);
         ctx.fillStyle = nebGradient;
         ctx.fill();
       }
 
       // Draw stars (sorted by z)
       const stars = starsRef.current;
       const sortedStars = [...stars].sort((a, b) => b.z - a.z);
 
       for (let i = 0; i < sortedStars.length; i++) {
         const star = sortedStars[i];
 
         const prevX = star.prevX;
         const prevY = star.prevY;
 
         // Move toward viewer
         star.z -= star.zSpeed * config.speed * dt;
 
         // Respawn
         if (star.z < NEAR) {
           star.z = FAR;
           star.angle = Math.random() * Math.PI * 2;
           star.baseRadius = 0.05 + Math.random() * 0.8;
           star.prevX = centerX;
           star.prevY = centerY;
           star.isShootingStar = Math.random() < 0.05;
           star.zSpeed = star.isShootingStar 
             ? 0.6 + Math.random() * 0.4 
             : 0.1 + Math.random() * 0.2;
           continue;
         }
 
         // 3D position
         const x3d = Math.cos(star.angle) * star.baseRadius;
         const y3d = Math.sin(star.angle) * star.baseRadius;
 
         // Project
         const screenX = centerX + (x3d / star.z) * FOCAL_LENGTH;
         const screenY = centerY + (y3d / star.z) * FOCAL_LENGTH;
 
         star.prevX = screenX;
         star.prevY = screenY;
 
         if (screenX < -50 || screenX > w + 50 || screenY < -50 || screenY > h + 50) continue;
 
         // Color
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
 
         const depthScale = Math.min(2.5, 1 / star.z);
         const baseAlpha = star.brightness * (0.5 + depthScale * 0.4);
          const displaySize = star.size * depthScale * (star.isShootingStar ? 1.2 : 0.8) * config.particleSize;
 
         // Draw trail (longer for shooting stars)
         if (config.trail > 0.1 && prevX !== 0 && prevY !== 0) {
           const dx = centerX - screenX;
           const dy = centerY - screenY;
           const dist = Math.sqrt(dx * dx + dy * dy);
           const trailMultiplier = star.isShootingStar ? 3 : 1;
           const trailLen = (20 + star.zSpeed * 60) * config.trail * depthScale * trailMultiplier;
           
           if (dist > 5 && trailLen > 3) {
             const trailEndX = screenX + (dx / dist) * Math.min(trailLen, dist * 0.6);
             const trailEndY = screenY + (dy / dist) * Math.min(trailLen, dist * 0.6);
 
             const trailGradient = ctx.createLinearGradient(trailEndX, trailEndY, screenX, screenY);
              trailGradient.addColorStop(0, `hsla(${finalHue}, ${finalS}%, ${finalL}%, 0)`);
              trailGradient.addColorStop(0.3, `hsla(${finalHue}, ${finalS}%, ${finalL}%, ${baseAlpha * 0.3})`);
              trailGradient.addColorStop(1, `hsla(${finalHue}, ${finalS}%, ${finalL + 10}%, ${baseAlpha * 0.7})`);
 
             ctx.beginPath();
             ctx.moveTo(trailEndX, trailEndY);
             ctx.lineTo(screenX, screenY);
             ctx.strokeStyle = trailGradient;
             ctx.lineWidth = displaySize * (star.isShootingStar ? 2 : 1.5);
             ctx.lineCap = "round";
             ctx.stroke();
           }
         }
          
          // Motion blur effect
          if (config.motionBlur > 0.1 && prevX !== 0) {
            const blurSteps = Math.floor(2 + config.motionBlur * 2);
            for (let b = 0; b < blurSteps; b++) {
              const blurT = b / blurSteps;
              const blurX = screenX + (centerX - screenX) * blurT * 0.12;
              const blurY = screenY + (centerY - screenY) * blurT * 0.12;
              const blurAlpha = baseAlpha * (1 - blurT) * config.motionBlur * 0.3;
              ctx.beginPath();
              ctx.arc(blurX, blurY, displaySize * 0.4, 0, Math.PI * 2);
              ctx.fillStyle = `hsla(${finalHue}, ${finalS}%, ${finalL}%, ${blurAlpha})`;
              ctx.fill();
            }
          }
 
         // Star glow
         const glowRadius = displaySize * 3 * config.glow;
         if (glowRadius > 1) {
           const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
            gradient.addColorStop(0, `hsla(${finalHue}, ${finalS}%, ${finalL + 15}%, ${baseAlpha})`);
            gradient.addColorStop(0.3, `hsla(${finalHue}, ${finalS}%, ${finalL}%, ${baseAlpha * 0.5})`);
            gradient.addColorStop(1, `hsla(${finalHue}, ${finalS}%, ${finalL}%, 0)`);
 
           ctx.beginPath();
           ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
           ctx.fillStyle = gradient;
           ctx.fill();
         }
 
         // Core
         ctx.beginPath();
         ctx.arc(screenX, screenY, displaySize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${finalHue}, ${finalS * 0.3}%, ${Math.min(100, finalL + 35)}%, ${baseAlpha})`;
         ctx.fill();
       }
 
       // Vignette
       const maxRadius = Math.max(w, h) * 0.7;
       const vignetteGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
       vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
       vignetteGradient.addColorStop(0.6, "rgba(0, 0, 0, 0)");
       vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.55)");
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
       className="nebula-drift-starfield-canvas"
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
 
 export default NebulaDriftStarfield;