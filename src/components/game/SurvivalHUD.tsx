import React from "react";

interface Props {
  altitude: number;
  vx: number;
  vy: number;
  fuel: number;
  fuelCap: number;
  score: number;
  time: number;
  distance: number;
  landings: number;
}

export const SurvivalHUD: React.FC<Props> = ({ 
  altitude, 
  vx, 
  vy, 
  fuel, 
  fuelCap, 
  score, 
  time, 
  distance,
  landings 
}) => {
  return (
    <aside className="pointer-events-none select-none fixed top-4 left-4 z-20 animate-fade-in">
      <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-3 shadow-neon">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Survival Mode
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm font-mono">
          <div className="text-accent">DIST</div><div>{Math.max(0, distance).toFixed(0)} m</div>
          <div className="text-accent">TIME</div><div>{time.toFixed(1)} s</div>
          <div className="text-accent">LAND</div><div>{landings}</div>
          <div className="text-accent">ALT</div><div>{Math.max(0, altitude).toFixed(0)} m</div>
          <div className="text-accent">V.SPD</div><div>{vy.toFixed(2)} m/s</div>
          <div className="text-accent">H.SPD</div><div>{vx.toFixed(2)} m/s</div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-accent">FUEL</span>
            <span>{Math.max(0, fuel).toFixed(0)}</span>
          </div>
          <div className="h-2 bg-secondary rounded-md overflow-hidden mt-1">
            <div 
              className="h-full bg-accent" 
              style={{ width: `${Math.max(0, Math.min(100, (fuel / fuelCap * 100)))}%` }} 
            />
          </div>
        </div>
        <div className="mt-3 text-lg font-semibold">
          Score: <span className="text-accent">{score}</span>
        </div>
      </div>
    </aside>
  );
};
