import React from "react";
import { LightCyclesHUDSnapshot } from "./types/lightcycles";

interface Props extends LightCyclesHUDSnapshot {}

export const LightCyclesHUD: React.FC<Props> = ({ 
  score, 
  wave, 
  time, 
  difficulty, 
  cyclesRemaining, 
  speed,
  accelerating
}) => {
  return (
    <aside className="pointer-events-none select-none fixed top-4 left-4 z-20 animate-fade-in">
      <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-3 shadow-neon">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Light Cycles — {difficulty}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm font-mono">
          <div className="text-accent">WAVE</div>
          <div>{wave}</div>
          <div className="text-accent">OPPONENTS</div>
          <div>{cyclesRemaining}</div>
          <div className="text-accent">SPEED</div>
          <div className={accelerating ? "text-accent animate-pulse font-bold" : ""}>
            {speed.toFixed(1)}{accelerating ? " BOOST!" : ""}
          </div>
          <div className="text-accent">TIME</div>
          <div>{time.toFixed(1)} s</div>
        </div>
        <div className="mt-3 text-lg font-semibold">
          Score: <span className="text-accent">{score.toLocaleString()}</span>
        </div>
      </div>
    </aside>
  );
};