import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GameEngine } from "@/components/game/GameEngine";
import { HomeScreen } from "@/components/game/HomeScreen";
import { Difficulty, GameOverData, HighScore, Mode } from "@/components/game/types";
import { InitialsEntry } from "@/components/game/InitialsEntry";
import { OnlineLeaderboard } from "@/components/game/OnlineLeaderboard";
import { submitScore, fetchTop } from "@/lib/leaderboard";
import { anyGamepad, getLastDeviceId, loadProfile, readGamepad, gateThrustUntilRelease, setUiMode } from "@/hooks/use-gamepad";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";
import { HomeStarfield } from "@/components/game/HomeStarfield";
import type { HyperspaceStarfieldHandle } from "@/components/game/HyperspaceStarfield";
import { AsteroidField } from "@/components/game/AsteroidField";
import type { AsteroidFieldHandle } from "@/components/game/AsteroidField";
import { VectorWormhole } from "@/components/game/VectorWormhole";
import type { VectorWormholeHandle } from "@/components/game/VectorWormhole";
import { GravityDistortionWave } from "@/components/game/GravityDistortionWave";
import type { GravityWaveHandle } from "@/components/game/GravityDistortionWave";
import { getGlobalAudioManager } from "@/components/game/AudioManager";
import { CursorManager } from "@/lib/cursorManager";
import { loadCursorConfig } from "@/lib/cursorConfig";
import { DemoTransition } from "@/components/game/DemoTransition";
import { GameTransition, GameTransitionHandle, TransitionType } from "@/components/game/GameTransition";
import { PlayerMenu, GameSettings as PlayerMenuSettings } from "@/components/game/PlayerMenu";
import { loadGraphicsSettings, saveGraphicsSettings, GraphicsLevel } from "@/lib/graphicsConfig";
const HS_CLASSIC_KEY = "ll-highscores-classic";
const HS_FIXED_KEY = "ll-highscores-fixed";

const Index = () => {
  const [view, setView] = useState<"home" | "playermenu" | "game" | "gameover" | "demo">("home");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionReady, setTransitionReady] = useState(false);
  const transitionRef = useRef<GameTransitionHandle>(null);
  
  // Demo/attract mode state
  const [demoSequenceIndex, setDemoSequenceIndex] = useState(0);
  const [demoTimer, setDemoTimer] = useState(0);
  const [demoLevel, setDemoLevel] = useState(1);
  const [lastInteractionTime, setLastInteractionTime] = useState(Date.now());
  const [demoStartTime, setDemoStartTime] = useState<number | null>(null);
  const [demoOriginView, setDemoOriginView] = useState<"home" | "playermenu">("home"); // Track where demo started
  const demoSequence = [1, 4, 5, 6, 9, 10, 14, 19, 31, 50]; // Demo levels to cycle through
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [mode, setMode] = useState<Mode>("classic");
  const [lastResult, setLastResult] = useState<GameOverData | null>(null);
  const audioRef = useRef(getGlobalAudioManager());
  // Removed demoCrashed state - was causing conflicts with timer logic
  const [classicScores, setClassicScores] = useState<HighScore[]>(() => {
    const now = Date.now();
    const seed: HighScore[] = [
      { initials: "IH", score: 100000, difficulty: "easy", date: now },
      { initials: "LEM", score: 50000, difficulty: "easy", date: now - 86400000 * 2 },
      { initials: "NGN", score: 25000, difficulty: "hard", date: now - 86400000 * 5 },
      { initials: "ROK", score: 10000, difficulty: "easy", date: now - 86400000 * 8 },
      { initials: "LND", score: 5000, difficulty: "hard", date: now - 86400000 * 10 },
    ];
    try {
      const raw = localStorage.getItem(HS_CLASSIC_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length >= 5) return parsed.slice(0, 5);
    } catch {}
    localStorage.setItem(HS_CLASSIC_KEY, JSON.stringify(seed));
    return seed;
  });
  const [fixedScores, setFixedScores] = useState<HighScore[]>(() => {
    const now = Date.now();
    const seed: HighScore[] = [
      { initials: "IH", score: 100000, difficulty: "easy", date: now },
      { initials: "FIX", score: 50000, difficulty: "easy", date: now - 86400000 * 3 },
      { initials: "RIG", score: 25000, difficulty: "hard", date: now - 86400000 * 6 },
      { initials: "SYN", score: 10000, difficulty: "easy", date: now - 86400000 * 9 },
      { initials: "GLB", score: 5000, difficulty: "hard", date: now - 86400000 * 11 },
    ];
    try {
      const raw = localStorage.getItem(HS_FIXED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length >= 5) return parsed.slice(0, 5);
    } catch {}
    localStorage.setItem(HS_FIXED_KEY, JSON.stringify(seed));
    return seed;
  });
  const [carry, setCarry] = useState<{ score: number; landings: number; level: number } | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [needsInitials, setNeedsInitials] = useState(false);
  const [graphicsLevel, setGraphicsLevel] = useState<GraphicsLevel>(loadGraphicsSettings);

  const [goIndex, setGoIndex] = useState(0);
  const [seedOverride, setSeedOverride] = useState<number | null>(null);
  const [lastPlayedSeed, setLastPlayedSeed] = useState<number | null>(null);
  const [lastPlayedLevel, setLastPlayedLevel] = useState<number>(0);
  const [lastPlayedSpawn, setLastPlayedSpawn] = useState<{ x: number; y: number } | null>(null);
  const [gameKey, setGameKey] = useState(0); // Force GameEngine remount
  const [recentlySubmittedScore, setRecentlySubmittedScore] = useState<{
    score: number;
    initials: string;
    mode: Mode;
    difficulty: Difficulty;
    timestamp: number;
  } | null>(null);
  const [showLeaderboardsAfterInitials, setShowLeaderboardsAfterInitials] = useState(false);

  // Get neon color from CSS
  const neonColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--neon')})`;

  // Refs for gameover navigation
  const contRef = useRef<HTMLButtonElement>(null);
  const homeRef = useRef<HTMLButtonElement>(null);
  const retryCurrRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  // Hyperspace starfield control and randomized config per gameover screen
  const starfieldRef = useRef<HyperspaceStarfieldHandle>(null);
  const asteroidsRef = useRef<AsteroidFieldHandle>(null);
   const wormholeRef = useRef<VectorWormholeHandle>(null);
   const gwRef = useRef<GravityWaveHandle>(null);
   const successTitleRef = useRef<HTMLHeadingElement>(null);
   const [wormholeVP, setWormholeVP] = useState<{ cx: number; cy: number } | null>(null);
   const [currentSuccessBg, setCurrentSuccessBg] = useState<number>(0);
   const successBgCursorRef = useRef<number>(0);
   type SFStyle = "vector" | "glow" | "crt";
  const [sfConfig, setSfConfig] = useState<{
    seed: number;
    speed: number;
    density: number;
    focalLength: number;
    trail: number;
    style: SFStyle;
    cx: number;
    cy: number;
  } | null>(null);
  const genSfConfig = () => {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    // Heavily bias toward glow for stronger bloom-like visuals
    const styles: SFStyle[] = ["glow", "glow", "crt", "vector"];
    const style = pick(styles);
    // Speed: up to 20% of original (<= 0.07), often much slower
    const max = 0.07; // 20% of default 0.35
    const speed = Math.max(0.006, (Math.random() ** 2) * max); // bias lower, clamp tiny floor
    // Intensity knobs
    const density = Math.floor(600 + Math.random() * 2600); // 600 - 3200
    const focalLength = 420 + Math.random() * 480; // 420 - 900
    const trail = 0.15 + Math.random() * 0.75; // 0.15 - 0.9
    const cx = 0.4 + Math.random() * 0.2; // 0.4 - 0.6
    const cy = 0.4 + Math.random() * 0.2;
    return { seed, speed, density, focalLength, trail, style, cx, cy };
  };
  useEffect(() => {
    document.title = "Neon Lunar Lander — Vector Arcade";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Pilot a neon-glow lunar lander. Master thrust and rotation to score precision landings on procedural terrain.");
  }, []);

  // Cleanup on component unmount (handles navigation away from page)
  // This ensures demo mode audio and intervals are properly terminated
  useEffect(() => {
    return () => {
      console.log("🧹 Index unmounting - cleaning up demo mode and audio");
      const audio = getGlobalAudioManager();
      audio.stopAllAudio();
    };
  }, []);

  // Page-level cursor manager: hide cursor on app start, no pointer lock
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const pageCursorMgr = useRef<CursorManager | null>(null);
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const cfg = loadCursorConfig();
    const cfgNoLock = { ...cfg, usePointerLock: "off" as const };
    const mgr = new CursorManager(cfgNoLock);
    pageCursorMgr.current = mgr;
    mgr.attach(pageContainerRef.current, () => false, 'global');
    mgr.forceHideCursor();
    return () => { mgr.detach(); pageCursorMgr.current = null; };
  }, []);

  const [showGhost, setShowGhost] = useState(false);
  const [timeTrialRecordPending, setTimeTrialRecordPending] = useState<{
    completionTime: number;
    level: number;
    difficulty: Difficulty;
    ghostFrames: any[];
    isNewLocalRecord: boolean;
    isNewGlobalRecord: boolean;
  } | null>(null);
  const [nebulaFxEnabled, setNebulaFxEnabled] = useState(true);
  const [largeRotateButtons, setLargeRotateButtons] = useState(true);
  const [showFullHUD, setShowFullHUD] = useState(true);
  // Global ghost loading now handled dynamically inside GameEngine
  
  const startGame = async (d: Difficulty, startLevel: number | undefined, mode: Mode, lowGfx?: boolean, seedOverrideParam?: number, gameSettings?: { showGhost?: boolean; nebulaFxEnabled?: boolean; largeRotateButtons?: boolean; showFullHUD?: boolean }) => {
    console.log("🚀 Starting game with:", { difficulty: d, mode, seedOverride: seedOverrideParam, startLevel, isTransitioning });
    
    // Stop title music when starting an actual game
    const audio = getGlobalAudioManager();
    audio.stopTitleMusic();
    
    // Clear recently submitted score and leaderboard display when starting a new game
    setRecentlySubmittedScore(null);
    setShowLeaderboardsAfterInitials(false);
    
    if (isTransitioning) {
      console.log("⚠️ Already transitioning, ignoring start request");
      return; // Prevent multiple transitions
    }
    
    // Check if we should download global ghost
    // Ghost loading now handled dynamically inside GameEngine for each level
    
    // Use wormhole portal transition
    const transitionType = "wormhole-portal";
    
    setIsTransitioning(true);
    
    const executeTransition = () => {
      setDifficulty(d);
      setMode(mode);
      // Handle graphics level - lowGfx param is legacy boolean for compatibility
      if (lowGfx !== undefined) {
        const newLevel: GraphicsLevel = lowGfx ? "low" : "high";
        setGraphicsLevel(newLevel);
        saveGraphicsSettings(newLevel);
      }
      setSeedOverride(seedOverrideParam ?? null);
      setShowGhost(gameSettings?.showGhost ?? false);
      setNebulaFxEnabled(gameSettings?.nebulaFxEnabled ?? true);
      setLargeRotateButtons(gameSettings?.largeRotateButtons ?? true);
      setShowFullHUD(gameSettings?.showFullHUD ?? true);
      setGameKey(prev => prev + 1);
      
      if (startLevel && startLevel > 1) {
        const lvlIndex = Math.max(0, Math.floor(startLevel - 1));
        setSuccessCount(lvlIndex);
        setCarry({ score: 0, landings: 0, level: lvlIndex });
        const colors = [
          "330 100% 60%", "50 100% 60%", "140 100% 55%",
          "270 100% 70%", "25 100% 60%", "0 100% 60%",
        ];
        const idx = Math.floor(lvlIndex / 2) % colors.length;
        const root = document.documentElement;
        root.style.setProperty("--neon", colors[idx]);
        root.style.setProperty("--neon-2", colors[idx]);
      } else {
        setCarry(null);
        setSuccessCount(0);
        const root = document.documentElement;
        root.style.removeProperty("--neon");
        root.style.removeProperty("--neon-2");
      }
      setView("game");
    };
    
    const completeTransition = () => {
      setIsTransitioning(false);
    };
    
    // Check if transition is available and ready
    if (!transitionRef.current) {
      console.log("⚡ No transition ref, starting game directly");
      executeTransition();
      setIsTransitioning(false);
      return;
    }

    try {
      console.log("🌀 Starting transition:", transitionType);
      transitionRef.current.startTransition(transitionType, () => {
        executeTransition();
        setTimeout(completeTransition, 200);
      });
    } catch (error) {
      console.warn("❌ Transition failed, starting game directly:", error);
      setIsTransitioning(false);
      executeTransition();
    }
  };

  const startDemo = async (levelIndex: number, originView: "home" | "playermenu" = "home") => {
    const level = demoSequence[levelIndex];
    console.log("🎮 Starting demo for level:", level, "origin:", originView);
    
    // Ensure SFX are preloaded before demo starts (prevents poppy thruster sound)
    const audio = getGlobalAudioManager();
    try {
      await audio.prewarmThruster();
    } catch {}
    
    setDemoLevel(level);
    setDemoOriginView(originView); // Remember where to return
    setDifficulty("easy"); // Always use easy for demos
    setMode("fixed"); // Use fixed mode for consistent demos
    setGraphicsLevel("low"); // Force low graphics for demos
    setSeedOverride(level * 1000); // Consistent seed for each demo level
    setDemoStartTime(Date.now()); // Track when demo actually starts
    
    // Apply color variety to demo levels (same as game colors)
    const colors = [
      "330 100% 60%", // pink
      "50 100% 60%",  // yellow
      "140 100% 55%", // green
      "270 100% 70%", // purple
      "25 100% 60%",  // orange
      "0 100% 60%",   // red
    ];
    const colorIndex = levelIndex % colors.length;
    const root = document.documentElement;
    root.style.setProperty("--neon", colors[colorIndex]);
    root.style.setProperty("--neon-2", colors[colorIndex]);
    
    setView("demo");
  };

  // Consolidated timer reset function
  const resetTimers = () => {
    console.log("⏰ Resetting attract mode timers");
    setLastInteractionTime(Date.now());
    setDemoStartTime(null);
    setDemoTimer(0);
  };

  const exitDemo = () => {
    console.log("🏠 Exiting demo, returning to origin:", demoOriginView);
    setView(demoOriginView); // Return to the view that started the demo
    resetTimers();
  };

  const handleGameOver = (data: GameOverData) => {
    console.log('🎮 handleGameOver called:', {
      mode,
      cause: data.cause,
      isNewBestTime: data.isNewBestTime,
      isWorldRecord: data.isWorldRecord,
      level: data.level,
      timeTrialCompletionTime: data.timeTrialCompletionTime
    });
    
    setLastResult(data);
    setLastPlayedSeed(data.levelSeed ?? null);
    setLastPlayedLevel(data.level ?? 0);
    if (data.initialSpawnX !== undefined && data.initialSpawnY !== undefined) {
      setLastPlayedSpawn({ x: data.initialSpawnX, y: data.initialSpawnY });
    }
    
    // Handle demo crashes - advance sequence and exit after 1 second
    if (view === "demo" && (data.cause === "crash" || data.cause === "fuel")) {
      console.log("💥 Demo crashed, advancing sequence and exiting in 1 second");
      setTimeout(() => {
        setDemoSequenceIndex((prev) => {
          const nextIndex = (prev + 1) % demoSequence.length;
          console.log(`🎮 Demo sequence advancing: ${prev} -> ${nextIndex}`);
          return nextIndex;
        });
        exitDemo();
      }, 1000);
      return;
    }
    
    // Generate a fresh starfield/effect config for this screen
    setSfConfig(genSfConfig());
    if (data.cause === "success") {
      // Time Trial: Check if we need initials
      if (mode === "timetrial" && (data.isNewBestTime || data.isWorldRecord)) {
        console.log('🏆 New Time Trial record detected, setting needsInitials=true');
        setNeedsInitials(true);
        setTimeTrialRecordPending({
          completionTime: data.timeTrialCompletionTime!,
          level: data.level!,
          difficulty: data.difficulty,
          ghostFrames: data.timeTrialGhostFrames!,
          isNewLocalRecord: data.isNewBestTime!,
          isNewGlobalRecord: data.isWorldRecord!
        });
        console.log('📝 timeTrialRecordPending set:', {
          completionTime: data.timeTrialCompletionTime,
          level: data.level,
          isNewLocalRecord: data.isNewBestTime,
          isNewGlobalRecord: data.isWorldRecord
        });
      } else {
        console.log('⏭️ Not a new record, skipping initials', {
          mode,
          isNewBestTime: data.isNewBestTime,
          isWorldRecord: data.isWorldRecord
        });
        setNeedsInitials(false);
      }
      
      // Choose background for this success and advance cursor for next time
      const total = 2; // Wormhole (0), Gravity Wave (1)
      const current = successBgCursorRef.current % total;
      setCurrentSuccessBg(current);
      successBgCursorRef.current = (current + 1) % total;

      // Clear seed override for classic mode to ensure new random seed for next level
      if (mode === "classic") {
        setSeedOverride(null);
      }

      setCarry({ score: data.score, landings: data.landings, level: successCount + 1 });
      setSuccessCount((c) => c + 1);
      setView("gameover");
      return;
    }
    // On failure, reset rotation order
    successBgCursorRef.current = 0;
    // Failure path: check highscore eligibility first; allow initials entry
    const currentList = mode === "fixed" ? fixedScores : classicScores;
    const qualifies = currentList.length < 5 || data.score > Math.min(...currentList.slice(0, 5).map((s) => s.score));
    if (qualifies && data.score > 0) {
      setNeedsInitials(true);
    } else {
      setNeedsInitials(false);
    }
    setView("gameover");
  };

  const continueGame = () => {
    if (isTransitioning) return;
    
    try { audioRef.current.stopMissionSuccess(); } catch {}
    
    // Clear seed override to ensure proper seed calculation for next level
    setSeedOverride(null);
    
    // Force GameEngine remount for classic mode to ensure clean random seed generation
    if (mode === "classic") {
      setGameKey(prev => prev + 1);
    }
    
    setIsTransitioning(true);
    
    const executeTransition = () => {
      const colors = [
        "330 100% 60%", "50 100% 60%", "140 100% 55%",
        "270 100% 70%", "25 100% 60%", "0 100% 60%",
      ];
      const lvl = (carry?.level ?? successCount);
      const idx = Math.floor(lvl / 2) % colors.length;
      const root = document.documentElement;
      root.style.setProperty("--neon", colors[idx]);
      root.style.setProperty("--neon-2", colors[idx]);
      setView("game");
    };
    
    transitionRef.current?.startTransition("hyperspace-jump", () => {
      executeTransition();
      setTimeout(() => setIsTransitioning(false), 200);
    });
  };
const retryGame = () => {
  const root = document.documentElement;
  root.style.removeProperty("--neon");
  root.style.removeProperty("--neon-2");
  setCarry({ score: 0, landings: 0, level: 0 });
  setSuccessCount(0);
  setSeedOverride(lastPlayedSeed);
  setShowLeaderboardsAfterInitials(false);
  setGameKey(prev => prev + 1);
  setView("game");
};
  const retryCurrentLevel = () => {
    // Keep current level but reset score and landings
    setCarry((prev) => ({ score: 0, landings: 0, level: prev?.level ?? successCount }));
    setSeedOverride(lastPlayedSeed);
    setShowLeaderboardsAfterInitials(false);
    setGameKey(prev => prev + 1);
    setView("game");
  };

  const handleRetryLevel = () => {
    console.log('🔄 Retrying level:', lastResult.level);
    
    // Preserve the level that was just played
    const levelToRetry = lastResult.level ?? carry?.level ?? successCount;
    setCarry({ score: 0, landings: 0, level: levelToRetry });
    setSuccessCount(levelToRetry);
    
    // Preserve the seed to ensure same level layout
    setSeedOverride(lastPlayedSeed);
    
    // Reset leaderboard display state
    setShowLeaderboardsAfterInitials(false);
    
    // Force GameEngine remount with preserved state
    setGameKey(prev => prev + 1);
    setView("game");
  };

  const handleContinueLevel = (nextLevel: number) => {
    console.log('➡️ Continuing to level:', nextLevel);
    // Update carry/successCount to reflect the next level
    setCarry({ score: 0, landings: 0, level: nextLevel });
    setSuccessCount(nextLevel);
    setSeedOverride(null); // Clear seed override so next level uses its configured seed
    // Update neon color for next level
    const colors = [
      "330 100% 60%", "50 100% 60%", "140 100% 55%",
      "270 100% 70%", "25 100% 60%", "0 100% 60%",
    ];
    const idx = Math.floor(nextLevel / 2) % colors.length;
    const root = document.documentElement;
    root.style.setProperty("--neon", colors[idx]);
    root.style.setProperty("--neon-2", colors[idx]);
    setGameKey(prev => prev + 1);
    setView("game");
  };

  // Focus initial gameover button on entering the view
  useEffect(() => {
    if (view !== "gameover") return;
    const t = setTimeout(() => {
      if (lastResult?.cause === "success") {
        contRef.current?.focus();
      } else {
        if (!needsInitials) {
          setGoIndex(1);
          retryCurrRef.current?.focus();
        } else {
          setGoIndex(1);
          retryCurrRef.current?.focus();
        }
      }
    }, 0);
    return () => clearTimeout(t);
  }, [view, lastResult, needsInitials]);

  // Apply randomized starfield config and sync asteroids on gameover
  useEffect(() => {
    if (view !== "gameover" || !sfConfig) return;
    try {
      starfieldRef.current?.SetSeed(sfConfig.seed);
      starfieldRef.current?.SetSpeed(sfConfig.speed);
      starfieldRef.current?.SetDensity(sfConfig.density);
      starfieldRef.current?.SetVanishingPoint(sfConfig.cx, sfConfig.cy);
      const aseed = (sfConfig.seed ^ 0xA57E01D) >>> 0; // mix for asteroids
      asteroidsRef.current?.SetSeed(aseed);
      asteroidsRef.current?.AlignToStarfield(true);
    } catch {}
  }, [view, sfConfig]);

  // Map gamepad D-pad/LS to Arrow keys and activate selected index on press
  useEffect(() => {
    if (view !== "gameover") return;
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
    const focusOrder = () => [homeRef.current, retryCurrRef.current, retryRef.current] as const;
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
      if (input.ui.left && !prev.left && canFire("left")) {
        const order = focusOrder();
        const active = document.activeElement as HTMLElement | null;
        const idx = order.findIndex((el) => el === active);
        const ni = Math.max(0, (idx >= 0 ? idx - 1 : goIndex - 1));
        setGoIndex(ni);
        (order[ni] ?? order[0])?.focus();
        mark("left");
      }
      if (input.ui.right && !prev.right && canFire("right")) {
        const order = focusOrder();
        const active = document.activeElement as HTMLElement | null;
        const idx = order.findIndex((el) => el === active);
        const ni = Math.min(order.length - 1, (idx >= 0 ? idx + 1 : goIndex + 1));
        setGoIndex(ni);
        (order[ni] ?? order[order.length - 1])?.focus();
        mark("right");
      }
      if (input.ui.select && !prev.select && canFire("select")) {
        gateThrustUntilRelease();
        if (lastResult?.cause === "success") {
          contRef.current?.click();
        } else {
          const active = document.activeElement as HTMLElement | null;
          const order = focusOrder();
          // If nothing focused, activate current index
          if (!active) {
            (order[goIndex] ?? order[0])?.click();
          } else if (active === retryCurrRef.current) {
            retryCurrRef.current?.click();
          } else if (active === retryRef.current) {
            retryRef.current?.click();
          } else {
            homeRef.current?.click();
          }
        }
        mark("select");
      }
      if (input.ui.back && !prev.back && canFire("back")) { fire("Escape"); mark("back"); }
      prev = input.ui;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [view, lastResult, needsInitials, goIndex]);

  // Arrow-key navigation on gameover screen (matches HomeScreen pattern)
  const handleGameOverKeys: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (view !== "gameover") return;
    const key = e.key;
    const focus = (el?: HTMLElement | null) => el && el.focus();
    if (lastResult?.cause === "success") {
      if (key === "Enter") { e.preventDefault(); contRef.current?.click(); }
      return;
    }
    const order = [homeRef.current, retryCurrRef.current, retryRef.current];
    const active = document.activeElement as HTMLElement | null;
    const idx = order.findIndex((el) => el === active);
    if (idx >= 0) {
      if (key === "ArrowRight") { e.preventDefault(); const ni = Math.min(order.length - 1, idx + 1); setGoIndex(ni); focus(order[ni]); }
      if (key === "ArrowLeft") { e.preventDefault(); const ni = Math.max(0, idx - 1); setGoIndex(ni); focus(order[ni]); }
      if (key === "Enter") { e.preventDefault(); active?.click(); }
    } else {
      // No button focused, ensure our index is focused (defaults to Home)
      focus(order[goIndex] ?? order[0]);
    }
  };

  // Enter key: activate default action when not entering initials (only when no button is focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || view !== "gameover" || needsInitials) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "BUTTON" || active.closest("button,[role='button']"))) {
        return;
      }
      e.preventDefault();
      if (lastResult?.cause === "success") {
        continueGame();
      } else {
        // Default to "Retry Current Level" for mission failed
        retryCurrentLevel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, needsInitials, lastResult, goIndex]);

  // Demo timer system - 60 seconds on menu (home or playermenu), 15 seconds per demo
  useEffect(() => {
    // Don't run demo timer during active gameplay
    if (view === "game" || view === "gameover") {
      return;
    }
    
    const interval = setInterval(() => {
      const now = Date.now();
      
      if (view === "home" || view === "playermenu") {
        // Check if 60 seconds have passed since last interaction
        if (now - lastInteractionTime > 60000) {
          startDemo(demoSequenceIndex, view as "home" | "playermenu");
        }
      } else if (view === "demo" && demoStartTime) {
        // Normal 15 second timeout for demo
        if (now - demoStartTime > 15000) {
          console.log("⏰ Demo timeout, advancing sequence and exiting");
          setDemoSequenceIndex((prev) => {
            const nextIndex = (prev + 1) % demoSequence.length;
            console.log(`🎮 Demo sequence advancing: ${prev} -> ${nextIndex}`);
            return nextIndex;
          });
          exitDemo();
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [view, lastInteractionTime, demoSequenceIndex, demoStartTime, demoOriginView]);

  // User interaction detection for home/playermenu screens (demo timer reset)
  useEffect(() => {
    if (view !== "home" && view !== "playermenu") return; // Track interactions on menu screens
    
    const resetHomeTimer = () => {
      setLastInteractionTime(Date.now());
    };

    const events = ["keydown", "mousedown", "touchstart", "gamepadconnected"];
    events.forEach(event => {
      window.addEventListener(event, resetHomeTimer);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetHomeTimer);
      });
    };
  }, [view]);

  // Demo exit detection (separate from home timer)
  useEffect(() => {
    if (view !== "demo") return;
    
    const exitOnUserInput = () => {
      console.log("👆 User input detected in demo, exiting");
      exitDemo();
    };

    const events = ["keydown", "mousedown", "touchstart"];
    events.forEach(event => {
      window.addEventListener(event, exitOnUserInput);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, exitOnUserInput);
      });
    };
  }, [view]);

  // Toggle UI mode for gamepad based on view
  useEffect(() => {
    try { setUiMode(view !== "game" && view !== "demo"); } catch {}
  }, [view]);

  // Apply effect on gameover mount
  useEffect(() => {
    if (view !== "gameover" || !sfConfig || lastResult?.cause !== "success") return;
    try {
      if (currentSuccessBg === 0) {
        wormholeRef.current?.SetSeed(((sfConfig.seed ?? 0) ^ 0x57f00f) >>> 0);
        wormholeRef.current?.SetStyle(((sfConfig.style || "glow").charAt(0).toUpperCase() + (sfConfig.style || "glow").slice(1)) as any);
        wormholeRef.current?.Play("Wormhole");
      } else {
        // Start Gravity Wave with deterministic seed
        const baseSeed = ((sfConfig.seed ?? 0) ^ 0xA11CE) >>> 0;
        gwRef.current?.Play({ baseSeed, modeName: mode, levelIndex: carry?.level ?? 0, instanceId: successCount });
      }
    } catch {}
    // Play mission success music after landing sound finishes (triggered after 1 second)
    const musicTimer = setTimeout(() => {
      try { audioRef.current.playMissionSuccess(); } catch {}
    }, 1000);
    return () => clearTimeout(musicTimer);
   }, [view, sfConfig, lastResult, currentSuccessBg]);
 
   // Compute vanishing point under the success title
   useEffect(() => {
     if (view !== "gameover" || lastResult?.cause !== "success") return;
     const update = () => {
       const r = successTitleRef.current?.getBoundingClientRect();
       if (!r) return;
       const cx = (r.left + r.width / 2) / window.innerWidth;
       const cy = Math.min(0.95, Math.max(0.05, (r.bottom + 16) / window.innerHeight));
       setWormholeVP({ cx, cy });
     };
     update();
     const onRes = () => update();
     window.addEventListener("resize", onRes);
     const t = setTimeout(update, 0);
     return () => { window.removeEventListener("resize", onRes); clearTimeout(t); };
   }, [view, lastResult]);

  return (
    <div ref={pageContainerRef} className="min-h-screen bg-background text-foreground">
      {/* GameTransition - always mounted so it's available for all transitions */}
      <GameTransition 
        ref={transitionRef} 
        isActive={isTransitioning}
        onReady={() => console.log("🎮 GameTransition component ready")}
      />
      
      {view === "home" && (
        <DemoTransition isVisible={view === "home"}>
          <HomeScreen 
            onStart={startGame} 
            highScoresClassic={classicScores} 
            highScoresFixed={fixedScores} 
            lastPlayedSeed={lastPlayedSeed ?? undefined}
            lastPlayedLevel={lastPlayedLevel}
            onInteraction={() => setLastInteractionTime(Date.now())}
            onPlayerMenu={() => setView("playermenu")}
            recentlySubmittedScore={recentlySubmittedScore}
          />
        </DemoTransition>
      )}
      {view === "playermenu" && (
        <PlayerMenu
          onStartGame={(selectedMode, settings) => {
            // Map mode selection to the game Mode type
            const modeMap: Record<string, Mode> = {
              fixed: "fixed",
              classic: "classic",
              timetrial: "timetrial",
              medley: "medley",
            };
            const gameMode = modeMap[selectedMode] || "fixed";
            // Use ALL settings from Developer Menu (passed from PlayerMenu via localStorage)
            startGame(
              settings.difficulty, 
              undefined, 
              gameMode, 
              settings.graphicsLevel === "low", 
              undefined, 
              { 
                showGhost: settings.showGhost, 
                nebulaFxEnabled: settings.nebulaFxEnabled, 
                largeRotateButtons: settings.largeRotateButtons, 
                showFullHUD: settings.showFullHUD 
              }
            );
          }}
          onSurvival={() => {
            window.location.href = "/survival";
          }}
          onLeaderboards={() => { /* TODO: Leaderboards screen */ }}
          onSettings={() => { window.location.href = "/settings/controls"; }}
          onDevPortal={() => setView("home")}
          onInteraction={() => setLastInteractionTime(Date.now())}
        />
      )}
      {view === "game" && (
        <GameEngine
          key={gameKey}
          difficulty={difficulty}
          onExit={() => {
            console.log("🏠 Game exited, returning to home");
            setView("home");
            resetTimers();
          }}
          onGameOver={handleGameOver}
          initialScore={carry?.score}
          initialLandings={carry?.landings}
          level={carry?.level ?? successCount}
          mode={mode}
          graphicsLevel={graphicsLevel}
          seedOverride={seedOverride ?? undefined}
          showGhost={showGhost}
          ghostLevel={carry?.level ?? successCount}
          onRetryLevel={mode === "timetrial" ? handleRetryLevel : undefined}
          onContinueLevel={mode === "timetrial" ? handleContinueLevel : undefined}
          spawnOverride={lastPlayedSpawn ?? undefined}
          nebulaFxEnabled={nebulaFxEnabled}
          largeRotateButtons={largeRotateButtons}
          showFullHUD={showFullHUD}
        />
      )}
      {view === "demo" && (
        <DemoTransition isVisible={view === "demo"}>
          <div className="relative min-h-screen bg-background">
            {/* Demo overlay */}
            <div className="absolute top-4 left-4 z-50 opacity-70">
              <div className="bg-background/80 backdrop-blur-sm border border-accent/50 rounded-lg px-4 py-2">
                <p className="text-accent font-display text-lg">DEMO</p>
                <p className="text-muted-foreground text-sm">Level {demoLevel}</p>
              </div>
            </div>
            
            {/* "Press any key" hint */}
            <div className="absolute bottom-4 right-4 z-50 opacity-70 animate-pulse">
              <div className="bg-background/80 backdrop-blur-sm border border-accent/30 rounded-lg px-4 py-2">
                <p className="text-muted-foreground text-sm">Press any key to play</p>
              </div>
            </div>
            
            {/* Demo indicators */}
            <div className="absolute top-4 right-4 z-50 opacity-70">
              <div className="flex gap-2">
                {demoSequence.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-3 h-3 rounded-full border ${
                      idx === demoSequenceIndex
                        ? 'bg-accent border-accent'
                        : 'bg-transparent border-accent/30'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <div className="opacity-80">
              <GameEngine
                key={`demo-${demoLevel}`}
                difficulty="easy"
                onExit={exitDemo}
                onGameOver={handleGameOver} // Use main game over handler for demo
                level={demoLevel}
                mode="fixed"
                graphicsLevel="low"
                seedOverride={demoLevel * 1000}
                showGhost={false}
                isDemo={true}
                nebulaFxEnabled={false}
                showFullHUD={false}
              />
            </div>
          </div>
        </DemoTransition>
      )}
      {view === "gameover" && lastResult && (
        <main className="min-h-screen relative flex items-center justify-center">
          {lastResult.cause === "success" ? (
            <>
              {graphicsLevel === "low" ? (
                <div className="absolute inset-0 z-0">
                  <HomeStarfield />
                </div>
              ) : (
                <>
                  {currentSuccessBg === 0 ? (
                    <VectorWormhole
                      ref={wormholeRef}
                      active
                      loop
                      preset="Wormhole"
                      style={(sfConfig?.style || "glow") as any}
                      focalLength={sfConfig?.focalLength}
                      cx={wormholeVP?.cx ?? 0.5}
                      cy={wormholeVP?.cy ?? 0.5}
                      seed={(sfConfig?.seed ?? 0) ^ 0x57F00F}
                    />
                  ) : (
                    <>
                      <GravityDistortionWave
                        ref={gwRef}
                        active
                        preset="Normal"
                        focalLength={sfConfig?.focalLength}
                        cx={wormholeVP?.cx ?? 0.5}
                        cy={wormholeVP?.cy ?? 0.5}
                        baseSeed={(sfConfig?.seed ?? 0) ^ 0xA11CE}
                        modeName={mode}
                        levelIndex={carry?.level ?? 0}
                        instanceId={successCount}
                      />
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {graphicsLevel === "low" ? (
                <div className="absolute inset-0 z-0">
                  <HomeStarfield />
                </div>
              ) : (
                <>
                  <HyperspaceStarfield
                    ref={starfieldRef}
                    speed={sfConfig?.speed}
                    density={sfConfig?.density}
                    focalLength={sfConfig?.focalLength}
                    trail={sfConfig?.trail}
                    style={sfConfig?.style}
                    cx={sfConfig?.cx}
                    cy={sfConfig?.cy}
                    allowBoost={false}
                  />
                  <AsteroidField
                    ref={asteroidsRef}
                    active
                    activity={0.5}
                    maxCount={80}
                    sizeMin={2.0}
                    sizeMax={8.0}
                    spinMinDeg={5}
                    spinMaxDeg={60}
                    allowNoSpin
                    clusterFrequency={0.85}
                    occludeStars
                    alignToStarfield
                    focalLength={sfConfig?.focalLength}
                    cx={sfConfig?.cx}
                    cy={sfConfig?.cy}
                    style={sfConfig?.style === 'vector' ? 'vector' : 'glow'}
                  />
                </>
              )}
            </>
          )}
          <section className="relative text-center animate-enter" onKeyDown={handleGameOverKeys} tabIndex={0}>
            <h1 ref={successTitleRef} className="text-4xl font-display font-bold mb-3">{lastResult.cause === "success" ? "Mission Successful" : lastResult.cause === "crash" ? "Mission Failed" : "Mission Ended"}</h1>
            <p className="text-muted-foreground">Score: <span className="text-accent font-semibold">{lastResult.score}</span> · Landings: {lastResult.landings} · Time: {lastResult.elapsed.toFixed(1)}s</p>
            {lastResult.isNewBestTime && (
              <div className="mt-3 animate-enter">
                <span className="px-4 py-2 rounded-md border border-accent/70 shadow-neon-strong font-display text-accent text-lg font-bold animate-pulse">
                  🏆 NEW BEST TIME! 🏆
                </span>
              </div>
            )}
            {lastResult.isWorldRecord && (
              <div className="mt-3 animate-enter">
                <span className="px-4 py-2 rounded-md border border-yellow-400/70 shadow-[0_0_20px_rgba(255,215,0,0.6)] font-display text-yellow-400 text-lg font-bold animate-pulse">
                  🌍 NEW WORLD RECORD! 🌍
                </span>
              </div>
            )}
            {lastResult.cause === "success" && (lastResult.padBonus2x || lastResult.bullseye || lastResult.speedBonus) && (
              <div className="mt-3 flex items-center justify-center gap-3 animate-enter">
                {lastResult.padBonus2x && (
                  <span className="px-3 py-1 rounded-md border border-accent/50 shadow-neon font-display text-accent">2x PAD BONUS</span>
                )}
                {lastResult.bullseye && (
                  <span className="px-3 py-1 rounded-md border border-accent/50 shadow-neon font-display text-accent">+500 BULLSEYE</span>
                )}
                {lastResult.speedBonus && (
                  <span className="px-3 py-1 rounded-md border border-accent/50 shadow-neon font-display text-accent">+500 SPEED BONUS</span>
                )}
              </div>
            )}

            {/* Highscore initials entry after failure if eligible */}
            {lastResult.cause !== "success" && needsInitials && (
              <InitialsEntry
                score={lastResult.score}
                neonColor={neonColor}
                onInitialsConfirmed={(initials) => {
                  const hs: HighScore = { initials, score: lastResult.score, difficulty: lastResult.difficulty, date: Date.now() };
                  if (mode === "fixed") {
                    const list = [...fixedScores, hs].sort((a, b) => b.score - a.score).slice(0, 5);
                    setFixedScores(list);
                    localStorage.setItem(HS_FIXED_KEY, JSON.stringify(list));
                  } else {
                    const list = [...classicScores, hs].sort((a, b) => b.score - a.score).slice(0, 5);
                    setClassicScores(list);
                    localStorage.setItem(HS_CLASSIC_KEY, JSON.stringify(list));
                  }
                  // Track recently submitted score for highlighting immediately
                  setRecentlySubmittedScore({
                    score: hs.score,
                    initials: initials.toUpperCase(),
                    mode,
                    difficulty: hs.difficulty,
                    timestamp: Date.now(),
                  });
                  
                  // Auto-clear highlight after 60 seconds
                  setTimeout(() => setRecentlySubmittedScore(null), 60000);
                  
                  // Online submission rule: until 5 exist, accept any; then only submit new highs
                  void (async () => {
                    try {
                      const top = await fetchTop(mode, 5);
                      const rows = Array.isArray(top.rows) ? top.rows : [];
                      const qualifies = rows.length < 5 || hs.score > Math.min(...rows.map(r => r.score));
                      if (qualifies) {
                        await submitScore({ initials, score: hs.score, difficulty: hs.difficulty, mode });
                      }
                  } catch {}
                })();
                setNeedsInitials(false);
                setShowLeaderboardsAfterInitials(true);
                setTimeout(() => { setGoIndex(0); homeRef.current?.focus(); }, 0);
              }}
              onSubmit={(initials) => {}}
            />
          )}

          {/* Show leaderboards after initials are entered for Classic/Fixed modes */}
          {!needsInitials && showLeaderboardsAfterInitials && lastResult.cause !== "success" && (
            <div className="mt-8 space-y-6">
              {/* Local Leaderboard */}
              {mode === "classic" && classicScores.length > 0 && (
                <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-accent mb-4">LOCAL HIGH SCORES - CLASSIC</h2>
                  <div className="space-y-2">
                    {classicScores.map((score, idx) => {
                      const isHighlighted = recentlySubmittedScore &&
                        recentlySubmittedScore.mode === "classic" &&
                        recentlySubmittedScore.score === score.score &&
                        recentlySubmittedScore.initials.toUpperCase() === score.initials.toUpperCase() &&
                        (Date.now() - recentlySubmittedScore.timestamp < 120000);
                      
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
                          <span className="text-muted-foreground text-sm ml-4 w-32 text-right">
                            {score.difficulty === "easy" ? "Easy" : score.difficulty === "hard" ? "Hard" : "Medium"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode === "fixed" && fixedScores.length > 0 && (
                <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-accent mb-4">LOCAL HIGH SCORES - FIXED</h2>
                  <div className="space-y-2">
                    {fixedScores.map((score, idx) => {
                      const isHighlighted = recentlySubmittedScore &&
                        recentlySubmittedScore.mode === "fixed" &&
                        recentlySubmittedScore.score === score.score &&
                        recentlySubmittedScore.initials.toUpperCase() === score.initials.toUpperCase() &&
                        (Date.now() - recentlySubmittedScore.timestamp < 120000);
                      
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
                          <span className="text-muted-foreground text-sm ml-4 w-32 text-right">
                            {score.difficulty === "easy" ? "Easy" : score.difficulty === "hard" ? "Hard" : "Medium"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Global Leaderboard */}
              <OnlineLeaderboard 
                mode={mode as "classic" | "fixed"} 
                highlightScore={recentlySubmittedScore} 
              />
            </div>
          )}

              {/* Time Trial initials entry for new records */}
              {(() => {
                const shouldShow = lastResult.cause === "success" && mode === "timetrial" && needsInitials && timeTrialRecordPending;
                console.log('🔍 InitialsEntry render check:', {
                  lastResultCause: lastResult.cause,
                  mode,
                  needsInitials,
                  hasTimeTrialRecordPending: !!timeTrialRecordPending,
                  shouldShow
                });
                return shouldShow ? (
                  <InitialsEntry
                    score={0}
                    neonColor={neonColor}
                    onInitialsConfirmed={async (initials) => {
                  try {
                    const { submitTimeTrialScore } = await import('@/lib/leaderboard');
                    await submitTimeTrialScore(
                      timeTrialRecordPending.level,
                      timeTrialRecordPending.difficulty,
                      timeTrialRecordPending.completionTime,
                      initials
                    );
                    console.log('✅ Time Trial record submitted to database');
                    
                    // Update local ghost with initials
                    console.log('🎯 About to update ghost with initials:', {
                      difficulty: timeTrialRecordPending.difficulty,
                      level: timeTrialRecordPending.level,
                      initials: initials
                    });
                    
                    const { GhostManager } = await import('@/components/game/GhostManager');
                    const ghostManager = new GhostManager();
                    ghostManager.updateTimeTrialGhostInitials(
                      timeTrialRecordPending.difficulty,
                      timeTrialRecordPending.level,
                      initials
                    );
                    
                    console.log('🎯 Ghost update method called');
                    
                    // Check if this should be uploaded as world record
                    console.log('🌍 Checking if local record should be uploaded as world record...');
                    const { checkGlobalRecord, submitGlobalGhost } = await import('@/lib/leaderboard');
                    
                    const { isRecord, currentRecord, error } = await checkGlobalRecord(
                      timeTrialRecordPending.level,
                      timeTrialRecordPending.difficulty,
                      'timetrial',
                      timeTrialRecordPending.completionTime
                    );
                    
                    if (error) {
                      console.error('❌ Failed to check global record:', error);
                    } else if (isRecord) {
                      console.log('🏆 Local record beats world record! Uploading...', {
                        level: timeTrialRecordPending.level,
                        difficulty: timeTrialRecordPending.difficulty,
                        time: timeTrialRecordPending.completionTime,
                        initials,
                        beatsExisting: currentRecord ? 'Yes' : 'New record'
                      });
                      
                      // Load the ghost data to upload
                      const localGhost = ghostManager.loadTimeTrialGhost(
                        timeTrialRecordPending.difficulty,
                        timeTrialRecordPending.level
                      );
                      
                      if (localGhost) {
                        const uploadResult = await submitGlobalGhost(
                          timeTrialRecordPending.level,
                          timeTrialRecordPending.difficulty,
                          'timetrial',
                          timeTrialRecordPending.completionTime,
                          localGhost,
                          initials
                        );
                        
                        if (uploadResult.ok) {
                          console.log('✅ World record uploaded successfully!');
                        } else {
                          console.error('❌ Failed to upload world record:', uploadResult.error);
                        }
                      } else {
                        console.error('❌ No local ghost found to upload');
                      }
                    } else {
                      console.log('📊 Local record does not beat world record', {
                        localTime: timeTrialRecordPending.completionTime,
                        worldTime: currentRecord?.completion_time,
                        worldPilot: currentRecord?.initials
                      });
                    }
                  } catch (error) {
                    console.error('Error submitting Time Trial record:', error);
                  }
                  
                    setNeedsInitials(false);
                    setTimeTrialRecordPending(null);
                  }}
                  onSubmit={async (initials) => {}}
                />
                ) : null;
              })()}

            {/* GameTransition moved to root level for all views */}

            <div className="mt-6 flex gap-3 justify-center">
              {lastResult.cause === "success" ? (
                mode === "timetrial" ? (
                  // Time Trial: Show three buttons
                  <>
                    <Button variant="neon" onClick={handleRetryLevel} disabled={needsInitials}>
                      Try Again
                    </Button>
                    <Button variant="default" onClick={() => handleContinueLevel((lastResult.level ?? 0) + 1)} disabled={needsInitials}>
                      Continue
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setView("home");
                      resetTimers();
                    }} disabled={needsInitials}>
                      Main Menu
                    </Button>
                  </>
                ) : (
                  // Fixed/Classic: Single Continue button
                  <Button
                    ref={contRef}
                    variant="neon"
                    onClick={continueGame}
                  >
                    Continue
                  </Button>
                )
              ) : (
                <>
                  <Button ref={homeRef} variant="hero" className="focus-visible:ring-2 focus-visible:ring-accent" onClick={() => {
                    console.log("🏠 Home button clicked from gameover");
                    setShowLeaderboardsAfterInitials(false);
                    setView("home");
                    resetTimers();
                  }} disabled={needsInitials}>Home</Button>
                  <Button ref={retryCurrRef} variant="neon" className="focus-visible:ring-2 focus-visible:ring-accent" onClick={retryCurrentLevel} disabled={needsInitials}>Retry Current Level</Button>
                  <Button ref={retryRef} variant="neon" className="focus-visible:ring-2 focus-visible:ring-accent" onClick={retryGame} disabled={needsInitials}>Retry From Start</Button>
                </>
              )}
            </div>
          </section>
        </main>
      )}

    </div>
  );
};

export default Index;

