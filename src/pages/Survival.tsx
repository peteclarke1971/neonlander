import React, { useState, useRef, useEffect, useCallback } from "react";
import { SurvivalEngine } from "@/components/game/SurvivalEngine";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";
import { Button } from "@/components/ui/button";
import { SurvivalGameOverData } from "@/components/game/types/survival";
import { InitialsEntry } from "@/components/game/InitialsEntry";
import { GameOverStarfield } from "@/components/game/GameOverStarfield";
import { OnlineLeaderboard } from "@/components/game/OnlineLeaderboard";
import { submitScore } from "@/lib/leaderboard";
import { anyGamepad, loadProfile, readGamepad, getLastDeviceId, gateThrustUntilRelease } from "@/hooks/use-gamepad";

type View = "home" | "game" | "gameover";

interface HighScore {
  initials: string;
  score: number;
  distance: number;
  time: number;
  date: number;
}

const Survival: React.FC = () => {
  // Check for autostart param from Player Menu
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === 'true' ? 'game' : 'home';
  });
  const [lastResult, setLastResult] = useState<SurvivalGameOverData | null>(null);
  const [isHighScore, setIsHighScore] = useState(false);
  const [needsInitials, setNeedsInitials] = useState(false);
  const [recentlySubmittedScore, setRecentlySubmittedScore] = useState<{
    score: number;
    initials: string;
    mode: "survival";
    difficulty: "easy";
    timestamp: number;
  } | null>(null);
  const [showLeaderboardsAfterInitials, setShowLeaderboardsAfterInitials] = useState(false);
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
      { initials: "IH",  score: 50000, distance: 5000, time: 120, date: now },
      { initials: "SDP", score: 30000, distance: 3500, time: 90,  date: now - 86400000 },
      { initials: "PC",  score: 15000, distance: 2800, time: 75,  date: now - 86400000 * 2 },
      { initials: "ASH", score: 10000, distance: 2000, time: 60,  date: now - 86400000 * 3 },
      { initials: "IAN", score: 5000,  distance: 1500, time: 45,  date: now - 86400000 * 4 },
    ];
    try {
      const saved = localStorage.getItem("survival-mode-high-scores");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length >= 5) return parsed.slice(0, 5);
    } catch {}
    localStorage.setItem("survival-mode-high-scores", JSON.stringify(seed));
    return seed;
  });

  // Get neon color from CSS
  const neonColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--neon')})`;

  // Button refs for gamepad navigation on gameover
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [focusedButtonIndex, setFocusedButtonIndex] = useState(0);

  const backToHome = useCallback(() => {
    window.location.href = "/?view=playermenu";
  }, []);

  const retryGame = useCallback(() => {
    setShowLeaderboardsAfterInitials(false);
    setView("game");
  }, []);

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

  // Show cursor when on menu screens, hide only during gameplay
  useEffect(() => {
    const html = document.documentElement;
    if (view !== 'game') {
      // Ensure cursor is visible on menu/gameover screens
      html.classList.remove('hide-cursor');
    }
    
    return () => {
      // Cleanup: ensure cursor visible on unmount
      html.classList.remove('hide-cursor');
    };
  }, [view]);

  // Keyboard navigation for gameover screen
  useEffect(() => {
    if (view !== 'gameover' || needsInitials) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedButtonIndex(i => Math.max(0, i - 1));
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedButtonIndex(i => Math.min(1, i + 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedButtonIndex === 0) retryGame();
        else backToHome();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, needsInitials, focusedButtonIndex, retryGame, backToHome]);

  // Gamepad polling for gameover screen navigation
  useEffect(() => {
    if (view !== 'gameover' || needsInitials) return;
    
    let raf = 0;
    const prev = { up: false, down: false, left: false, right: false, select: false };
    let lastId = getLastDeviceId();
    let profile = loadProfile(lastId);
    const readyAt = performance.now() + 300; // 300ms input cooldown
    
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const gp = anyGamepad();
      if (!gp) return;
      if (lastId !== gp.id) {
        lastId = gp.id;
        profile = loadProfile(gp.id);
      }
      const input = readGamepad(gp, profile);
      
      // During cooldown, track state but skip actions
      if (performance.now() < readyAt) {
        prev.up = input.ui.up;
        prev.down = input.ui.down;
        prev.left = input.ui.left;
        prev.right = input.ui.right;
        prev.select = input.ui.select;
        return;
      }
      
      // Navigate: up/left = previous, down/right = next
      if ((input.ui.up && !prev.up) || (input.ui.left && !prev.left)) {
        setFocusedButtonIndex(i => Math.max(0, i - 1));
      }
      if ((input.ui.down && !prev.down) || (input.ui.right && !prev.right)) {
        setFocusedButtonIndex(i => Math.min(1, i + 1));
      }
      if (input.ui.select && !prev.select) {
        if (focusedButtonIndex === 0) retryGame();
        else {
          gateThrustUntilRelease();
          backToHome();
        }
      }
      
      prev.up = input.ui.up;
      prev.down = input.ui.down;
      prev.left = input.ui.left;
      prev.right = input.ui.right;
      prev.select = input.ui.select;
    };
    
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [view, needsInitials, focusedButtonIndex, retryGame, backToHome]);

  // Auto-focus first button when gameover shows
  useEffect(() => {
    if (view === 'gameover' && !needsInitials) {
      setFocusedButtonIndex(0);
      retryButtonRef.current?.focus();
    }
  }, [view, needsInitials]);

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
      
      // Submit to online leaderboard and track for highlighting
      void submitScore({
        initials,
        score: lastResult.score,
        difficulty: "easy",
        mode: "survival"
      }).then(() => {
        // Track recently submitted score for highlighting
        setRecentlySubmittedScore({
          score: lastResult.score,
          initials: initials.toUpperCase(),
          mode: "survival",
          difficulty: "easy",
          timestamp: Date.now(),
        });
        
        // Auto-clear highlight after 60 seconds
        setTimeout(() => {
          setRecentlySubmittedScore(null);
        }, 60000);
      });
    }
    
    setNeedsInitials(false);
    setShowLeaderboardsAfterInitials(true);
  };

  const backToMainMenu = () => {
    window.location.href = "/?view=playermenu";
  };

  const startGame = () => {
    setRecentlySubmittedScore(null);
    setShowLeaderboardsAfterInitials(false);
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
                  {highScores.map((score, idx) => {
                    // Check if this is the recently submitted score
                    const isHighlighted = recentlySubmittedScore &&
                      recentlySubmittedScore.score === score.score &&
                      recentlySubmittedScore.initials.toUpperCase() === score.initials.toUpperCase() &&
                      (Date.now() - recentlySubmittedScore.timestamp < 120000); // Within 2 minutes
                    
                    return (
                      <div 
                        key={idx}
                        className={`flex items-center justify-between text-lg py-2 px-4 rounded ${
                          isHighlighted 
                            ? 'bg-accent/20 border-l-4 border-accent pl-2 -ml-2 rounded-r animate-pulse-subtle shadow-[0_0_20px_hsl(var(--accent)/0.3)]' 
                            : 'bg-background/40'
                        }`}
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
                    );
                  })}
                </div>
              </div>
            )}

            <OnlineLeaderboard mode="survival" highlightScore={recentlySubmittedScore} />

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
      {/* GameOverStarfield: user's chosen starfield style */}
      <GameOverStarfield />
      {/* OLD GAMEOVER STARFIELD
      <div className="absolute inset-0 z-0" aria-hidden>
        <HyperspaceStarfield lowGraphics={lowGraphics} />
      </div>
      END OLD GAMEOVER STARFIELD */}
      
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-8 animate-enter">
        <div className="space-y-4">
          <h1 className="text-4xl font-display font-bold text-accent">
            {isHighScore ? "NEW HIGH SCORE!" :
             lastResult?.cause === "crash" ? "SHIP DESTROYED" : 
             lastResult?.cause === "fuel" ? "OUT OF FUEL" : "SURVIVAL ENDED"}
          </h1>
          
          {lastResult && (
            <p className="text-lg text-muted-foreground">
              Score: {lastResult.score.toLocaleString()} · Distance: {lastResult.distance.toFixed(0)}m · Time: {lastResult.time.toFixed(1)}s · Landings: {lastResult.landings}
            </p>
          )}

          {isHighScore && needsInitials && lastResult && (
            <InitialsEntry 
              score={lastResult.score}
              onSubmit={handleInitialsSubmit}
              neonColor={neonColor}
              onInitialsConfirmed={handleInitialsSubmit}
            />
          )}
        </div>

        {showLeaderboardsAfterInitials && highScores.length > 0 && (
          <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-display font-bold text-accent mb-4">LOCAL HIGH SCORES</h2>
            <div className="space-y-2">
              {highScores.map((score, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between text-lg py-2 px-4 rounded bg-background/40"
                >
                  <span className="font-mono text-muted-foreground w-8">{idx + 1}.</span>
                  <span className="font-bold text-accent w-16">{score.initials}</span>
                  <span className="font-mono flex-1 text-right">{score.score.toLocaleString()}</span>
                  <span className="text-muted-foreground text-sm ml-4 w-24 text-right">{score.distance.toFixed(0)}m</span>
                  <span className="text-muted-foreground text-sm ml-2 w-16 text-right">{score.time.toFixed(1)}s</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!isHighScore || !needsInitials) && (
          <div className="flex flex-col gap-4">
            <Button 
              ref={retryButtonRef}
              onClick={retryGame} 
              variant="neon" 
              size="lg"
              className={focusedButtonIndex === 0 ? 'ring-2 ring-accent' : ''}
              autoFocus
            >
              Try Again
            </Button>
            <Button 
              ref={menuButtonRef}
              onClick={backToHome} 
              variant="hero"
              className={focusedButtonIndex === 1 ? 'ring-2 ring-accent' : ''}
            >
              Back to Menu
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Survival;
