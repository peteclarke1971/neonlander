import React, { useState, useEffect } from "react";
import { AsteroidsRemixEngine } from "@/components/game/AsteroidsRemixEngine";
import { AsteroidStarfield } from "@/components/game/AsteroidStarfield";
import { InitialsEntry } from "@/components/game/InitialsEntry";
import { GameOverStarfield } from "@/components/game/GameOverStarfield";
import { Button } from "@/components/ui/button";
import { anyGamepad, loadProfile, readGamepad, getLastDeviceId } from "@/hooks/use-gamepad";

type View = "home" | "game" | "gameover";

interface RemixGameOverData {
  score: number;
  wave: number;
  cause: "destroyed" | "abort" | "victory";
  difficulty: string;
  elapsed: number;
  clearTime?: number;
}

interface RemixHighScore {
  initials: string;
  score: number;
  difficulty: string;
  clearTime?: number;
  date: number;
}

const AsteroidsRemix: React.FC = () => {
  const [view, setView] = useState<View>("home");
  const [difficulty, setDifficulty] = useState<string>("normal");
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [lastResult, setLastResult] = useState<RemixGameOverData | null>(null);
  
  // Get neon color from CSS
  const neonColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--neon')})`;
  const [swapButtons, setSwapButtons] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("asteroids-swap-buttons");
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [highScores, setHighScores] = useState<RemixHighScore[]>(() => {
    try {
      const saved = localStorage.getItem("asteroids-remix-high-scores");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const startGame = (selectedDifficulty: string, level?: number) => {
    setDifficulty(selectedDifficulty);
    if (level !== undefined) setSelectedLevel(level);
    setView("game");
  };

  const handleGameOver = (data: RemixGameOverData) => {
    setLastResult(data);
    setView("gameover");
  };

  const handleInitialsSubmit = (initials: string) => {
    if (lastResult) {
      const newScore: RemixHighScore = {
        initials,
        score: lastResult.score,
        difficulty: lastResult.difficulty,
        clearTime: lastResult.clearTime,
        date: Date.now()
      };
      
      const updatedScores = [...highScores, newScore]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      setHighScores(updatedScores);
      
      try {
        localStorage.setItem("asteroids-remix-high-scores", JSON.stringify(updatedScores));
      } catch {}
    }
    
    setView("home");
  };

  const backToHome = () => {
    setView("home");
  };

  const retryGame = () => {
    setView("game");
  };

  const toggleSwapButtons = () => {
    const newValue = !swapButtons;
    setSwapButtons(newValue);
    try {
      localStorage.setItem("asteroids-swap-buttons", JSON.stringify(newValue));
    } catch {}
  };

  const isHighScore = lastResult && (highScores.length < 10 || highScores.some(score => lastResult.score > score.score));
  const [goFocusIndex, setGoFocusIndex] = useState(0);
  
  useEffect(() => {
    if (view === "gameover" && !isHighScore) {
      const btnCount = 2;
      const handleKeyDown = (e: KeyboardEvent) => {
        const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (targetTag === "input" || targetTag === "textarea") return;
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          setGoFocusIndex(prev => Math.max(0, prev - 1));
        } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          setGoFocusIndex(prev => Math.min(btnCount - 1, prev + 1));
        } else if (e.key === "Enter" || e.code === "Space") {
          e.preventDefault();
          const btns = document.querySelectorAll<HTMLButtonElement>('nav .player-menu-btn');
          btns[goFocusIndex]?.click();
        }
      };
      
      const handleGamepad = () => {
        const gp = anyGamepad();
        if (gp) {
          const profile = loadProfile(getLastDeviceId());
          const input = readGamepad(gp, profile);
          if (input.ui?.up) setGoFocusIndex(prev => Math.max(0, prev - 1));
          else if (input.ui?.down) setGoFocusIndex(prev => Math.min(btnCount - 1, prev + 1));
          else if (input.ui?.select) {
            const btns = document.querySelectorAll<HTMLButtonElement>('nav .player-menu-btn');
            btns[goFocusIndex]?.click();
          } else if (input.ui?.back) backToHome();
        }
      };
      
      window.addEventListener("keydown", handleKeyDown);
      const gamepadInterval = setInterval(handleGamepad, 100);
      
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        clearInterval(gamepadInterval);
      };
    }
  }, [view, isHighScore, goFocusIndex]);

  if (view === "home") {
    return (
      <div className="relative w-full h-screen bg-background overflow-hidden">
        <div className="absolute inset-0 z-0" aria-hidden>
          <AsteroidStarfield />
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-6xl font-bold text-accent drop-shadow-neon animate-pulse">
              NEON ASTEROIDS
            </h1>
            <h2 className="text-3xl font-bold text-primary">
              🚀 REMIX MODE
            </h2>
            <p className="text-xl text-muted-foreground">
              Vertical scrolling shooter with boss battles
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <span className="text-sm text-muted-foreground">Fire/Thrust</span>
              <Button
                onClick={toggleSwapButtons}
                variant="outline"
                size="sm"
                className="px-3 py-1 text-xs"
              >
                {swapButtons ? "Swapped" : "Normal"}
              </Button>
            </div>
            
            <h3 className="text-2xl font-semibold text-accent">Select Level</h3>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((level) => (
                <Button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  variant={selectedLevel === level ? "default" : "outline"}
                  size="sm"
                  className="w-12 h-12"
                >
                  {level}
                </Button>
              ))}
            </div>

            <h3 className="text-2xl font-semibold text-accent">Select Difficulty</h3>
            <div className="space-y-2">
              <Button
                onClick={() => startGame("Easy")}
                variant="outline"
                size="lg"
                className="w-48 text-lg"
              >
                Easy - More Lives
              </Button>
              <Button
                onClick={() => startGame("Normal")}
                variant="outline"
                size="lg"
                className="w-48 text-lg"
              >
                Normal - Classic
              </Button>
              <Button
                onClick={() => startGame("Hard")}
                variant="outline"
                size="lg"
                className="w-48 text-lg"
              >
                Hard - Snipers
              </Button>
            </div>

            <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-4 mt-4">
              <p className="text-sm text-muted-foreground">
                <strong>REMIX Controls:</strong> Left/Right = Strafe • Space = Fire • Auto-scroll
              </p>
            </div>
          </div>

          {highScores.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-accent">REMIX High Scores</h3>
              <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-4">
                {highScores.slice(0, 5).map((score, index) => (
                  <div key={index} className="flex justify-between text-sm font-mono">
                    <span>{score.initials}</span>
                    <span>{score.score.toLocaleString()}</span>
                    {score.clearTime && <span>{score.clearTime.toFixed(1)}s</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={() => window.history.back()}
            variant="ghost"
            className="text-muted-foreground"
          >
            ← Back to Asteroids
          </Button>
        </div>
      </div>
    );
  }

  if (view === "game") {
    return (
      <AsteroidsRemixEngine
        difficulty={difficulty}
        startLevel={selectedLevel}
        onExit={backToHome}
        onGameOver={handleGameOver}
        swapButtons={swapButtons}
      />
    );
  }

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      {/* GameOverStarfield: user's chosen starfield style */}
      <GameOverStarfield />
      {/* OLD GAMEOVER STARFIELD
      <div className="absolute inset-0 z-0" aria-hidden>
        <AsteroidStarfield />
      </div>
      END OLD GAMEOVER STARFIELD */}
      
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-destructive">
            {lastResult?.cause === "destroyed" ? "SHIP DESTROYED" : 
             lastResult?.cause === "victory" ? "MISSION COMPLETE!" : "MISSION ABORTED"}
          </h1>
          
          {lastResult && (
            <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6 space-y-2">
              <div className="text-2xl font-bold text-accent">
                Score: {lastResult.score.toLocaleString()}
              </div>
              <div className="text-lg">Stage: {lastResult.wave}</div>
              <div className="text-sm text-muted-foreground">
                Time: {lastResult.elapsed.toFixed(1)}s
              </div>
              {lastResult.clearTime && (
                <div className="text-sm text-accent">
                  Clear Time: {lastResult.clearTime.toFixed(1)}s
                </div>
              )}
            </div>
          )}
        </div>

        {isHighScore && lastResult ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-accent">NEW HIGH SCORE!</h2>
            <InitialsEntry
              onSubmit={handleInitialsSubmit}
              score={lastResult.score}
              neonColor={neonColor}
              onInitialsConfirmed={handleInitialsSubmit}
            />
          </div>
        ) : (
          <nav className="flex flex-col items-center gap-2 w-full max-w-xs">
            <button className={`player-menu-btn w-full ${goFocusIndex === 0 ? 'selected' : ''}`} onClick={retryGame} onFocus={() => setGoFocusIndex(0)} autoFocus>TRY AGAIN</button>
            <button className={`player-menu-btn w-full ${goFocusIndex === 1 ? 'selected' : ''}`} onClick={backToHome} onFocus={() => setGoFocusIndex(1)}>MAIN MENU</button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default AsteroidsRemix;