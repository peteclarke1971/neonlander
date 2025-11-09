import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { anyGamepad, getLastDeviceId, getPlatformFromId, loadProfile, readGamepad, saveProfile, setLastDeviceId } from "@/hooks/use-gamepad";
import { loadCursorConfig, saveCursorConfig, CursorConfig, isDesktop } from "@/lib/cursorConfig";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { AudioManager } from "@/components/game/AudioManager";

export default function ControlsSettings() {
  const [deviceId, setDeviceId] = useState<string | null>(getLastDeviceId());
  const [platform, setPlatform] = useState<string>(() => getPlatformFromId(deviceId || ""));
  const [profile, setProfile] = useState(() => loadProfile(deviceId || undefined));
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
  
  // Audio testing state
  const audioManagerRef = useRef<AudioManager | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<string>("title.mp3");
  const [selectedSFX, setSelectedSFX] = useState<string>("thruster.mp3");
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const loopingSFXRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize AudioManager
  useEffect(() => {
    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
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
          <Link to="/"><Button variant="outline">Back</Button></Link>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Detected device: <span className="font-medium">{platform || "—"}</span> {deviceId ? "(saved per device)" : "(connect a controller to customize)"}</p>
        <Glyphs />

        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Analog Settings</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="deadzone">Deadzone</Label>
              <div className="flex items-center gap-3">
                <div className="w-56"><Slider id="deadzone" value={[profile.deadzone]} min={0.05} max={0.25} step={0.005} onValueChange={(v) => setProfile(p => ({ ...p, deadzone: v[0] }))} /></div>
                <span className="text-xs text-muted-foreground">{profile.deadzone.toFixed(3)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Invert Rotation</Label>
              <Switch checked={profile.invertRotation} onCheckedChange={(v) => setProfile(p => ({ ...p, invertRotation: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Invert Thrust</Label>
              <Switch checked={profile.invertThrust} onCheckedChange={(v) => setProfile(p => ({ ...p, invertThrust: v }))} />
            </div>
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
            {isDesktop() && (
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
            <div>
              <Label htmlFor="rotmultiplier">Rotation Multiplier</Label>
              <div className="flex items-center gap-3">
                <div className="w-56"><Slider id="rotmultiplier" value={[2.0]} min={1.5} max={3.0} step={0.1} onValueChange={() => {}} disabled /></div>
                <span className="text-xs text-muted-foreground">2.0×</span>
              </div>
            </div>
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
      </section>
    </main>
  );
}
