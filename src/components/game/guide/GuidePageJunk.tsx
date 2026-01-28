import React from 'react';
import { LanderAnimation } from './LanderAnimation';

export const GuidePageJunk: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Space junk animation */}
      <div className="flex justify-center">
        <LanderAnimation showSpaceJunk size={100} />
      </div>

      {/* Space Junk info */}
      <div className="space-y-3 text-sm" style={{ color: 'hsl(var(--foreground) / 0.9)' }}>
        <h3 
          className="font-bold text-center"
          style={{ color: 'hsl(var(--neon))' }}
        >
          COLLECTIBLE ITEMS
        </h3>

        <div 
          className="p-3 rounded border"
          style={{ 
            borderColor: 'hsl(var(--neon) / 0.3)',
            background: 'linear-gradient(135deg, hsl(320, 100%, 60% / 0.1), hsl(180, 100%, 50% / 0.1))'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(320, 100%, 60%)' }}>✦</span>
              <span>Space Junk items glow with rainbow colors</span>
            </div>
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(45, 100%, 60%)' }}>⛽</span>
              <span>Each pickup grants +5 fuel</span>
            </div>
            <div className="flex items-start gap-3">
              <span style={{ color: 'hsl(280, 100%, 70%)' }}>🛡️</span>
              <span>Collecting all items grants a Shield</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wormhole section */}
      <div className="space-y-2">
        <h3 
          className="font-bold text-sm text-center"
          style={{ color: 'hsl(280, 100%, 70%)' }}
        >
          WORMHOLE PORTAL
        </h3>
        
        <div 
          className="p-3 rounded border text-sm"
          style={{ 
            borderColor: 'hsl(280, 100%, 70% / 0.4)',
            background: 'hsl(280, 100%, 70% / 0.05)'
          }}
        >
          <div className="space-y-2">
            <div className="text-center">
              <span style={{ color: 'hsl(280, 100%, 70%)' }}>
                Collect 3 items → Wormhole opens!
              </span>
            </div>
            <div className="text-xs opacity-70 text-center">
              Fly through to complete the level with bonus points
            </div>
          </div>
        </div>
      </div>

      {/* Collection levels */}
      <div 
        className="p-3 rounded border text-center text-sm"
        style={{ 
          borderColor: 'hsl(45, 100%, 60% / 0.3)',
          background: 'hsl(45, 100%, 60% / 0.05)'
        }}
      >
        <div style={{ color: 'hsl(45, 100%, 60%)' }}>
          COLLECTION LEVELS
        </div>
        <div className="text-xs opacity-70 mt-1">
          Special levels with 6 items to collect!
        </div>
      </div>
    </div>
  );
};
