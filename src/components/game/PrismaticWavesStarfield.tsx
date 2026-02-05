 import React, { useRef, useEffect } from "react";
 import { loadStarfieldConfig, NEON_COLORS, lerpColor, StarfieldConfig } from "@/lib/starfieldConfig";
 
 interface WaveStar {
   angle: number;      // Radial angle from center
   baseRadius: number; // Base radial distance (0-1)
   z: number;          // Depth (0.05 to 1.5)
   zSpeed: number;     // Speed toward viewer
   frequency: number;
   amplitude: number;
   phase: number;
   layer: number;
   size: number;
   brightness: number;
   prevX: number;
   prevY: number;
 }
 
 interface PrismaticWavesStarfieldProps {
   starCount?: number;
 }
 
 export const PrismaticWavesStarfield: React.FC<PrismaticWavesStarfieldProps> = ({
   starCount = 300,
 }) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const rafRef = useRef<number>(0);
   const starsRef = useRef<WaveStar[]>([]);
   const startTimeRef = useRef<number>(0);
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
     configRef.current = loadStarfieldConfig();
 
     // Initialize stars with Z-axis depth
     const initStars = (config: StarfieldConfig) => {
       const count = Math.floor(starCount * config.density);
       starsRef.current = [];
       for (let i = 0; i < count; i++) {
         const layer = 1 + Math.floor(Math.random() * 3);
         starsRef.current.push({
           angle: Math.random() * Math.PI * 2,
           baseRadius: 0.1 + Math.random() * 0.7,
           z: NEAR + Math.random() * (FAR - NEAR),
           zSpeed: (0.12 + Math.random() * 0.2) * layer * 0.4,
           frequency: 3 + Math.random() * 8,
           amplitude: 0.02 + Math.random() * 0.08 * layer,
           phase: Math.random() * Math.PI * 2,
           layer,
           size: (0.8 + Math.random() * 1.5) * (layer * 0.5 + 0.5),
           brightness: 0.6 + Math.random() * 0.4,
           prevX: 0,
           prevY: 0,
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
       const colorSpeed = config.colorCycle ? 15 * config.colorSpeed : 0;
       const colorShift = elapsed * colorSpeed;
 
       // Clear with dark background
       ctx.fillStyle = "hsl(222, 47%, 5%)";
       ctx.fillRect(0, 0, w, h);
 
       // Central bloom effect
       if (config.bloom > 0.1) {
         const bloomRadius = 100 * config.bloom;
         const hueShift = config.neonHue - 280;
         const bloomHue = ((colorShift * 0.5) + hueShift + 280 + 360) % 360;
         const bloomGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, bloomRadius);
         bloomGradient.addColorStop(0, `hsla(${bloomHue}, 80%, 60%, ${0.12 * config.bloom})`);
         bloomGradient.addColorStop(0.5, `hsla(${bloomHue}, 80%, 50%, ${0.06 * config.bloom})`);
         bloomGradient.addColorStop(1, `hsla(${bloomHue}, 80%, 50%, 0)`);
         ctx.beginPath();
         ctx.arc(centerX, centerY, bloomRadius, 0, Math.PI * 2);
         ctx.fillStyle = bloomGradient;
         ctx.fill();
       }
 
       // Sort stars by z (far first)
       const stars = starsRef.current;
       const sortedStars = [...stars].sort((a, b) => b.z - a.z);
 
       for (let i = 0; i < sortedStars.length; i++) {
         const star = sortedStars[i];
 
         // Store previous screen position
         const prevX = star.prevX;
         const prevY = star.prevY;
 
         // Move toward viewer
         star.z -= star.zSpeed * config.speed * dt;
 
         // Respawn when too close
         if (star.z < NEAR) {
           star.z = FAR;
           star.angle = Math.random() * Math.PI * 2;
           star.baseRadius = 0.1 + Math.random() * 0.7;
           star.prevX = centerX;
           star.prevY = centerY;
           continue;
         }
 
         // Calculate 3D position with wave motion
         // Radial direction from center
         const radialX = Math.cos(star.angle);
         const radialY = Math.sin(star.angle);
 
         // Wave offset perpendicular to radial direction
         const wavePhase = star.z * star.frequency + star.phase + elapsed * config.speed * 0.5;
         const waveOffset = Math.sin(wavePhase) * star.amplitude;
         const perpX = -radialY * waveOffset;
         const perpY = radialX * waveOffset;
 
         // Final 3D position with wave
         const x3d = radialX * star.baseRadius + perpX;
         const y3d = radialY * star.baseRadius + perpY;
 
         // Perspective projection
         const screenX = centerX + (x3d / star.z) * FOCAL_LENGTH;
         const screenY = centerY + (y3d / star.z) * FOCAL_LENGTH;
 
         // Store for next frame
         star.prevX = screenX;
         star.prevY = screenY;
 
         // Skip if off-screen
         if (screenX < -50 || screenX > w + 50 || screenY < -50 || screenY > h + 50) continue;
 
         // Calculate prismatic color based on screen position
         const screenAngle = Math.atan2(screenY - centerY, screenX - centerX);
         const hueShift = config.neonHue - 280;
          const hue = config.singleColor 
            ? config.neonHue
            : ((screenAngle / (Math.PI * 2) + 0.5) * 360 + colorShift + hueShift + 360) % 360;
         const saturation = 90 + Math.sin(elapsed * 0.5 + i) * 10;
         const depthScale = Math.min(2, 1 / star.z);
         const lightness = 55 + star.layer * 8 + depthScale * 5;
 
         // Layer-based alpha
         const layerAlpha = (0.4 + (star.layer / 3) * 0.5) * depthScale;
         const baseAlpha = star.brightness * layerAlpha;
          const displaySize = star.size * depthScale * 0.8 * config.particleSize;
 
         // Draw comet trail toward center
         if (config.trail > 0.1 && prevX !== 0 && prevY !== 0) {
           const dx = centerX - screenX;
           const dy = centerY - screenY;
           const dist = Math.sqrt(dx * dx + dy * dy);
           const trailLen = (30 + star.zSpeed * 50) * config.trail * depthScale;
           
           if (dist > 5 && trailLen > 3) {
             const trailEndX = screenX + (dx / dist) * Math.min(trailLen, dist * 0.4);
             const trailEndY = screenY + (dy / dist) * Math.min(trailLen, dist * 0.4);
 
             const trailGradient = ctx.createLinearGradient(trailEndX, trailEndY, screenX, screenY);
             trailGradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
             trailGradient.addColorStop(0.4, `hsla(${hue}, ${saturation}%, ${lightness}%, ${baseAlpha * 0.3})`);
             trailGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, ${baseAlpha * 0.6})`);
 
             ctx.beginPath();
             ctx.moveTo(trailEndX, trailEndY);
             ctx.lineTo(screenX, screenY);
             ctx.strokeStyle = trailGradient;
             ctx.lineWidth = displaySize * 1.5;
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
              ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${blurAlpha})`;
              ctx.fill();
            }
          }
 
         // Draw star glow
         const glowRadius = displaySize * 3 * config.glow;
         if (glowRadius > 1) {
           const glowGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
           glowGradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness + 20}%, ${baseAlpha})`);
           glowGradient.addColorStop(0.3, `hsla(${hue}, ${saturation}%, ${lightness}%, ${baseAlpha * 0.5})`);
           glowGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
 
           ctx.beginPath();
           ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
           ctx.fillStyle = glowGradient;
           ctx.fill();
         }
 
         // Draw bright core
         ctx.beginPath();
         ctx.arc(screenX, screenY, displaySize * 0.5, 0, Math.PI * 2);
         ctx.fillStyle = `hsla(${hue}, ${saturation * 0.3}%, ${Math.min(100, lightness + 35)}%, ${baseAlpha})`;
         ctx.fill();
       }
 
       // Vignette
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
       className="prismatic-waves-starfield-canvas"
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
 
 export default PrismaticWavesStarfield;