import React, { useState, useEffect } from "react";
import { AsteroidsEngine } from "@/components/game/AsteroidsEngine";
import { HomeScreen } from "@/components/game/HomeScreen";
import { AsteroidStarfield } from "@/components/game/AsteroidStarfield";
import { InitialsEntry } from "@/components/game/InitialsEntry";
import { AsteroidsGameOverData } from "@/components/game/types/asteroids";
import { Button } from "@/components/ui/button";
import { anyGamepad, loadProfile, readGamepad, getLastDeviceId } from "@/hooks/use-gamepad";

type View = "home" | "game" | "gameover";

interface HighScore {
  initials: string;
  score: number;
  difficulty: string;
  date: number;
}

const Asteroids: React.FC = () => {
  const [view, setView] = useState<View>("home");
  const [difficulty, setDifficulty] = useState<string>("normal");
  const [lastResult, setLastResult] = useState<AsteroidsGameOverData | null>(null);
  const [swapButtons, setSwapButtons] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("asteroids-swap-buttons");
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [highScores, setHighScores] = useState<HighScore[]>(() => {
    try {
      const saved = localStorage.getItem("asteroids-high-scores");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const startGame = (selectedDifficulty: string) => {
    setDifficulty(selectedDifficulty);
    setView("game");
  };

  const handleGameOver = (data: AsteroidsGameOverData) => {
    setLastResult(data);
    setView("gameover");
  };

  const handleInitialsSubmit = (initials: string) => {
    if (lastResult) {
      const newScore: HighScore = {
        initials,
        score: lastResult.score,
        difficulty: lastResult.difficulty,
        date: Date.now()
      };
      
      const updatedScores = [...highScores, newScore]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      setHighScores(updatedScores);
      
      try {
        localStorage.setItem("asteroids-high-scores", JSON.stringify(updatedScores));
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
            <p className="text-xl text-muted-foreground">
              Blast asteroids in retro vector style
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
            
            <h2 className="text-2xl font-semibold text-accent">Select Difficulty</h2>
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
                Hard - Fast Asteroids
              </Button>
            </div>
          </div>

          {highScores.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-accent">High Scores</h3>
              <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-4">
                {highScores.slice(0, 5).map((score, index) => (
                  <div key={index} className="flex justify-between text-sm font-mono">
                    <span>{score.initials}</span>
                    <span>{score.score.toLocaleString()}</span>
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
            ← Back to Main Menu
          </Button>
        </div>
      </div>
    );
  }

  if (view === "game") {
    return (
      <AsteroidsEngine
        difficulty={difficulty}
        onExit={backToHome}
        onGameOver={handleGameOver}
        swapButtons={swapButtons}
      />
    );
  }

  // Game over view
  const isHighScore = lastResult && highScores.length < 10 || (lastResult && highScores.some(score => lastResult.score > score.score));
  
  // Add keyboard handling for game over screen
  useEffect(() => {
    if (view !== "gameover" || isHighScore) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") return;
      if (e.key === "Enter") {
        e.preventDefault();
        retryGame(); // Default to retry game
      }
    };
    
    // Gamepad handling (only when not entering initials)
    const handleGamepad = () => {
      const gp = anyGamepad();
      if (gp) {
        const profile = loadProfile(getLastDeviceId());
        const input = readGamepad(gp, profile);
        if (input.buttons.abort) { // Use abort button for retry
          retryGame();
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    const gamepadInterval = setInterval(handleGamepad, 100);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearInterval(gamepadInterval);
    };
  }, [view, isHighScore]);
  
  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden>
        <AsteroidStarfield />
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-destructive">
            {lastResult?.cause === "destroyed" ? "SHIP DESTROYED" : "MISSION ABORTED"}
          </h1>
          
          {lastResult && (
            <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6 space-y-2">
              <div className="text-2xl font-bold text-accent">
                Score: {lastResult.score.toLocaleString()}
              </div>
              <div className="text-lg">Wave: {lastResult.wave}</div>
              <div className="text-sm text-muted-foreground">
                Time: {lastResult.elapsed.toFixed(1)}s
              </div>
            </div>
          )}
        </div>

        {isHighScore && lastResult ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-accent">NEW HIGH SCORE!</h2>
            <InitialsEntry
              onSubmit={handleInitialsSubmit}
              score={lastResult.score}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Button onClick={retryGame} variant="outline" size="lg" autoFocus>
              Try Again
            </Button>
            <Button onClick={backToHome} variant="ghost">
              Main Menu
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Asteroids;