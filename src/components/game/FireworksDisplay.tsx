import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { anyGamepad } from '../../hooks/use-gamepad';
import { PerformanceManager } from './utils/performanceManager';
import { ObjectPool } from './utils/objectPool';
import { getArcadeShapePositions } from './utils/arcadeBitmaps';

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
  shape: 'circle' | 'star' | 'diamond' | 'heart' | 'cross' | 'streak' | 'ghost' | 'pentagon' | 'triangle' | 'line' | 'hexagon' | 'ship' | 'bat' | 'pumpkin' | 'snowflake' | 'present' | 'stocking' | 'trophy';
  size: number;
  gravity: boolean;
  rotation: number;
  rotationSpeed: number;
  glowSize: number;
  trail: Array<{x: number, y: number, alpha: number}>;
  colorTransition: boolean;
  magneticTarget?: {x: number, y: number};
  parentId?: string;
  vertices?: Array<{x: number, y: number}>;
  lineSegments?: Array<{x1: number, y1: number, x2: number, y2: number}>;
  shipScale?: number;
}

interface FireworksDisplayProps {
  landingType: 'regular' | 'moving' | '2x' | 'ghost-beaten' | 'retro-burst' | null;
  neonColor: string;
  onComplete: () => void;
  onSkip: () => void;
  fireworkCount?: number;
  lowGraphics?: boolean;
  isWorldRecord?: boolean;
  isHighScore?: boolean;
  debugCycleTrigger?: number; // Trigger for debug cycling on home screen
  forceSeason?: 'halloween' | 'christmas' | null; // Force specific seasonal theme
  allowSkip?: boolean; // Control whether skip is enabled (default: true)
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
    delete this.vertices; delete this.lineSegments; delete this.shipScale;
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
  lowGraphics = false,
  isWorldRecord = false,
  isHighScore = false,
  debugCycleTrigger,
  forceSeason,
  allowSkip = true
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
  
  // Track active timeouts and flash elements for cleanup on skip/unmount
  const activeTimeouts = useRef<number[]>([]);
  const flashElements = useRef<HTMLDivElement[]>([]);
  
  // Debug cycling state for F key
  const [debugCycleIndex, setDebugCycleIndex] = useState(0);
  const debugCycleOrder = useRef([
    { type: 'regular', season: null, highScore: false, label: 'Regular' },
    { type: '2x', season: null, highScore: false, label: '2x Pad' },
    { type: 'moving', season: null, highScore: false, label: 'Moving Pad' },
    { type: 'regular', season: null, highScore: true, label: 'High Score' },
    { type: 'regular', season: 'halloween', highScore: false, label: 'Halloween Regular' },
    { type: '2x', season: 'halloween', highScore: false, label: 'Halloween 2x' },
    { type: 'moving', season: 'halloween', highScore: false, label: 'Halloween Moving' },
    { type: 'regular', season: 'christmas', highScore: false, label: 'Christmas Regular' },
    { type: '2x', season: 'christmas', highScore: false, label: 'Christmas 2x' },
    { type: 'moving', season: 'christmas', highScore: false, label: 'Christmas Moving' }
  ]);

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
      case 'retro-burst':
        return {
          primary: [neonColor],
          secondary: [neonColor],
          glitter: [neonColor, '#FFFFFF']
        };
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

  // Safe setTimeout that tracks for cleanup
  const safeSetTimeout = useCallback((callback: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      activeTimeouts.current = activeTimeouts.current.filter(t => t !== id);
      callback();
    }, delay);
    activeTimeouts.current.push(id);
    return id;
  }, []);

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
        console.log('👻 Creating GHOST pattern - bitmap burst');
        const ghostColors = ['#FF0000', '#FFB6C1', '#00FFFF', '#FFA500']; // Blinky, Pinky, Inky, Clyde
        const selectedGhostColor = ghostColors[Math.floor(Math.random() * ghostColors.length)]; // ONE color per burst
        const dotSize = 3; // Denser packing
        const ghostTargets = getArcadeShapePositions('GHOST', 0, 0, dotSize);
        
        // Create particles for each position in the ghost bitmap - all same color
        ghostTargets.forEach((target) => {
          const speed = 4 + Math.random() * 3; // Increased from 0.5-1.3 to 4-7 for explosive outward burst
          const angle = Math.atan2(target.y, target.x);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          newParticles.push(createParticle(vx, vy, {
            shape: 'circle',
            color: selectedGhostColor, // Same color for all particles in this burst
            size: lowGraphics ? 4 : (5 + Math.random() * 2), // Larger, clearer particles
            gravity: true,
            life: 150 + Math.random() * 50,
            max: 200,
            glowSize: lowGraphics ? 8 : (10 + Math.random() * 5) // More vibrant glow
          }));
        });
        break;
        
      case 'giant-ghost':
        console.log('👻👑 Creating GIANT GHOST pattern - bitmap burst');
        const giantGhostColors = ['#FF0000', '#FFB6C1', '#00FFFF', '#FFA500'];
        const selectedGiantColor = giantGhostColors[Math.floor(Math.random() * giantGhostColors.length)]; // ONE color per burst
        const giantDotSize = 6; // Denser packing for giant ghost
        const giantGhostTargets = getArcadeShapePositions('GHOST', 0, 0, giantDotSize);
        
        // Create larger particles for giant ghost effect - all same color
        giantGhostTargets.forEach((target) => {
          const speed = 3 + Math.random() * 2; // Increased from 0.3-0.8 to 3-5 for explosive outward burst
          const angle = Math.atan2(target.y, target.x);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          newParticles.push(createParticle(vx, vy, {
            shape: 'circle',
            color: selectedGiantColor, // Same color for all particles in this burst
            size: lowGraphics ? 6 : (7 + Math.random() * 3), // Larger particles for giant effect
            gravity: true,
            life: 200 + Math.random() * 100,
            max: 300,
            glowSize: lowGraphics ? 10 : (12 + Math.random() * 6) // Extra vibrant glow
          }));
        });
        break;
        
      case 'pacman':
        console.log('🟡 Creating PACMAN pattern - bitmap burst');
        const pacmanDotSize = 3; // Denser packing
        const pacmanTargets = getArcadeShapePositions('PACMAN', 0, 0, pacmanDotSize);
        
        // Create particles for Pac-Man - all neon yellow
        pacmanTargets.forEach((target) => {
          const speed = 4 + Math.random() * 3; // Increased from 0.5-1.3 to 4-7 for explosive outward burst
          const angle = Math.atan2(target.y, target.x);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          newParticles.push(createParticle(vx, vy, {
            shape: 'circle',
            color: '#FFFF00', // Pure neon yellow
            size: lowGraphics ? 4 : (5 + Math.random() * 2), // Larger, clearer particles
            gravity: true,
            life: 150 + Math.random() * 50,
            max: 200,
            glowSize: lowGraphics ? 8 : (10 + Math.random() * 5) // Vibrant yellow glow
          }));
        });
        break;
        
      case 'pentagon-shatter':
        console.log('⬟ Creating PENTAGON SHATTER pattern');
        const pentagonRadius = 80;
        
        // Create initial pentagon outline (5 sides)
        for (let i = 0; i < 5; i++) {
          const angle1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const angle2 = ((i + 1) / 5) * Math.PI * 2 - Math.PI / 2;
          const x1 = Math.cos(angle1) * pentagonRadius;
          const y1 = Math.sin(angle1) * pentagonRadius;
          const x2 = Math.cos(angle2) * pentagonRadius;
          const y2 = Math.sin(angle2) * pentagonRadius;
          
          newParticles.push(createParticle(0, 0, {
            shape: 'line',
            color: neonColor,
            lineSegments: [{x1, y1, x2, y2}],
            vx: 0, vy: 0,
            size: 3,
            glowSize: 8,
            life: 180,
            max: 180
          }));
        }
        
        // After 500ms, explode into triangles
        setTimeout(() => {
          const triangles: FireworkParticle[] = [];
          for (let i = 0; i < 15; i++) {
            const angle = (i / 15) * Math.PI * 2;
            const speed = 3 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            const triSize = 15 + Math.random() * 10;
            const vertices = [
              {x: 0, y: -triSize},
              {x: triSize * 0.866, y: triSize * 0.5},
              {x: -triSize * 0.866, y: triSize * 0.5}
            ];
            
            triangles.push(createParticle(vx, vy, {
              shape: 'triangle',
              color: neonColor,
              vertices,
              size: triSize,
              glowSize: 6,
              rotationSpeed: (Math.random() - 0.5) * 0.4,
              gravity: true
            }));
          }
          setParticles(prev => [...prev, ...triangles]);
        }, 500);
        break;
        
      case 'star-constellation':
        console.log('✨ Creating STAR CONSTELLATION pattern');
        
        const starPoints = 5;
        const outerRadius = 70;
        const innerRadius = 30;
        
        // Draw star outline as connected line segments
        const starLines: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
        for (let i = 0; i < starPoints * 2; i++) {
          const angle1 = (i / (starPoints * 2)) * Math.PI * 2 - Math.PI / 2;
          const angle2 = ((i + 1) / (starPoints * 2)) * Math.PI * 2 - Math.PI / 2;
          const r1 = i % 2 === 0 ? outerRadius : innerRadius;
          const r2 = (i + 1) % 2 === 0 ? outerRadius : innerRadius;
          
          starLines.push({
            x1: Math.cos(angle1) * r1,
            y1: Math.sin(angle1) * r1,
            x2: Math.cos(angle2) * r2,
            y2: Math.sin(angle2) * r2
          });
        }
        
        // Each line segment becomes an independent particle
        setTimeout(() => {
          const starSegments: FireworkParticle[] = [];
          starLines.forEach((segment) => {
            const angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
            const speed = 2 + Math.random() * 3;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            starSegments.push(createParticle(vx, vy, {
              shape: 'line',
              color: neonColor,
              lineSegments: [segment],
              size: 3,
              glowSize: 10,
              rotationSpeed: (Math.random() - 0.5) * 0.3,
              gravity: true,
              life: 150 + Math.random() * 30,
              max: 150 + Math.random() * 30
            }));
          });
          setParticles(prev => [...prev, ...starSegments]);
        }, 400);
        break;
        
      case 'geometric-rose':
        console.log('🌹 Creating GEOMETRIC ROSE pattern');
        
        const numRings = 5;
        const petalSegments = 12;
        
        for (let ring = 0; ring < numRings; ring++) {
          const ringRadius = 20 + ring * 25;
          const ringDelay = ring * 150;
          
          setTimeout(() => {
            const ringParticles: FireworkParticle[] = [];
            for (let i = 0; i < petalSegments; i++) {
              const angle1 = (i / petalSegments) * Math.PI * 2;
              const angle2 = ((i + 1) / petalSegments) * Math.PI * 2;
              
              const x1 = Math.cos(angle1) * ringRadius;
              const y1 = Math.sin(angle1) * ringRadius;
              const x2 = Math.cos(angle2) * ringRadius;
              const y2 = Math.sin(angle2) * ringRadius;
              
              const segmentAngle = (angle1 + angle2) / 2;
              const speed = 1.5 + ring * 0.5;
              const vx = Math.cos(segmentAngle) * speed;
              const vy = Math.sin(segmentAngle) * speed;
              
              ringParticles.push(createParticle(vx, vy, {
                shape: 'line',
                color: neonColor,
                lineSegments: [{x1, y1, x2, y2}],
                size: 4,
                glowSize: 8,
                rotationSpeed: 0.05,
                gravity: false,
                life: 180,
                max: 180
              }));
            }
            setParticles(prev => [...prev, ...ringParticles]);
          }, ringDelay);
        }
        break;
        
      case 'vector-heart':
        console.log('💚 Creating VECTOR HEART pattern');
        
        const heartSegments = 40;
        const heartScale = 50;
        
        for (let i = 0; i < heartSegments; i++) {
          const t1 = (i / heartSegments) * Math.PI * 2;
          const t2 = ((i + 1) / heartSegments) * Math.PI * 2;
          
          // Parametric heart equations
          const x1 = 16 * Math.pow(Math.sin(t1), 3) * heartScale / 16;
          const y1 = -(13 * Math.cos(t1) - 5 * Math.cos(2*t1) - 2 * Math.cos(3*t1) - Math.cos(4*t1)) * heartScale / 16;
          const x2 = 16 * Math.pow(Math.sin(t2), 3) * heartScale / 16;
          const y2 = -(13 * Math.cos(t2) - 5 * Math.cos(2*t2) - 2 * Math.cos(3*t2) - Math.cos(4*t2)) * heartScale / 16;
          
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const speed = 2 + Math.random() * 2;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          newParticles.push(createParticle(vx, vy, {
            shape: 'line',
            color: neonColor,
            lineSegments: [{x1: 0, y1: 0, x2: x2 - x1, y2: y2 - y1}],
            size: 3,
            glowSize: 8,
            gravity: true,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            life: 160,
            max: 160
          }));
        }
        break;
        
      case 'hexagon-honeycomb':
        console.log('⬡ Creating HEXAGON HONEYCOMB pattern');
        
        const hexSize = 35;
        const positions = [
          {x: 0, y: 0},
          {x: hexSize * 1.5, y: 0},
          {x: hexSize * 0.75, y: hexSize * 1.3},
          {x: -hexSize * 0.75, y: hexSize * 1.3},
          {x: -hexSize * 1.5, y: 0},
          {x: -hexSize * 0.75, y: -hexSize * 1.3},
          {x: hexSize * 0.75, y: -hexSize * 1.3}
        ];
        
        positions.forEach((pos, hexIdx) => {
          setTimeout(() => {
            const hexParticles: FireworkParticle[] = [];
            for (let i = 0; i < 6; i++) {
              const angle1 = (i / 6) * Math.PI * 2;
              const angle2 = ((i + 1) / 6) * Math.PI * 2;
              const x1 = Math.cos(angle1) * hexSize + pos.x;
              const y1 = Math.sin(angle1) * hexSize + pos.y;
              const x2 = Math.cos(angle2) * hexSize + pos.x;
              const y2 = Math.sin(angle2) * hexSize + pos.y;
              
              const segmentAngle = (angle1 + angle2) / 2;
              const speed = 2 + Math.random() * 3;
              const vx = Math.cos(segmentAngle) * speed;
              const vy = Math.sin(segmentAngle) * speed;
              
              hexParticles.push(createParticle(vx, vy, {
                shape: 'line',
                color: neonColor,
                lineSegments: [{x1, y1, x2, y2}],
                size: 4,
                glowSize: 6,
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                gravity: true,
                life: 140,
                max: 140
              }));
            }
            setParticles(prev => [...prev, ...hexParticles]);
          }, hexIdx * 80);
        });
        break;
        
      case 'lander-swarm':
        console.log('🚀 Creating LANDER SWARM pattern');
        
        const numLanders = 20 + Math.floor(Math.random() * 10);
        
        for (let i = 0; i < numLanders; i++) {
          const angle = (i / numLanders) * Math.PI * 2;
          const speed = 3 + Math.random() * 4;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          const shipScale = 8 + Math.random() * 4;
          const landerSegments = [
            // Main body (rectangle)
            {x1: -1 * shipScale, y1: -1 * shipScale, x2: 1 * shipScale, y2: -1 * shipScale},
            {x1: 1 * shipScale, y1: -1 * shipScale, x2: 1 * shipScale, y2: 1 * shipScale},
            {x1: 1 * shipScale, y1: 1 * shipScale, x2: -1 * shipScale, y2: 1 * shipScale},
            {x1: -1 * shipScale, y1: 1 * shipScale, x2: -1 * shipScale, y2: -1 * shipScale},
            // Landing legs
            {x1: -1 * shipScale, y1: 1 * shipScale, x2: -1.5 * shipScale, y2: 2 * shipScale},
            {x1: 1 * shipScale, y1: 1 * shipScale, x2: 1.5 * shipScale, y2: 2 * shipScale},
            // Thrust nozzle
            {x1: 0, y1: 1 * shipScale, x2: 0, y2: 1.5 * shipScale}
          ];
          
          newParticles.push(createParticle(vx, vy, {
            shape: 'ship',
            color: neonColor,
            lineSegments: landerSegments,
            size: shipScale,
            shipScale,
            glowSize: 10,
            rotationSpeed: (Math.random() - 0.5) * 0.5,
            gravity: true,
            life: 150,
            max: 150
          }));
        }
        
        // Explosion after 1 second
        setTimeout(() => {
          const debris: FireworkParticle[] = [];
          for (let i = 0; i < numLanders * 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 3;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            debris.push(createParticle(vx, vy, {
              shape: 'line',
              color: neonColor,
              lineSegments: [{x1: 0, y1: 0, x2: 5 + Math.random() * 5, y2: 0}],
              size: 2,
              glowSize: 4,
              rotationSpeed: (Math.random() - 0.5) * 0.6,
              gravity: true,
              life: 100,
              max: 100
            }));
          }
          setParticles(prev => [...prev, ...debris]);
        }, 1000);
        break;
        
      case 'pumpkin':
        console.log('🎃 Creating PUMPKIN pattern with ridges');
        const pumpkinSegments = 50;
        const pumpkinRadius = 60;
        
        for (let i = 0; i < pumpkinSegments; i++) {
          const t = (i / pumpkinSegments) * Math.PI * 2;
          // Pumpkin body with 5 vertical ridges
          const ridges = 5;
          const ridgeDepth = 0.15;
          const radius = pumpkinRadius * (1 - ridgeDepth * Math.abs(Math.sin(t * ridges)));
          
          const pumpkinX = Math.cos(t) * radius * 0.9; // Slightly wider
          const pumpkinY = Math.sin(t) * radius * 1.1; // Slightly taller
          
          // Add stem particles at top
          const isStem = pumpkinY < -pumpkinRadius * 0.8 && Math.abs(pumpkinX) < 10;
          
          // Halloween colors: neon orange and purple
          const halloweenColors = ['#FF6B35', '#FFA500', '#FF4500']; // Neon orange variants
          const pumpkinColor = halloweenColors[i % halloweenColors.length];
          
          newParticles.push(createParticle(pumpkinX * 0.08, pumpkinY * 0.08, {
            shape: 'circle',
            color: isStem ? '#8B4513' : pumpkinColor,
            size: isStem ? 3 : 4,
            glowSize: isStem ? 4 : 8,
            gravity: true,
            life: 150,
            max: 150
          }));
        }
        break;
        
      case 'bat':
        console.log('🦇 Creating BAT pattern with wings');
        const batSegments = 60;
        const batScale = 50;
        
        for (let i = 0; i < batSegments; i++) {
          const t = (i / batSegments) * Math.PI * 2;
          let batX, batY;
          
          // Body and head (center)
          if (Math.abs(Math.cos(t)) < 0.2) {
            batX = Math.cos(t) * 10;
            batY = Math.sin(t) * 15;
          } else {
            // Wings (swept curves on sides)
            const side = Math.cos(t) > 0 ? 1 : -1;
            const wingT = Math.abs(Math.sin(t));
            batX = side * (20 + wingT * 60);
            batY = Math.sin(t) * 30 - wingT * 20; // Wing curves
          }
          
          // Halloween colors: neon purple variants
          const purpleColors = ['#9D4EDD', '#C77DFF', '#E0AAFF'];
          const batColor = purpleColors[i % purpleColors.length];
          
          newParticles.push(createParticle(batX * 0.08, batY * 0.08, {
            shape: 'circle',
            color: batColor,
            size: 3,
            glowSize: 5,
            gravity: true,
            life: 140,
            max: 140
          }));
        }
        break;
        
      case 'snowflake':
        console.log('❄️ Creating SNOWFLAKE pattern');
        const branches = 6;
        const branchLength = 60;
        const sideBranchCount = 3;
        
        // Main branches
        for (let branch = 0; branch < branches; branch++) {
          const angle = (branch / branches) * Math.PI * 2;
          const branchSegments = 15;
          
          for (let i = 0; i < branchSegments; i++) {
            const t = i / branchSegments;
            const x = Math.cos(angle) * branchLength * t;
            const y = Math.sin(angle) * branchLength * t;
            
            // Christmas colors: white variants
            const whiteColors = ['#FFFFFF', '#F0F0F0', '#E8E8E8'];
            const snowColor = whiteColors[i % whiteColors.length];
            
            newParticles.push(createParticle(x * 0.08, y * 0.08, {
              shape: 'circle',
              color: snowColor,
              size: 3,
              glowSize: 6,
              gravity: false, // Snowflakes float
              life: 200,
              max: 200
            }));
            
            // Side branches at 40% and 60% along main branch
            if (t > 0.35 && t < 0.45 || t > 0.55 && t < 0.65) {
              const sideAngle1 = angle + Math.PI / 4;
              const sideAngle2 = angle - Math.PI / 4;
              const sideLength = branchLength * 0.3;
              
              const sx1 = x + Math.cos(sideAngle1) * sideLength * 0.5;
              const sy1 = y + Math.sin(sideAngle1) * sideLength * 0.5;
              const sx2 = x + Math.cos(sideAngle2) * sideLength * 0.5;
              const sy2 = y + Math.sin(sideAngle2) * sideLength * 0.5;
              
              const sideBranchColors = ['#FFFFFF', '#F0F0F0'];
              
              newParticles.push(createParticle(sx1 * 0.08, sy1 * 0.08, {
                shape: 'circle',
                color: sideBranchColors[0],
                size: 2,
                glowSize: 4,
                gravity: false,
                life: 200,
                max: 200
              }));
              
              newParticles.push(createParticle(sx2 * 0.08, sy2 * 0.08, {
                shape: 'circle',
                color: sideBranchColors[1],
                size: 2,
                glowSize: 4,
                gravity: false,
                life: 200,
                max: 200
              }));
            }
          }
        }
        break;
        
      case 'present':
        console.log('🎁 Creating PRESENT pattern');
        const boxWidth = 50;
        const boxHeight = 60;
        const ribbonWidth = 8;
        
        // Box outline (rectangular)
        const boxSegments = 40;
        for (let i = 0; i < boxSegments; i++) {
          const t = i / boxSegments;
          let x, y;
          
          if (t < 0.25) {
            // Top edge
            x = -boxWidth + (t * 4) * boxWidth * 2;
            y = -boxHeight;
          } else if (t < 0.5) {
            // Right edge
            x = boxWidth;
            y = -boxHeight + ((t - 0.25) * 4) * boxHeight * 2;
          } else if (t < 0.75) {
            // Bottom edge
            x = boxWidth - ((t - 0.5) * 4) * boxWidth * 2;
            y = boxHeight;
          } else {
            // Left edge
            x = -boxWidth;
            y = boxHeight - ((t - 0.75) * 4) * boxHeight * 2;
          }
          
          // Christmas colors: neon red for box, neon green for ribbon
          const isRibbon = Math.abs(x) < ribbonWidth || Math.abs(y) < ribbonWidth;
          const redColors = ['#FF3131', '#FF4444', '#FF6B6B'];
          const greenColors = ['#39FF14', '#7FFF00', '#32CD32'];
          const presentColor = isRibbon ? greenColors[i % greenColors.length] : redColors[i % redColors.length];
          
          newParticles.push(createParticle(x * 0.08, y * 0.08, {
            shape: 'circle',
            color: presentColor,
            size: isRibbon ? 4 : 3,
            glowSize: isRibbon ? 8 : 5,
            gravity: true,
            life: 150,
            max: 150
          }));
        }
        
        // Bow on top
        const bowSegments = 20;
        for (let i = 0; i < bowSegments; i++) {
          const t = (i / bowSegments) * Math.PI * 2;
          const bowX = Math.cos(t) * 15;
          const bowY = -boxHeight - 15 + Math.sin(t) * 10;
          
          // Christmas bow: neon red
          const bowColors = ['#FF3131', '#FF4444'];
          
          newParticles.push(createParticle(bowX * 0.08, bowY * 0.08, {
            shape: 'circle',
            color: bowColors[i % bowColors.length],
            size: 4,
            glowSize: 8,
            gravity: true,
            life: 150,
            max: 150
          }));
        }
        break;
        
      case 'stocking':
        console.log('🧦 Creating STOCKING pattern');
        const stockingSegments = 50;
        
        for (let i = 0; i < stockingSegments; i++) {
          const t = i / stockingSegments;
          let x, y;
          
          if (t < 0.2) {
            // Cuff (top horizontal part)
            x = -20 + t * 5 * 40;
            y = -50;
          } else if (t < 0.6) {
            // Vertical leg
            x = -20 + (t - 0.2) * 40;
            y = -50 + ((t - 0.2) / 0.4) * 80;
          } else {
            // Horizontal foot
            x = ((t - 0.6) / 0.4) * 50;
            y = 30;
          }
          
          // Christmas colors: white cuff, neon red and green body
          const greenColors = ['#39FF14', '#7FFF00', '#32CD32'];
          let color;
          if (t < 0.2) {
            color = '#FFFFFF'; // White cuff
          } else if (t < 0.4) {
            color = '#FF3131'; // Neon red
          } else {
            color = greenColors[i % greenColors.length]; // Neon green variants
          }
          
          newParticles.push(createParticle(x * 0.08, y * 0.08, {
            shape: 'circle',
            color,
            size: 4,
            glowSize: 6,
            gravity: true,
            life: 160,
            max: 160
          }));
        }
        break;
        
      case 'trophy':
        console.log('🏆 Creating TROPHY pattern');
        // Random trophy size for variety (small, medium, large)
        const trophySize = 0.6 + Math.random() * 0.8; // 0.6x to 1.4x size
        const trophySegments = 60;
        
        for (let i = 0; i < trophySegments; i++) {
          const t = i / trophySegments;
          let x, y;
          
          if (t < 0.5) {
            // Cup bowl (trapezoid top)
            const bowlT = t * 2;
            const angle = Math.PI + bowlT * Math.PI;
            const radius = (30 + Math.sin(bowlT * Math.PI) * 10) * trophySize;
            x = Math.cos(angle) * radius;
            y = (-40 + Math.sin(angle) * 25) * trophySize;
          } else if (t < 0.7) {
            // Thin stem
            const stemT = (t - 0.5) / 0.2;
            x = (Math.random() - 0.5) * 6 * trophySize;
            y = (-15 + stemT * 30) * trophySize;
          } else {
            // Wide base
            const baseT = (t - 0.7) / 0.3;
            x = (-25 + baseT * 50) * trophySize;
            y = 15 * trophySize;
          }
          
          newParticles.push(createParticle(x * 0.08, y * 0.08, {
            shape: 'circle',
            color: '#FFD700',
            size: 4 * trophySize,
            glowSize: 10 * trophySize,
            gravity: true,
            life: 180,
            max: 180,
            secondaryColor: '#FFA500'
          }));
        }
        
        // Add extra gold confetti around trophy (scaled by size)
        const confettiCount = Math.floor(30 * trophySize);
        for (let i = 0; i < confettiCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (3 + Math.random() * 4) * trophySize;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          newParticles.push(createParticle(vx, vy, {
            shape: 'star',
            color: '#FFD700',
            size: (3 + Math.random() * 2) * trophySize,
            glowSize: 8 * trophySize,
            gravity: true,
            life: 150,
            max: 150
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

  // Helper function to add seasonal patterns - returns EXCLUSIVE patterns for seasonal modes
  const getSeasonalPatterns = useCallback((
    basePatterns: string[], 
    landingType: 'normal' | '2x' | 'moving',
    forceSeason: 'halloween' | 'christmas' | null = null, 
    forceHighScore: boolean = false
  ) => {
    // PRIORITY 1: If high score, return ONLY trophy (regardless of season)
    if (isHighScore || forceHighScore) {
      return ['trophy'];
    }
    
    const now = new Date();
    const month = now.getMonth(); // 0 = January, 9 = October, 11 = December
    
    // PRIORITY 2: If Halloween (October or forced) - EXCLUSIVE patterns
    if (month === 9 || forceSeason === 'halloween') {
      if (landingType === 'normal') return ['bat'];
      if (landingType === '2x') return ['pumpkin'];
      if (landingType === 'moving') return ['bat', 'pumpkin'];
    }
    
    // PRIORITY 3: If Christmas (December or forced) - EXCLUSIVE patterns
    if (month === 11 || forceSeason === 'christmas') {
      if (landingType === 'normal') return ['snowflake'];
      if (landingType === '2x') return ['present'];
      if (landingType === 'moving') return ['stocking'];
    }
    
    // Not seasonal - return base patterns
    return basePatterns;
  }, [isHighScore]);

  // Spectacular fireworks launch sequence
  const launchFireworks = useCallback((
    overrideLandingType: string | null = null,
    forceSeason: 'halloween' | 'christmas' | null = null,
    forceHighScore: boolean = false
  ) => {
    if (hasLaunched.current || !canvasRef.current) return;
    hasLaunched.current = true;

    const canvas = canvasRef.current;
    const colors = getColors();
    const effectiveLandingType = overrideLandingType || landingType;
    
    // Different show types based on landing
    let launchCount: number, patterns: string[], timing: number;
    
    // PRIORITY 1: Check for special landing types first (retro-burst, ghost-beaten)
    if (effectiveLandingType === 'retro-burst') {
      launchCount = 12;
      patterns = getSeasonalPatterns(['pentagon-shatter', 'star-constellation', 'geometric-rose', 'vector-heart', 'hexagon-honeycomb', 'lander-swarm'], 'normal', forceSeason, forceHighScore);
      timing = 250;
    } else if (effectiveLandingType === 'ghost-beaten') {
      // Mix of ghosts and Pac-Man for arcade feel
      launchCount = lowGraphics ? 4 : 6;
      patterns = lowGraphics 
        ? ['ghost', 'ghost', 'pacman', 'giant-ghost']
        : ['ghost', 'giant-ghost', 'ghost', 'pacman', 'giant-ghost', 'ghost'];
      timing = 400;
    } else if (fireworkCount !== undefined && !overrideLandingType) {
      // PRIORITY 2: Use fireworkCount for survival mode (regular landings)
      launchCount = fireworkCount;
      patterns = getSeasonalPatterns(['starburst', 'spiral', 'heart', 'star', 'willow', 'chrysanthemum', 'crossette', 'double-burst', 'ring', 'palm'], 'normal', forceSeason, forceHighScore);
      timing = 300;
    } else {
      // PRIORITY 3: Use landingType for main game mode
      switch (effectiveLandingType) {
        case '2x':
          launchCount = 12;
          patterns = getSeasonalPatterns(['spiral', 'heart', 'star', 'chrysanthemum', 'crossette', 'double-burst'], '2x', forceSeason, forceHighScore);
          timing = 150;
          break;
        case 'moving':
          launchCount = 10;
          patterns = getSeasonalPatterns(['willow', 'chrysanthemum', 'crossette', 'starburst'], 'moving', forceSeason, forceHighScore);
          timing = 180;
          break;
        default:
          launchCount = 8;
          patterns = getSeasonalPatterns(['starburst', 'willow', 'star'], 'normal', forceSeason, forceHighScore);
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
            flashElements.current.push(flash);
            
            safeSetTimeout(() => {
              flash.style.opacity = '0';
              flash.style.transition = 'opacity 0.3s';
              safeSetTimeout(() => {
                if (document.body.contains(flash)) {
                  document.body.removeChild(flash);
                }
                flashElements.current = flashElements.current.filter(f => f !== flash);
              }, 300);
            }, 100);
          }
        }, 800 + Math.random() * 400);
      }, i * timing);
    }
    
    // Grand finale for ghost-beaten - Pac-Man chasing ghosts!
    if (landingType === 'ghost-beaten' && !lowGraphics) {
      setTimeout(() => {
        // Ghost parade across top
        const ghostCount = 4;
        for (let i = 0; i < ghostCount; i++) {
          const x = canvas.width * (0.2 + i * 0.2);
          const targetY = canvas.height * 0.3;
          setTimeout(() => {
            setParticles(prev => [...prev, ...createBurst(x, targetY, colors, 'ghost')]);
          }, i * 150);
        }
        
        // Pac-Man chase finale
        setTimeout(() => {
          const centerX = canvas.width * 0.5;
          const centerY = canvas.height * 0.5;
          setParticles(prev => [...prev, ...createBurst(centerX, centerY, colors, 'pacman')]);
        }, 700);
        
        // Final giant ghost burst
        setTimeout(() => {
          const centerX = canvas.width * 0.5;
          const centerY = canvas.height * 0.4;
          setParticles(prev => [...prev, ...createBurst(centerX, centerY, colors, 'giant-ghost')]);
        }, 1200);
      }, 2500);
    } else if (landingType === 'ghost-beaten' && lowGraphics) {
      // Simplified finale for low graphics
      setTimeout(() => {
        const centerX = canvas.width * 0.5;
        const centerY = canvas.height * 0.4;
        setParticles(prev => [...prev, ...createBurst(centerX, centerY, colors, 'giant-ghost')]);
      }, 2500);
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
  }, [landingType, getColors, createLaunch, createBurst, qualitySettings.particleMultiplier, safeSetTimeout]);

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

  // Cleanup effect for timeouts and flash elements on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts
      activeTimeouts.current.forEach(id => window.clearTimeout(id));
      activeTimeouts.current = [];
      
      // Remove any lingering flash elements from the DOM
      flashElements.current.forEach(flash => {
        if (document.body.contains(flash)) {
          document.body.removeChild(flash);
        }
      });
      flashElements.current = [];
    };
  }, []);

  // Launch fireworks after delay
  useEffect(() => {
    const timer = setTimeout(() => launchFireworks(null, forceSeason || null, isHighScore), 300); // Use props
    return () => clearTimeout(timer);
  }, [launchFireworks, forceSeason, isHighScore]);

  // Auto-complete after extended time for spectacular show
  useEffect(() => {
    const duration = fireworkCount !== undefined 
      ? Math.max(8000, fireworkCount * 300 + 4000) // Survival: launch time + 4s buffer for explosions
      : landingType === 'ghost-beaten' ? 10000 
      : landingType === '2x' ? 8000 
      : landingType === 'moving' ? 7000 
      : 6000;
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [onComplete, landingType]);

  // Handle input for skipping
  useEffect(() => {
    if (!allowSkip) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSkip, allowSkip]);

  // Gamepad input for skipping
  useEffect(() => {
    if (!allowSkip) return;
    
    const checkGamepad = () => {
      const gamepad = anyGamepad();
      if (gamepad && (gamepad.buttons[0]?.pressed || gamepad.buttons[1]?.pressed)) {
        onSkip();
      }
    };

    const interval = setInterval(checkGamepad, 100);
    return () => clearInterval(interval);
  }, [onSkip, allowSkip]);

  // F key debug cycling through firework displays
  useEffect(() => {
    const handleDebugKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') {
        // Clear existing particles and reset
        setParticles([]);
        hasLaunched.current = false;
        
        // Get current cycle config
        const config = debugCycleOrder.current[debugCycleIndex];
        console.log(`🎆 Debug Fireworks: ${config.label}`);
        
        // Launch fireworks with override parameters
        setTimeout(() => {
          launchFireworks(
            config.type as any,
            config.season as any,
            config.highScore
          );
        }, 100);
        
        // Advance to next cycle
        setDebugCycleIndex((prev) => (prev + 1) % debugCycleOrder.current.length);
      }
    };

    document.addEventListener('keydown', handleDebugKey);
    return () => document.removeEventListener('keydown', handleDebugKey);
  }, [debugCycleIndex]);
  
  // External debug trigger (for home screen button)
  useEffect(() => {
    if (debugCycleTrigger !== undefined && debugCycleTrigger > 0) {
      // Clear existing particles and reset
      setParticles([]);
      hasLaunched.current = false;
      
      // Use props directly instead of internal cycle state
      console.log(`🎆 External Trigger Fireworks: ${landingType} ${forceSeason ? `(${forceSeason})` : ''} ${isHighScore ? '(high score)' : ''}`);
      
      // Launch fireworks with props
      setTimeout(() => {
        launchFireworks(
          landingType as any,
          forceSeason || null,
          isHighScore
        );
      }, 100);
    }
  }, [debugCycleTrigger, landingType, forceSeason, isHighScore, launchFireworks]);

  // Touch screen input for skipping
  useEffect(() => {
    if (!allowSkip) return;
    
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      onSkip();
    };

    window.addEventListener('touchstart', handleTouch);
    return () => window.removeEventListener('touchstart', handleTouch);
  }, [onSkip, allowSkip]);

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
            // Ghost shapes now use simple circles arranged in bitmap patterns
            ctx.arc(0, 0, effectiveSize, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'pentagon':
          case 'triangle':
            if (particle.vertices && particle.vertices.length > 0) {
              ctx.fillStyle = particle.color;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(particle.vertices[0].x, particle.vertices[0].y);
              for (let i = 1; i < particle.vertices.length; i++) {
                ctx.lineTo(particle.vertices[i].x, particle.vertices[i].y);
              }
              ctx.closePath();
              ctx.fill();
              
              if (qualitySettings.enableGlow) {
                ctx.strokeStyle = particle.color;
                ctx.shadowColor = particle.color;
                ctx.shadowBlur = particle.glowSize * alpha;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.shadowBlur = 0;
              }
            }
            break;
          case 'line':
          case 'hexagon':
          case 'ship':
            if (particle.lineSegments && particle.lineSegments.length > 0) {
              ctx.strokeStyle = particle.color;
              ctx.lineWidth = particle.size;
              ctx.lineCap = 'round';
              ctx.globalAlpha = alpha;
              
              if (qualitySettings.enableGlow) {
                ctx.shadowColor = particle.color;
                ctx.shadowBlur = particle.glowSize * alpha;
              }
              
              particle.lineSegments.forEach(seg => {
                ctx.beginPath();
                ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
                ctx.stroke();
              });
              
              ctx.shadowBlur = 0;
            }
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
      
      {/* World Record Celebration Overlay */}
      {isWorldRecord && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center animate-pulse">
            <div className="text-6xl font-bold text-yellow-400 drop-shadow-[0_0_20px_rgba(255,215,0,0.8)] mb-4">
              🌍 NEW WORLD RECORD! 🏆
            </div>
            <div className="text-2xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]">
              You are the fastest pilot in the galaxy!
            </div>
          </div>
        </div>
      )}
      
      {fireworkCount === 1 && (
        <div 
          className="absolute bottom-8 text-center text-sm drop-shadow-lg pointer-events-none"
          style={{ color: neonColor, opacity: 0.8 }}
        >
          Press THRUST to continue
        </div>
      )}
    </div>
  );
};

export default FireworksDisplay;