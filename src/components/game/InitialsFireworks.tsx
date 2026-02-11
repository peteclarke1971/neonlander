import React, { useEffect, useRef, useState } from "react";
import { getInitialsPositions, ParticleTarget } from "./utils/letterBitmaps";
import { isDesktopDevice } from "@/lib/deviceDetection";
import { gateThrustUntilRelease } from "@/hooks/use-gamepad";

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
  trail: Array<{x: number, y: number}>;
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
  isRocket: boolean;
  rocketExplodeTime: number;
  hasExploded: boolean;
  canReExplode: boolean;
  reExplodeCount: number;
  reExplodeThreshold: number;
  generation: number;
}

type ExplosionType = 'starburst' | 'spiral' | 'willow' | 'chrysanthemum' | 'sparkle';

interface FireworksQuality {
  particleMultiplier: number;
  shadowBlur: number;
  enableTrails: boolean;
  enableSecondaryExplosions: boolean;
  lifeDecayMultiplier: number;
  enableInitialTrails: boolean;
  initialTrailLength: number;
}

const QUALITY_TIERS: Record<'high' | 'medium' | 'low', FireworksQuality> = {
  high: {
    particleMultiplier: 0.6,
    shadowBlur: 8,
    enableTrails: true,
    enableSecondaryExplosions: true,
    lifeDecayMultiplier: 1.3,
    enableInitialTrails: true,
    initialTrailLength: 7,
  },
  medium: {
    particleMultiplier: 0.35,
    shadowBlur: 5,
    enableTrails: false,
    enableSecondaryExplosions: true,
    lifeDecayMultiplier: 1.5,
    enableInitialTrails: true,
    initialTrailLength: 5,
  },
  low: {
    particleMultiplier: 0.18,
    shadowBlur: 3,
    enableTrails: false,
    enableSecondaryExplosions: false,
    lifeDecayMultiplier: 2.0,
    enableInitialTrails: false,
    initialTrailLength: 0,
  },
};

// Physics tuned to match main FireworksDisplay for graceful trajectories
const GRAVITY = 0.03;
const AIR_RESISTANCE = 0.998;

const selectExplosionType = (): ExplosionType => {
  const rand = Math.random();
  if (rand < 0.25) return 'starburst';
  if (rand < 0.45) return 'spiral';
  if (rand < 0.65) return 'willow';
  if (rand < 0.85) return 'chrysanthemum';
  return 'sparkle';
};

const getRandomFireworkColor = (baseColor: string): string => {
  const rand = Math.random();
  if (rand < 0.5) return baseColor;
  if (rand < 0.7) return '#ffffff';
  if (rand < 0.85) return '#ffaa00';
  return '#ff00ff';
};

const createSparkleExplosion = (
  x: number, 
  y: number, 
  neonColor: string, 
  generation: number
): ExplosionParticle[] => {
  const particles: ExplosionParticle[] = [];
  const count = Math.max(6, 10 - generation * 2);
  
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const speed = (2 + Math.random() * 2) * (1 - generation * 0.2);
    
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 - generation * 0.12,
      maxLife: 0.5 - generation * 0.12,
      color: getRandomFireworkColor(neonColor),
      size: 0.8 + Math.random() * 0.7,
      gravity: true,
      shape: Math.random() > 0.5 ? 'circle' : 'star',
      rotation: 0,
      rotationSpeed: 0.3,
      isRocket: false,
      rocketExplodeTime: 0,
      hasExploded: false,
      canReExplode: generation < 1,
      reExplodeCount: 1 - generation,
      reExplodeThreshold: 0.3 + Math.random() * 0.2,
      generation: generation,
    });
  }
  
  return particles;
};

const createExplosion = (
  x: number,
  y: number,
  type: ExplosionType,
  neonColor: string,
  quality: FireworksQuality
): ExplosionParticle[] => {
  const particles: ExplosionParticle[] = [];
  
  // Add size variance to entire explosion
  const explosionScale = 0.6 + Math.random() * 0.8; // 0.6x to 1.4x
  
  switch (type) {
    case 'starburst': {
      const baseCount = 36 + Math.floor(Math.random() * 10);
      const count = Math.floor(baseCount * quality.particleMultiplier * explosionScale);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = (2.5 + Math.random() * 3) * (0.8 + Math.random() * 0.4) * explosionScale;
        const isRocket = Math.random() < 0.15;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.5,
          maxLife: 1,
          color: getRandomFireworkColor(neonColor),
          size: (1.8 + Math.random() * 1.8) * explosionScale, // 60% smaller
          gravity: true,
          shape: 'circle',
          rotation: 0,
          rotationSpeed: 0,
          isRocket,
          rocketExplodeTime: 0.4 + Math.random() * 0.3,
          hasExploded: false,
          canReExplode: Math.random() < 0.15,
          reExplodeCount: Math.random() < 0.5 ? 1 : 2,
          reExplodeThreshold: 0.4 + Math.random() * 0.2,
          generation: 0,
        });
      }
      break;
    }
    case 'spiral': {
      const baseCount = 30;
      const count = Math.floor(baseCount * quality.particleMultiplier * explosionScale);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = (2 + Math.random() * 2.5) * (0.8 + Math.random() * 0.4) * explosionScale;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.5,
          maxLife: 1,
          color: getRandomFireworkColor(neonColor),
          size: (1.8 + Math.random() * 1.2) * explosionScale, // 60% smaller
          gravity: true,
          shape: 'diamond',
          rotation: angle,
          rotationSpeed: 0.1,
          isRocket: false,
          rocketExplodeTime: 0,
          hasExploded: false,
          canReExplode: Math.random() < 0.15,
          reExplodeCount: Math.random() < 0.5 ? 1 : 2,
          reExplodeThreshold: 0.4 + Math.random() * 0.2,
          generation: 0,
        });
      }
      break;
    }
    case 'willow': {
      const baseCount = 24;
      const count = Math.floor(baseCount * quality.particleMultiplier * explosionScale);
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 3;
        const speed = (3 + Math.random() * 3) * (0.8 + Math.random() * 0.4) * explosionScale;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.5,
          maxLife: 1,
          color: getRandomFireworkColor(neonColor),
          size: (1.8 + Math.random() * 1.8) * explosionScale, // 60% smaller
          gravity: true,
          shape: 'streak',
          rotation: angle,
          rotationSpeed: 0,
          isRocket: false,
          rocketExplodeTime: 0,
          hasExploded: false,
          canReExplode: Math.random() < 0.15,
          reExplodeCount: Math.random() < 0.5 ? 1 : 2,
          reExplodeThreshold: 0.4 + Math.random() * 0.2,
          generation: 0,
        });
      }
      break;
    }
    case 'chrysanthemum': {
      // Multi-layer burst
      [0.6, 1.0, 1.4, 1.8].forEach((layer) => {
        const baseCount = 18;
        const count = Math.floor(baseCount * quality.particleMultiplier * explosionScale);
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
          const speed = (2 * layer) * (0.8 + Math.random() * 0.4) * explosionScale;
          const isRocket = Math.random() < 0.1;
          particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.5,
            maxLife: 1,
            color: getRandomFireworkColor(neonColor),
            size: (1.8 + Math.random() * 0.9) * explosionScale, // 60% smaller
            gravity: true,
            shape: Math.random() > 0.5 ? 'circle' : 'diamond',
            rotation: 0,
            rotationSpeed: 0.05,
            isRocket,
            rocketExplodeTime: 0.5 + Math.random() * 0.2,
            hasExploded: false,
            canReExplode: Math.random() < 0.15,
            reExplodeCount: Math.random() < 0.5 ? 1 : 2,
            reExplodeThreshold: 0.4 + Math.random() * 0.2,
            generation: 0,
          });
        }
      });
      break;
    }
    case 'sparkle': {
      const baseCount = 18;
      const count = Math.floor(baseCount * quality.particleMultiplier * explosionScale);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = (1.5 + Math.random() * 1.5) * (0.8 + Math.random() * 0.4) * explosionScale;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.5,
          maxLife: 1,
          color: getRandomFireworkColor(neonColor),
          size: (1.5 + Math.random() * 0.9) * explosionScale, // 60% smaller
          gravity: false,
          shape: 'star',
          rotation: 0,
          rotationSpeed: 0.2,
          isRocket: false,
          rocketExplodeTime: 0,
          hasExploded: false,
          canReExplode: Math.random() < 0.15,
          reExplodeCount: Math.random() < 0.5 ? 1 : 2,
          reExplodeThreshold: 0.4 + Math.random() * 0.2,
          generation: 0,
        });
      }
      break;
    }
  }
  
  return particles;
};

const createSecondaryExplosion = (x: number, y: number, type: 'mini-starburst' | 'mini-sparkle', neonColor: string): ExplosionParticle[] => {
  const particles: ExplosionParticle[] = [];
  const count = 4 + Math.floor(Math.random() * 4);
  
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = (2 + Math.random() * 3) * 1.5;
    
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.8,
      maxLife: 0.8,
      color: getRandomFireworkColor(neonColor),
      size: 1.2 + Math.random() * 0.8, // 60% smaller
      gravity: type === 'mini-starburst',
      shape: type === 'mini-starburst' ? 'circle' : 'star',
      rotation: 0,
      rotationSpeed: type === 'mini-sparkle' ? 0.3 : 0,
      isRocket: false,
      rocketExplodeTime: 0,
      hasExploded: false,
      canReExplode: false,
      reExplodeCount: 0,
      reExplodeThreshold: 0,
      generation: 1,
    });
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
  const fpsHistoryRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const frameSkipCountRef = useRef<number>(0);
  const qualityRef = useRef<FireworksQuality>(
    QUALITY_TIERS.medium // Start with medium quality for all devices
  );
  const [skipped, setSkipped] = useState(false);

  // Handle skip input - gate thrust to prevent restart bug
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore key repeats to prevent held keys from triggering multiple skips
      if (e.repeat) return;
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
        setSkipped(true);
        gateThrustUntilRelease(); // Prevent button press from carrying over
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
          gateThrustUntilRelease(); // Prevent button press from carrying over
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
    const dotSize = Math.max(16, Math.min(32, width / 40)); // 2x larger letters // Responsive dot size
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
        inPosition: false,
        trail: []
      };
    });

    particlesRef.current = particles;
    explosionParticlesRef.current = [];
    explosionTriggeredRef.current = false;
    startTimeRef.current = performance.now();

    // Animation loop
    const animate = (currentTime: number) => {
      if (skipped) return;

      // FPS monitoring and quality adjustment
      if (lastFrameTimeRef.current > 0) {
        const frameDelta = currentTime - lastFrameTimeRef.current;
        const fps = 1000 / frameDelta;
        fpsHistoryRef.current.push(fps);
        if (fpsHistoryRef.current.length > 30) fpsHistoryRef.current.shift();
        
        // Adjust quality based on average FPS
        if (fpsHistoryRef.current.length >= 20) {
          const avgFps = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length;
          
          if (avgFps < 45 && qualityRef.current === QUALITY_TIERS.high) {
            qualityRef.current = QUALITY_TIERS.medium;
            console.log('Downgraded to medium quality');
          } else if (avgFps < 35 && qualityRef.current === QUALITY_TIERS.medium) {
            qualityRef.current = QUALITY_TIERS.low;
            console.log('Downgraded to low quality');
          }
        }
        
        // Emergency frame skip if FPS is critically low
        if (fps < 30) {
          frameSkipCountRef.current = (frameSkipCountRef.current + 1) % 2;
          if (frameSkipCountRef.current === 1) {
            animationRef.current = requestAnimationFrame(animate);
            return;
          }
        }
      }
      lastFrameTimeRef.current = currentTime;

      const elapsed = currentTime - startTimeRef.current;
      const quality = qualityRef.current;
      const duration = 6000; // Total duration in ms
      const launchDuration = 800; // Launch phase
      const holdDuration = 400; // Hold in formation
      const explosionStart = launchDuration + holdDuration; // 1200ms
      const explosionDuration = 4300; // Explosion phase

      ctx.clearRect(0, 0, width, height);

      // Phase 1: Launch (0-800ms)
      if (elapsed < launchDuration) {
        const progress = elapsed / launchDuration;
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        particles.forEach(p => {
          // Move toward target
          p.x = p.x + (p.targetX - p.x) * easeProgress * 0.15;
          p.y = p.y + (p.targetY - p.y) * easeProgress * 0.15;

          // Record trail position
          if (quality.enableInitialTrails) {
            p.trail.push({x: p.x, y: p.y});
            if (p.trail.length > quality.initialTrailLength) p.trail.shift();
          }

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
              const newExplosions = createExplosion(p.targetX, p.targetY, explosionType, neonColor, quality);
              explosionParticlesRef.current.push(...newExplosions);
              p.life = 0; // Hide letter particle
            }
          });
        }

        // Update explosion particles with optimized physics
        const explosionParticles = explosionParticlesRef.current;
        const lifeDecay = 0.01 * quality.lifeDecayMultiplier;
        
        // Mark-and-sweep instead of splice
        for (let i = 0; i < explosionParticles.length; i++) {
          const p = explosionParticles[i];
          
          if (p.life <= 0) continue; // Skip dead particles
          
          // Check for secondary explosions (quality-gated)
          if (quality.enableSecondaryExplosions && p.isRocket && !p.hasExploded && p.life < p.rocketExplodeTime) {
            p.hasExploded = true;
            const secondaryType = Math.random() > 0.5 ? 'mini-starburst' : 'mini-sparkle';
            const secondaryParticles = createSecondaryExplosion(p.x, p.y, secondaryType, neonColor);
            explosionParticlesRef.current.push(...secondaryParticles);
          }
          
          // Check for multi-stage sparkle explosions
          if (quality.enableSecondaryExplosions && p.canReExplode && p.reExplodeCount > 0 && p.life < p.reExplodeThreshold && !p.hasExploded) {
            p.hasExploded = true;
            p.canReExplode = false;
            const sparkles = createSparkleExplosion(p.x, p.y, neonColor, p.generation + 1);
            explosionParticlesRef.current.push(...sparkles);
            p.life = 0;
          }
          
          // Optimized physics - combined operations
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= AIR_RESISTANCE;
          p.vy = p.gravity ? (p.vy + GRAVITY) * AIR_RESISTANCE : p.vy * AIR_RESISTANCE;
          p.rotation += p.rotationSpeed;
          p.life -= lifeDecay;
        }
        
        // Periodic cleanup (every 3 frames)
        const frameCount = Math.floor(elapsed / 16);
        if (frameCount % 3 === 0) {
          explosionParticlesRef.current = explosionParticlesRef.current.filter(p => p.life > 0);
        }
      }
      // Complete
      else {
        cancelAnimationFrame(animationRef.current);
        onComplete();
        return;
      }

      // Render letter formation particles
      ctx.shadowBlur = quality.shadowBlur;
      ctx.shadowColor = neonColor;

      particles.forEach(p => {
        if (p.life <= 0) return;
        
        // Render trail first (behind particle)
        if (elapsed < launchDuration && quality.enableInitialTrails && p.trail.length > 0) {
          p.trail.forEach((pos, i) => {
            const trailAlpha = (i / p.trail.length) * 0.6 * p.life;
            const trailSize = 3 * (i / p.trail.length);
            ctx.globalAlpha = trailAlpha;
            ctx.fillStyle = neonColor;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, trailSize, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        
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

      // Render explosion particles with batch rendering
      const explosionParticles = explosionParticlesRef.current;
      
      // Viewport culling margin
      const margin = 100;
      
      // Low quality: batch-fill all circles
      if (quality.particleMultiplier < 0.5) {
        ctx.shadowBlur = quality.shadowBlur;
        ctx.shadowColor = neonColor;
        ctx.fillStyle = neonColor;
        
        // Batch-render all particles as circles in one path
        ctx.beginPath();
        explosionParticles.forEach(p => {
          if (p.life > 0 && p.x >= -margin && p.x <= width + margin && p.y >= -margin && p.y <= height + margin) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.moveTo(p.x + p.size, p.y);
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          }
        });
        ctx.fill();
      } else {
        // Medium/High quality: full shape rendering with optimizations
        
        // Group particles by shape for batch rendering
        const particlesByShape: Record<string, ExplosionParticle[]> = {
          circle: [],
          star: [],
          diamond: [],
          streak: []
        };
        
        explosionParticles.forEach(p => {
          // Cull particles outside viewport
          if (p.life <= 0 || p.x < -margin || p.x > width + margin || p.y < -margin || p.y > height + margin) {
            return;
          }
          particlesByShape[p.shape].push(p);
        });
        
        // Render each shape group with shared state
        Object.entries(particlesByShape).forEach(([shape, shapeParticles]) => {
          if (shapeParticles.length === 0) return;
          
          // Set shadow state once per shape group (fixed leak)
          ctx.shadowBlur = shape === 'streak' ? quality.shadowBlur * 1.3 : quality.shadowBlur * 0.7;
          ctx.shadowColor = neonColor; // Single color, not per-particle
          
          shapeParticles.forEach(p => {
            const alpha = Math.max(0, p.life);
            
            // Render trails only on high quality for streak particles (reduced to 2 segments)
            if (p.shape === 'streak' && quality.enableTrails) {
              const trailLength = 2; // Reduced from 3
              for (let t = 0; t < trailLength; t++) {
                const trailAlpha = (1 - t / trailLength) * 0.3;
                ctx.globalAlpha = alpha * trailAlpha;
                const trailX = p.x - p.vx * t * 2;
                const trailY = p.y - p.vy * t * 2;
                ctx.save();
                ctx.translate(trailX, trailY);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.8, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }
            }
            
            // Main particle rendering - NO save/restore for shapes
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            
            switch (p.shape) {
              case 'circle':
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;
              case 'star':
                // Render star without save/restore
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                  const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2 + p.rotation;
                  const r = i % 2 === 0 ? p.size : p.size / 2;
                  const x = p.x + Math.cos(angle) * r;
                  const y = p.y + Math.sin(angle) * r;
                  if (i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                break;
              case 'diamond':
                // Render diamond without save/restore
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - p.size);
                ctx.lineTo(p.x + p.size, p.y);
                ctx.lineTo(p.x, p.y + p.size);
                ctx.lineTo(p.x - p.size, p.y);
                ctx.closePath();
                ctx.fill();
                break;
              case 'streak':
                // Render streak as simple ellipse without save/restore
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.size * 2, p.size, p.rotation, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
          });
        });
      }

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
    </div>
  );
};
