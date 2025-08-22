import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HUD } from "./HUD";
import { AudioManager } from "./AudioManager";
import { CavernFXRenderer } from "./CavernFXRenderer";
import { CavernFXParams } from "./systems/cavernFX";
import { CavernBakeResult } from "./systems/cavernBake";
import { CoreComposition } from "./systems/coreComposition";
import { Difficulty, GameOverData, HUDSnapshot, Mode } from "./types";
import { generateCavern, CavernData } from "./cavern";
import { getFixedCavernSeed, isFixedCavernLevel } from "./systems/fixedCavernLevels";
import { anyGamepad, loadProfile, readGamepad, saveProfile, setLastDeviceId, vibrate, getLastDeviceId, setUiMode } from "@/hooks/use-gamepad";

// Simple seeded PRNG (Mulberry32) - needed for random effects
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Props {
  difficulty: Difficulty;
  onExit: () => void;
  onGameOver: (data: GameOverData) => void;
  initialScore?: number;
  initialLandings?: number;
  level?: number;
  mode: Mode;
  lowGraphics?: boolean;
  showCavernFX?: boolean;
  cavernFXParams?: CavernFXParams;
}

export const CavernEngine: React.FC<Props> = ({ 
  difficulty, 
  onExit, 
  onGameOver, 
  initialScore, 
  initialLandings, 
  level = 0, 
  mode, 
  lowGraphics, 
  showCavernFX = false, 
  cavernFXParams 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HUDSnapshot>({ altitude: 0, vx: 0, vy: 0, fuel: 100, score: initialScore ?? 0, time: 0, difficulty });
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [fps, setFps] = useState(0);
  
  // FPS monitoring for core elements removal
  const [lowFpsStartTime, setLowFpsStartTime] = useState<number | null>(null);
  
  // Camera and cavern state for FX renderer
  const [cameraState, setCameraState] = useState({ cameraX: 0, cameraY: 0, viewWidth: 800, viewHeight: 600 });
  const [cavernBakeResult, setCavernBakeResult] = useState<CavernBakeResult | null>(null);
  const [coreComposition] = useState(() => new CoreComposition());
  
  // Random effects state
  const [hasRandomEffects, setHasRandomEffects] = useState(false);
  const [randomEffectParams, setRandomEffectParams] = useState<CavernFXParams | undefined>(undefined);
  
  // Mobile detection and low-gfx mode for performance optimizations
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const shouldOptimizePerformance = isMobile || lowGraphics;

  // Controls state
  const keys = useRef<{ left: boolean; right: boolean; thrust: boolean; abort: boolean }>({ left: false, right: false, thrust: false, abort: false });
  const thrustAnalog = useRef(0);
  const lastThrust = useRef(0);
  const audio = useRef(new AudioManager());
  const abortAssist = useRef(false);
  // Gamepad profile/device state
  const gpProfileRef = useRef(loadProfile(getLastDeviceId()));
  const gpDeviceIdRef = useRef<string | null>(getLastDeviceId());
  const lastPauseDown = useRef(false);
  const lastAbortDown = useRef(false);

  useEffect(() => {
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = canvasRef.current!;
      const parent = containerRef.current!;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (["a", "arrowleft"].includes(k)) keys.current.left = down;
      if (["d", "arrowright"].includes(k)) keys.current.right = down;
      if (["w", "arrowup"].includes(k)) keys.current.thrust = down;
      if (k === " " || k === "arrowdown") { keys.current.abort = down; if (down) abortAssist.current = true; }
      if (down) audio.current.resume();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  // Ensure UI mode is off during gameplay
  useEffect(() => { try { setUiMode(false); } catch {} }, []);

  // Detect touch-capable devices (enable touch-to-thrust overlay)
  useEffect(() => {
    try {
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints ?? 0) > 0 || (navigator as any).msMaxTouchPoints > 0;
      setIsTouch(!!hasTouch);
    } catch {
      setIsTouch(false);
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const styles = getComputedStyle(document.documentElement);
    const neonColor = `hsl(${styles.getPropertyValue('--neon')})`;
    const bgColor = `hsl(${styles.getPropertyValue('--background')})`;
    
    // Physics state
    const baseSeed = 873421;
    const fixedSeed = baseSeed + (difficulty === "hard" ? 100000 : 0) + (level | 0) * 9973;
    
    // Determine seed based on mode and whether this is a fixed level
    let seed: number;
    if (mode === "fixed" && isFixedCavernLevel(level)) {
      seed = getFixedCavernSeed(level, difficulty);
    } else if (mode === "fixed") {
      seed = fixedSeed; // Fallback for levels beyond fixed range
    } else {
      seed = Math.floor(Math.random() * 1e9); // Classic mode - truly random
    }
    
    const levelVar = Math.min(Math.max(0, level), 20);
    
    // Generate cavern using appropriate seed
    const cavern: CavernData = generateCavern(seed, level, difficulty);
    
    // Set cavern data for FX renderer and core composition
    setCavernBakeResult(cavern.bakeResult || null);
    
    // Initialize core composition with mineral formations
    if (cavern.bakeResult) {
      coreComposition.play(cavern.bakeResult, {
        density: showCavernFX ? 0.7 : 0.5,
        motionReduction: false
      });
    }
    
    // Generate deterministic effects for fixed levels, random for classic
    const effectsEnabled = true;
    setHasRandomEffects(effectsEnabled);
    
    if (effectsEnabled) {
      // Use deterministic seed for fixed levels
      const effectSeed = (mode === "fixed" && isFixedCavernLevel(level)) ? seed + 12345 : Math.floor(Math.random() * 1e9);
      const randFx = mulberry32(effectSeed);
      
      const effectParams: CavernFXParams = {
        intensity: 0.3 + randFx() * 0.4, // 0.3-0.7
        breathDepth: 0.2 + randFx() * 0.3, // 0.2-0.5
        rippleStrength: 0.1 + randFx() * 0.4, // 0.1-0.5
        lensWarp: 0.1 + randFx() * 0.2, // 0.1-0.3
        dustDensity: 0.3 + randFx() * 0.4, // 0.3-0.7
        glow: 0.4 + randFx() * 0.4, // 0.4-0.8
        motionReduction: randFx() > 0.5,
        colorMode: 'match'
      };
      setRandomEffectParams(effectParams);
    } else {
      setRandomEffectParams(undefined);
    }

    // Stop all audio before starting level music
    try { audio.current.preloadSFX(); } catch {}
    try { audio.current.stopAllAudio(); } catch {}
    try { audio.current.playLevelTrackForLevel(level || 0); } catch {}
    
    // Ensure thruster is properly initialized after audio reset
    try { 
      setTimeout(() => {
        audio.current.setThruster(0);
      }, 50);
    } catch {}

    // Choose spawn point - start pad center
    const spawn = {
      x: (cavern.startPad.xStart + cavern.startPad.xEnd) / 2,
      y: cavern.startPad.y - 14 // Lander sits slightly higher on pad
    };

    let x = spawn.x;
    let y = spawn.y;
    let vx = 0, vy = 0;
    let angle = 0; // radians; 0 = up
    let av = 0; // angular velocity

    let baseFuel = difficulty === "easy" ? 100 : 60;
    let fuel = (level < 5 ? baseFuel * 1.5 : baseFuel); // 50% extra for first 5 missions
    fuel *= 2; // doubled fuel per level

    const fuelConsumption = difficulty === "easy" ? 22 : 30; // units per second at full thrust
    const gravity = 0.02 * 0.75; // unify gravity across difficulties
    const rotAccel = (difficulty === "easy" ? 2.2 : 2.8) * 1.15; // 15% quicker rotation
    const rotFriction = difficulty === "easy"; // easy: friction stops rotation

    let score = initialScore ?? 0;
    let landings = initialLandings ?? 0;
    let elapsed = 0;
    let running = true;
    let crashed = false;

    let cameraX = x;
    let cameraShake = 0;
    let zoom = 1;
    let landingCooldown = 0;
    let bullseyeT = -1; // overlay timer for bullseye text
    let fuelAlarmLatched = false;
    let fuelDepletedTime = -1; // track when fuel first hits 0
    // Camera smoothing state
    let smoothedAnchor = 0;
    let lastDtForCam = 0;
    let camAnchorInit = true;
    // Camera zoom smoothing helpers
    let clearanceEMA = 220; // smoothed ground clearance
    let prevTargetZoom = 1;

    // Particles
    type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
    const particles: Particle[] = [];

    // Debris (lander shards on crash)
    type Debris = { x: number; y: number; vx: number; vy: number; angle: number; av: number; life: number; max: number; size: number; kind: "plate" | "rod" | "chip" };
    const debris: Debris[] = [];
    // Shockwave rings and flash on big explosions
    type Shockwave = { x: number; y: number; life: number; max: number };
    const shockwaves: Shockwave[] = [];
    let flashT = 0; // screen flash

    // Starfield (static twinkles) and shooting stars
    type Star = { x: number; y: number; size: number; baseA: number; tw: number; ph: number; bright: boolean };
    type Shooting = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    type BgSat = { x: number; y: number; vx: number; vy: number; life: number; max: number; scale: number; rot: number; rotV: number };
    const stars: Star[] = [];
    const shooting: Shooting[] = [];
    const bgSats: BgSat[] = [];
    let nextShooting = 0.6 + Math.random() * 1.6;
    let nextBgSat = 5 + Math.random() * 7;

    // Performance-optimized DPR
    const dprInit = shouldOptimizePerformance ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const pxW = c.width / dprInit;
    const pxH = c.height / dprInit;
    
    // Performance optimization constants
    const PARTICLE_COUNT = shouldOptimizePerformance ? 2 : 4;
    const STAR_COUNT = shouldOptimizePerformance ? 150 : 320;
    const SHADOW_BLUR_DESKTOP = 14;
    const SHADOW_BLUR_MOBILE = 6;
    // Screen-space static stars covering full screen (mobile-optimized count)
    for (let i = 0; i < STAR_COUNT; i++) {
      const sx = Math.random() * pxW;
      const sy = Math.random() * pxH;
      const bright = Math.random() < 0.15;
      stars.push({ x: sx, y: sy, size: bright ? 2.4 : 1.4, baseA: bright ? 0.95 : 0.6, tw: 0.5 + Math.random() * 1.5, ph: Math.random() * Math.PI * 2, bright });
    }

    let last = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = last;
    let lowFpsStartTime: number | null = null;

    const updateHud = () => {
      const floorHeight = cavern.getHeightAt(x);
      const altitude = Math.max(0, floorHeight - y);
      setHud({ altitude, vx, vy, fuel, score, time: elapsed, difficulty });
    };

    // ... rest of game logic would go here (simplified for brevity)
    // This would include the main game loop, collision detection, rendering, etc.
    // For now, just set up basic rendering structure

    const gameLoop = (now: number) => {
      if (!running) return;
      
      const dt = Math.min((now - last) / 1000, 1/30); // cap to 30fps minimum
      last = now;
      elapsed += dt;
      
      // FPS monitoring and performance protection
      frameCount++;
      if (now - lastFpsUpdate >= 1000) { // Check every second
        const currentFps = frameCount / ((now - lastFpsUpdate) / 1000);
        setFps(Math.round(currentFps));
        frameCount = 0;
        lastFpsUpdate = now;
        
        // Performance protection: remove core elements if FPS drops below 50 for more than 1 second
        if (currentFps < 50) {
          if (lowFpsStartTime === null) {
            lowFpsStartTime = now;
          } else if (now - lowFpsStartTime > 1000) {
            // FPS has been below 50 for more than 1 second - remove core elements
            coreComposition.stop();
            lowFpsStartTime = null;
            console.warn("Performance protection: Core elements removed due to low FPS");
          }
        } else {
          // Reset the low FPS timer if performance recovers
          lowFpsStartTime = null;
        }
      }
      
      // Update camera state for FX renderer
      setCameraState({
        cameraX,
        cameraY: y,
        viewWidth: pxW,
        viewHeight: pxH
      });
      
      updateHud();
      
      // Continue game loop
      raf = requestAnimationFrame(gameLoop);
    };

    raf = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(raf);
      try { audio.current.stopAllAudio(); } catch {}
    };
  }, [difficulty, level, mode, lowGraphics, showCavernFX, initialScore, initialLandings]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black">
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      {/* FX Renderer */}
      {showCavernFX && cavernBakeResult && (
        <CavernFXRenderer
          cavernData={cavernBakeResult}
          enabled={showCavernFX}
          cameraX={cameraState.cameraX}
          cameraY={cameraState.cameraY}
          viewWidth={cameraState.viewWidth}
          viewHeight={cameraState.viewHeight}
          params={cavernFXParams || randomEffectParams}
        />
      )}
      
      {/* HUD */}
      <HUD
        altitude={hud.altitude}
        vx={hud.vx}
        vy={hud.vy}
        fuel={hud.fuel}
        score={hud.score}
        time={hud.time}
        difficulty={hud.difficulty}
      />
      
      {/* Pause/Exit */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">Game Paused</h2>
            <div className="flex gap-4">
              <Button onClick={() => setPaused(false)}>Resume</Button>
              <Button variant="outline" onClick={onExit}>Exit</Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Touch controls */}
      {isTouch && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-4 text-white/60 text-sm">
            Tap screen to thrust
          </div>
        </div>
      )}
    </div>
  );
};