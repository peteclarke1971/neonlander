 import React, { useRef, useEffect } from "react";
 
 interface WaveStar {
   x: number;
   baseY: number;
   frequency: number;
   amplitude: number;
   phase: number;
   speed: number;
   layer: number;
   size: number;
   brightness: number;
   // Trail positions
   prevX: number;
   prevY: number;
 }
 
 interface PrismaticWavesStarfieldProps {
   starCount?: number;
 }
 
 export const PrismaticWavesStarfield: React.FC<PrismaticWavesStarfieldProps> = ({
   starCount = 320,
 }) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const rafRef = useRef<number>(0);
   const starsRef = useRef<WaveStar[]>([]);
   const startTimeRef = useRef<number>(0);
 
   useEffect(() => {
     const canvas = canvasRef.current;
     if (!canvas) return;
 
     const ctx = canvas.getContext("2d", { alpha: false });
     if (!ctx) return;
 
     startTimeRef.current = performance.now();
 
     // Initialize stars across 3 parallax layers
     const initStars = (w: number, h: number) => {
       starsRef.current = [];
       for (let i = 0; i < starCount; i++) {
         const layer = 1 + Math.floor(Math.random() * 3); // 1-3 (back to front)
         const x = Math.random() * w;
         const baseY = Math.random() * h;
         starsRef.current.push({
           x,
           baseY,
           frequency: 0.003 + Math.random() * 0.008,
           amplitude: 20 + Math.random() * 60 * layer,
           phase: Math.random() * Math.PI * 2,
           speed: (30 + Math.random() * 50) * (layer * 0.7),
           layer,
           size: (0.8 + Math.random() * 1.5) * (layer * 0.5 + 0.5),
           brightness: 0.6 + Math.random() * 0.4,
           prevX: x,
           prevY: baseY,
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
       initStars(w, h);
     };
 
     resize();
     window.addEventListener("resize", resize);
 
     let lastTime = performance.now();
 
     const loop = (now: number) => {
       rafRef.current = requestAnimationFrame(loop);
 
       const dt = Math.min((now - lastTime) / 1000, 0.1);
       lastTime = now;
 
       const w = window.innerWidth;
       const h = window.innerHeight;
 
       // Global time for color shifting
       const elapsed = (now - startTimeRef.current) / 1000;
       const colorShift = elapsed * 15; // Hue shift over time
 
       // Clear with dark background
       ctx.fillStyle = "hsl(222, 47%, 5%)";
       ctx.fillRect(0, 0, w, h);
 
       // Draw subtle horizontal gradient bands (very low alpha)
       const bandCount = 5;
       for (let b = 0; b < bandCount; b++) {
         const bandY = (h / bandCount) * b + (elapsed * 10) % (h / bandCount);
         const bandHue = ((b * 60) + colorShift) % 360;
         const gradient = ctx.createLinearGradient(0, bandY - 40, 0, bandY + 40);
         gradient.addColorStop(0, `hsla(${bandHue}, 100%, 60%, 0)`);
         gradient.addColorStop(0.5, `hsla(${bandHue}, 100%, 60%, 0.03)`);
         gradient.addColorStop(1, `hsla(${bandHue}, 100%, 60%, 0)`);
         ctx.fillStyle = gradient;
         ctx.fillRect(0, bandY - 40, w, 80);
       }
 
       // Sort stars by layer for proper depth rendering
       const stars = starsRef.current;
       const sortedStars = [...stars].sort((a, b) => a.layer - b.layer);
 
       for (let i = 0; i < sortedStars.length; i++) {
         const star = sortedStars[i];
 
         // Store previous position for trail
         star.prevX = star.x;
         const prevWaveY = star.baseY + Math.sin(star.x * star.frequency + star.phase) * star.amplitude;
         star.prevY = prevWaveY;
 
         // Move horizontally
         star.x += star.speed * dt;
 
         // Calculate wave Y position
         const waveY = star.baseY + Math.sin(star.x * star.frequency + star.phase) * star.amplitude;
 
         // Wrap around when off-screen
         if (star.x > w + 50) {
           star.x = -50;
           star.baseY = Math.random() * h;
           star.prevX = star.x;
           star.prevY = star.baseY;
         }
 
         // Calculate prismatic color based on x position
         const hue = ((star.x / w) * 360 + colorShift) % 360;
         const saturation = 90 + Math.sin(elapsed * 0.5 + i) * 10;
         const lightness = 55 + star.layer * 8;
 
         // Layer-based alpha
         const layerAlpha = 0.4 + (star.layer / 3) * 0.5;
         const baseAlpha = star.brightness * layerAlpha;
 
         // Draw comet trail
         const trailLength = star.speed * 0.8;
         if (trailLength > 5) {
           const trailX = star.x - trailLength;
           const trailY = star.baseY + Math.sin(trailX * star.frequency + star.phase) * star.amplitude;
 
           // Create gradient along trail
           const trailGradient = ctx.createLinearGradient(trailX, trailY, star.x, waveY);
           trailGradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
           trailGradient.addColorStop(0.3, `hsla(${hue}, ${saturation}%, ${lightness}%, ${baseAlpha * 0.3})`);
           trailGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, ${baseAlpha * 0.6})`);
 
           ctx.beginPath();
           ctx.moveTo(trailX, trailY);
           ctx.lineTo(star.x, waveY);
           ctx.strokeStyle = trailGradient;
           ctx.lineWidth = star.size * 1.5;
           ctx.lineCap = "round";
           ctx.stroke();
         }
 
         // Draw star glow (using gradient instead of shadowBlur for iOS performance)
         const glowRadius = star.size * 4;
         const glowGradient = ctx.createRadialGradient(
           star.x, waveY, 0,
           star.x, waveY, glowRadius
         );
         glowGradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness + 20}%, ${baseAlpha})`);
         glowGradient.addColorStop(0.2, `hsla(${hue}, ${saturation}%, ${lightness}%, ${baseAlpha * 0.6})`);
         glowGradient.addColorStop(0.5, `hsla(${hue}, ${saturation}%, ${lightness}%, ${baseAlpha * 0.2})`);
         glowGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
 
         ctx.beginPath();
         ctx.arc(star.x, waveY, glowRadius, 0, Math.PI * 2);
         ctx.fillStyle = glowGradient;
         ctx.fill();
 
         // Draw bright core with white tint
         ctx.beginPath();
         ctx.arc(star.x, waveY, star.size * 0.6, 0, Math.PI * 2);
         ctx.fillStyle = `hsla(${hue}, ${saturation * 0.3}%, ${Math.min(100, lightness + 35)}%, ${baseAlpha})`;
         ctx.fill();
       }
 
       // Chromatic aberration effect at edges (very subtle)
       const aberrationStrength = 0.08;
       
       // Left edge - red tint
       const leftGradient = ctx.createLinearGradient(0, 0, w * 0.15, 0);
       leftGradient.addColorStop(0, `rgba(255, 100, 100, ${aberrationStrength})`);
       leftGradient.addColorStop(1, "rgba(255, 100, 100, 0)");
       ctx.fillStyle = leftGradient;
       ctx.fillRect(0, 0, w * 0.15, h);
 
       // Right edge - cyan tint
       const rightGradient = ctx.createLinearGradient(w * 0.85, 0, w, 0);
       rightGradient.addColorStop(0, "rgba(100, 255, 255, 0)");
       rightGradient.addColorStop(1, `rgba(100, 255, 255, ${aberrationStrength})`);
       ctx.fillStyle = rightGradient;
       ctx.fillRect(w * 0.85, 0, w * 0.15, h);
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