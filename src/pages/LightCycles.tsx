import React, { useState, useRef, useEffect } from "react";
import { LightCyclesEngine } from "@/components/game/LightCyclesEngine";
import { InitialsEntry } from "@/components/game/InitialsEntry";
import { LightCyclesDifficulty, LightCyclesGameOverData } from "@/components/game/types/lightcycles";
import { Button } from "@/components/ui/button";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";
import { anyGamepad, getLastDeviceId, loadProfile, readGamepad, setUiMode } from "@/hooks/use-gamepad";

type View = "home" | "game" | "gameover";
type Difficulty = "easy" | "hard";

interface HighScore {
  initials: string;
  score: number;
  difficulty: Difficulty;
  level: number;
  date: number;
}

const LightCycles: React.FC = () => {
  const [view, setView] = useState<View>("home");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [startLevel, setStartLevel] = useState<number>(1);
  const [lastResult, setLastResult] = useState<LightCyclesGameOverData | null>(null);
  const [highScores, setHighScores] = useState<HighScore[]>(() => {
    const now = Date.now();
    const seed: HighScore[] = [
      { initials: "TRN", score: 50000, difficulty: "easy", level: 20, date: now },
      { initials: "CLU", score: 35000, difficulty: "hard", level: 15, date: now - 86400000 },
      { initials: "SAM", score: 25000, difficulty: "easy", level: 12, date: now - 86400000 * 2 },
      { initials: "KVN", score: 15000, difficulty: "hard", level: 8, date: now - 86400000 * 3 },
      { initials: "ZED", score: 10000, difficulty: "easy", level: 5, date: now - 86400000 * 4 },
    ];
    try {
      const saved = localStorage.getItem("lightcycles-high-scores");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length >= 5) return parsed.slice(0, 5);
    } catch {}
    localStorage.setItem("lightcycles-high-scores", JSON.stringify(seed));
    return seed;
  });

  // Navigation refs
  const diffButtonRefs = useRef<{ [key in Difficulty]: HTMLButtonElement | null }>({
    easy: null,
    hard: null
  });
  const levelButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});
  const [navIndex, setNavIndex] = useState({ section: 0, item: 0 });

  // Game Over refs
  const tryAgainRef = useRef<HTMLButtonElement>(null);
  const mainMenuRef = useRef<HTMLButtonElement>(null);
  const [goFocusIndex, setGoFocusIndex] = useState<0 | 1>(0);
  const gpProfileRef = useRef(loadProfile(getLastDeviceId()));

  const startGame = (selectedDifficulty: Difficulty, level: number = 1) => {
    setDifficulty(selectedDifficulty);
    setStartLevel(level);
    setView("game");
  };

  const handleGameOver = (data: LightCyclesGameOverData) => {
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
        difficulty: difficulty,
        level: lastResult.wave,
        date: Date.now()
      };
      
      const updatedScores = [...highScores, newScore]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      
      setHighScores(updatedScores);
      
      try {
        localStorage.setItem("lightcycles-high-scores", JSON.stringify(updatedScores));
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

  // Navigation logic similar to lunar lander
  const difficulties: Difficulty[] = ["easy", "hard"];
  const levels = [5, 10, 15, 20, 30, 50];

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

  // Keyboard navigation matching Lunar Lander HomeScreen pattern
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
        
        // Add "ENTER THE GRID" buttons for each difficulty
        difficulties.forEach(d => {
          const btn = diffButtonRefs.current[d];
          if (btn) elements.push(btn);
        });
        
        // Add level buttons for each difficulty
        difficulties.forEach(d => {
          levels.forEach(L => {
            const btn = levelButtonRefs.current[L];
            if (btn) elements.push(btn);
          });
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
            NEON LIGHT CYCLES
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Enter the digital grid and outrun your opponents in classic TRON style. Leave glowing trails as you race for survival.
          </p>

          {/* Navigation buttons */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <a href="/" className="inline-block">
              <Button variant="outline">
                ← Back to Main Menu
              </Button>
            </a>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex gap-3">
              {difficulties.map((d, dIndex) => (
                <div key={d} className="border border-border/60 rounded-lg p-4 w-44 bg-card/50">
                  <div className="text-lg font-semibold">{d.toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {d === "easy" ? "Slower pace, forgiving controls" : "Fast-paced, precision required"}
                  </div>
                  <Button
                    ref={(el) => { diffButtonRefs.current[d] = el; }}
                    variant="hero" 
                    size="lg" 
                    className="w-full mt-3 font-mono tracking-wider text-accent border-accent shadow-[0_0_20px_hsl(var(--accent)/0.3)] hover:shadow-[0_0_30px_hsl(var(--accent)/0.5)] transition-all duration-300" 
                    onClick={() => startGame(d, 1)}
                  >
                    &gt; ENTER THE GRID &lt;
                  </Button>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mt-3">Start at wave</div>
                  <div className="mt-2 grid grid-cols-6 gap-2">
                    {levels.map((L, idx) => (
                      <Button
                        key={L}
                        ref={(el) => { levelButtonRefs.current[L] = el; }}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => startGame(d, L)}
                      >
                        {L}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {highScores.length > 0 && (
              <div className="mt-6 text-left bg-card/60 border border-border/60 rounded-lg p-4 w-[min(90vw,720px)]">
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
                          Wave {score.level}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>Use A/D or Left/Right arrows to turn</p>
              <p>Hold SPACE to accelerate</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (view === "game") {
    return (
      <LightCyclesEngine
        difficulty={difficulty === "easy" ? "Easy" : "Hard"}
        startLevel={startLevel}
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
          <h1 className="text-4xl font-bold text-destructive">
            {lastResult?.cause === "collision" ? "LIGHT CYCLE DESTROYED" : "MISSION ABORTED"}
          </h1>
          
          {lastResult && (
            <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6 space-y-2">
              <div className="text-2xl font-bold text-accent">
                Score: {lastResult.score.toLocaleString()}
              </div>
              <div className="text-lg">Wave: {lastResult.wave}</div>
              <div className="text-lg">Cycles Destroyed: {lastResult.cyclesDestroyed}</div>
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

export default LightCycles;