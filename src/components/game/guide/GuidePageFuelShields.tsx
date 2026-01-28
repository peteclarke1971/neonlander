import React from 'react';
import { LanderAnimation } from './LanderAnimation';

export const GuidePageFuelShields: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Shield animation */}
      <div className="flex justify-center">
        <LanderAnimation showShield size={100} />
      </div>

      {/* Fuel section */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(45, 100%, 60%)' }}
        >
          FUEL MANAGEMENT
        </h3>
        
        <div className="text-sm space-y-2" style={{ color: 'hsl(var(--foreground) / 0.9)' }}>
          <div className="flex items-start gap-3">
            <span style={{ color: 'hsl(45, 100%, 60%)' }}>⛽</span>
            <span>Thrusting consumes fuel. When empty, you fall!</span>
          </div>
          <div className="flex items-start gap-3">
            <span style={{ color: 'hsl(120, 100%, 50%)' }}>↻</span>
            <span>Landing on pads refuels your ship</span>
          </div>
          <div className="flex items-start gap-3">
            <span style={{ color: 'hsl(var(--neon))' }}>✦</span>
            <span>Collect Space Junk for +5 fuel each</span>
          </div>
        </div>
      </div>

      {/* Shield section */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(280, 100%, 70%)' }}
        >
          SHIELD SYSTEM
        </h3>
        
        <div 
          className="p-3 rounded border text-sm"
          style={{ 
            borderColor: 'hsl(280, 100%, 70% / 0.4)',
            background: 'hsl(280, 100%, 70% / 0.05)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(280, 100%, 70%)' }}>🛡️</span>
              <span>Collect all space junk items to earn a shield</span>
            </div>
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(280, 100%, 70%)' }}>💥</span>
              <span>Shield absorbs ONE crash and bounces you to safety</span>
            </div>
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(280, 100%, 70%)' }}>✨</span>
              <span>Brief invulnerability after shield breaks</span>
            </div>
          </div>
        </div>
        
        <div 
          className="text-xs text-center opacity-60"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          Shield lasts 75 seconds or until impact
        </div>
      </div>
    </div>
  );
};
