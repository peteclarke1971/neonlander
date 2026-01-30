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
            borderColor: 'hsl(var(--neon) / 0.4)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          <div 
            className="font-bold text-sm sm:text-lg"
            style={{ color: 'hsl(var(--neon))' }}
          >
            VOLCANOES
          </div>
          <div className="text-xs sm:text-base opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>
            Erupt periodically. Avoid the lava particles!
          </div>
          <div 
            className="text-xs sm:text-base mt-2"
            style={{ color: 'hsl(var(--neon))' }}
          >
            Watch for glow = warning
          </div>
        </div>

        {/* Gravity Wells */}
        <div 
          className="p-3 rounded border text-center"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.4)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          <div 
            className="font-bold text-sm sm:text-lg"
            style={{ color: 'hsl(var(--neon))' }}
          >
            GRAVITY WELLS
          </div>
          <div className="text-xs sm:text-base opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>
            Pull your ship toward them. Fight the pull!
          </div>
          <div 
            className="text-xs sm:text-base mt-2"
            style={{ color: 'hsl(var(--neon))' }}
          >
            Purple swirl effect
          </div>
        </div>

        {/* Lightning */}
        <div 
          className="p-3 rounded border text-center"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.4)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          <div 
            className="font-bold text-sm sm:text-lg"
            style={{ color: 'hsl(var(--neon))' }}
          >
            STORMS
          </div>
          <div className="text-xs sm:text-base opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>
            Lightning can strike! HUD may flicker.
          </div>
          <div 
            className="text-xs sm:text-base mt-2"
            style={{ color: 'hsl(var(--neon))' }}
          >
            Random electric bolts
          </div>
        </div>

        {/* UFOs */}
        <div 
          className="p-3 rounded border text-center"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.4)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          <div 
            className="font-bold text-sm sm:text-lg"
            style={{ color: 'hsl(var(--neon))' }}
          >
            UFOs
          </div>
          <div className="text-xs sm:text-base opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>
            Appear from Level 10+. Fire projectiles!
          </div>
          <div 
            className="text-xs sm:text-base mt-2"
            style={{ color: 'hsl(var(--neon))' }}
          >
            Shield blocks 1 hit
          </div>
        </div>
      </div>

      {/* UFO types */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm sm:text-lg text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          UFO TYPES
        </h3>
        
        <div className="grid grid-cols-3 gap-2 text-xs sm:text-base text-center">
          <div className="p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <div style={{ color: 'hsl(var(--neon))' }}>SMALL</div>
            <div className="opacity-60" style={{ color: 'hsl(var(--neon))' }}>Level 10+</div>
          </div>
          <div className="p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <div style={{ color: 'hsl(var(--neon))' }}>MEDIUM</div>
            <div className="opacity-60" style={{ color: 'hsl(var(--neon))' }}>Level 15+</div>
          </div>
          <div className="p-2 rounded" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            <div style={{ color: 'hsl(var(--neon))' }}>LARGE</div>
            <div className="opacity-60" style={{ color: 'hsl(var(--neon))' }}>Level 20+</div>
          </div>
        </div>
      </div>
    </div>
  );
};
