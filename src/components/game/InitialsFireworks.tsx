import React, { useEffect, useRef, useState } from "react";
import { getInitialsPositions, ParticleTarget } from "./utils/letterBitmaps";

interface InitialsFireworksProps {
  initials: string;
  neonColor: string;
  onComplete: () => void;
  onSkip: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  life: number;
  inPosition: boolean;
}

export const InitialsFireworks: React.FC<InitialsFireworksProps> = ({
  initials,
  neonColor,
  onComplete,
  onSkip
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [skipped, setSkipped] = useState(false);

  // Handle skip input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
        setSkipped(true);
        onSkip();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSkip]);

  // Gamepad skip
  useEffect(() => {
    const checkGamepad = () => {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp && (gp.buttons[0]?.pressed || gp.buttons[1]?.pressed)) {
          setSkipped(true);
          onSkip();
          return;
        }
      }
    };
    const interval = setInterval(checkGamepad, 100);
    return () => clearInterval(interval);
  }, [onSkip]);

  // Initialize particles and animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Calculate target positions for letters
    const dotSize = Math.max(8, Math.min(16, width / 80)); // Responsive dot size
    const letterSpacing = dotSize * 2;
    const targets = getInitialsPositions(initials, width / 2, height / 2, dotSize, letterSpacing);

    // Create particles
    const particles: Particle[] = targets.map((target, i) => {
      const startX = Math.random() * width;
      const startY = height + 50;
      return {
        id: i,
        x: startX,
        y: startY,
        targetX: target.x,
        targetY: target.y,
        vx: 0,
        vy: 0,
        life: 1.0,
        inPosition: false
      };
    });

    particlesRef.current = particles;
    startTimeRef.current = performance.now();

    // Animation loop
    const animate = (currentTime: number) => {
      if (skipped) return;

      const elapsed = currentTime - startTimeRef.current;
      const duration = 3500; // Total duration in ms
      const launchDuration = 800; // Launch phase
      const holdDuration = 2200; // Hold in formation
      const fadeDuration = 500; // Fade out

      ctx.clearRect(0, 0, width, height);

      // Phase 1: Launch (0-800ms)
      if (elapsed < launchDuration) {
        const progress = elapsed / launchDuration;
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        particles.forEach(p => {
          // Move toward target
          p.x = p.x + (p.targetX - p.x) * easeProgress * 0.15;
          p.y = p.y + (p.targetY - p.y) * easeProgress * 0.15;

          // Check if in position
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 5) {
            p.inPosition = true;
          }
        });
      }
      // Phase 2: Hold formation (800-3000ms)
      else if (elapsed < launchDuration + holdDuration) {
        particles.forEach(p => {
          // Snap to target
          p.x = p.targetX;
          p.y = p.targetY;
          p.inPosition = true;
        });
      }
      // Phase 3: Fade out (3000-3500ms)
      else if (elapsed < duration) {
        const fadeProgress = (elapsed - launchDuration - holdDuration) / fadeDuration;
        particles.forEach(p => {
          p.x = p.targetX;
          p.y = p.targetY;
          p.life = 1 - fadeProgress;
        });
      }
      // Complete
      else {
        cancelAnimationFrame(animationRef.current);
        onComplete();
        return;
      }

      // Render particles
      ctx.shadowBlur = 15;
      ctx.shadowColor = neonColor;

      particles.forEach(p => {
        // Pulsing effect during hold phase
        let pulseOpacity = p.life;
        if (elapsed >= launchDuration && elapsed < launchDuration + holdDuration) {
          const pulseTime = (elapsed - launchDuration) / 500;
          pulseOpacity *= 0.7 + 0.3 * Math.sin(pulseTime * Math.PI * 2);
        }

        ctx.globalAlpha = pulseOpacity;
        ctx.fillStyle = neonColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1.0;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [initials, neonColor, onComplete, skipped]);

  if (skipped) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute bottom-8 text-sm text-muted-foreground/60 animate-pulse">
        Press W, Space, or ↑ to skip
      </div>
    </div>
  );
};
