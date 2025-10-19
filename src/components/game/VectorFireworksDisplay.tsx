import { useEffect, useRef, useState } from 'react';

interface VectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  vx: number;
  vy: number;
  rotationCenter: { x: number; y: number };
  rotationSpeed: number;
  life: number;
  maxLife: number;
  color: string;
  glowSize: number;
  trailPoints: Array<{ x1: number; y1: number; x2: number; y2: number; alpha: number }>;
}

interface VectorFirework {
  type: 'polygon-chain' | 'star-burst' | 'geometric-rose' | 'heart-cascade' | 'hexagonal-honeycomb';
  x: number;
  y: number;
  state: 'launch' | 'form' | 'hold' | 'explode';
  stateTimer: number;
  lines: VectorLine[];
  color: string;
  launchLine?: VectorLine;
}

interface Props {
  neonColor: string;
  paletteColor: string;
  onComplete: () => void;
  onSkip: () => void;
  lowGraphics: boolean;
}

const GRAVITY = 400;
const TRAIL_LENGTH = 8;
const LOW_GRAPHICS_TRAIL_LENGTH = 3;

export const VectorFireworksDisplay = ({ paletteColor, onComplete, onSkip, lowGraphics }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [skipMessage, setSkipMessage] = useState(false);
  const fireworksRef = useRef<VectorFirework[]>([]);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const displayTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize fireworks with staggered launch times
    fireworksRef.current = [
      createPolygonChain(canvas.width / 2, canvas.height, paletteColor, 0),
      createStarBurst(canvas.width / 3, canvas.height, paletteColor, 0.6),
      createGeometricRose((canvas.width * 2) / 3, canvas.height, paletteColor, 1.2),
      createHeartCascade(canvas.width / 2, canvas.height, paletteColor, 1.8),
      createHexagonalHoneycomb(canvas.width / 2, canvas.height, paletteColor, 2.4)
    ];

    lastTimeRef.current = performance.now();
    displayTimeRef.current = 0;

    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = currentTime;
      displayTimeRef.current += dt;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and render all fireworks
      fireworksRef.current.forEach(firework => {
        updateFirework(firework, dt);
        renderFirework(ctx, firework, lowGraphics);
      });

      // Check if display is complete
      if (displayTimeRef.current > 12) {
        onComplete();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Show skip message after 1 second
    const skipTimeout = setTimeout(() => setSkipMessage(true), 1000);

    // Keyboard handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearTimeout(skipTimeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [paletteColor, onComplete, onSkip, lowGraphics]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" />
      {skipMessage && (
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-sm animate-fade-in cursor-pointer pointer-events-auto"
          onClick={onSkip}
        >
          Press THRUST to skip
        </div>
      )}
    </div>
  );
};

function updateFirework(firework: VectorFirework, dt: number) {
  firework.stateTimer += dt;

  if (firework.state === 'launch') {
    // Update launch line
    if (firework.launchLine) {
      const line = firework.launchLine;
      line.rotationCenter.y -= 800 * dt; // Rise upward
      line.y1 = line.rotationCenter.y - 30;
      line.y2 = line.rotationCenter.y + 30;
      
      // Update trail
      line.trailPoints.unshift({ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, alpha: 1.0 });
      if (line.trailPoints.length > TRAIL_LENGTH) line.trailPoints.pop();
      line.trailPoints.forEach(tp => tp.alpha *= 0.85);
    }

    if (firework.stateTimer > 1.0) {
      firework.state = 'form';
      firework.stateTimer = 0;
      firework.launchLine = undefined;
    }
  } else if (firework.state === 'form') {
    // Shape is forming - lines gradually appear
    if (firework.stateTimer > 0.5) {
      firework.state = 'hold';
      firework.stateTimer = 0;
    }
  } else if (firework.state === 'hold') {
    // Shape pulses and rotates
    const pulseScale = 1 + Math.sin(firework.stateTimer * 8) * 0.05;
    firework.lines.forEach(line => {
      const dx1 = (line.x1 - firework.x) * pulseScale;
      const dy1 = (line.y1 - firework.y) * pulseScale;
      const dx2 = (line.x2 - firework.x) * pulseScale;
      const dy2 = (line.y2 - firework.y) * pulseScale;
      
      line.x1 = firework.x + dx1;
      line.y1 = firework.y + dy1;
      line.x2 = firework.x + dx2;
      line.y2 = firework.y + dy2;
    });

    if (firework.stateTimer > 1.0) {
      firework.state = 'explode';
      firework.stateTimer = 0;
      // Initialize velocities for explosion
      firework.lines.forEach(line => {
        const angle = Math.atan2(line.rotationCenter.y - firework.y, line.rotationCenter.x - firework.x);
        const speed = 150 + Math.random() * 100;
        line.vx = Math.cos(angle) * speed;
        line.vy = Math.sin(angle) * speed - 100; // Add upward bias
      });
    }
  } else if (firework.state === 'explode') {
    // Physics simulation
    firework.lines.forEach(line => {
      updateVectorLine(line, dt);
    });
  }
}

function updateVectorLine(line: VectorLine, dt: number) {
  // Apply gravity
  line.vy += GRAVITY * dt;
  
  // Update rotation center position
  line.rotationCenter.x += line.vx * dt;
  line.rotationCenter.y += line.vy * dt;
  
  // Calculate rotation
  const totalRotation = line.rotationSpeed * line.life;
  
  // Store original line vector
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const originalAngle = Math.atan2(dy, dx);
  
  // Apply rotation
  const newAngle = originalAngle + totalRotation;
  
  // Update endpoints around rotation center
  line.x1 = line.rotationCenter.x - (length / 2) * Math.cos(newAngle);
  line.y1 = line.rotationCenter.y - (length / 2) * Math.sin(newAngle);
  line.x2 = line.rotationCenter.x + (length / 2) * Math.cos(newAngle);
  line.y2 = line.rotationCenter.y + (length / 2) * Math.sin(newAngle);
  
  // Update trail
  line.trailPoints.unshift({ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, alpha: 1.0 });
  if (line.trailPoints.length > TRAIL_LENGTH) line.trailPoints.pop();
  line.trailPoints.forEach(tp => tp.alpha *= 0.85);
  
  line.life += dt;
}

function renderFirework(ctx: CanvasRenderingContext2D, firework: VectorFirework, lowGraphics: boolean) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Render launch line
  if (firework.state === 'launch' && firework.launchLine) {
    renderLine(ctx, firework.launchLine, lowGraphics);
  }

  // Render shape lines
  if (firework.state !== 'launch') {
    const alpha = firework.state === 'form' ? Math.min(firework.stateTimer / 0.5, 1) : 1;
    ctx.globalAlpha = alpha;
    
    firework.lines.forEach(line => {
      renderLine(ctx, line, lowGraphics);
    });
  }

  ctx.restore();
}

function renderLine(ctx: CanvasRenderingContext2D, line: VectorLine, lowGraphics: boolean) {
  const trailLength = lowGraphics ? LOW_GRAPHICS_TRAIL_LENGTH : TRAIL_LENGTH;
  
  // Render trail
  line.trailPoints.slice(0, trailLength).forEach((tp, i) => {
    ctx.save();
    ctx.globalAlpha = tp.alpha * 0.3;
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tp.x1, tp.y1);
    ctx.lineTo(tp.x2, tp.y2);
    ctx.stroke();
    ctx.restore();
  });

  // Render main line
  ctx.save();
  if (!lowGraphics) {
    ctx.shadowBlur = line.glowSize;
    ctx.shadowColor = line.color;
  }
  ctx.strokeStyle = line.color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(line.x1, line.y1);
  ctx.lineTo(line.x2, line.y2);
  ctx.stroke();
  ctx.restore();
}

// Factory functions for the 5 firework types

function createPolygonChain(x: number, y: number, color: string, delay: number): VectorFirework {
  const launchY = y - 250; // Launch height
  const lines: VectorLine[] = [];
  
  // Create pentagon that will break into 5 triangles
  const radius = 60;
  for (let i = 0; i < 5; i++) {
    const angle1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const angle2 = ((i + 1) / 5) * Math.PI * 2 - Math.PI / 2;
    const angle3 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
    
    const x1 = x + Math.cos(angle1) * radius;
    const y1 = launchY + Math.sin(angle1) * radius;
    const x2 = x + Math.cos(angle2) * radius;
    const y2 = launchY + Math.sin(angle2) * radius;
    const x3 = x + Math.cos(angle3) * radius * 0.5;
    const y3 = launchY + Math.sin(angle3) * radius * 0.5;
    
    // Each triangle is 3 lines
    const centerX = (x1 + x2 + x3) / 3;
    const centerY = (y1 + y2 + y3) / 3;
    
    [
      { x1, y1, x2, y2 },
      { x1: x2, y1: y2, x2: x3, y2: y3 },
      { x1: x3, y1: y3, x2: x1, y2: y1 }
    ].forEach(seg => {
      lines.push({
        x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2,
        vx: 0, vy: 0,
        rotationCenter: { x: centerX, y: centerY },
        rotationSpeed: (Math.random() - 0.5) * 4,
        life: 0, maxLife: 6,
        color, glowSize: 10,
        trailPoints: []
      });
    });
  }

  return {
    type: 'polygon-chain',
    x, y: launchY,
    state: delay === 0 ? 'launch' : 'launch',
    stateTimer: -delay,
    lines,
    color,
    launchLine: {
      x1: x, y1: y, x2: x, y2: y,
      vx: 0, vy: -800,
      rotationCenter: { x, y },
      rotationSpeed: 0,
      life: 0, maxLife: 1,
      color, glowSize: 12,
      trailPoints: []
    }
  };
}

function createStarBurst(x: number, y: number, color: string, delay: number): VectorFirework {
  const launchY = y - 250;
  const lines: VectorLine[] = [];
  
  // Create 5-pointed star that breaks into 10 segments
  const outerRadius = 70;
  const innerRadius = 30;
  
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const innerAngle = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
    const nextOuterAngle = ((i + 1) / 5) * Math.PI * 2 - Math.PI / 2;
    
    const x1 = x + Math.cos(outerAngle) * outerRadius;
    const y1 = launchY + Math.sin(outerAngle) * outerRadius;
    const x2 = x + Math.cos(innerAngle) * innerRadius;
    const y2 = launchY + Math.sin(innerAngle) * innerRadius;
    const x3 = x + Math.cos(nextOuterAngle) * outerRadius;
    const y3 = launchY + Math.sin(nextOuterAngle) * outerRadius;
    
    // Outer to inner
    lines.push({
      x1, y1, x2, y2,
      vx: 0, vy: 0,
      rotationCenter: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
      rotationSpeed: (Math.random() - 0.5) * 6,
      life: 0, maxLife: 6,
      color, glowSize: 10,
      trailPoints: []
    });
    
    // Inner to next outer
    lines.push({
      x1: x2, y1: y2, x2: x3, y2: y3,
      vx: 0, vy: 0,
      rotationCenter: { x: (x2 + x3) / 2, y: (y2 + y3) / 2 },
      rotationSpeed: (Math.random() - 0.5) * 6,
      life: 0, maxLife: 6,
      color, glowSize: 10,
      trailPoints: []
    });
  }

  return {
    type: 'star-burst',
    x, y: launchY,
    state: 'launch',
    stateTimer: -delay,
    lines,
    color,
    launchLine: {
      x1: x, y1: y, x2: x, y2: y,
      vx: 0, vy: -800,
      rotationCenter: { x, y },
      rotationSpeed: 0,
      life: 0, maxLife: 1,
      color, glowSize: 12,
      trailPoints: []
    }
  };
}

function createGeometricRose(x: number, y: number, color: string, delay: number): VectorFirework {
  const launchY = y - 250;
  const lines: VectorLine[] = [];
  
  // Create 3 concentric circles
  const radii = [30, 50, 70];
  const segments = 16;
  
  radii.forEach(radius => {
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;
      
      const x1 = x + Math.cos(angle1) * radius;
      const y1 = launchY + Math.sin(angle1) * radius;
      const x2 = x + Math.cos(angle2) * radius;
      const y2 = launchY + Math.sin(angle2) * radius;
      
      lines.push({
        x1, y1, x2, y2,
        vx: 0, vy: 0,
        rotationCenter: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
        rotationSpeed: (Math.random() - 0.5) * 3,
        life: 0, maxLife: 6,
        color, glowSize: 10,
        trailPoints: []
      });
    }
  });

  return {
    type: 'geometric-rose',
    x, y: launchY,
    state: 'launch',
    stateTimer: -delay,
    lines,
    color,
    launchLine: {
      x1: x, y1: y, x2: x, y2: y,
      vx: 0, vy: -800,
      rotationCenter: { x, y },
      rotationSpeed: 0,
      life: 0, maxLife: 1,
      color, glowSize: 12,
      trailPoints: []
    }
  };
}

function createHeartCascade(x: number, y: number, color: string, delay: number): VectorFirework {
  const launchY = y - 250;
  const lines: VectorLine[] = [];
  
  // Create heart shape with line segments
  const scale = 40;
  const points: Array<{ x: number; y: number }> = [];
  
  // Generate heart curve
  for (let t = 0; t <= Math.PI * 2; t += Math.PI / 10) {
    const hx = x + scale * (16 * Math.pow(Math.sin(t), 3));
    const hy = launchY - scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
    points.push({ x: hx, y: hy });
  }
  
  // Connect points with lines
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    lines.push({
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      vx: 0, vy: 0,
      rotationCenter: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      rotationSpeed: (Math.random() - 0.5) * 2,
      life: 0, maxLife: 6,
      color, glowSize: 10,
      trailPoints: []
    });
  }

  return {
    type: 'heart-cascade',
    x, y: launchY,
    state: 'launch',
    stateTimer: -delay,
    lines,
    color,
    launchLine: {
      x1: x, y1: y, x2: x, y2: y,
      vx: 0, vy: -800,
      rotationCenter: { x, y },
      rotationSpeed: 0,
      life: 0, maxLife: 1,
      color, glowSize: 12,
      trailPoints: []
    }
  };
}

function createHexagonalHoneycomb(x: number, y: number, color: string, delay: number): VectorFirework {
  const launchY = y - 300;
  const lines: VectorLine[] = [];
  
  // Create center hexagon + 6 satellite hexagons
  const hexRadius = 40;
  const satelliteDistance = hexRadius * 1.8;
  
  // Helper to create hexagon lines
  const createHexagon = (cx: number, cy: number) => {
    const hexLines: VectorLine[] = [];
    for (let i = 0; i < 6; i++) {
      const angle1 = (i / 6) * Math.PI * 2;
      const angle2 = ((i + 1) / 6) * Math.PI * 2;
      
      const x1 = cx + Math.cos(angle1) * hexRadius;
      const y1 = cy + Math.sin(angle1) * hexRadius;
      const x2 = cx + Math.cos(angle2) * hexRadius;
      const y2 = cy + Math.sin(angle2) * hexRadius;
      
      hexLines.push({
        x1, y1, x2, y2,
        vx: 0, vy: 0,
        rotationCenter: { x: cx, y: cy },
        rotationSpeed: (Math.random() - 0.5) * 5,
        life: 0, maxLife: 6,
        color, glowSize: 12,
        trailPoints: []
      });
    }
    return hexLines;
  };
  
  // Center hexagon
  lines.push(...createHexagon(x, launchY));
  
  // 6 satellite hexagons
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const sx = x + Math.cos(angle) * satelliteDistance;
    const sy = launchY + Math.sin(angle) * satelliteDistance;
    lines.push(...createHexagon(sx, sy));
  }

  return {
    type: 'hexagonal-honeycomb',
    x, y: launchY,
    state: 'launch',
    stateTimer: -delay,
    lines,
    color,
    launchLine: {
      x1: x, y1: y, x2: x, y2: y,
      vx: 0, vy: -800,
      rotationCenter: { x, y },
      rotationSpeed: 0,
      life: 0, maxLife: 1,
      color, glowSize: 12,
      trailPoints: []
    }
  };
}
