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
  // Comet event state
  cometActive?: boolean;
  cometTimer?: number;
  // Blackout zone state
  blackoutActive?: boolean;
  blackoutTimer?: number;
  // Light Storm state
  lightStormActive?: boolean;
  lightStormTimer?: number;
  // Color zone
  zoneName?: string;
  // Gyroscope controls
  showGyroButton?: boolean;
  gyroActive?: boolean;
  gyroPermission?: 'pending' | 'granted' | 'denied' | 'unsupported';
  tiltAngle?: number;
  onEnableGyro?: () => void;
  onCalibrateGyro?: () => void;
  // Weather effect
  weatherType?: string;
  // HUD visibility setting
  showFullHUD?: boolean;
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
  cometActive = false,
  cometTimer = 0,
  blackoutActive = false,
  blackoutTimer = 0,
  lightStormActive = false,
  lightStormTimer = 0,
  zoneName,
  showGyroButton = false,
  gyroActive = false,
  gyroPermission = 'pending',
  tiltAngle = 0,
  onEnableGyro,
  onCalibrateGyro,
  weatherType,
  showFullHUD = true,
}) => {
  // If HUD is hidden by user preference, don't render anything
  if (!showFullHUD) {
    return null;
  }
  
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
        
        {/* Zone Indicator */}
        {zoneName && (
          <div className="mt-2 text-xs text-accent/70 font-mono tracking-wide animate-pulse">
            {zoneName}
          </div>
        )}
        
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
        
        {/* Comet Bonus Badge */}
        {cometActive && (
          <div className="mt-2 flex items-center justify-between bg-blue-500/20 border border-blue-400/60 rounded px-2 py-1 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌠</span>
              <span className="text-xs font-bold text-blue-300">
                COMET BONUS 2×
              </span>
            </div>
            
            {cometTimer && cometTimer > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-12 h-1 bg-blue-500/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300 bg-blue-400"
                    style={{ 
                      width: `${(cometTimer / 10) * 100}%`
                    }}
                  />
                </div>
                <span className="text-xs text-blue-300/80">{Math.ceil(cometTimer)}s</span>
              </div>
            )}
          </div>
        )}
        
        {/* Blackout Badge */}
        {blackoutActive && (
          <div className="mt-2 flex items-center justify-between bg-red-950/40 border border-red-500/50 rounded px-2 py-1 animate-pulse">
            <div className="flex items-center gap-2">
              <svg 
                className="w-4 h-4" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5"
                style={{ color: 'hsl(0, 100%, 60%)' }}
              >
                {/* Eclipse/Blackout icon - circle with partial fill */}
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3 A9 9 0 0 1 12 21" fill="currentColor" opacity="0.7" />
              </svg>
              <span className="text-xs font-bold" style={{ color: 'hsl(0, 100%, 60%)' }}>
                BLACKOUT
              </span>
            </div>
            
            {blackoutTimer > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-12 h-1 bg-red-950/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300"
                    style={{ 
                      width: `${(blackoutTimer / 25) * 100}%`,
                      backgroundColor: 'hsl(0, 100%, 60%)'
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: 'hsl(0, 100%, 60%, 0.7)' }}>
                  {Math.ceil(blackoutTimer)}s
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Light Storm Badge */}
        {lightStormActive && (
          <div className="mt-2 flex items-center justify-between bg-yellow-500/20 border border-yellow-400/60 rounded px-2 py-1 animate-pulse">
            <div className="flex items-center gap-2">
              <svg 
                className="w-4 h-4" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5"
                style={{ color: 'hsl(50, 100%, 60%)' }}
              >
                <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
              </svg>
              <span className="text-xs font-bold" style={{ color: 'hsl(50, 100%, 60%)' }}>
                LIGHT STORM
              </span>
            </div>
            
            {lightStormTimer > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-12 h-1 bg-yellow-950/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300"
                    style={{ 
                      width: `${(lightStormTimer / 15) * 100}%`,
                      backgroundColor: 'hsl(50, 100%, 60%)'
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: 'hsl(50, 100%, 60%, 0.7)' }}>
                  {Math.ceil(lightStormTimer)}s
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Weather Effect Indicator */}
        {weatherType && weatherType !== 'clear' && (
          <div className="mt-2 flex items-center justify-center bg-cyan-500/20 border border-cyan-400/60 rounded px-2 py-1">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              ⚡ {weatherType.replace('-', ' ')}
            </span>
          </div>
        )}
        
        {/* Gyroscope controls - HIDDEN FOR NOW */}
        {/* {showGyroButton && (
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
        )} */}
      </div>
    </aside>
  );
};
