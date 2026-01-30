import React from 'react';

export const GuidePageSurvival: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <div 
        className="text-center text-4xl"
        style={{ color: 'hsl(var(--neon))' }}
      >
        ∞ SURVIVAL MODE
      </div>

      {/* Core mechanics */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-xl text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          OBJECTIVE
        </h3>
        
        <div 
          className="p-3 rounded border text-lg text-center"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.3)',
            background: 'hsl(var(--neon) / 0.05)',
            color: 'hsl(var(--neon))'
          }}
        >
          Travel as far as possible! Distance is tracked in meters.
        </div>
      </div>

      {/* Key features */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-xl text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          KEY FEATURES
        </h3>
        
        <div className="grid grid-cols-2 gap-2 text-base">
          <div 
            className="p-2 rounded text-center"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span style={{ color: 'hsl(var(--neon))' }}>FUEL</span>
            <div className="opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>Land on pads to refuel</div>
          </div>
          <div 
            className="p-2 rounded text-center"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span style={{ color: 'hsl(var(--neon))' }}>SECTORS</span>
            <div className="opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>Named zones every 3000m</div>
          </div>
          <div 
            className="p-2 rounded text-center"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span style={{ color: 'hsl(var(--neon))' }}>COMETS</span>
            <div className="opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>Land when active for bonus</div>
          </div>
          <div 
            className="p-2 rounded text-center"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span style={{ color: 'hsl(var(--neon))' }}>WEATHER</span>
            <div className="opacity-70 mt-1" style={{ color: 'hsl(var(--neon))' }}>Dynamic conditions</div>
          </div>
        </div>
      </div>

      {/* Special zones */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-xl text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          SPECIAL ZONES
        </h3>
        
        <div className="space-y-2 text-lg">
          <div 
            className="p-2 rounded border"
            style={{ 
              borderColor: 'hsl(var(--neon) / 0.3)',
              background: 'hsl(0, 0%, 5%)'
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: 'hsl(var(--neon))' }}>BLACKOUT</span>
            </div>
            <div className="text-base opacity-60 mt-1" style={{ color: 'hsl(var(--neon))' }}>
              Visibility drops to spotlight only. Navigate by your ship's light!
            </div>
          </div>
          
          <div 
            className="p-2 rounded border"
            style={{ 
              borderColor: 'hsl(var(--neon) / 0.4)',
              background: 'hsl(var(--neon) / 0.05)'
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: 'hsl(var(--neon))' }}>LIGHT STORM</span>
            </div>
            <div className="text-base opacity-60 mt-1" style={{ color: 'hsl(var(--neon))' }}>
              Sweeping light beam reveals terrain. Follow the light!
            </div>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div 
        className="text-base text-center mt-2"
        style={{ color: 'hsl(var(--neon))' }}
      >
        Conserve fuel by gliding when safe. Land often to refuel!
      </div>
    </div>
  );
};