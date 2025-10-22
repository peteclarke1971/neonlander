import React from "react";

interface TimeTrialHUDProps {
  currentPad: number;
  totalPads: number;
  time: number; // milliseconds
  ghostTimeDiff?: number; // milliseconds, positive = ahead, negative = behind
  fuel: number;
  fuelCap: number;
  altitude: number;
  vx: number;
  vy: number;
}

export const TimeTrialHUD: React.FC<TimeTrialHUDProps> = ({
  currentPad,
  totalPads,
  time,
  ghostTimeDiff,
  fuel,
  fuelCap,
  altitude,
  vx,
  vy,
}) => {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const formatGhostDiff = (ms?: number) => {
    if (ms === undefined) return null;
    const abs = Math.abs(ms);
    const sign = ms > 0 ? '+' : '-';
    const seconds = (abs / 1000).toFixed(1);
    return `${sign}${seconds}s`;
  };

  return (
    <div className="fixed inset-x-0 top-0 pointer-events-none z-50">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        {/* Objective */}
        <div className="text-left">
          <div className="text-2xl font-bold text-accent">
            LAND ON PAD {currentPad}/{totalPads}
          </div>
          {ghostTimeDiff !== undefined && (
            <div className={`text-sm ${ghostTimeDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
              Ghost: {formatGhostDiff(ghostTimeDiff)}
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="text-right">
          <div className="text-4xl font-mono font-bold text-primary">
            {formatTime(time)}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="fixed bottom-0 inset-x-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between text-sm">
          {/* Fuel Gauge */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">FUEL:</span>
            <div className="w-32 h-3 bg-background/50 border border-border rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  fuel / fuelCap < 0.2 ? 'bg-destructive' : 'bg-accent'
                }`}
                style={{ width: `${(fuel / fuelCap) * 100}%` }}
              />
            </div>
            <span className="text-foreground font-mono">{Math.floor(fuel)}</span>
          </div>

          {/* Telemetry */}
          <div className="flex items-center gap-6 font-mono text-foreground">
            <div>
              <span className="text-muted-foreground">ALT:</span> {Math.floor(altitude)}m
            </div>
            <div>
              <span className="text-muted-foreground">VX:</span> {vx > 0 ? '+' : ''}{Math.floor(vx)}
            </div>
            <div>
              <span className="text-muted-foreground">VY:</span> {vy > 0 ? '+' : ''}{Math.floor(vy)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
