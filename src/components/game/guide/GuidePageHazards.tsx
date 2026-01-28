import React from 'react';

export const GuidePageHazards: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Hazards grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Volcanoes */}
        <div 
          className="p-3 rounded border text-center"
          style={{ 
            borderColor: 'hsl(15, 100%, 55% / 0.4)',
            background: 'hsl(15, 100%, 55% / 0.05)'
          }}
        >
          <div className="text-2xl mb-1">🌋</div>
          <div 
            className="font-bold text-sm"
            style={{ color: 'hsl(15, 100%, 55%)' }}
          >
            VOLCANOES
          </div>
          <div className="text-xs opacity-70 mt-1">
            Erupt periodically. Avoid the lava particles!
          </div>
          <div 
            className="text-xs mt-2"
            style={{ color: 'hsl(45, 100%, 60%)' }}
          >
            Watch for glow = warning
          </div>
        </div>

        {/* Gravity Wells */}
        <div 
          className="p-3 rounded border text-center"
          style={{ 
            borderColor: 'hsl(280, 100%, 60% / 0.4)',
            background: 'hsl(280, 100%, 60% / 0.05)'
          }}
        >
          <div className="text-2xl mb-1">🕳️</div>
          <div 
            className="font-bold text-sm"
            style={{ color: 'hsl(280, 100%, 60%)' }}
          >
            GRAVITY WELLS
          </div>
          <div className="text-xs opacity-70 mt-1">
            Pull your ship toward them. Fight the pull!
          </div>
          <div 
            className="text-xs mt-2"
            style={{ color: 'hsl(180, 100%, 50%)' }}
          >
            Purple swirl effect
          </div>
        </div>

        {/* Lightning */}
        <div 
          className="p-3 rounded border text-center"
          style={{ 
            borderColor: 'hsl(180, 100%, 50% / 0.4)',
            background: 'hsl(180, 100%, 50% / 0.05)'
          }}
        >
          <div className="text-2xl mb-1">⚡</div>
          <div 
            className="font-bold text-sm"
            style={{ color: 'hsl(180, 100%, 50%)' }}
          >
            STORMS
          </div>
          <div className="text-xs opacity-70 mt-1">
            Lightning can strike! HUD may flicker.
          </div>
          <div 
            className="text-xs mt-2"
            style={{ color: 'hsl(45, 100%, 60%)' }}
          >
            Random electric bolts
          </div>
        </div>

        {/* UFOs */}
        <div 
          className="p-3 rounded border text-center"
          style={{ 
            borderColor: 'hsl(0, 100%, 60% / 0.4)',
            background: 'hsl(0, 100%, 60% / 0.05)'
          }}
        >
          <div className="text-2xl mb-1">🛸</div>
          <div 
            className="font-bold text-sm"
            style={{ color: 'hsl(0, 100%, 60%)' }}
          >
            UFOs
          </div>
          <div className="text-xs opacity-70 mt-1">
            Appear from Level 10+. Fire projectiles!
          </div>
          <div 
            className="text-xs mt-2"
            style={{ color: 'hsl(280, 100%, 70%)' }}
          >
            Shield blocks 1 hit
          </div>
        </div>
      </div>

      {/* UFO types */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(0, 100%, 60%)' }}
        >
          UFO TYPES
        </h3>
        
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <div className="p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <div style={{ color: 'hsl(120, 100%, 50%)' }}>SMALL</div>
            <div className="opacity-60">Level 10+</div>
          </div>
          <div className="p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <div style={{ color: 'hsl(45, 100%, 60%)' }}>MEDIUM</div>
            <div className="opacity-60">Level 15+</div>
          </div>
          <div className="p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <div style={{ color: 'hsl(0, 100%, 60%)' }}>LARGE</div>
            <div className="opacity-60">Level 20+</div>
          </div>
        </div>
      </div>
    </div>
  );
};
