import React, { useState, useRef, useEffect } from "react";
import { SurvivalEngine } from "@/components/game/SurvivalEngine";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";
import { Button } from "@/components/ui/button";
import { SurvivalGameOverData } from "@/components/game/types/survival";
import { InitialsEntry } from "@/components/game/InitialsEntry";

type View = "home" | "game" | "gameover";

interface HighScore {
  initials: string;
  score: number;
  distance: number;
  time: number;
  date: number;
}

const Survival: React.FC = () => {
  const [view, setView] = useState<View>("home");
  const [lastResult, setLastResult] = useState<SurvivalGameOverData | null>(null);
  const [isHighScore, setIsHighScore] = useState(false);
  const [needsInitials, setNeedsInitials] = useState(false);
  const [lowGraphics, setLowGraphics] = useState(() => {
    try {
      const saved = localStorage.getItem('ll-graphics-settings');
      return saved ? JSON.parse(saved).lowGraphics : true;
    } catch {
      return true; // Default to low-gfx
    }
  });
  const [highScores, setHighScores] = useState<HighScore[]>(() => {
    const now = Date.now();
    const seed: HighScore[] = [
      { initials: "SRV", score: 15000, distance: 5000, time: 120, date: now },
      { initials: "END", score: 12000, distance: 3500, time: 90, date: now - 86400000 },
      { initials: "RUN", score: 9500, distance: 2800, time: 75, date: now - 86400000 * 2 },
      { initials: "FLY", score: 7000, distance: 2000, time: 60, date: now - 86400000 * 3 },
      { initials: "JET", score: 5000, distance: 1500, time: 45, date: now - 86400000 * 4 },
    ];
    try {
      const saved = localStorage.getItem("survival-mode-high-scores");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length >= 5) return parsed.slice(0, 5);
    } catch {}
    localStorage.setItem("survival-mode-high-scores", JSON.stringify(seed));
    return seed;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ll-graphics-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setLowGraphics(parsed.lowGraphics);
      }
    } catch {
      // Keep current value if parsing fails
    }
  }, []);

  const handleGameOver = (data: SurvivalGameOverData) => {
    setLastResult(data);
    const isHigh = highScores.length < 5 || data.score > highScores[4].score;
    setIsHighScore(isHigh);
    setNeedsInitials(isHigh);
    setView("gameover");
  };

  const handleInitialsSubmit = (initials: string) => {
    if (lastResult) {
      const newScore: HighScore = {
        initials,
        score: lastResult.score,
        distance: lastResult.distance,
        time: lastResult.time,
        date: Date.now()
      };
      
      const updatedScores = [...highScores, newScore]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      
      setHighScores(updatedScores);
      localStorage.setItem("survival-mode-high-scores", JSON.stringify(updatedScores));
    }
    
    setNeedsInitials(false);
    setView("home");
  };

  const backToHome = () => {
    setView("home");
  };

  const backToMainMenu = () => {
    window.location.href = "/";
  };

  const retryGame = () => {
    setView("game");
  };

  const startGame = () => {
    setView("game");
  };

  if (view === "game") {
    return <SurvivalEngine 
      key={lowGraphics ? 'low' : 'high'}
      onGameOver={handleGameOver} 
      lowGraphics={lowGraphics}
    />;
  }

  if (view === "home") {
    return (
      <div className="relative w-full h-screen bg-background overflow-hidden">
        <div className="absolute inset-0 z-0" aria-hidden>
          <HyperspaceStarfield lowGraphics={lowGraphics} />
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <div className="space-y-8 max-w-2xl w-full">
            <div className="space-y-2">
              <h1 className="text-5xl font-bold text-accent tracking-wider">
                SURVIVAL MODE
              </h1>
              <p className="text-muted-foreground text-lg">
                Navigate endless terrain, avoid asteroids, and keep your fuel up
              </p>
            </div>

            <Button onClick={startGame} size="lg" variant="outline" className="text-xl px-8 py-6">
              Start Survival
            </Button>

            {highScores.length > 0 && (
              <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-accent mb-4">LOCAL HIGH SCORES</h2>
                <div className="space-y-2">
                  {highScores.map((score, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between text-lg py-2 px-4 bg-background/40 rounded"
                    >
                      <span className="font-mono text-muted-foreground w-8">{idx + 1}.</span>
                      <span className="font-bold text-accent w-16">{score.initials}</span>
                      <span className="font-mono flex-1 text-right">{score.score.toLocaleString()}</span>
                      <span className="text-muted-foreground text-sm ml-4 w-24 text-right">
                        {score.distance.toFixed(0)}m
                      </span>
                      <span className="text-muted-foreground text-sm ml-2 w-16 text-right">
                        {score.time.toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={backToMainMenu} variant="ghost">
              Back to Main Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Game Over view
  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden>
        <HyperspaceStarfield lowGraphics={lowGraphics} />
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-accent">
            {isHighScore ? "NEW HIGH SCORE!" :
             lastResult?.cause === "crash" ? "SHIP DESTROYED" : 
             lastResult?.cause === "fuel" ? "OUT OF FUEL" : "SURVIVAL ENDED"}
          </h1>
          
          {lastResult && (
            <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6 space-y-2">
              <div className="text-lg">Distance: {lastResult.distance.toFixed(0)}m</div>
              <div className="text-lg">Time: {lastResult.time.toFixed(1)}s</div>
              <div className="text-2xl font-bold text-accent">
                Score: {lastResult.score.toLocaleString()}
              </div>
              <div className="text-lg">Landings: {lastResult.landings}</div>
            </div>
          )}

          {isHighScore && needsInitials && lastResult && (
            <InitialsEntry 
              score={lastResult.score}
              onSubmit={handleInitialsSubmit}
            />
          )}
        </div>

        {(!isHighScore || !needsInitials) && (
          <div className="flex flex-col gap-4">
            <Button onClick={retryGame} variant="outline" size="lg">
              Try Again
            </Button>
            <Button onClick={backToHome} variant="ghost">
              Back to Menu
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Survival;
