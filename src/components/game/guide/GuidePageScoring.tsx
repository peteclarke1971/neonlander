import React from 'react';

export const GuidePageScoring: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Base scoring */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-base sm:text-xl text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          LANDING POINTS
        </h3>
        
        <div 
          className="p-3 rounded border"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.3)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          <div className="grid grid-cols-2 gap-2 text-sm sm:text-lg" style={{ color: 'hsl(var(--neon))' }}>
            <div className="flex justify-between">
              <span className="opacity-70">Base Landing</span>
              <span style={{ color: 'hsl(var(--neon))' }}>+100</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Finesse Bonus</span>
              <span style={{ color: 'hsl(var(--neon))' }}>+0-200</span>
            </div>
          </div>
          <div 
            className="text-xs sm:text-base mt-2 opacity-60 text-center"
            style={{ color: 'hsl(var(--neon))' }}
          >
            Smoother landing = higher finesse bonus
          </div>
        </div>
      </div>

      {/* Bonus points */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-base sm:text-xl text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          BONUS POINTS
        </h3>
        
        <div className="space-y-2 text-sm sm:text-lg" style={{ color: 'hsl(var(--neon))' }}>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>Bullseye (centered)</span>
            <span style={{ color: 'hsl(var(--neon))' }}>+500</span>
          </div>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>Speed Bonus (&lt;10s)</span>
            <span style={{ color: 'hsl(var(--neon))' }}>+500</span>
          </div>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>Perfect (both!)</span>
            <span style={{ color: 'hsl(var(--neon))' }}>+1000</span>
          </div>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>360° Rotation</span>
            <span style={{ color: 'hsl(var(--neon))' }}>+360</span>
          </div>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>Near Miss</span>
            <span style={{ color: 'hsl(var(--neon))' }}>+100</span>
          </div>
        </div>
      </div>

      {/* Multipliers */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-base sm:text-xl text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          MULTIPLIERS
        </h3>
        
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-base text-center">
          <div 
            className="p-2 rounded border"
            style={{ 
              borderColor: 'hsl(var(--neon) / 0.4)',
              background: 'hsl(var(--neon) / 0.05)'
            }}
          >
            <div style={{ color: 'hsl(var(--neon))' }}>2× PAD</div>
            <div className="opacity-60" style={{ color: 'hsl(var(--neon))' }}>Double all landing points</div>
          </div>
          <div 
            className="p-2 rounded border"
            style={{ 
              borderColor: 'hsl(var(--neon) / 0.4)',
              background: 'hsl(var(--neon) / 0.05)'
            }}
          >
            <div style={{ color: 'hsl(var(--neon))' }}>STREAK</div>
            <div className="opacity-60" style={{ color: 'hsl(var(--neon))' }}>Consecutive bonuses increase multiplier</div>
          </div>
        </div>
      </div>
    </div>
  );
};
