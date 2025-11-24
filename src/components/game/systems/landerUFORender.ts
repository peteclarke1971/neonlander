import type { LanderUFO, UFOProjectile } from "../types/landerUFO";

export function drawUFO(
  ctx: CanvasRenderingContext2D,
  ufo: LanderUFO,
  neonColor: string,
  shadowBlur: number = 8
): void {
  if (!ufo.active) return;
  
  ctx.save();
  ctx.translate(ufo.x, ufo.y);
  
  // Apply glow effect
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = shadowBlur;
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 2;
  
  // Band dimensions (used for all sections)
  const bandWidth = 32;
  const bandHeight = 10;
  
  // === TOP SECTION (Mirror of bottom) ===
  ctx.beginPath();
  // Angled upper hull (trapezoid top - mirror of bottom)
  ctx.moveTo(-16, -2);  // Start at middle band edge
  ctx.lineTo(-10, -6);  // Angle outward (mirror of bottom)
  ctx.lineTo(10, -6);   // Top edge
  ctx.lineTo(16, -2);   // Angle back to middle band edge
  ctx.stroke();
  
  // Connect middle to top (ensure no gaps)
  ctx.beginPath();
  ctx.moveTo(-bandWidth / 2, -2);  // Left edge of middle band
  ctx.lineTo(-16, -2);              // Connect to left top section
  ctx.moveTo(bandWidth / 2, -2);   // Right edge of middle band  
  ctx.lineTo(16, -2);               // Connect to right top section
  ctx.stroke();
  
  // === MIDDLE SECTION (Rotating Band with Slits) ===
  const slitCount = 6;
  const slitWidth = 2;
  
  // Draw band outline
  ctx.beginPath();
  ctx.moveTo(-bandWidth / 2, -2);
  ctx.lineTo(bandWidth / 2, -2);
  ctx.lineTo(bandWidth / 2, -2 + bandHeight);
  ctx.lineTo(-bandWidth / 2, -2 + bandHeight);
  ctx.closePath();
  ctx.stroke();
  
  // Draw rotating slits (vertical bars)
  // bandRotation goes 0-1, representing full rotation cycle
  const slitSpacing = bandWidth / slitCount;
  for (let i = 0; i < slitCount; i++) {
    // Offset each slit based on rotation phase
    const xOffset = (ufo.bandRotation * slitSpacing * 2) % (slitSpacing * 2);
    const slitX = -bandWidth / 2 + i * slitSpacing + xOffset - slitSpacing;
    
    // Only draw if slit is within band bounds
    if (slitX >= -bandWidth / 2 && slitX <= bandWidth / 2) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; // Dark slits
      ctx.fillRect(slitX, -2, slitWidth, bandHeight);
    }
  }
  
  // === BOTTOM SECTION ===
  ctx.beginPath();
  // Angled lower hull (trapezoid bottom)
  ctx.moveTo(-16, 8);
  ctx.lineTo(-10, 12);
  ctx.lineTo(10, 12);
  ctx.lineTo(16, 8);
  ctx.lineTo(16, 8);
  ctx.stroke();
  
  // Connect middle to bottom
  ctx.beginPath();
  ctx.moveTo(-bandWidth / 2, -2 + bandHeight);
  ctx.lineTo(-16, 8);
  ctx.moveTo(bandWidth / 2, -2 + bandHeight);
  ctx.lineTo(16, 8);
  ctx.stroke();
  
  ctx.restore();
}

export function drawUFOProjectile(
  ctx: CanvasRenderingContext2D,
  projectile: UFOProjectile,
  neonColor: string
): void {
  if (!projectile.active) return;
  
  ctx.save();
  
  // Small glowing dot
  ctx.fillStyle = neonColor;
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 6;
  
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Add velocity streak for visual feedback
  const streakLength = 8;
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const streakX = projectile.x - Math.cos(angle) * streakLength;
  const streakY = projectile.y - Math.sin(angle) * streakLength;
  
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(projectile.x, projectile.y);
  ctx.lineTo(streakX, streakY);
  ctx.stroke();
  
  ctx.restore();
}

export function drawAllUFOs(
  ctx: CanvasRenderingContext2D,
  ufos: LanderUFO[],
  projectiles: UFOProjectile[],
  neonColor: string,
  shadowBlur: number = 8
): void {
  // Draw all UFOs
  for (const ufo of ufos) {
    drawUFO(ctx, ufo, neonColor, shadowBlur);
  }
  
  // Draw all projectiles
  for (const projectile of projectiles) {
    drawUFOProjectile(ctx, projectile, neonColor);
  }
}
