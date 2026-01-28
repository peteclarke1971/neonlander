import React, { useEffect, useRef } from 'react';

interface LanderAnimationProps {
  size?: number;
  showThrust?: boolean;
  showRotation?: boolean;
  showLanding?: boolean;
  showShield?: boolean;
  showSpaceJunk?: boolean;
}

/**
 * Animated lander visualization for guide pages.
 * Uses canvas for smooth 30fps animations.
 */
export const LanderAnimation: React.FC<LanderAnimationProps> = ({
  size = 100,
  showThrust = false,
  showRotation = false,
  showLanding = false,
  showShield = false,
  showSpaceJunk = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;

    const drawLander = (x: number, y: number, angle: number, thrustOn: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Ship body (triangle)
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-8, 10);
      ctx.lineTo(0, 6);
      ctx.lineTo(8, 10);
      ctx.closePath();
      ctx.fillStyle = 'hsl(var(--neon))';
      ctx.fill();
      ctx.strokeStyle = 'hsl(var(--neon))';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Landing legs
      ctx.beginPath();
      ctx.moveTo(-6, 10);
      ctx.lineTo(-10, 16);
      ctx.moveTo(6, 10);
      ctx.lineTo(10, 16);
      ctx.strokeStyle = 'hsl(var(--neon))';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Thrust flame
      if (thrustOn) {
        const flameHeight = 8 + Math.random() * 4;
        ctx.beginPath();
        ctx.moveTo(-4, 10);
        ctx.lineTo(0, 10 + flameHeight);
        ctx.lineTo(4, 10);
        ctx.fillStyle = `hsl(${30 + Math.random() * 20}, 100%, ${50 + Math.random() * 20}%)`;
        ctx.fill();
      }

      ctx.restore();
    };

    const drawShieldBubble = (x: number, y: number, time: number) => {
      const pulse = 1 + Math.sin(time * 4) * 0.05;
      const radius = 22 * pulse;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(280, 100%, 70%, ${0.6 + Math.sin(time * 3) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'hsla(280, 100%, 70%, 0)');
      gradient.addColorStop(0.7, 'hsla(280, 100%, 70%, 0.05)');
      gradient.addColorStop(1, 'hsla(280, 100%, 70%, 0.15)');
      ctx.fillStyle = gradient;
      ctx.fill();
    };

    const drawSpaceJunk = (x: number, y: number, time: number) => {
      const hue = (time * 60) % 360;
      const rotation = time * 2;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      
      // Star/junk shape
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const r = i % 2 === 0 ? 8 : 4;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
      ctx.fill();
      ctx.strokeStyle = `hsl(${hue}, 100%, 80%)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Glow effect
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.restore();
    };

    const drawPad = (x: number, y: number, width: number) => {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y);
      ctx.lineTo(x + width / 2, y);
      ctx.strokeStyle = 'hsl(120, 100%, 50%)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Glow
      ctx.shadowColor = 'hsl(120, 100%, 50%)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;

      ctx.clearRect(0, 0, size, size);

      if (showThrust && showRotation) {
        // Rotating ship with thrust demo
        const angle = Math.sin(elapsed * 1.5) * 0.6;
        const thrust = Math.sin(elapsed * 3) > 0;
        drawLander(centerX, centerY, angle, thrust);
      } else if (showLanding) {
        // Landing sequence demo
        const cycle = elapsed % 4;
        let y = centerY - 20 + (cycle / 4) * 35;
        const angle = Math.sin(elapsed * 2) * 0.1;
        const thrust = cycle < 3;
        
        drawPad(centerX, centerY + 20, 30);
        drawLander(centerX, Math.min(y, centerY + 8), angle, thrust);
      } else if (showShield) {
        // Shield bubble demo
        const angle = Math.sin(elapsed) * 0.2;
        drawLander(centerX, centerY, angle, false);
        drawShieldBubble(centerX, centerY, elapsed);
      } else if (showSpaceJunk) {
        // Space junk with rainbow cycling
        drawLander(centerX - 15, centerY, 0, false);
        drawSpaceJunk(centerX + 20, centerY - 5, elapsed);
      } else {
        // Default: just show ship
        drawLander(centerX, centerY, 0, false);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [size, showThrust, showRotation, showLanding, showShield, showSpaceJunk]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
      }}
    />
  );
};
