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
  trail: Array<{ x1: number; y1: number; x2: number; y2: number; alpha: number }>;
}

interface VectorFirework {
  type: string;
  x: number;
  y: number;
  lines: VectorLine[];
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

    const explosionY = canvas.height * 0.35; // 35% from top, above terrain

    // Firework positions matching diagram: left-left, left-center, right-right, right-center, center
    const fireworkPositions = [
      { x: canvas.width * 0.15, y: explosionY, scale: 0.3, delay: 0 },      // #1 - Far left, smallest
      { x: canvas.width * 0.35, y: explosionY, scale: 0.4, delay: 700 },    // #2 - Left of center
      { x: canvas.width * 0.85, y: explosionY, scale: 0.4, delay: 1400 },   // #3 - Far right  
      { x: canvas.width * 0.65, y: explosionY, scale: 0.4, delay: 2100 },   // #4 - Right of center
      { x: canvas.width * 0.50, y: explosionY, scale: 0.6, delay: 2800 }    // #5 - Center, largest (finale)
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

  // Gravity
  line.vy += 400 * dt;

  // Update position
  line.x1 += line.vx * dt;
  line.y1 += line.vy * dt;
  line.x2 += line.vx * dt;
  line.y2 += line.vy * dt;

  // Rotation
  line.rotation += line.rotationSpeed * dt;
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  line.x2 = line.x1 + Math.cos(line.rotation) * length;
  line.y2 = line.y1 + Math.sin(line.rotation) * length;

  // Trails disabled - they create too much clutter

  line.life -= dt;
}

function renderFirework(ctx: CanvasRenderingContext2D, firework: VectorFirework, lowGraphics: boolean) {
  firework.lines.forEach(line => {
    if (line.life > 0) {
      renderLine(ctx, line, lowGraphics);
    }
  });
}

function renderLine(ctx: CanvasRenderingContext2D, line: VectorLine, lowGraphics: boolean) {
  const lifeRatio = line.life / line.maxLife;
  
  // Two-phase fade: quick initial fade, then gradual burnout
  let alpha;
  if (lifeRatio > 0.85) {
    // Phase 1: Quick fade of initial shape (first 15% of life = ~0.3s)
    const fadeProgress = (lifeRatio - 0.85) / 0.15; // 0 to 1
    alpha = 0.3 + fadeProgress * 0.7; // Fades from 1.0 down to 0.3
  } else {
    // Phase 2: Gradual burnout (remaining 85% of life)
    alpha = (lifeRatio / 0.85) * 0.3; // Fades from 0.3 down to 0
  }

  // Main line
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
  const lines: VectorLine[] = [];
  const numTriangles = 5;
  const radius = 60 * scale;

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

    const centerX = (x1 + x2 + x3) / 3;
    const centerY = (y1 + y2 + y3) / 3;
    const velAngle = Math.atan2(centerY - y, centerX - x);
    const speed = (150 + Math.random() * 100) * scale;
    const vx = Math.cos(velAngle) * speed;
    const vy = Math.sin(velAngle) * speed;

    lines.push(
      createLine(x1, y1, x2, y2, vx, vy, color),
      createLine(x2, y2, x3, y3, vx, vy, color),
      createLine(x3, y3, x1, y1, vx, vy, color)
    );
  }

  return { type: 'polygon-chain', x, y, lines, color, active: true };
}

function createStarBurst(x: number, y: number, color: string, scale: number): VectorFirework {
  const lines: VectorLine[] = [];
  const numRays = 6; // Reduced from 8
  const outerRadius = 80 * scale;

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;

    const x1 = x + Math.cos(angle) * outerRadius;
    const y1 = y + Math.sin(angle) * outerRadius;

    const velAngle = Math.atan2(y1 - y, x1 - x);
    const speed = (200 + Math.random() * 80) * scale;
    const vx = Math.cos(velAngle) * speed;
    const vy = Math.sin(velAngle) * speed;

    // Only the ray from center to tip (removed connecting lines)
    lines.push(createLine(x, y, x1, y1, vx, vy, color));
  }

  return { type: 'star-burst', x, y, lines, color, active: true };
}

function createGeometricRose(x: number, y: number, color: string, scale: number): VectorFirework {
  const lines: VectorLine[] = [];
  const numPetals = 4; // Reduced from 6
  const radius = 70 * scale;

  for (let i = 0; i < numPetals; i++) {
    const angle = (i / numPetals) * Math.PI * 2;
    const nextAngle = ((i + 1) / numPetals) * Math.PI * 2;

    const x1 = x + Math.cos(angle) * radius;
    const y1 = y + Math.sin(angle) * radius;
    const x2 = x + Math.cos(nextAngle) * radius;
    const y2 = y + Math.sin(nextAngle) * radius;

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const velAngle = Math.atan2(centerY - y, centerX - x);
    const speed = (120 + Math.random() * 100) * scale;
    const vx = Math.cos(velAngle) * speed;
    const vy = Math.sin(velAngle) * speed;

    // Simplified to 2 lines per petal (removed middle point)
    lines.push(
      createLine(x, y, x1, y1, vx, vy, color),
      createLine(x1, y1, x2, y2, vx, vy, color)
    );
  }

  return { type: 'geometric-rose', x, y, lines, color, active: true };
}

function createHeartCascade(x: number, y: number, color: string, scale: number): VectorFirework {
  const lines: VectorLine[] = [];
  const numHearts = 2; // Reduced from 4

  for (let h = 0; h < numHearts; h++) {
    const heartScale = 0.7 + h * 0.2;
    const size = 40 * scale * heartScale;
    const offsetAngle = (h / numHearts) * Math.PI * 2;
    const offsetRadius = 50;
    const heartX = x + Math.cos(offsetAngle) * offsetRadius;
    const heartY = y + Math.sin(offsetAngle) * offsetRadius;

    const points: [number, number][] = [];
    for (let i = 0; i <= 10; i++) { // Reduced from 20 to 10 segments
      const t = (i / 10) * Math.PI * 2;
      const hx = heartX + size * (16 * Math.pow(Math.sin(t), 3));
      const hy = heartY - size * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      points.push([hx, hy]);
    }

    const velAngle = Math.atan2(heartY - y, heartX - x);
    const speed = (100 + Math.random() * 80) * scale;
    const vx = Math.cos(velAngle) * speed;
    const vy = Math.sin(velAngle) * speed;

    for (let i = 0; i < points.length - 1; i++) {
      lines.push(createLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], vx, vy, color));
    }
  }

  return { type: 'heart-cascade', x, y, lines, color, active: true };
}

function createHexagonalHoneycomb(x: number, y: number, color: string, scale: number): VectorFirework {
  const lines: VectorLine[] = [];
  const hexSize = 35 * scale;
  const pattern = [
    [0, 0],      // Center
    [1, 0],      // Right
    [-1, 0]      // Left
  ]; // Reduced from 7 hexagons to 3

  pattern.forEach(([px, py]) => {
    const centerX = x + px * hexSize * 1.5;
    const centerY = y + py * hexSize * 1.5;

    for (let i = 0; i < 6; i++) {
      const angle1 = (i / 6) * Math.PI * 2;
      const angle2 = ((i + 1) / 6) * Math.PI * 2;

      const x1 = centerX + Math.cos(angle1) * hexSize;
      const y1 = centerY + Math.sin(angle1) * hexSize;
      const x2 = centerX + Math.cos(angle2) * hexSize;
      const y2 = centerY + Math.sin(angle2) * hexSize;

      const velAngle = Math.atan2(centerY - y, centerX - x);
      const speed = (130 + Math.random() * 70) * scale;
      const vx = Math.cos(velAngle) * speed;
      const vy = Math.sin(velAngle) * speed;

      lines.push(createLine(x1, y1, x2, y2, vx, vy, color));
    }
  });

  return { type: 'hexagonal-honeycomb', x, y, lines, color, active: true };
}

function createLine(
  x1: number, y1: number,
  x2: number, y2: number,
  vx: number, vy: number,
  color: string
): VectorLine {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const lifespan = 1.5 + Math.random() * 1; // Reduced from 3-5s to 1.5-2.5s
  return {
    x1, y1, x2, y2,
    vx: vx + (Math.random() - 0.5) * 40,
    vy: vy + (Math.random() - 0.5) * 40,
    rotation: angle,
    // 20% chance for dramatic spiral effect
    rotationSpeed: Math.random() < 0.2 ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 2,
    life: lifespan,
    maxLife: lifespan,
    color,
    trail: []
  };
}
