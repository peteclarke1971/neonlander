import React from 'react';
import { LanderAnimation } from './LanderAnimation';

export const GuidePageLanding: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Landing animation */}
      <div className="flex justify-center">
        <LanderAnimation showLanding size={100} />
      </div>

      {/* Landing requirements */}
      <div className="space-y-3 text-sm" style={{ color: 'hsl(var(--foreground) / 0.9)' }}>
        <h3 
          className="font-bold text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          SAFE LANDING REQUIREMENTS
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center p-2 rounded border" style={{ borderColor: 'hsl(120, 100%, 50% / 0.3)' }}>
            <span style={{ color: 'hsl(120, 100%, 50%)' }}>✓ SPEED</span>
            <span className="text-xs opacity-70">Land slowly</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded border" style={{ borderColor: 'hsl(120, 100%, 50% / 0.3)' }}>
            <span style={{ color: 'hsl(120, 100%, 50%)' }}>✓ ANGLE</span>
            <span className="text-xs opacity-70">Stay level</span>
          </div>
        </div>

        <div 
          className="p-3 rounded border text-center"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.3)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          <div className="font-bold" style={{ color: 'hsl(120, 100%, 50%)' }}>
            GREEN PADS = SAFE
          </div>
          <div className="text-xs opacity-70 mt-1">
            Land only on highlighted landing pads
          </div>
        </div>
      </div>

      {/* Bonuses */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(45, 100%, 60%)' }}
        >
          LANDING BONUSES
        </h3>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <span style={{ color: 'hsl(45, 100%, 60%)' }}>🎯 BULLSEYE</span>
            <span className="opacity-70">+500 pts</span>
            <span className="opacity-50">Land centered</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <span style={{ color: 'hsl(180, 100%, 50%)' }}>⚡ SPEED</span>
            <span className="opacity-70">+500 pts</span>
            <span className="opacity-50">Land in &lt;10s</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <span style={{ color: 'hsl(280, 100%, 70%)' }}>✨ PERFECT</span>
            <span className="opacity-70">+1000 pts</span>
            <span className="opacity-50">Bullseye + Speed</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <span style={{ color: 'hsl(30, 100%, 55%)' }}>2× PAD</span>
            <span className="opacity-70">Double points</span>
            <span className="opacity-50">Orange pads</span>
          </div>
        </div>
      </div>
    </div>
  );
};
