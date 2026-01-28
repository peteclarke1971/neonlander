import React from 'react';

export const GuidePageScoring: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Base scoring */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
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
          <div className="grid grid-cols-2 gap-2 text-sm">
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
            className="text-xs mt-2 opacity-60 text-center"
          >
            Smoother landing = higher finesse bonus
          </div>
        </div>
      </div>

      {/* Bonus points */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(45, 100%, 60%)' }}
        >
          BONUS POINTS
        </h3>
        
        <div className="space-y-2 text-sm">
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>🎯 Bullseye (centered)</span>
            <span style={{ color: 'hsl(45, 100%, 60%)' }}>+500</span>
          </div>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>⚡ Speed Bonus (&lt;10s)</span>
            <span style={{ color: 'hsl(180, 100%, 50%)' }}>+500</span>
          </div>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>✨ Perfect (both!)</span>
            <span style={{ color: 'hsl(280, 100%, 70%)' }}>+1000</span>
          </div>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>🔄 360° Rotation</span>
            <span style={{ color: 'hsl(320, 100%, 60%)' }}>+360</span>
          </div>
          <div 
            className="flex justify-between p-2 rounded"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span>💨 Near Miss</span>
            <span style={{ color: 'hsl(0, 100%, 60%)' }}>+100</span>
          </div>
        </div>
      </div>

      {/* Multipliers */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(30, 100%, 55%)' }}
        >
          MULTIPLIERS
        </h3>
        
        <div className="grid grid-cols-2 gap-2 text-xs text-center">
          <div 
            className="p-2 rounded border"
            style={{ 
              borderColor: 'hsl(30, 100%, 55% / 0.4)',
              background: 'hsl(30, 100%, 55% / 0.05)'
            }}
          >
            <div style={{ color: 'hsl(30, 100%, 55%)' }}>2× PAD</div>
            <div className="opacity-60">Orange pads double all landing points</div>
          </div>
          <div 
            className="p-2 rounded border"
            style={{ 
              borderColor: 'hsl(var(--neon) / 0.4)',
              background: 'hsl(var(--neon) / 0.05)'
            }}
          >
            <div style={{ color: 'hsl(var(--neon))' }}>STREAK</div>
            <div className="opacity-60">Consecutive bonuses increase multiplier</div>
          </div>
        </div>
      </div>
    </div>
  );
};
