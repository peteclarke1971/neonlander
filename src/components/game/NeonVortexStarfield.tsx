 import React, { useRef, useEffect } from "react";
 
 // Neon color palette for cycling
 const NEON_COLORS = [
   { h: 330, s: 100, l: 65 }, // pink
   { h: 270, s: 100, l: 70 }, // purple
   { h: 180, s: 100, l: 60 }, // cyan
   { h: 140, s: 100, l: 55 }, // green
   { h: 50, s: 100, l: 55 },  // yellow
   { h: 25, s: 100, l: 60 },  // orange
 ];
 
 interface VortexStar {
   angle: number;
   radius: number;
   speed: number;
   size: number;
   brightness: number;
   colorPhase: number;
   layer: number;
   outward: boolean;
   // Trail history (pre-allocated)
   trailX: number[];
   trailY: number[];
   trailIdx: number;
 }
 
 interface NeonVortexStarfieldProps {
   starCount?: number;
 }
 
 // Interpolate between two colors
 function lerpColor(c1: typeof NEON_COLORS[0], c2: typeof NEON_COLORS[0], t: number) {
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
 
 export const NeonVortexStarfield: React.FC<NeonVortexStarfieldProps> = ({
   starCount = 280,
 }) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const rafRef = useRef<number>(0);
   const starsRef = useRef<VortexStar[]>([]);
   const startTimeRef = useRef<number>(0);
   const pulseRef = useRef<{ time: number; radius: number; active: boolean }>({
     time: 0,
     radius: 0,
     active: false,
   });
   const lastPulseRef = useRef<number>(0);
 
   useEffect(() => {
     const canvas = canvasRef.current;
     if (!canvas) return;
 
     const ctx = canvas.getContext("2d", { alpha: false });
     if (!ctx) return;
 
     startTimeRef.current = performance.now();
     lastPulseRef.current = performance.now();
 
     const TRAIL_LENGTH = 5;
 
     // Initialize stars in spiral distribution
     const initStars = () => {
       starsRef.current = [];
       for (let i = 0; i < starCount; i++) {
         const layer = 1 + Math.floor(Math.random() * 3); // 1-3
         const outward = Math.random() > 0.5;
         starsRef.current.push({
           angle: Math.random() * Math.PI * 2,
           radius: 0.1 + Math.random() * 0.8,
           speed: (0.15 + Math.random() * 0.25) * (4 - layer) * 0.5, // Outer layers slower
           size: (0.8 + Math.random() * 1.8) * (layer * 0.5 + 0.5),
           brightness: 0.7 + Math.random() * 0.3,
           colorPhase: Math.random() * NEON_COLORS.length,
           layer,
           outward,
           trailX: new Array(TRAIL_LENGTH).fill(0),
           trailY: new Array(TRAIL_LENGTH).fill(0),
           trailIdx: 0,
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
       const maxRadius = Math.max(w, h) * 0.55;
 
       // Global color cycle
       const elapsed = (now - startTimeRef.current) / 1000;
       const cycleSpeed = 0.12;
       const globalColorPos = (elapsed * cycleSpeed) % NEON_COLORS.length;
 
       // Clear with dark background
       ctx.fillStyle = "hsl(222, 47%, 5%)";
       ctx.fillRect(0, 0, w, h);
 
       // Trigger pulse wave every 4-6 seconds
       if (now - lastPulseRef.current > 4000 + Math.random() * 2000) {
         pulseRef.current = { time: now, radius: 0, active: true };
         lastPulseRef.current = now;
       }
 
       // Draw pulse wave if active
       const pulse = pulseRef.current;
       if (pulse.active) {
         const pulseAge = (now - pulse.time) / 1000;
         const pulseRadius = pulseAge * maxRadius * 0.8;
         const pulseAlpha = Math.max(0, 0.3 - pulseAge * 0.15);
 
         if (pulseAlpha > 0) {
           // Draw expanding ring with gradient
           const gradient = ctx.createRadialGradient(
             centerX, centerY, Math.max(0, pulseRadius - 20),
             centerX, centerY, pulseRadius + 30
           );
           const pulseHue = (globalColorPos * 60) % 360;
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
 
       // Draw stars sorted by layer for proper depth
       const stars = starsRef.current;
       
       // Sort by layer (draw far layers first)
       const sortedStars = [...stars].sort((a, b) => a.layer - b.layer);
 
       for (let i = 0; i < sortedStars.length; i++) {
         const star = sortedStars[i];
 
         // Spiral motion: angular velocity increases near center
         const angularBoost = 1 + 0.3 / Math.max(0.1, star.radius);
         star.angle += star.speed * dt * angularBoost;
 
         // Radial motion: slowly spiral in or out
         const radialSpeed = 0.04 * dt;
         if (star.outward) {
           star.radius += radialSpeed;
           if (star.radius > 1.1) {
             star.outward = false;
           }
         } else {
           star.radius -= radialSpeed;
           if (star.radius < 0.05) {
             star.outward = true;
           }
         }
 
         // Calculate position
         const x = centerX + Math.cos(star.angle) * star.radius * maxRadius;
         const y = centerY + Math.sin(star.angle) * star.radius * maxRadius;
 
         // Store in trail history
         star.trailX[star.trailIdx] = x;
         star.trailY[star.trailIdx] = y;
         star.trailIdx = (star.trailIdx + 1) % TRAIL_LENGTH;
 
         // Calculate color
         const starColorPos = (globalColorPos + star.colorPhase) % NEON_COLORS.length;
         const colorIndex = Math.floor(starColorPos);
         const colorT = starColorPos - colorIndex;
         const color1 = NEON_COLORS[colorIndex];
         const color2 = NEON_COLORS[(colorIndex + 1) % NEON_COLORS.length];
         const color = lerpColor(color1, color2, colorT);
 
         // Layer-based alpha and size
         const layerAlpha = 0.4 + (star.layer / 3) * 0.5;
         const baseAlpha = star.brightness * layerAlpha;
 
         // Draw trail (curved blur effect)
         for (let t = 0; t < TRAIL_LENGTH - 1; t++) {
           const idx = (star.trailIdx - t - 1 + TRAIL_LENGTH) % TRAIL_LENGTH;
           const prevIdx = (idx - 1 + TRAIL_LENGTH) % TRAIL_LENGTH;
           const tx = star.trailX[idx];
           const ty = star.trailY[idx];
           const px = star.trailX[prevIdx];
           const py = star.trailY[prevIdx];
 
           if (tx === 0 && ty === 0) continue;
 
           const trailAlpha = baseAlpha * (1 - t / TRAIL_LENGTH) * 0.4;
           const trailSize = star.size * (1 - t / TRAIL_LENGTH) * 0.7;
 
           ctx.beginPath();
           ctx.moveTo(px, py);
           ctx.lineTo(tx, ty);
           ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${trailAlpha})`;
           ctx.lineWidth = trailSize;
           ctx.lineCap = "round";
           ctx.stroke();
         }
 
         // Draw star with glow (using gradient instead of shadowBlur for performance)
         const glowRadius = star.size * 3;
         const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
         gradient.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l}%, ${baseAlpha})`);
         gradient.addColorStop(0.3, `hsla(${color.h}, ${color.s}%, ${color.l}%, ${baseAlpha * 0.5})`);
         gradient.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0)`);
 
         ctx.beginPath();
         ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
         ctx.fillStyle = gradient;
         ctx.fill();
 
         // Draw bright core
         ctx.beginPath();
         ctx.arc(x, y, star.size * 0.5, 0, Math.PI * 2);
         ctx.fillStyle = `hsla(${color.h}, ${color.s * 0.3}%, ${Math.min(100, color.l + 30)}%, ${baseAlpha})`;
         ctx.fill();
       }
 
       // Subtle vignette overlay
       const vignetteGradient = ctx.createRadialGradient(
         centerX, centerY, 0,
         centerX, centerY, maxRadius * 1.2
       );
       vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
       vignetteGradient.addColorStop(0.6, "rgba(0, 0, 0, 0)");
       vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.4)");
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