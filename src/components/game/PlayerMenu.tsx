import React, { useEffect, useRef, useState } from "react";
import { HyperspaceStarfield } from "./HyperspaceStarfield";
import { MobileStarfield } from "./MobileStarfield";
import { anyGamepad, loadProfile, readGamepad, gateThrustUntilRelease, setUiMode } from "@/hooks/use-gamepad";
import { loadGraphicsSettings, saveGraphicsSettings, cycleGraphicsLevel, getGraphicsLabel, GraphicsLevel } from "@/lib/graphicsConfig";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { isIOSDevice } from "@/lib/deviceDetection";
import { Difficulty } from "./types";

export type GameModeId = "fixed" | "classic" | "timetrial" | "medley";

export interface GameSettings {
  introVariant: "auto" | "freeze" | "warp";
  skipCountdowns: "never" | "first" | "always";
  photosensitive: boolean;
  showGhost: boolean;
  nebulaFxEnabled: boolean;
  largeRotateButtons: boolean;
  showFullHUD: boolean;
  graphicsLevel: GraphicsLevel;
  difficulty: Difficulty;
}

interface PlayerMenuProps {
  onStartGame: (mode: GameModeId, settings: GameSettings) => void;
  onSurvival: () => void;
  onLeaderboards: () => void;
  onSettings: () => void;
  onDevPortal: () => void;
  onInteraction?: () => void;
}

const menuItems = [
  { id: "start", label: "START GAME" },
  { id: "survival", label: "SURVIVAL" },
  { id: "modes", label: "GAME MODES" },
  { id: "leaderboards", label: "LEADERBOARDS" },
  { id: "settings", label: "SETTINGS" },
] as const;

const gameModeOptions: { id: GameModeId; label: string; description: string }[] = [
  { id: "fixed", label: "CAMPAIGN", description: "Progressive levels with increasing difficulty" },
  { id: "classic", label: "CLASSIC", description: "Random terrain, classic arcade experience" },
  { id: "timetrial", label: "TIME TRIAL", description: "Race against the clock and ghost replays" },
  { id: "medley", label: "MEDLEY", description: "Mix of all game types in rotation" },
];

/** Load all game settings from localStorage (same keys as Developer Menu) */
function loadSettingsFromStorage(): GameSettings {
  const getBool = (key: string, def: boolean) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
  };
  const getStr = <T extends string>(key: string, def: T): T => {
    try { return (localStorage.getItem(key) as T) || def; } catch { return def; }
  };
  
  return {
    introVariant: getStr("ll-intro-variant", "auto") as "auto" | "freeze" | "warp",
    skipCountdowns: getStr("ll-skip-countdowns", "never") as "never" | "first" | "always",
    photosensitive: getBool("ll-photosensitive", false),
    showGhost: getBool("ll-global-ghosts-enabled", false),
    nebulaFxEnabled: getBool("ll-nebula-fx-enabled", true),
    largeRotateButtons: getBool("ll-large-rotate-buttons", true),
    showFullHUD: getBool("ll-show-full-hud", true),
    graphicsLevel: loadGraphicsSettings(),
    difficulty: getStr("ll-difficulty", "easy") as Difficulty,
  };
}

export const PlayerMenu: React.FC<PlayerMenuProps> = ({
  onStartGame,
  onSurvival,
  onLeaderboards,
  onSettings,
  onDevPortal,
  onInteraction,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [modeFocusedIndex, setModeFocusedIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [graphicsLevel, setGraphicsLevel] = useState<GraphicsLevel>(loadGraphicsSettings);
  const { isFullscreen, isSupported, toggleFullscreen } = useFullscreen();
  
  // Persist selected game mode
  const [selectedMode, setSelectedMode] = useState<GameModeId>(() => {
    try {
      const saved = localStorage.getItem("ll-selected-game-mode");
      if (saved && ["fixed", "classic", "timetrial", "medley"].includes(saved)) {
        return saved as GameModeId;
      }
    } catch {}
    return "fixed";
  });

  useEffect(() => {
    try {
      localStorage.setItem("ll-selected-game-mode", selectedMode);
    } catch {}
  }, [selectedMode]);

  // Focus management for main menu
  useEffect(() => {
    if (!showModeMenu) {
      buttonRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, showModeMenu]);

  // Focus management for mode sub-menu
  useEffect(() => {
    if (showModeMenu) {
      modeButtonRefs.current[modeFocusedIndex]?.focus();
    }
  }, [modeFocusedIndex, showModeMenu]);

  // Auto-focus first button on mount
  useEffect(() => {
    buttonRefs.current[0]?.focus();
  }, []);

  // Set UI mode for gamepad thrust gating
  useEffect(() => {
    try {
      setUiMode(true);
    } catch {}
    return () => {
      try {
        setUiMode(false);
      } catch {}
    };
  }, []);

  // Gamepad navigation
  useEffect(() => {
    let raf = 0;
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem("ll-gp-last-device");
    } catch {}
    let profile = loadProfile(lastId || undefined);
    let prev = { up: false, down: false, select: false, back: false };
    let lastFire = { up: 0, down: 0, select: 0, back: 0 };
    const canFire = (dir: keyof typeof lastFire) => performance.now() - lastFire[dir] > 140;
    const mark = (dir: keyof typeof lastFire) => { lastFire[dir] = performance.now(); };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      if (lastId !== gp.id) {
        lastId = gp.id;
        profile = loadProfile(gp.id);
      }
      const input = readGamepad(gp, profile);
      
      if (showModeMenu) {
        // Navigate mode sub-menu
        if (input.ui.up && !prev.up && canFire("up")) {
          setModeFocusedIndex(i => Math.max(0, i - 1));
          mark("up");
        }
        if (input.ui.down && !prev.down && canFire("down")) {
          setModeFocusedIndex(i => Math.min(gameModeOptions.length - 1, i + 1));
          mark("down");
        }
        if (input.ui.select && !prev.select && canFire("select")) {
          modeButtonRefs.current[modeFocusedIndex]?.click();
          gateThrustUntilRelease();
          mark("select");
        }
        if (input.ui.back && !prev.back && canFire("back")) {
          setShowModeMenu(false);
          mark("back");
        }
      } else {
        // Navigate main menu
        if (input.ui.up && !prev.up && canFire("up")) {
          setFocusedIndex(i => Math.max(0, i - 1));
          mark("up");
        }
        if (input.ui.down && !prev.down && canFire("down")) {
          setFocusedIndex(i => Math.min(menuItems.length - 1, i + 1));
          mark("down");
        }
        if (input.ui.select && !prev.select && canFire("select")) {
          buttonRefs.current[focusedIndex]?.click();
          gateThrustUntilRelease();
          mark("select");
        }
        if (input.ui.back && !prev.back && canFire("back")) {
          onDevPortal();
          mark("back");
        }
      }
      prev = { up: input.ui.up, down: input.ui.down, select: input.ui.select, back: input.ui.back };
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [focusedIndex, modeFocusedIndex, showModeMenu, onDevPortal]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showModeMenu) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setModeFocusedIndex(i => Math.max(0, i - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setModeFocusedIndex(i => Math.min(gameModeOptions.length - 1, i + 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowModeMenu(false);
      }
    } else {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(i => Math.max(0, i - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(i => Math.min(menuItems.length - 1, i + 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDevPortal();
      }
    }
  };

  const handleAction = (id: string) => {
    // Notify parent of user interaction (for demo timer reset)
    onInteraction?.();
    
    switch (id) {
      case "start": {
        // Read all settings from localStorage (same as Developer Menu)
        const settings = loadSettingsFromStorage();
        // For time trial mode, always enable ghost
        if (selectedMode === "timetrial" || selectedMode === "fixed") {
          settings.showGhost = true;
        }
        onStartGame(selectedMode, settings);
        break;
      }
      case "survival": onSurvival(); break;
      case "modes": 
        setShowModeMenu(true); 
        setModeFocusedIndex(gameModeOptions.findIndex(m => m.id === selectedMode));
        break;
      case "leaderboards": onLeaderboards(); break;
      case "settings": onSettings(); break;
    }
  };

  const handleSelectMode = (modeId: GameModeId) => {
    setSelectedMode(modeId);
    setShowModeMenu(false);
  };

  // Get label for currently selected mode to display on main menu
  const selectedModeLabel = gameModeOptions.find(m => m.id === selectedMode)?.label || "CAMPAIGN";

  // Detect iOS once on mount
  const [isiOS] = useState(() => isIOSDevice());

  return (
    <main
      className="fixed inset-0 overflow-hidden flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Starfield background - iOS gets MobileStarfield, others get HyperspaceStarfield */}
      <div className="absolute inset-0 overflow-hidden">
        {isiOS ? (
          <MobileStarfield starCount={180} speed={0.5} />
        ) : (
          <HyperspaceStarfield 
            speed={0.28}
            density={1600}
            focalLength={480}
            trail={0.55}
            style="glow"
            allowBoost={true}
          />
        )}
      </div>
      
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, hsl(var(--background)) 70%)"
        }}
      />

      {/* Main content - responsive sizing for mobile */}
      <section className="relative z-10 flex flex-col items-center gap-4 sm:gap-6 md:gap-8 px-4 py-4 max-h-[100dvh] overflow-y-auto">
        {/* LANDER Logo - responsive image scaling */}
        <img 
          src="/images/lander-logo.png" 
          alt="LANDER"
          className="player-menu-logo-img w-48 sm:w-64 md:w-80 lg:w-96 h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Menu buttons - tighter spacing on mobile */}
        <nav className="flex flex-col gap-2 sm:gap-3 md:gap-4 w-full max-w-xs">
          {menuItems.map((item, index) => (
            <button
              key={item.id}
              ref={el => { buttonRefs.current[index] = el; }}
              className="player-menu-btn"
              onClick={() => handleAction(item.id)}
              onFocus={() => setFocusedIndex(index)}
            >
              {item.id === "start" ? (
                <span className="flex flex-col items-center">
                  <span>START GAME</span>
                  <span className="text-xs opacity-60 tracking-wider">{selectedModeLabel}</span>
                </span>
              ) : (
                item.label
              )}
            </button>
          ))}
        </nav>
      </section>

      {/* Game Modes Sub-Menu Overlay */}
      {showModeMenu && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="flex flex-col gap-3 p-6 border-2 rounded-lg bg-background/95 max-w-sm w-full mx-4"
            style={{ borderColor: "hsl(var(--neon) / 0.5)" }}
          >
            <h2 
              className="text-center text-lg font-display tracking-wider mb-2"
              style={{ color: "hsl(var(--neon))" }}
            >
              SELECT GAME MODE
            </h2>
            {gameModeOptions.map((mode, index) => (
              <button
                key={mode.id}
                ref={el => { modeButtonRefs.current[index] = el; }}
                className={`player-menu-btn text-sm ${selectedMode === mode.id ? 'ring-2 ring-offset-2 ring-offset-background ring-[hsl(var(--neon))]' : ''}`}
                onClick={() => handleSelectMode(mode.id)}
                onFocus={() => setModeFocusedIndex(index)}
              >
                <span className="flex items-center justify-center gap-2">
                  {selectedMode === mode.id && <span style={{ color: "hsl(var(--neon))" }}>●</span>}
                  {mode.label}
                </span>
              </button>
            ))}
            <p 
              className="text-xs text-center mt-2 opacity-70"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {gameModeOptions.find(m => m.id === selectedMode)?.description}
            </p>
            <button
              className="text-xs uppercase tracking-widest opacity-50 hover:opacity-80 transition-opacity mt-3 py-2"
              onClick={() => setShowModeMenu(false)}
              style={{ color: "hsl(var(--neon))" }}
            >
              ← BACK
            </button>
          </div>
        </div>
      )}

      {/* Footer - Fullscreen, GFX toggle and Dev Portal link */}
      <footer className="absolute bottom-4 right-4 flex items-center gap-4 z-10">
        {/* Fullscreen Toggle */}
        {isSupported && (
          <button
            className="text-xs uppercase tracking-widest opacity-50 hover:opacity-80 transition-opacity px-2 py-1 border border-current/30 rounded"
            onClick={toggleFullscreen}
            style={{ color: "hsl(var(--neon))" }}
          >
            {isFullscreen ? "EXIT FS" : "FULLSCREEN"}
          </button>
        )}
        
        {/* GFX Toggle */}
        <button
          className="text-xs uppercase tracking-widest opacity-50 hover:opacity-80 transition-opacity px-2 py-1 border border-current/30 rounded"
          onClick={() => {
            const newLevel = cycleGraphicsLevel(graphicsLevel);
            setGraphicsLevel(newLevel);
            saveGraphicsSettings(newLevel);
          }}
          style={{ color: "hsl(var(--neon))" }}
        >
          {getGraphicsLabel(graphicsLevel)}
        </button>
        
        <button
          className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
          onClick={onDevPortal}
          style={{ color: "hsl(var(--neon))" }}
        >
          Dev Portal
        </button>
        <span 
          className="text-sm opacity-30"
          style={{ color: "hsl(var(--neon))" }}
        >
          ✦
        </span>
      </footer>
    </main>
  );
};

export default PlayerMenu;
