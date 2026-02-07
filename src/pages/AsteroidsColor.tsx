import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AsteroidsColorEngine } from "@/components/game/AsteroidsColorEngine";
import { InitialsEntry } from "@/components/game/InitialsEntry";
import { GameOverStarfield } from "@/components/game/GameOverStarfield";
import { anyGamepad, readGamepad, loadProfile, getLastDeviceId } from "@/hooks/use-gamepad";
import type { ColorOrderGameOverData } from "@/components/game/types/asteroidsColor";

type View = "home" | "game" | "gameover";

interface HighScore {
  initials: string;
  score: number;
  wave: number;
  difficulty: string;
  seed: number;
  timestamp: number;
}

export default function AsteroidsColor() {
  const [view, setView] = useState<View>("home");
  const [difficulty, setDifficulty] = useState<string>("Normal");
  const [lastResult, setLastResult] = useState<ColorOrderGameOverData | null>(null);
  
  // Get neon color from CSS
  const neonColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--neon')})`;
  const [swapButtons, setSwapButtons] = useState(() => {
    return localStorage.getItem("asteroids_swap_buttons") === "true";
  });
  const [highScores, setHighScores] = useState<Record<string, HighScore[]>>(() => {
    const stored = localStorage.getItem("asteroids_color_high_scores");
    return stored ? JSON.parse(stored) : { Easy: [], Normal: [], Hard: [] };
  });

  const [gamepadConnected, setGamepadConnected] = useState(false);
  
  // Simple gamepad polling for UI navigation
  useEffect(() => {
    const interval = setInterval(() => {
      const gp = anyGamepad();
      setGamepadConnected(!!gp);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const startGame = (selectedDifficulty: string) => {
    setDifficulty(selectedDifficulty);
    setView("game");
  };

  const handleGameOver = (data: ColorOrderGameOverData) => {
    setLastResult(data);
    setView("gameover");
  };

  const handleInitialsSubmit = (initials: string) => {
    if (lastResult) {
      const newScore: HighScore = {
        initials,
        score: lastResult.score,
        wave: lastResult.wave,
        difficulty: lastResult.difficulty,
        seed: lastResult.seed,
        timestamp: Date.now(),
      };

      const difficultyScores = [...(highScores[lastResult.difficulty] || [])];
      difficultyScores.push(newScore);
      difficultyScores.sort((a, b) => b.score - a.score);
      difficultyScores.splice(10); // Keep top 10

      const newHighScores = { ...highScores, [lastResult.difficulty]: difficultyScores };
      setHighScores(newHighScores);
      localStorage.setItem("asteroids_color_high_scores", JSON.stringify(newHighScores));
    }
    setView("home");
  };

  const backToHome = () => setView("home");
  const retryGame = () => setView("game");

  const toggleSwapButtons = () => {
    const newValue = !swapButtons;
    setSwapButtons(newValue);
    localStorage.setItem("asteroids_swap_buttons", newValue.toString());
  };

  // Check if last result is a high score
  const isHighScore = lastResult && (highScores[lastResult.difficulty]?.length < 10 || 
    lastResult.score > (highScores[lastResult.difficulty]?.[9]?.score || 0));

  // Game over screen controls
  useEffect(() => {
    if (view !== "gameover") return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (isHighScore) return; // Let initials entry handle this
        retryGame();
      } else if (e.code === "Escape") {
        e.preventDefault();
        backToHome();
      }
    };

    const handleGamepadInput = () => {
      const gp = anyGamepad();
      if (!gp) return;
      
      const profile = loadProfile(getLastDeviceId());
      const input = readGamepad(gp, profile);
      
      if (input.ui.select && !isHighScore) {
        retryGame();
      } else if (input.ui.back) {
        backToHome();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    const gamepadInterval = setInterval(handleGamepadInput, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      clearInterval(gamepadInterval);
    };
  }, [view, isHighScore]);

  if (view === "home") {
    return (
      <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
        {/* Starfield background */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background"></div>
        
        <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col items-center justify-center">
          <div className="text-center space-y-8 max-w-2xl">
            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                ASTEROIDS
              </h1>
              <h2 className="text-3xl font-bold text-accent">
                COLOR ORDER
              </h2>
              <p className="text-lg text-muted-foreground">
                Destroy GREEN → AMBER → RED asteroids in sequence
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-card/20 backdrop-blur-sm border border-border/50 rounded-lg p-6 text-sm space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-accent mb-2">CONTROLS</h3>
                  <div className="space-y-1 text-muted-foreground">
                    <div>↑ or W: Thrust</div>
                    <div>← → or A D: Rotate</div>
                    <div>SPACE: Fire</div>
                    <div>ESC: Pause</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-accent mb-2">COLOR ORDER RULES</h3>
                  <div className="space-y-1 text-muted-foreground">
                    <div>• Only target color can be destroyed</div>
                    <div>• Wrong hits trigger penalties</div>
                    <div>• Clear all target color to advance</div>
                    <div>• Phase bonuses for completion</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Difficulty Selection */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-accent">SELECT DIFFICULTY</h3>
              <div className="flex flex-wrap gap-4 justify-center">
                {["Easy", "Normal", "Hard"].map((diff) => (
                  <Button
                    key={diff}
                    onClick={() => startGame(diff)}
                    variant={difficulty === diff ? "default" : "outline"}
                    size="lg"
                    className="min-w-[120px]"
                  >
                    {diff}
                    <Badge variant="secondary" className="ml-2">
                      {diff === "Easy" ? "5 Lives" : "3 Lives"}
                    </Badge>
                  </Button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                <div><strong>Easy:</strong> Wrong hits clone asteroids</div>
                <div><strong>Normal:</strong> Wrong hits make asteroids larger</div>
                <div><strong>Hard:</strong> Wrong hits make larger AND clone</div>
              </div>
            </div>

            {/* Controls Toggle */}
            <Button
              onClick={toggleSwapButtons}
              variant="outline"
              size="sm"
            >
              {swapButtons ? "Fire: A, Thrust: B" : "Fire: B, Thrust: A"}
            </Button>

            {/* High Scores */}
            <div className="bg-card/20 backdrop-blur-sm border border-border/50 rounded-lg p-6">
              <h3 className="text-xl font-bold text-accent mb-4">HIGH SCORES - {difficulty.toUpperCase()}</h3>
              <div className="space-y-2">
                {highScores[difficulty]?.slice(0, 5).map((score, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{i + 1}</Badge>
                      <span className="font-mono">{score.initials}</span>
                    </span>
                    <span className="font-mono">{score.score.toLocaleString()}</span>
                    <span className="text-muted-foreground">Wave {score.wave}</span>
                  </div>
                )) || (
                  <div className="text-muted-foreground text-center py-4">
                    No scores yet
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 justify-center">
              <Link to="/asteroids">
                <Button variant="outline">← Back to Asteroids</Button>
              </Link>
              <Link to="/">
                <Button variant="outline">Main Menu</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "game") {
    const lowGraphics = localStorage.getItem("low_graphics_mode") === "true";
    return (
      <AsteroidsColorEngine
        difficulty={difficulty}
        onExit={backToHome}
        onGameOver={handleGameOver}
        swapButtons={swapButtons}
        lowGraphics={lowGraphics}
      />
    );
  }

  if (view === "gameover" && lastResult) {
    const minutes = Math.floor(lastResult.elapsed / 60);
    const seconds = Math.floor(lastResult.elapsed % 60);
    
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center relative overflow-hidden">
        {/* GameOverStarfield: user's chosen starfield style */}
        <GameOverStarfield />
        <div className="relative z-10 text-center space-y-8 max-w-md">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-destructive">GAME OVER</h1>
            <div className="space-y-2">
              <div className="text-2xl font-bold">Score: {lastResult.score.toLocaleString()}</div>
              <div className="text-lg">Wave: {lastResult.wave}</div>
              <div className="text-lg">Time: {minutes}:{seconds.toString().padStart(2, '0')}</div>
              <div className="text-lg">Seed: {lastResult.seed}</div>
            </div>
          </div>

          {isHighScore ? (
            <InitialsEntry
              score={lastResult.score}
              onSubmit={handleInitialsSubmit}
              neonColor={neonColor}
              onInitialsConfirmed={handleInitialsSubmit}
            />
          ) : (
            <div className="space-y-4">
              <Button onClick={retryGame} size="lg" className="w-full">
                Try Again
                <Badge variant="secondary" className="ml-2">SPACE</Badge>
              </Button>
              <Button onClick={backToHome} variant="outline" size="lg" className="w-full">
                Main Menu
                <Badge variant="secondary" className="ml-2">ESC</Badge>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}