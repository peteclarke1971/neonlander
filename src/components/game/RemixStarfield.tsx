// Rich twinkling starfield with shooting stars for Asteroids REMIX
import React, { useRef, useEffect } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
  brightness: number;
  twinkleSpeed: number;
  twinklePhase: number;
  size: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  brightness: number;
}

interface RemixStarfieldProps {
  scrollY: number;
  scrollSpeed: number;
  width: number;
  height: number;
}

export const RemixStarfield: React.FC<RemixStarfieldProps> = ({
  scrollY,
  scrollSpeed,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const lastSpawnRef = useRef<number>(0);

  // Initialize stars
  useEffect(() => {
    const stars: Star[] = [];
    const colors = ["#ffffff", "#ccddff", "#ffeecc", "#ffccdd", "#ccffdd", "#ddccff"];
    
    // Create 400 stars for rich density
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: Math.random() * width * 2, // Extended field
        y: Math.random() * height * 3, // Tall field for scrolling
        z: Math.random() * 3 + 1, // Depth layers 1-4
        brightness: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 2 + Math.random() * 4,
        twinklePhase: Math.random() * Math.PI * 2,
        size: 0.5 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    
    starsRef.current = stars;
  }, [width, height]);

  // Render starfield
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = "#000008";
      ctx.fillRect(0, 0, width, height);

      const time = Date.now() * 0.001;

      // Render stars with parallax scrolling
      for (const star of starsRef.current) {
        // Parallax scroll based on depth
        const parallaxSpeed = scrollSpeed / star.z;
        const starY = (star.y + scrollY * parallaxSpeed) % (height + 100) - 50;
        
        // Skip if off screen
        if (starY < -10 || starY > height + 10) continue;

        // Twinkling effect
        const twinkle = 0.5 + 0.5 * Math.sin(star.twinklePhase + time * star.twinkleSpeed);
        const alpha = star.brightness * twinkle;

        // Star position with slight wrap
        const starX = star.x % (width + 100);

        // Draw star with glow effect
        ctx.save();
        ctx.globalAlpha = alpha;

        // Main star
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(starX, starY, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect for brighter stars
        if (star.brightness > 0.6) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.fillStyle = star.color;
          ctx.beginPath();
          ctx.arc(starX, starY, star.size * 3, 0, Math.PI * 2);
          ctx.fill();

          // Cross sparkle for very bright stars
          if (star.brightness > 0.8 && twinkle > 0.8) {
            ctx.globalAlpha = alpha * 0.5;
            ctx.strokeStyle = star.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(starX - star.size * 4, starY);
            ctx.lineTo(starX + star.size * 4, starY);
            ctx.moveTo(starX, starY - star.size * 4);
            ctx.lineTo(starX, starY + star.size * 4);
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // Spawn shooting stars occasionally
      if (time - lastSpawnRef.current > 2 + Math.random() * 4) {
        if (Math.random() < 0.7) { // 70% chance
          shootingStarsRef.current.push({
            x: -20 + Math.random() * (width + 40),
            y: -20,
            vx: (Math.random() - 0.5) * 200,
            vy: 300 + Math.random() * 200,
            life: 1.5 + Math.random() * 1.0,
            maxLife: 1.5 + Math.random() * 1.0,
            brightness: 0.8 + Math.random() * 0.2
          });
        }
        lastSpawnRef.current = time;
      }

      // Update and render shooting stars
      const dt = 1/60; // Assume 60fps
      for (let i = shootingStarsRef.current.length - 1; i >= 0; i--) {
        const star = shootingStarsRef.current[i];
        
        // Update position
        star.x += star.vx * dt;
        star.y += star.vy * dt;
        star.life -= dt;

        // Remove if expired or off screen
        if (star.life <= 0 || star.y > height + 50) {
          shootingStarsRef.current.splice(i, 1);
          continue;
        }

        // Render shooting star trail
        const alpha = (star.life / star.maxLife) * star.brightness;
        const trailLength = 80;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Trail gradient
        const gradient = ctx.createLinearGradient(
          star.x,
          star.y,
          star.x - star.vx * 0.1,
          star.y - star.vy * 0.1
        );
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.5, "#aaccff");
        gradient.addColorStop(1, "transparent");

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        
        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(
          star.x - (star.vx / Math.sqrt(star.vx * star.vx + star.vy * star.vy)) * trailLength,
          star.y - (star.vy / Math.sqrt(star.vx * star.vx + star.vy * star.vy)) * trailLength
        );
        ctx.stroke();

        // Bright head
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Glow around head
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = "#aaccff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    };

    render();
  }, [scrollY, scrollSpeed, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: -1,
        imageRendering: "pixelated"
      }}
    />
  );
};