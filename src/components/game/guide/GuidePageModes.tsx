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
          borderColor: 'hsl(180, 100%, 50% / 0.4)',
          background: 'hsl(180, 100%, 50% / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(180, 100%, 50%)' }}
        >
          🚀 CAMPAIGN
        </div>
        <div className="text-xs opacity-80 mt-1">
          Progressive difficulty with curated levels. Face volcanoes, UFOs, and special challenges as you advance.
        </div>
      </div>

      {/* Classic */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(45, 100%, 60% / 0.4)',
          background: 'hsl(45, 100%, 60% / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(45, 100%, 60%)' }}
        >
          🕹️ CLASSIC
        </div>
        <div className="text-xs opacity-80 mt-1">
          Random terrain generation for endless variety. Pure arcade experience with increasing challenge.
        </div>
      </div>

      {/* Time Trial */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(0, 100%, 60% / 0.4)',
          background: 'hsl(0, 100%, 60% / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(0, 100%, 60%)' }}
        >
          ⏱️ TIME TRIAL
        </div>
        <div className="text-xs opacity-80 mt-1">
          Race against the clock! Land on numbered pads in order. Compete against ghost replays.
        </div>
      </div>

      {/* Medley */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(280, 100%, 70% / 0.4)',
          background: 'hsl(280, 100%, 70% / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(280, 100%, 70%)' }}
        >
          🎲 MEDLEY
        </div>
        <div className="text-xs opacity-80 mt-1">
          Mix of all level types! Normal, Dark Side, Storm, Collection, and Time Trial levels rotate.
        </div>
      </div>

      {/* Survival */}
      <div 
        className="p-3 rounded border"
        style={{ 
          borderColor: 'hsl(120, 100%, 50% / 0.4)',
          background: 'hsl(120, 100%, 50% / 0.05)'
        }}
      >
        <div 
          className="font-bold text-sm"
          style={{ color: 'hsl(120, 100%, 50%)' }}
        >
          ∞ SURVIVAL
        </div>
        <div className="text-xs opacity-80 mt-1">
          Endless scrolling terrain. How far can you travel? See next page for details →
        </div>
      </div>
    </div>
  );
};
