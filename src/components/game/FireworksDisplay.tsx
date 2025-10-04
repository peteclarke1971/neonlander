import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { anyGamepad } from '../../hooks/use-gamepad';
import { PerformanceManager } from './utils/performanceManager';
import { ObjectPool } from './utils/objectPool';

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
  shape: 'circle' | 'star' | 'diamond' | 'heart' | 'cross' | 'streak' | 'ghost';
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
  landingType: 'regular' | 'moving' | '2x' | 'ghost-beaten' | null;
  neonColor: string;
  onComplete: () => void;
  onSkip: () => void;
  fireworkCount?: number;
  lowGraphics?: boolean;
}

// Object pool for particle reuse
interface PooledFireworkParticle extends FireworkParticle {
  reset(): void;
}

const createPooledParticle = (): PooledFireworkParticle => ({
  x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, color: '', type: 'burst',
  shape: 'circle', size: 0, gravity: false, rotation: 0, rotationSpeed: 0,
  glowSize: 0, trail: [], colorTransition: false,
  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.life = 0; this.max = 0;
    this.color = ''; this.trail = []; this.colorTransition = false;
    delete this.secondaryColor; delete this.magneticTarget; delete this.parentId;
  }
});

const resetPooledParticle = (p: PooledFireworkParticle) => p.reset();

const particlePool = new ObjectPool(createPooledParticle, resetPooledParticle, 500);

const FireworksDisplay: React.FC<FireworksDisplayProps> = ({
  landingType,
  neonColor,
  onComplete,
  onSkip,
  fireworkCount,
  lowGraphics = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [particles, setParticles] = useState<FireworkParticle[]>([]);
  const [startTime] = useState(Date.now());
  const animationRef = useRef<number>();
  const hasLaunched = useRef(false);
  const particleIdCounter = useRef(0);
  const performanceManager = useRef(new PerformanceManager());
  const [performanceStats, setPerformanceStats] = useState({ fps: 60, quality: 'high' });
  const lastFrameTime = useRef(0);

  // Performance-based quality settings
  const qualitySettings = useMemo(() => {
    const { settings } = performanceManager.current.update(0.016);
    const quality = settings.particleCount >= 50 ? 'ultra' : 
                   settings.particleCount >= 30 ? 'high' : 
                   settings.particleCount >= 15 ? 'medium' : 'low';
    
    return {
      quality,
      particleMultiplier: settings.particleCount / 50, // Base multiplier from high performance
      enableShadows: settings.shadowBlur > 4,
      shadowBlur: settings.shadowBlur,
      enableTrails: quality !== 'low',
      maxTrailLength: quality === 'ultra' ? 8 : quality === 'high' ? 5 : 3,
      enableGlow: quality !== 'low',
      glowMultiplier: quality === 'ultra' ? 1.5 : quality === 'high' ? 1.0 : 0.5,
      cullingEnabled: settings.viewportCulling
    };
  }, [performanceStats]);

  // Enhanced color schemes with gradients and transitions
  const getColors = useCallback(() => {
    switch (landingType) {
      case 'ghost-beaten':
        return {
          primary: ['#FF0000', '#FFB6C1', '#00FFFF', '#FFA500', '#FFFFFF'], // Classic Pac-Man ghost colors
          secondary: ['#FF4444', '#FF8888', '#44FFFF', '#FFAA44', '#EEEEEE'],
          glitter: ['#FFFFFF', '#FFDDDD', '#DDFFFF', '#FFFFDD']
        };
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

  // Create spectacular burst patterns with distinct visual signatures
  const createBurst = useCallback((x: number, y: number, colors: any, pattern: string = 'starburst') => {
    const newParticles: FireworkParticle[] = [];
    // Apply performance scaling to particle counts
    const rawCount = landingType === '2x' ? 150 : landingType === 'moving' ? 120 : 100;
    const baseCount = Math.floor(rawCount * qualitySettings.particleMultiplier);
    
    // Debug pattern selection
    console.log(`🎆 Creating ${pattern} firework at (${Math.round(x)}, ${Math.round(y)}) for ${landingType} landing`);
    
    const createParticle = (vx: number, vy: number, customProps: Partial<FireworkParticle> = {}) => {
      // Get from pool and configure
      const particle = particlePool.get() as FireworkParticle;
      
      // Apply performance-based settings
      const glowSize = (4 + Math.random() * 6) * qualitySettings.glowMultiplier;
      const size = Math.max(1, (2 + Math.random() * 4) * Math.sqrt(qualitySettings.particleMultiplier));
      
      // Configure particle
      Object.assign(particle, {
        x,
        y,
        vx: vx * (0.8 + Math.random() * 0.4),
        vy: vy * (0.8 + Math.random() * 0.4),
        life: 120 + Math.random() * 60,
        max: 120 + Math.random() * 60,
        color: colors.primary[Math.floor(Math.random() * colors.primary.length)],
        secondaryColor: qualitySettings.enableGlow ? colors.glitter[Math.floor(Math.random() * colors.glitter.length)] : undefined,
        type: 'burst' as const,
        shape: 'circle' as FireworkParticle['shape'],
        size,
        gravity: true,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        glowSize,
        trail: [],
        colorTransition: false,
        parentId: `${pattern}_${particleIdCounter.current++}`,
        ...customProps
      });
      
      return particle;
    };

    switch (pattern) {
      case 'spiral':
        console.log('🌪️ Creating SPIRAL pattern with green/blue theme');
        for (let i = 0; i < baseCount; i++) {
          const angle = (i / baseCount) * Math.PI * 12; // More spirals
          const radius = (i / baseCount) * 8;
          const vx = Math.cos(angle) * radius;
          const vy = Math.sin(angle) * radius;
          newParticles.push(createParticle(vx, vy, { 
            shape: 'diamond',
            color: i % 2 === 0 ? '#00FF88' : '#0088FF',
            size: 3 + (i / baseCount) * 4,
            rotationSpeed: 0.4,
            glowSize: 8
          }));
        }
        break;
        
      case 'heart':
        console.log('💖 Creating HEART pattern with pink/red theme');
        for (let i = 0; i < baseCount; i++) {
          const t = (i / baseCount) * Math.PI * 2;
          const heartX = 16 * Math.pow(Math.sin(t), 3);
          const heartY = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
          newParticles.push(createParticle(heartX * 0.4, heartY * 0.4, { 
            shape: 'heart', 
            color: i % 3 === 0 ? '#FF1493' : i % 3 === 1 ? '#FF69B4' : '#FFB6C1',
            size: 4 + Math.random() * 3,
            glowSize: 10,
            colorTransition: true
          }));
        }
        break;
        
      case 'star':
        console.log('⭐ Creating STAR pattern with gold/yellow theme');
        for (let i = 0; i < baseCount; i++) {
          const angle = (i / baseCount) * Math.PI * 2;
          const isPoint = i % (baseCount / 10) < (baseCount / 20);
          const radius = isPoint ? 8 : 4;
          const vx = Math.cos(angle) * radius;
          const vy = Math.sin(angle) * radius;
          newParticles.push(createParticle(vx, vy, { 
            shape: 'star',
            color: isPoint ? '#FFD700' : '#FFA500',
            size: isPoint ? 6 : 3,
            glowSize: isPoint ? 12 : 6,
            rotationSpeed: isPoint ? 0.3 : 0.1
          }));
        }
        break;
        
      case 'willow':
        console.log('🌿 Creating WILLOW pattern with green cascading theme');
        for (let i = 0; i < baseCount; i++) {
          const angle = (Math.PI / 6) + Math.random() * (5 * Math.PI / 6); // Upward spread
          const speed = 3 + Math.random() * 4;
          const vx = Math.cos(angle) * speed;
          const vy = -Math.abs(Math.sin(angle) * speed); // Always upward initially
          newParticles.push(createParticle(vx, vy, { 
            color: i % 3 === 0 ? '#32CD32' : i % 3 === 1 ? '#90EE90' : '#ADFF2F',
            gravity: true,
            size: 2 + Math.random() * 3,
            shape: 'streak',
            glowSize: 5
          }));
        }
        break;
        
      case 'chrysanthemum':
        console.log('🌸 Creating CHRYSANTHEMUM pattern with layered bursts');
        const layers = 4;
        for (let layer = 0; layer < layers; layer++) {
          const layerCount = Math.floor(baseCount / layers);
          const layerColor = layer === 0 ? '#FF4444' : layer === 1 ? '#FF8844' : layer === 2 ? '#FFAA44' : '#FFDD44';
          for (let i = 0; i < layerCount; i++) {
            const angle = (i / layerCount) * Math.PI * 2;
            const speed = 1.5 + layer * 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            newParticles.push(createParticle(vx, vy, { 
              size: 3 + layer * 1.5,
              life: 150 + layer * 30,
              max: 150 + layer * 30,
              color: layerColor,
              shape: layer % 2 === 0 ? 'circle' : 'diamond',
              glowSize: 6 + layer * 2
            }));
          }
        }
        break;
        
      case 'crossette':
        console.log('✨ Creating CROSSETTE pattern with secondary explosions');
        // Initial burst with bright white/silver
        for (let i = 0; i < baseCount * 0.7; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 4 + Math.random() * 3;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          const particle = createParticle(vx, vy, {
            color: '#FFFFFF',
            size: 4 + Math.random() * 2,
            shape: 'cross',
            glowSize: 8
          });
          
          // Mark for secondary explosion
          if (Math.random() > 0.6) {
        setTimeout(() => {
          setParticles(prev => [...prev, ...createSecondaryBurst(particle.x, particle.y, colors)]);
        }, 600 + Math.random() * 800);
          }
          
          newParticles.push(particle);
        }
        break;
        
      case 'double-burst':
        console.log('💥 Creating DOUBLE-BURST pattern with delayed rings');
        // First ring - inner burst
        for (let i = 0; i < baseCount * 0.6; i++) {
          const angle = (i / (baseCount * 0.6)) * Math.PI * 2;
          const speed = 2.5 + Math.random() * 1.5;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          newParticles.push(createParticle(vx, vy, {
            color: '#FF6600',
            size: 3,
            glowSize: 6
          }));
        }
        
        // Second ring (delayed) - outer burst
        setTimeout(() => {
          const secondRing: FireworkParticle[] = [];
          for (let i = 0; i < baseCount * 0.8; i++) {
            const angle = (i / (baseCount * 0.8)) * Math.PI * 2;
            const speed = 5 + Math.random() * 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            secondRing.push(createParticle(vx, vy, { 
              color: '#00CCFF',
              size: 5,
              shape: 'star',
              glowSize: 10
            }));
          }
          setParticles(prev => [...prev, ...secondRing]);
        }, 400);
        break;
        
      case 'ghost':
        console.log('👻 Creating GHOST pattern with Pac-Man style ghosts');
        const ghostColors = ['#FF0000', '#FFB6C1', '#00FFFF', '#FFA500']; // Classic Pac-Man colors
        for (let i = 0; i < baseCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 2; // Slower, floaty movement
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed - 0.5; // Slight upward bias
          newParticles.push(createParticle(vx, vy, { 
            shape: 'ghost',
            color: ghostColors[i % ghostColors.length],
            size: 6 + Math.random() * 4, // Larger for better visibility
            gravity: false, // Ghosts float!
            life: 200 + Math.random() * 100, // Longer life for ethereal effect
            max: 200 + Math.random() * 100,
            glowSize: 12 + Math.random() * 6, // More dramatic glow
            rotationSpeed: (Math.random() - 0.5) * 0.05, // Very slow gentle rotation
            colorTransition: true,
            secondaryColor: 'rgba(255, 255, 255, 0.4)'
          }));
        }
        break;
        
      case 'giant-ghost':
        console.log('👻👑 Creating GIANT GHOST pattern - massive Pac-Man ghost finale!');
        const giantGhostColors = ['#FF0000', '#FFB6C1', '#00FFFF', '#FFA500'];
        // Create one massive central ghost
        newParticles.push(createParticle(0, 0, {
          shape: 'ghost',
          color: giantGhostColors[0], // Red ghost (Blinky)
          size: 40, // Massive size
          gravity: false,
          life: 300,
          max: 300,
          glowSize: 30,
          rotationSpeed: 0.02,
          vx: 0, // Stationary
          vy: 0
        }));
        
        // Floating particles around the giant ghost
        for (let i = 0; i < 60; i++) {
          const angle = (i / 60) * Math.PI * 2;
          const radius = 80 + Math.sin(i * 0.5) * 20; // Wavy circle
          const vx = Math.cos(angle) * 0.5;
          const vy = Math.sin(angle) * 0.5;
          newParticles.push(createParticle(vx, vy, {
            shape: 'circle',
            color: giantGhostColors[i % giantGhostColors.length],
            size: 3 + Math.random() * 2,
            gravity: false,
            life: 250,
            max: 250,
            glowSize: 8,
            x: x + Math.cos(angle) * radius,
            y: y + Math.sin(angle) * radius,
            rotationSpeed: (Math.random() - 0.5) * 0.1
          }));
        }
        break;
        
      default: // Enhanced starburst
        console.log('💫 Creating STARBURST pattern - classic burst');
        for (let i = 0; i < baseCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 4;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          newParticles.push(createParticle(vx, vy, {
            size: 3 + Math.random() * 2,
            shape: Math.random() > 0.5 ? 'circle' : 'star',
            glowSize: 5 + Math.random() * 3
          }));
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
    
    // If fireworkCount is provided (survival mode), use that
    if (fireworkCount !== undefined) {
      launchCount = fireworkCount;
      patterns = ['starburst', 'spiral', 'heart', 'star', 'willow', 'chrysanthemum', 'crossette', 'double-burst', 'ring', 'palm'];
      timing = 300;
    } else {
      // Original logic for main game
      switch (landingType) {
      case 'ghost-beaten':
        // Four giant ghost fireworks display
        launchCount = 4;
        patterns = ['giant-ghost', 'giant-ghost', 'giant-ghost', 'giant-ghost'];
        timing = 500;
        break;
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
    
    // Grand finale for ghost-beaten - MAGICAL GHOST ARMY WITH GIANT GHOST!
    if (landingType === 'ghost-beaten') {
      setTimeout(() => {
        // First wave: ghost parade across the sky
        for (let i = 0; i < 6; i++) {
          const x = canvas.width * (0.15 + i * 0.14);
          const targetY = canvas.height * 0.25;
          setTimeout(() => {
            setParticles(prev => [...prev, ...createBurst(x, targetY, colors, 'ghost')]);
          }, i * 100);
        }
        
        // GIANT GHOST FINALE - dramatic pause then massive ghost appears in center
        setTimeout(() => {
          const centerX = canvas.width / 2;
          const centerY = canvas.height * 0.4;
          setParticles(prev => [...prev, ...createBurst(centerX, centerY, colors, 'giant-ghost')]);
        }, 800); // Pause for dramatic effect
        
        // Second wave: heart explosion in center
        setTimeout(() => {
          const centerX = canvas.width * 0.5;
          const centerY = canvas.height * 0.3;
          setParticles(prev => [...prev, ...createBurst(centerX, centerY, colors, 'heart')]);
          
          // Triple ghost finale around the heart
          setTimeout(() => {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI * 2 / 3) {
              const x = centerX + Math.cos(angle) * 150;
              const y = centerY + Math.sin(angle) * 100;
              setParticles(prev => [...prev, ...createBurst(x, y, colors, 'ghost')]);
            }
          }, 300);
        }, 800);
      }, launchCount * timing + 500);
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
  }, [landingType, getColors, createLaunch, createBurst, qualitySettings.particleMultiplier]);

  // Enhanced animation loop with trails and effects
  useEffect(() => {
    let lastTime = 0;
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      const normalizedDelta = Math.min(deltaTime / 16.67, 2);
      
      // Update performance stats
      const perfStats = performanceManager.current.update(deltaTime / 1000);
      if (currentTime - lastFrameTime.current > 1000) {
        setPerformanceStats({ fps: perfStats.fps, quality: qualitySettings.quality });
        lastFrameTime.current = currentTime;
      }
      
      const canvas = canvasRef.current;
      const viewWidth = canvas?.width || 800;
      const viewHeight = canvas?.height || 600;
      
      setParticles(prev => {
        const activeParticles = prev.filter(particle => {
          // Performance culling - skip particles outside view
          if (qualitySettings.cullingEnabled) {
            const margin = 100;
            if (particle.x < -margin || particle.x > viewWidth + margin ||
                particle.y < -margin || particle.y > viewHeight + margin) {
              // Return to pool when culled
              if ('reset' in particle) {
                particlePool.release(particle as PooledFireworkParticle);
              }
              return false;
            }
          }
          
          return particle.life > 0;
        });
        
        return activeParticles
          .map(particle => {
            // Update position
            const newX = particle.x + (particle.vx * normalizedDelta);
            const newY = particle.y + (particle.vy * normalizedDelta);
            
            // Update trail with performance consideration
            const newTrail = [...particle.trail];
            if (qualitySettings.enableTrails && (particle.type === 'comet' || particle.type === 'burst')) {
              newTrail.unshift({ x: particle.x, y: particle.y, alpha: particle.life / particle.max });
              if (newTrail.length > qualitySettings.maxTrailLength) newTrail.pop();
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
          .filter(particle => {
            if (particle.life <= 0) {
              // Return dead particles to pool
              if ('reset' in particle) {
                particlePool.release(particle as PooledFireworkParticle);
              }
              return false;
            }
            return true;
          });
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
    const duration = landingType === 'ghost-beaten' ? 10000 : landingType === '2x' ? 8000 : landingType === 'moving' ? 7000 : 6000;
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [onComplete, landingType]);

  // Handle input for skipping (only in low graphics mode)
  useEffect(() => {
    if (!lowGraphics) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'Space') {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSkip, lowGraphics]);

  // Gamepad input for skipping (only in low graphics mode)
  useEffect(() => {
    if (!lowGraphics) return;

    const checkGamepad = () => {
      const gamepad = anyGamepad();
      if (gamepad && (gamepad.buttons[0]?.pressed || gamepad.buttons[1]?.pressed)) {
        onSkip();
      }
    };

    const interval = setInterval(checkGamepad, 100);
    return () => clearInterval(interval);
  }, [onSkip, lowGraphics]);

  // Performance-optimized rendering with shapes, glow, and trails
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sort particles by size to optimize rendering order (back to front)
    const sortedParticles = qualitySettings.quality === 'low' ? particles : 
      [...particles].sort((a, b) => a.size - b.size);

    sortedParticles.forEach(particle => {
      const alpha = Math.max(0, particle.life / particle.max);
      const effectiveSize = particle.size * alpha;
      
      // Skip very small or nearly invisible particles
      if (effectiveSize < 0.5 || alpha < 0.05) return;
      
      // Level-of-detail: Use simple circles for small particles
      const useSimpleShape = effectiveSize < 3 || qualitySettings.quality === 'low';
      
      // Draw trail for comet and burst particles (performance optimized)
      if (qualitySettings.enableTrails && particle.trail.length > 0 && effectiveSize > 2) {
        ctx.fillStyle = particle.color;
        particle.trail.forEach((point, index) => {
          const trailAlpha = point.alpha * 0.3 * (1 - index / particle.trail.length);
          if (trailAlpha > 0.1) { // Skip nearly invisible trail points
            ctx.globalAlpha = trailAlpha;
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(1, particle.size * 0.5), 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
      
      // Main particle with optimized glow
      ctx.globalAlpha = alpha;
      
      // Performance-based glow rendering
      if (qualitySettings.enableGlow && particle.glowSize > 0 && effectiveSize >= 3) {
        if (qualitySettings.enableShadows && effectiveSize >= 6) {
          // Use expensive shadowBlur only for large particles on high quality
          const scaledGlow = Math.min(qualitySettings.shadowBlur, particle.glowSize * qualitySettings.glowMultiplier);
          ctx.shadowBlur = scaledGlow;
          ctx.shadowColor = particle.color;
        } else {
          // Alternative glow for smaller particles - background circle
          ctx.shadowBlur = 0;
          ctx.save();
          ctx.globalAlpha = alpha * 0.2;
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, effectiveSize * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = alpha;
        }
      } else {
        ctx.shadowBlur = 0;
      }
      
      ctx.fillStyle = particle.color;
      
      // Draw shapes with level-of-detail
      ctx.save();
      ctx.translate(particle.x, particle.y);
      
      if (useSimpleShape) {
        // Fast circle rendering for small/low-quality particles
        ctx.beginPath();
        ctx.arc(0, 0, effectiveSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Complex shape rendering for larger particles
        ctx.rotate(particle.rotation);
        
        switch (particle.shape) {
          case 'star':
            drawStar(ctx, 0, 0, effectiveSize, 5);
            break;
          case 'diamond':
            drawDiamond(ctx, 0, 0, effectiveSize);
            break;
          case 'heart':
            drawHeart(ctx, 0, 0, effectiveSize);
            break;
          case 'cross':
            drawCross(ctx, 0, 0, effectiveSize);
            break;
          case 'streak':
            drawStreak(ctx, 0, 0, effectiveSize, particle.vx, particle.vy);
            break;
          case 'ghost':
            drawGhost(ctx, 0, 0, effectiveSize);
            break;
          default: // circle
            ctx.beginPath();
            ctx.arc(0, 0, effectiveSize, 0, Math.PI * 2);
            ctx.fill();
        }
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

  const drawGhost = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    const scale = size / 10;
    
    ctx.beginPath();
    
    // Pac-Man style ghost body - rounded dome top
    ctx.arc(0, -1 * scale, 7 * scale, Math.PI, 0, false);
    
    // Ghost body sides down to scalloped bottom
    ctx.lineTo(7 * scale, 7 * scale);
    
    // Classic Pac-Man scalloped bottom edge (5 scallops)
    ctx.lineTo(5.6 * scale, 5 * scale);   // First scallop peak
    ctx.lineTo(4.2 * scale, 7 * scale);   // First valley
    ctx.lineTo(2.8 * scale, 5 * scale);   // Second scallop peak  
    ctx.lineTo(1.4 * scale, 7 * scale);   // Second valley
    ctx.lineTo(0, 5 * scale);             // Center scallop peak
    ctx.lineTo(-1.4 * scale, 7 * scale);  // Third valley
    ctx.lineTo(-2.8 * scale, 5 * scale);  // Third scallop peak
    ctx.lineTo(-4.2 * scale, 7 * scale);  // Fourth valley
    ctx.lineTo(-5.6 * scale, 5 * scale);  // Fourth scallop peak
    ctx.lineTo(-7 * scale, 7 * scale);    // Final valley
    
    // Close back to start
    ctx.lineTo(-7 * scale, -1 * scale);
    
    ctx.closePath();
    ctx.fill();
    
    // Pac-Man style eyes - larger white ovals with dark pupils
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    // Left eye (larger oval)
    ctx.ellipse(-2.5 * scale, 0, 1.5 * scale, 2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    // Right eye
    ctx.ellipse(2.5 * scale, 0, 1.5 * scale, 2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye pupils (dark centers)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.ellipse(-2.5 * scale, 0.3 * scale, 0.8 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2.5 * scale, 0.3 * scale, 0.8 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye highlights for cartoon look
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(-2.2 * scale, -0.3 * scale, 0.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2.8 * scale, -0.3 * scale, 0.4 * scale, 0, Math.PI * 2);
    ctx.fill();
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