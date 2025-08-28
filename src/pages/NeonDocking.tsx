import React, { useState, useRef, useEffect } from "react";
import { OrbitalPadEngine } from "@/components/game/OrbitalPadEngine";
import { InitialsEntry } from "@/components/game/InitialsEntry";
import { OrbitalDockingGameOverData } from "@/components/game/types/orbitaldocking";
import { Button } from "@/components/ui/button";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";
import { anyGamepad, getLastDeviceId, loadProfile, readGamepad, setUiMode } from "@/hooks/use-gamepad";

type View = "home" | "game" | "gameover";

interface HighScore {
  initials: string;
  score: number;
  level: number;
  date: number;
}

const NeonDocking: React.FC = () => {
  const [view, setView] = useState<View>("home");
  const [startLevel, setStartLevel] = useState<number>(1);
  const [lastResult, setLastResult] = useState<OrbitalDockingGameOverData | null>(null);
  const [highScores, setHighScores] = useState<HighScore[]>(() => {
    const now = Date.now();
    const seed: HighScore[] = [
      { initials: "ORB", score: 12000, level: 8, date: now },
      { initials: "PAD", score: 10500, level: 6, date: now - 86400000 },
      { initials: "LND", score: 9800, level: 5, date: now - 86400000 * 2 },
      { initials: "DOK", score: 8200, level: 4, date: now - 86400000 * 3 },
      { initials: "ROT", score: 7500, level: 3, date: now - 86400000 * 4 },
    ];
    try {
      const saved = localStorage.getItem("neon-docking-high-scores");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length >= 5) return parsed.slice(0, 5);
    } catch {}
    localStorage.setItem("neon-docking-high-scores", JSON.stringify(seed));
    return seed;
  });

  // Navigation refs
  const levelButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});
  const [navIndex, setNavIndex] = useState({ section: 0, item: 0 });

  // Game Over refs
  const tryAgainRef = useRef<HTMLButtonElement>(null);
  const mainMenuRef = useRef<HTMLButtonElement>(null);
  const [goFocusIndex, setGoFocusIndex] = useState<0 | 1>(0);

  const startGame = (level: number = 1) => {
    setStartLevel(level);
    setView("game");
  };

  const handleGameOver = (data: OrbitalDockingGameOverData) => {
    setLastResult(data);
    setView("gameover");
    setTimeout(() => {
      tryAgainRef.current?.focus();
      setGoFocusIndex(0);
    }, 10);
  };

  const handleInitialsSubmit = (initials: string) => {
    if (lastResult) {
      const newScore: HighScore = {
        initials,
        score: lastResult.score,
        level: startLevel,
        date: Date.now()
      };
      
      const updatedScores = [...highScores, newScore]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      
      setHighScores(updatedScores);
      
      try {
        localStorage.setItem("neon-docking-high-scores", JSON.stringify(updatedScores));
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

  // Available levels
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  // Gamepad profile ref for game over screen
  const gpProfileRef = useRef(loadProfile(getLastDeviceId()));

  // Gamepad navigation
  useEffect(() => {
    if (view !== "home") return;
    
    let raf = 0;
    let lastId: string | null = getLastDeviceId();
    let gpProfile = loadProfile(lastId || undefined);
    let prev = { up: false, down: false, left: false, right: false, select: false, back: false };
    let lastFire = { up: 0, down: 0, left: 0, right: 0, select: 0, back: 0 };
    
    const canFire = (k: keyof typeof lastFire) => (performance.now() - lastFire[k]) > 150;
    const mark = (k: keyof typeof lastFire) => { lastFire[k] = performance.now(); };
    
    const fire = (key: string) => {
      const target = (document.activeElement as HTMLElement) || document.body;
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    };
    
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      
      if (lastId !== gp.id) {
        lastId = gp.id;
        gpProfile = loadProfile(gp.id);
      }
      
      const input = readGamepad(gp, gpProfile);
      
      if (input.ui.up && !prev.up && canFire("up")) { fire("ArrowUp"); mark("up"); }
      if (input.ui.down && !prev.down && canFire("down")) { fire("ArrowDown"); mark("down"); }
      if (input.ui.left && !prev.left && canFire("left")) { fire("ArrowLeft"); mark("left"); }
      if (input.ui.right && !prev.right && canFire("right")) { fire("ArrowRight"); mark("right"); }
      if (input.ui.select && !prev.select && canFire("select")) { fire("Enter"); mark("select"); }
      if (input.ui.back && !prev.back && canFire("back")) { fire("Escape"); mark("back"); }
      
      prev = input.ui;
    };
    
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [view, navIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (view !== "home") return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Tab"].includes(e.key)) return;
      
      const focus = (el?: HTMLElement | null) => el && el.focus();
      const key = e.key;
      
      // Allow natural tab navigation without interference
      if (key === "Tab") return;
      
      // Prevent default for arrow keys and Enter/Space
      e.preventDefault();
      
      const active = document.activeElement as HTMLElement | null;
      
      // Get all focusable elements in order
      const getAllFocusableElements = () => {
        const elements: HTMLElement[] = [];
        
        // Add level buttons
        levels.forEach(l => {
          const btn = levelButtonRefs.current[l];
          if (btn) elements.push(btn);
        });
        
        return elements;
      };
      
      const focusables = getAllFocusableElements();
      const currentIndex = focusables.findIndex(el => el === active);
      
      if (key === "ArrowRight" || key === "ArrowDown") {
        const nextIndex = (currentIndex + 1) % focusables.length;
        focus(focusables[nextIndex]);
      } else if (key === "ArrowLeft" || key === "ArrowUp") {
        const prevIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
        focus(focusables[prevIndex]);
      } else if (key === "Enter" || key === " ") {
        active?.click();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view]);

  // Set UI mode for gamepad
  useEffect(() => {
    try { setUiMode(view !== "game"); } catch {}
  }, [view]);

  if (view === "home") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 z-0" aria-hidden>
          <HyperspaceStarfield />
        </div>
        <div className="absolute inset-0 z-10 opacity-50 pointer-events-none" aria-hidden>
          <div className="pointer-events-none w-full h-full" style={{
            background: "radial-gradient(800px 400px at 50% 0%, hsla(var(--neon),0.15), transparent 60%)"
          }} />
        </div>

        <section className="relative z-20 text-center animate-enter">
          <h1 className="neon-title text-5xl md:text-6xl font-extrabold font-display tracking-widest mb-3 text-foreground drop-shadow-[0_0_18px_hsla(var(--neon),_0.5)]">
            NEON DOCKING
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto mb-2">
            Master orbital mechanics to rendezvous with rotating landing pads. Use precise thrust vectoring to achieve clean captures in this vector space docking simulation.
          </p>
          <p className="text-xs text-muted-foreground/80 max-w-lg mx-auto">
            Arrow keys rotate ship, SPACE thrusts along nose direction. Land softly on the rotating pad!
          </p>

          {/* Navigation buttons */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <a href="/" className="inline-block">
              <Button variant="outline">
                ← Back to Main Menu
              </Button>
            </a>
          </div>

          {/* Level Selection */}
          <div className="mt-8 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-accent">Select Docking Level</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Higher levels have smaller pads and faster rotation
            </p>
            
            <div className="border border-border/60 rounded-lg p-6 bg-card/50 max-w-2xl mx-auto">
              <div className="grid grid-cols-5 gap-3">
                {levels.map((level) => (
                  <Button
                    key={level}
                    ref={(el) => { levelButtonRefs.current[level] = el; }}
                    variant={level === 1 ? "neon" : "outline"}
                    size="lg"
                    className="aspect-square font-mono text-lg"
                    onClick={() => startGame(level)}
                  >
                    {level}
                  </Button>
                ))}
              </div>
              
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <div>• Levels 1-3: Large pads, slow rotation (Beginner)</div>
                <div>• Levels 4-6: Medium pads, moderate rotation (Intermediate)</div>
                <div>• Levels 7-10: Small pads, fast rotation (Expert)</div>
              </div>
            </div>
          </div>

          {/* High Scores */}
          {highScores.length > 0 && (
            <div className="mt-6 text-left bg-card/60 border border-border/60 rounded-lg p-4 w-[min(90vw,720px)] mx-auto">
              <div className="flex items-center justify-between">
                <div className="text-sm uppercase tracking-wider text-muted-foreground">High Scores</div>
              </div>
              <div className="mt-2 space-y-2 animate-enter-slow">
                <ol>
                  {highScores.slice(0, 5).map((score, i) => (
                    <li key={`${score.initials}-${i}`} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-foreground/90 w-5 text-right">{i + 1}.</span>
                        <span className="font-mono text-accent">{score.initials}</span>
                      </div>
                      <span className="text-accent font-semibold">{score.score.toLocaleString()}</span>
                      <span className="text-muted-foreground hidden sm:block">
                        Level {score.level}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (view === "game") {
    return (
      <OrbitalPadEngine
        level={startLevel}
        onExit={backToHome}
        onGameOver={handleGameOver}
      />
    );
  }

  // Game over view
  const isHighScore = lastResult && highScores.some(score => lastResult.score > score.score);
  
  // Add keyboard handling for game over screen
  useEffect(() => {
    if (view !== "gameover") return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        retryGame(); // Default to retry game
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setGoFocusIndex(prev => prev === 0 ? 1 : 0);
        const refs = [tryAgainRef, mainMenuRef];
        refs[goFocusIndex === 0 ? 1 : 0].current?.focus();
      }
    };
    
    // Gamepad handling
    const handleGamepad = () => {
      const gp = anyGamepad();
      if (gp && gpProfileRef.current) {
        const input = readGamepad(gp, gpProfileRef.current);
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
  }, [view, goFocusIndex]);
  
  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden>
        <HyperspaceStarfield />
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-accent">
            {lastResult?.cause === "crash" ? "SHIP DESTROYED" : 
             lastResult?.cause === "timeout" ? "TIME EXPIRED" : 
             lastResult?.cause === "fuel" ? "OUT OF FUEL" :
             lastResult?.cause === "success" ? "DOCKING SUCCESSFUL" : "MISSION ENDED"}
          </h1>
          
          {lastResult && (
            <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6 space-y-2">
              <div className="text-2xl font-bold text-accent">
                Score: {lastResult.score.toLocaleString()}
              </div>
              <div className="text-lg">Time: {lastResult.time.toFixed(1)}s</div>
              <div className="text-lg">Fuel Left: {Math.round(lastResult.fuelRemaining)}%</div>
              {lastResult.cleanCapture && (
                <div className="text-lg text-green-400 font-semibold">Clean Capture Bonus!</div>
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
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Button ref={tryAgainRef} onClick={retryGame} variant="outline" size="lg" className={goFocusIndex === 0 ? "focus-visible:ring-2 focus-visible:ring-accent" : ""}>
              Try Again
            </Button>
            <Button ref={mainMenuRef} onClick={backToHome} variant="ghost" className={goFocusIndex === 1 ? "focus-visible:ring-2 focus-visible:ring-accent" : ""}>
              Main Menu
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NeonDocking;