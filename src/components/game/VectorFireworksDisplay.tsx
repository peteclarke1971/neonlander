import { useEffect, useRef, useState } from 'react';

interface VectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  color: string;
  length: number; // Preserve line segment length
  trail: Array<{ x1: number; y1: number; x2: number; y2: number; alpha: number }>;
}

interface VectorFirework {
  type: string;
  x: number;
  y: number;
  lines: VectorLine[];
  shapeLinesStatic: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
  color: string;
  active: boolean;
  createdAt: number;
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

    // Firework positions with varied heights
    const fireworkPositions = [
      { x: canvas.width * 0.15, y: canvas.height * 0.30, scale: 0.3, delay: 0 },      // #1 - Far left, highest
      { x: canvas.width * 0.35, y: canvas.height * 0.33, scale: 0.4, delay: 700 },    // #2 - Left of center
      { x: canvas.width * 0.85, y: canvas.height * 0.37, scale: 0.4, delay: 1400 },   // #3 - Far right, lowest
      { x: canvas.width * 0.65, y: canvas.height * 0.35, scale: 0.4, delay: 2100 },   // #4 - Right of center
      { x: canvas.width * 0.50, y: canvas.height * 0.32, scale: 0.6, delay: 2800 }    // #5 - Center, largest
    ];

    const factories = [
      createPolygonChain,
      createStarBurst,
      createGeometricRose,
      createHeartCascade,
      createHexagonalHoneycomb
    ];

    fireworkPositions.forEach((pos, index) => {
      setTimeout(() => {
        fireworksRef.current.push(factories[index](pos.x, pos.y, paletteColor, pos.scale));
      }, pos.delay);
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

      // Clear with fade (faster clear = less clutter)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and render
      fireworksRef.current = fireworksRef.current.filter(firework => {
        if (!firework.active) return false;
        updateFirework(firework, dt);
        renderFirework(ctx, firework, lowGraphics);
        return firework.lines.some(line => line.life > 0);
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
  firework.lines.forEach(line => {
    updateVectorLine(line, dt);
  });
}

function updateVectorLine(line: VectorLine, dt: number) {
  if (line.life <= 0) return;

  const gravity = 0.2;
  const airResistance = 0.998;
  
  // Update start point (the actual particle position)
  line.x1 += line.vx * dt * 60; // Convert to pixels per frame
  line.y1 += line.vy * dt * 60;
  
  // Apply gravity to velocity
  line.vy += gravity * dt * 60;
  
  // Apply air resistance
  line.vx *= airResistance;
  line.vy *= airResistance;
  
  // Update rotation
  line.rotation += line.rotationSpeed * dt;
  
  // Calculate end point based on start point + length + rotation
  // This keeps the line segment intact as a single unit
  line.x2 = line.x1 + Math.cos(line.rotation) * line.length;
  line.y2 = line.y1 + Math.sin(line.rotation) * line.length;
  
  // Update life
  line.life -= dt;
}

function renderFirework(ctx: CanvasRenderingContext2D, firework: VectorFirework, lowGraphics: boolean) {
  const elapsed = (Date.now() - firework.createdAt) / 1000;
  
  // Phase 1: Render static shape (0-1s, fades out)
  if (elapsed < 1.0) {
    const shapeAlpha = 1.0 - elapsed;
    ctx.strokeStyle = firework.color;
    ctx.globalAlpha = shapeAlpha;
    ctx.lineWidth = 2;
    
    firework.shapeLinesStatic.forEach(line => {
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    });
    
    ctx.globalAlpha = 1;
  }
  
  // Phase 2: Render burst pieces (start visible after 0.5s)
  if (elapsed > 0.5) {
    firework.lines.forEach(line => {
      if (line.life > 0) {
        renderLine(ctx, line, lowGraphics);
      }
    });
  }
}

function renderLine(ctx: CanvasRenderingContext2D, line: VectorLine, lowGraphics: boolean) {
  const age = line.maxLife - line.life; // Time since creation
  
  let alpha;
  
  // Phase 1: Quick initial shape fade (first 0.2 seconds FIXED)
  if (age < 0.2) {
    alpha = 1.0 - (age / 0.2) * 0.7; // Fades from 1.0 to 0.3 in 0.2s
  } 
  // Phase 2: Gradual burnout (remaining life)
  else {
    const burnoutRatio = (age - 0.2) / (line.maxLife - 0.2);
    alpha = 0.3 * (1 - burnoutRatio); // Fades from 0.3 to 0
  }
  
  ctx.strokeStyle = line.color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = lowGraphics ? 1.5 : 2;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  ctx.moveTo(line.x1, line.y1);
  ctx.lineTo(line.x2, line.y2);
  ctx.stroke();
  
  ctx.globalAlpha = 1;
}

// Factory functions - create fireworks that explode at position

function createPolygonChain(x: number, y: number, color: string, scale: number): VectorFirework {
  const shapeLinesStatic: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  const lines: VectorLine[] = [];
  
  // Create static shape outline (5 triangles)
  const numTriangles = 5;
  const radius = 80 * scale;
  
  for (let i = 0; i < numTriangles; i++) {
    const angle1 = (i / numTriangles) * Math.PI * 2 - Math.PI / 2;
    const angle2 = ((i + 1) / numTriangles) * Math.PI * 2 - Math.PI / 2;
    const angle3 = ((i + 0.5) / numTriangles) * Math.PI * 2 - Math.PI / 2;
    
    const x1 = x + Math.cos(angle1) * radius;
    const y1 = y + Math.sin(angle1) * radius;
    const x2 = x + Math.cos(angle2) * radius;
    const y2 = y + Math.sin(angle2) * radius;
    const x3 = x + Math.cos(angle3) * radius * 0.5;
    const y3 = y + Math.sin(angle3) * radius * 0.5;
    
    shapeLinesStatic.push(
      { x1, y1, x2: x3, y2: y3 },
      { x1: x3, y1: y3, x2, y2 },
      { x1: x2, y1: y2, x2: x1, y2: y1 }
    );
  }
  
  // Generate 80-120 random burst pieces
  const numPieces = 80 + Math.floor(Math.random() * 40);
  for (let i = 0; i < numPieces; i++) {
    const randomAngle = Math.random() * Math.PI * 2;
    const fakeOffsetX = Math.cos(randomAngle) * 1000;
    const fakeOffsetY = Math.sin(randomAngle) * 1000;
    lines.push(createLine(x, y, x, y, fakeOffsetX, fakeOffsetY, color, scale));
  }

  return { type: 'polygon-chain', x, y, lines, shapeLinesStatic, color, active: true, createdAt: Date.now() };
}

function createStarBurst(x: number, y: number, color: string, scale: number): VectorFirework {
  const shapeLinesStatic: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  const lines: VectorLine[] = [];
  
  // Create static shape outline (6 rays)
  const numRays = 6;
  const rayLength = 80 * scale;
  
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;
    shapeLinesStatic.push({
      x1: x,
      y1: y,
      x2: x + Math.cos(angle) * rayLength,
      y2: y + Math.sin(angle) * rayLength
    });
  }
  
  // Generate 80-120 random burst pieces
  const numPieces = 80 + Math.floor(Math.random() * 40);
  for (let i = 0; i < numPieces; i++) {
    const randomAngle = Math.random() * Math.PI * 2;
    const fakeOffsetX = Math.cos(randomAngle) * 1000;
    const fakeOffsetY = Math.sin(randomAngle) * 1000;
    lines.push(createLine(x, y, x, y, fakeOffsetX, fakeOffsetY, color, scale));
  }

  return { type: 'star-burst', x, y, lines, shapeLinesStatic, color, active: true, createdAt: Date.now() };
}

function createGeometricRose(x: number, y: number, color: string, scale: number): VectorFirework {
  const shapeLinesStatic: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  const lines: VectorLine[] = [];
  
  // Create static shape outline (4 petals)
  const numPetals = 4;
  const radius = 80 * scale;
  
  for (let i = 0; i < numPetals; i++) {
    const angle = (i / numPetals) * Math.PI * 2;
    const nextAngle = ((i + 1) / numPetals) * Math.PI * 2;
    
    const x1 = x + Math.cos(angle) * radius;
    const y1 = y + Math.sin(angle) * radius;
    const x2 = x + Math.cos(nextAngle) * radius;
    const y2 = y + Math.sin(nextAngle) * radius;
    
    shapeLinesStatic.push(
      { x1: x, y1: y, x2: x1, y2: y1 },
      { x1: x1, y1: y1, x2: x2, y2: y2 }
    );
  }
  
  // Generate 80-120 random burst pieces
  const numPieces = 80 + Math.floor(Math.random() * 40);
  for (let i = 0; i < numPieces; i++) {
    const randomAngle = Math.random() * Math.PI * 2;
    const fakeOffsetX = Math.cos(randomAngle) * 1000;
    const fakeOffsetY = Math.sin(randomAngle) * 1000;
    lines.push(createLine(x, y, x, y, fakeOffsetX, fakeOffsetY, color, scale));
  }

  return { type: 'geometric-rose', x, y, lines, shapeLinesStatic, color, active: true, createdAt: Date.now() };
}

function createHeartCascade(x: number, y: number, color: string, scale: number): VectorFirework {
  const shapeLinesStatic: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  const lines: VectorLine[] = [];
  
  // Create static shape outline (heart)
  const size = 80 * scale;
  const heartPoints: Array<[number, number]> = [];
  
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    const hx = size * 0.8 * (16 * Math.pow(Math.sin(t), 3));
    const hy = -size * 0.8 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    heartPoints.push([x + hx, y + hy]);
  }
  
  for (let i = 0; i < heartPoints.length - 1; i++) {
    shapeLinesStatic.push({
      x1: heartPoints[i][0],
      y1: heartPoints[i][1],
      x2: heartPoints[i + 1][0],
      y2: heartPoints[i + 1][1]
    });
  }
  
  // Generate 80-120 random burst pieces
  const numPieces = 80 + Math.floor(Math.random() * 40);
  for (let i = 0; i < numPieces; i++) {
    const randomAngle = Math.random() * Math.PI * 2;
    const fakeOffsetX = Math.cos(randomAngle) * 1000;
    const fakeOffsetY = Math.sin(randomAngle) * 1000;
    lines.push(createLine(x, y, x, y, fakeOffsetX, fakeOffsetY, color, scale));
  }

  return { type: 'heart-cascade', x, y, lines, shapeLinesStatic, color, active: true, createdAt: Date.now() };
}

function createHexagonalHoneycomb(x: number, y: number, color: string, scale: number): VectorFirework {
  const shapeLinesStatic: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  const lines: VectorLine[] = [];
  
  // Create static shape outline (honeycomb pattern)
  const hexSize = 80 * scale;
  const pattern = [
    [0, 0],      // Center
    [1, 0],      // Right
    [-1, 0]      // Left
  ];
  
  pattern.forEach(([px, py]) => {
    const hexCenterX = x + px * hexSize * 1.5;
    const hexCenterY = y + py * hexSize * 1.5;
    
    for (let i = 0; i < 6; i++) {
      const angle1 = (i / 6) * Math.PI * 2;
      const angle2 = ((i + 1) / 6) * Math.PI * 2;
      
      shapeLinesStatic.push({
        x1: hexCenterX + Math.cos(angle1) * hexSize,
        y1: hexCenterY + Math.sin(angle1) * hexSize,
        x2: hexCenterX + Math.cos(angle2) * hexSize,
        y2: hexCenterY + Math.sin(angle2) * hexSize
      });
    }
  });
  
  // Generate 80-120 random burst pieces
  const numPieces = 80 + Math.floor(Math.random() * 40);
  for (let i = 0; i < numPieces; i++) {
    const randomAngle = Math.random() * Math.PI * 2;
    const fakeOffsetX = Math.cos(randomAngle) * 1000;
    const fakeOffsetY = Math.sin(randomAngle) * 1000;
    lines.push(createLine(x, y, x, y, fakeOffsetX, fakeOffsetY, color, scale));
  }

  return { type: 'hexagonal-honeycomb', x, y, lines, shapeLinesStatic, color, active: true, createdAt: Date.now() };
}

function createLine(
  x1: number, y1: number,      // Start position (center)
  x2: number, y2: number,      // Initial end (just slightly offset)
  targetOffsetX: number,       // Where this piece SHOULD go (shape offset)
  targetOffsetY: number,       // 
  color: string,
  scale: number
): VectorLine {
  // Calculate angle to target position (truly random 360°)
  const angle = Math.atan2(targetOffsetY, targetOffsetX);
  
  // Massive speed variance (20-100 pixels/frame) for 5x difference
  const speed = (20 + Math.random() * 80) * scale;
  
  // Velocity in direction of random angle
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  
  // Position end point along the burst direction (15-25 pixels out)
  const initialLength = 15 + Math.random() * 10;
  x2 = x1 + Math.cos(angle) * initialLength;
  y2 = y1 + Math.sin(angle) * initialLength;
  
  const length = initialLength;
  const lifespan = 1.5 + Math.random() * 1;
  
  return {
    x1, y1, x2, y2,
    vx, vy,
    color,
    rotation: angle,
    rotationSpeed: 0, // No rotation for burst pieces - just sparks
    life: lifespan,
    maxLife: lifespan,
    length,
    trail: []
  };
}
