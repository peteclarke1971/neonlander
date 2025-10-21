import { WeatherParticle, LightningBolt } from "./weather";

/**
 * Render neon rain particles (screen-space)
 */
export function renderRainParticles(
  ctx: CanvasRenderingContext2D,
  particles: WeatherParticle[],
  dpr: number,
  lowGraphics: boolean
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  
  for (const p of particles) {
    if (p.type !== "rain") continue;
    
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size * dpr;
    
    if (!lowGraphics) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 3 * dpr;
    }
    
    // Draw raindrop as line
    const length = 10 + Math.random() * 20;
    ctx.beginPath();
    ctx.moveTo(p.x * dpr, p.y * dpr);
    ctx.lineTo(p.x * dpr + p.vx * 0.02, (p.y + length) * dpr);
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Render dust cloud particles (world-space)
 */
export function renderDustClouds(
  ctx: CanvasRenderingContext2D,
  particles: WeatherParticle[],
  cameraX: number,
  zoom: number,
  anchor: number,
  color: string,
  dpr: number,
  lowGraphics: boolean
): void {
  ctx.save();
  
  for (const p of particles) {
    if (p.type !== "dust") continue;
    
    const screenX = (p.x - cameraX) * zoom + anchor;
    const screenY = p.y * zoom;
    
    ctx.globalAlpha = p.alpha * 0.6;
    
    if (lowGraphics) {
      // Simple circles in low graphics mode
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenX * dpr, screenY * dpr, p.size * zoom * dpr, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Radial gradient for soft edges
      const gradient = ctx.createRadialGradient(
        screenX * dpr, screenY * dpr, 0,
        screenX * dpr, screenY * dpr, p.size * zoom * dpr
      );
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(0.5, p.color.replace(/[\d.]+\)/, '0.5)'));
      gradient.addColorStop(1, p.color.replace(/[\d.]+\)/, '0)'));
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX * dpr, screenY * dpr, p.size * zoom * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

/**
 * Render plasma drizzle particles (screen-space)
 */
export function renderPlasmaParticles(
  ctx: CanvasRenderingContext2D,
  particles: WeatherParticle[],
  dpr: number,
  lowGraphics: boolean
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter'; // Additive blending for glow
  
  for (const p of particles) {
    if (p.type !== "spark") continue;
    
    ctx.globalAlpha = p.alpha;
    
    if (!lowGraphics) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8 * dpr;
    }
    
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr, 0, Math.PI * 2);
    ctx.fill();
    
    // Additional glow halo
    if (!lowGraphics) {
      ctx.globalAlpha = p.alpha * 0.3;
      ctx.beginPath();
      ctx.arc(p.x * dpr, p.y * dpr, p.size * 1.8 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

/**
 * Render lightning bolts (screen-space)
 */
export function renderLightningBolts(
  ctx: CanvasRenderingContext2D,
  bolts: LightningBolt[],
  dpr: number,
  lowGraphics: boolean
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  for (const bolt of bolts) {
    renderSingleBolt(ctx, bolt, dpr, lowGraphics);
    
    // Render branches
    for (const branch of bolt.branches) {
      renderSingleBolt(ctx, branch, dpr, lowGraphics);
    }
  }
  
  ctx.restore();
}

function renderSingleBolt(
  ctx: CanvasRenderingContext2D,
  bolt: LightningBolt,
  dpr: number,
  lowGraphics: boolean
): void {
  if (bolt.segments.length < 2) return;
  
  const fadeProgress = bolt.life / bolt.maxLife;
  const alpha = bolt.alpha * (1 - fadeProgress);
  
  // Main bolt
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'hsl(200, 100%, 95%)';
  ctx.lineWidth = 2 * dpr;
  
  if (!lowGraphics) {
    ctx.shadowColor = 'rgba(180, 220, 255, 0.8)';
    ctx.shadowBlur = 10 * dpr;
  }
  
  ctx.beginPath();
  ctx.moveTo(bolt.segments[0].x * dpr, bolt.segments[0].y * dpr);
  for (let i = 1; i < bolt.segments.length; i++) {
    ctx.lineTo(bolt.segments[i].x * dpr, bolt.segments[i].y * dpr);
  }
  ctx.stroke();
  
  // Outer glow
  if (!lowGraphics) {
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = 'hsl(200, 100%, 80%)';
    ctx.lineWidth = 6 * dpr;
    ctx.shadowBlur = 20 * dpr;
    
    ctx.beginPath();
    ctx.moveTo(bolt.segments[0].x * dpr, bolt.segments[0].y * dpr);
    for (let i = 1; i < bolt.segments.length; i++) {
      ctx.lineTo(bolt.segments[i].x * dpr, bolt.segments[i].y * dpr);
    }
    ctx.stroke();
  }
}

/**
 * Render rainbow diffraction effect after plasma drizzle
 */
export function renderRainbowDiffraction(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  alpha: number,
  dpr: number
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  
  const colors = [
    'hsl(0, 100%, 60%)',     // Red
    'hsl(30, 100%, 60%)',    // Orange
    'hsl(60, 100%, 60%)',    // Yellow
    'hsl(120, 100%, 60%)',   // Green
    'hsl(210, 100%, 60%)',   // Blue
    'hsl(270, 100%, 60%)',   // Indigo
    'hsl(300, 100%, 60%)'    // Violet
  ];
  
  const bandHeight = canvasHeight / colors.length;
  
  for (let i = 0; i < colors.length; i++) {
    ctx.globalAlpha = alpha * 0.1;
    ctx.fillStyle = colors[i];
    ctx.fillRect(0, i * bandHeight * dpr, canvasWidth * dpr, bandHeight * dpr);
  }
  
  ctx.restore();
}

/**
 * Render landing pad residue glow after rain
 */
export function renderPadResidue(
  ctx: CanvasRenderingContext2D,
  padX: number,
  padY: number,
  padWidth: number,
  alpha: number,
  color: string,
  dpr: number
): void {
  if (alpha <= 0) return;
  
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 15 * dpr;
  ctx.fillStyle = color;
  
  // Draw glowing line on pad
  ctx.fillRect(padX * dpr, padY * dpr, padWidth * dpr, 2 * dpr);
  
  ctx.restore();
}

/**
 * Update and render lightning bolts
 */
export function updateLightningBolts(
  bolts: LightningBolt[],
  dt: number
): void {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const bolt = bolts[i];
    bolt.life += dt;
    
    // Update branches
    for (let j = bolt.branches.length - 1; j >= 0; j--) {
      bolt.branches[j].life += dt;
      if (bolt.branches[j].life >= bolt.branches[j].maxLife) {
        bolt.branches.splice(j, 1);
      }
    }
    
    // Remove expired bolts
    if (bolt.life >= bolt.maxLife) {
      bolts.splice(i, 1);
    }
  }
}
