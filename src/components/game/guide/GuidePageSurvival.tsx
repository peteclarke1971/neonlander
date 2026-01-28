import React from 'react';

export const GuidePageSurvival: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <div 
        className="text-center text-2xl"
        style={{ color: 'hsl(120, 100%, 50%)' }}
      >
        ∞ SURVIVAL MODE
      </div>

      {/* Core mechanics */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          OBJECTIVE
        </h3>
        
        <div 
          className="p-3 rounded border text-sm text-center"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.3)',
            background: 'hsl(var(--neon) / 0.05)'
          }}
        >
          Travel as far as possible! Distance is tracked in meters.
        </div>
      </div>

      {/* Key features */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(45, 100%, 60%)' }}
        >
          KEY FEATURES
        </h3>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div 
            className="p-2 rounded text-center"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span style={{ color: 'hsl(45, 100%, 60%)' }}>⛽ FUEL</span>
            <div className="opacity-70 mt-1">Land on pads to refuel</div>
          </div>
          <div 
            className="p-2 rounded text-center"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span style={{ color: 'hsl(180, 100%, 50%)' }}>📍 SECTORS</span>
            <div className="opacity-70 mt-1">Named zones every 3000m</div>
          </div>
          <div 
            className="p-2 rounded text-center"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span style={{ color: 'hsl(0, 100%, 60%)' }}>☄️ COMETS</span>
            <div className="opacity-70 mt-1">Catch for bonus points!</div>
          </div>
          <div 
            className="p-2 rounded text-center"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            <span style={{ color: 'hsl(280, 100%, 70%)' }}>🌀 WEATHER</span>
            <div className="opacity-70 mt-1">Dynamic conditions</div>
          </div>
        </div>
      </div>

      {/* Special zones */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(280, 100%, 70%)' }}
        >
          SPECIAL ZONES
        </h3>
        
        <div className="space-y-2 text-sm">
          <div 
            className="p-2 rounded border"
            style={{ 
              borderColor: 'hsl(0, 0%, 20%)',
              background: 'hsl(0, 0%, 5%)'
            }}
          >
            <div className="flex items-center gap-2">
              <span>🌑</span>
              <span style={{ color: 'hsl(0, 0%, 70%)' }}>BLACKOUT</span>
            </div>
            <div className="text-xs opacity-60 mt-1">
              Visibility drops to spotlight only. Navigate by your ship's light!
            </div>
          </div>
          
          <div 
            className="p-2 rounded border"
            style={{ 
              borderColor: 'hsl(45, 100%, 60% / 0.4)',
              background: 'hsl(45, 100%, 60% / 0.05)'
            }}
          >
            <div className="flex items-center gap-2">
              <span>💡</span>
              <span style={{ color: 'hsl(45, 100%, 60%)' }}>LIGHT STORM</span>
            </div>
            <div className="text-xs opacity-60 mt-1">
              Sweeping light beam reveals terrain. Follow the light!
            </div>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div 
        className="text-xs text-center opacity-60 mt-2"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        💡 Conserve fuel by gliding when safe. Land often to refuel!
      </div>
    </div>
  );
};
