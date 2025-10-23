import { HUDSnapshot, CollectiblesData, Difficulty } from "./types";
import { useEffect, useState } from "react";
import { GhostManager } from "./GhostManager";
import { fetchGlobalGhost } from "@/lib/leaderboard";

interface Props extends HUDSnapshot {
  collectibles?: CollectiblesData;
  bestTime?: number | null;
  ghostTimeDiff?: number;
}

export const HUD: React.FC<Props> = ({ altitude, vx, vy, fuel, fuelCap, score, time, difficulty, rotateBoostActive, collectibles, bestTime, ghostTimeDiff, timeTrialTarget, timeTrialTotalPads, timeTrialRaceTime, timeTrialRaceActive, timeTrialLevel }) => {
  const [localRecord, setLocalRecord] = useState<{ time: number; initials: string } | null>(null);
  const [globalRecord, setGlobalRecord] = useState<{ time: number; initials: string } | null>(null);
  
  // Fetch Time Trial records when in Time Trial mode
  useEffect(() => {
    if (timeTrialTarget === undefined || timeTrialLevel === undefined) return;
    
    const fetchRecords = async () => {
      const ghostManager = new GhostManager();
      
      // Local record
      const localGhost = ghostManager.loadTimeTrialGhost(difficulty, timeTrialLevel);
      if (localGhost) {
        console.log('📊 HUD: Loaded local ghost:', { 
          time: localGhost.completionTime, 
          initials: localGhost.initials || '???',
          hasInitials: !!localGhost.initials 
        });
        setLocalRecord({ 
          time: localGhost.completionTime, 
          initials: localGhost.initials || '???' 
        });
      }
      
      // Global record - fetch from ghost_records table for timetrial mode
      try {
        const { record } = await fetchGlobalGhost(timeTrialLevel, difficulty, 'timetrial');
        if (record && record.completion_time) {
          console.log('🌍 HUD: Loaded global ghost:', { 
            time: record.completion_time, 
            initials: record.initials 
          });
          setGlobalRecord({ time: record.completion_time, initials: record.initials });
        }
      } catch (err) {
        console.error("Failed to fetch global ghost:", err);
      }
    };
    
    fetchRecords();
  }, [timeTrialTarget, timeTrialLevel, difficulty]);
  return (
    <aside className="pointer-events-none select-none fixed top-4 left-4 z-20 animate-fade-in">
      <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-3 shadow-neon">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {timeTrialTarget ? 'Time Trial HUD' : 'Flight HUD'} — {difficulty}
        </div>
        
  {timeTrialTarget !== undefined ? (
    <>
      {/* Time Trial specific HUD */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm font-mono">
        <div className="text-accent">TARGET</div>
        <div className="text-lg font-bold">Pad {timeTrialTarget}/{timeTrialTotalPads}</div>
        <div className="text-accent">TIME</div>
        <div className="text-lg font-bold text-accent">
          {timeTrialRaceTime !== undefined ? (timeTrialRaceTime / 1000).toFixed(3) : '0.000'}s
        </div>
        <div className="text-accent">ALT</div><div>{Math.max(0, altitude).toFixed(0)} m</div>
        <div className="text-accent">V.SPD</div><div>{vy.toFixed(2)} m/s</div>
        <div className="text-accent">H.SPD</div><div>{vx.toFixed(2)} m/s</div>
        {ghostTimeDiff !== undefined && Math.abs(ghostTimeDiff) > 0.01 && (
          <>
            <div className="text-accent">GHOST</div>
            <div className={ghostTimeDiff > 0 ? 'text-red-400' : 'text-green-400'}>
              {ghostTimeDiff > 0 ? '+' : ''}{(ghostTimeDiff / 1000).toFixed(3)}s
            </div>
          </>
        )}
      </div>
      
      {/* Fuel bar for Time Trial */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-accent">FUEL</span>
          <span>{Math.max(0, fuel).toFixed(0)}</span>
        </div>
        <div className="h-2 bg-secondary rounded-md overflow-hidden mt-1">
          <div 
            className="h-full bg-accent transition-all duration-200" 
            style={{ width: `${Math.max(0, Math.min(100, (fuelCap ? (fuel / fuelCap * 100) : fuel)))}%` }} 
          />
        </div>
      </div>
      
      {/* Records display - always visible */}
      <div className="mt-3 space-y-1 text-xs font-mono">
        {localRecord && (
          <div className="flex justify-between gap-4">
            <span className="text-accent">Best: {(localRecord.time / 1000).toFixed(2)}s</span>
            <span className="text-muted-foreground">Pilot: {localRecord.initials}</span>
          </div>
        )}
        {/* World record - always visible with placeholder when no record */}
        <div className="flex justify-between gap-4">
          <span className="text-yellow-400">
            World: {globalRecord ? (globalRecord.time / 1000).toFixed(2) + 's' : '----'}
          </span>
          <span className="text-muted-foreground">
            Pilot: {globalRecord?.initials || '???'}
          </span>
        </div>
      </div>
    </>
  ) : (
          // Regular game HUD
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm font-mono">
            <div className="text-accent">ALT</div><div>{Math.max(0, altitude).toFixed(0)} m</div>
            <div className="text-accent">V.SPD</div><div>{vy.toFixed(2)} m/s</div>
            <div className="text-accent">H.SPD</div><div>{vx.toFixed(2)} m/s</div>
            <div className="text-accent">TIME</div>
            <div className="flex flex-col">
              <span>{time.toFixed(1)} s</span>
              {ghostTimeDiff !== undefined && Math.abs(ghostTimeDiff) > 0.1 && (
                <span className={`text-xs ${ghostTimeDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  Ghost: {ghostTimeDiff > 0 ? '+' : ''}{ghostTimeDiff.toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        )}
        
        {timeTrialTarget === undefined && (
          <>
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm"><span className="text-accent">FUEL</span><span>{Math.max(0, fuel).toFixed(0)}</span></div>
              <div className="h-2 bg-secondary rounded-md overflow-hidden mt-1">
                <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, (fuelCap ? (fuel / fuelCap * 100) : fuel)))}%` }} />
              </div>
            </div>
            <div className="mt-3 text-lg font-semibold">
              Score: <span className="text-accent">{score}</span>
              {rotateBoostActive && (
                <span className="ml-2 px-1 py-0.5 text-xs bg-accent/20 text-accent rounded border border-accent/40">
                  2× ROT
                </span>
              )}
            </div>
          </>
        )}
        
        {bestTime && timeTrialTarget === undefined && (
          <div className="text-xs text-muted-foreground mt-1">
            Best: {bestTime.toFixed(1)}s
          </div>
        )}
        
        {bestTime && timeTrialTarget !== undefined && (
          <div className="text-xs text-muted-foreground mt-2">
            Best: {(bestTime / 1000).toFixed(3)}s
          </div>
        )}
        
        {collectibles && timeTrialTarget === undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-accent">JUNK</span>
              <span>{collectibles.totalCollected}/3</span>
            </div>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded border ${
                    i < collectibles.totalCollected
                      ? 'bg-accent border-accent'
                      : 'border-accent/40'
                  }`}
                />
              ))}
            </div>
            {collectibles.setComplete && (
              <div className="text-xs text-accent mt-1 animate-pulse">
                WORMHOLE OPEN
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
