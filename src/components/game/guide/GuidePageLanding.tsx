import React, { useEffect, useRef } from 'react';

// Pulsing pad animation canvas component
const PulsingPadCanvas: React.FC<{ width?: number }> = ({ width = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const height = 40;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      
      ctx.clearRect(0, 0, width, height);
      
      // Pulse formula from GameEngine: 1 + 0.6 * Math.sin(elapsed * 4)
      const pulse = 1 + 0.6 * Math.sin(elapsed * 4);
      const padWidth = width * 0.7;
      const padX = (width - padWidth) / 2;
      const padY = height / 2;
      
      // Outer glow
      ctx.beginPath();
      ctx.moveTo(padX, padY);
      ctx.lineTo(padX + padWidth, padY);
      ctx.strokeStyle = 'hsl(120, 100%, 50%)';
      ctx.lineWidth = 6 * pulse;
      ctx.shadowColor = 'hsl(120, 100%, 50%)';
      ctx.shadowBlur = 20 * pulse;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      
      // Core line
      ctx.beginPath();
      ctx.moveTo(padX, padY);
      ctx.lineTo(padX + padWidth, padY);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 12;
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowBlur = 0;
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [width]);

  return <canvas ref={canvasRef} style={{ width, height: 40 }} />;
};

export const GuidePageLanding: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Landing requirements */}
      <div className="space-y-3 text-sm" style={{ color: 'hsl(var(--neon))' }}>
        <h3 
          className="font-bold text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          SAFE LANDING REQUIREMENTS
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center p-2 rounded border" style={{ borderColor: 'hsl(var(--neon) / 0.3)' }}>
            <span style={{ color: 'hsl(var(--neon))' }}>✓ SPEED</span>
            <span className="text-xs opacity-70">Land slowly</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded border" style={{ borderColor: 'hsl(var(--neon) / 0.3)' }}>
            <span style={{ color: 'hsl(var(--neon))' }}>✓ ANGLE</span>
            <span className="text-xs opacity-70">Stay level</span>
          </div>
        </div>

        {/* Pulsing landing pad graphic */}
        <div 
          className="p-3 rounded border flex justify-center"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.3)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          <PulsingPadCanvas width={180} />
        </div>
      </div>

      {/* Bonuses */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          LANDING BONUSES
        </h3>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <span style={{ color: 'hsl(var(--neon))' }}>🎯 BULLSEYE</span>
            <span className="opacity-70">+500 pts</span>
            <span className="opacity-50">Land centered</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <span style={{ color: 'hsl(var(--neon))' }}>⚡ SPEED</span>
            <span className="opacity-70">+500 pts</span>
            <span className="opacity-50">Land in &lt;10s</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <span style={{ color: 'hsl(var(--neon))' }}>✨ PERFECT</span>
            <span className="opacity-70">+1000 pts</span>
            <span className="opacity-50">Bullseye + Speed</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <span style={{ color: 'hsl(var(--neon))' }}>2× PAD</span>
            <span className="opacity-70">Double points</span>
          </div>
        </div>
      </div>
    </div>
  );
};
