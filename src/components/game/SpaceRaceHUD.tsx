import React from "react";
import { SpaceRaceHUDSnapshot } from "./types/spaceracing";

interface Props {
  hud: SpaceRaceHUDSnapshot;
  paused: boolean;
}

export const SpaceRaceHUD: React.FC<Props> = ({ hud, paused }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return "---";
    if (distance < 1000) return `${Math.round(distance)}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top Left - Core Info */}
      <div className="absolute top-4 left-4 text-left font-mono text-sm space-y-1">
        <div className="text-accent font-semibold text-base">
          TRACK {hud.track} | {formatTime(hud.time)}
        </div>
        <div className="text-foreground">
          SCORE: <span className="text-accent font-semibold">{hud.score.toLocaleString()}</span>
        </div>
        {hud.bestLap && (
          <div className="text-foreground">
            BEST LAP: <span className="text-accent">{hud.bestLap.toFixed(2)}s</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-2">
          {hud.difficulty.toUpperCase()} MODE
        </div>
      </div>

      {/* Top Center - Gate Progress */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center font-mono">
        <div className="text-accent text-lg font-semibold">
          GATES: {hud.gatesPassed}/{hud.totalGates}
        </div>
        {hud.nextGateDistance && (
          <div className="text-sm text-muted-foreground">
            NEXT: {formatDistance(hud.nextGateDistance)}
          </div>
        )}
        
        {/* Gate Progress Bar */}
        <div className="mt-2 w-64 h-1 bg-border/40 rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${(hud.gatesPassed / Math.max(1, hud.totalGates)) * 100}%` }}
          />
        </div>
      </div>

      {/* Top Right - Speed & Position */}
      <div className="absolute top-4 right-4 text-right font-mono text-sm space-y-1">
        <div className="text-accent font-semibold text-lg">
          {hud.speed} KM/H
        </div>
        {hud.position && (
          <div className="text-foreground">
            P{hud.position}/8
          </div>
        )}
      </div>

      {/* Bottom Left - Boost Meter */}
      <div className="absolute bottom-4 left-4 space-y-2">
        <div className="text-xs text-muted-foreground font-mono">BOOST</div>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div 
              key={i}
              className={`w-6 h-2 rounded-sm border border-accent/40 ${
                i < hud.boostMeter ? 'bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.5)]' : 'bg-transparent'
              }`}
            />
          ))}
        </div>
        <div className="text-xs text-muted-foreground/80">
          SHIFT TO USE
        </div>
      </div>

      {/* Bottom Center - Next Gate Indicator */}
      {hud.nextGateDistance && hud.nextGateDistance < 200 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center">
            <div className="text-accent text-xl">▲</div>
            <div className="text-xs text-muted-foreground font-mono">
              GATE {hud.gatesPassed + 1}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right - Controls Hint */}
      <div className="absolute bottom-4 right-4 text-xs text-muted-foreground/60 font-mono text-right space-y-1">
        <div>WASD: STRAFE</div>
        <div>ARROWS: STEER</div>
        <div>SHIFT: BOOST</div>
        <div>SPACE: BRAKE</div>
        <div>ESC: PAUSE</div>
      </div>

      {/* Speed Lines Effect (when going fast) */}
      {hud.speed > 1000 && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full opacity-30">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-px bg-accent/60"
                style={{
                  left: `${10 + i * 7}%`,
                  top: '0%',
                  height: '100%',
                  transform: `skewX(${-10 - (hud.speed - 1000) / 50}deg)`,
                  animation: `streak 0.2s linear infinite ${i * 0.02}s`
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paused Indicator */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-6xl font-bold text-accent opacity-80 animate-pulse">
            ||
          </div>
        </div>
      )}

    </div>
  );
};