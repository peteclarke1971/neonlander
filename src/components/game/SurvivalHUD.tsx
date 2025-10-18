import React from "react";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";

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
  // Shield state
  shieldActive?: boolean;
  shieldTimer?: number;
  // Gyroscope controls
  showGyroButton?: boolean;
  gyroActive?: boolean;
  gyroPermission?: 'pending' | 'granted' | 'denied' | 'unsupported';
  tiltAngle?: number;
  onEnableGyro?: () => void;
  onCalibrateGyro?: () => void;
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
  landings,
  shieldActive = false,
  shieldTimer = 0,
  showGyroButton = false,
  gyroActive = false,
  gyroPermission = 'pending',
  tiltAngle = 0,
  onEnableGyro,
  onCalibrateGyro,
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
        <div className="mt-3 opacity-60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">FUEL</span>
            <span className="text-muted-foreground">{Math.max(0, fuel).toFixed(0)}</span>
          </div>
          <div className="h-1.5 bg-secondary/40 rounded-md overflow-hidden mt-1">
            <div 
              className="h-full bg-accent" 
              style={{ width: `${Math.max(0, Math.min(100, (fuel / fuelCap * 100)))}%` }} 
            />
          </div>
        </div>
        <div className="mt-3 text-lg font-semibold">
          Score: <span className="text-accent">{score}</span>
        </div>
        
        {/* Shield Status Badge */}
        {shieldActive && (
          <div className="mt-2 flex items-center justify-between bg-accent/10 border border-accent/40 rounded px-2 py-1">
            <div className="flex items-center gap-2">
              <svg 
                className="w-4 h-4" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5"
                style={{ color: 'hsl(280, 100%, 75%)' }}
              >
                <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" />
              </svg>
              <span className="text-xs font-bold" style={{ color: 'hsl(280, 100%, 75%)' }}>
                SHIELD
              </span>
            </div>
            
            {shieldTimer > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-12 h-1 bg-accent/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300"
                    style={{ 
                      width: `${(shieldTimer / 75) * 100}%`,
                      backgroundColor: 'hsl(280, 100%, 75%)'
                    }}
                  />
                </div>
                <span className="text-xs text-accent/60">{Math.ceil(shieldTimer)}s</span>
              </div>
            )}
          </div>
        )}
        
        {/* Gyroscope controls */}
        {showGyroButton && (
          <div className="mt-3 pointer-events-auto space-y-2">
            {!gyroActive && gyroPermission !== 'denied' && gyroPermission !== 'unsupported' && (
              <Button 
                onClick={onEnableGyro}
                size="sm"
                variant="outline"
                className="w-full text-xs"
              >
                <Smartphone className="w-3 h-3 mr-1" />
                Enable Tilt Controls
              </Button>
            )}
            
            {gyroActive && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-accent flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    TILT
                  </span>
                  <span>{tiltAngle.toFixed(1)}°</span>
                </div>
                <Button 
                  onClick={onCalibrateGyro}
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs"
                >
                  Recalibrate
                </Button>
              </>
            )}
            
            {gyroPermission === 'denied' && (
              <div className="text-xs text-muted-foreground">
                Tilt permission denied
              </div>
            )}
            
            {gyroPermission === 'unsupported' && (
              <div className="text-xs text-muted-foreground">
                Tilt not supported
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
