import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { anyGamepad, getLastDeviceId, getPlatformFromId, loadProfile, readGamepad, saveProfile, setLastDeviceId } from "@/hooks/use-gamepad";
import { loadCursorConfig, saveCursorConfig, CursorConfig, isDesktop } from "@/lib/cursorConfig";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { getGlobalAudioManager } from "@/components/game/AudioManager";
import { loadGraphicsSettings, saveGraphicsSettings, GraphicsLevel, detectOptimalGraphics, BenchmarkResult } from "@/lib/graphicsConfig";

export default function ControlsSettings() {
  const navigate = useNavigate();
  
  // Detect if accessed from Player Menu (restricted settings mode)
  const [isPlayerMenuMode] = useState(() => {
    try {
      return localStorage.getItem('ll-settings-origin') === 'playermenu';
    } catch {
      return false;
    }
  });
  
  // Auto-detect graphics benchmark state
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  
  const [deviceId, setDeviceId] = useState<string | null>(getLastDeviceId());
  const [platform, setPlatform] = useState<string>(() => getPlatformFromId(deviceId || ""));
  const [profile, setProfile] = useState(() => {
    const p = loadProfile(deviceId || undefined);
    // Sync invertRotation from global localStorage key if it exists
    try {
      const globalInvert = localStorage.getItem('ll-invert-rotation');
      if (globalInvert !== null) {
        p.invertRotation = globalInvert === 'true';
      }
    } catch {}
    return p;
  });
  const [listening, setListening] = useState<{ field: keyof typeof profile.map | null; type: "button" | "axis" | null }>({ field: null, type: null });
  const [cursorConfig, setCursorConfig] = useState<CursorConfig>(loadCursorConfig);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [largeRotateButtons, setLargeRotateButtons] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-large-rotate-buttons');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [showFullHUD, setShowFullHUD] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-show-full-hud');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [liquidFuelEnabled, setLiquidFuelEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-liquid-fuel-enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [showFPS, setShowFPS] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-show-fps');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [scanlinesEnabled, setScanlinesEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-scanlines-enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [scanlineSpacing, setScanlineSpacing] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-scanline-spacing');
      return saved ? JSON.parse(saved) : 2;
    } catch {
      return 2;
    }
  });
  const [scanlineOpacity, setScanlineOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-scanline-opacity');
      return saved ? JSON.parse(saved) : 0.15;
    } catch {
      return 0.15;
    }
  });
  const [scanlineIntensity, setScanlineIntensity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-scanline-intensity');
      return saved ? JSON.parse(saved) : 0.5;
    } catch {
      return 0.5;
    }
  });
  const [scanlineBlendMode, setScanlineBlendMode] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ll-scanline-blend-mode');
      return saved ? JSON.parse(saved) : 'multiply';
    } catch {
      return 'multiply';
    }
  });
  const [touchOpacity, setTouchOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-touch-opacity');
      return saved ? JSON.parse(saved) : 10;
    } catch {
      return 10;
    }
  });
  const [musicMuted, setMusicMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-music-muted');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [smallUFOEnabled, setSmallUFOEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-ufo-small-enabled');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [smallUFODifficulty, setSmallUFODifficulty] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-ufo-small-difficulty');
      return saved ? JSON.parse(saved) : 1;
    } catch {
      return 1;
    }
  });
  
  const [mediumUFOEnabled, setMediumUFOEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-ufo-medium-enabled');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [mediumUFODifficulty, setMediumUFODifficulty] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-ufo-medium-difficulty');
      return saved ? JSON.parse(saved) : 1;
    } catch {
      return 1;
    }
  });
  
  const [largeUFOEnabled, setLargeUFOEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-ufo-large-enabled');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [largeUFODifficulty, setLargeUFODifficulty] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-ufo-large-difficulty');
      return saved ? JSON.parse(saved) : 1;
    } catch {
      return 1;
    }
  });
  
  // Terrain-masked fireworks toggle (experimental)
  const [terrainMaskedFireworks, setTerrainMaskedFireworks] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-terrain-masked-fireworks');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  
  // Countdown display settings
  const [goFillEnabled, setGoFillEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-go-fill-enabled');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [goColorCycle, setGoColorCycle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-go-color-cycle');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [goColorCycleSpeed, setGoColorCycleSpeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-go-color-cycle-speed');
      return saved ? parseFloat(saved) : 5;
    } catch {
      return 5;
    }
  });
  const [goFont, setGoFont] = useState<string>(() => {
    try {
      return localStorage.getItem('ll-go-font') || '"Orbitron", sans-serif';
    } catch {
      return '"Orbitron", sans-serif';
    }
  });
  const [goSizeMultiplier, setGoSizeMultiplier] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-go-size-multiplier');
      return saved ? parseFloat(saved) : 1;
    } catch {
      return 1;
    }
  });
  
  // Thruster optimization toggle (for PC/Laptop at high resolutions like 4K)
  const [thrusterOptimization, setThrusterOptimization] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-thruster-optimization');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  
  // Graphics quality setting
  const [graphicsLevel, setGraphicsLevel] = useState<GraphicsLevel>(loadGraphicsSettings);
  
  // Touch control layout settings (developer menu only)
  const [touchOffsetY, setTouchOffsetY] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('ll-touch-controls-offset-y') || '0');
    } catch { return 0; }
  });
  const [touchOffsetX, setTouchOffsetX] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('ll-touch-controls-offset-x') || '0');
    } catch { return 0; }
  });
  const [touchScale, setTouchScale] = useState<number>(() => {
    try {
      return parseFloat(localStorage.getItem('ll-touch-controls-scale') || '1');
    } catch { return 1; }
  });
  
  // Audio testing state
  const audioManagerRef = useRef(getGlobalAudioManager());
  const [selectedMusic, setSelectedMusic] = useState<string>("title.mp3");
  const [selectedSFX, setSelectedSFX] = useState<string>("thruster.mp3");
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const loopingSFXRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize AudioManager
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.resume();
      audioManagerRef.current.preloadSFX();
    }
  }, []);
  
  // Save cursor config when it changes
  useEffect(() => {
    saveCursorConfig(cursorConfig);
  }, [cursorConfig]);

  // Save large rotate buttons setting when it changes
  useEffect(() => {
    try {
      localStorage.setItem('ll-large-rotate-buttons', JSON.stringify(largeRotateButtons));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [largeRotateButtons]);

  // Save full HUD setting when it changes
  useEffect(() => {
    try {
      localStorage.setItem('ll-show-full-hud', JSON.stringify(showFullHUD));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [showFullHUD]);

  // Save liquid fuel display setting when it changes
  useEffect(() => {
    try {
      localStorage.setItem('ll-liquid-fuel-enabled', JSON.stringify(liquidFuelEnabled));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [liquidFuelEnabled]);

  // Save show FPS setting when it changes
  useEffect(() => {
    try {
      localStorage.setItem('ll-show-fps', JSON.stringify(showFPS));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [showFPS]);

  // Save scanlines setting when it changes
  useEffect(() => {
    try {
      localStorage.setItem('ll-scanlines-enabled', JSON.stringify(scanlinesEnabled));
      window.dispatchEvent(new CustomEvent('scanlinesChanged', { detail: scanlinesEnabled }));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [scanlinesEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-scanline-spacing', JSON.stringify(scanlineSpacing));
      window.dispatchEvent(new CustomEvent('scanlineSettingsChanged'));
    } catch {}
  }, [scanlineSpacing]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-scanline-opacity', JSON.stringify(scanlineOpacity));
      window.dispatchEvent(new CustomEvent('scanlineSettingsChanged'));
    } catch {}
  }, [scanlineOpacity]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-scanline-intensity', JSON.stringify(scanlineIntensity));
      window.dispatchEvent(new CustomEvent('scanlineSettingsChanged'));
    } catch {}
  }, [scanlineIntensity]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-scanline-blend-mode', JSON.stringify(scanlineBlendMode));
      window.dispatchEvent(new CustomEvent('scanlineSettingsChanged'));
    } catch {}
  }, [scanlineBlendMode]);
  
  useEffect(() => {
    try {
      localStorage.setItem('ll-touch-opacity', JSON.stringify(touchOpacity));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [touchOpacity]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-ufo-small-enabled', JSON.stringify(smallUFOEnabled));
    } catch (e) {
      console.warn('Failed to save small UFO enabled:', e);
    }
  }, [smallUFOEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-ufo-small-difficulty', JSON.stringify(smallUFODifficulty));
    } catch (e) {
      console.warn('Failed to save small UFO difficulty:', e);
    }
  }, [smallUFODifficulty]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-ufo-medium-enabled', JSON.stringify(mediumUFOEnabled));
    } catch (e) {
      console.warn('Failed to save medium UFO enabled:', e);
    }
  }, [mediumUFOEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-ufo-medium-difficulty', JSON.stringify(mediumUFODifficulty));
    } catch (e) {
      console.warn('Failed to save medium UFO difficulty:', e);
    }
  }, [mediumUFODifficulty]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-ufo-large-enabled', JSON.stringify(largeUFOEnabled));
    } catch (e) {
      console.warn('Failed to save large UFO enabled:', e);
    }
  }, [largeUFOEnabled]);

  // Save terrain-masked fireworks setting
  useEffect(() => {
    try {
      localStorage.setItem('ll-terrain-masked-fireworks', JSON.stringify(terrainMaskedFireworks));
    } catch {}
  }, [terrainMaskedFireworks]);
  
  // Save thruster optimization setting
  useEffect(() => {
    try {
      localStorage.setItem('ll-thruster-optimization', JSON.stringify(thrusterOptimization));
    } catch {}
  }, [thrusterOptimization]);
  
  // Save countdown display settings
  useEffect(() => {
    try { localStorage.setItem('ll-go-fill-enabled', goFillEnabled ? 'true' : 'false'); } catch {}
  }, [goFillEnabled]);
  
  useEffect(() => {
    try { localStorage.setItem('ll-go-color-cycle', goColorCycle ? 'true' : 'false'); } catch {}
  }, [goColorCycle]);
  
  useEffect(() => {
    try { localStorage.setItem('ll-go-color-cycle-speed', goColorCycleSpeed.toString()); } catch {}
  }, [goColorCycleSpeed]);
  
  useEffect(() => {
    try { localStorage.setItem('ll-go-font', goFont); } catch {}
  }, [goFont]);
  
  useEffect(() => {
    try { localStorage.setItem('ll-go-size-multiplier', goSizeMultiplier.toString()); } catch {}
  }, [goSizeMultiplier]);

  useEffect(() => {
    try {
      localStorage.setItem('ll-ufo-large-difficulty', JSON.stringify(largeUFODifficulty));
    } catch (e) {
      console.warn('Failed to save large UFO difficulty:', e);
    }
  }, [largeUFODifficulty]);
  
  // Save touch control layout settings
  useEffect(() => {
    try { localStorage.setItem('ll-touch-controls-offset-y', touchOffsetY.toString()); } catch {}
  }, [touchOffsetY]);
  
  useEffect(() => {
    try { localStorage.setItem('ll-touch-controls-offset-x', touchOffsetX.toString()); } catch {}
  }, [touchOffsetX]);
  
  useEffect(() => {
    try { localStorage.setItem('ll-touch-controls-scale', touchScale.toString()); } catch {}
  }, [touchScale]);

  // SEO
  useEffect(() => {
    document.title = "Controls Settings — Neon Lunar Lander";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Configure controller mappings, deadzone, invert options, and vibration for Neon Lunar Lander.");
    const link = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", window.location.origin + "/settings/controls");
    if (!link.parentElement) document.head.appendChild(link);
  }, []);

  // Hot-swap detection
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      if (deviceId !== gp.id) {
        setLastDeviceId(gp.id);
        setDeviceId(gp.id);
        setPlatform(getPlatformFromId(gp.id));
        setProfile(loadProfile(gp.id));
      }
};
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [deviceId]);

  // Gamepad UI navigation: map D-pad and left stick to arrow keys; thrustBtn as Enter
  useEffect(() => {
    let raf = 0;
    let lastId: string | null = getLastDeviceId();
    let gpProfile = loadProfile(lastId || undefined);
    let prev = { up: false, down: false, left: false, right: false, select: false, back: false };
    const fire = (key: string) => {
      const target = (document.activeElement as HTMLElement) || containerRef.current || document.body;
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      if (lastId !== gp.id) {
        lastId = gp.id;
        setLastDeviceId(gp.id);
        gpProfile = loadProfile(gp.id);
      }
      const input = readGamepad(gp, gpProfile);
      if (input.ui.up && !prev.up) fire("ArrowUp");
      if (input.ui.down && !prev.down) fire("ArrowDown");
      if (input.ui.left && !prev.left) fire("ArrowLeft");
      if (input.ui.right && !prev.right) fire("ArrowRight");
      if (input.ui.select && !prev.select) fire("Enter");
      if (input.ui.back && !prev.back) fire("Escape");
      prev = input.ui;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (deviceId) saveProfile(deviceId, profile);
  }, [deviceId, profile]);

  const startListen = (field: keyof typeof profile.map, type: "button" | "axis") => {
    setListening({ field, type });
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp) return;
      const input = readGamepad(gp, profile);
      // Check input raw values
      const rawGp = navigator.getGamepads?.()?.find(g => g && g.connected) as Gamepad | undefined;
      if (!rawGp) return;
      if (type === "button") {
        const idx = rawGp.buttons.findIndex(b => !!b?.pressed);
        if (idx >= 0) {
          setProfile(p => ({ ...p, map: { ...p.map, [field]: idx } }));
          setListening({ field: null, type: null });
          cancelAnimationFrame(raf);
        }
      } else {
        // axis
        let bestIdx = -1; let bestVal = 0;
        for (let i = 0; i < rawGp.axes.length; i++) {
          const v = Math.abs(rawGp.axes[i] ?? 0);
          if (v > bestVal) { bestVal = v; bestIdx = i; }
        }
        if (bestIdx >= 0 && bestVal > 0.5) {
          setProfile(p => ({ ...p, map: { ...p.map, [field]: bestIdx } }));
          setListening({ field: null, type: null });
          cancelAnimationFrame(raf);
        }
      }
    };
    raf = requestAnimationFrame(loop);
  };

  const FieldRow = ({ label, value, onRebind, type }: { label: string; value?: number; onRebind: () => void; type: "button" | "axis" }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{type === "button" ? "Button" : "Axis"} index: {value ?? "—"}</div>
      </div>
      <Button variant="outline" onClick={onRebind} disabled={!!listening.field}>
        {listening.field ? (listening.field === (label as any) ? "Listening…" : "Listening…") : "Rebind"}
      </Button>
    </div>
  );

  const Glyphs = () => {
    const plat = platform;
    const Chip = ({ children }: { children: React.ReactNode }) => (
      <span className="px-2 py-0.5 rounded border border-border/60 text-xs text-foreground/80">{children}</span>
    );
    if (plat === "playstation") return (
      <div className="flex gap-2 flex-wrap">
        <Chip>Triangle</Chip><Chip>Options</Chip><Chip>L1</Chip><Chip>R1</Chip><Chip>R2</Chip><Chip>L3</Chip><Chip>D‑Pad</Chip>
      </div>
    );
    if (plat === "nintendo") return (
      <div className="flex gap-2 flex-wrap">
        <Chip>X</Chip><Chip>+</Chip><Chip>L</Chip><Chip>R</Chip><Chip>ZR</Chip><Chip>L3</Chip><Chip>D‑Pad</Chip>
      </div>
    );
    return (
      <div className="flex gap-2 flex-wrap">
        <Chip>Y</Chip><Chip>Start</Chip><Chip>LB</Chip><Chip>RB</Chip><Chip>RT</Chip><Chip>LS</Chip><Chip>D‑Pad</Chip>
      </div>
    );
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { containerRef.current?.focus(); }, []);


  const clearAllLocalData = () => {
    const keysToRemove: string[] = [];
    
    // Iterate through all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Match ghost keys
      if (key.startsWith('neon-docking-ghost-') ||
          key.startsWith('lunar-lander-ghost-') ||
          key.startsWith('time-trial-ghost-')) {
        keysToRemove.push(key);
      }
      
      // Match high score keys
      if (key === 'll-highscores-classic' ||
          key === 'll-highscores-fixed' ||
          key === 'asteroids-high-scores' ||
          key === 'asteroids_color_high_scores' ||
          key === 'asteroids-remix-high-scores' ||
          key === 'lightcycles-high-scores' ||
          key === 'neon-docking-high-scores' ||
          key === 'neon-racing-high-scores' ||
          key === 'survival-mode-high-scores') {
        keysToRemove.push(key);
      }
    }
    
    // Remove all identified keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Show success notification
    toast({
      title: "Local data cleared",
      description: `Removed ${keysToRemove.length} ghost recordings and high scores. Your settings have been preserved.`,
    });
    
    setClearDialogOpen(false);
  };

  // Auto-detect graphics benchmark handler
  const runGraphicsBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResult(null);
    
    try {
      const result = await detectOptimalGraphics();
      setBenchmarkResult(result);
      setGraphicsLevel(result.level);
      saveGraphicsSettings(result.level);
      
      toast({
        title: `Graphics set to ${result.level.toUpperCase()}`,
        description: result.recommendation,
      });
    } catch (error) {
      toast({
        title: "Benchmark failed",
        description: "Defaulting to Mid graphics",
        variant: "destructive",
      });
      setGraphicsLevel('mid');
      saveGraphicsSettings('mid');
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Audio testing handlers
  const playTestMusic = async (trackName: string) => {
    const audio = audioManagerRef.current;
    if (!audio) return;
    
    audio.resume();
    stopTestMusic();
    
    if (trackName === "title.mp3") {
      await audio.playTitleMusic();
    } else if (trackName === "mission_success.mp3") {
      audio.playMissionSuccess();
    } else {
      const levelIndex = parseInt(trackName.replace("level", "").replace(".mp3", "")) - 1;
      audio.playLevelTrackByIndex(levelIndex);
    }
    
    setIsPlayingMusic(true);
  };
  
  const stopTestMusic = () => {
    const audio = audioManagerRef.current;
    if (!audio) return;
    
    audio.stopTitleMusic();
    audio.stopLevelMusic();
    setIsPlayingMusic(false);
  };
  
  const playTestSFX = async (effectName: string) => {
    const audio = audioManagerRef.current;
    if (!audio) return;
    
    audio.resume();
    
    // Stop any looping SFX
    if (loopingSFXRef.current) {
      clearTimeout(loopingSFXRef.current);
      loopingSFXRef.current = null;
    }
    
    // File-based sound effects
    if (effectName === "thruster.mp3") {
      await audio.setThruster(1.0);
      loopingSFXRef.current = setTimeout(() => audio.setThruster(0), 2000);
    } else if (effectName === "crash1.mp3") {
      audio.explosion();
    } else if (effectName === "crash2.mp3") {
      audio.explosion();
    } else if (effectName === "landing_on_pad.mp3") {
      audio.landing();
    } else if (effectName === "fuel_10_percent_loop.mp3") {
      await audio.startFuelAlarm();
      loopingSFXRef.current = setTimeout(() => audio.stopFuelAlarm(), 2500);
    } else if (effectName === "intro_tick.mp3") {
      audio.playIntroTick();
    } else if (effectName === "intro_go.mp3") {
      audio.playIntroGo();
    } else if (effectName === "intro_warp.mp3") {
      audio.playIntroWarp();
    }
    // Synthesized sound effects
    else if (effectName === "abort_whoosh") {
      audio.abort();
    } else if (effectName === "click") {
      audio.click();
    } else if (effectName === "shield_pickup") {
      audio.shieldPickup();
    } else if (effectName === "shield_break") {
      audio.shieldBreak();
    } else if (effectName === "collectible_noise") {
      audio.junkPickup();
    } else if (effectName === "set_completion") {
      audio.junkSetComplete();
    } else if (effectName === "wormhole_open") {
      audio.wormholeOpen();
    } else if (effectName === "wormhole_enter") {
      audio.wormholeEnter();
    } else if (effectName === "lightning_crack") {
      audio.playLightningCrack();
    } else if (effectName === "weather_ambient") {
      audio.startWeatherAmbient("rain");
      loopingSFXRef.current = setTimeout(() => audio.stopWeatherAmbient(), 2500);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    const key = e.key;
    if (!(key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight" || key === "Enter")) return;
    e.preventDefault();
    const root = e.currentTarget as HTMLElement;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
    const active = document.activeElement as HTMLElement | null;
    if (key === "Enter") { active?.click(); return; }
    const dir = (key === "ArrowUp" || key === "ArrowLeft") ? -1 : 1;
    const idx = Math.max(0, focusables.indexOf(active || focusables[0]));
    const next = focusables[(idx + dir + focusables.length) % focusables.length];
    next?.focus();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section ref={containerRef} className="max-w-2xl mx-auto p-6" onKeyDown={handleKeyDown} tabIndex={0}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-display font-bold">Controls</h1>
          <Button variant="outline" onClick={() => {
            const origin = localStorage.getItem('ll-settings-origin');
            localStorage.removeItem('ll-settings-origin');
            if (origin === 'playermenu') {
              navigate('/?view=playermenu');
            } else {
              navigate('/');
            }
          }}>Back</Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Detected device: <span className="font-medium">{platform || "—"}</span> {deviceId ? "(saved per device)" : "(connect a controller to customize)"}</p>
        <Glyphs />

        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Control Settings</h2>
          <div className="grid grid-cols-1 gap-4">
            {/* Deadzone - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div>
                <Label htmlFor="deadzone">Deadzone</Label>
                <div className="flex items-center gap-3">
                  <div className="w-56"><Slider id="deadzone" value={[profile.deadzone]} min={0.05} max={0.25} step={0.005} onValueChange={(v) => setProfile(p => ({ ...p, deadzone: v[0] }))} /></div>
                  <span className="text-xs text-muted-foreground">{profile.deadzone.toFixed(3)}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label>Invert Rotation</Label>
                <div className="text-xs text-muted-foreground">Inverts analog, keyboard, and d-pad rotation</div>
              </div>
              <Switch checked={profile.invertRotation} onCheckedChange={(v) => {
                setProfile(p => ({ ...p, invertRotation: v }));
                // Also save to global localStorage key for keyboard/d-pad inversion
                try { localStorage.setItem('ll-invert-rotation', v ? 'true' : 'false'); } catch {}
              }} />
            </div>
            {/* Invert Thrust - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="flex items-center justify-between">
                <Label>Invert Thrust</Label>
                <Switch checked={profile.invertThrust} onCheckedChange={(v) => setProfile(p => ({ ...p, invertThrust: v }))} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Vibration</Label>
              <Switch checked={profile.vibration} onCheckedChange={(v) => setProfile(p => ({ ...p, vibration: v }))} />
            </div>
          </div>
        </div>

        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Mouse & Cursor</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Hide Cursor</Label>
                <div className="text-xs text-muted-foreground">Hide cursor after idle time during gameplay</div>
              </div>
              <Switch 
                checked={cursorConfig.autoHide}
                onCheckedChange={(checked) => setCursorConfig(prev => ({ ...prev, autoHide: checked }))}
              />
            </div>
            {cursorConfig.autoHide && (
              <div>
                <Label htmlFor="idle-time">Idle Time (ms)</Label>
                <div className="flex items-center gap-3">
                  <div className="w-56">
                    <Slider 
                      id="idle-time" 
                      value={[cursorConfig.idleMs]} 
                      min={1000} 
                      max={3000} 
                      step={100} 
                      onValueChange={(value) => setCursorConfig(prev => ({ ...prev, idleMs: value[0] }))} 
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{cursorConfig.idleMs}ms</span>
                </div>
              </div>
            )}
            {/* Mouse Lock - hidden in player menu mode */}
            {isDesktop() && !isPlayerMenuMode && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mouse Lock</Label>
                  <div className="text-xs text-muted-foreground">Lock cursor for precision control (Esc to release)</div>
                </div>
                <Select 
                  value={cursorConfig.usePointerLock} 
                  onValueChange={(value: "off" | "on" | "desktop") => setCursorConfig(prev => ({ ...prev, usePointerLock: value }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="desktop">Desktop Only</SelectItem>
                    <SelectItem value="on">Always On</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Gameplay Settings</h2>
          <div className="grid grid-cols-1 gap-4">
            {/* Rotation Boost - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rotation Boost</Label>
                  <div className="text-xs text-muted-foreground">2× rotation speed while held (RT/Shift)</div>
                </div>
                <Switch 
                  checked={true} // Always enabled for now
                  onCheckedChange={() => {}}
                  disabled={true}
                />
              </div>
            )}
            {/* Rotation Multiplier - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div>
                <Label htmlFor="rotmultiplier">Rotation Multiplier</Label>
                <div className="flex items-center gap-3">
                  <div className="w-56"><Slider id="rotmultiplier" value={[2.0]} min={1.5} max={3.0} step={0.1} onValueChange={() => {}} disabled /></div>
                  <span className="text-xs text-muted-foreground">2.0×</span>
                </div>
              </div>
            )}
            {/* Moving Pads - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Moving Pads</Label>
                  <div className="text-xs text-muted-foreground">Rare, high-value moving landing pads on hard difficulty</div>
                </div>
                <select 
                  className="px-3 py-2 rounded border border-border bg-background text-foreground"
                  defaultValue="default"
                  onChange={(e) => {
                    // This would integrate with the moving pad system settings
                    console.log('Moving pads setting:', e.target.value);
                  }}
                >
                  <option value="off">Off</option>
                  <option value="default">Default</option>
                  <option value="more">More</option>
                </select>
              </div>
            )}
            {/* Large Buttons - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Large Buttons</Label>
                  <div className="text-xs text-muted-foreground">Simplified rotate buttons for touch controls (◄ ►)</div>
                </div>
                <Switch 
                  checked={largeRotateButtons}
                  onCheckedChange={setLargeRotateButtons}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label>Full HUD</Label>
                <div className="text-xs text-muted-foreground">Hide all UI elements for clean recording (keeps touch controls visible)</div>
              </div>
              <Switch 
                checked={showFullHUD}
                onCheckedChange={setShowFullHUD}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Show FPS</Label>
                <div className="text-xs text-muted-foreground">Display FPS counter in bottom-right (visible even when HUD is hidden)</div>
              </div>
              <Switch 
                checked={showFPS}
                onCheckedChange={setShowFPS}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Liquid Fuel Display</Label>
                <div className="text-xs text-muted-foreground">Show animated fuel level inside lander (sloshes with movement)</div>
              </div>
              <Switch 
                checked={liquidFuelEnabled}
                onCheckedChange={setLiquidFuelEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Mute Music</Label>
                <div className="text-xs text-muted-foreground">Mute all background music (sound effects still play)</div>
              </div>
              <Switch 
                checked={musicMuted}
                onCheckedChange={(checked) => {
                  setMusicMuted(checked);
                  try {
                    localStorage.setItem('ll-music-muted', JSON.stringify(checked));
                  } catch {}
                  if (audioManagerRef.current) {
                    audioManagerRef.current.setGlobalMusicMute(checked);
                  }
                }}
              />
            </div>
            
            {/* Small UFO Section - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="space-y-3 p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Small UFO (Scout)</Label>
                    <div className="text-xs text-muted-foreground">Fast, agile, no weapons - dives at lander</div>
                  </div>
                  <Switch 
                    checked={smallUFOEnabled}
                    onCheckedChange={setSmallUFOEnabled}
                  />
                </div>
                
                {smallUFOEnabled && (
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between items-center">
                      <Label>Difficulty</Label>
                      <span className="text-sm text-muted-foreground">{smallUFODifficulty}</span>
                    </div>
                    <Slider
                      value={[smallUFODifficulty]}
                      onValueChange={(values) => setSmallUFODifficulty(values[0])}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Slow dive, 1 attack</span>
                      <span>Fast dive, 2 attacks</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Medium UFO Section - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="space-y-3 p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Medium UFO (Fighter)</Label>
                    <div className="text-xs text-muted-foreground">Balanced speed, fires projectiles, weaves horizontally</div>
                  </div>
                  <Switch 
                    checked={mediumUFOEnabled}
                    onCheckedChange={setMediumUFOEnabled}
                  />
                </div>
                
                {mediumUFOEnabled && (
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between items-center">
                      <Label>Difficulty</Label>
                      <span className="text-sm text-muted-foreground">{mediumUFODifficulty}</span>
                    </div>
                    <Slider
                      value={[mediumUFODifficulty]}
                      onValueChange={(values) => setMediumUFODifficulty(values[0])}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Slow & inaccurate</span>
                      <span>Fast & tracking</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Large UFO Section - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="space-y-3 p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Large UFO (Mothership)</Label>
                    <div className="text-xs text-muted-foreground">Slow, hovers, fires bullet spray patterns</div>
                  </div>
                  <Switch 
                    checked={largeUFOEnabled}
                    onCheckedChange={setLargeUFOEnabled}
                  />
                </div>
                
                {largeUFOEnabled && (
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between items-center">
                      <Label>Difficulty</Label>
                      <span className="text-sm text-muted-foreground">{largeUFODifficulty}</span>
                    </div>
                    <Slider
                      value={[largeUFODifficulty]}
                      onValueChange={(values) => setLargeUFODifficulty(values[0])}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Simple spread, slow</span>
                      <span>Spirals, fast bursts</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-4 border border-border/40 rounded-lg p-4 bg-card/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Touch Screen Translucency</Label>
                  <div className="text-xs text-muted-foreground">Adjust visibility of touch controls for cleaner recordings</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opacity: {touchOpacity}/10</Label>
                </div>
                <Slider
                  value={[touchOpacity]}
                  onValueChange={(value) => setTouchOpacity(value[0])}
                  min={1}
                  max={10}
                  step={1}
                />
                <div className="text-xs text-muted-foreground">
                  1 = barely visible, 10 = fully visible
                </div>
              </div>
            </div>
            
            {/* Terrain-Masked Fireworks - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Terrain-Masked Fireworks</Label>
                  <div className="text-xs text-muted-foreground">Fireworks appear behind terrain (experimental)</div>
                </div>
                <Switch 
                  checked={terrainMaskedFireworks}
                  onCheckedChange={setTerrainMaskedFireworks}
                />
              </div>
            )}
            
            {/* Countdown Display Settings - hidden in player menu mode */}
            {!isPlayerMenuMode && (
              <div className="space-y-4 border border-border/40 rounded-lg p-4 bg-card/20">
                <div>
                  <Label className="text-base font-semibold">Countdown Display (3, 2, 1, GO)</Label>
                  <div className="text-xs text-muted-foreground">Customize the countdown that appears at level start</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>GO Fill</Label>
                    <div className="text-xs text-muted-foreground">Fill with level neon color (OFF = black fill)</div>
                  </div>
                  <Switch 
                    checked={goFillEnabled}
                    onCheckedChange={setGoFillEnabled}
                    disabled={goColorCycle}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>GO Color Cycle</Label>
                    <div className="text-xs text-muted-foreground">Cycle through all neon colors</div>
                  </div>
                  <Switch 
                    checked={goColorCycle}
                    onCheckedChange={setGoColorCycle}
                  />
                </div>
                
                {goColorCycle && (
                  <div className="space-y-2 pl-4 border-l-2 border-border/40">
                    <div className="flex items-center justify-between">
                      <Label>Color Cycle Speed</Label>
                      <span className="text-sm text-muted-foreground">{goColorCycleSpeed}</span>
                    </div>
                    <Slider
                      value={[goColorCycleSpeed]}
                      onValueChange={(values) => setGoColorCycleSpeed(values[0])}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Slow</span>
                      <span>Fast</span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>GO Font</Label>
                  <Select value={goFont} onValueChange={setGoFont}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='"Orbitron", sans-serif'>Orbitron (Default)</SelectItem>
                      <SelectItem value="monospace">Monospace</SelectItem>
                      <SelectItem value='"Arial", sans-serif'>Sans-serif</SelectItem>
                      <SelectItem value='"Times New Roman", serif'>Serif</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">Font style for countdown numbers</div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>GO Size</Label>
                    <span className="text-sm text-muted-foreground">{goSizeMultiplier.toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[goSizeMultiplier]}
                    onValueChange={(values) => setGoSizeMultiplier(values[0])}
                    min={0.33}
                    max={3}
                    step={0.01}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0.33x (Small)</span>
                    <span>3x (Large)</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div>
                <Label>CRT Scanlines</Label>
                <div className="text-xs text-muted-foreground">Simulate old-school CRT monitor effect</div>
              </div>
              <Switch 
                checked={scanlinesEnabled}
                onCheckedChange={setScanlinesEnabled}
              />
            </div>

            {scanlinesEnabled && (
              <div className="ml-6 space-y-4 mt-4 p-4 border border-border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Line Spacing: {scanlineSpacing}px</Label>
                  </div>
                  <Slider
                    value={[scanlineSpacing]}
                    onValueChange={(value) => setScanlineSpacing(value[0])}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <div className="text-xs text-muted-foreground">Smaller = more dense lines</div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Line Opacity: {scanlineOpacity.toFixed(2)}</Label>
                  </div>
                  <Slider
                    value={[scanlineOpacity]}
                    onValueChange={(value) => setScanlineOpacity(value[0])}
                    min={0}
                    max={0.5}
                    step={0.05}
                  />
                  <div className="text-xs text-muted-foreground">Darkness of the scanlines</div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Overall Intensity: {scanlineIntensity.toFixed(1)}</Label>
                  </div>
                  <Slider
                    value={[scanlineIntensity]}
                    onValueChange={(value) => setScanlineIntensity(value[0])}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                  <div className="text-xs text-muted-foreground">Overall effect strength</div>
                </div>

                <div className="space-y-2">
                  <Label>Blend Mode</Label>
                  <Select value={scanlineBlendMode} onValueChange={setScanlineBlendMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiply">Multiply (Classic)</SelectItem>
                      <SelectItem value="overlay">Overlay (Bright)</SelectItem>
                      <SelectItem value="darken">Darken (Subtle)</SelectItem>
                      <SelectItem value="screen">Screen (Light)</SelectItem>
                      <SelectItem value="hard-light">Hard Light (Intense)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">How the effect blends with content</div>
                </div>
              </div>
            )}
            
            {/* Graphics Quality */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Graphics Quality</Label>
                <div className="text-xs text-muted-foreground">
                  Adjust particle count, glow effects, and visual fidelity
                </div>
              </div>
              <Select value={graphicsLevel} onValueChange={(v) => {
                const newLevel = v as GraphicsLevel;
                setGraphicsLevel(newLevel);
                saveGraphicsSettings(newLevel);
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Auto Detect Graphics - only shown in player menu mode */}
            {isPlayerMenuMode && (
              <div className="space-y-3 border border-accent/40 rounded-lg p-4 bg-accent/5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Auto Detect Best Graphics</Label>
                    <div className="text-xs text-muted-foreground">
                      Runs a quick benchmark to determine optimal settings for your device
                    </div>
                  </div>
                </div>
                <Button
                  variant="neon"
                  className="w-full"
                  onClick={runGraphicsBenchmark}
                  disabled={isBenchmarking}
                >
                  {isBenchmarking ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">◌</span>
                      TESTING...
                    </span>
                  ) : benchmarkResult ? (
                    `DETECTED: ${benchmarkResult.level.toUpperCase()}`
                  ) : (
                    "AUTO DETECT BEST GRAPHICS"
                  )}
                </Button>
                {benchmarkResult && (
                  <div className="text-xs text-muted-foreground text-center">
                    {benchmarkResult.recommendation}
                  </div>
                )}
              </div>
            )}
            
            {/* Thruster Optimization (PC only) */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Thruster Optimization</Label>
                <div className="text-xs text-muted-foreground">
                  Reduces thruster particle effects for better performance at high resolutions (4K)
                </div>
              </div>
              <Switch 
                checked={thrusterOptimization}
                onCheckedChange={setThrusterOptimization}
              />
            </div>
          </div>
        </div>
        
        {/* Touch Control Layout */}
        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Touch Control Layout</h2>
          <div className="text-xs text-muted-foreground mb-4">
            Customize the position and size of on-screen touch controls (Rotate ◄ ► and ABORT buttons)
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Vertical Position</Label>
              <div className="flex items-center gap-3">
                <div className="w-56">
                  <Slider 
                    value={[touchOffsetY]} 
                    min={-50} 
                    max={100} 
                    step={5} 
                    onValueChange={(v) => setTouchOffsetY(v[0])} 
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16">{touchOffsetY > 0 ? '+' : ''}{touchOffsetY}px</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Move controls up (+) or down (-) from default position</div>
            </div>
            <div>
              <Label>Horizontal Position</Label>
              <div className="flex items-center gap-3">
                <div className="w-56">
                  <Slider 
                    value={[touchOffsetX]} 
                    min={-100} 
                    max={100} 
                    step={5} 
                    onValueChange={(v) => setTouchOffsetX(v[0])} 
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16">{touchOffsetX > 0 ? '+' : ''}{touchOffsetX}px</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Shift controls left (-) or right (+) from default position</div>
            </div>
            <div>
              <Label>Button Scale</Label>
              <div className="flex items-center gap-3">
                <div className="w-56">
                  <Slider 
                    value={[touchScale]} 
                    min={0.5} 
                    max={2.0} 
                    step={0.1} 
                    onValueChange={(v) => setTouchScale(v[0])} 
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16">{touchScale.toFixed(1)}x</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Scale buttons smaller (0.5x) or larger (2.0x)</div>
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={() => {
                setTouchOffsetY(0);
                setTouchOffsetX(0);
                setTouchScale(1.0);
              }}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>

        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Remap Controls</h2>
          <FieldRow label="rotateLeftBtn" value={profile.map.rotateLeftBtn} type="button" onRebind={() => startListen("rotateLeftBtn", "button")} />
          <FieldRow label="rotateRightBtn" value={profile.map.rotateRightBtn} type="button" onRebind={() => startListen("rotateRightBtn", "button")} />
          <FieldRow label="rotateBoostBtn" value={profile.map.rotateBoostBtn} type="button" onRebind={() => startListen("rotateBoostBtn", "button")} />
          <FieldRow label="abortBtn" value={profile.map.abortBtn} type="button" onRebind={() => startListen("abortBtn", "button")} />
          <FieldRow label="pauseBtn" value={profile.map.pauseBtn} type="button" onRebind={() => startListen("pauseBtn", "button")} />
          <FieldRow label="thrustBtn" value={profile.map.thrustBtn} type="button" onRebind={() => startListen("thrustBtn", "button")} />
          <FieldRow label="rotationAxis" value={profile.map.rotationAxis} type="axis" onRebind={() => startListen("rotationAxis", "axis")} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <FieldRow label="dpadUp" value={profile.map.dpadUp} type="button" onRebind={() => startListen("dpadUp", "button")} />
            <FieldRow label="dpadDown" value={profile.map.dpadDown} type="button" onRebind={() => startListen("dpadDown", "button")} />
            <FieldRow label="dpadLeft" value={profile.map.dpadLeft} type="button" onRebind={() => startListen("dpadLeft", "button")} />
            <FieldRow label="dpadRight" value={profile.map.dpadRight} type="button" onRebind={() => startListen("dpadRight", "button")} />
          </div>
        </div>

        <div className="mt-6 border rounded-lg border-destructive/60 p-4 bg-destructive/5">
          <h2 className="text-sm uppercase tracking-wider text-destructive mb-2">⚠️ Clear Local Data</h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will permanently delete:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>All ghost recordings (all game modes)</li>
              <li>All high scores (all game modes)</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Your settings will be preserved (controls, graphics, etc.)
            </p>
            
            <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full mt-2">
                  Clear All Local Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Local Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all ghost recordings and high scores from all game modes.
                    <br /><br />
                    <strong>This action cannot be undone.</strong>
                    <br /><br />
                    Your settings will be preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllLocalData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Music Testing - hidden in player menu mode */}
        {!isPlayerMenuMode && (
          <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">🎵 Music Testing</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Preview all music tracks by their code names
            </p>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="music-select">Select Track</Label>
                <Select value={selectedMusic} onValueChange={setSelectedMusic}>
                  <SelectTrigger id="music-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    <SelectItem value="title.mp3">title.mp3</SelectItem>
                    <SelectItem value="level1.mp3">level1.mp3</SelectItem>
                    <SelectItem value="level2.mp3">level2.mp3</SelectItem>
                    <SelectItem value="level3.mp3">level3.mp3</SelectItem>
                    <SelectItem value="level4.mp3">level4.mp3</SelectItem>
                    <SelectItem value="level5.mp3">level5.mp3</SelectItem>
                    <SelectItem value="level6.mp3">level6.mp3</SelectItem>
                    <SelectItem value="level7.mp3">level7.mp3</SelectItem>
                    <SelectItem value="level8.mp3">level8.mp3</SelectItem>
                    <SelectItem value="mission_success.mp3">mission_success.mp3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  className="flex-1"
                  onClick={() => playTestMusic(selectedMusic)}
                >
                  Play
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={stopTestMusic}
                  disabled={!isPlayingMusic}
                >
                  Stop
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Sound Effects Testing - hidden in player menu mode */}
        {!isPlayerMenuMode && (
          <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">🔊 Sound Effects Testing</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Preview all sound effects by their code names
            </p>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="sfx-select">Select Sound Effect</Label>
                <Select value={selectedSFX} onValueChange={setSelectedSFX}>
                  <SelectTrigger id="sfx-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    <SelectItem value="thruster.mp3">thruster.mp3</SelectItem>
                    <SelectItem value="crash1.mp3">crash1.mp3</SelectItem>
                    <SelectItem value="crash2.mp3">crash2.mp3</SelectItem>
                    <SelectItem value="landing_on_pad.mp3">landing_on_pad.mp3</SelectItem>
                    <SelectItem value="fuel_10_percent_loop.mp3">fuel_10_percent_loop.mp3</SelectItem>
                    <SelectItem value="intro_tick.mp3">intro_tick.mp3</SelectItem>
                    <SelectItem value="intro_go.mp3">intro_go.mp3</SelectItem>
                    <SelectItem value="intro_warp.mp3">intro_warp.mp3</SelectItem>
                    <SelectItem value="abort_whoosh" className="text-muted-foreground italic">abort_whoosh (synthesized)</SelectItem>
                    <SelectItem value="click" className="text-muted-foreground italic">click (synthesized)</SelectItem>
                    <SelectItem value="shield_pickup" className="text-muted-foreground italic">shield_pickup (synthesized)</SelectItem>
                    <SelectItem value="shield_break" className="text-muted-foreground italic">shield_break (synthesized)</SelectItem>
                    <SelectItem value="collectible_noise" className="text-muted-foreground italic">collectible_noise (synthesized)</SelectItem>
                    <SelectItem value="set_completion" className="text-muted-foreground italic">set_completion (synthesized)</SelectItem>
                    <SelectItem value="wormhole_open" className="text-muted-foreground italic">wormhole_open (synthesized)</SelectItem>
                    <SelectItem value="wormhole_enter" className="text-muted-foreground italic">wormhole_enter (synthesized)</SelectItem>
                    <SelectItem value="lightning_crack" className="text-muted-foreground italic">lightning_crack (synthesized)</SelectItem>
                    <SelectItem value="weather_ambient" className="text-muted-foreground italic">weather_ambient (synthesized)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => playTestSFX(selectedSFX)}
                >
                  Play
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
