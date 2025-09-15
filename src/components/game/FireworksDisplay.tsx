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
  type: 'launch' | 'burst' | 'trail';
  size: number;
  gravity: boolean;
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

  // Color schemes based on landing type
  const getColors = useCallback(() => {
    switch (landingType) {
      case 'moving':
        return ['#FFD700', '#FFA500', '#FF8C00', '#FFFF00', '#FFB347'];
      case '2x':
        return ['#FF0000', '#00FF00', '#0088FF', '#FF00FF', '#FFFF00', '#FFFFFF', '#FF4444', '#44FF44'];
      case 'regular':
      default:
        return [neonColor, neonColor, neonColor, '#FFFFFF', '#FFFFFF'];
    }
  }, [landingType, neonColor]);

  // Create firework launch
  const createLaunch = useCallback((x: number, y: number, targetY: number, colors: string[]) => {
    const newParticles: FireworkParticle[] = [];
    
    // Launch particle
    const launchParticle: FireworkParticle = {
      x,
      y,
      vx: 0,
      vy: -(targetY - y) / 60, // Reach target in ~60 frames
      life: 60,
      max: 60,
      color: colors[0],
      type: 'launch',
      size: 3,
      gravity: false
    };
    
    newParticles.push(launchParticle);
    return newParticles;
  }, []);

  // Create firework burst
  const createBurst = useCallback((x: number, y: number, colors: string[], pattern: string = 'starburst') => {
    const newParticles: FireworkParticle[] = [];
    const particleCount = landingType === '2x' ? 40 : landingType === 'moving' ? 35 : 25;
    
    for (let i = 0; i < particleCount; i++) {
      let vx, vy;
      
      switch (pattern) {
        case 'ring':
          const angle = (i / particleCount) * Math.PI * 2;
          const speed = 3 + Math.random() * 2;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          break;
        case 'cascade':
          vx = (Math.random() - 0.5) * 4;
          vy = Math.random() * 2 - 1;
          break;
        default: // starburst
          const burstAngle = Math.random() * Math.PI * 2;
          const burstSpeed = 2 + Math.random() * 4;
          vx = Math.cos(burstAngle) * burstSpeed;
          vy = Math.sin(burstAngle) * burstSpeed;
      }
      
      const particle: FireworkParticle = {
        x,
        y,
        vx,
        vy,
        life: 120 + Math.random() * 60,
        max: 120 + Math.random() * 60,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'burst',
        size: 2 + Math.random(),
        gravity: true
      };
      
      newParticles.push(particle);
    }
    
    return newParticles;
  }, [landingType]);

  // Launch fireworks sequence
  const launchFireworks = useCallback(() => {
    if (hasLaunched.current || !canvasRef.current) return;
    hasLaunched.current = true;

    const canvas = canvasRef.current;
    const colors = getColors();
    const launchCount = landingType === '2x' ? 5 : landingType === 'moving' ? 4 : 3;
    
    // Stagger launches
    for (let i = 0; i < launchCount; i++) {
      setTimeout(() => {
        const x = (canvas.width / (launchCount + 1)) * (i + 1);
        const y = canvas.height;
        const targetY = canvas.height * (0.2 + Math.random() * 0.3);
        
        // Launch
        setParticles(prev => [...prev, ...createLaunch(x, y, targetY, colors)]);
        
        // Burst after flight time
        setTimeout(() => {
          const patterns = ['starburst', 'ring', 'cascade'];
          const pattern = patterns[Math.floor(Math.random() * patterns.length)];
          setParticles(prev => [...prev, ...createBurst(x, targetY, colors, pattern)]);
          
          // Screen flash effect
          const flash = document.createElement('div');
          flash.className = 'absolute inset-0 bg-white pointer-events-none';
          flash.style.opacity = '0.3';
          flash.style.zIndex = '100';
          document.body.appendChild(flash);
          setTimeout(() => {
            flash.style.opacity = '0';
            flash.style.transition = 'opacity 0.2s';
            setTimeout(() => document.body.removeChild(flash), 200);
          }, 50);
        }, 1000);
      }, i * 200);
    }
  }, [landingType, getColors, createLaunch, createBurst]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setParticles(prev => {
        return prev
          .map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vy: particle.gravity ? particle.vy + 0.1 : particle.vy, // gravity
            life: particle.life - 1
          }))
          .filter(particle => particle.life > 0);
      });
      
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
    const timer = setTimeout(launchFireworks, 500);
    return () => clearTimeout(timer);
  }, [launchFireworks]);

  // Auto-complete after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onComplete, 5000);
    return () => clearTimeout(timer);
  }, [onComplete]);

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

  // Render particles to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(particle => {
      const alpha = particle.life / particle.max;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      
      if (particle.type === 'launch') {
        ctx.fillRect(particle.x - 1, particle.y - 2, 2, 4);
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        
        // Particle trails
        if (particle.type === 'burst' && alpha > 0.5) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(particle.x - particle.vx, particle.y - particle.vy, particle.size * alpha * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
    
    ctx.globalAlpha = 1;
  }, [particles]);

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