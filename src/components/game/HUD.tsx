import { HUDSnapshot, CollectiblesData } from "./types";

interface Props extends HUDSnapshot {
  collectibles?: CollectiblesData;
  bestTime?: number | null;
  ghostTimeDiff?: number;
}

export const HUD: React.FC<Props> = ({ altitude, vx, vy, fuel, fuelCap, score, time, difficulty, rotateBoostActive, collectibles, bestTime, ghostTimeDiff }) => {
  return (
    <aside className="pointer-events-none select-none fixed top-4 left-4 z-20 animate-fade-in">
      <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-3 shadow-neon">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Flight HUD — {difficulty}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm font-mono">
          <div className="text-accent">ALT</div><div>{Math.max(0, altitude).toFixed(0)} m</div>
          <div className="text-accent">V.SPD</div><div>{vy.toFixed(2)} m/s</div>
          <div className="text-accent">H.SPD</div><div>{vx.toFixed(2)} m/s</div>
          <div className="text-accent">TIME</div>
          <div className="flex flex-col">
            <span>{time.toFixed(1)} s</span>
            {bestTime && (
              <span className="text-xs text-muted-foreground">
                Best: {bestTime.toFixed(1)}s
              </span>
            )}
            {ghostTimeDiff !== undefined && Math.abs(ghostTimeDiff) > 0.1 && (
              <span className={`text-xs ${ghostTimeDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                Ghost: {ghostTimeDiff > 0 ? '+' : ''}{ghostTimeDiff.toFixed(1)}s
              </span>
            )}
          </div>
        </div>
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
        
        {collectibles && (
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
