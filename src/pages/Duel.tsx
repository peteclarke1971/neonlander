import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DuelEngine } from "@/engine/duel/DuelEngine";
import { DuelOptions } from "@/engine/duel/types";
import { GameOverStarfield } from "@/components/game/GameOverStarfield";
import { anyGamepad, readGamepad, loadProfile, vibrate } from "@/hooks/use-gamepad";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";
import { MobileStarfield } from "@/components/game/MobileStarfield";
import { isIOSDevice, shouldShowFullscreenButton } from "@/lib/deviceDetection";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { Maximize, Minimize } from "lucide-react";

const MENU_ITEMS = ["start", "back"] as const;

export default function Duel() {
  const navigate = useNavigate();
  const [gameStarted, setGameStarted] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isIOS] = useState(() => isIOSDevice());
  const [showFullscreenBtn] = useState(() => shouldShowFullscreenButton());
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  
  const [options, setOptions] = useState<DuelOptions>(() => {
    let lowGFX = true;
    try {
      const graphicsSettings = localStorage.getItem('ll-graphics-settings');
      if (graphicsSettings) {
        const parsed = JSON.parse(graphicsSettings);
        lowGFX = parsed.lowGraphics;
      } else {
        const savedLowGfx = localStorage.getItem('ll-low-graphics');
        lowGFX = savedLowGfx !== 'false';
      }
    } catch {
      lowGFX = true;
    }
    
    return {
      seed: Math.floor(Math.random() * 1000000),
      wrap: false,
      hazards: true,
      showFuel: false,
      lowGFX,
    };
  });

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus management
  useEffect(() => {
    if (gameStarted) return;
    buttonRefs.current[focusedIndex]?.focus();
  }, [focusedIndex, gameStarted]);

  // Gamepad navigation
  useEffect(() => {
    let raf = 0;
    let lastId: string | null = null;
    let profile = loadProfile(undefined);
    let prev = { up: false, down: false, select: false, back: false };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (gameStarted) return;
      
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      
      if (lastId !== gp.id) {
        lastId = gp.id;
        profile = loadProfile(gp.id);
      }
      
      const input = readGamepad(gp, profile);
      
      if (input.ui.up && !prev.up) {
        vibrate(30, 0.3, 0);
        setFocusedIndex(i => Math.max(0, i - 1));
      }
      if (input.ui.down && !prev.down) {
        vibrate(30, 0.3, 0);
        setFocusedIndex(i => Math.min(MENU_ITEMS.length - 1, i + 1));
      }
      if (input.ui.select && !prev.select) {
        vibrate(50, 0.5, 0.2);
        buttonRefs.current[focusedIndex]?.click();
      }
      if (input.ui.back && !prev.back) {
        vibrate(30, 0.3, 0);
        navigate("/");
      }
      
      prev = { 
        up: input.ui.up, 
        down: input.ui.down, 
        select: input.ui.select, 
        back: input.ui.back 
      };
    };
    
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gameStarted, focusedIndex, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (gameStarted) return;
    
    if (e.key === "Escape") {
      e.preventDefault();
      navigate("/");
      return;
    }
    
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(i => Math.max(0, i - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(i => Math.min(MENU_ITEMS.length - 1, i + 1));
    }
  };

  const handleStartMatch = () => {
    setGameStarted(true);
  };

  const handleMatchEnd = () => {
    setGameStarted(false);
  };

  const generateNewSeed = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    setOptions(prev => ({ ...prev, seed: newSeed }));
  };

  if (gameStarted) {
    return (
      <DuelEngine 
        options={options} 
        onMatchEnd={handleMatchEnd}
      />
    );
  }

  return (
    <main 
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* GameOverStarfield: user's chosen starfield style */}
      <GameOverStarfield />
      {/* OLD STARFIELD BACKGROUND
      <div className="absolute inset-0 z-0">
        {isIOS ? (
          <MobileStarfield starCount={400} speed={0.3} />
        ) : (
          <HyperspaceStarfield 
            speed={0.3} 
            density={400} 
            style="vector" 
            fullscreen 
            lowGraphics={options.lowGFX} 
          />
        )}
      </div>
      END OLD STARFIELD BACKGROUND */}

      {/* Radial gradient overlay */}
      <div 
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.8) 100%)"
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center px-4 w-full max-w-md">
        {/* Title */}
        <h1 
          className="text-4xl sm:text-5xl md:text-6xl font-display tracking-widest text-center mb-2"
          style={{ 
            color: "hsl(var(--neon))",
            textShadow: "0 0 20px hsl(var(--neon) / 0.6), 0 0 40px hsl(var(--neon) / 0.3)"
          }}
        >
          LANDER DUEL
        </h1>
        <p 
          className="text-center text-sm mb-6 opacity-70"
          style={{ color: "hsl(var(--neon))" }}
        >
          Two-player arena combat • First to 2 wins!
        </p>

        {/* Arena Seed Panel */}
        <div 
          className="border-2 rounded-lg p-4 bg-background/40 backdrop-blur-sm mb-4 w-full"
          style={{ borderColor: "hsl(var(--neon) / 0.5)" }}
        >
          <label 
            className="block text-sm font-display tracking-wider mb-2"
            style={{ color: "hsl(var(--neon))" }}
          >
            ARENA SEED
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={options.seed}
              onChange={(e) => setOptions(prev => ({ 
                ...prev, 
                seed: parseInt(e.target.value) || 0 
              }))}
              className="flex-1 bg-background/60 border-2 rounded px-3 py-2 font-display tracking-wider text-center focus:outline-none focus:ring-2"
              style={{ 
                borderColor: "hsl(var(--neon) / 0.4)", 
                color: "hsl(var(--neon))",
              }}
            />
            <button
              onClick={generateNewSeed}
              className="player-menu-btn px-4 py-2 text-sm"
            >
              RANDOM
            </button>
          </div>
          <p className="text-xs mt-2 opacity-50" style={{ color: "hsl(var(--neon))" }}>
            Same seed = same arena layout
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4 w-full">
          <button
            onClick={() => setOptions(prev => ({ ...prev, wrap: !prev.wrap }))}
            className={`player-menu-btn text-sm py-2 ${options.wrap ? 'selected' : ''}`}
          >
            WRAP: {options.wrap ? "ON" : "OFF"}
          </button>
          
          <button
            onClick={() => setOptions(prev => ({ ...prev, hazards: !prev.hazards }))}
            className={`player-menu-btn text-sm py-2 ${options.hazards ? 'selected' : ''}`}
          >
            HAZARDS: {options.hazards ? "ON" : "OFF"}
          </button>
          
          <button
            onClick={() => setOptions(prev => ({ ...prev, showFuel: !prev.showFuel }))}
            className={`player-menu-btn text-sm py-2 ${options.showFuel ? 'selected' : ''}`}
          >
            FUEL: {options.showFuel ? "ON" : "OFF"}
          </button>
          
          <button
            onClick={() => setOptions(prev => ({ ...prev, lowGFX: !prev.lowGFX }))}
            className={`player-menu-btn text-sm py-2 ${options.lowGFX ? 'selected' : ''}`}
          >
            LOW GFX: {options.lowGFX ? "ON" : "OFF"}
          </button>
        </div>

        {/* Controls Info */}
        <div 
          className="text-xs space-y-1 mb-6 text-center"
          style={{ color: "hsl(var(--neon) / 0.6)" }}
        >
          <p className="font-display tracking-wider" style={{ color: "hsl(var(--neon))" }}>CONTROLS</p>
          <p>P1: Arrows/Gamepad + Space (fire) + Shift (boost)</p>
          <p>P2: A/D + W + F (fire) + Left Shift (boost)</p>
        </div>

        {/* Action Buttons */}
        <nav className="flex flex-col items-center gap-2 w-full">
          <button
            ref={el => buttonRefs.current[0] = el}
            className={`player-menu-btn w-full ${focusedIndex === 0 ? 'selected' : ''}`}
            onClick={handleStartMatch}
            onFocus={() => setFocusedIndex(0)}
          >
            START MATCH
          </button>
          <button
            ref={el => buttonRefs.current[1] = el}
            className={`player-menu-btn w-full ${focusedIndex === 1 ? 'selected' : ''}`}
            onClick={() => navigate("/")}
            onFocus={() => setFocusedIndex(1)}
          >
            BACK TO MENU
          </button>
        </nav>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-4 p-4 text-xs">
        {showFullscreenBtn && (
          <button
            onClick={toggleFullscreen}
            className="player-menu-back-btn flex items-center gap-1.5 px-3 py-1.5"
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit FS" : "Fullscreen"}</span>
          </button>
        )}
      </footer>
    </main>
  );
}
