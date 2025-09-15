import React, { useEffect, useRef, useState, useCallback } from 'react';
import { anyGamepad } from '../../hooks/use-gamepad';

interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  secondaryColor?: string;
  type: 'launch' | 'burst' | 'glitter' | 'crackle' | 'comet' | 'secondary';
  shape: 'circle' | 'star' | 'diamond' | 'heart' | 'cross' | 'streak';
  size: number;
  gravity: boolean;
  rotation: number;
  rotationSpeed: number;
  glowSize: number;
  trail: Array<{x: number, y: number, alpha: number}>;
  colorTransition: boolean;
  magneticTarget?: {x: number, y: number};
  parentId?: string;
}

interface FireworksDisplayProps {
  landingType: 'regular' | 'moving' | '2x' | null;
  neonColor: string;
  onComplete: () => void;
  onSkip: () => void;
}

const FireworksDisplay: React.FC<FireworksDisplayProps> = ({
  landingType,
  neonColor,
  onComplete,
  onSkip
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [particles, setParticles] = useState<FireworkParticle[]>([]);
  const [startTime] = useState(Date.now());
  const animationRef = useRef<number>();
  const hasLaunched = useRef(false);
  const particleIdCounter = useRef(0);

  // Enhanced color schemes with gradients and transitions
  const getColors = useCallback(() => {
    switch (landingType) {
      case 'moving':
        return {
          primary: ['#FFD700', '#FFA500', '#FF8C00', '#FFFF00', '#FFB347'],
          secondary: ['#FF6B35', '#F7931E', '#FFD23F', '#06FFA5'],
          glitter: ['#FFFFFF', '#FFFACD', '#F0E68C']
        };
      case '2x':
        return {
          primary: ['#FF0000', '#00FF00', '#0088FF', '#FF00FF', '#FFFF00', '#00FFFF'],
          secondary: ['#FF4444', '#44FF44', '#4444FF', '#FF44FF', '#FFFF44', '#44FFFF'],
          glitter: ['#FFFFFF', '#FFB6C1', '#87CEEB', '#98FB98']
        };
      case 'regular':
      default:
        return {
          primary: [neonColor, neonColor, '#FFFFFF'],
          secondary: [neonColor, '#FFFFFF'],
          glitter: ['#FFFFFF', neonColor]
        };
    }
  }, [landingType, neonColor]);

  // Create spectacular launch with comet trail
  const createLaunch = useCallback((x: number, y: number, targetY: number, colors: any) => {
    const newParticles: FireworkParticle[] = [];
    
    // Main launch particle with comet effect
    const launchParticle: FireworkParticle = {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5, // Slight horizontal drift
      vy: -(targetY - y) / 50,
      life: 50,
      max: 50,
      color: colors.primary[0],
      secondaryColor: colors.secondary[0],
      type: 'comet',
      shape: 'streak',
      size: 3 + Math.random() * 2,
      gravity: false,
      rotation: 0,
      rotationSpeed: 0,
      glowSize: 8,
      trail: [],
      colorTransition: true,
      parentId: `launch_${particleIdCounter.current++}`
    };
    
    newParticles.push(launchParticle);
    return newParticles;
  }, []);

  // Create spectacular burst patterns
  const createBurst = useCallback((x: number, y: number, colors: any, pattern: string = 'starburst') => {
    const newParticles: FireworkParticle[] = [];
    const baseCount = landingType === '2x' ? 120 : landingType === 'moving' ? 100 : 80;
    
    const createParticle = (vx: number, vy: number, customProps: Partial<FireworkParticle> = {}) => {
      const shapes: FireworkParticle['shape'][] = ['circle', 'star', 'diamond', 'heart', 'cross'];
      const colorArray = Math.random() > 0.3 ? colors.primary : colors.secondary;
      
      return {
        x,
        y,
        vx: vx * (0.8 + Math.random() * 0.4), // Speed variation
        vy: vy * (0.8 + Math.random() * 0.4),
        life: 80 + Math.random() * 80,
        max: 80 + Math.random() * 80,
        color: colorArray[Math.floor(Math.random() * colorArray.length)],
        secondaryColor: colors.glitter[Math.floor(Math.random() * colors.glitter.length)],
        type: 'burst' as const,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        size: 1.5 + Math.random() * 3,
        gravity: true,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        glowSize: 2 + Math.random() * 4,
        trail: [],
        colorTransition: Math.random() > 0.7,
        parentId: `burst_${particleIdCounter.current++}`,
        ...customProps
      };
    };

    switch (pattern) {
      case 'spiral':
        for (let i = 0; i < baseCount; i++) {
          const angle = (i / baseCount) * Math.PI * 8; // Multiple spirals
          const radius = (i / baseCount) * 6;
          const vx = Math.cos(angle) * radius;
          const vy = Math.sin(angle) * radius;
          newParticles.push(createParticle(vx, vy));
        }
        break;
        
      case 'heart':
        for (let i = 0; i < baseCount; i++) {
          const t = (i / baseCount) * Math.PI * 2;
          const heartX = 16 * Math.pow(Math.sin(t), 3);
          const heartY = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
          newParticles.push(createParticle(heartX * 0.3, heartY * 0.3, { shape: 'heart', color: '#FF69B4' }));
        }
        break;
        
      case 'star':
        for (let i = 0; i < baseCount; i++) {
          const angle = (i / baseCount) * Math.PI * 2;
          const isPoint = i % (baseCount / 10) < (baseCount / 20);
          const radius = isPoint ? 6 : 3;
          const vx = Math.cos(angle) * radius;
          const vy = Math.sin(angle) * radius;
          newParticles.push(createParticle(vx, vy, { shape: 'star' }));
        }
        break;
        
      case 'willow':
        for (let i = 0; i < baseCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 3;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed - 2; // Droop effect
          newParticles.push(createParticle(vx, vy, { gravity: true }));
        }
        break;
        
      case 'chrysanthemum':
        const layers = 3;
        for (let layer = 0; layer < layers; layer++) {
          const layerCount = Math.floor(baseCount / layers);
          for (let i = 0; i < layerCount; i++) {
            const angle = (i / layerCount) * Math.PI * 2;
            const speed = 2 + layer * 1.5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            newParticles.push(createParticle(vx, vy, { 
              size: 2 + layer,
              life: 100 + layer * 20
            }));
          }
        }
        break;
        
      case 'crossette':
        // Initial burst
        for (let i = 0; i < baseCount * 0.6; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 2;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          const particle = createParticle(vx, vy);
          
          // Mark for secondary explosion
          if (Math.random() > 0.8) {
            setTimeout(() => {
              setParticles(prev => [...prev, ...createSecondaryBurst(particle.x, particle.y, colors)]);
            }, 500 + Math.random() * 1000);
          }
          
          newParticles.push(particle);
        }
        break;
        
      case 'double-burst':
        // First ring
        for (let i = 0; i < baseCount * 0.5; i++) {
          const angle = (i / (baseCount * 0.5)) * Math.PI * 2;
          const speed = 2 + Math.random();
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          newParticles.push(createParticle(vx, vy));
        }
        
        // Second ring (delayed)
        setTimeout(() => {
          const secondRing: FireworkParticle[] = [];
          for (let i = 0; i < baseCount * 0.5; i++) {
            const angle = (i / (baseCount * 0.5)) * Math.PI * 2;
            const speed = 4 + Math.random() * 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            secondRing.push(createParticle(vx, vy, { color: colors.secondary[0] }));
          }
          setParticles(prev => [...prev, ...secondRing]);
        }, 300);
        break;
        
      default: // Enhanced starburst
        for (let i = 0; i < baseCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 4;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          newParticles.push(createParticle(vx, vy));
        }
    }
    
    // Add glitter particles
    const glitterCount = Math.floor(baseCount * 0.3);
    for (let i = 0; i < glitterCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      newParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx,
        vy,
        life: 60 + Math.random() * 40,
        max: 60 + Math.random() * 40,
        color: colors.glitter[Math.floor(Math.random() * colors.glitter.length)],
        type: 'glitter',
        shape: 'star',
        size: 1 + Math.random() * 2,
        gravity: false,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.5,
        glowSize: 4 + Math.random() * 3,
        trail: [],
        colorTransition: false,
        parentId: `glitter_${particleIdCounter.current++}`
      });
    }
    
    return newParticles;
  }, [landingType]);

  // Create secondary burst for crossette effect
  const createSecondaryBurst = useCallback((x: number, y: number, colors: any) => {
    const newParticles: FireworkParticle[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      newParticles.push({
        x,
        y,
        vx,
        vy,
        life: 40 + Math.random() * 30,
        max: 40 + Math.random() * 30,
        color: colors.secondary[Math.floor(Math.random() * colors.secondary.length)],
        type: 'secondary',
        shape: 'circle',
        size: 1 + Math.random(),
        gravity: true,
        rotation: 0,
        rotationSpeed: 0,
        glowSize: 2,
        trail: [],
        colorTransition: false,
        parentId: `secondary_${particleIdCounter.current++}`
      });
    }
    return newParticles;
  }, []);

  // Spectacular fireworks launch sequence
  const launchFireworks = useCallback(() => {
    if (hasLaunched.current || !canvasRef.current) return;
    hasLaunched.current = true;

    const canvas = canvasRef.current;
    const colors = getColors();
    
    // Different show types based on landing
    let launchCount: number, patterns: string[], timing: number;
    
    switch (landingType) {
      case '2x':
        launchCount = 12;
        patterns = ['spiral', 'heart', 'star', 'chrysanthemum', 'crossette', 'double-burst'];
        timing = 150;
        break;
      case 'moving':
        launchCount = 10;
        patterns = ['willow', 'chrysanthemum', 'crossette', 'starburst'];
        timing = 180;
        break;
      default:
        launchCount = 8;
        patterns = ['starburst', 'willow', 'star'];
        timing = 200;
    }
    
    // Stagger launches with spectacular finale
    for (let i = 0; i < launchCount; i++) {
      setTimeout(() => {
        const baseX = (canvas.width / (launchCount + 1)) * (i + 1);
        const x = Math.max(80, Math.min(canvas.width - 80, baseX + (Math.random() - 0.5) * 150));
        const y = canvas.height;
        const targetY = canvas.height * (0.1 + Math.random() * 0.6);
        
        // Launch with comet trail
        setParticles(prev => [...prev, ...createLaunch(x, y, targetY, colors)]);
        
        // Spectacular burst
        setTimeout(() => {
          const pattern = patterns[Math.floor(Math.random() * patterns.length)];
          setParticles(prev => [...prev, ...createBurst(x, targetY, colors, pattern)]);
          
          // Screen flash effect (only on mobile devices)
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 'ontouchstart' in window;
          if (isMobile && Math.random() > 0.7) { // Less frequent flashes
            const flash = document.createElement('div');
            flash.className = 'absolute inset-0 bg-white pointer-events-none';
            flash.style.opacity = '0.2';
            flash.style.zIndex = '100';
            document.body.appendChild(flash);
            setTimeout(() => {
              flash.style.opacity = '0';
              flash.style.transition = 'opacity 0.3s';
              setTimeout(() => document.body.removeChild(flash), 300);
            }, 100);
          }
        }, 800 + Math.random() * 400);
      }, i * timing);
    }
    
    // Grand finale for 2x bonus
    if (landingType === '2x') {
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          const x = canvas.width * (0.2 + i * 0.15);
          const targetY = canvas.height * 0.3;
          setTimeout(() => {
            setParticles(prev => [...prev, ...createBurst(x, targetY, colors, 'double-burst')]);
          }, i * 100);
        }
      }, launchCount * timing + 1000);
    }
  }, [landingType, getColors, createLaunch, createBurst]);

  // Enhanced animation loop with trails and effects
  useEffect(() => {
    let lastTime = 0;
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      const normalizedDelta = Math.min(deltaTime / 16.67, 2);
      
      setParticles(prev => {
        return prev
          .map(particle => {
            // Update position
            const newX = particle.x + (particle.vx * normalizedDelta);
            const newY = particle.y + (particle.vy * normalizedDelta);
            
            // Update trail
            const newTrail = [...particle.trail];
            if (particle.type === 'comet' || particle.type === 'burst') {
              newTrail.unshift({ x: particle.x, y: particle.y, alpha: particle.life / particle.max });
              if (newTrail.length > 5) newTrail.pop();
            }
            
            // Color transition
            let newColor = particle.color;
            if (particle.colorTransition && particle.secondaryColor) {
              const progress = 1 - (particle.life / particle.max);
              if (progress > 0.5) {
                newColor = particle.secondaryColor;
              }
            }
            
            // Physics updates
            let newVy = particle.vy;
            let newVx = particle.vx;
            
            if (particle.gravity) {
              newVy += 0.03 * normalizedDelta; // Reduced gravity
            }
            
            // Air resistance
            newVx *= 0.9995;
            if (particle.gravity) newVy *= 0.9998;
            
            // Magnetic effect for glitter
            if (particle.type === 'glitter' && particle.magneticTarget) {
              const dx = particle.magneticTarget.x - newX;
              const dy = particle.magneticTarget.y - newY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0) {
                newVx += (dx / dist) * 0.01;
                newVy += (dy / dist) * 0.01;
              }
            }
            
            return {
              ...particle,
              x: newX,
              y: newY,
              vx: newVx,
              vy: newVy,
              life: particle.life - normalizedDelta,
              rotation: particle.rotation + particle.rotationSpeed * normalizedDelta,
              trail: newTrail,
              color: newColor
            };
          })
          .filter(particle => particle.life > 0);
      });
      
      lastTime = currentTime;
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Launch fireworks after delay
  useEffect(() => {
    const timer = setTimeout(launchFireworks, 300); // Reduced delay
    return () => clearTimeout(timer);
  }, [launchFireworks]);

  // Auto-complete after extended time for spectacular show
  useEffect(() => {
    const duration = landingType === '2x' ? 8000 : landingType === 'moving' ? 7000 : 6000;
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [onComplete, landingType]);

  // Handle input for skipping
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'Space') {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSkip]);

  // Gamepad input for skipping
  useEffect(() => {
    const checkGamepad = () => {
      const gamepad = anyGamepad();
      if (gamepad && (gamepad.buttons[0]?.pressed || gamepad.buttons[1]?.pressed)) {
        onSkip();
      }
    };

    const interval = setInterval(checkGamepad, 100);
    return () => clearInterval(interval);
  }, [onSkip]);

  // Enhanced rendering with shapes, glow, and trails
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(particle => {
      const alpha = Math.max(0, particle.life / particle.max);
      
      // Draw trail for comet and burst particles
      if (particle.trail.length > 0) {
        particle.trail.forEach((point, index) => {
          const trailAlpha = point.alpha * 0.3 * (1 - index / particle.trail.length);
          ctx.globalAlpha = trailAlpha;
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(point.x, point.y, particle.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      
      // Main particle with glow
      ctx.globalAlpha = alpha;
      
      // Glow effect
      if (particle.glowSize > 0) {
        ctx.shadowBlur = particle.glowSize;
        ctx.shadowColor = particle.color;
      } else {
        ctx.shadowBlur = 0;
      }
      
      ctx.fillStyle = particle.color;
      
      // Draw different shapes
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      
      switch (particle.shape) {
        case 'star':
          drawStar(ctx, 0, 0, particle.size * alpha, 5);
          break;
        case 'diamond':
          drawDiamond(ctx, 0, 0, particle.size * alpha);
          break;
        case 'heart':
          drawHeart(ctx, 0, 0, particle.size * alpha);
          break;
        case 'cross':
          drawCross(ctx, 0, 0, particle.size * alpha);
          break;
        case 'streak':
          drawStreak(ctx, 0, 0, particle.size * alpha, particle.vx, particle.vy);
          break;
        default: // circle
          ctx.beginPath();
          ctx.arc(0, 0, particle.size * alpha, 0, Math.PI * 2);
          ctx.fill();
      }
      
      ctx.restore();
      ctx.shadowBlur = 0;
    });
    
    ctx.globalAlpha = 1;
  }, [particles]);

  // Shape drawing functions
  const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, points: number) => {
    const outerRadius = size;
    const innerRadius = size * 0.4;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  const drawDiamond = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
    ctx.fill();
  };

  const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    const scale = size / 10;
    ctx.beginPath();
    ctx.moveTo(0, 3 * scale);
    ctx.bezierCurveTo(-5 * scale, -2 * scale, -15 * scale, 2 * scale, 0, 15 * scale);
    ctx.bezierCurveTo(15 * scale, 2 * scale, 5 * scale, -2 * scale, 0, 3 * scale);
    ctx.fill();
  };

  const drawCross = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    const thickness = size * 0.3;
    ctx.fillRect(-thickness/2, -size, thickness, size * 2);
    ctx.fillRect(-size, -thickness/2, size * 2, thickness);
  };

  const drawStreak = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, vx: number, vy: number) => {
    const length = Math.sqrt(vx * vx + vy * vy) * 2;
    const angle = Math.atan2(vy, vx);
    ctx.save();
    ctx.rotate(angle);
    ctx.fillRect(-length, -size/2, length, size);
    ctx.restore();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'transparent' }}
      />
      <div className="absolute bottom-8 text-center text-white/80 text-sm drop-shadow-lg pointer-events-none">
        Press THRUST to continue
      </div>
    </div>
  );
};

export default FireworksDisplay;