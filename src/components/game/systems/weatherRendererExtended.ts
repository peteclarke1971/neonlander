import { LightningAfterglow, LightningImpact } from "./weather";

/**
 * Render screen flash effect when lightning strikes
 */
export function renderLightningFlash(
  ctx: CanvasRenderingContext2D,
  flashAlpha: number,
  canvasWidth: number,
  canvasHeight: number,
  dpr: number
): void {
  if (flashAlpha <= 0) return;
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.3})`;
  ctx.fillRect(0, 0, canvasWidth * dpr, canvasHeight * dpr);
  ctx.restore();
}

/**
 * Render afterglow trails that fade after bolt disappears
 */
export function renderLightningAfterglow(
  ctx: CanvasRenderingContext2D,
  glow: LightningAfterglow,
  dpr: number,
  lowGraphics: boolean
): void {
  if (glow.segments.length < 2 || glow.alpha <= 0) return;
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  
  if (lowGraphics) {
    ctx.globalAlpha = glow.alpha;
    ctx.strokeStyle = 'hsl(200, 100%, 80%)';
    ctx.lineWidth = 4 * dpr;
  } else {
    // Soft glow trail
    ctx.globalAlpha = glow.alpha * 0.6;
    ctx.strokeStyle = 'hsl(200, 100%, 75%)';
    ctx.lineWidth = 8 * dpr;
    ctx.shadowColor = 'rgba(150, 200, 255, 0.5)';
    ctx.shadowBlur = 12 * dpr;
  }
  
  ctx.beginPath();
  ctx.moveTo(glow.segments[0].x * dpr, glow.segments[0].y * dpr);
  for (let i = 1; i < glow.segments.length; i++) {
    ctx.lineTo(glow.segments[i].x * dpr, glow.segments[i].y * dpr);
  }
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Render lightning impact flash at terrain collision point
 */
export function renderLightningImpact(
  ctx: CanvasRenderingContext2D,
  impact: LightningImpact,
  cameraX: number,
  zoom: number,
  anchor: number,
  canvasHeight: number,
  dpr: number
): void {
  const fadeProgress = impact.life / impact.maxLife;
  const alpha = 1 - fadeProgress;
  
  if (alpha <= 0) return;
  
  // Convert world coordinates to screen coordinates
  const screenX = (impact.x - cameraX) * zoom + anchor;
  const screenY = impact.y * zoom + canvasHeight / 2;
  
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  
  // Radial gradient flash
  const gradient = ctx.createRadialGradient(
    screenX * dpr, screenY * dpr, 0,
    screenX * dpr, screenY * dpr, impact.radius * zoom * dpr
  );
  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
  gradient.addColorStop(0.4, `rgba(180, 220, 255, ${alpha * 0.5})`);
  gradient.addColorStop(0.7, `rgba(150, 200, 255, ${alpha * 0.2})`);
  gradient.addColorStop(1, 'rgba(150, 200, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX * dpr, screenY * dpr, impact.radius * zoom * dpr, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Render ozone glow effect when lightning is active
 */
export function renderOzoneGlow(
  ctx: CanvasRenderingContext2D,
  activeBoltCount: number,
  canvasWidth: number,
  canvasHeight: number,
  dpr: number
): void {
  if (activeBoltCount === 0) return;
  
  const ozoneAlpha = Math.min(activeBoltCount * 0.015, 0.08);
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(150, 100, 255, ${ozoneAlpha})`;
  ctx.fillRect(0, 0, canvasWidth * dpr, canvasHeight * dpr);
  ctx.restore();
}
