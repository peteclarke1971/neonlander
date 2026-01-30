import React from 'react';

export const GuidePageFuelShields: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Fuel section */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          FUEL MANAGEMENT
        </h3>
        
        <div className="text-sm space-y-2" style={{ color: 'hsl(var(--neon))' }}>
          <div className="flex items-start gap-3">
            <span style={{ color: 'hsl(var(--neon))' }}>⛽</span>
            <span>Thrusting consumes fuel. When empty, you fall!</span>
          </div>
          <div className="flex items-start gap-3">
            <span style={{ color: 'hsl(var(--neon))' }}>↻</span>
            <span>Landing on pads gives fuel boost in time trial and survival modes</span>
          </div>
          <div className="flex items-start gap-3">
            <span style={{ color: 'hsl(var(--neon))' }}>✦</span>
            <span>Collect Space Junk for fuel boost</span>
          </div>
        </div>
      </div>

      {/* Shield section */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          SHIELD SYSTEM
        </h3>
        
        <div 
          className="p-3 rounded border text-sm"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.4)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          <div className="space-y-2" style={{ color: 'hsl(var(--neon))' }}>
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(var(--neon))' }}>🛡️</span>
              <span>Collect all space junk items to earn a shield</span>
            </div>
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(var(--neon))' }}>💥</span>
              <span>Shield absorbs ONE crash and bounces you to safety</span>
            </div>
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(var(--neon))' }}>✨</span>
              <span>Brief invulnerability after shield breaks</span>
            </div>
          </div>
        </div>
        
        <div 
          className="text-xs text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          Shield lasts 75 seconds or until impact
        </div>
      </div>
    </div>
  );
};
