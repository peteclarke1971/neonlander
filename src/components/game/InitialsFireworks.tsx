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

interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: boolean;
  shape: 'circle' | 'star' | 'diamond' | 'streak';
  rotation: number;
  rotationSpeed: number;
}

type ExplosionType = 'starburst' | 'spiral' | 'willow' | 'chrysanthemum' | 'sparkle';

const selectExplosionType = (): ExplosionType => {
  const rand = Math.random();
  if (rand < 0.4) return 'starburst';
  if (rand < 0.6) return 'spiral';
  if (rand < 0.8) return 'willow';
  if (rand < 0.9) return 'chrysanthemum';
  return 'sparkle';
};

const createExplosion = (
  x: number,
  y: number,
  type: ExplosionType,
  neonColor: string
): ExplosionParticle[] => {
  const particles: ExplosionParticle[] = [];
  const shapes: ExplosionParticle['shape'][] = ['circle', 'star', 'diamond', 'streak'];
  
  switch (type) {
    case 'starburst': {
      const count = 12 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 2 + Math.random() * 2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          color: Math.random() > 0.3 ? neonColor : '#ffffff',
          size: 2 + Math.random() * 2,
          gravity: true,
          shape: 'circle',
          rotation: 0,
          rotationSpeed: 0
        });
      }
      break;
    }
    case 'spiral': {
      const count = 10;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 1.5 + Math.random() * 1.5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          color: neonColor,
          size: 2 + Math.random(),
          gravity: true,
          shape: 'diamond',
          rotation: angle,
          rotationSpeed: 0.1
        });
      }
      break;
    }
    case 'willow': {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 3;
        const speed = 3 + Math.random() * 2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          color: neonColor,
          size: 2 + Math.random() * 2,
          gravity: true,
          shape: 'streak',
          rotation: angle,
          rotationSpeed: 0.05
        });
      }
      break;
    }
    case 'chrysanthemum': {
      // Multi-layer burst
      [0.6, 1.0, 1.4].forEach((layer) => {
        const count = 8;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count;
          const speed = 1.5 * layer;
          particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: 1,
            color: neonColor,
            size: 2,
            gravity: true,
            shape: Math.random() > 0.5 ? 'circle' : 'diamond',
            rotation: 0,
            rotationSpeed: 0.05
          });
        }
      });
      break;
    }
    case 'sparkle': {
      const count = 6;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 1 + Math.random();
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          color: Math.random() > 0.5 ? neonColor : '#ffffff',
          size: 1.5 + Math.random(),
          gravity: false,
          shape: 'star',
          rotation: 0,
          rotationSpeed: 0.15
        });
      }
      break;
    }
  }
  
  return particles;
};

export const InitialsFireworks: React.FC<InitialsFireworksProps> = ({
  initials,
  neonColor,
  onComplete,
  onSkip
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const explosionParticlesRef = useRef<ExplosionParticle[]>([]);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const explosionTriggeredRef = useRef<boolean>(false);
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
    explosionParticlesRef.current = [];
    explosionTriggeredRef.current = false;
    startTimeRef.current = performance.now();

    // Animation loop
    const animate = (currentTime: number) => {
      if (skipped) return;

      const elapsed = currentTime - startTimeRef.current;
      const duration = 4000; // Total duration in ms
      const launchDuration = 800; // Launch phase
      const holdDuration = 400; // Hold in formation
      const explosionStart = launchDuration + holdDuration; // 1200ms
      const explosionDuration = 2300; // Explosion phase

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
      // Phase 2: Hold formation (800-1200ms)
      else if (elapsed < explosionStart) {
        particles.forEach(p => {
          // Snap to target
          p.x = p.targetX;
          p.y = p.targetY;
          p.inPosition = true;
        });
      }
      // Phase 3: Explosion (1200-3500ms)
      else if (elapsed < explosionStart + explosionDuration) {
        // Trigger explosions once at 1200ms
        if (!explosionTriggeredRef.current) {
          explosionTriggeredRef.current = true;
          particles.forEach(p => {
            if (p.inPosition) {
              const explosionType = selectExplosionType();
              const newExplosions = createExplosion(p.targetX, p.targetY, explosionType, neonColor);
              explosionParticlesRef.current.push(...newExplosions);
              p.life = 0; // Hide letter particle
            }
          });
        }

        // Update explosion particles
        const explosionParticles = explosionParticlesRef.current;
        for (let i = explosionParticles.length - 1; i >= 0; i--) {
          const p = explosionParticles[i];
          
          // Physics
          p.x += p.vx;
          p.y += p.vy;
          if (p.gravity) {
            p.vy += 0.08; // Gravity
          }
          p.vx *= 0.99; // Air resistance
          p.vy *= 0.99;
          p.rotation += p.rotationSpeed;
          
          // Life decay
          p.life -= 0.015;
          
          // Remove dead particles
          if (p.life <= 0) {
            explosionParticles.splice(i, 1);
          }
        }
      }
      // Complete
      else {
        cancelAnimationFrame(animationRef.current);
        onComplete();
        return;
      }

      // Render letter formation particles
      ctx.shadowBlur = 15;
      ctx.shadowColor = neonColor;

      particles.forEach(p => {
        if (p.life <= 0) return;
        
        // Pulsing effect during hold phase
        let pulseOpacity = p.life;
        if (elapsed >= launchDuration && elapsed < explosionStart) {
          const pulseTime = (elapsed - launchDuration) / 500;
          pulseOpacity *= 0.7 + 0.3 * Math.sin(pulseTime * Math.PI * 2);
        }

        ctx.globalAlpha = pulseOpacity;
        ctx.fillStyle = neonColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render explosion particles
      const explosionParticles = explosionParticlesRef.current;
      explosionParticles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        
        // Draw based on shape
        switch (p.shape) {
          case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'star':
            // 5-point star
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
              const r = i % 2 === 0 ? p.size : p.size / 2;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            break;
          case 'diamond':
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.lineTo(p.size, 0);
            ctx.lineTo(0, p.size);
            ctx.lineTo(-p.size, 0);
            ctx.closePath();
            ctx.fill();
            break;
          case 'streak':
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 2, p.size, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        
        ctx.restore();
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
