import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { AsteroidsEngine } from "@/components/game/AsteroidsEngine";
import { InitialsEntry } from "@/components/game/InitialsEntry";
import { GameOverStarfield } from "@/components/game/GameOverStarfield";
import { AsteroidsGameOverData } from "@/components/game/types/asteroids";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";
import { MobileStarfield } from "@/components/game/MobileStarfield";
import { isIOSDevice, shouldShowFullscreenButton } from "@/lib/deviceDetection";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { loadGraphicsSettings, saveGraphicsSettings, cycleGraphicsLevel, getGraphicsLabel, GraphicsLevel } from "@/lib/graphicsConfig";
import { anyGamepad, loadProfile, readGamepad, getLastDeviceId, vibrate } from "@/hooks/use-gamepad";
import { Maximize, Minimize } from "lucide-react";

type View = "home" | "game" | "gameover";

interface HighScore {
  initials: string;
  score: number;
  difficulty: string;
  date: number;
}

const MENU_ITEMS = [
  { id: "easy", label: "EASY", sub: "More Lives" },
  { id: "normal", label: "NORMAL", sub: "Classic" },
  { id: "hard", label: "HARD", sub: "Fast Asteroids" },
  { id: "swap", label: "CONTROLS", sub: "" },
  { id: "color", label: "COLOR ORDER", sub: "Match Colors" },
  { id: "remix", label: "REMIX MODE", sub: "Vertical Shooter" },
];

const Asteroids: React.FC = () => {
  const [view, setView] = useState<View>("home");
  const [difficulty, setDifficulty] = useState<string>("normal");
  const [lastResult, setLastResult] = useState<AsteroidsGameOverData | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(1); // Default to Normal
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [graphicsLevel, setGraphicsLevel] = useState<GraphicsLevel>(() => loadGraphicsSettings());
  
  const { isFullscreen, isSupported: fullscreenSupported, toggleFullscreen } = useFullscreen();
  const showFullscreenBtn = shouldShowFullscreenButton() && fullscreenSupported;
  const isIOS = isIOSDevice();
  
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gameOverButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  
  const [highScores, setHighScores] = useState<HighScore[]>(() => {
    try {
      const saved = localStorage.getItem("asteroids-high-scores");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Focus management
  useEffect(() => {
    if (view === "home" && buttonRefs.current[focusedIndex]) {
      buttonRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, view]);

  // Gamepad polling
  useEffect(() => {
    if (view !== "home") return;
    
    let lastNav = 0;
    let lastSelect = false;
    let lastBack = false;
    const NAV_DELAY = 180;
    
    const poll = () => {
      const gp = anyGamepad();
      setGamepadConnected(!!gp);
      if (!gp) return;
      
      const profile = loadProfile(getLastDeviceId());
      const input = readGamepad(gp, profile);
      const now = performance.now();
      
      // Navigation
      if (now - lastNav > NAV_DELAY) {
        if (input.ui.down) {
          setFocusedIndex(i => Math.min(MENU_ITEMS.length - 1, i + 1));
          vibrate(30, 0.3, 0);
          lastNav = now;
        } else if (input.ui.up) {
          setFocusedIndex(i => Math.max(0, i - 1));
          vibrate(30, 0.3, 0);
          lastNav = now;
        }
      }
      
      // Selection (ui.select = thrust button / A button)
      if (input.ui.select && !lastSelect) {
        vibrate(50, 0.5, 0.2);
        handleMenuSelect(MENU_ITEMS[focusedIndex].id);
      }
      lastSelect = input.ui.select;
      
      // Back (ui.back = B button)
      if (input.ui.back && !lastBack) {
        vibrate(30, 0.3, 0);
        window.history.back();
      }
      lastBack = input.ui.back;
    };
    
    const interval = setInterval(poll, 50);
    return () => clearInterval(interval);
  }, [view, focusedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(i => Math.min(MENU_ITEMS.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(i => Math.max(0, i - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      window.history.back();
    }
  }, []);

  const handleMenuSelect = (id: string) => {
    if (id === "easy" || id === "normal" || id === "hard") {
      setDifficulty(id.charAt(0).toUpperCase() + id.slice(1));
      setView("game");
    } else if (id === "swap") {
      toggleSwapButtons();
    } else if (id === "color") {
      window.location.href = "/asteroids-color";
    } else if (id === "remix") {
      window.location.href = "/asteroids-remix";
    }
  };

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

  const handleCycleGraphics = () => {
    const next = cycleGraphicsLevel(graphicsLevel);
    setGraphicsLevel(next);
    saveGraphicsSettings(next);
  };

  // Game over screen logic
  const isHighScore = lastResult && (highScores.length < 10 || highScores.some(score => lastResult.score > score.score));
  const [gameOverFocusIndex, setGameOverFocusIndex] = useState(0);
  
  // Game over keyboard/gamepad handling
  useEffect(() => {
    if (view === "gameover" && !isHighScore) {
      const handleKeyDown = (e: KeyboardEvent) => {
        const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (targetTag === "input" || targetTag === "textarea") return;
        
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setGameOverFocusIndex(i => i === 0 ? 1 : 0);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (gameOverFocusIndex === 0) retryGame();
          else backToHome();
        }
      };
      
      let lastSelect = false;
      let lastNav = 0;
      const NAV_DELAY = 180;
      
      const handleGamepad = () => {
        const gp = anyGamepad();
        if (!gp) return;
        
        const profile = loadProfile(getLastDeviceId());
        const input = readGamepad(gp, profile);
        const now = performance.now();
        
        if (now - lastNav > NAV_DELAY) {
          if (input.ui.down || input.ui.up) {
            setGameOverFocusIndex(i => i === 0 ? 1 : 0);
            vibrate(30, 0.3, 0);
            lastNav = now;
          }
        }
        
        if (input.ui.select && !lastSelect) {
          vibrate(50, 0.5, 0.2);
          if (gameOverFocusIndex === 0) retryGame();
          else backToHome();
        }
        lastSelect = input.ui.select;
      };
      
      window.addEventListener("keydown", handleKeyDown);
      const gamepadInterval = setInterval(handleGamepad, 50);
      
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        clearInterval(gamepadInterval);
      };
    }
  }, [view, isHighScore, gameOverFocusIndex]);

  // Focus game over buttons
  useEffect(() => {
    if (view === "gameover" && !isHighScore && gameOverButtonRefs.current[gameOverFocusIndex]) {
      gameOverButtonRefs.current[gameOverFocusIndex]?.focus();
    }
  }, [view, isHighScore, gameOverFocusIndex]);

  if (view === "home") {
    return (
      <div 
        ref={containerRef}
        className="fixed inset-0 bg-background overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Starfield Background */}
        <div className="absolute inset-0 z-0">
          {isIOS ? (
            <MobileStarfield starCount={400} speed={0.3} />
          ) : (
            <HyperspaceStarfield 
              speed={0.3} 
              density={400} 
              style="vector" 
              fullscreen 
              lowGraphics={graphicsLevel === "low"}
            />
          )}
        </div>
        
        {/* Radial gradient overlay */}
        <div 
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.8) 100%)"
          }}
        />
        
        {/* Main content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {/* Title */}
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl font-display tracking-widest text-center mb-8"
            style={{ 
              color: "hsl(var(--neon))",
              textShadow: "0 0 20px hsl(var(--neon) / 0.6), 0 0 40px hsl(var(--neon) / 0.3)"
            }}
          >
            NEON ASTEROIDS
          </h1>
          
          {/* Menu buttons */}
          <nav className="flex flex-col items-center gap-2 w-full max-w-xs">
            {MENU_ITEMS.map((item, index) => (
              <button
                key={item.id}
                ref={el => buttonRefs.current[index] = el}
                className={`player-menu-btn w-full ${focusedIndex === index ? 'selected' : ''}`}
                onClick={() => handleMenuSelect(item.id)}
                onFocus={() => setFocusedIndex(index)}
              >
                {item.id === "swap" ? (
                  <>{item.label}: {swapButtons ? "SWAPPED" : "NORMAL"}</>
                ) : (
                  item.label
                )}
                {item.sub && item.id !== "swap" && (
                  <span className="block text-xs opacity-60 mt-0.5">{item.sub}</span>
                )}
              </button>
            ))}
          </nav>
          
          {/* High Scores */}
          {highScores.length > 0 && (
            <div 
              className="mt-8 border-2 rounded-lg p-4 bg-background/40 backdrop-blur-sm w-full max-w-xs"
              style={{ borderColor: "hsl(var(--neon) / 0.5)" }}
            >
              <h3 
                className="text-center font-display tracking-wider mb-3 text-sm"
                style={{ color: "hsl(var(--neon))" }}
              >
                HIGH SCORES
              </h3>
              <ol className="space-y-1">
                {highScores.slice(0, 5).map((score, i) => (
                  <li 
                    key={i}
                    className="flex justify-between font-display tracking-wider text-sm"
                    style={{ color: "hsl(var(--neon))", textShadow: "0 0 8px currentColor" }}
                  >
                    <span>{score.initials}</span>
                    <span>{score.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <footer className="relative z-10 flex items-center justify-center gap-4 p-4 text-xs">
          {showFullscreenBtn && (
            <button
              onClick={toggleFullscreen}
              className="player-menu-back-btn flex items-center gap-1.5 px-3 py-1.5"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              <span className="hidden sm:inline">{isFullscreen ? "Exit FS" : "Fullscreen"}</span>
            </button>
          )}
          
          <button
            onClick={handleCycleGraphics}
            className="player-menu-back-btn px-3 py-1.5"
          >
            {getGraphicsLabel(graphicsLevel)}
          </button>
          
          <button
            onClick={() => window.history.back()}
            className="player-menu-back-btn px-3 py-1.5"
          >
            ← BACK
          </button>
        </footer>
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

  // Game Over view
  return (
    <div className="fixed inset-0 bg-background overflow-hidden flex flex-col">
      {/* GameOverStarfield: user's chosen starfield style */}
      <GameOverStarfield />
      {/* OLD GAMEOVER STARFIELD
      <div className="absolute inset-0 z-0">
        {isIOS ? (
          <MobileStarfield starCount={400} speed={0.3} />
        ) : (
          <HyperspaceStarfield 
            speed={0.3} 
            density={400} 
            style="vector" 
            fullscreen 
            lowGraphics={graphicsLevel === "low"}
          />
        )}
      </div>
      END OLD GAMEOVER STARFIELD */}
      
      {/* Radial gradient overlay */}
      <div 
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.8) 100%)"
        }}
      />
      
      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
        {/* Title */}
        <h1 
          className="text-3xl sm:text-4xl font-display tracking-widest text-center mb-6"
          style={{ 
            color: "hsl(0 80% 60%)",
            textShadow: "0 0 20px hsl(0 80% 50% / 0.6), 0 0 40px hsl(0 80% 50% / 0.3)"
          }}
        >
          {lastResult?.cause === "destroyed" ? "SHIP DESTROYED" : "MISSION ABORTED"}
        </h1>
        
        {lastResult && (
          <div 
            className="border-2 rounded-lg p-6 bg-background/40 backdrop-blur-sm mb-6"
            style={{ borderColor: "hsl(var(--neon) / 0.5)" }}
          >
            <div 
              className="text-2xl font-display tracking-wider text-center mb-2"
              style={{ color: "hsl(var(--neon))", textShadow: "0 0 12px currentColor" }}
            >
              {lastResult.score.toLocaleString()}
            </div>
            <div className="text-center text-muted-foreground text-sm">
              Wave {lastResult.wave} • {lastResult.elapsed.toFixed(1)}s
            </div>
          </div>
        )}

        {isHighScore && lastResult ? (
          <div className="flex flex-col items-center gap-4">
            <h2 
              className="text-xl font-display tracking-wider"
              style={{ color: "hsl(var(--neon))", textShadow: "0 0 12px currentColor" }}
            >
              NEW HIGH SCORE!
            </h2>
            <InitialsEntry
              onSubmit={handleInitialsSubmit}
              score={lastResult.score}
              neonColor={neonColor}
              onInitialsConfirmed={handleInitialsSubmit}
            />
          </div>
        ) : (
          <nav className="flex flex-col items-center gap-2 w-full max-w-xs">
            <button
              ref={el => gameOverButtonRefs.current[0] = el}
              className={`player-menu-btn w-full ${gameOverFocusIndex === 0 ? 'selected' : ''}`}
              onClick={retryGame}
              onFocus={() => setGameOverFocusIndex(0)}
              autoFocus
            >
              TRY AGAIN
            </button>
            <button
              ref={el => gameOverButtonRefs.current[1] = el}
              className={`player-menu-btn w-full ${gameOverFocusIndex === 1 ? 'selected' : ''}`}
              onClick={backToHome}
              onFocus={() => setGameOverFocusIndex(1)}
            >
              MAIN MENU
            </button>
          </nav>
        )}
      </div>
      
      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center gap-4 p-4 text-xs">
        {showFullscreenBtn && (
          <button
            onClick={toggleFullscreen}
            className="player-menu-back-btn flex items-center gap-1.5 px-3 py-1.5"
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        )}
        
        <button
          onClick={handleCycleGraphics}
          className="player-menu-back-btn px-3 py-1.5"
        >
          {getGraphicsLabel(graphicsLevel)}
        </button>
      </footer>
    </div>
  );
};

export default Asteroids;
