import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Difficulty, HighScore, Mode } from "./types";
import { InitialsBadge } from "./InitialsBadge";
import { HomeStarfield } from "./HomeStarfield";
import { AudioManager } from "./AudioManager";
import FireworksDisplay from "./FireworksDisplay";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchTop, submitScore } from "@/lib/leaderboard";
import { anyGamepad, getLastDeviceId, loadProfile, readGamepad, setLastDeviceId, gateThrustUntilRelease, setUiMode } from "@/hooks/use-gamepad";
import { useNavigate } from "react-router-dom";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { shouldShowFullscreenButton } from "@/lib/deviceDetection";
const difficulties: {
  key: Difficulty;
  label: string;
  desc: string;
}[] = [{
  key: "easy",
  label: "Easy",
  desc: "Lower gravity, more fuel, rotation friction"
}, {
  key: "hard",
  label: "Hard",
  desc: "Higher gravity, minimal fuel, free spin"
}];
interface GameSettings {
  introVariant: "auto" | "freeze" | "warp";
  skipCountdowns: "never" | "first" | "always";
  photosensitive: boolean;
  lowGraphics: boolean;
  showGhost?: boolean;
  nebulaFxEnabled?: boolean;
  largeRotateButtons?: boolean;
  showFullHUD?: boolean;
}
interface Props {
  onStart: (difficulty: Difficulty, startLevel: number | undefined, mode: Mode, lowGraphics?: boolean, seedOverride?: number, gameSettings?: GameSettings) => void;
  highScoresClassic: HighScore[];
  highScoresFixed: HighScore[];
  lastPlayedSeed?: number;
  lastPlayedLevel?: number;
  onInteraction?: () => void;
  recentlySubmittedScore?: {
    score: number;
    initials: string;
    mode: Mode;
    difficulty: Difficulty;
    timestamp: number;
  } | null;
}
export const HomeScreen: React.FC<Props> = ({
  onStart,
  highScoresClassic,
  highScoresFixed,
  lastPlayedSeed,
  lastPlayedLevel,
  onInteraction,
  recentlySubmittedScore
}) => {
  const audioRef = useRef(new AudioManager());

  // Detect iOS/iPad devices
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const [musicOn, setMusicOn] = useState(() => {
    // Load global music mute state from localStorage (inverted)
    try {
      const stored = localStorage.getItem('ll-music-muted');
      return stored ? !JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });
  const [lowGraphics, setLowGraphics] = useState(() => {
    try {
      const saved = localStorage.getItem("ll-graphics-settings");
      if (saved) {
        return JSON.parse(saved).lowGraphics ?? true;
      }
      return true;
    } catch {
      return true;
    }
  });

  // Countdown intro settings
  const [introVariant, setIntroVariant] = useState<"auto" | "freeze" | "warp">(() => {
    try {
      const saved = localStorage.getItem("ll-intro-variant");
      return saved as any || "auto";
    } catch {
      return "auto";
    }
  });
  const [skipCountdowns, setSkipCountdowns] = useState<"never" | "first" | "always">(() => {
    try {
      const saved = localStorage.getItem("ll-skip-countdowns");
      return saved as any || "never";
    } catch {
      return "never";
    }
  });
  const [photosensitive, setPhotosensitive] = useState(() => {
    try {
      const saved = localStorage.getItem("ll-photosensitive");
      return saved === "true";
    } catch {
      return false;
    }
  });
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const saved = localStorage.getItem("ll-game-mode");
      return saved as Mode || "fixed";
    } catch {
      return "fixed";
    }
  });
  const [showGhost, setShowGhost] = useState(() => {
    // Ghost mode on by default for fixed mode
    return mode === "fixed";
  });
  const [globalGhostsEnabled, setGlobalGhostsEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('ll-global-ghosts-enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [nebulaFxEnabled, setNebulaFxEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('ll-nebula-fx-enabled');
      return saved ? JSON.parse(saved) : true; // Default ON
    } catch {
      return true;
    }
  });
  const [largeRotateButtons, setLargeRotateButtons] = useState(() => {
    try {
      const saved = localStorage.getItem('ll-large-rotate-buttons');
      return saved ? JSON.parse(saved) : true; // Default ON for easier touch controls
    } catch {
      return true;
    }
  });
  const [showFullHUD, setShowFullHUD] = useState(() => {
    try {
      const saved = localStorage.getItem('ll-show-full-hud');
      return saved ? JSON.parse(saved) : true; // Default ON
    } catch {
      return true;
    }
  });
  const [leaderboardView, setLeaderboardView] = useState<"local-classic" | "local-fixed" | "online-classic" | "online-fixed">("local-classic");
  const [onlineClassic, setOnlineClassic] = useState<{
    initials: string;
    score: number;
    difficulty: Difficulty;
    created_at?: string;
  }[]>([]);
  const [onlineFixed, setOnlineFixed] = useState<{
    initials: string;
    score: number;
    difficulty: Difficulty;
    created_at?: string;
  }[]>([]);

  // Fireworks preview state
  const [fireworksConfig, setFireworksConfig] = useState<{
    show: boolean;
    type: 'regular' | '2x' | 'moving';
    season?: 'halloween' | 'christmas';
    highScore: boolean;
    key: number;
  }>({
    show: false,
    type: 'regular',
    season: undefined,
    highScore: false,
    key: 0
  });
  const fireworksCycleOrder = useRef([{
    type: 'regular' as const,
    season: undefined,
    highScore: false,
    label: 'Regular Landing'
  }, {
    type: '2x' as const,
    season: undefined,
    highScore: false,
    label: '2x Landing'
  }, {
    type: 'moving' as const,
    season: undefined,
    highScore: false,
    label: 'Moving Landing'
  }, {
    type: 'regular' as const,
    season: undefined,
    highScore: true,
    label: 'High Score'
  }, {
    type: 'regular' as const,
    season: 'halloween' as const,
    highScore: false,
    label: 'Halloween Regular'
  }, {
    type: '2x' as const,
    season: 'halloween' as const,
    highScore: false,
    label: 'Halloween 2x'
  }, {
    type: 'moving' as const,
    season: 'halloween' as const,
    highScore: false,
    label: 'Halloween Moving'
  }, {
    type: 'regular' as const,
    season: 'christmas' as const,
    highScore: false,
    label: 'Christmas Regular'
  }, {
    type: '2x' as const,
    season: 'christmas' as const,
    highScore: false,
    label: 'Christmas 2x'
  }, {
    type: 'moving' as const,
    season: 'christmas' as const,
    highScore: false,
    label: 'Christmas Moving'
  }]);
  const fireworksCycle = useRef(0);
  const navigate = useNavigate();
  const [seedInput, setSeedInput] = useState(() => lastPlayedSeed?.toString() || "");

  // Update seed input when lastPlayedSeed changes
  useEffect(() => {
    if (lastPlayedSeed !== undefined) {
      setSeedInput(lastPlayedSeed.toString());
    }
  }, [lastPlayedSeed]);

  // Auto-enable ghost mode when switching to fixed mode or time trial
  useEffect(() => {
    if (mode === "fixed" || mode === "timetrial") {
      setShowGhost(true);
    }
  }, [mode]);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ll-intro-variant", introVariant);
    } catch {}
  }, [introVariant]);
  useEffect(() => {
    try {
      localStorage.setItem("ll-skip-countdowns", skipCountdowns);
    } catch {}
  }, [skipCountdowns]);
  useEffect(() => {
    try {
      localStorage.setItem("ll-photosensitive", photosensitive.toString());
    } catch {}
  }, [photosensitive]);
  useEffect(() => {
    try {
      localStorage.setItem('ll-nebula-fx-enabled', JSON.stringify(nebulaFxEnabled));
    } catch {}
  }, [nebulaFxEnabled]);
  useEffect(() => {
    try {
      localStorage.setItem('ll-large-rotate-buttons', JSON.stringify(largeRotateButtons));
    } catch {}
  }, [largeRotateButtons]);

  // Gamepad UI navigation: mirror D-pad/LS to arrow/enter/escape
  useEffect(() => {
    let raf = 0;
    // Read last device id directly to avoid early import issues
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem("ll-gp-last-device");
    } catch {}
    let profile = loadProfile(lastId || undefined);
    let prev = {
      up: false,
      down: false,
      left: false,
      right: false,
      select: false,
      back: false
    };
    let lastFire = {
      up: 0,
      down: 0,
      left: 0,
      right: 0,
      select: 0,
      back: 0
    };
    const fire = (key: string) => {
      const target = document.activeElement as HTMLElement || document.body;
      if (!target || target === document.body) {
        easyStartRef.current?.focus();
      }
      const dispatchTarget = document.activeElement as HTMLElement || document.body;
      dispatchTarget.dispatchEvent(new KeyboardEvent("keydown", {
        key,
        bubbles: true
      }));
      if (key === "Enter") {
        // Also trigger a keyup and a synthetic click to guarantee activation
        dispatchTarget.dispatchEvent(new KeyboardEvent("keyup", {
          key,
          bubbles: true
        }));
        try {
          (dispatchTarget as any)?.click?.();
        } catch {}
      }
    };
    const canFire = (dir: keyof typeof lastFire) => performance.now() - lastFire[dir] > 140;
    const mark = (dir: keyof typeof lastFire) => {
      lastFire[dir] = performance.now();
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      if (lastId !== gp.id) {
        lastId = gp.id;
        try {
          localStorage.setItem("ll-gp-last-device", gp.id);
        } catch {}
        profile = loadProfile(gp.id);
      }
      const input = readGamepad(gp, profile);
      if (input.ui.up && !prev.up && canFire("up")) {
        fire("ArrowUp");
        mark("up");
      }
      if (input.ui.down && !prev.down && canFire("down")) {
        fire("ArrowDown");
        mark("down");
      }
      if (input.ui.left && !prev.left && canFire("left")) {
        fire("ArrowLeft");
        mark("left");
      }
      if (input.ui.right && !prev.right && canFire("right")) {
        fire("ArrowRight");
        mark("right");
      }
      if (input.ui.select && !prev.select && canFire("select")) {
        fire("Enter");
        gateThrustUntilRelease();
        mark("select");
      }
      if (input.ui.back && !prev.back && canFire("back")) {
        fire("Escape");
        mark("back");
      }
      prev = input.ui;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Mark UI mode for gamepad to enable thrust gating only in UI
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
  // Keyboard focus management and shortcuts
  const musicBtnRef = useRef<HTMLButtonElement>(null);
  const lowGfxBtnRef = useRef<HTMLButtonElement>(null);
  const asteroidsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const easyStartRef = useRef<HTMLButtonElement>(null);
  const hardStartRef = useRef<HTMLButtonElement>(null);
  const levelRefs = useRef<Record<Difficulty, HTMLButtonElement[]>>({
    easy: [],
    hard: []
  });
  const modeClassicRef = useRef<HTMLButtonElement>(null);
  const modeFixedRef = useRef<HTMLButtonElement>(null);
  const lastModeFocus = useRef<Mode | null>(null);
  const fullscreenBtnRef = useRef<HTMLButtonElement>(null);
  const {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen
  } = useFullscreen();
  const [showFullscreenBtn, setShowFullscreenBtn] = useState(false);
  useEffect(() => {
    setShowFullscreenBtn(shouldShowFullscreenButton());
  }, []);
  const startLevels = [5, 10, 15, 20, 30, 50] as const;

  // Focus Easy Start on mount
  useEffect(() => {
    easyStartRef.current?.focus();
  }, []);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle ESC for fullscreen exit
    if (e.key === "Escape" && isFullscreen) {
      exitFullscreen();
      return;
    }
    const key = e.key;
    if (!(key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")) return;
    e.preventDefault();
    const active = document.activeElement as HTMLElement | null;
    const focus = (el?: HTMLElement | null) => el && el.focus();
    const isStart = (ref: React.RefObject<HTMLButtonElement>) => active === ref.current;
    const idxInLevels = (d: Difficulty) => {
      const arr = levelRefs.current[d] || [];
      return arr.findIndex(el => el === active);
    };

    // Top row navigation: Music > Low-GFX > Asteroids > Settings
    if (active === musicBtnRef.current) {
      if (key === "ArrowDown") {
        const target = lastModeFocus.current === "fixed" ? modeFixedRef.current : modeClassicRef.current;
        return void focus(target || modeClassicRef.current);
      }
      if (key === "ArrowRight") return void focus(lowGfxBtnRef.current);
      if (key === "ArrowLeft") return void focus(showFullscreenBtn ? fullscreenBtnRef.current : settingsBtnRef.current); // wrap around
      return;
    }
    if (active === lowGfxBtnRef.current) {
      if (key === "ArrowDown") {
        const target = lastModeFocus.current === "fixed" ? modeFixedRef.current : modeClassicRef.current;
        return void focus(target || modeClassicRef.current);
      }
      if (key === "ArrowRight") return void focus(asteroidsBtnRef.current);
      if (key === "ArrowLeft") return void focus(musicBtnRef.current);
      return;
    }
    if (active === asteroidsBtnRef.current) {
      if (key === "ArrowDown") {
        const target = lastModeFocus.current === "fixed" ? modeFixedRef.current : modeClassicRef.current;
        return void focus(target || modeClassicRef.current);
      }
      if (key === "ArrowRight") return void focus(settingsBtnRef.current);
      if (key === "ArrowLeft") return void focus(lowGfxBtnRef.current);
      return;
    }
    if (active === settingsBtnRef.current) {
      if (key === "ArrowDown") {
        const target = lastModeFocus.current === "fixed" ? modeFixedRef.current : modeClassicRef.current;
        return void focus(target || modeClassicRef.current);
      }
      if (key === "ArrowRight") return void focus(showFullscreenBtn ? fullscreenBtnRef.current : musicBtnRef.current);
      if (key === "ArrowLeft") return void focus(asteroidsBtnRef.current);
      return;
    }
    if (active === fullscreenBtnRef.current) {
      if (key === "ArrowDown") {
        const target = lastModeFocus.current === "fixed" ? modeFixedRef.current : modeClassicRef.current;
        return void focus(target || modeClassicRef.current);
      }
      if (key === "ArrowRight") return void focus(musicBtnRef.current); // wrap around
      if (key === "ArrowLeft") return void focus(settingsBtnRef.current);
      return;
    }

    // Mode toggle buttons
    if (active === modeClassicRef.current) {
      if (key === "ArrowRight") return void focus(modeFixedRef.current);
      if (key === "ArrowDown") {
        e.stopPropagation();
        return void focus(easyStartRef.current);
      }
      if (key === "ArrowUp") return void focus(musicBtnRef.current);
      return;
    }
    if (active === modeFixedRef.current) {
      if (key === "ArrowLeft") return void focus(modeClassicRef.current);
      if (key === "ArrowDown") {
        e.stopPropagation();
        return void focus(hardStartRef.current);
      }
      if (key === "ArrowUp") return void focus(musicBtnRef.current);
      return;
    }

    // Easy/Hard start buttons
    if (isStart(easyStartRef)) {
      if (key === "ArrowRight") return void focus(hardStartRef.current);
      if (key === "ArrowDown") return void focus(levelRefs.current.easy?.[0]);
      if (key === "ArrowUp") return void focus(modeClassicRef.current);
      return;
    }
    if (isStart(hardStartRef)) {
      if (key === "ArrowLeft") return void focus(easyStartRef.current);
      if (key === "ArrowDown") return void focus(levelRefs.current.hard?.[0]);
      if (key === "ArrowUp") return void focus(modeFixedRef.current);
      return;
    }

    // Level rows
    const levelsCount = startLevels.length;
    const ei = idxInLevels("easy");
    if (ei >= 0) {
      if (key === "ArrowLeft") return void focus(levelRefs.current.easy[Math.max(0, ei - 1)]);
      if (key === "ArrowRight") return void focus(levelRefs.current.easy[Math.min(levelsCount - 1, ei + 1)]);
      if (key === "ArrowUp") return void focus(easyStartRef.current);
      return;
    }
    const hi = idxInLevels("hard");
    if (hi >= 0) {
      if (key === "ArrowLeft") return void focus(levelRefs.current.hard[Math.max(0, hi - 1)]);
      if (key === "ArrowRight") return void focus(levelRefs.current.hard[Math.min(levelsCount - 1, hi + 1)]);
      if (key === "ArrowUp") return void focus(hardStartRef.current);
      return;
    }

    // Default: focus Easy start
    focus(easyStartRef.current);
  };
  useEffect(() => {
    let removed = false;
    const tryStart = async () => {
      try {
        if (!musicOn) return;
        audioRef.current.resume();
        await audioRef.current.playTitleMusic();
        audioRef.current.setTitleMusicMuted(false);
      } catch {}
    };
    // Attempt immediately (will be ignored by browsers that require gesture)
    tryStart();
    const startOnInteract = () => {
      tryStart();
    };
    window.addEventListener("pointerdown", startOnInteract, {
      once: true
    });
    window.addEventListener("touchstart", startOnInteract, {
      once: true
    });
    window.addEventListener("keydown", startOnInteract, {
      once: true
    });
    return () => {
      if (!removed) {
        window.removeEventListener("pointerdown", startOnInteract as any);
        window.removeEventListener("touchstart", startOnInteract as any);
        window.removeEventListener("keydown", startOnInteract as any);
        audioRef.current.stopTitleMusic();
        removed = true;
      }
    };
  }, [musicOn]);

  // Auto-rotate leaderboard view every 10 seconds across 4 boards
  useEffect(() => {
    const order: typeof leaderboardView[] = ["local-classic", "local-fixed", "online-classic", "online-fixed"];
    const id = setInterval(() => {
      setLeaderboardView(v => {
        const i = order.indexOf(v);
        return order[(i + 1) % order.length];
      });
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // Load online leaderboards and seed once from local highs if empty
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [c, f] = await Promise.all([fetchTop("classic", 10), fetchTop("fixed", 10)]);
      if (cancelled) return;
      setOnlineClassic(c.rows || []);
      setOnlineFixed(f.rows || []);
      const seeded = localStorage.getItem("online_seeded_v1");
      if (!seeded) {
        // Mark as seeded immediately to avoid duplicate submissions across mounts
        try {
          localStorage.setItem("online_seeded_v1", "1");
        } catch {}
        try {
          await Promise.all([...highScoresClassic.slice(0, 5).map(s => submitScore({
            initials: s.initials,
            score: s.score,
            difficulty: s.difficulty,
            mode: "classic"
          })), ...highScoresFixed.slice(0, 5).map(s => submitScore({
            initials: s.initials,
            score: s.score,
            difficulty: s.difficulty,
            mode: "fixed"
          }))]);
          const [c2, f2] = await Promise.all([fetchTop("classic", 10), fetchTop("fixed", 10)]);
          if (!cancelled) {
            setOnlineClassic(c2.rows || []);
            setOnlineFixed(f2.rows || []);
          }
        } catch {}
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [highScoresClassic, highScoresFixed]);
  return <main className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden>
        <HomeStarfield />
      </div>
      
      {/* Fireworks Display */}
      {fireworksConfig.show && <div key={fireworksConfig.key} className="absolute inset-0 z-30 pointer-events-none">
          <FireworksDisplay landingType={fireworksConfig.type} isHighScore={fireworksConfig.highScore} forceSeason={fireworksConfig.season} neonColor="hsl(var(--neon))" onComplete={() => setFireworksConfig(prev => ({
        ...prev,
        show: false
      }))} onSkip={() => setFireworksConfig(prev => ({
        ...prev,
        show: false
      }))} debugCycleTrigger={fireworksConfig.key} />
        </div>}
      <div className="absolute inset-0 z-10 opacity-50 pointer-events-none" aria-hidden>
        <div className="pointer-events-none w-full h-full" style={{
        background: "radial-gradient(800px 400px at 50% 0%, hsla(var(--neon),0.15), transparent 60%)"
      }} />
      </div>

      <section className="relative z-20 text-center animate-enter" onKeyDownCapture={handleKeyDown}>
        <h1 className="neon-title md:text-6xl font-extrabold font-display tracking-widest mb-3 text-foreground drop-shadow-[0_0_18px_hsla(var(--neon),_0.5)] py-[30px] text-7xl">
          NEON LUNAR LANDER


        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
      </p>

        {/* Music control visible near the title for clarity */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button ref={musicBtnRef} variant="outline" onClick={() => {
          setMusicOn(prev => {
            const next = !prev;
            // Use global music mute API for persistent control
            audioRef.current.setGlobalMusicMute(!next);
            if (next) {
              audioRef.current.resume();
              audioRef.current.playTitleMusic();
            }
            return next;
          });
        }}>
            {musicOn ? "Mute Music" : "Unmute Music"}
          </Button>
          {!isIOS && <Button ref={lowGfxBtnRef} variant={lowGraphics ? "neon" : "outline"} onClick={() => {
          const newValue = !lowGraphics;
          setLowGraphics(newValue);
          try {
            localStorage.setItem("ll-graphics-settings", JSON.stringify({
              lowGraphics: newValue
            }));
          } catch {}
        }}>
              {lowGraphics ? "Low-GFX ✓" : "Low-GFX"}
            </Button>}
          <a href="/duel" className="inline-block">
            <Button variant="neon">⚔️ LANDER DUEL</Button>
          </a>
          <a href="/asteroids" className="inline-block">
            <Button ref={asteroidsBtnRef} variant="neon">🚀 NEON ASTEROIDS</Button>
          </a>
          <a href="/lightcycles" className="inline-block">
            <Button variant="neon">⚡ NEON LIGHT CYCLES</Button>
          </a>
          <a href="/neon-racing" className="inline-block">
            <Button variant="neon">🏁 NEON RACING</Button>
          </a>
          <a href="/neon-docking" className="inline-block">
            <Button variant="neon">🚀 NEON DOCKING</Button>
          </a>
          <a href="/survival" className="inline-block">
            <Button variant="neon">🌌 SURVIVAL</Button>
          </a>
          <a href="/cavern-fx-demo" className="inline-block">
            <Button variant="neon">🌟 CAVERN FX DEMO</Button>
          </a>
          {!isIOS && <a href="/settings/controls" className="inline-block">
              <Button ref={settingsBtnRef} variant="outline">Settings ▸ Controls</Button>
            </a>}
          {showFullscreenBtn && <Button ref={fullscreenBtnRef} variant="outline" size="sm" onClick={toggleFullscreen} title="Toggle fullscreen mode (F11)" className="text-xs">
              {isFullscreen ? "Exit Full Screen" : "Full Screen"}
            </Button>}
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Mode</div>
  <ToggleGroup type="single" value={mode} onValueChange={v => {
          if (v) {
            setMode(v as Mode);
            try {
              localStorage.setItem("ll-game-mode", v);
            } catch {}
          }
        }} aria-label="Select game mode">
    <ToggleGroupItem ref={modeFixedRef} value="fixed" variant="outline" aria-label="Campaign mode" onFocus={() => {
            lastModeFocus.current = "fixed";
          }}>Campaign</ToggleGroupItem>
    <ToggleGroupItem ref={modeClassicRef} value="classic" variant="outline" aria-label="Classic mode" onFocus={() => {
            lastModeFocus.current = "classic";
          }}>Classic</ToggleGroupItem>
    <ToggleGroupItem value="timetrial" variant="outline" aria-label="Time Trial mode">⏱️ Time Trial</ToggleGroupItem>
  </ToggleGroup>
        </div>

        {/* Ghost mode toggle (only visible in fixed or time trial mode) */}
        {(mode === "fixed" || mode === "timetrial") && <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Ghost Mode</div>
              <button className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${showGhost ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-card/40 hover:bg-card/60 text-muted-foreground border border-border/40"}`} onClick={() => setShowGhost(!showGhost)}>
                👻 Ghost Mode {showGhost ? "ON" : "OFF"}
              </button>
            </div>
            
            {showGhost && <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Challenge Type</div>
                <button className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${globalGhostsEnabled ? "bg-blue-500/20 text-blue-400 border border-blue-500/40" : "bg-card/40 hover:bg-card/60 text-muted-foreground border border-border/40"}`} onClick={() => {
            const newValue = !globalGhostsEnabled;
            setGlobalGhostsEnabled(newValue);
            try {
              localStorage.setItem('ll-global-ghosts-enabled', JSON.stringify(newValue));
            } catch {}
          }}>
                  🌍 Challenge Global Ghosts {globalGhostsEnabled ? "ON" : "OFF"}
                </button>
                <div className="text-xs text-muted-foreground mt-2">
                  {globalGhostsEnabled ? "Race against the world's fastest times" : "Race against your personal best times"}
                </div>
              </div>}
          </div>}

        {/* Nebula FX toggle and Fireworks Preview (visible for all modes) */}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Visual Effects</div>
          <div className="flex gap-2 justify-center flex-wrap">
            {isIOS && <a href="/settings/controls" className="inline-block">
                <Button ref={settingsBtnRef} variant="outline">Settings ▸ Controls</Button>
              </a>}
            <button className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${nebulaFxEnabled ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-card/40 hover:bg-card/60 text-muted-foreground border border-border/40"}`} onClick={() => setNebulaFxEnabled(!nebulaFxEnabled)}>
              🌌 Nebula FX {nebulaFxEnabled ? "ON" : "OFF"}
            </button>
            <button className="px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium bg-card/40 hover:bg-card/60 text-muted-foreground border border-border/40 hover:text-accent hover:border-accent/40" onClick={() => {
            const config = fireworksCycleOrder.current[fireworksCycle.current];
            setFireworksConfig({
              show: true,
              type: config.type,
              season: config.season,
              highScore: config.highScore,
              key: Date.now()
            });
            fireworksCycle.current = (fireworksCycle.current + 1) % fireworksCycleOrder.current.length;
            console.log('🎆 Fireworks Preview:', config.label);
          }}>
              🎆 Fireworks
            </button>
            <button className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${largeRotateButtons ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-card/40 hover:bg-card/60 text-muted-foreground border border-border/40"}`} onClick={() => setLargeRotateButtons(!largeRotateButtons)}>
              🎮 Large Buttons {largeRotateButtons ? "ON" : "OFF"}
            </button>
            {isIOS && <Button ref={lowGfxBtnRef} variant={lowGraphics ? "neon" : "outline"} onClick={() => {
            const newValue = !lowGraphics;
            setLowGraphics(newValue);
            try {
              localStorage.setItem("ll-graphics-settings", JSON.stringify({
                lowGraphics: newValue
              }));
            } catch {}
          }}>
                {lowGraphics ? "Low-GFX ✓" : "Low-GFX"}
              </Button>}
          </div>
        </div>

        {/* Play by Seed */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <Input value={seedInput} onChange={e => setSeedInput(e.target.value)} placeholder="Enter seed" className="w-48" inputMode="numeric" />
          <Button variant="outline" onClick={() => {
          const txt = seedInput.trim();
          const n = parseInt(txt, 10);
          let seedNum: number;
          if (!isNaN(n)) {
            seedNum = Math.abs(Math.floor(n)) >>> 0;
          } else if (txt.length > 0) {
            let h = 2166136261 >>> 0; // FNV-like
            for (let i = 0; i < txt.length; i++) {
              h ^= txt.charCodeAt(i);
              h = Math.imul(h, 16777619);
            }
            seedNum = h >>> 0;
          } else {
            seedNum = Math.random() * 0xffffffff >>> 0;
          }
          onStart("easy", lastPlayedLevel && lastPlayedLevel > 0 ? lastPlayedLevel + 1 : undefined, mode, lowGraphics, seedNum, {
            introVariant,
            skipCountdowns,
            photosensitive,
            lowGraphics,
            showGhost: false,
            nebulaFxEnabled,
            largeRotateButtons,
            showFullHUD
          });
        }}>
            Play
          </Button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex gap-3">
            {difficulties.map(d => <div key={d.key} className="border border-border/60 rounded-lg p-4 w-44 bg-card/50">
                <div className="text-lg font-semibold">{d.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{d.desc}</div>
                <Button ref={d.key === "easy" ? easyStartRef : hardStartRef} variant="hero" size="lg" className="w-full mt-3" onClick={() => onStart(d.key, undefined, mode, lowGraphics, undefined, {
              introVariant,
              skipCountdowns,
              photosensitive,
              lowGraphics,
              showGhost,
              nebulaFxEnabled,
              largeRotateButtons,
              showFullHUD
            })}>
                  Start
                </Button>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mt-3">Start at level</div>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {startLevels.map((L, idx) => <Button key={L} ref={el => {
                if (el) {
                  const arr = levelRefs.current[d.key];
                  arr[idx] = el;
                }
              }} variant="outline" size="sm" className="w-full" onClick={() => onStart(d.key, L, mode, lowGraphics, undefined, {
                introVariant,
                skipCountdowns,
                photosensitive,
                lowGraphics,
                showGhost,
                nebulaFxEnabled,
                largeRotateButtons,
                showFullHUD
              })}>
                      {L}
                    </Button>)}
                </div>
              </div>)}
            
            {/* Caverns Mode */}
            <div className="border border-border/60 rounded-lg p-4 w-44 bg-card/50">
              <div className="text-lg font-semibold">Caverns</div>
              <div className="text-xs text-muted-foreground mt-1">Navigate through underground caverns</div>
              <Button variant="hero" size="lg" className="w-full mt-3" onClick={() => onStart("easy", undefined, "caverns", lowGraphics)}>
                Start Easy
              </Button>
              <Button variant="outline" size="lg" className="w-full mt-2" onClick={() => onStart("hard", undefined, "caverns", lowGraphics)}>
                Start Hard
              </Button>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mt-3">Start at level</div>
              <div className="mt-2 grid grid-cols-6 gap-2">
                {startLevels.map(L => <Button key={L} variant="outline" size="sm" className="w-full" onClick={() => onStart("easy", L, "caverns", lowGraphics, undefined, {
                introVariant,
                skipCountdowns,
                photosensitive,
                lowGraphics,
                showGhost: false,
                nebulaFxEnabled,
                largeRotateButtons,
                showFullHUD
              })}>
                    {L}
                  </Button>)}
              </div>
            </div>
          </div>

  {(() => {
          const isOnline = leaderboardView.startsWith("online");
          const isClassic = leaderboardView.includes("classic");
          const listLocal = isClassic ? highScoresClassic : highScoresFixed;
          const listOnline = isClassic ? onlineClassic : onlineFixed;
          const titleLabel = isOnline ? `Global Leaderboard · ${isClassic ? "Classic" : "Fixed"}` : `High Scores · ${isClassic ? "Classic" : "Fixed"}`;
          const containerTheme = isOnline ? "neon-online-theme" : !isClassic ? "neon-fixed-theme" : "";
          const currentMode = isClassic ? "classic" : "fixed";

          // Check if a row matches the recently submitted score
          const isRecentScore = (row: any) => {
            if (!recentlySubmittedScore) return false;
            if (recentlySubmittedScore.mode !== currentMode) return false;

            // For online leaderboard, also check timestamp is recent (within 2 minutes)
            if (isOnline) {
              const isRecent = Date.now() - recentlySubmittedScore.timestamp < 120000;
              return isRecent && row.score === recentlySubmittedScore.score && row.initials.toUpperCase() === recentlySubmittedScore.initials.toUpperCase();
            }

            // For local leaderboard, match by score and initials
            return row.score === recentlySubmittedScore.score && row.initials.toUpperCase() === recentlySubmittedScore.initials.toUpperCase();
          };
          return <div className={`mt-6 text-left bg-card/60 border border-border/60 rounded-lg p-4 w-[min(90vw,720px)] ${containerTheme}`}>
        <div className="flex items-center justify-between">
          <div className="text-sm uppercase tracking-wider text-muted-foreground">{titleLabel}</div>
        </div>
        <div key={leaderboardView} className="mt-2 space-y-2 animate-enter-slow">
          <ol>
            {(isOnline ? listOnline : listLocal).slice(0, 5).map((row: any, i: number) => {
                  const highlight = isRecentScore(row);
                  return <li key={`${row.initials}-${i}`} className={`flex items-center justify-between text-sm ${highlight ? 'bg-accent/20 border-l-4 border-accent pl-2 -ml-2 rounded-r animate-pulse-subtle shadow-[0_0_20px_hsl(var(--accent)/0.3)]' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-foreground/90 w-5 text-right">{i + 1}.</span>
                    <InitialsBadge initials={row.initials} />
                  </div>
                  <span className="text-accent font-semibold">{row.score}</span>
                  <span className="text-muted-foreground hidden sm:block">
                    {isOnline ? row.created_at ? new Date(row.created_at).toLocaleDateString() : "" : row.date ? new Date(row.date).toLocaleDateString() : ""}
                  </span>
                </li>;
                })}
          </ol>
        </div>
      </div>;
        })()}
        </div>
      </section>
    </main>;
};