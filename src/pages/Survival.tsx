import React, { useState, useRef } from "react";
import { SurvivalEngine } from "@/components/game/SurvivalEngine";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";
import { Button } from "@/components/ui/button";
import { SurvivalGameOverData } from "@/components/game/types/survival";

type View = "game" | "gameover";

interface HighScore {
  initials: string;
  distance: number;
  time: number;
  date: number;
}

const Survival: React.FC = () => {
  const [view, setView] = useState<View>("game");
  const [lastResult, setLastResult] = useState<SurvivalGameOverData | null>(null);
  const [lowGraphics, setLowGraphics] = useState(() => {
    try {
      const stored = localStorage.getItem("lowgfx");
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [highScores, setHighScores] = useState<HighScore[]>(() => {
    const now = Date.now();
    const seed: HighScore[] = [
      { initials: "SRV", distance: 5000, time: 120, date: now },
      { initials: "END", distance: 3500, time: 90, date: now - 86400000 },
      { initials: "RUN", distance: 2800, time: 75, date: now - 86400000 * 2 },
      { initials: "FLY", distance: 2000, time: 60, date: now - 86400000 * 3 },
      { initials: "JET", distance: 1500, time: 45, date: now - 86400000 * 4 },
    ];
    try {
      const saved = localStorage.getItem("survival-high-scores");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length >= 5) return parsed.slice(0, 5);
    } catch {}
    localStorage.setItem("survival-high-scores", JSON.stringify(seed));
    return seed;
  });

  const handleGameOver = (data: SurvivalGameOverData) => {
    setLastResult(data);
    setView("gameover");
  };

  const backToHome = () => {
    window.location.href = "/";
  };

  const retryGame = () => {
    setView("game");
  };

  if (view === "game") {
    return <SurvivalEngine 
      onGameOver={handleGameOver} 
      lowGraphics={lowGraphics}
    />;
  }

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden>
        <HyperspaceStarfield />
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-accent">
            {lastResult?.cause === "crash" ? "SHIP DESTROYED" : 
             lastResult?.cause === "fuel" ? "OUT OF FUEL" : "SURVIVAL ENDED"}
          </h1>
          
          {lastResult && (
            <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6 space-y-2">
              <div className="text-2xl font-bold text-accent">
                Distance: {lastResult.distance.toFixed(0)}m
              </div>
              <div className="text-lg">Time: {lastResult.time.toFixed(1)}s</div>
              <div className="text-lg">Score: {lastResult.score.toLocaleString()}</div>
              <div className="text-lg">Landings: {lastResult.landings}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Button onClick={retryGame} variant="outline" size="lg">
            Try Again
          </Button>
          <Button onClick={backToHome} variant="ghost">
            Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Survival;
