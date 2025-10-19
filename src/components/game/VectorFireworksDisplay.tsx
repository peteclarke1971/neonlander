import { useEffect, useRef, useState } from 'react';

interface VectorLine {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  color: string;
  length: number;
  type: 'launch' | 'burst';
}

interface VectorFirework {
  type: string;
  x: number;
  y: number;
  targetY: number;
  lines: VectorLine[];
  launchPhase: boolean;
  launchTime: number;
  burstTime: number | null;
  color: string;
  active: boolean;
}

interface Props {
  neonColor: string;
  paletteColor: string;
  onComplete: () => void;
  onSkip: () => void;
  lowGraphics: boolean;
}

export const VectorFireworksDisplay = ({ paletteColor, onComplete, onSkip, lowGraphics }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [skipMessage, setSkipMessage] = useState(false);
  const fireworksRef = useRef<VectorFirework[]>([]);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Launch 5 fireworks with staggered timing (matches particle version)
    const fireworkConfigs = [
      { delay: 0, x: canvas.width * 0.15, targetY: canvas.height * 0.30, pattern: 'polygon-chain' },
      { delay: 700, x: canvas.width * 0.35, targetY: canvas.height * 0.33, pattern: 'star-burst' },
      { delay: 1400, x: canvas.width * 0.85, targetY: canvas.height * 0.37, pattern: 'geometric-rose' },
      { delay: 2100, x: canvas.width * 0.65, targetY: canvas.height * 0.35, pattern: 'heart-cascade' },
      { delay: 2800, x: canvas.width * 0.50, targetY: canvas.height * 0.32, pattern: 'hexagonal-honeycomb' }
    ];

    const factoryMap: Record<string, typeof createStarBurst> = {
      'polygon-chain': createPolygonChain,
      'star-burst': createStarBurst,
      'geometric-rose': createGeometricRose,
      'heart-cascade': createHeartCascade,
      'hexagonal-honeycomb': createHexagonalHoneycomb
    };

    fireworkConfigs.forEach(config => {
      setTimeout(() => {
        const factory = factoryMap[config.pattern];
        fireworksRef.current.push(
          factory(config.x, canvas.height, config.targetY, paletteColor)
        );
      }, config.delay);
    });

    function animate() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const now = Date.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      const elapsed = (now - startTimeRef.current) / 1000;

      // Clear with fade
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and render
      fireworksRef.current = fireworksRef.current.filter(firework => {
        if (!firework.active) return false;
        updateFirework(firework, dt);
        renderFirework(ctx, firework, lowGraphics);
        return firework.active;
      });

      if (elapsed > 2 && !skipMessage) {
        setSkipMessage(true);
      }

      if (elapsed > 10) {
        onComplete();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    animate();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [paletteColor, onComplete, onSkip, lowGraphics, skipMessage]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full"
        style={{ background: 'transparent' }}
      />
      {skipMessage && (
        <div 
          className="absolute bottom-8 text-center text-white/80 text-sm drop-shadow-lg cursor-pointer pointer-events-auto"
          onClick={onSkip}
        >
          Press THRUST to skip
        </div>
      )}
    </div>
  );
};

function updateFirework(firework: VectorFirework, dt: number) {
  const elapsed = (Date.now() - firework.launchTime) / 1000;

  // STAGE 1: Launch phase (0-0.8 seconds)
  if (firework.launchPhase && elapsed < 0.8) {
    const launchLine = firework.lines[0];
    if (launchLine) {
      launchLine.x += launchLine.vx * dt * 60;
      launchLine.y += launchLine.vy * dt * 60;
      
      firework.x = launchLine.x;
      firework.y = launchLine.y;
      
      // Check if reached target
      if (launchLine.y <= firework.targetY || elapsed >= 0.8) {
        triggerBurst(firework);
      }
    }
  }
  
  // STAGE 2: Burst phase (after 0.8s)
  else if (!firework.launchPhase) {
    let anyAlive = false;
    
    firework.lines.forEach(line => {
      if (line.type === 'burst' && line.life > 0) {
        // Apply velocity
        line.x += line.vx * dt * 60;
        line.y += line.vy * dt * 60;
        
        // Apply gravity
        line.vy += 0.2 * dt * 60;
        
        // Apply air resistance
        line.vx *= 0.998;
        line.vy *= 0.998;
        
        // Update rotation for tumbling effect
        line.rotation += line.rotationSpeed * dt;
        
        // Decay life
        line.life -= dt;
        
        if (line.life > 0) anyAlive = true;
      }
    });
    
    if (!anyAlive) {
      firework.active = false;
    }
  }
}

function triggerBurst(firework: VectorFirework) {
  firework.launchPhase = false;
  firework.burstTime = Date.now();
  
  // Remove launch comet line
  firework.lines = [];
  
  // Generate 100-120 burst lines INSTANTLY
  const numLines = 100 + Math.floor(Math.random() * 20);
  
  for (let i = 0; i < numLines; i++) {
    // TRULY RANDOM 360° angle
    const angle = Math.random() * Math.PI * 2;
    
    // Random speed (3-7 pixels/frame, matching particle version)
    const speed = 3 + Math.random() * 4;
    
    const line: VectorLine = {
      x: firework.x,
      y: firework.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: angle,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      life: 1.5 + Math.random() * 1.0,
      maxLife: 1.5 + Math.random() * 1.0,
      color: firework.color,
      length: 15 + Math.random() * 10,
      type: 'burst'
    };
    
    firework.lines.push(line);
  }
}

function renderFirework(ctx: CanvasRenderingContext2D, firework: VectorFirework, lowGraphics: boolean) {
  firework.lines.forEach(line => {
    if (line.life <= 0) return;
    
    // Calculate fade alpha
    const lifeRatio = line.life / line.maxLife;
    const alpha = Math.pow(lifeRatio, 0.5);
    
    // Calculate line endpoints from center position + rotation + length
    const x1 = line.x - Math.cos(line.rotation) * line.length / 2;
    const y1 = line.y - Math.sin(line.rotation) * line.length / 2;
    const x2 = line.x + Math.cos(line.rotation) * line.length / 2;
    const y2 = line.y + Math.sin(line.rotation) * line.length / 2;
    
    // Draw line
    ctx.strokeStyle = line.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = line.type === 'launch' ? 3 : (lowGraphics ? 1.5 : 2);
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  
  ctx.globalAlpha = 1;
}

// Factory functions - create fireworks with launch comets

function createPolygonChain(startX: number, startY: number, targetY: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  
  // Create single launch comet line
  const launchLine: VectorLine = {
    x: startX,
    y: startY,
    vx: 0,
    vy: -(startY - targetY) / 50,
    rotation: -Math.PI / 2,
    rotationSpeed: 0,
    life: 50,
    maxLife: 50,
    color,
    length: 20,
    type: 'launch'
  };
  
  lines.push(launchLine);
  
  return {
    type: 'polygon-chain',
    x: startX,
    y: startY,
    targetY,
    lines,
    launchPhase: true,
    launchTime: Date.now(),
    burstTime: null,
    color,
    active: true
  };
}

function createStarBurst(startX: number, startY: number, targetY: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  
  const launchLine: VectorLine = {
    x: startX,
    y: startY,
    vx: 0,
    vy: -(startY - targetY) / 50,
    rotation: -Math.PI / 2,
    rotationSpeed: 0,
    life: 50,
    maxLife: 50,
    color,
    length: 20,
    type: 'launch'
  };
  
  lines.push(launchLine);
  
  return {
    type: 'star-burst',
    x: startX,
    y: startY,
    targetY,
    lines,
    launchPhase: true,
    launchTime: Date.now(),
    burstTime: null,
    color,
    active: true
  };
}

function createGeometricRose(startX: number, startY: number, targetY: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  
  const launchLine: VectorLine = {
    x: startX,
    y: startY,
    vx: 0,
    vy: -(startY - targetY) / 50,
    rotation: -Math.PI / 2,
    rotationSpeed: 0,
    life: 50,
    maxLife: 50,
    color,
    length: 20,
    type: 'launch'
  };
  
  lines.push(launchLine);
  
  return {
    type: 'geometric-rose',
    x: startX,
    y: startY,
    targetY,
    lines,
    launchPhase: true,
    launchTime: Date.now(),
    burstTime: null,
    color,
    active: true
  };
}

function createHeartCascade(startX: number, startY: number, targetY: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  
  const launchLine: VectorLine = {
    x: startX,
    y: startY,
    vx: 0,
    vy: -(startY - targetY) / 50,
    rotation: -Math.PI / 2,
    rotationSpeed: 0,
    life: 50,
    maxLife: 50,
    color,
    length: 20,
    type: 'launch'
  };
  
  lines.push(launchLine);
  
  return {
    type: 'heart-cascade',
    x: startX,
    y: startY,
    targetY,
    lines,
    launchPhase: true,
    launchTime: Date.now(),
    burstTime: null,
    color,
    active: true
  };
}

function createHexagonalHoneycomb(startX: number, startY: number, targetY: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  
  const launchLine: VectorLine = {
    x: startX,
    y: startY,
    vx: 0,
    vy: -(startY - targetY) / 50,
    rotation: -Math.PI / 2,
    rotationSpeed: 0,
    life: 50,
    maxLife: 50,
    color,
    length: 20,
    type: 'launch'
  };
  
  lines.push(launchLine);
  
  return {
    type: 'hexagonal-honeycomb',
    x: startX,
    y: startY,
    targetY,
    lines,
    launchPhase: true,
    launchTime: Date.now(),
    burstTime: null,
    color,
    active: true
  };
}
