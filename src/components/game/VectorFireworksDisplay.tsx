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

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Schedule 5 fireworks to spawn in center with delays
    const fireworkSchedule = [
      { delay: 0, factory: createPolygonChain },
      { delay: 2400, factory: createStarBurst },
      { delay: 4800, factory: createGeometricRose },
      { delay: 7200, factory: createHeartCascade },
      { delay: 9600, factory: createHexagonalHoneycomb }
    ];

    fireworkSchedule.forEach(({ delay, factory }) => {
      setTimeout(() => {
        fireworksRef.current.push(factory(centerX, centerY, paletteColor));
      }, delay);
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
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

      if (elapsed > 12) {
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

  // Trail
  if (line.trail.length === 0 || Math.random() < 0.3) {
    line.trail.push({
      x1: line.x1, y1: line.y1,
      x2: line.x2, y2: line.y2,
      alpha: 1.0
    });
    if (line.trail.length > 8) line.trail.shift();
  }
  line.trail.forEach(t => t.alpha *= 0.92);

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
  const alpha = Math.min(1, line.life / line.maxLife);

  // Trail
  line.trail.forEach(t => {
    if (t.alpha > 0.05) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${t.alpha * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
  });

  // Main line
  ctx.strokeStyle = line.color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  
  if (!lowGraphics) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = line.color;
  }
  
  ctx.beginPath();
  ctx.moveTo(line.x1, line.y1);
  ctx.lineTo(line.x2, line.y2);
  ctx.stroke();
  
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// Factory functions - create fireworks that explode at position

function createPolygonChain(x: number, y: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  const numTriangles = 5;
  const radius = 60;

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
    const speed = 150 + Math.random() * 100;
    const vx = Math.cos(velAngle) * speed;
    const vy = Math.sin(velAngle) * speed - 50;

    lines.push(
      createLine(x1, y1, x2, y2, vx, vy, color),
      createLine(x2, y2, x3, y3, vx, vy, color),
      createLine(x3, y3, x1, y1, vx, vy, color)
    );
  }

  return { type: 'polygon-chain', x, y, lines, color, active: true };
}

function createStarBurst(x: number, y: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  const numRays = 8;
  const innerRadius = 30;
  const outerRadius = 80;

  for (let i = 0; i < numRays; i++) {
    const angle1 = (i / numRays) * Math.PI * 2;
    const angle2 = ((i + 0.5) / numRays) * Math.PI * 2;

    const x1 = x + Math.cos(angle1) * outerRadius;
    const y1 = y + Math.sin(angle1) * outerRadius;
    const x2 = x + Math.cos(angle2) * innerRadius;
    const y2 = y + Math.sin(angle2) * innerRadius;

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const velAngle = Math.atan2(centerY - y, centerX - x);
    const speed = 200 + Math.random() * 80;
    const vx = Math.cos(velAngle) * speed;
    const vy = Math.sin(velAngle) * speed - 30;

    lines.push(
      createLine(x, y, x1, y1, vx, vy, color),
      createLine(x1, y1, x2, y2, vx, vy, color)
    );
  }

  return { type: 'star-burst', x, y, lines, color, active: true };
}

function createGeometricRose(x: number, y: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  const numPetals = 6;
  const radius = 70;

  for (let i = 0; i < numPetals; i++) {
    const angle = (i / numPetals) * Math.PI * 2;
    const nextAngle = ((i + 1) / numPetals) * Math.PI * 2;

    const x1 = x + Math.cos(angle) * radius;
    const y1 = y + Math.sin(angle) * radius;
    const x2 = x + Math.cos(nextAngle) * radius;
    const y2 = y + Math.sin(nextAngle) * radius;
    
    const midAngle = (angle + nextAngle) / 2;
    const x3 = x + Math.cos(midAngle) * radius * 0.4;
    const y3 = y + Math.sin(midAngle) * radius * 0.4;

    const centerX = (x1 + x2 + x3) / 3;
    const centerY = (y1 + y2 + y3) / 3;
    const velAngle = Math.atan2(centerY - y, centerX - x);
    const speed = 120 + Math.random() * 100;
    const vx = Math.cos(velAngle) * speed;
    const vy = Math.sin(velAngle) * speed - 40;

    lines.push(
      createLine(x1, y1, x3, y3, vx, vy, color),
      createLine(x3, y3, x2, y2, vx, vy, color),
      createLine(x2, y2, x, y, vx, vy, color)
    );
  }

  return { type: 'geometric-rose', x, y, lines, color, active: true };
}

function createHeartCascade(x: number, y: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  const numHearts = 4;

  for (let h = 0; h < numHearts; h++) {
    const scale = 0.6 + h * 0.15;
    const size = 40 * scale;
    const offsetAngle = (h / numHearts) * Math.PI * 2;
    const offsetRadius = 50;
    const heartX = x + Math.cos(offsetAngle) * offsetRadius;
    const heartY = y + Math.sin(offsetAngle) * offsetRadius;

    const points: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      const hx = heartX + size * (16 * Math.pow(Math.sin(t), 3));
      const hy = heartY - size * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      points.push([hx, hy]);
    }

    const velAngle = Math.atan2(heartY - y, heartX - x);
    const speed = 100 + Math.random() * 80;
    const vx = Math.cos(velAngle) * speed;
    const vy = Math.sin(velAngle) * speed - 60;

    for (let i = 0; i < points.length - 1; i++) {
      lines.push(createLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], vx, vy, color));
    }
  }

  return { type: 'heart-cascade', x, y, lines, color, active: true };
}

function createHexagonalHoneycomb(x: number, y: number, color: string): VectorFirework {
  const lines: VectorLine[] = [];
  const hexSize = 35;
  const pattern = [
    [0, 0],
    [1, 0], [-1, 0],
    [0.5, 0.866], [-0.5, 0.866],
    [0.5, -0.866], [-0.5, -0.866]
  ];

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
      const speed = 130 + Math.random() * 70;
      const vx = Math.cos(velAngle) * speed;
      const vy = Math.sin(velAngle) * speed - 50;

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
  return {
    x1, y1, x2, y2,
    vx: vx + (Math.random() - 0.5) * 40,
    vy: vy + (Math.random() - 0.5) * 40,
    rotation: angle,
    rotationSpeed: (Math.random() - 0.5) * 3,
    life: 3 + Math.random() * 2,
    maxLife: 3 + Math.random() * 2,
    color,
    trail: []
  };
}
