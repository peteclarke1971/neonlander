import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HUD } from "./HUD";
import { AudioManager } from "./AudioManager";
import { CavernFXRenderer } from "./CavernFXRenderer";
import { CavernFXParams } from "./systems/cavernFX";
import { CavernBakeResult } from "./systems/cavernBake";
import { CoreComposition } from "./systems/coreComposition";
import { Difficulty, GameOverData, HUDSnapshot, TerrainData, Mode } from "./types";
import { generateTerrain } from "./terrain";

// Simple seeded PRNG (Mulberry32) - needed for random effects
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
import { generateCavern, CavernData } from "./cavern";
import { generateWindZones, windAccelAt, drawWindVectors } from "./systems/wind";
import { generateAnomalies, anomalyAccelAt, drawAnomaliesField } from "./systems/anomalies";
import { generateHazards, updateHazards, drawHazards, checkHazardCollision } from "./systems/hazards";
import { anyGamepad, loadProfile, readGamepad, saveProfile, setLastDeviceId, vibrate, getLastDeviceId, setUiMode } from "@/hooks/use-gamepad";

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

const WORLD_WIDTH = 4000;
const BASE_HEIGHT = 360; // base ground height
const AMPLITUDE = 180;

export const GameEngine: React.FC<Props> = ({ difficulty, onExit, onGameOver, initialScore, initialLandings, level = 0, mode, lowGraphics, showCavernFX = false, cavernFXParams }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HUDSnapshot>({ altitude: 0, vx: 0, vy: 0, fuel: 100, score: initialScore ?? 0, time: 0, difficulty });
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [fps, setFps] = useState(0);
  
  // Camera and cavern state for FX renderer
  const [cameraState, setCameraState] = useState({ cameraX: 0, cameraY: 0, viewWidth: 800, viewHeight: 600 });
  const [cavernBakeResult, setCavernBakeResult] = useState<CavernBakeResult | null>(null);
  const [coreComposition] = useState(() => new CoreComposition());
  
  // Random effects state for first 5 levels
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
    const seed = mode === "fixed" ? fixedSeed : Math.floor(Math.random() * 1e9);
    const levelVar = Math.min(Math.max(0, level), 20);
    
    // Check if this is a cavern level - only in caverns mode
    const isCavernLevel = mode === "caverns";
    
    const terrain: TerrainData | CavernData = isCavernLevel 
      ? generateCavern(seed, level, difficulty)
      : (() => {
          const terrainAmp = AMPLITUDE * (1 + 0.2 * levelVar);
          return generateTerrain(seed, WORLD_WIDTH, BASE_HEIGHT, terrainAmp, levelVar);
        })();
    
    // Set cavern data for FX renderer and core composition
    if (isCavernLevel) {
      const cavernData = terrain as CavernData;
      setCavernBakeResult(cavernData.bakeResult || null);
      
      // Initialize core composition with mineral formations
      if (cavernData.bakeResult) {
        coreComposition.play(cavernData.bakeResult, {
          density: showCavernFX ? 0.7 : 0.5, // Reduce density if graphics are disabled
          motionReduction: false // Could be tied to accessibility settings
        });
      }
    } else {
      setCavernBakeResult(null);
    }
    
    // Generate random effects for cavern levels 0-49 (match landscape color)
    const effectsEnabled = isCavernLevel && (level ?? 0) < 50;
    setHasRandomEffects(effectsEnabled);
    
    if (effectsEnabled) {
      // Use level-based seed for consistent effects per level
      const effectSeed = fixedSeed + 12345;
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
      // Give audio context a moment to stabilize, then pre-initialize thruster
      setTimeout(() => {
        audio.current.setThruster(0);
      }, 50);
    } catch {}

    // After level 10, keep only small pads (skip for cavern levels)
    if (levelVar >= 10 && !isCavernLevel) {
      const widthOf = (p: { xStart: number; xEnd: number }) => (p.xEnd >= p.xStart ? (p.xEnd - p.xStart) : (terrain.worldWidth - p.xStart + p.xEnd));
      const small = terrain.pads.filter((p) => widthOf(p) <= 36);
      if (small.length > 0) {
        terrain.pads.splice(0, terrain.pads.length, ...small);
      } else {
        const sorted = [...terrain.pads].sort((a, b) => widthOf(a) - widthOf(b));
        terrain.pads.splice(0, terrain.pads.length, ...sorted.slice(0, Math.min(2, sorted.length)));
      }
    }

    // Phase 1 systems: wind (disabled), anomalies and moving hazards (seeded)
    const WIND_ENABLED = false;
    const windZones = WIND_ENABLED ? generateWindZones(seed, terrain.worldWidth, levelVar) : [];

    // Anomalies (gravity wells) — appear from level 3, start at 1, +1 every 3 levels, capped at 5.
    const anomalyCount = levelVar >= 3 ? Math.min(1 + Math.floor((levelVar - 3) / 3), 5) : 0;
    let anomalies = generateAnomalies(seed, terrain.worldWidth, BASE_HEIGHT).slice(0, anomalyCount).map((a, _i, arr) => ({
      ...a,
      // Start much smaller (25% of previous). If multiple wells, allow 1x-4x of that starting size.
      radius: a.radius * 0.25 * (arr.length > 1 ? (1 + Math.random() * 3) : 1),
    }));

    // Moving hazards — appear from level 3, start at 1, +1 every 5 levels, capped at 4. Disabled in caverns.
    const hazardCount = isCavernLevel ? 0 : (levelVar >= 3 ? Math.min(1 + Math.floor((levelVar - 3) / 5), 4) : 0);
    const hazards = generateHazards(seed, terrain.worldWidth, BASE_HEIGHT).slice(0, hazardCount);
    // Choose a safe spawn not over pads and with altitude above terrain
    const pickSpawn = () => {
      if (isCavernLevel) {
        // For cavern levels, spawn exactly flush on the start pad
        const cavernData = terrain as CavernData;
        const padCenterX = (cavernData.startPad.xStart + cavernData.startPad.xEnd) / 2;
        const spawnY = cavernData.startPad.y - 14; // Lander sits slightly higher on pad for easy lift-off
        return { x: padCenterX, y: spawnY };
      }
      
      if (mode === "fixed") {
        const cx = WORLD_WIDTH / 2;
        const gy = terrain.getHeightAt(cx);
        const sy = gy - 520; // fixed safe altitude above ground
        return { x: cx, y: sy };
      }
      for (let attempt = 0; attempt < 60; attempt++) {
        const cx = Math.random() * WORLD_WIDTH;
        if (!terrain.getPadAt(cx)) {
          const gy = terrain.getHeightAt(cx);
          const sy = gy - 520; // safe altitude above ground
          return { x: cx, y: sy };
        }
      }
      const fallbackX = WORLD_WIDTH / 2;
      return { x: fallbackX, y: terrain.getHeightAt(fallbackX) - 520 };
    };

    const spawn = pickSpawn();
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
    let anomaliesDisabled = false; // flag to disable gravity wells
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

    // Note: occasional background satellites are rendered in screen-space for ambience (no gameplay effect)

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

    const wrapX = (xx: number) => {
      let v = xx % terrain.worldWidth;
      if (v < 0) v += terrain.worldWidth;
      return v;
    };

    let last = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = last;

    const updateHud = () => {
      let altitude: number;
      if (isCavernLevel) {
        const cavernData = terrain as CavernData;
        const floorHeight = cavernData.getHeightAt(x);
        altitude = Math.max(0, floorHeight - y);
      } else {
        altitude = Math.max(0, terrain.getHeightAt(x) - y);
      }
      setHud({ altitude, vx, vy, fuel, score, time: elapsed, difficulty });
    };

    const spawnExplosion = () => {
      // Massive particle burst
      for (let i = 0; i < 220; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 120 + Math.random() * 260;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.8 + Math.random() * 0.7, color: `hsla(${180 + Math.random() * 20},100%,60%,1)` });
      }
      // Add shockwave ring and screen flash
      shockwaves.push({ x, y, life: 0, max: 0.7 });
      flashT = Math.max(flashT, 0.28);
      cameraShake = Math.max(cameraShake, 36);
    };
    const spawnDebris = () => {
      const pieceCount = 42 + Math.floor(Math.random() * 28);
      for (let i = 0; i < pieceCount; i++) {
        const dir = Math.random() * Math.PI * 2;
        const speed = 220 + Math.random() * 320; // significantly more energetic
        const kind: Debris["kind"] = Math.random() < 0.45 ? "plate" : Math.random() < 0.75 ? "rod" : "chip";
        const size = kind === "rod" ? 2 + Math.random() * 3 : kind === "plate" ? 3 + Math.random() * 7 : 1.5 + Math.random() * 3;
        // Many pieces jet upward strongly (escape to space look)
        const upwardBoost = Math.random() < 0.5 ? -(120 + Math.random() * 260) : 0;
        debris.push({
          x,
          y,
          vx: Math.cos(dir) * speed + vx * 0.5,
          vy: Math.sin(dir) * speed + vy * 0.5 + upwardBoost,
          angle: Math.random() * Math.PI * 2,
          av: (-3 + Math.random() * 6) * (kind === "rod" ? 2.2 : 1.2),
          life: 0,
          max: 3.2 + Math.random() * 5.5, // linger across landscape longer
          size: size,
          kind,
        });
      }
    };
    const spawnShooting = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewWpx = c.width / dpr;
      const viewHpx = c.height / dpr;
      const margin = 80;
      const side = Math.floor(Math.random() * 3); // 0:left, 1:right, 2:top
      let sx = 0, sy = 0, vx = 0, vy = 0;
      if (side === 0) {
        sx = -margin; sy = Math.random() * (viewHpx * 0.7);
        vx = 180 + Math.random() * 260; vy = (Math.random() - 0.5) * 140;
      } else if (side === 1) {
        sx = viewWpx + margin; sy = Math.random() * (viewHpx * 0.7);
        vx = -180 - Math.random() * 260; vy = (Math.random() - 0.5) * 140;
      } else {
        sx = Math.random() * viewWpx; sy = -margin;
        vx = (Math.random() - 0.5) * 280; vy = 160 + Math.random() * 220;
      }
      const life = 0;
      const max = 0.6 + Math.random() * 1.0;
      shooting.push({ x: sx, y: sy, vx, vy, life, max });
    };

    // Background satellite spawner (screen-space). If ensureVisible is true,
    // spawn fully on-screen, horizontally near an edge, at or below the
    // player's starting screen height (~45% of screen), and comfortably above
    // the terrain silhouette.
      const spawnBgSat = (ensureVisible = false, scaleOverride?: number, sideOverride?: "left" | "right") => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewWpx = c.width / dpr;
        const viewHpx = c.height / dpr;
        const scale = scaleOverride ?? 0.25; // distant, small satellite in-game
        const speedBase = 24;
        const speed = speedBase * scale;

        let sx = 0, sy = 0, vx = 0, vy = 0;

        if (ensureVisible) {
          // Start inside the screen so it's visible immediately
          const dirRight = sideOverride ? sideOverride === "right" : Math.random() < 0.5;
          sx = dirRight ? viewWpx * 0.12 : viewWpx * 0.88;
          vx = dirRight ? speed : -speed;
          // Choose a band: not higher than starting lander (~45% of screen)
          // but well above the terrain line (usually ~82%). Use 46%-64%.
          const yMin = viewHpx * 0.46;
          const yMax = viewHpx * 0.64;
          sy = yMin + Math.random() * Math.max(8, (yMax - yMin));
          vy = (Math.random() - 0.5) * speed * 0.2;
        } else {
          // Periodic ambient spawns from off-screen left/right within a safe sky band
          const fromLeft = Math.random() < 0.5;
          sx = fromLeft ? -120 : viewWpx + 120;
          vx = fromLeft ? speed : -speed;
          const yMin = viewHpx * 0.28;
          const yMax = viewHpx * 0.62;
          sy = yMin + Math.random() * (yMax - yMin);
          vy = (Math.random() - 0.5) * speed * 0.25;
        }

        bgSats.push({ x: sx, y: sy, vx, vy, life: 0, max: 9 + Math.random() * 8, scale, rot: Math.random() * Math.PI * 2, rotV: -0.8 + Math.random() * 1.6 });
      };

      // Only spawn satellites in non-cavern levels
      if (mode !== "caverns") {
        // Ensure two satellites visible per level: one standard and one larger (up to 4x)
        spawnBgSat(true, 0.25, "left");
        spawnBgSat(true, 0.25 * (1 + Math.random() * 3), "right");
      }

    // Rumble state for gamepad thrust
    let thrustHold = 0; // seconds held
    let rumbleNext = 0; // next time to send a rumble pulse (ms timestamp)

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000); // clamp dt
      lastDtForCam = dt;
      last = now;

      frameCount++;
      if (now - lastFpsUpdate >= 500) {
        setFps((frameCount * 1000) / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;
      }
      if (paused || !running) {
        render();
        return;
      }
      elapsed += dt;
      if (elapsed >= nextShooting) { spawnShooting(); nextShooting = elapsed + (0.6 + Math.random() * 1.6); }
      if (elapsed >= nextBgSat && mode !== "caverns") {
        nextBgSat = elapsed + (5 + Math.random() * 7);
        // ensure periodic spawn
        spawnBgSat(false);
      }

      // Controls
      // Gamepad hot-swap + read UI/analog
      let gpLeft = false, gpRight = false, gpThrust = 0;
      {
        const gp = anyGamepad?.();
        if (gp && gp.connected) {
          if (gpDeviceIdRef.current !== gp.id) {
            gpDeviceIdRef.current = gp.id;
            setLastDeviceId(gp.id);
            gpProfileRef.current = loadProfile(gp.id);
          }
          const input = readGamepad(gp, gpProfileRef.current);
          // Digital thrust is instant
          gpThrust = input.thrust;
          // Apply analog rotation only when no digital rotation pressed
          gpLeft = input.buttons.rotateLeft;
          gpRight = input.buttons.rotateRight;
          if (!gpLeft && !gpRight) {
            if (Math.abs(input.rotation) > 0.0001) {
              av += input.rotation * rotAccel * dt;
            }
          }
          // Pause on rising edge
          if (input.buttons.pause && !lastPauseDown.current) {
            setPaused((p) => !p);
          }
          lastPauseDown.current = input.buttons.pause;
          // Abort assist latch on press
          if (input.buttons.abort && !lastAbortDown.current) {
            abortAssist.current = true;
            keys.current.abort = true;
          }
          if (!input.buttons.abort && lastAbortDown.current) {
            keys.current.abort = false;
          }
          lastAbortDown.current = input.buttons.abort;
        }
      }

      // Gamepad thrust rumble ramp (0 -> 2.5s -> max)
      const gpThrusting = gpThrust > 0.001;
      if (gpThrusting) thrustHold += dt; else thrustHold = 0;
      if (gpThrusting) {
        const t = Math.min(1, thrustHold / 2.5);
        if (now >= rumbleNext) {
          try { void vibrate(120, 0.05 + 0.35 * t, 0.1 + 0.9 * t); } catch {}
          rumbleNext = now + 100;
        }
      } else {
        rumbleNext = now;
      }

      let thrust = Math.max(
        gpThrust,
        thrustAnalog.current,
        keys.current.thrust ? 1 : 0
      );
      if (thrust > 0) {
        if (fuel > 0) {
          // Lift-off assist: when first thrusting from a static start-pad rest in caverns
          if (isCavernLevel) {
            const cav = terrain as CavernData;
            const pad = terrain.getPadAt(x);
            const nearStartPad = (pad === cav.startPad) && Math.abs(y - (cav.startPad.y - 14)) < 3 && Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2;
            if (lastThrust.current <= 0.001 && thrust > 0.05 && nearStartPad) {
              vy -= 1.1; // small upward impulse to clear the pad
              y -= 2;    // nudge up a bit to avoid re-collision
            }
          }
          const ax = Math.sin(angle) * thrust * (9.8 * 0.7) * dt;
          const ay = -Math.cos(angle) * thrust * (9.8 * 0.7) * dt;
          vx += ax;
          vy += ay;
          fuel -= fuelConsumption * thrust * dt;
          if (fuel <= 0) fuel = 0;
          // particles from engine (spawn at nozzle at lander base) - mobile-optimized count
          const nozzleX = x - Math.sin(angle) * 10;
          const nozzleY = y + Math.cos(angle) * 10;
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            const pa = angle + (Math.random() - 0.5) * 0.6 + Math.PI;
            const sp = 60 + Math.random() * 120 * thrust;
            particles.push({ x: nozzleX, y: nozzleY, vx: Math.sin(pa) * sp, vy: -Math.cos(pa) * sp, life: 0, max: 0.5, color: neonColor });
          }
        }
      }
      audio.current.setThruster(thrust * (fuel > 0 ? 1 : 0));
      lastThrust.current = thrust;
      if (!fuelAlarmLatched && fuel <= 10) { try { audio.current.startFuelAlarm(); } catch {} fuelAlarmLatched = true; }
      
      // Track when fuel first hits 0 and disable anomalies after 3 seconds
      if (fuel <= 0 && fuelDepletedTime < 0) {
        fuelDepletedTime = elapsed;
      }
      if (fuelDepletedTime >= 0 && elapsed - fuelDepletedTime >= 3 && !anomaliesDisabled) {
        anomaliesDisabled = true;
      }
      if (keys.current.left || gpLeft) av -= rotAccel * dt;
      if (keys.current.right || gpRight) av += rotAccel * dt;
      if (!keys.current.left && !keys.current.right && !gpLeft && !gpRight) {
        if (rotFriction) {
          // friction towards zero (easy)
          av *= 0.9;
          if (Math.abs(av) < 0.02) av = 0;
        } else {
          // slight damping in hard to aid recovery without removing free-spin feel
          av *= 0.994; // nudged up from 0.992: slightly trickier than now, still easier than original
          if (Math.abs(av) < 0.006) av = 0;
        }
      }

      // Abort assist: latch until stabilized, then auto-disengage
      if ((keys.current.abort || abortAssist.current) && fuel > 0) {
        // Upright and hover assist
        angle = 0; av = 0; // recenter rotation
        const THRUST_ACCEL = 9.8;
        const hoverThrust = Math.min(1, (gravity * 60) / THRUST_ACCEL);
        thrustAnalog.current = Math.max(thrustAnalog.current, hoverThrust);
        // Apply upward impulse to counter descent quickly
        if (vy > 0) vy -= Math.min(vy, 180 * dt);
        fuel -= 25 * dt;
        cameraShake = Math.max(cameraShake, 8);
        audio.current.abort();
        // Auto turn off when stabilized
        const stabilized = Math.abs(angle) < 0.08 && Math.abs(av) < 0.05 && Math.abs(vx) < 8 && vy < 8;
        if (stabilized) {
          abortAssist.current = false;
          keys.current.abort = false;
          thrustAnalog.current = 0;
        }
      }

      angle += av * dt;

      // Physics integration - only if not resting on start pad
      const onStartPad = isCavernLevel &&
        Math.abs(vx) < 0.15 && Math.abs(vy) < 0.15 && 
        Math.abs(y - (terrain as CavernData).startPad.y + 14) < 2 &&
        x >= (terrain as CavernData).startPad.xStart && 
        x <= (terrain as CavernData).startPad.xEnd &&
        !(keys.current.thrust || thrustAnalog.current > 0.05);

      if (!onStartPad) {
        // Apply gravity only when not resting on start pad
        vy += gravity * 60 * dt;
        
        // Air resistance
        const drag = 0.998;
        vx *= Math.pow(drag, dt * 60);
        vy *= Math.pow(drag, dt * 60);

        // Update position
        x = wrapX(x + vx * dt * 60);
        y += vy * dt * 60;
      } else {
        // Keep lander perfectly still on start pad
        vx = 0;
        vy = 0;
      }

      // Update moving hazards in non-cavern levels
      if (!isCavernLevel) { updateHazards(hazards, dt, terrain.worldWidth, BASE_HEIGHT); }
      // Hazard collisions (airborne)
      if (!crashed && checkHazardCollision(hazards, x, y, 10)) {
        running = false;
        crashed = true;
        spawnExplosion();
        spawnDebris();
        audio.current.explosion();
        audio.current.stopThruster();
        try { audio.current.stopFuelAlarm(); } catch {}
        cameraShake = 24;
        if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
        setTimeout(() => {
          onGameOver({ score, landings, cause: "crash", difficulty, elapsed });
        }, 700);
      }

      // Collision check against terrain or cavern
      let collisionDetected = false;
      
      if (isCavernLevel) {
        // Cavern collision using custom collision detection
        const cavernData = terrain as CavernData;
        collisionDetected = cavernData.checkCollision(x, y, 8);
      } else {
        // Normal terrain collision
        const ground = terrain.getHeightAt(x);
        const foot = y + 8; // lander foot approximation
        collisionDetected = foot >= ground;
      }
      
      if (collisionDetected) {
        const pad = terrain.getPadAt(x);
        const okAngle = Math.abs(angle) < (difficulty === "easy" ? 0.18 : 0.12); // ~10deg or ~7deg
        const okVy = Math.abs(vy) < (difficulty === "easy" ? 1.8 : 1.2);
        const okVx = Math.abs(vx) < (difficulty === "easy" ? 1.5 : 1.0);

        if (isCavernLevel) {
           const cav = terrain as CavernData;
            // Allow settling on the start pad without completing the mission
            if (pad === cav.startPad && okAngle && okVy && okVx) {
              // Gentle landing on start pad - rest slightly higher for clean lift-off
              if (vy > 0.05) { // Only stop if actually descending
                y = pad.y - 14;
                vy = 0; 
                // Do not lock vx, av, or angle — allow immediate takeoff with light thrust
              }
              // Do NOT end the run here; simply rest on the start pad
          } else if (pad === cav.endPad && okAngle && okVy && okVx && fuel >= 0) {
            // successful landing ONLY on cavern end pad
            y = pad.y - 10;
            vy = 0; vx = 0; av = 0; angle = 0;
            const finesse = Math.floor(200 * (1 - Math.max(Math.abs(vx), Math.abs(vy)) / 2));
            let earned = Math.max(50, Math.floor(pad.multiplier * 150 + finesse));
            const applied2x = !!pad.bonus2x;
            if (applied2x) earned *= 2;
            const pWidth = pad.width ?? (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
            const pCenter = (pad.xEnd >= pad.xStart)
              ? (pad.xStart + pad.xEnd) / 2
              : ((pad.xStart + (pad.xEnd + terrain.worldWidth)) / 2) % terrain.worldWidth;
            let dx = (x - pCenter + terrain.worldWidth / 2) % terrain.worldWidth; dx -= terrain.worldWidth / 2;
            const bullseye = Math.abs(dx) <= pWidth * 0.03;
            if (bullseye) { earned += 500; bullseyeT = 0; }
            const speedBonus = elapsed < 10;
            if (speedBonus) { earned += 500; }
            score += earned;
            landings += 1;
            cameraShake = 6;
            audio.current.success();
            audio.current.stopThruster();
            try { audio.current.stopFuelAlarm(); } catch {}
            if (gpProfileRef.current?.vibration && bullseye) { try { void vibrate(140, 0.2, 0.7); } catch {} }
            running = false;
            setTimeout(() => {
              onGameOver({ score, landings, cause: "success", difficulty, elapsed, lastEarned: earned, padBonus2x: applied2x, bullseye, speedBonus });
            }, 500);
          } else {
            // crash on cavern walls/floor or invalid landing
            running = false;
            crashed = true;
            spawnExplosion();
            spawnDebris();
            audio.current.explosion();
            audio.current.stopThruster();
            try { audio.current.stopFuelAlarm(); } catch {}
            cameraShake = 24;
            if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
            setTimeout(() => {
              onGameOver({ score, landings, cause: fuel <= 0 ? "fuel" : "crash", difficulty, elapsed });
            }, 700);
          }
        } else if (pad && okAngle && okVy && okVx && fuel >= 0) {
          // successful landing - end run (non-cavern levels)
          y = pad.y - 8;
          vy = 0; vx = 0; av = 0; angle = 0;
          const finesse = Math.floor(200 * (1 - Math.max(Math.abs(vx), Math.abs(vy)) / 2));
          let earned = Math.max(50, Math.floor(pad.multiplier * 150 + finesse));
          const applied2x = !!pad.bonus2x;
          if (applied2x) earned *= 2;
          const pWidth = pad.width ?? (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
          const pCenter = (pad.xEnd >= pad.xStart)
            ? (pad.xStart + pad.xEnd) / 2
            : ((pad.xStart + (pad.xEnd + terrain.worldWidth)) / 2) % terrain.worldWidth;
          let dx = (x - pCenter + terrain.worldWidth / 2) % terrain.worldWidth; dx -= terrain.worldWidth / 2;
          const bullseye = Math.abs(dx) <= pWidth * 0.03;
          if (bullseye) { earned += 500; bullseyeT = 0; }
          const speedBonus = elapsed < 10;
          if (speedBonus) { earned += 500; }
          score += earned;
          landings += 1;
          cameraShake = 6;
          audio.current.success();
          audio.current.stopThruster();
          try { audio.current.stopFuelAlarm(); } catch {}
          if (gpProfileRef.current?.vibration && bullseye) { try { void vibrate(140, 0.2, 0.7); } catch {} }
          running = false;
          setTimeout(() => {
            onGameOver({ score, landings, cause: "success", difficulty, elapsed, lastEarned: earned, padBonus2x: applied2x, bullseye, speedBonus });
          }, 500);
        } else {
          // crash
          running = false;
          crashed = true;
          spawnExplosion();
          spawnDebris();
          audio.current.explosion();
          audio.current.stopThruster();
          try { audio.current.stopFuelAlarm(); } catch {}
          cameraShake = 24;
          if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
          setTimeout(() => {
            onGameOver({ score, landings, cause: fuel <= 0 ? "fuel" : "crash", difficulty, elapsed });
          }, 700);
        }
      }

      // Camera (smoothed tracking and zoom)
      if (isCavernLevel) {
        // Keep lander centered horizontally in caverns
        cameraX = x;
      } else {
        const leadTime = 0.35;
        const targetCamX = wrapX(x + vx * leadTime);
        const w = terrain.worldWidth;
        let wrappedDelta = (targetCamX - cameraX + w / 2) % w;
        if (wrappedDelta < 0) wrappedDelta += w;
        wrappedDelta -= w / 2;
        const camAlpha = 1 - Math.exp(-dt / 0.28);
        cameraX = wrapX(cameraX + wrappedDelta * camAlpha);
      }
      // Effective clearance sampling ahead/behind to reduce terrain jaggle
      const sampleClearance = () => {
        const leadX = wrapX(x + vx * 0.4);
        const offs = [-120, -60, 0, 60, 120];
        let minClr = Infinity;
        for (const o of offs) {
          const gx = wrapX(leadX + o);
          const gy = terrain.getHeightAt(gx);
          const clr = Math.max(0, gy - y);
          if (clr < minClr) minClr = clr;
        }
        return minClr;
      };
      const rawClr = sampleClearance();
      // Exponential smoothing on clearance
      const tau = 1.2; // seconds
      const alphaC = 1 - Math.exp(-dt / tau);
      clearanceEMA += (rawClr - clearanceEMA) * alphaC;
      const effClr = clearanceEMA;

      // For cavern levels, use fixed zoom; for normal levels, use dynamic zoom
      if (isCavernLevel) {
        zoom = 1.2; // Fixed zoom for caverns
      } else {
        // Map clearance to zoom with hysteresis and capped rate of change
        const near = 0, far = 420;
        const tRaw = Math.min(1, Math.max(0, (effClr - near) / (far - near)));
        const s = tRaw * tRaw * (3 - 2 * tRaw);
        let targetZoom = 1.4 * (1 - s) + 1.0 * s;
        if (Math.abs(targetZoom - prevTargetZoom) < 0.015) targetZoom = prevTargetZoom;
        prevTargetZoom = targetZoom;

        const zoomAlpha = 1 - Math.exp(-dt / 1.6);
        const desiredDelta = (targetZoom - zoom) * zoomAlpha;
        const maxRate = 0.28; // units per second
        const maxStep = maxRate * dt;
        zoom += Math.max(-maxStep, Math.min(maxStep, desiredDelta));
      }
      if (cameraShake > 0) cameraShake -= 60 * dt;

      // Particles update
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98; p.vy *= 0.98;
        if (p.life > p.max) particles.splice(i, 1);
      }

      // Debris update with wrapping and terrain bounces
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.life += dt;
        // air drag
        d.vx *= 0.996;
        d.vy = d.vy * 0.996 + gravity * 60 * dt;
        d.x = wrapX(d.x + d.vx * dt);
        d.y += d.vy * dt;
        d.angle += d.av * dt;
        // ground collision/bounce
        const gy = terrain.getHeightAt(d.x);
        if (d.y >= gy - 2) {
          d.y = gy - 2;
          if (Math.abs(d.vy) > 20 || Math.abs(d.vx) > 20) cameraShake = Math.max(cameraShake, 3);
          d.vy = -Math.abs(d.vy) * (0.35 + Math.random() * 0.25);
          d.vx *= 0.78;
          d.av *= 0.8;
          // settle cutoff
          if (Math.abs(d.vy) < 12) d.vy = 0;
          if (Math.abs(d.vx) < 6) d.vx *= 0.95;
        }
        // lifetime
        if (d.life > d.max) debris.splice(i, 1);
      }

      // Shooting stars update
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.life > s.max) shooting.splice(i, 1);
      }
      // Background satellites update (screen-space, no collision)
      for (let i = bgSats.length - 1; i >= 0; i--) {
        const s = bgSats[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.rotV * dt;
        if (s.life > s.max) bgSats.splice(i, 1);
      }
      // Explosion visual timers
      flashT = Math.max(0, flashT - dt);
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life += dt;
        if (sw.life > sw.max) shockwaves.splice(i, 1);
      }
      // Bullseye overlay timer
      if (bullseyeT >= 0) {
        bullseyeT += dt;
        if (bullseyeT > 2.2) bullseyeT = -1;
      }
      updateHud();
      render();
      if (!running && !crashed) cancelAnimationFrame(raf);
    };

    const render = () => {
      const w = c.width, h = c.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.save();
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      const shakeX = (Math.random() - 0.5) * cameraShake;
      const shakeY = (Math.random() - 0.5) * cameraShake;

      ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
      ctx.scale(zoom * dpr, zoom * dpr);

      const viewWidth = w / (zoom * dpr);
      const viewH = h / (zoom * dpr);

      // Account for screen shake so FX aligns exactly with world
      const shakeWorldX = shakeX / (zoom * dpr);
      const shakeWorldY = shakeY / (zoom * dpr);

      // Update camera state for FX renderer (compensate for shake)
      setCameraState({
        cameraX: cameraX - shakeWorldX,
        cameraY: y - shakeWorldY, // Use player world Y (not anchor)
        viewWidth: viewWidth,
        viewHeight: viewH
      });

      // Compute world anchor with smoothing (frame ground near bottom; keep lander visible)
      let anchor: number;
      if (isCavernLevel) {
        // For caverns, keep lander centered vertically
        anchor = -y;
      } else {
        // Normal terrain camera behavior
        let groundAtCam = terrain.getHeightAt(cameraX);
        const desiredGroundY = viewH * 0.82; // target from top in view units
        const groundAnchor = -groundAtCam + (desiredGroundY - viewH / 2);
        const desiredLanderY = viewH * 0.45; // target from top in view units
        const landerAnchor = -y + (desiredLanderY - viewH / 2);
        const anchorTarget = Math.max(groundAnchor, landerAnchor);
        if (camAnchorInit) { smoothedAnchor = anchorTarget; camAnchorInit = false; }
        const aAlpha = 1 - Math.exp(-Math.max(1 / 120, lastDtForCam || 1 / 60) / 0.35);
        smoothedAnchor += (anchorTarget - smoothedAnchor) * aAlpha;
        anchor = smoothedAnchor;
      }

      // Background stars: only for non-cavern levels
      if (!isCavernLevel) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Apply terrain clipping for stars
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w, 0);
        const segs = 96;
        for (let i = segs; i >= 0; i--) {
          const sx = (i / segs) * w;
          const worldX = cameraX + (sx - (w / 2 + shakeX)) / (zoom * dpr);
          const worldY = terrain.getHeightAt(worldX);
          const sy = (h / 2 + shakeY) + (worldY + anchor) * (zoom * dpr);
          ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.clip();
        
        drawStars(ctx, 0, 0, 0);
        ctx.restore();
      }

      // World transform for terrain and gameplay
      ctx.translate(-cameraX, anchor);

      // Draw core composition (mineral formations) behind terrain
      if (isCavernLevel) {
        coreComposition.render(ctx, { x: cameraX, y: y, zoom: zoom });
      }
      
      // Optimized neon settings with state tracking
      ctx.strokeStyle = neonColor as any;
      ctx.shadowColor = neonColor as any;
      ctx.lineWidth = 2;
      const shadowBlur = shouldOptimizePerformance ? SHADOW_BLUR_MOBILE : SHADOW_BLUR_DESKTOP;
      ctx.shadowBlur = shadowBlur;
      
      // Viewport culling bounds
      const viewWCull = w / (zoom * dpr);
      const viewLeft = cameraX - viewWCull / 2;
      const viewRight = cameraX + viewWCull / 2;

      // Terrain/Cavern rendering
      if (isCavernLevel) {
        // Render cavern walls
        const cavernData = terrain as CavernData;
        ctx.save();
        
        // Render each wall
        for (const wall of cavernData.walls) {
          ctx.beginPath();
          for (let i = 0; i < wall.points.length; i++) {
            const p = wall.points[i];
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        
        // Render obstacles
        for (const obstacle of cavernData.obstacles) {
          ctx.beginPath();
          ctx.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          ctx.stroke();
        }
        
        ctx.restore();
      } else {
        // Regular terrain rendering with viewport culling
        const drawTerrain = (offset: number) => {
          // Cull terrain sections outside viewport
          if (offset + terrain.worldWidth < viewLeft || offset > viewRight) return;
          
          ctx.beginPath();
          for (let i = 0; i < terrain.points.length; i++) {
            const p = terrain.points[i];
            if (i === 0) ctx.moveTo(p.x + offset, p.y);
            else ctx.lineTo(p.x + offset, p.y);
          }
          // Ensure the last segment connects to the first for perfect seam
          ctx.lineTo(terrain.points[0].x + offset + terrain.worldWidth, terrain.points[0].y);
          ctx.stroke();
        };
        drawTerrain(-terrain.worldWidth);
        drawTerrain(0);
        drawTerrain(terrain.worldWidth);
      }

      // Pads (mobile-optimized rendering)
      for (const pad of terrain.pads) {
        const pulse = 1 + 0.6 * Math.sin(elapsed * 4 + pad.xStart * 0.01);
        const width = pad.width ?? (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
        const center = (pad.xEnd >= pad.xStart)
          ? (pad.xStart + pad.xEnd) / 2
          : ((pad.xStart + (pad.xEnd + terrain.worldWidth)) / 2) % terrain.worldWidth;
        
        for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
          // Viewport culling for pads
          const padLeft = Math.min(pad.xStart, pad.xEnd) + offset;
          const padRight = Math.max(pad.xStart, pad.xEnd) + offset;
          if (padRight < viewLeft || padLeft > viewRight) continue;
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pad.xStart + offset, pad.y);
          ctx.lineTo(pad.xEnd + offset, pad.y);
          
          if (shouldOptimizePerformance) {
            // Simplified mobile rendering
            ctx.strokeStyle = neonColor as any;
            ctx.globalAlpha = 0.8;
            ctx.lineWidth = 4 * pulse;
            ctx.shadowBlur = SHADOW_BLUR_MOBILE;
            ctx.stroke();
          } else {
            // Full quality desktop rendering
            // Outer glow
            ctx.strokeStyle = neonColor as any;
            ctx.globalAlpha = 0.6;
            ctx.lineWidth = 6 * pulse;
            ctx.shadowBlur = 36;
            ctx.stroke();
            // Core line
            ctx.globalAlpha = 1;
            ctx.lineWidth = 3 * pulse;
            ctx.shadowBlur = 24;
            ctx.stroke();
          }

          // Bonus label
          if (pad.bonus2x) {
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.font = `700 12px \"Orbitron\", sans-serif`;
            ctx.shadowColor = neonColor as any;
            ctx.shadowBlur = 18;
            ctx.strokeStyle = neonColor as any;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.95;
            ctx.strokeText("2x", center + offset, pad.y + 8);
            ctx.globalAlpha = 1;
            ctx.restore();
          }

          ctx.restore();
        }
      }

      // Wind vectors and anomaly hints
      if (WIND_ENABLED) drawWindVectors(ctx, windZones, terrain.worldWidth, elapsed, neonColor);
      drawAnomaliesField(ctx, anomalies, elapsed, neonColor);
      // Moving hazards
      drawHazards(ctx, hazards, neonColor);

      // Lander
      if (!crashed) {
        for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
          ctx.save();
          ctx.translate(x + offset, y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(8, 10);
          ctx.lineTo(-8, 10);
          ctx.closePath();
          ctx.strokeStyle = neonColor as any;
          ctx.lineWidth = 2;
          ctx.stroke();

          // legs
          ctx.beginPath();
          ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);
          ctx.moveTo(6, 8); ctx.lineTo(12, 12);
          ctx.stroke();

          // engine flame if thrust
          if (lastThrust.current > 0 && fuel > 0) {
            ctx.beginPath();
            ctx.moveTo(-3, 10);
            ctx.lineTo(0, 16 + Math.random() * 8);
            ctx.lineTo(3, 10);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Debris shards (varied shapes)
      for (const d of debris) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.beginPath();
        const s = d.size;
        if (d.kind === "rod") {
          ctx.moveTo(-s * 3, -s * 0.4);
          ctx.lineTo(s * 3, -s * 0.4);
          ctx.lineTo(s * 3, s * 0.4);
          ctx.lineTo(-s * 3, s * 0.4);
          ctx.closePath();
        } else if (d.kind === "plate") {
          ctx.moveTo(-s, -s * 0.8);
          ctx.lineTo(s * 1.2, -s * 0.3);
          ctx.lineTo(s * 0.3, s * 1.3);
          ctx.lineTo(-s * 1.1, s * 0.4);
          ctx.closePath();
        } else {
          // chip - small triangle
          ctx.moveTo(-s, -s * 0.6);
          ctx.lineTo(s * 0.9, -s * 0.2);
          ctx.lineTo(-s * 0.2, s);
          ctx.closePath();
        }
        ctx.strokeStyle = neonColor as any;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
      }

      // Particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.strokeStyle = p.color as any;
        ctx.lineWidth = 1.8;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      }

      // Screen-space overlays
      if (bullseyeT >= 0) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const T = 2.0;
        const t = Math.min(1, bullseyeT / T);
        const scaleAmt = 0.85 + Math.sin(Math.PI * t) * 0.6;
        const alpha = 1 - Math.abs(2 * t - 1);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scaleAmt, scaleAmt);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 42px \"Orbitron\", sans-serif`;
        ctx.shadowColor = neonColor as any;
        ctx.shadowBlur = 28;
        ctx.globalAlpha = 0.85 * alpha;
        ctx.strokeStyle = neonColor as any;
        ctx.lineWidth = 4 * dpr;
        ctx.strokeText("500 POINT BULLSEYE", 0, 0);
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      ctx.restore();
    };

    const drawStars = (ctx: CanvasRenderingContext2D, _offsetX: number, _viewW: number, _viewH: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wpx = ctx.canvas.width / dpr;
      const hpx = ctx.canvas.height / dpr;
      ctx.save();
      ctx.shadowColor = neonColor as any;
      ctx.shadowBlur = 6;
      ctx.fillStyle = neonColor as any;
      // Map CSS px to device px
      ctx.scale(dpr, dpr);
      // Static twinkling stars in screen space
      for (const s of stars) {
        const a = s.baseA * (0.7 + 0.3 * Math.sin(s.ph + elapsed * s.tw));
        ctx.globalAlpha = Math.min(1, Math.max(0.25, a));
        const x = (s.x % wpx + wpx) % wpx;
        const y = Math.max(0, Math.min(hpx, s.y));
        ctx.fillRect(x, y, s.size, s.size);
      }
      ctx.globalAlpha = 1;
      // Shooting stars
      for (const sh of shooting) {
        const t = 1 - Math.min(1, sh.life / sh.max);
        ctx.globalAlpha = t;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 0.06, sh.y - sh.vy * 0.06);
        ctx.lineWidth = 2;
        ctx.strokeStyle = neonColor as any;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Background small satellites
      for (const s of bgSats) {
        const tScale = s.scale;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.scale(tScale, tScale);
        ctx.strokeStyle = neonColor as any;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(-6, -2, 12, 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(-16, -3, 8, 6);
        ctx.rect(8, -3, 8, 6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    raf = requestAnimationFrame(loop);
    const hudTimer = setInterval(updateHud, 120);

    return () => { cancelAnimationFrame(raf); clearInterval(hudTimer); audio.current.stopThruster(); try { audio.current.stopFuelAlarm(); } catch {} try { audio.current.stopLevelMusic(); } catch {} };
  }, [difficulty, onGameOver, paused, level, mode]);

  return (
    <section className="relative h-[calc(100vh-0px)] w-full select-none">
      <div ref={containerRef} className="absolute inset-0 select-none">
        <canvas ref={canvasRef} className="block w-full h-full select-none" />
        {((showCavernFX && mode === "caverns") || hasRandomEffects) && (
          <CavernFXRenderer
            cavernData={cavernBakeResult}
            enabled={showCavernFX || hasRandomEffects}
            cameraX={cameraState.cameraX}
            cameraY={cameraState.cameraY}
            viewWidth={cameraState.viewWidth}
            viewHeight={cameraState.viewHeight}
            params={randomEffectParams || cavernFXParams}
          />
        )}
      </div>

      {isTouch && (
        <div
          className="absolute inset-0 z-10 touch-none select-none"
          onTouchStart={(e) => { 
            e.preventDefault(); 
            if (e.touches.length > 0) { 
              keys.current.thrust = true; 
              audio.current.resume(); 
            } 
          }}
          onTouchEnd={(e) => { 
            e.preventDefault(); 
            keys.current.thrust = false; 
          }}
          onTouchCancel={(e) => { 
            e.preventDefault(); 
            keys.current.thrust = false; 
          }}
        />
      )}

      <HUD {...hud} />

      <div className="pointer-events-none absolute bottom-2 right-3 z-40">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded px-2 py-1 text-[10px] font-mono text-muted-foreground">
          FPS: {Math.round(fps)}
        </div>
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-3 select-none">
        <div className="flex gap-2">
          <Button 
            variant="neon" 
            className="select-none"
            onMouseDown={() => (keys.current.left = true)} 
            onMouseUp={() => (keys.current.left = false)} 
            onMouseLeave={() => (keys.current.left = false)}
            onTouchStart={(e) => { e.preventDefault(); keys.current.left = true; }} 
            onTouchEnd={(e) => { e.preventDefault(); keys.current.left = false; }}
            onTouchCancel={(e) => { e.preventDefault(); keys.current.left = false; }}
          >
            <span className="select-none">Rotate ◄</span>
          </Button>
          <Button 
            variant="neon" 
            className="select-none"
            onMouseDown={() => (keys.current.right = true)} 
            onMouseUp={() => (keys.current.right = false)} 
            onMouseLeave={() => (keys.current.right = false)}
            onTouchStart={(e) => { e.preventDefault(); keys.current.right = true; }} 
            onTouchEnd={(e) => { e.preventDefault(); keys.current.right = false; }}
            onTouchCancel={(e) => { e.preventDefault(); keys.current.right = false; }}
          >
            <span className="select-none">Rotate ►</span>
          </Button>
          <Button 
            variant="destructive" 
            className="select-none"
            onMouseDown={() => { keys.current.abort = true; abortAssist.current = true; }} 
            onMouseUp={() => (keys.current.abort = false)} 
            onMouseLeave={() => (keys.current.abort = false)}
            onTouchStart={(e) => { e.preventDefault(); keys.current.abort = true; abortAssist.current = true; }} 
            onTouchEnd={(e) => { e.preventDefault(); keys.current.abort = false; }}
            onTouchCancel={(e) => { e.preventDefault(); keys.current.abort = false; }}
          >
            <span className="select-none">Abort</span>
          </Button>
        </div>
      </div>

      {/* Top controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 select-none">
        <Button variant="hero" className="select-none" onClick={() => setPaused((p) => !p)}><span className="select-none">{paused ? "Resume" : "Pause"}</span></Button>
        <Button variant="outline" className="select-none" onClick={onExit}><span className="select-none">Exit</span></Button>
      </div>
    </section>
  );
};
