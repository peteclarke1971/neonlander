import React from 'react';

export const GuidePageModes: React.FC = () => {
  return (
    <div className="flex flex-col gap-3">
      <h3 
        className="font-bold text-sm text-center mb-1"
        style={{ color: 'hsl(var(--neon))' }}
      >
        GAME MODES
      </h3>

      {/* Campaign */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(var(--neon) / 0.4)',
          background: 'hsl(var(--neon) / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(var(--neon))' }}
        >
          🚀 CAMPAIGN
        </div>
        <div className="text-xs opacity-80 mt-1" style={{ color: 'hsl(var(--neon))' }}>
          Progressive difficulty with curated levels. Face volcanoes, UFOs, and special challenges as you advance.
        </div>
      </div>

      {/* Classic */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(var(--neon) / 0.4)',
          background: 'hsl(var(--neon) / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(var(--neon))' }}
        >
          🕹️ CLASSIC
        </div>
        <div className="text-xs opacity-80 mt-1" style={{ color: 'hsl(var(--neon))' }}>
          Random terrain generation for endless variety. Pure arcade experience with increasing challenge.
        </div>
      </div>

      {/* Time Trial */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(var(--neon) / 0.4)',
          background: 'hsl(var(--neon) / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(var(--neon))' }}
        >
          ⏱️ TIME TRIAL
        </div>
        <div className="text-xs opacity-80 mt-1" style={{ color: 'hsl(var(--neon))' }}>
          Race against the clock! Land on numbered pads in order. Compete against ghost replays.
        </div>
      </div>

      {/* Medley */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(var(--neon) / 0.4)',
          background: 'hsl(var(--neon) / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(var(--neon))' }}
        >
          🎲 MEDLEY
        </div>
        <div className="text-xs opacity-80 mt-1" style={{ color: 'hsl(var(--neon))' }}>
          Mix of all level types! Normal, Dark Side, Storm, Collection, and Time Trial levels rotate.
        </div>
      </div>

      {/* Survival */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(var(--neon) / 0.4)',
          background: 'hsl(var(--neon) / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(var(--neon))' }}
        >
          ∞ SURVIVAL
        </div>
        <div className="text-xs opacity-80 mt-1" style={{ color: 'hsl(var(--neon))' }}>
          Endless scrolling terrain. How far can you travel? See next page for details →
        </div>
      </div>
    </div>
  );
};
