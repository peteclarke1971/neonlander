import React from "react";
import { OrbitalDockingHUDSnapshot } from "./types/orbitaldocking";

interface Props {
  hud: OrbitalDockingHUDSnapshot;
  paused: boolean;
}

export const OrbitalPadHUD: React.FC<Props> = ({ hud, paused }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const formatVelocity = (vel: number) => {
    return `${vel >= 0 ? '+' : ''}${vel.toFixed(1)}`;
  };

  const formatAngle = (degrees: number) => {
    const normalized = ((degrees % 360) + 360) % 360;
    const signed = normalized > 180 ? normalized - 360 : normalized;
    return `${signed >= 0 ? '+' : ''}${signed.toFixed(1)}°`;
  };

  // Calculate pad direction indicator
  const padDirection = hud.angularDiff;
  const padIndicatorStyle = {
    transform: `rotate(${padDirection}deg)`,
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top Left - Mission Info */}
      <div className="absolute top-4 left-4 text-left font-mono text-sm space-y-1">
        <div className="text-accent font-semibold text-base">
          DOCKING LEVEL {hud.level}
        </div>
        <div className="text-foreground">
          TIME: <span className="text-accent font-semibold">{formatTime(hud.time)}</span>
        </div>
        <div className="text-foreground">
          FUEL: <span className={`font-semibold ${hud.fuel < 200 ? 'text-destructive' : 'text-accent'}`}>
            {Math.round(hud.fuel)}
          </span>
        </div>
      </div>

      {/* Top Center - Pad Direction */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center font-mono">
        <div className="text-accent text-lg font-semibold mb-2">
          PAD BEARING
        </div>
        <div className="relative w-24 h-24 mx-auto">
          {/* Compass circle */}
          <div className="absolute inset-0 border-2 border-border/40 rounded-full"></div>
          
          {/* Cardinal directions */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-muted-foreground">N</div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-xs text-muted-foreground">S</div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 text-xs text-muted-foreground">W</div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 text-xs text-muted-foreground">E</div>
          
          {/* Ship indicator (always center) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-foreground rounded-full"></div>
          
          {/* Pad direction arrow */}
          <div 
            className="absolute top-2 left-1/2 -translate-x-1/2 text-accent transition-transform duration-100"
            style={padIndicatorStyle}
          >
            ▲
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground mt-1">
          {formatAngle(hud.angularDiff)}
        </div>
      </div>

      {/* Top Right - Altitude */}
      <div className="absolute top-4 right-4 text-right font-mono text-sm space-y-1">
        <div className="text-accent font-semibold text-lg">
          ALT: {hud.altitude.toFixed(1)}m
        </div>
        <div className={`text-sm ${Math.abs(hud.altitude) < 10 ? 'text-accent' : 'text-muted-foreground'}`}>
          {hud.altitude < 50 ? 'APPROACH' : 'ORBITAL'}
        </div>
      </div>

      {/* Left Side - Velocity Vector */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm space-y-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">VELOCITY</div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-4">R:</span>
            <span className={`font-semibold ${Math.abs(hud.radialVelocity) > 2 ? 'text-destructive' : 'text-accent'}`}>
              {formatVelocity(hud.radialVelocity)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-4">T:</span>
            <span className={`font-semibold ${Math.abs(hud.tangentialVelocity) > 3 ? 'text-destructive' : 'text-accent'}`}>
              {formatVelocity(hud.tangentialVelocity)}
            </span>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground/60 space-y-1">
          <div>R: Radial (up/down)</div>
          <div>T: Tangential (orbital)</div>
        </div>
      </div>

      {/* Bottom Center - Landing Status */}
      {hud.altitude < 20 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-center">
          <div className="bg-background/80 border border-accent/50 rounded-lg p-3">
            <div className="text-accent font-semibold">APPROACH MODE</div>
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <div>Land velocity: R ≤2.0, T ≤3.0</div>
              <div>Ship orientation: Nose down</div>
              <div>Position: On glowing pad</div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right - Controls */}
      <div className="absolute bottom-4 right-4 text-xs text-muted-foreground/60 font-mono text-right space-y-1">
        <div>←→: ROTATE SHIP</div>
        <div>SPACE: THRUST</div>
        <div>ESC: PAUSE</div>
      </div>

      {/* Bottom Left - Additional Info */}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground font-mono space-y-1">
        <div>Ship Angle: {formatAngle((hud.padPosition - 90) % 360)}</div>
        <div>Pad Position: {formatAngle(hud.padPosition)}</div>
      </div>

      {/* Warning indicators */}
      {hud.fuel < 100 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-destructive font-bold animate-pulse">
          LOW FUEL WARNING
        </div>
      )}

      {hud.time < 10 && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 text-destructive font-bold animate-pulse">
          TIME CRITICAL
        </div>
      )}

      {/* Velocity warning */}
      {(Math.abs(hud.radialVelocity) > 5 || Math.abs(hud.tangentialVelocity) > 8) && hud.altitude < 30 && (
        <div className="absolute top-44 left-1/2 -translate-x-1/2 text-destructive font-bold animate-pulse">
          EXCESSIVE VELOCITY
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