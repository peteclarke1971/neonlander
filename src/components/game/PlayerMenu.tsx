import React, { useEffect, useRef, useState, useCallback } from "react";
import TerminalText from "./TerminalText";
import { HyperspaceStarfield } from "./HyperspaceStarfield";
import { MobileStarfield } from "./MobileStarfield";
import { NeonVortexStarfield } from "./NeonVortexStarfield";
import { PrismaticWavesStarfield } from "./PrismaticWavesStarfield";
 import { CosmicTunnelStarfield } from "./CosmicTunnelStarfield";
 import { NebulaDriftStarfield } from "./NebulaDriftStarfield";
import { IntoTheVoidStarfield } from "./IntoTheVoidStarfield";
import { PlayerMenuLeaderboard } from "./PlayerMenuLeaderboard";
import { GuidePopup } from "./GuidePopup";
import { anyGamepad, loadProfile, readGamepad, gateThrustUntilRelease, setUiMode, vibrate } from "@/hooks/use-gamepad";
import { loadGraphicsSettings, saveGraphicsSettings, cycleGraphicsLevel, getGraphicsLabel, GraphicsLevel } from "@/lib/graphicsConfig";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { isIOSDevice } from "@/lib/deviceDetection";
import { isGuideEnabled, setGuideEnabled } from "@/lib/inFlightGuide";
import { Difficulty, Mode } from "./types";
import { getGlobalAudioManager } from "./AudioManager";
export type GameModeId = "fixed" | "survival" | "classic" | "timetrial" | "medley";

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
  onStartGame: (mode: GameModeId, settings: GameSettings, startLevel: number) => void;
  onLeaderboards?: () => void; // Optional - kept for backwards compatibility
  onSettings: () => void;
  onDevPortal: () => void;
  onInteraction?: () => void;
  onGuideOpenChange?: (isOpen: boolean) => void;
}

const menuItems = [
  { id: "start", label: "START GAME" },
  { id: "modes", label: "CHOOSE GAME MODE" },
  { id: "startLevel", label: "STARTING LEVEL" },
  { id: "guide", label: "GUIDE" },
  { id: "settings", label: "SETTINGS" },
] as const;

const startingLevelOptions = [1, 5, 10, 15, 20, 30, 50] as const;

/** Leaderboard cycle configuration for idle display */
const leaderboardCycle: { mode: Mode; label: string }[] = [
  { mode: "fixed", label: "CAMPAIGN" },
  { mode: "classic", label: "CLASSIC" },
  { mode: "survival", label: "SURVIVAL" },
  { mode: "medley", label: "MEDLEY" },
];

const gameModeOptions: { id: GameModeId; label: string; description: string }[] = [
  { id: "fixed", label: "CAMPAIGN", description: "Progressive levels with increasing difficulty" },
  { id: "survival", label: "SURVIVAL", description: "Endless terrain, how far can you go?" },
  { id: "classic", label: "CLASSIC", description: "Random terrain, classic arcade experience" },
  { id: "timetrial", label: "TIME TRIAL", description: "Race against the clock and ghost replays" },
  { id: "medley", label: "MEDLEY", description: "Mix of all game types in rotation" },
];

/** Mini lander icon - matches the game's ship design */
const LanderIcon = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 16 16" 
    fill="none"
    style={{ 
      filter: `drop-shadow(0 0 4px ${color})`,
      flexShrink: 0
    }}
  >
    {/* Main triangle body */}
    <path 
      d="M8 2 L3 11 L8 9 L13 11 Z" 
      fill={color}
      stroke={color}
      strokeWidth="0.5"
    />
    {/* Landing legs */}
    <line x1="4" y1="11" x2="2" y2="14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="12" y1="11" x2="14" y2="14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** Load all game settings from localStorage (same keys as Developer Menu) */
/** Set default settings for first-time players */
function initializeDefaultSettings() {
  const setIfMissing = (key: string, value: string) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, value);
    }
  };
  
  // First-time defaults as specified
  setIfMissing("ll-large-rotate-buttons", "true");       // LARGE BUTTONS ON
  setIfMissing("ll-show-full-hud", "false");             // FULL HUD OFF
  setIfMissing("ll-liquid-fuel-enabled", "true");        // LIQUID FUEL DISPLAY ON
  setIfMissing("ll-show-fps", "false");                  // SHOW FPS OFF
  setIfMissing("ll-terrain-masked-fireworks", "true");   // TERRAIN MASKED FIREWORKS ON
  setIfMissing("ll-graphics-level", "mid");              // GRAPHICS QUALITY MEDIUM
  
  // Countdown display defaults
  setIfMissing("ll-go-fill-enabled", "false");           // GO Fill OFF (black fill)
  setIfMissing("ll-go-color-cycle", "false");            // GO Color Cycle OFF
  setIfMissing("ll-go-color-cycle-speed", "5");          // Color Cycle Speed: 5
  setIfMissing("ll-go-font", '"Orbitron", sans-serif');  // Font: Orbitron (matches game UI)
  setIfMissing("ll-go-size-multiplier", "1");            // Size: 1x (default)
}

function loadSettingsFromStorage(): GameSettings {
  // Initialize defaults for first-time players
  initializeDefaultSettings();
  
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
    showGhost: getBool("ll-ghost-mode-enabled", false) || getBool("ll-global-ghosts-enabled", false),
    nebulaFxEnabled: getBool("ll-nebula-fx-enabled", false), // Default OFF for new players
    largeRotateButtons: getBool("ll-large-rotate-buttons", true),
    showFullHUD: getBool("ll-show-full-hud", false),     // Default OFF for new players
    graphicsLevel: loadGraphicsSettings(),
    difficulty: getStr("ll-difficulty", "easy") as Difficulty,
  };
}

export const PlayerMenu: React.FC<PlayerMenuProps> = ({
  onStartGame,
  onLeaderboards,
  onSettings,
  onDevPortal,
  onInteraction,
  onGuideOpenChange,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [footerFocusedIndex, setFooterFocusedIndex] = useState(-1); // -1 = not in footer
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [showGuidePopup, setShowGuidePopup] = useState(false);
  const [modeFocusedIndex, setModeFocusedIndex] = useState(0);
  const [levelFocusedIndex, setLevelFocusedIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const levelButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const levelBackButtonRef = useRef<HTMLButtonElement | null>(null);
  const [graphicsLevel, setGraphicsLevel] = useState<GraphicsLevel>(loadGraphicsSettings);
  const { isFullscreen, isSupported, toggleFullscreen } = useFullscreen();
  
  // Dev Portal visibility (hidden by default, revealed with CTRL+F8)
  const [devPortalEnabled, setDevPortalEnabled] = useState(() => {
    try {
      return localStorage.getItem('ll-dev-portal-enabled') === 'true';
    } catch { return false; }
  });
  
  // In-flight tips toggle
  const [tipsEnabled, setTipsEnabled] = useState(isGuideEnabled);
  
  // Show Level Number toggle (for playtesting)
  const [showLevelNumber, setShowLevelNumber] = useState(() => {
    try {
      return localStorage.getItem('ll-show-level-number') === 'true';
    } catch { return false; }
  });
  
  // Ghost mode settings - persisted to localStorage
  const [ghostModeEnabled, setGhostModeEnabled] = useState(() => {
    return localStorage.getItem('ll-ghost-mode-enabled') === 'true';
  });
  const [challengeGlobalGhosts, setChallengeGlobalGhosts] = useState(() => {
    return localStorage.getItem('ll-global-ghosts-enabled') === 'true';
  });
  
  // Starting level state - persisted to localStorage
  const [startingLevel, setStartingLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("ll-player-menu-start-level");
      const parsed = parseInt(saved || "1", 10);
      return startingLevelOptions.includes(parsed as any) ? parsed : 1;
    } catch {}
    return 1;
  });
  
  // Loading state - wait for assets before showing UI
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  
  // Idle leaderboard carousel state
  const [idleTime, setIdleTime] = useState(0);
  const [showLeaderboards, setShowLeaderboards] = useState(false);
  const [leaderboardIndex, setLeaderboardIndex] = useState(0);
  // Alternates between 0 (local) and 1 (global) each full carousel cycle
  const leaderboardRoundRef = useRef(0);
  
  // Fullscreen reminder for PC users
  const [showFullscreenReminder, setShowFullscreenReminder] = useState(false);
  const lastReminderTimeRef = useRef(0);
  const fullscreenMessageIndexRef = useRef(0);
  
  // Initialize default settings on mount (before user can navigate away)
  useEffect(() => {
    initializeDefaultSettings();
  }, []);
  
  // Persist selected game mode
  const [selectedMode, setSelectedMode] = useState<GameModeId>(() => {
    try {
      const saved = localStorage.getItem("ll-selected-game-mode");
      if (saved && ["fixed", "survival", "classic", "timetrial", "medley"].includes(saved)) {
        return saved as GameModeId;
      }
    } catch {}
    return "medley";
  });
  
  // Reset idle state on any interaction
  const resetIdle = useCallback(() => {
    setIdleTime(0);
    if (showLeaderboards) {
      setShowLeaderboards(false);
    }
  }, [showLeaderboards]);
  
  // Preload assets before showing UI
  useEffect(() => {
    const img = new Image();
    img.src = "/images/lander-logo.png";
    img.onload = () => setAssetsLoaded(true);
    img.onerror = () => setAssetsLoaded(true); // Show UI even if image fails
    
    // Fallback timeout (3s max wait)
    const timeout = setTimeout(() => setAssetsLoaded(true), 3000);
    return () => clearTimeout(timeout);
  }, []);
  
  // Start title music - same as HomeScreen
  const audioRef = useRef(getGlobalAudioManager());
  const musicStartedRef = useRef(false);
  const [musicOn] = useState(() => {
    try {
      const saved = localStorage.getItem("ll-music-on");
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  
  // Proactively preload audio config and SFX for faster music start
  useEffect(() => {
    const timer = setTimeout(() => {
      audioRef.current.initializeConfig().then(() => {
        audioRef.current.preloadSFX().catch(() => {});
      }).catch(() => {});
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Music start effect - keeps retrying until successful
  useEffect(() => {
    const tryStart = async () => {
      if (musicStartedRef.current) return; // Already started
      try {
        if (!musicOn) return;
        await audioRef.current.resume();
        await audioRef.current.playTitleMusic();
        audioRef.current.setTitleMusicMuted(false);
        musicStartedRef.current = true;
        console.log('🎵 Player Menu music started');
      } catch (e) {
        // Will retry on next interaction
      }
    };
    
    // Attempt immediately (will be ignored by browsers that require gesture)
    tryStart();
    
    const startOnInteract = () => {
      // CRITICAL FOR iOS / CAPACITOR: synchronous unlock inside the gesture
      // tick BEFORE any await/promise. See AudioManager.unlockSync() docs.
      audioRef.current.unlockSync();
      tryStart();
      if (!musicStartedRef.current) {
        audioRef.current.preloadSFX();
      }
    };
    
    // Don't use { once: true } - keep trying until music starts
    window.addEventListener("pointerdown", startOnInteract);
    window.addEventListener("touchstart", startOnInteract);
    window.addEventListener("keydown", startOnInteract);
    window.addEventListener("gamepadconnected", startOnInteract);
    
    // Periodic retry: if a gamepad is connected but audio is still suspended, keep trying
    const periodicUnlock = setInterval(() => {
      if (musicStartedRef.current) return;
      const gp = anyGamepad?.();
      if (gp) {
        audioRef.current.resume().then(() => {
          if (!musicStartedRef.current && musicOn) {
            tryStart();
          }
        }).catch(() => {});
      }
    }, 2000);
    
    return () => {
      window.removeEventListener("pointerdown", startOnInteract);
      window.removeEventListener("touchstart", startOnInteract);
      window.removeEventListener("keydown", startOnInteract);
      window.removeEventListener("gamepadconnected", startOnInteract);
      clearInterval(periodicUnlock);
    };
  }, [musicOn]);
  
  // Idle timer - separate from demo timer
  useEffect(() => {
    // Don't run idle timer if mode/level menu is open, assets not loaded, showing leaderboards, or guide is open
    if (showModeMenu || showLevelMenu || !assetsLoaded || showLeaderboards || showGuidePopup) {
      return;
    }
    
    const interval = setInterval(() => {
      setIdleTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [showModeMenu, showLevelMenu, assetsLoaded, showLeaderboards, showGuidePopup]);
  
  // Trigger leaderboard display after 10s idle
  useEffect(() => {
    if (idleTime >= 10 && !showLeaderboards && !showModeMenu && !showLevelMenu && assetsLoaded) {
      setShowLeaderboards(true);
      setLeaderboardIndex(0);
    }
  }, [idleTime, showLeaderboards, showModeMenu, showLevelMenu, assetsLoaded]);
  
  // Cycle through leaderboards every 5 seconds
  useEffect(() => {
    if (!showLeaderboards) return;
    
    const cycleInterval = setInterval(() => {
      setLeaderboardIndex(prev => {
        const next = prev + 1;
        // After cycling through all, hide leaderboards and toggle local/global for next cycle
        if (next >= leaderboardCycle.length) {
          setShowLeaderboards(false);
          setIdleTime(0); // Reset idle timer
          // Toggle round for next cycle
          leaderboardRoundRef.current = leaderboardRoundRef.current === 0 ? 1 : 0;
          return 0;
        }
        return next;
      });
    }, 5000);
    
    return () => clearInterval(cycleInterval);
  }, [showLeaderboards]);

  // Fullscreen reminder for PC users (not on mobile/iOS)
  useEffect(() => {
    // Don't show on iOS/mobile devices, or when modals are open, or already fullscreen
    if (!assetsLoaded || isIOSDevice() || isFullscreen || showModeMenu || showLevelMenu || showGuidePopup) {
      setShowFullscreenReminder(false);
      return;
    }
    
    // Show reminder after 5 seconds idle initially, then every 10 seconds
    const checkReminder = setInterval(() => {
      if (!isFullscreen && isSupported) {
        const timeSinceLast = Date.now() - lastReminderTimeRef.current;
        // First show after 5 seconds, subsequent shows every 10 seconds
        const requiredTime = lastReminderTimeRef.current === 0 ? 5000 : 10000;
        
        if (timeSinceLast >= requiredTime) {
          setShowFullscreenReminder(true);
          fullscreenMessageIndexRef.current += 1; // Alternate message next time
          lastReminderTimeRef.current = Date.now();
          
          // Hide after 3 seconds
          setTimeout(() => {
            setShowFullscreenReminder(false);
          }, 3000);
        }
      }
    }, 1000);
    
    return () => clearInterval(checkReminder);
  }, [assetsLoaded, isFullscreen, showModeMenu, showLevelMenu, showGuidePopup, isSupported]);

  useEffect(() => {
    try {
      localStorage.setItem("ll-selected-game-mode", selectedMode);
    } catch {}
  }, [selectedMode]);

  // Focus management for main menu
  useEffect(() => {
    if (!showModeMenu && !showLevelMenu) {
      buttonRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, showModeMenu, showLevelMenu]);

  // Focus management for level sub-menu (includes BACK button)
  useEffect(() => {
    if (showLevelMenu) {
      if (levelFocusedIndex < startingLevelOptions.length) {
        levelButtonRefs.current[levelFocusedIndex]?.focus();
      } else {
        levelBackButtonRef.current?.focus();
      }
    }
  }, [levelFocusedIndex, showLevelMenu]);

  // Focus management for mode sub-menu (includes BACK button)
  useEffect(() => {
    if (showModeMenu) {
      if (modeFocusedIndex < gameModeOptions.length) {
        modeButtonRefs.current[modeFocusedIndex]?.focus();
      } else {
        // Focus the BACK button when index equals gameModeOptions.length
        backButtonRef.current?.focus();
      }
    }
  }, [modeFocusedIndex, showModeMenu]);

  // Auto-focus first button on mount
  useEffect(() => {
    buttonRefs.current[0]?.focus();
  }, []);

  // CTRL+F8 to reveal Dev Portal
  useEffect(() => {
    const handleKeyCombo = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'F8') {
        e.preventDefault();
        setDevPortalEnabled(true);
        try { localStorage.setItem('ll-dev-portal-enabled', 'true'); } catch {}
      }
    };
    window.addEventListener('keydown', handleKeyCombo);
    return () => window.removeEventListener('keydown', handleKeyCombo);
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

  // Gamepad navigation - use refs for persistent state across effect restarts
  const gpPrevRef = useRef({ up: false, down: false, left: false, right: false, select: false, back: false });
  const gpLastFireRef = useRef({ up: 0, down: 0, left: 0, right: 0, select: 0, back: 0 });
  const gpInputReadyRef = useRef(false);

  // 300ms input cooldown on mount to prevent pass-through from previous screen
  useEffect(() => {
    gpInputReadyRef.current = false;
    const t = setTimeout(() => { gpInputReadyRef.current = true; }, 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem("ll-gp-last-device");
    } catch {}
    let profile = loadProfile(lastId || undefined);
    const canFire = (dir: keyof typeof gpLastFireRef.current) => performance.now() - gpLastFireRef.current[dir] > 140;
    const mark = (dir: keyof typeof gpLastFireRef.current) => { gpLastFireRef.current[dir] = performance.now(); };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      if (lastId !== gp.id) {
        lastId = gp.id;
        profile = loadProfile(gp.id);
      }
      const input = readGamepad(gp, profile);
      const prev = gpPrevRef.current;

      // During cooldown, track state but skip all actions
      if (!gpInputReadyRef.current) {
        gpPrevRef.current = { ...input.ui };
        return;
      }
      
      // Any gamepad input resets idle
      if (input.ui.up || input.ui.down || input.ui.select || input.ui.back) {
        resetIdle();
      }
      
      // Unlock audio on any gamepad button press (iOS requires user gesture)
      if (input.ui.up || input.ui.down || input.ui.left || input.ui.right || input.ui.select || input.ui.back) {
        audioRef.current.resume();
        if (!musicStartedRef.current && musicOn) {
          audioRef.current.playTitleMusic().then(() => {
            audioRef.current.setTitleMusicMuted(false);
            musicStartedRef.current = true;
          }).catch(() => {});
        }
      }
      
      if (showModeMenu) {
        // Navigate mode sub-menu
        if (input.ui.up && !prev.up && canFire("up")) {
          setModeFocusedIndex(i => Math.max(0, i - 1));
          vibrate(30, 0.15, 0.3); // Light haptic feedback
          mark("up");
        }
        if (input.ui.down && !prev.down && canFire("down")) {
          // Include BACK button in navigation (gameModeOptions.length = index for BACK)
          setModeFocusedIndex(i => Math.min(gameModeOptions.length, i + 1));
          vibrate(30, 0.15, 0.3); // Light haptic feedback
          mark("down");
        }
        if (input.ui.select && !prev.select && canFire("select")) {
          setModeFocusedIndex(idx => {
            if (idx < gameModeOptions.length) {
              modeButtonRefs.current[idx]?.click();
            } else {
              backButtonRef.current?.click();
            }
            return idx;
          });
          vibrate(50, 0.3, 0.5); // Stronger haptic on selection
          gateThrustUntilRelease();
          mark("select");
        }
        if (input.ui.back && !prev.back && canFire("back")) {
          setShowModeMenu(false);
          vibrate(40, 0.2, 0.4); // Medium haptic on back
          mark("back");
        }
      } else if (showLevelMenu) {
        // Navigate level sub-menu
        if (input.ui.up && !prev.up && canFire("up")) {
          setLevelFocusedIndex(i => Math.max(0, i - 1));
          vibrate(30, 0.15, 0.3);
          mark("up");
        }
        if (input.ui.down && !prev.down && canFire("down")) {
          setLevelFocusedIndex(i => Math.min(startingLevelOptions.length, i + 1));
          vibrate(30, 0.15, 0.3);
          mark("down");
        }
        // Left/Right also cycle levels (matching keyboard behavior)
        if (input.ui.left && !prev.left && canFire("left")) {
          setLevelFocusedIndex(i => (i < startingLevelOptions.length && i > 0) ? i - 1 : i);
          vibrate(30, 0.15, 0.3);
          mark("left");
        }
        if (input.ui.right && !prev.right && canFire("right")) {
          setLevelFocusedIndex(i => (i < startingLevelOptions.length - 1) ? i + 1 : i);
          vibrate(30, 0.15, 0.3);
          mark("right");
        }
        if (input.ui.select && !prev.select && canFire("select")) {
          setLevelFocusedIndex(idx => {
            if (idx < startingLevelOptions.length) {
              levelButtonRefs.current[idx]?.click();
            } else {
              levelBackButtonRef.current?.click();
            }
            return idx;
          });
          vibrate(50, 0.3, 0.5);
          gateThrustUntilRelease();
          mark("select");
        }
        if (input.ui.back && !prev.back && canFire("back")) {
          setShowLevelMenu(false);
          vibrate(40, 0.2, 0.4);
          mark("back");
        }
      } else if (!showLeaderboards) {
        // Navigate main menu + footer (only when not showing leaderboards)
        if (input.ui.up && !prev.up && canFire("up")) {
          setFooterFocusedIndex(fi => {
            if (fi >= 0) {
              // In footer → go back to SETTINGS
              setFocusedIndex(4);
              return -1;
            }
            // Normal main menu up
            setFocusedIndex(i => Math.max(0, i - 1));
            return -1;
          });
          vibrate(30, 0.15, 0.3);
          mark("up");
        }
        if (input.ui.down && !prev.down && canFire("down")) {
          setFooterFocusedIndex(fi => {
            if (fi >= 0) return fi; // Already in footer, ignore down
            // Check if on SETTINGS (index 4)
            let entered = false;
            setFocusedIndex(i => {
              if (i >= menuItems.length - 1) {
                entered = true;
                return i; // Stay on SETTINGS
              }
              return i + 1;
            });
            if (entered) return 0; // Enter footer at Ghost
            return -1;
          });
          vibrate(30, 0.15, 0.3);
          mark("down");
        }
        // Left/Right in footer
        const footerMax = ghostModeEnabled ? 4 : 3;
        if (input.ui.left && !prev.left && canFire("left")) {
          setFooterFocusedIndex(fi => {
            if (fi > 0) { vibrate(30, 0.15, 0.3); return fi - 1; }
            return fi;
          });
          mark("left");
        }
        if (input.ui.right && !prev.right && canFire("right")) {
          setFooterFocusedIndex(fi => {
            if (fi >= 0 && fi < footerMax) { vibrate(30, 0.15, 0.3); return fi + 1; }
            return fi;
          });
          mark("right");
        }
        if (input.ui.select && !prev.select && canFire("select")) {
          setFooterFocusedIndex(fi => {
            if (fi >= 0) {
              // Toggle the focused footer item (dynamic indices based on ghost visibility)
              const tipsIdx = ghostModeEnabled ? 2 : 1;
              const lvlIdx = ghostModeEnabled ? 3 : 2;
              const gfxIdx = ghostModeEnabled ? 4 : 3;
              if (fi === 0) {
                const newVal = !ghostModeEnabled;
                setGhostModeEnabled(newVal);
                localStorage.setItem('ll-ghost-mode-enabled', String(newVal));
              } else if (ghostModeEnabled && fi === 1) {
                const newVal = !challengeGlobalGhosts;
                setChallengeGlobalGhosts(newVal);
                localStorage.setItem('ll-global-ghosts-enabled', String(newVal));
              } else if (fi === tipsIdx) {
                const newVal = !tipsEnabled;
                setTipsEnabled(newVal);
                setGuideEnabled(newVal);
              } else if (fi === lvlIdx) {
                const newVal = !showLevelNumber;
                setShowLevelNumber(newVal);
                localStorage.setItem('ll-show-level-number', String(newVal));
              } else if (fi === gfxIdx) {
                const newLevel = cycleGraphicsLevel(graphicsLevel);
                setGraphicsLevel(newLevel);
                saveGraphicsSettings(newLevel);
              }
              vibrate(50, 0.3, 0.5);
              gateThrustUntilRelease();
              mark("select");
              return fi;
            }
            // Normal main menu select
            setFocusedIndex(idx => {
              buttonRefs.current[idx]?.click();
              return idx;
            });
            vibrate(50, 0.3, 0.5);
            gateThrustUntilRelease();
            mark("select");
            return fi;
          });
        }
        if (input.ui.back && !prev.back && canFire("back")) {
          setFooterFocusedIndex(fi => {
            if (fi >= 0) {
              // Exit footer back to SETTINGS
              setFocusedIndex(4);
              vibrate(40, 0.2, 0.4);
              mark("back");
              return -1;
            }
            // Do NOT navigate to dev portal from main player menu
            return fi;
          });
        }
      }
      gpPrevRef.current = { up: input.ui.up, down: input.ui.down, left: input.ui.left, right: input.ui.right, select: input.ui.select, back: input.ui.back };
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showModeMenu, showLevelMenu, showLeaderboards, onDevPortal, resetIdle, ghostModeEnabled, challengeGlobalGhosts, tipsEnabled, showLevelNumber, graphicsLevel, footerFocusedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Any keyboard input resets idle
    resetIdle();
    
    if (showModeMenu) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setModeFocusedIndex(i => Math.max(0, i - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        // Include BACK button in keyboard navigation
        setModeFocusedIndex(i => Math.min(gameModeOptions.length, i + 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowModeMenu(false);
      }
    } else if (showLevelMenu) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setLevelFocusedIndex(i => Math.max(0, i - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setLevelFocusedIndex(i => Math.min(startingLevelOptions.length, i + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        // Navigate left in grid
        if (levelFocusedIndex > 0 && levelFocusedIndex < startingLevelOptions.length) {
          setLevelFocusedIndex(i => Math.max(0, i - 1));
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        // Navigate right in grid
        if (levelFocusedIndex < startingLevelOptions.length - 1) {
          setLevelFocusedIndex(i => i + 1);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowLevelMenu(false);
      }
    } else if (!showLeaderboards) {
      // Handle main menu + footer keyboard navigation
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (footerFocusedIndex >= 0) {
          // Exit footer back to SETTINGS
          setFooterFocusedIndex(-1);
          setFocusedIndex(4);
        } else {
          setFocusedIndex(i => Math.max(0, i - 1));
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (footerFocusedIndex >= 0) {
          // Already in footer, ignore down
        } else if (focusedIndex >= menuItems.length - 1) {
          // On SETTINGS → enter footer
          setFooterFocusedIndex(0);
        } else {
          setFocusedIndex(i => i + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (footerFocusedIndex > 0) {
          e.preventDefault();
          setFooterFocusedIndex(i => i - 1);
        }
      } else if (e.key === "ArrowRight") {
        const footerMaxKb = ghostModeEnabled ? 4 : 3;
        if (footerFocusedIndex >= 0 && footerFocusedIndex < footerMaxKb) {
          e.preventDefault();
          setFooterFocusedIndex(i => i + 1);
        }
      } else if (e.key === "Enter") {
        if (footerFocusedIndex >= 0) {
          e.preventDefault();
          const tipsIdx = ghostModeEnabled ? 2 : 1;
          const lvlIdx = ghostModeEnabled ? 3 : 2;
          const gfxIdx = ghostModeEnabled ? 4 : 3;
          if (footerFocusedIndex === 0) {
            const newVal = !ghostModeEnabled;
            setGhostModeEnabled(newVal);
            localStorage.setItem('ll-ghost-mode-enabled', String(newVal));
          } else if (ghostModeEnabled && footerFocusedIndex === 1) {
            const newVal = !challengeGlobalGhosts;
            setChallengeGlobalGhosts(newVal);
            localStorage.setItem('ll-global-ghosts-enabled', String(newVal));
          } else if (footerFocusedIndex === tipsIdx) {
            const newVal = !tipsEnabled;
            setTipsEnabled(newVal);
            setGuideEnabled(newVal);
          } else if (footerFocusedIndex === lvlIdx) {
            const newVal = !showLevelNumber;
            setShowLevelNumber(newVal);
            localStorage.setItem('ll-show-level-number', String(newVal));
          } else if (footerFocusedIndex === gfxIdx) {
            const newLevel = cycleGraphicsLevel(graphicsLevel);
            setGraphicsLevel(newLevel);
            saveGraphicsSettings(newLevel);
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (footerFocusedIndex >= 0) {
          setFooterFocusedIndex(-1);
          setFocusedIndex(4);
        } else {
          onDevPortal();
        }
      }
    }
  };

  const handleSelectLevel = (level: number) => {
    setStartingLevel(level);
    try {
      localStorage.setItem("ll-player-menu-start-level", String(level));
    } catch {}
  };

  const handleAction = (id: string) => {
    // Reset idle and notify parent of user interaction (for demo timer reset)
    resetIdle();
    onInteraction?.();
    
    // Ensure music starts on any menu interaction (belt-and-suspenders)
    if (!musicStartedRef.current && musicOn) {
      audioRef.current.resume().then(() => {
        audioRef.current.playTitleMusic().then(() => {
          audioRef.current.setTitleMusicMuted(false);
          musicStartedRef.current = true;
          console.log('🎵 Player Menu music started via menu action');
        }).catch(() => {});
      }).catch(() => {});
    }
    
    switch (id) {
      case "start": {
        // Read all settings from localStorage (same as Developer Menu)
        const settings = loadSettingsFromStorage();
        // For time trial mode, always enable ghost
        // For fixed and medley modes, respect user's ghost preference
        if (selectedMode === "timetrial" || selectedMode === "fixed") {
          settings.showGhost = true;
        } else if (selectedMode === "medley") {
          settings.showGhost = ghostModeEnabled || challengeGlobalGhosts;
        }
        // Handle survival mode - navigate to /survival page with autostart
        if (selectedMode === "survival") {
          window.location.href = "/survival?autostart=true";
          return;
        }
        onStartGame(selectedMode, settings, startingLevel);
        break;
      }
      case "modes": 
        setShowModeMenu(true); 
        setModeFocusedIndex(gameModeOptions.findIndex(m => m.id === selectedMode));
        break;
      case "startLevel":
        setShowLevelMenu(true);
        setLevelFocusedIndex(startingLevelOptions.indexOf(startingLevel as typeof startingLevelOptions[number]) || 0);
        break;
      case "guide": 
        setShowGuidePopup(true);
        break;
      case "settings": onSettings(); break;
    }
  };

  const handleSelectMode = (modeId: GameModeId) => {
    setSelectedMode(modeId);
    // Don't close menu - only highlight the selection
    // Menu closes only via Back button
  };

  // Get label for currently selected mode to display on main menu
  const selectedModeLabel = gameModeOptions.find(m => m.id === selectedMode)?.label || "CAMPAIGN";

  // Detect iOS once on mount
  const [isiOS] = useState(() => isIOSDevice());

  // Read starfield preference
  const [starfieldStyle] = useState(() => {
    try {
   const saved = localStorage.getItem('ll-starfield-style');
       if (saved === 'hyperspace' || saved === 'mobile' || saved === 'vortex' || saved === 'waves' || saved === 'tunnel' || saved === 'nebula' || saved === 'void') return saved;
    } catch {}
    return 'nebula';
  });

  // Render starfield based on preference
  const renderStarfield = () => {
    switch (starfieldStyle) {
      case 'hyperspace':
        return (
          <HyperspaceStarfield 
            speed={0.28}
            density={1600}
            focalLength={480}
            trail={0.55}
            style="glow"
            allowBoost={true}
            fullscreen={true}
          />
        );
      case 'mobile':
        return <MobileStarfield starCount={180} speed={0.5} />;
      case 'vortex':
        return <NeonVortexStarfield starCount={280} />;
      case 'waves':
        return <PrismaticWavesStarfield starCount={320} />;
       case 'tunnel':
         return <CosmicTunnelStarfield starCount={280} />;
       case 'nebula':
         return <NebulaDriftStarfield starCount={250} />;
      case 'void':
        return <IntoTheVoidStarfield ringCount={40} />;
      case 'auto':
      default:
        return <NebulaDriftStarfield starCount={250} />;
    }
  };

  return (
    <main
      className={`fixed inset-0 overflow-hidden flex items-center justify-center transition-opacity duration-500 ${assetsLoaded ? 'opacity-100' : 'opacity-0'}`}
      onKeyDown={handleKeyDown}
      onClick={resetIdle}
    >
      {/* Starfield background - iOS gets MobileStarfield, others get HyperspaceStarfield */}
      <div className="absolute inset-0 overflow-hidden">
        {renderStarfield()}
      </div>
      
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, hsl(var(--background)) 70%)"
        }}
      />

      {/* Main content - responsive sizing for mobile */}
      <section className="relative z-10 flex flex-col items-center gap-4 sm:gap-6 md:gap-8 px-4 py-4">
        {/* LANDER Logo - responsive image scaling - FIXED position, never moves */}
        <div className="flex-shrink-0">
          <img 
            src="/images/lander-logo.png" 
            alt="LANDER"
            className="player-menu-logo-img w-48 sm:w-64 md:w-80 lg:w-96 h-auto select-none pointer-events-none"
            style={{
              filter: "var(--logo-filter, none)",
              transition: "filter 0.5s ease-out"
            }}
            draggable={false}
          />
        </div>
        
        {/* Fullscreen reminder for PC users - positioned to the right, aligned with menu top */}
        {showFullscreenReminder && isSupported && !isIOSDevice() && (
          <div 
            className="fixed top-8 right-8 z-50"
            style={{
              animation: 'fadeInOut 3s ease-in-out'
            }}
          >
            <div 
              className="bg-card/80 backdrop-blur-sm border rounded-lg px-8 py-4 text-xl font-mono tracking-wide text-center shadow-lg"
              style={{ 
                color: "hsl(var(--neon))",
                borderColor: "hsl(var(--neon) / 0.5)",
                boxShadow: "0 0 30px hsl(var(--neon) / 0.4)"
              }}
            >
              {fullscreenMessageIndexRef.current % 2 === 0 
                ? "PILOTS: This simulation is best played FULL SCREEN"
                : "ENABLE FULL SCREEN USING THE BUTTON OR THE F11 KEY"}
            </div>
          </div>
        )}

        {/* Fixed-height container - NEVER changes size, logo above stays locked */}
        <div className="relative w-full flex flex-col items-center h-[340px]">
          {/* Leaderboard - ALWAYS absolute positioned */}
          <div 
            key={`leaderboard-${leaderboardIndex}`}
            className={`absolute inset-x-0 top-0 flex flex-col items-center gap-4 transition-opacity duration-1000 ${showLeaderboards ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <PlayerMenuLeaderboard 
              mode={leaderboardCycle[leaderboardIndex].mode} 
              label={leaderboardCycle[leaderboardIndex].label}
              source={leaderboardRoundRef.current === 0 ? "local" : "global"}
            />
          </div>
          
          {/* Menu buttons - ALWAYS absolute positioned */}
          <nav className={`absolute inset-x-0 top-0 flex flex-col gap-2 sm:gap-3 md:gap-4 items-center transition-opacity duration-1000 ${showLeaderboards ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {menuItems.map((item, index) => (
              <button
                key={item.id}
                ref={el => { buttonRefs.current[index] = el; }}
                className="player-menu-btn w-full max-w-xs"
                onClick={() => handleAction(item.id)}
                onFocus={() => { setFocusedIndex(index); setFooterFocusedIndex(-1); }}
              >
                {item.id === "start" ? (
                  <span className="flex flex-col items-center">
                    <span>START GAME</span>
                    <span className="text-xs opacity-60 tracking-wider">{selectedModeLabel}</span>
                  </span>
                ) : item.id === "startLevel" ? (
                  <span className="flex flex-col items-center">
                    <span>STARTING LEVEL</span>
                    <span className="text-xs opacity-60 tracking-wider">{startingLevel}</span>
                  </span>
                ) : (
                  item.label
                )}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* Game Modes Sub-Menu Overlay */}
      {showModeMenu && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="flex flex-col gap-3 p-6 border-2 rounded-lg bg-background/80 max-w-sm w-full mx-4"
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
                className={`player-menu-btn text-sm ${selectedMode === mode.id ? 'selected' : ''}`}
                onClick={() => handleSelectMode(mode.id)}
                onFocus={() => setModeFocusedIndex(index)}
              >
              <span className="flex items-center justify-center gap-2">
                  {selectedMode === mode.id && <LanderIcon size={14} color="hsl(180, 100%, 50%)" />}
                  {mode.label}
                </span>
              </button>
            ))}
            <TerminalText
              text={gameModeOptions.find(m => m.id === selectedMode)?.description || ""}
              className="text-xs text-center mt-2"
            />
            <button
              ref={backButtonRef}
              className="player-menu-back-btn"
              onClick={() => setShowModeMenu(false)}
              onFocus={() => setModeFocusedIndex(gameModeOptions.length)}
            >
              ← BACK
            </button>
          </div>
        </div>
      )}

      {/* Starting Level Sub-Menu Overlay */}
      {showLevelMenu && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="flex flex-col gap-3 p-6 border-2 rounded-lg bg-background/80 max-w-sm w-full mx-4"
            style={{ borderColor: "hsl(var(--neon) / 0.5)" }}
          >
            <h2 
              className="text-center text-lg font-display tracking-wider mb-2"
              style={{ color: "hsl(var(--neon))" }}
            >
              SELECT STARTING LEVEL
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {startingLevelOptions.map((level, index) => (
                <button
                  key={level}
                  ref={el => { levelButtonRefs.current[index] = el; }}
                  className={`player-menu-btn text-sm py-3 ${startingLevel === level ? 'selected' : ''}`}
                  onClick={() => handleSelectLevel(level)}
                  onFocus={() => setLevelFocusedIndex(index)}
                >
                  <span className="flex items-center justify-center gap-1">
                    {startingLevel === level && <LanderIcon size={12} color="hsl(180, 100%, 50%)" />}
                    {level}
                  </span>
                </button>
              ))}
            </div>
            <button
              ref={levelBackButtonRef}
              className="player-menu-back-btn mt-2"
              onClick={() => setShowLevelMenu(false)}
              onFocus={() => setLevelFocusedIndex(startingLevelOptions.length)}
            >
              ← BACK
            </button>
          </div>
        </div>
      )}

      {/* Guide Popup */}
      <GuidePopup 
        isOpen={showGuidePopup} 
        onClose={() => setShowGuidePopup(false)}
        onOpenChange={onGuideOpenChange}
      />

      {/* Footer - Ghost toggles, Tips, Fullscreen, GFX toggle and Dev Portal link */}
      <footer className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10">
        {/* Ghost Mode Toggles + Tips - Left side */}
        <div className="flex items-center gap-2">
          {/* Ghost Mode Toggle */}
          <button
            className="text-xs uppercase tracking-widest transition-all px-2 py-1 border rounded"
            onClick={() => {
              resetIdle();
              const newVal = !ghostModeEnabled;
              setGhostModeEnabled(newVal);
              localStorage.setItem('ll-ghost-mode-enabled', String(newVal));
            }}
            style={{ 
              color: ghostModeEnabled ? "hsl(280, 100%, 70%)" : "hsl(var(--neon))",
              borderColor: ghostModeEnabled ? "hsl(280, 100%, 70% / 0.5)" : "hsl(var(--neon) / 0.3)",
              opacity: ghostModeEnabled ? 0.9 : (footerFocusedIndex === 0 ? 0.9 : 0.5),
              textShadow: ghostModeEnabled ? "0 0 8px hsl(280, 100%, 70%)" : "none",
              boxShadow: footerFocusedIndex === 0 ? "0 0 12px hsl(var(--neon) / 0.6), inset 0 0 6px hsl(var(--neon) / 0.2)" : "none",
              outline: footerFocusedIndex === 0 ? "1px solid hsl(var(--neon) / 0.8)" : "none",
              outlineOffset: "2px"
            }}
          >
            GHOST {ghostModeEnabled ? "ON" : "OFF"}
          </button>
          
          {/* Global Ghosts Toggle - only show if ghost mode is enabled */}
          {ghostModeEnabled && (
            <button
              className="text-xs uppercase tracking-widest transition-all px-2 py-1 border rounded"
              onClick={() => {
                resetIdle();
                const newVal = !challengeGlobalGhosts;
                setChallengeGlobalGhosts(newVal);
                localStorage.setItem('ll-global-ghosts-enabled', String(newVal));
              }}
              style={{ 
                color: challengeGlobalGhosts ? "hsl(45, 100%, 60%)" : "hsl(var(--neon))",
                borderColor: challengeGlobalGhosts ? "hsl(45, 100%, 60% / 0.5)" : "hsl(var(--neon) / 0.3)",
                opacity: challengeGlobalGhosts ? 0.9 : (footerFocusedIndex === 1 ? 0.9 : 0.5),
                textShadow: challengeGlobalGhosts ? "0 0 8px hsl(45, 100%, 60%)" : "none",
                boxShadow: footerFocusedIndex === 1 ? "0 0 12px hsl(var(--neon) / 0.6), inset 0 0 6px hsl(var(--neon) / 0.2)" : "none",
                outline: footerFocusedIndex === 1 ? "1px solid hsl(var(--neon) / 0.8)" : "none",
                outlineOffset: "2px"
              }}
            >
              GLOBAL {challengeGlobalGhosts ? "ON" : "OFF"}
            </button>
          )}
          
          {/* In-Flight Tips Toggle */}
          <button
            className="text-xs uppercase tracking-widest transition-all px-2 py-1 border rounded"
            onClick={() => {
              resetIdle();
              const newVal = !tipsEnabled;
              setTipsEnabled(newVal);
              setGuideEnabled(newVal);
            }}
            style={{ 
              color: tipsEnabled ? "hsl(120, 100%, 60%)" : "hsl(var(--neon))",
              borderColor: tipsEnabled ? "hsl(120, 100%, 60% / 0.5)" : "hsl(var(--neon) / 0.3)",
              opacity: tipsEnabled ? 0.9 : (footerFocusedIndex === (ghostModeEnabled ? 2 : 1) ? 0.9 : 0.5),
              textShadow: tipsEnabled ? "0 0 8px hsl(120, 100%, 60%)" : "none",
              boxShadow: footerFocusedIndex === (ghostModeEnabled ? 2 : 1) ? "0 0 12px hsl(var(--neon) / 0.6), inset 0 0 6px hsl(var(--neon) / 0.2)" : "none",
              outline: footerFocusedIndex === (ghostModeEnabled ? 2 : 1) ? "1px solid hsl(var(--neon) / 0.8)" : "none",
              outlineOffset: "2px"
            }}
          >
          TIPS {tipsEnabled ? "ON" : "OFF"}
          </button>
          
          {/* Show Level Number Toggle - hidden from home screen, available in dev settings */}
        </div>
        
        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {/* Fullscreen Toggle */}
          {isSupported && (
            <button
              className="text-xs uppercase tracking-widest opacity-50 hover:opacity-80 transition-opacity px-2 py-1 border border-current/30 rounded"
              onClick={() => { resetIdle(); toggleFullscreen(); }}
              style={{ color: "hsl(var(--neon))" }}
            >
              {isFullscreen ? "EXIT FS" : "FULLSCREEN"}
            </button>
          )}
          
          {/* GFX Toggle */}
          <button
            className="text-xs uppercase tracking-widest transition-all px-2 py-1 border border-current/30 rounded"
            onClick={() => {
              resetIdle();
              const newLevel = cycleGraphicsLevel(graphicsLevel);
              setGraphicsLevel(newLevel);
              saveGraphicsSettings(newLevel);
            }}
            style={{
              color: "hsl(var(--neon))",
              opacity: footerFocusedIndex === (ghostModeEnabled ? 4 : 3) ? 0.9 : 0.5,
              boxShadow: footerFocusedIndex === (ghostModeEnabled ? 4 : 3) ? "0 0 12px hsl(var(--neon) / 0.6), inset 0 0 6px hsl(var(--neon) / 0.2)" : "none",
              outline: footerFocusedIndex === (ghostModeEnabled ? 4 : 3) ? "1px solid hsl(var(--neon) / 0.8)" : "none",
              outlineOffset: "2px"
            }}
          >
            {getGraphicsLabel(graphicsLevel)}
          </button>
          
          {devPortalEnabled && (
            <button
              className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
              onClick={() => { resetIdle(); onDevPortal(); }}
              style={{ color: "hsl(var(--neon))" }}
            >
              Dev Portal
            </button>
          )}
        </div>
      </footer>
    </main>
  );
};

export default PlayerMenu;
