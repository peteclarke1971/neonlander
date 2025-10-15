import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SurvivalHUD } from "./SurvivalHUD";
import { AudioManager } from "./AudioManager";
import { SurvivalGameOverData } from "./types/survival";
import { EndlessTerrainGenerator, TerrainChunk } from "./systems/endlessTerrain";
import { movingPadSystem } from "./systems/movingPads";
import { MovingPad, Volcano } from "./types";
import { anyGamepad, readGamepad, loadProfile, vibrate, getLastDeviceId, setLastDeviceId } from "@/hooks/use-gamepad";
import { updateVolcanoes, drawVolcanoes, checkVolcanoParticleCollision, VolcanoParticle } from "./systems/volcano";
import { anomalyAccelAt, drawAnomaliesField, Anomaly } from "./systems/anomalies";
import { DEFAULT_ROTATION_MOD_CONFIG, updateRotationModifier, applyRotationModifier, RotationModConfig } from "./systems/rotationMod";
import { CursorManager } from "@/lib/cursorManager";
import { loadCursorConfig } from "@/lib/cursorConfig";
import FireworksDisplay from "./FireworksDisplay";
import { useGyroscope, DEFAULT_GYROSCOPE_CONFIG } from "@/hooks/use-gyroscope";
import { generateHazards, updateHazards, drawHazards, checkHazardCollision, Hazard } from "./systems/hazards";
import { checkJunkPickup, collectJunk } from "./systems/collectibles";
import { renderSpaceJunk, generateSparkles, updateSparkles, SparkleEffect } from "./systems/spaceJunkAssets";
import { initAsteroidField, updateAsteroidField, renderAsteroidField, AsteroidFieldState } from "./systems/asteroidField";

interface Props {
  onGameOver: (data: SurvivalGameOverData) => void;
  lowGraphics?: boolean;
}

const BASE_HEIGHT = 360;
const AMPLITUDE = 180;
const CHUNK_WIDTH = 2000;

export const SurvivalEngine: React.FC<Props> = ({ 
  onGameOver, 
  lowGraphics = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [fps, setFps] = useState(0);
  
  // Gyroscope controls
  const [gyroConfig, setGyroConfig] = useState(DEFAULT_GYROSCOPE_CONFIG);
  const gyroscope = useGyroscope(gyroConfig);
  const gyroRotationRef = useRef(0);
  
  // Game state
  const [distance, setDistance] = useState(0);
  const [landings, setLandings] = useState(0);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);
  
  // HUD state
  const [altitude, setAltitude] = useState(0);
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [fuel, setFuel] = useState(200);
  const fuelCap = 200;
  
  // Volcano particles state (persistent between frames)
  const [volcanoParticles, setVolcanoParticles] = useState<VolcanoParticle[]>([]);
  
  // Bonus streak tracking (internal refs to avoid re-renders)
  const bullseyeStreakRef = useRef(0);
  const speedBonusStreakRef = useRef(0);
  
  // Message queue for displaying multiple bonuses sequentially
  const messageQueueRef = useRef<string[]>([]);
  const currentMessageIndexRef = useRef(0);
  const messageTimerRef = useRef(0);
  
  // Timer state for speed bonus calculation
  const [timerActive, setTimerActive] = useState(false);
  const timerActiveRef = useRef(false);
  const lastTakeoffTime = useRef<number>(0);
  
  // Hazards and collectibles state
  const hazardsRef = useRef<Hazard[]>([]);
  const sparklesRef = useRef<Map<string, SparkleEffect[]>>(new Map());
  
  // Asteroid field state
  const asteroidFieldRef = useRef<AsteroidFieldState | null>(null);
  const asteroidFieldCountRef = useRef(0); // Track completed asteroid fields
  const fieldWarningShownRef = useRef(false);
  const [fieldMessage, setFieldMessage] = useState<string>("");
  const [fieldMessageTimer, setFieldMessageTimer] = useState(0);
  
  // Shield state
  const shieldActiveRef = useRef(false);
  const [shieldActive, setShieldActive] = useState(false);
  const shieldTimerRef = useRef(0);
  const SHIELD_DURATION = 75;
  
  // Invulnerability state (after shield breaks)
  const invulnerableRef = useRef(false);
  const invulnerableTimerRef = useRef(0);
  const INVULNERABLE_DURATION = 0.75; // seconds
  
  const keys = useRef({ left: false, right: false, thrust: false, rotateBoost: false });
  const audio = useRef(new AudioManager());
  
  // Gamepad state
  const gamepadRef = useRef<Gamepad | null>(null);
  const profileRef = useRef(loadProfile(getLastDeviceId()));
  const gpDeviceIdRef = useRef<string | null>(getLastDeviceId());
  const rotBoostActive = useRef(0);
  const gamepadInputRef = useRef<any>(null);
  
  // Cursor management
  const cursorManagerRef = useRef<CursorManager>();
  
  // Fireworks state
  const [showFireworks, setShowFireworks] = useState(false);
  const [fireworksActive, setFireworksActive] = useState(false);
  const [landingType, setLandingType] = useState<'regular' | 'moving' | '2x' | null>(null);
  const fireworkTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  
  // Detect touch-capable devices
  useEffect(() => {
    try {
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints ?? 0) > 0 || (navigator as any).msMaxTouchPoints > 0;
      setIsTouch(!!hasTouch);
      
      // Enable gyroscope on mobile devices by default
      if (hasTouch) {
        setGyroConfig(prev => ({ ...prev, enabled: true }));
      }
    } catch {
      setIsTouch(false);
    }
  }, []);
  
  // Update gyro rotation ref when gyroscope state changes
  useEffect(() => {
    if (gyroscope.isActive) {
      gyroRotationRef.current = gyroscope.rotationInput;
    } else {
      gyroRotationRef.current = 0;
    }
  }, [gyroscope.rotationInput, gyroscope.isActive]);
  
  // Handle gyroscope enable request
  const handleEnableGyro = async () => {
    await gyroscope.requestPermission();
  };
  
  // Handle gyroscope calibration
  const handleCalibrateGyro = () => {
    gyroscope.calibrate();
  };
  
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
  
  // Cursor management
  useEffect(() => {
    if (!containerRef.current) return;
    
    const cursorConfig = loadCursorConfig();
    cursorManagerRef.current = new CursorManager(cursorConfig);
    
    cursorManagerRef.current.attach(
      containerRef.current,
      () => !paused, // Hide cursor when not paused (during gameplay)
      'global'
    );
    
    return () => {
      cursorManagerRef.current?.detach();
    };
  }, [paused]);
  
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      // Use same keyboard controls as main game
      if (["a", "arrowleft"].includes(k)) keys.current.left = down;
      if (["d", "arrowright"].includes(k)) keys.current.right = down;
      if (["w", "arrowup", " "].includes(k)) keys.current.thrust = down;
      if (["shift"].includes(k)) keys.current.rotateBoost = down;
      if (down) audio.current.resume();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);
  
  useEffect(() => {
    let raf = 0;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const styles = getComputedStyle(document.documentElement);
    const neonColor = `hsl(${styles.getPropertyValue('--neon')})`;
    
    // Initialize endless terrain generator
    const seed = Math.floor(Math.random() * 1e9);
    const terrainGen = new EndlessTerrainGenerator({
      chunkWidth: CHUNK_WIDTH,
      baseHeight: BASE_HEIGHT,
      amplitude: AMPLITUDE,
      seed
    });
    
    // Generate initial chunks - first chunk is special starting chunk
    const chunks: TerrainChunk[] = [];
    chunks.push(terrainGen.generateChunk(0, true)); // First chunk with guaranteed starting pad
    for (let i = 1; i < 3; i++) {
      chunks.push(terrainGen.generateChunk(0));
    }
    
    // Initialize hazards and collectibles from chunks
    hazardsRef.current = [];
    chunks.forEach(chunk => {
      if (chunk.hazards) {
        hazardsRef.current.push(...chunk.hazards);
      }
      if (chunk.collectibles) {
        chunk.collectibles.spaceJunk.forEach(junk => {
          sparklesRef.current.set(junk.id, generateSparkles(junk.seed));
        });
      }
    });
    
    // Place ship on first landing pad (guaranteed to exist and be suitable)
    const firstPad = chunks[0].pads[0];
    let shipX = (firstPad.xStart + firstPad.xEnd) / 2;
    let shipY = firstPad.y - 12; // Position exactly on the pad
    let shipVx = 0;
    let shipVy = 0;
    let shipAngle = 0;
    let shipAngularVel = 0;
    let fuelAmount = 200;
    let currentScore = 0;
    let currentLandings = 0;
    let currentDistance = 0;
    let currentTime = 0;
    let isDead = false;
    let isLanded = true; // Start landed on the pad
    let landedPad: any = firstPad; // Track starting pad
    let padToClear: any = null; // Track pad to remove after clearing
    let hasMovedFromStart = false; // Prevent scoring on starting pad
    
    // Thruster particles
    type ThrusterParticle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
    const thrusterParticles: ThrusterParticle[] = [];
    
    // Explosion particles
    type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
    const particles: Particle[] = [];
    
    // Debris (lander shards on crash)
    type Debris = { x: number; y: number; vx: number; vy: number; angle: number; av: number; life: number; max: number; size: number; kind: "plate" | "rod" | "chip" };
    const debris: Debris[] = [];
    
    // Shockwave rings and flash on big explosions
    type Shockwave = { x: number; y: number; life: number; max: number };
    const shockwaves: Shockwave[] = [];
    let flashT = 0; // screen flash
    let bullseyeT = -1; // overlay timer for bullseye/speed bonus text
    let bonusText = ""; // text to display for bonus
    
    // Starfield system (matching main game) - arrays declared here, initialized later
    type Star = { x: number; y: number; size: number; baseA: number; tw: number; ph: number; bright: boolean };
    type Shooting = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    type BgSat = { x: number; y: number; vx: number; vy: number; life: number; max: number; scale: number; rot: number; rotV: number };
    const stars: Star[] = [];
    const shooting: Shooting[] = [];
    const bgSats: BgSat[] = [];
    let nextShooting = 0.6 + Math.random() * 1.6;
    let nextBgSat = 5 + Math.random() * 7;
    
    // Camera
    let cameraX = 0;
    let cameraShake = 0;
    
    // Camera and zoom system (matching main game)
    let smoothedAnchor = 0;
    let camAnchorInit = true;
    let zoom = 1.0;
    let clearanceEMA = 220;
    let prevTargetZoom = 1.0;
    
    // Start level audio
    try { audio.current.preloadSFX(); } catch {}
    audio.current.stopAllAudio();
    audio.current.playLevelTrackForLevel(0);
    
    // Physics constants matching main game (EASY MODE)
    const GRAVITY = 0.02 * 0.75; // 0.015
    const ROTATION_ACCEL = 2.2 * 1.15; // Easy mode rotation (base value)
    const THRUST_ACCEL = 9.8 * 0.7; // 6.86
    const FUEL_BURN = 22; // Easy mode fuel consumption
    
    // Rotation modifier system (matching main game)
    const rotModConfig: RotationModConfig = DEFAULT_ROTATION_MOD_CONFIG;
    
    // Performance optimization
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const shouldOptimize = isMobile || lowGraphics;
    const THRUSTER_PARTICLE_COUNT = shouldOptimize ? 2 : 25;
    
    // World width for spatial audio (3 chunks visible at once)
    const WORLD_WIDTH = CHUNK_WIDTH * 3;
    
    const dprInit = shouldOptimize ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const getViewWidth = () => c.width / dprInit;
    const getViewHeight = () => c.height / dprInit;
    
    // Initialize starfield (canvas-space stars) - use full canvas dimensions
    const STAR_COUNT = shouldOptimize ? 120 : 320;
    for (let i = 0; i < STAR_COUNT; i++) {
      const sx = Math.random() * c.width;
      const sy = Math.random() * c.height;
      const bright = Math.random() < 0.15;
      stars.push({ 
        x: sx, 
        y: sy, 
        size: bright ? (2.4 * dprInit) : (1.4 * dprInit), 
        baseA: bright ? 0.95 : 0.6, 
        tw: 0.5 + Math.random() * 1.5, 
        ph: Math.random() * Math.PI * 2, 
        bright 
      });
    }
    
    // Shooting star spawner - use full canvas dimensions
    const spawnShooting = () => {
      const margin = 80 * dprInit;
      let sx = 0, sy = 0, vx = 0, vy = 0;
      const side = Math.floor(Math.random() * 3);
      if (side === 0) {
        sx = -margin; sy = Math.random() * (c.height * 0.7);
        vx = (180 + Math.random() * 260) * dprInit; vy = (Math.random() - 0.5) * 140 * dprInit;
      } else if (side === 1) {
        sx = c.width + margin; sy = Math.random() * (c.height * 0.7);
        vx = -(180 + Math.random() * 260) * dprInit; vy = (Math.random() - 0.5) * 140 * dprInit;
      } else {
        sx = Math.random() * c.width; sy = -margin;
        vx = (Math.random() - 0.5) * 280 * dprInit; vy = (160 + Math.random() * 220) * dprInit;
      }
      shooting.push({ x: sx, y: sy, vx, vy, life: 0, max: 0.6 + Math.random() * 1.0 });
    };
    
    // Background satellite spawner - use full canvas dimensions
    // Shield break effect (prismatic particle burst)
    const spawnShieldBreak = (cx: number, cy: number) => {
      // Concentric ring bursts
      for (let ring = 0; ring < 3; ring++) {
        const ringDelay = ring * 30;
        setTimeout(() => {
          shockwaves.push({
            x: cx,
            y: cy,
            life: 0,
            max: 0.4
          });
        }, ringDelay);
      }
      
      // Prismatic particle shards
      const shardCount = shouldOptimize ? 8 : 40;
      for (let i = 0; i < shardCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 100 + Math.random() * 200;
        const hue = 260 + Math.random() * 60; // Purple to cyan
        
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0,
          max: 0.6 + Math.random() * 0.4,
          color: `hsla(${hue}, 100%, ${60 + Math.random() * 30}%, 1)`
        });
      }
      
      flashT = 0.25;
      cameraShake += 2;
    };
    
    // Spectacular explosion helper functions
    const spawnExplosion = (cx: number, cy: number) => {
      // Primary explosion wave (reduce count for low graphics)
      const primaryCount = shouldOptimize ? 12 : (120 + Math.floor(Math.random() * 60));
      for (let i = 0; i < primaryCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 600 + Math.random() * 600; // 3x faster for dramatic expansion
        const size = 2 + Math.random() * 6;
        // Mix of colors: cyan, electric blue, white-hot, orange-red
        const colorChoice = Math.random();
        let color;
        if (colorChoice < 0.3) color = `hsla(${180 + Math.random() * 20},100%,${60 + Math.random() * 20}%,1)`; // Cyan/blue
        else if (colorChoice < 0.5) color = `hsla(0,0%,${90 + Math.random() * 10}%,1)`; // White-hot
        else if (colorChoice < 0.75) color = `hsla(${20 + Math.random() * 15},100%,${55 + Math.random() * 20}%,1)`; // Orange
        else color = `hsla(${0 + Math.random() * 10},100%,${50 + Math.random() * 20}%,1)`; // Red
        
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0,
          max: 1.5 + Math.random() * 1.0, // 2x longer lifetime
          color,
        });
      }
      
      // Secondary fire/smoke layer - delayed spawn
      setTimeout(() => {
        const secondaryCount = shouldOptimize ? 6 : (80 + Math.floor(Math.random() * 40));
        for (let i = 0; i < secondaryCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 180 + Math.random() * 220; // 2.5x faster
          const colorChoice = Math.random();
          let color;
          if (colorChoice < 0.4) color = `hsla(${30 + Math.random() * 15},100%,${50 + Math.random() * 10}%,1)`; // Orange
          else if (colorChoice < 0.7) color = `hsla(${0 + Math.random() * 10},100%,${45 + Math.random() * 15}%,1)`; // Red
          else color = `hsla(${50 + Math.random() * 10},100%,${60 + Math.random() * 10}%,1)`; // Yellow
          
          particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            life: 0,
            max: 2.5 + Math.random() * 1.5, // Longer lifespan
            color,
          });
        }
      }, 100);
      
      // Spark system
      const sparkCount = shouldOptimize ? 5 : (40 + Math.floor(Math.random() * 20));
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 800 + Math.random() * 600; // Much faster for dramatic streaks
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0,
          max: 0.8 + Math.random() * 0.4, // Longer trails
          color: Math.random() < 0.5 ? `hsla(0,0%,100%,1)` : `hsla(${55},100%,80%,1)`, // White or yellow
        });
      }
      
      // Enhanced shockwaves
      const ringCount = shouldOptimize ? 1 : (3 + Math.floor(Math.random() * 2));
      for (let i = 0; i < ringCount; i++) {
        shockwaves.push({ 
          x: cx, 
          y: cy, 
          life: i * 0.05, // Slight delay between rings
          max: 0.7 + i * 0.15 
        });
      }
      
      // Enhanced screen effects
      flashT = Math.max(flashT, 0.45 + Math.random() * 0.15); // 0.45-0.6s flash
      cameraShake = Math.max(cameraShake, 42 + Math.random() * 14); // 42-56 units shake
    };

    const spawnDebris = (cx: number, cy: number, cvx: number, cvy: number) => {
      // Enhanced debris system
      const pieceCount = shouldOptimize ? 6 : (80 + Math.floor(Math.random() * 40));
      for (let i = 0; i < pieceCount; i++) {
        const dir = Math.random() * Math.PI * 2;
        const speed = 220 + Math.random() * 320;
        // More debris types
        const rand = Math.random();
        let kind: Debris["kind"];
        if (rand < 0.35) kind = "plate";
        else if (rand < 0.65) kind = "rod";
        else kind = "chip";
        
        const size = kind === "rod" ? 2 + Math.random() * 4 : 
                     kind === "plate" ? 3 + Math.random() * 8 : 
                     1.5 + Math.random() * 3.5;
        const upwardBoost = Math.random() < 0.5 ? -(120 + Math.random() * 260) : 0;
        debris.push({
          x: cx,
          y: cy,
          vx: Math.cos(dir) * speed + cvx * 0.5,
          vy: Math.sin(dir) * speed + cvy * 0.5 + upwardBoost,
          angle: Math.random() * Math.PI * 2,
          av: (-3 + Math.random() * 6) * (kind === "rod" ? 2.5 : 1.4),
          life: 0,
          max: 3.2 + Math.random() * 5.5,
          size: size,
          kind,
        });
      }
    };
    
    const spawnBgSat = () => {
      const scale = 0.25 * dprInit;
      const speed = (40 + Math.random() * 60) * dprInit;
      const fromLeft = Math.random() < 0.5;
      const sx = fromLeft ? -120 * dprInit : c.width + 120 * dprInit;
      const vx = fromLeft ? speed : -speed;
      const sy = c.height * 0.28 + Math.random() * (c.height * 0.34);
      const vy = (Math.random() - 0.5) * speed * 0.25;
      bgSats.push({ 
        x: sx, 
        y: sy, 
        vx, 
        vy, 
        life: 0, 
        max: 9 + Math.random() * 8, 
        scale, 
        rot: Math.random() * Math.PI * 2, 
        rotV: -0.8 + Math.random() * 1.6 
      });
    };
    
    const getHeightAt = (x: number): number => {
      // Find the chunk this x belongs to
      for (const chunk of chunks) {
        if (x >= chunk.startX && x <= chunk.endX) {
          const localX = x - chunk.startX;
          const segmentWidth = (chunk.endX - chunk.startX) / (chunk.points.length - 1);
          const idx = Math.floor(localX / segmentWidth);
          if (idx >= 0 && idx < chunk.points.length - 1) {
            const t = (localX - idx * segmentWidth) / segmentWidth;
            return chunk.points[idx].y * (1 - t) + chunk.points[idx + 1].y * t;
          }
        }
      }
      return BASE_HEIGHT;
    };
    
    const getPadAt = (x: number, y: number) => {
      for (const chunk of chunks) {
        for (const pad of chunk.pads) {
          if (x >= pad.xStart && x <= pad.xEnd && Math.abs(y - pad.y) < 20) {
            return pad;
          }
        }
      }
      return null;
    };
    
    const getMovingPadAt = (x: number, y: number) => {
      for (const chunk of chunks) {
        for (const mp of chunk.movingPads) {
          if (movingPadSystem.isOnMovingPad(x, y, mp)) {
            return mp;
          }
        }
      }
      return null;
    };
    
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = performance.now();
    
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      
      // FPS counter
      frameCount++;
      if (now - lastFpsUpdate >= 500) {
        const elapsed = (now - lastFpsUpdate) / 1000;
        setFps(Math.round(frameCount / elapsed));
        frameCount = 0;
        lastFpsUpdate = now;
      }
      
      if (paused) return;
      
      // Frame rate limiting with clamped dt (matching main game)
      let dt = (now - lastTime) / 1000;
      lastTime = now;
      
      // Clamp dt to prevent physics issues on lag spikes
      if (dt > 0.1) dt = 0.033; // Cap at ~30fps equivalent
      dt = Math.min(dt, 0.033); // Max 33ms timestep
      
      currentTime += dt;
      setTime(currentTime);
      
      const viewWidth = getViewWidth();
      const viewHeight = getViewHeight();
      
      // Update terrain chunks - generate new chunks as ship moves right
      const rightmostChunk = chunks[chunks.length - 1];
      if (shipX > rightmostChunk.endX - CHUNK_WIDTH) {
        // Calculate difficulty based on distance traveled (accelerated ramp for moving pads)
        const difficulty = Math.min(1, currentDistance / 300);
        const newChunk = terrainGen.generateChunk(difficulty);
        chunks.push(newChunk);
        
        // Add new hazards from this chunk
        if (newChunk.hazards) {
          hazardsRef.current.push(...newChunk.hazards);
        }
        
        // Initialize sparkles for new collectibles
        if (newChunk.collectibles) {
          newChunk.collectibles.spaceJunk.forEach(junk => {
            sparklesRef.current.set(junk.id, generateSparkles(junk.seed));
          });
        }
        
        // Detect asteroid field entry
        if (newChunk.isAsteroidFieldChunk && newChunk.asteroidFieldPhase === "entry" && !asteroidFieldRef.current?.active) {
          const fieldStartX = newChunk.startX;
          const fieldSeed = Date.now() + currentDistance;
          asteroidFieldRef.current = initAsteroidField(fieldStartX, difficulty, fieldSeed, asteroidFieldCountRef.current);
          
          // Show HUD warning
          if (!fieldWarningShownRef.current) {
            setFieldMessage("ENTERING ASTEROID FIELD");
            setFieldMessageTimer(2.0);
            fieldWarningShownRef.current = true;
          }
        }
        
        // Remove old chunks that are far behind (keep more chunks for smooth disappearing)
        if (chunks.length > 8) {
          const oldChunk = chunks.shift();
          
          // Remove hazards from old chunks
          if (oldChunk && oldChunk.hazards) {
            hazardsRef.current = hazardsRef.current.filter(h => h.x > oldChunk.startX);
          }
          
          // Remove sparkles for removed collectibles
          if (oldChunk && oldChunk.collectibles) {
            oldChunk.collectibles.spaceJunk.forEach(junk => {
              sparklesRef.current.delete(junk.id);
            });
          }
        }
      }
      
      // Update moving pads
      for (const chunk of chunks) {
        for (const mp of chunk.movingPads) {
          movingPadSystem.updateMovingPad(mp, dt);
        }
      }
      
      // Get all volcanoes and anomalies from active chunks
      const allVolcanoes: Volcano[] = [];
      const allAnomalies: Anomaly[] = [];
      for (const chunk of chunks) {
        allVolcanoes.push(...chunk.volcanoes);
        allAnomalies.push(...chunk.anomalies);
      }
      
      // Update volcanoes (use persistent state)
      if (allVolcanoes.length > 0) {
        const level = Math.floor(currentDistance / 100) + 1; // Level based on distance
        const volcanoUpdate = updateVolcanoes(
          allVolcanoes,
          volcanoParticles,
          dt,
          level,
          cameraX - viewWidth / 2,
          cameraX + viewWidth / 2
        );
        
        // Play spatial audio for volcano eruptions
        if (volcanoUpdate.shouldPlayEruptionSound && volcanoUpdate.eruptingVolcanoes.length > 0) {
          volcanoUpdate.eruptingVolcanoes.forEach(volcano => {
            audio.current.spatialExplosion(volcano.x, shipX, WORLD_WIDTH);
          });
        }
        
        setVolcanoParticles(volcanoUpdate.newParticles);
      }
      
      // Update field message timer
      if (fieldMessageTimer > 0) {
        setFieldMessageTimer(Math.max(0, fieldMessageTimer - dt));
      }
      
      // Update shield timer
      if (shieldActiveRef.current && shieldTimerRef.current > 0) {
        shieldTimerRef.current -= dt;
        if (shieldTimerRef.current <= 0) {
          shieldActiveRef.current = false;
          setShieldActive(false);
        }
      }
      
      // Update invulnerability timer
      if (invulnerableRef.current) {
        invulnerableTimerRef.current -= dt;
        if (invulnerableTimerRef.current <= 0) {
          invulnerableRef.current = false;
          invulnerableTimerRef.current = 0;
        }
      }
      
      // Ship input and rotation (only when alive)
      if (!isDead) {
        // Gamepad input with hot-swap detection
        const gp = anyGamepad();
        if (gp) {
          // Handle gamepad hot-swap
          if (gpDeviceIdRef.current !== gp.id) {
            gpDeviceIdRef.current = gp.id;
            setLastDeviceId(gp.id);
            profileRef.current = loadProfile(gp.id);
          }
          
          gamepadRef.current = gp;
          const input = readGamepad(gp, profileRef.current);
          gamepadInputRef.current = input;
          
          // Update rotation boost (matches main game) - only when boost button held
          const gpRotateBoost = input.rotateBoost || false;
          rotBoostActive.current = updateRotationModifier(
            rotBoostActive.current,
            gpRotateBoost,
            dt * 1000,
            rotModConfig
          );
          
          // Apply rotation modifier to get boosted rotation
          const { angularAccel: modifiedRotAccel } = applyRotationModifier(
            ROTATION_ACCEL,
            8.0, // base max angular velocity
            rotBoostActive.current,
            rotModConfig
          );
          
          // Analog rotation (left stick X-axis)
          if (Math.abs(input.rotation) > 0.05) {
            shipAngularVel += input.rotation * modifiedRotAccel * dt * 1.2;
          }
          
          // Digital rotation (shoulder buttons)
          if (input.buttons.rotateLeft) {
            shipAngularVel -= modifiedRotAccel * dt;
          }
          if (input.buttons.rotateRight) {
            shipAngularVel += modifiedRotAccel * dt;
          }
          
          // Apply thrust from gamepad
          if (input.thrust > 0.1 && fuelAmount > 0) {
            keys.current.thrust = true;
            vibrate(50, input.thrust * 0.15, input.thrust * 0.3);
          } else {
            keys.current.thrust = false;
          }
          
          // Pause button
          if (input.buttons.pause && !paused) {
            setPaused(true);
          }
        }
        
        // Keyboard rotation boost (matches gamepad boost) - only when boost key held
        const keyRotateBoost = keys.current.rotateBoost;
        if (!isLanded) {
          rotBoostActive.current = updateRotationModifier(
            rotBoostActive.current,
            keyRotateBoost,
            dt * 1000,
            rotModConfig
          );
          
          // Apply rotation modifier for keyboard
          const { angularAccel: modifiedRotAccel } = applyRotationModifier(
            ROTATION_ACCEL,
            8.0,
            rotBoostActive.current,
            rotModConfig
          );
          
          // Gyroscope analog rotation (priority over keyboard)
          const gyroInput = gyroRotationRef.current;
          if (Math.abs(gyroInput) > 0.05) {
            // Analog gyroscope input with modified acceleration
            shipAngularVel += gyroInput * modifiedRotAccel * dt * 1.2;
          } else {
            // Keyboard rotation controls (only if gyro not active)
            if (keys.current.left) {
              shipAngularVel -= modifiedRotAccel * dt;
            }
            if (keys.current.right) {
              shipAngularVel += modifiedRotAccel * dt;
            }
          }
          
          // Apply angular velocity cap (matching main game)
          const maxAngularVel = 8.0;
          shipAngularVel = Math.max(-maxAngularVel, Math.min(maxAngularVel, shipAngularVel));
        }
      }
      
      // Thrust controls and physics (only when alive)
      if (!isDead) {
        // Thrust controls (works both landed and in-flight to allow takeoff)
        if (keys.current.thrust && fuelAmount > 0) {
          // Only apply thrust physics when not landed
          if (!isLanded) {
            const thrustX = Math.sin(shipAngle) * THRUST_ACCEL;
            const thrustY = -Math.cos(shipAngle) * THRUST_ACCEL;
            shipVx += thrustX * dt;
            shipVy += thrustY * dt;
            fuelAmount -= FUEL_BURN * dt;
            audio.current.setThruster(1);
            
            // Spawn thruster particles (matching main game)
            const nozzlePositions = shouldOptimize ? [
              { x: shipX - Math.sin(shipAngle) * 10, y: shipY + Math.cos(shipAngle) * 10 }
            ] : [
              // Center nozzle
              { x: shipX - Math.sin(shipAngle) * 10, y: shipY + Math.cos(shipAngle) * 10 },
              // Left nozzle
              { x: shipX - Math.sin(shipAngle) * 10 - Math.cos(shipAngle) * 3, y: shipY + Math.cos(shipAngle) * 10 + Math.sin(shipAngle) * 3 },
              // Right nozzle
              { x: shipX - Math.sin(shipAngle) * 10 + Math.cos(shipAngle) * 3, y: shipY + Math.cos(shipAngle) * 10 - Math.sin(shipAngle) * 3 }
            ];
            
            for (const nozzle of nozzlePositions) {
              const particlesPerNozzle = Math.ceil(THRUSTER_PARTICLE_COUNT / nozzlePositions.length);
              for (let i = 0; i < particlesPerNozzle; i++) {
                const angleSpread = shouldOptimize ? 0.6 : 1.6;
                const pa = shipAngle + (Math.random() - 0.5) * angleSpread + Math.PI;
                const sp = shouldOptimize ? 
                  (60 + Math.random() * 120) : 
                  (100 + Math.random() * 200);
                const lifespan = shouldOptimize ? 0.5 : 1.6;
                
                thrusterParticles.push({
                  x: nozzle.x,
                  y: nozzle.y,
                  vx: Math.sin(pa) * sp,
                  vy: -Math.cos(pa) * sp,
                  life: 0,
                  max: lifespan,
                  color: neonColor
                });
              }
            }
          }
          // Play thruster audio regardless of landed state
          audio.current.setThruster(1);
        } else {
          audio.current.setThruster(0);
        }
        
        // Always update hazards and asteroids (even when landed)
        updateHazards(hazardsRef.current, dt, CHUNK_WIDTH * 10, 600, false);
        
        // Update asteroid field (keep moving even when landed)
        if (asteroidFieldRef.current?.active) {
          const fieldUpdate = updateAsteroidField(
            asteroidFieldRef.current,
            dt,
            shipX,
            shipY,
            8, // ship collision radius
            viewWidth,
            asteroidFieldCountRef.current
          );
          
          // Handle collision (only when not landed and not invulnerable)
          if (!isLanded && fieldUpdate.collision && !invulnerableRef.current) {
            if (shieldActiveRef.current && fieldUpdate.collidingAsteroid) {
              // SHIELD SAVE - destroy the asteroid
              const asteroidIndex = asteroidFieldRef.current.asteroids.indexOf(fieldUpdate.collidingAsteroid);
              if (asteroidIndex > -1) {
                asteroidFieldRef.current.asteroids.splice(asteroidIndex, 1);
              }
              
              spawnShieldBreak(shipX, shipY);
              shieldActiveRef.current = false;
              setShieldActive(false);
              audio.current.shieldBreak();
              
              // Bounce away from asteroid
              const dx = shipX - fieldUpdate.collidingAsteroid.x;
              const dy = shipY - fieldUpdate.collidingAsteroid.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const bounceStrength = 150;
              shipVx += (dx / dist) * bounceStrength * dt;
              shipVy += (dy / dist) * bounceStrength * dt;
              
              // Grant brief invulnerability
              invulnerableRef.current = true;
              invulnerableTimerRef.current = INVULNERABLE_DURATION;
              
              if (anyGamepad()) vibrate(200, 0.5, 0.8);
            } else {
              isDead = true;
              spawnExplosion(shipX, shipY);
              spawnDebris(shipX, shipY, shipVx, shipVy);
              audio.current.explosion();
              if (anyGamepad()) vibrate(500, 0.8, 1.0);
              
              setTimeout(() => {
                onGameOver({
                  cause: "crash",
                  distance: currentDistance,
                  time: currentTime,
                  score: currentScore,
                  landings: currentLandings
                });
              }, 2500);
            }
          }
          
          // Handle near miss bonus (only when not landed)
          if (!isLanded && fieldUpdate.nearMiss) {
            currentScore += 10;
            setScore(currentScore);
            audio.current.click(); // Quick sound for near-miss
          }
        }
        
        // Detect field exit (even when landed)
        if (asteroidFieldRef.current?.active && shipX > asteroidFieldRef.current.endX) {
          // Check if all asteroids are off-screen before clearing
          const allAsteroidsBehind = asteroidFieldRef.current.asteroids.every(
            asteroid => asteroid.x < shipX - viewWidth / 2 - 100
          );
          
          if (allAsteroidsBehind) {
            // Award clear bonus if no collisions
            if (asteroidFieldRef.current.clearedWithoutHit) {
              currentScore += 250;
              setScore(currentScore);
              setFieldMessage("+250 FIELD CLEARED!");
              setFieldMessageTimer(2.0);
            }
            
            setFieldMessage("ASTEROID FIELD CLEARED");
            setFieldMessageTimer(2.0);
            asteroidFieldRef.current = null;
            fieldWarningShownRef.current = false;
            
            // Increment field count for next asteroid field
            asteroidFieldCountRef.current++;
          }
        }
        
        // Physics (only when not landed)
        if (!isLanded) {
          // Apply anomaly forces
          let anomalyAx = 0;
          let anomalyAy = 0;
          if (allAnomalies.length > 0) {
            const anomalyForce = anomalyAccelAt(allAnomalies, shipX, shipY, currentTime);
            anomalyAx = anomalyForce.ax;
            anomalyAy = anomalyForce.ay;
          }
          
          // Physics integration (matching main game with 60fps scaling)
          shipVy += (GRAVITY + anomalyAy) * 60 * dt;
          shipVx += anomalyAx * 60 * dt;
          shipX += shipVx * 60 * dt;
          shipY += shipVy * 60 * dt;
          shipAngle += shipAngularVel * dt;
          
          // Angular friction (easy mode - only when no rotation input from keyboard, gamepad, or gyro)
          const gpInput = gamepadInputRef.current;
          const gpLeft = gpInput?.buttons?.rotateLeft || false;
          const gpRight = gpInput?.buttons?.rotateRight || false;
          const analogRotating = Math.abs(gpInput?.rotation || 0) > 0.05;
          const gyroRotating = Math.abs(gyroRotationRef.current) > 0.05;
          
          if (!keys.current.left && !keys.current.right && !gpLeft && !gpRight && !analogRotating && !gyroRotating) {
            shipAngularVel *= 0.9;
            if (Math.abs(shipAngularVel) < 0.02) shipAngularVel = 0;
          }
          
          // Update distance (only counts forward progress)
          const newDistance = Math.max(currentDistance, shipX - CHUNK_WIDTH / 2);
          currentDistance = newDistance;
          setDistance(currentDistance);
          
          // Check if we've cleared a pad after takeoff
          if (padToClear) {
            const padY = padToClear.y || padToClear.currentPos?.y;
            const clearanceGap = 20; // Gap needed to clear the pad
            if (shipY < padY - clearanceGap) {
              // Remove the pad from the chunk
              for (const chunk of chunks) {
                const padIndex = chunk.pads.indexOf(padToClear);
                if (padIndex !== -1) {
                  chunk.pads.splice(padIndex, 1);
                  break;
                }
                const mpIndex = chunk.movingPads.indexOf(padToClear);
                if (mpIndex !== -1) {
                  chunk.movingPads.splice(mpIndex, 1);
                  break;
                }
              }
              padToClear = null;
            }
          }
          
          // Prevent going too far left
          if (shipX < CHUNK_WIDTH / 2) {
            shipX = CHUNK_WIDTH / 2;
            shipVx = Math.max(0, shipVx);
          }
          
          // Check volcano particle collisions
          if (volcanoParticles.length > 0) {
            const volcanoResult = checkVolcanoParticleCollision(volcanoParticles, shipX, shipY, 8);
            if (volcanoResult.collided && !invulnerableRef.current) {
              if (shieldActiveRef.current && volcanoResult.particle) {
                // SHIELD SAVE - destroy the particle
                const particleIndex = volcanoParticles.indexOf(volcanoResult.particle);
                if (particleIndex > -1) {
                  volcanoParticles.splice(particleIndex, 1);
                  setVolcanoParticles([...volcanoParticles]); // Trigger state update
                }
                
                spawnShieldBreak(shipX, shipY);
                shieldActiveRef.current = false;
                setShieldActive(false);
                audio.current.shieldBreak();
                
                // Bounce away from particle
                const dx = shipX - volcanoResult.particle.x;
                const dy = shipY - volcanoResult.particle.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const bounceStrength = 150;
                shipVx += (dx / dist) * bounceStrength * dt;
                shipVy += (dy / dist) * bounceStrength * dt;
                
                // Grant brief invulnerability
                invulnerableRef.current = true;
                invulnerableTimerRef.current = INVULNERABLE_DURATION;
                
                if (anyGamepad()) vibrate(200, 0.5, 0.8);
              } else {
                isDead = true;
                spawnExplosion(shipX, shipY);
                spawnDebris(shipX, shipY, shipVx, shipVy);
                audio.current.explosion();
                if (anyGamepad()) vibrate(500, 0.8, 1.0);
                setTimeout(() => {
                  onGameOver({
                    cause: "crash",
                    distance: currentDistance,
                    time: currentTime,
                    score: currentScore,
                    landings: currentLandings
                  });
                }, 2500);
              }
            }
          }
          
          // Check hazard collisions (only when airborne and alive)
          const hazardResult = checkHazardCollision(hazardsRef.current, shipX, shipY, 8);
          if (hazardResult.collided && !invulnerableRef.current) {
            if (shieldActiveRef.current && hazardResult.hazard) {
              // SHIELD SAVE - destroy the hazard
              const hazardIndex = hazardsRef.current.indexOf(hazardResult.hazard);
              if (hazardIndex > -1) {
                hazardsRef.current.splice(hazardIndex, 1);
              }
              
              spawnShieldBreak(shipX, shipY);
              shieldActiveRef.current = false;
              setShieldActive(false);
              audio.current.shieldBreak();
              
              // Bounce away from hazard
              const dx = shipX - hazardResult.hazard.x;
              const dy = shipY - hazardResult.hazard.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const bounceStrength = 150;
              shipVx += (dx / dist) * bounceStrength * dt;
              shipVy += (dy / dist) * bounceStrength * dt;
              
              // Grant brief invulnerability
              invulnerableRef.current = true;
              invulnerableTimerRef.current = INVULNERABLE_DURATION;
              
              if (anyGamepad()) vibrate(200, 0.5, 0.8);
            } else {
              isDead = true;
              spawnExplosion(shipX, shipY);
              spawnDebris(shipX, shipY, shipVx, shipVy);
              audio.current.explosion();
              if (anyGamepad()) vibrate(500, 0.8, 1.0);
              setTimeout(() => {
                onGameOver({
                  cause: "crash",
                  distance: currentDistance,
                  time: currentTime,
                  score: currentScore,
                  landings: currentLandings
                });
              }, 2500);
            }
          }
          
          // Check collectible pickups (only when alive)
          for (const chunk of chunks) {
            if (!chunk.collectibles) continue;
            
            // Check shield pickup
            if (chunk.collectibles.shieldPickup && !chunk.collectibles.shieldPickup.collected) {
              const shield = chunk.collectibles.shieldPickup;
              const dx = shipX - shield.pos.x;
              const dy = shipY - shield.pos.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance <= shield.radius + 16) {
                if (shieldActiveRef.current) {
                  // Already have shield - convert to fuel+score
                  shield.collected = true;
                  fuelAmount = Math.min(fuelCap, fuelAmount + 5);
                  currentScore += 25;
                  setScore(currentScore);
                  audio.current.click();
                } else {
                  // Collect shield
                  shield.collected = true;
                  shieldActiveRef.current = true;
                  setShieldActive(true);
                  shieldTimerRef.current = SHIELD_DURATION;
                  
                  currentScore += 50;
                  setScore(currentScore);
                  
                  audio.current.shieldPickup();
                }
              }
            }
            
            for (const junk of chunk.collectibles.spaceJunk) {
              if (checkJunkPickup({ x: shipX, y: shipY }, 16, junk)) {
                const result = collectJunk(chunk.collectibles, junk.id);
                if (result.fuelReward > 0) {
                  fuelAmount = Math.min(fuelCap, fuelAmount + result.fuelReward);
                  audio.current.success();
                }
                if (result.points > 0) {
                  currentScore += result.points;
                  setScore(currentScore);
                }
              }
            }
          }
          
          // Collision detection
          let terrainY = getHeightAt(shipX);
          const shipBottom = shipY + 12;
          
          if (shipBottom >= terrainY) {
            // Check for pad landing
            const pad = getPadAt(shipX, shipY);
            const movingPad = getMovingPadAt(shipX, shipY);
            const landingPad = pad || movingPad;
            
            if (landingPad) {
              // Easy mode landing requirements (matching main game)
              const okAngle = Math.abs(shipAngle) < 0.18; // ~10 degrees
              const okVy = Math.abs(shipVy) < 1.8;
              const okVx = Math.abs(shipVx) < 1.5;
              
              if (okAngle && okVy && okVx) {
                // Successful landing!
                isLanded = true;
                landedPad = landingPad;
                shipY = (movingPad ? movingPad.currentPos.y : landingPad.y) - 12;
                // Set ship velocity to ZERO - it's now anchored to the pad
                shipVy = 0;
                shipVx = 0;
                shipAngularVel = 0;
                
                // Freeze the moving pad when landing on it
                if (movingPad) {
                  (movingPad as MovingPad).frozen = true;
                }
                
                // Stop speed bonus timer
                const elapsed = currentTime - lastTakeoffTime.current;
                timerActiveRef.current = false;
                setTimerActive(false);
                
                // Add fuel refill (consistent throughout the game)
                const refillAmount = 60; // Consistent 60 fuel per landing
                fuelAmount = Math.min(fuelCap, fuelAmount + refillAmount);
                
                // Add score only if player has moved from start
                if (hasMovedFromStart) {
                  // Base landing score
                  let landingScore = 1000 * (landingPad.multiplier || 1);
                  
                  // MEGA multiplier for moving pads
                  if (movingPad) {
                    landingScore = Math.floor(landingScore * (movingPad as MovingPad).scoreMult);
                  }
                  
                  // Calculate bullseye bonus (3% tolerance like main game)
                  const padWidth = landingPad.width || (landingPad.xEnd - landingPad.xStart);
                  const padCenterX = movingPad 
                    ? (movingPad as MovingPad).currentPos.x
                    : (landingPad.xStart + landingPad.xEnd) / 2;
                  const dx = Math.abs(shipX - padCenterX);
                  const bullseye = dx <= padWidth * 0.03;
                  
                  const messages: string[] = [];
                  
                  // Calculate bullseye bonus
                  if (bullseye) {
                    // Increment bullseye streak (cap at 8x)
                    bullseyeStreakRef.current = Math.min(8, bullseyeStreakRef.current + 1);
                    const newStreak = bullseyeStreakRef.current;
                    
                    const bullseyeBonus = movingPad 
                      ? Math.floor(500 * newStreak * (movingPad as MovingPad).scoreMult)
                      : 500 * newStreak;
                    landingScore += bullseyeBonus;
                    
                    const bullseyeMessage = newStreak > 1 
                      ? `500 POINT BULLSEYE x ${newStreak}`
                      : "500 POINT BULLSEYE";
                    messages.push(bullseyeMessage);
                  } else {
                    // Reset bullseye streak on miss
                    bullseyeStreakRef.current = 0;
                  }
                  
                  // Calculate speed bonus
                  const speedBonus = elapsed < 10;
                  if (speedBonus) {
                    // Increment speed bonus streak (cap at 8x)
                    speedBonusStreakRef.current = Math.min(8, speedBonusStreakRef.current + 1);
                    const newStreak = speedBonusStreakRef.current;
                    
                    const speedBonusPoints = movingPad 
                      ? Math.floor(500 * newStreak * (movingPad as MovingPad).scoreMult)
                      : 500 * newStreak;
                    landingScore += speedBonusPoints;
                    
                    const speedMessage = newStreak > 1
                      ? `500 POINT SPEED BONUS x ${newStreak}`
                      : "500 POINT SPEED BONUS";
                    messages.push(speedMessage);
                  } else {
                    // Reset speed bonus streak on miss
                    speedBonusStreakRef.current = 0;
                  }
                  
                  // Queue messages (speed bonus first, then bullseye)
                  if (messages.length > 0) {
                    messageQueueRef.current = messages.reverse(); // Reverse so speed shows first
                    currentMessageIndexRef.current = 0;
                    messageTimerRef.current = 0;
                    bullseyeT = 0;
                    bonusText = messageQueueRef.current[0];
                  }
                  
                  currentScore += landingScore;
                  currentLandings++;
                  setScore(currentScore);
                  setLandings(currentLandings);
                  
                  // Trigger fireworks based on landing count
                  const isMoving = !!movingPad;
                  const isBonus = landingPad.bonus2x;
                  
                  // Clear any existing firework timeouts
                  fireworkTimeoutsRef.current.forEach(t => clearTimeout(t));
                  fireworkTimeoutsRef.current = [];
                  
                  // Show fireworks after brief delay
                  const initialTimeout = setTimeout(() => {
                    setLandingType(isMoving ? 'moving' : isBonus ? '2x' : 'regular');
                    setShowFireworks(true);
                    setFireworksActive(true);
                    
                    // Auto-hide after 6 seconds if player doesn't take off
                    const hideTimeout = setTimeout(() => {
                      setShowFireworks(false);
                      setFireworksActive(false);
                    }, 6000);
                    fireworkTimeoutsRef.current.push(hideTimeout);
                  }, 500);
                  
                  fireworkTimeoutsRef.current.push(initialTimeout);
                }
                setFuel(fuelAmount);
                
                audio.current.success();
                
                // No auto-takeoff - player must thrust to take off
              } else {
                // Bad landing
                if (shieldActiveRef.current) {
                  // Shield saves but landing fails (no refuel)
                  spawnShieldBreak(shipX, shipY);
                  shieldActiveRef.current = false;
                  setShieldActive(false);
                  audio.current.shieldBreak();
                  
                  shipY = (movingPad ? movingPad.currentPos.y : landingPad.y) - 20;
                  shipVx *= 0.3;
                  shipVy = -1;
                  if (anyGamepad()) vibrate(200, 0.5, 0.8);
                } else {
                  isDead = true;
                  spawnExplosion(shipX, shipY);
                  spawnDebris(shipX, shipY, shipVx, shipVy);
                  audio.current.spatialExplosion(shipX, shipY, CHUNK_WIDTH * 10);
                  if (anyGamepad()) vibrate(500, 0.8, 1.0);
                  setTimeout(() => {
                    onGameOver({
                      cause: "crash",
                      distance: currentDistance,
                      time: currentTime,
                      score: currentScore,
                      landings: currentLandings
                    });
                  }, 2500);
                }
              }
            } else {
              // Hit terrain
              if (shieldActiveRef.current) {
                spawnShieldBreak(shipX, shipY);
                shieldActiveRef.current = false;
                setShieldActive(false);
                audio.current.shieldBreak();
                shipVx += (Math.random() - 0.5) * 2;
                shipVy = -1.5;
                if (anyGamepad()) vibrate(200, 0.5, 0.8);
              } else {
                isDead = true;
                spawnExplosion(shipX, shipY);
                spawnDebris(shipX, shipY, shipVx, shipVy);
                audio.current.spatialExplosion(shipX, shipY, CHUNK_WIDTH * 10);
                if (anyGamepad()) vibrate(500, 0.8, 1.0);
                setTimeout(() => {
                  onGameOver({
                    cause: "crash",
                    distance: currentDistance,
                    time: currentTime,
                    score: currentScore,
                    landings: currentLandings
                  });
                }, 2500);
              }
            }
          }
          
          // Fuel depletion - ship continues with trajectory until crash
        } else {
          // Landed - move with pad if it's a moving pad
          if (landedPad && (landedPad as MovingPad).currentVelocity) {
            shipX += (landedPad as MovingPad).currentVelocity.x * 60 * dt;
            shipY = (landedPad as MovingPad).currentPos.y - 12;
          }
          
          // Check for takeoff input
          if (keys.current.thrust && fuelAmount > 0) {
            isLanded = false;
            hasMovedFromStart = true; // Mark that player has taken off
            padToClear = landedPad; // Mark this pad to be removed once cleared
            
            // Unfreeze the moving pad when taking off
            if (landedPad && (landedPad as MovingPad).frozen !== undefined) {
              (landedPad as MovingPad).frozen = false;
            }
            
            landedPad = null;
            
            // Small upward impulse to help clear the pad
            shipVy = -1.5;
            
            // Start speed bonus timer
            lastTakeoffTime.current = currentTime;
            timerActiveRef.current = true;
            setTimerActive(true);
          }
        }
      }
      
      // Update thruster particles
      for (let i = thrusterParticles.length - 1; i >= 0; i--) {
        const p = thrusterParticles[i];
        p.life += dt;
        if (p.life >= p.max) {
          thrusterParticles.splice(i, 1);
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += GRAVITY * 30 * dt; // Particles affected by gravity
        }
      }
      
      // Limit thruster particles for performance
      const maxThrusterParticles = shouldOptimize ? 30 : 300;
      if (thrusterParticles.length > maxThrusterParticles) {
        thrusterParticles.splice(0, thrusterParticles.length - maxThrusterParticles);
      }
      
      // Update explosion particles (matching working Asteroids physics)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt; // Gravity (same as working Asteroids)
        if (p.life >= p.max) particles.splice(i, 1);
      }

      // Update debris
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 450 * dt; // Gravity
        d.angle += d.av * dt;
        d.life += dt;
        
        // Bounce off terrain
        const terrainY = getHeightAt(d.x);
        if (d.y > terrainY) {
          d.y = terrainY;
          d.vy = -d.vy * 0.4; // Bounce with energy loss
          d.vx *= 0.7; // Friction
          d.av *= 0.8;
        }
        
        if (d.life >= d.max) debris.splice(i, 1);
      }
      
      // Limit debris count
      const maxDebris = shouldOptimize ? 20 : 40;
      if (debris.length > maxDebris) {
        debris.splice(0, debris.length - maxDebris);
      }

      // Update shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life += dt;
        if (sw.life >= sw.max) shockwaves.splice(i, 1);
      }

      // Update screen flash
      if (flashT > 0) flashT = Math.max(0, flashT - dt * 2);
      
      // Bullseye/Speed bonus overlay timer with message queue
      if (bullseyeT >= 0) {
        bullseyeT += dt;
        if (bullseyeT > 2.2) bullseyeT = -1;
      }
      
      // Update message queue display
      if (messageQueueRef.current.length > 0 && currentMessageIndexRef.current < messageQueueRef.current.length) {
        messageTimerRef.current += dt;
        
        // Display current message for 2 seconds
        if (messageTimerRef.current >= 2.0) {
          if (currentMessageIndexRef.current < messageQueueRef.current.length - 1) {
            // Move to next message
            currentMessageIndexRef.current++;
            messageTimerRef.current = 0;
            bullseyeT = 0; // Reset animation timer for next message
            bonusText = messageQueueRef.current[currentMessageIndexRef.current];
          } else {
            // All messages shown, clear queue
            messageQueueRef.current = [];
            currentMessageIndexRef.current = 0;
            messageTimerRef.current = 0;
          }
        }
      }
      
      // Update starfield (shooting stars and satellites) - skip if optimizing
      if (!shouldOptimize) {
        if (currentTime >= nextShooting) {
          spawnShooting();
          nextShooting = currentTime + (0.6 + Math.random() * 1.6);
        }
        if (currentTime >= nextBgSat) {
          spawnBgSat();
          nextBgSat = currentTime + (5 + Math.random() * 7);
        }
      }
      
      // Update shooting stars
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += dt;
        if (s.life >= s.max) {
          shooting.splice(i, 1);
        } else {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
        }
      }
      
      // Update background satellites
      for (let i = bgSats.length - 1; i >= 0; i--) {
        const s = bgSats[i];
        s.life += dt;
        if (s.life >= s.max) {
          bgSats.splice(i, 1);
        } else {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.rot += s.rotV * dt;
        }
      }
      
      // Update HUD (recalculate terrain height for altitude)
      const currentTerrainY = getHeightAt(shipX);
      const currentAltitude = currentTerrainY - shipY;
      setAltitude(currentAltitude);
      setVx(shipVx);
      setVy(shipVy);
      setFuel(fuelAmount);
      
      // Camera follows ship horizontally with predictive centering (matching main game)
      const leadTime = 0.35; // Predictive camera lead
      const targetCameraX = shipX + shipVx * leadTime;
      const camAlpha = 1 - Math.exp(-dt / 0.28); // Smooth interpolation
      cameraX += (targetCameraX - cameraX) * camAlpha;
      
      // Calculate dynamic zoom based on terrain clearance (matching main game)
      const alpha = 0.1;
      clearanceEMA = alpha * currentAltitude + (1 - alpha) * clearanceEMA;
      const effClr = clearanceEMA;
      
      // Zoom range: 1.4x (close to terrain) to 1.0x (far from terrain)
      const near = 0, far = 420;
      const tRaw = Math.min(1, Math.max(0, (effClr - near) / (far - near)));
      const s = tRaw * tRaw * (3 - 2 * tRaw); // Smoothstep
      let targetZoom = 1.4 * (1 - s) + 1.0 * s;
      
      // Check for landing pad proximity enhancement
      let nearestPadDist = Infinity;
      for (const chunk of chunks) {
        for (const pad of chunk.pads) {
          const padCenterX = (pad.xStart + pad.xEnd) / 2;
          const dx = Math.abs(shipX - padCenterX);
          const dy = Math.abs(shipY - pad.y);
          const distance = Math.sqrt(dx * dx + dy * dy);
          nearestPadDist = Math.min(nearestPadDist, distance);
        }
        for (const mp of chunk.movingPads) {
          const dx = Math.abs(shipX - mp.currentPos.x);
          const dy = Math.abs(shipY - mp.currentPos.y);
          const distance = Math.sqrt(dx * dx + dy * dy);
          nearestPadDist = Math.min(nearestPadDist, distance);
        }
      }
      
      const padDetectionRange = 250;
      if (nearestPadDist < padDetectionRange) {
        // Enhanced zoom for landing approach (1.4x to 3.0x)
        const padProximityRatio = 1 - (nearestPadDist / padDetectionRange);
        const enhancedZoom = 1.4 + (1.6 * padProximityRatio * padProximityRatio);
        targetZoom = Math.max(targetZoom, enhancedZoom);
      }
      
      // Apply hysteresis and smooth transitions
      if (Math.abs(targetZoom - prevTargetZoom) < 0.015) targetZoom = prevTargetZoom;
      prevTargetZoom = targetZoom;
      
      const zoomAlpha = 1 - Math.exp(-dt / 1.6);
      const desiredDelta = (targetZoom - zoom) * zoomAlpha;
      const maxRate = 0.28;
      const maxStep = maxRate * dt;
      zoom += Math.max(-maxStep, Math.min(maxStep, desiredDelta));
      
      // Vertical camera anchor (matching main game)
      const viewH = c.height / (zoom * dprInit);
      let groundAtCam = getHeightAt(cameraX);
      const desiredGroundY = viewH * 0.82; // Target ground position from top in view units
      const groundAnchor = -groundAtCam + (desiredGroundY - viewH / 2);
      const desiredLanderY = viewH * 0.45; // Target lander position from top in view units
      const landerAnchor = -shipY + (desiredLanderY - viewH / 2);
      const anchorTarget = Math.max(groundAnchor, landerAnchor);
      
      if (camAnchorInit) {
        smoothedAnchor = anchorTarget;
        camAnchorInit = false;
      }
      const aAlpha = 1 - Math.exp(-dt / 0.35);
      smoothedAnchor += (anchorTarget - smoothedAnchor) * aAlpha;
      const anchor = smoothedAnchor;
      
      // Render
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.scale(dprInit, dprInit);
      
      const shake = cameraShake;
      cameraShake *= 0.9;
      
      // Draw starfield with optimized rendering
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      if (shouldOptimize) {
        // LOW GRAPHICS: Simple layered rendering without clipping
        // Draw stars with basic culling
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 0; // No shadow blur for performance
        ctx.fillStyle = neonColor;
        const starLimit = Math.min(80, stars.length);
        for (let i = 0; i < starLimit; i++) {
          const s = stars[i];
          
          // Calculate world position of star to check terrain height
          const starWorldX = cameraX + (s.x - c.width / 2) / zoom;
          const terrainAtStar = getHeightAt(starWorldX);
          const starWorldY = (s.y - c.height / 2) / (zoom * dprInit) - anchor;
          
          // Skip star if it's too close to terrain
          if (starWorldY > terrainAtStar - 60) continue;
          
          const a = s.baseA * (0.7 + 0.3 * Math.sin(s.ph + currentTime * s.tw));
          ctx.globalAlpha = Math.min(1, Math.max(0.3, a));
          ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1;
      } else {
        // HIGH GRAPHICS: Full masking system with clipping
        // Create terrain clipping path to mask stars behind terrain
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(c.width, 0);
        const segs = 150;
        const terrainBuffer = 40 * dprInit;
        for (let i = segs; i >= 0; i--) {
          const sx = (i / segs) * c.width;
          const worldX = cameraX + (sx - c.width / 2) / zoom;
          const worldY = getHeightAt(worldX);
          const sy = c.height / 2 + (worldY + anchor) * zoom * dprInit + terrainBuffer + 10;
          ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.clip();
        
        // Draw stars with shadow blur
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 2 * dprInit;
        ctx.fillStyle = neonColor;
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          
          // Calculate world position of star to check terrain height
          const starWorldX = cameraX + (s.x - c.width / 2) / zoom;
          const terrainAtStar = getHeightAt(starWorldX);
          const starWorldY = (s.y - c.height / 2) / (zoom * dprInit) - anchor;
          
          // Skip star if it's too close to terrain (within buffer zone)
          if (starWorldY > terrainAtStar - 50) continue;
          
          const a = s.baseA * (0.7 + 0.3 * Math.sin(s.ph + currentTime * s.tw));
          ctx.globalAlpha = Math.min(1, Math.max(0.25, a));
          ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1;
      }
      
      // Draw shooting stars and satellites (skip in low graphics)
      if (!shouldOptimize) {
        for (const sh of shooting) {
          const t = 1 - Math.min(1, sh.life / sh.max);
          ctx.globalAlpha = t;
          ctx.beginPath();
          ctx.moveTo(sh.x, sh.y);
          ctx.lineTo(sh.x - sh.vx * 0.06, sh.y - sh.vy * 0.06);
          ctx.lineWidth = 2 * dprInit;
          ctx.strokeStyle = neonColor;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        
        for (const s of bgSats) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rot);
          ctx.scale(s.scale, s.scale);
          ctx.strokeStyle = neonColor;
          ctx.lineWidth = 1.5 * dprInit;
          ctx.beginPath();
          ctx.rect(-6 * dprInit, -2 * dprInit, 12 * dprInit, 4 * dprInit);
          ctx.stroke();
          ctx.beginPath();
          ctx.rect(-16 * dprInit, -3 * dprInit, 8 * dprInit, 6 * dprInit);
          ctx.rect(8 * dprInit, -3 * dprInit, 8 * dprInit, 6 * dprInit);
          ctx.stroke();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      
      // Apply zoom and camera transform (both horizontal and vertical)
      ctx.translate(c.width / (2 * dprInit), c.height / (2 * dprInit));
      ctx.scale(zoom, zoom);
      ctx.translate(-cameraX + shake, anchor);
      
      // Draw terrain
      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = shouldOptimize ? 0 : 8;
      ctx.lineWidth = 2;
      
      for (const chunk of chunks) {
        // Improved culling: keep terrain visible for half a screen width after passing
        if (chunk.startX > cameraX + viewWidth || chunk.endX < cameraX - viewWidth * 0.5) continue;
        
        ctx.beginPath();
        for (let i = 0; i < chunk.points.length; i++) {
          const pt = chunk.points[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        
        // Draw pads with 2x labels
        for (const pad of chunk.pads) {
          ctx.fillStyle = pad.bonus2x ? `rgba(255,100,255,0.3)` : `rgba(100,255,255,0.3)`;
          ctx.fillRect(pad.xStart, pad.y, pad.xEnd - pad.xStart, 2);
          ctx.strokeStyle = neonColor;
          ctx.strokeRect(pad.xStart, pad.y, pad.xEnd - pad.xStart, 2);
          
          // Add 2x label for bonus pads
          if (pad.bonus2x) {
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.font = `700 ${12 * dprInit}px "Orbitron", sans-serif`;
            ctx.shadowColor = neonColor;
            ctx.shadowBlur = 18 * dprInit;
            ctx.fillStyle = neonColor;
            ctx.globalAlpha = 0.95;
            const centerX = (pad.xStart + pad.xEnd) / 2;
            ctx.fillText("2x", centerX, pad.y + 4);
            ctx.restore();
          }
        }
        
        // Draw moving pads with full rendering (dotted paths, arrows, labels)
        for (const mp of chunk.movingPads) {
          movingPadSystem.renderMovingPad(
            ctx,
            mp,
            cameraX,
            0, // cameraY (not used in 2D side-scrolling)
            1, // zoom (survival mode doesn't use zoom)
            c.width,
            c.height,
            neonColor
          );
        }
      }
      
      // Draw anomalies (gravity wells)
      if (allAnomalies.length > 0) {
        drawAnomaliesField(ctx, allAnomalies, currentTime, neonColor);
      }
      
      // Draw volcanoes
      if (allVolcanoes.length > 0) {
        drawVolcanoes(
          ctx,
          allVolcanoes,
          volcanoParticles,
          neonColor,
          cameraX - viewWidth / 2,
          cameraX + viewWidth / 2
        );
      }
      
      // Render hazards (viewport culling included in drawHazards)
      const allHazards = hazardsRef.current;
      if (allHazards.length > 0) {
        drawHazards(ctx, allHazards, neonColor, shouldOptimize ? 4 : 8);
      }
      
      // Render asteroid field (if active)
      if (asteroidFieldRef.current?.active) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        renderAsteroidField(ctx, asteroidFieldRef.current, neonColor);
        ctx.restore();
      }
      
      // Render shield pickups
      for (const chunk of chunks) {
        if (!chunk.collectibles?.shieldPickup) continue;
        const shield = chunk.collectibles.shieldPickup;
        if (shield.collected) continue;
        
        const sx = shield.pos.x;
        const sy = shield.pos.y;
        
        // Idle pulse
        shield.pulsePhase += dt * 2.5;
        const pulse = 0.85 + Math.sin(shield.pulsePhase) * 0.15;
        const glowSize = 20 * pulse;
        
        ctx.save();
        ctx.globalAlpha = 0.6 * pulse;
        ctx.shadowColor = "hsla(280, 100%, 70%, 0.9)";
        ctx.shadowBlur = shouldOptimize ? 0 : 25;
        
        // Outer glow
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowSize);
        grad.addColorStop(0, "hsla(280, 100%, 80%, 0.8)");
        grad.addColorStop(0.5, "hsla(280, 100%, 60%, 0.4)");
        grad.addColorStop(1, "hsla(280, 100%, 40%, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1;
        
        // Hexagon capsule
        ctx.strokeStyle = "hsla(280, 100%, 85%, 1)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const px = sx + Math.cos(angle) * 10;
          const py = sy + Math.sin(angle) * 10;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Inner core
        ctx.fillStyle = "hsla(280, 100%, 95%, 1)";
        ctx.beginPath();
        ctx.arc(sx, sy, 3 * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }
      
      // Render collectibles (space junk)
      const elapsed = currentTime;
      for (const chunk of chunks) {
        if (!chunk.collectibles) continue;
        
        // Update sparkles
        chunk.collectibles.spaceJunk.forEach(junk => {
          const sparkles = sparklesRef.current.get(junk.id);
          if (sparkles) {
            updateSparkles(sparkles, elapsed);
          }
        });
        
        // Render space junk
        chunk.collectibles.spaceJunk.forEach(junk => {
          if (junk.collected) return;
          
          // Viewport culling
          const viewLeft = cameraX - viewWidth / 2;
          const viewRight = cameraX + viewWidth / 2;
          const junkLeft = junk.pos.x - 50;
          const junkRight = junk.pos.x + 50;
          if (junkRight < viewLeft || junkLeft > viewRight) return;
          
          const rotation = (elapsed * junk.spinDegPerSec * Math.PI) / 180;
          const scale = 1.0 + 0.1 * Math.sin(elapsed * 2 + junk.seed * 0.001);
          const sparkles = sparklesRef.current.get(junk.id);
          
          ctx.save();
          ctx.globalAlpha = 0.9;
          renderSpaceJunk(ctx, junk.shape, junk.pos.x, junk.pos.y, rotation, scale, junk.tint, sparkles);
          ctx.restore();
        });
      }
      
      // Draw thruster particles
      for (const p of thrusterParticles) {
        const t = p.life / p.max;
        const alpha = 1 - t;
        const size = shouldOptimize ? 1.5 : (3 - t * 2);
        ctx.fillStyle = `hsla(${styles.getPropertyValue('--neon')}, ${alpha})`;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = shouldOptimize ? 0 : 6;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
      
      // Draw enhanced shockwaves (multiple concentric rings with gradient)
      for (const sw of shockwaves) {
        const progress = sw.life / sw.max;
        const maxRadius = 150 + (sw.life * 50); // Larger expanding radius (up to 200)
        const radius = progress * maxRadius;
        const alpha = (1 - progress) * 0.9;
        
        // Draw multiple rings with different colors
        ctx.globalAlpha = alpha;
        
        // Outer ring (cyan)
        ctx.strokeStyle = `hsla(180, 100%, 60%, ${alpha})`;
        ctx.lineWidth = 3 + progress * 2;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner ring (blue-white)
        if (progress < 0.7) {
          ctx.strokeStyle = `hsla(200, 100%, 80%, ${alpha * 1.2})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, radius * 0.7, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Core flash
        if (progress < 0.3) {
          ctx.strokeStyle = `hsla(0, 0%, 100%, ${alpha * 1.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, radius * 0.4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Draw debris shards
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
          ctx.moveTo(-s, -s * 0.6);
          ctx.lineTo(s * 0.9, -s * 0.2);
          ctx.lineTo(-s * 0.2, s);
          ctx.closePath();
        }
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
      }

      // Draw explosion particles (matching working Asteroids rendering)
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const t = 1 - p.life / p.max;
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      
      // Draw shield bubble (if active)
      if (shieldActiveRef.current && !isDead) {
        ctx.save();
        ctx.translate(shipX, shipY);
        
        // Shimmer animation
        const shimmerPhase = currentTime * 3;
        const shimmerAlpha = 0.3 + Math.sin(shimmerPhase) * 0.1;
        
        // Bubble outline
        ctx.strokeStyle = `hsla(280, 100%, 85%, ${shimmerAlpha + 0.3})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = "hsla(280, 100%, 70%, 0.8)";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
        
        // Prismatic sheen
        const sheenAngle = shimmerPhase * 0.5;
        const grad = ctx.createLinearGradient(
          Math.cos(sheenAngle) * 22, Math.sin(sheenAngle) * 22,
          -Math.cos(sheenAngle) * 22, -Math.sin(sheenAngle) * 22
        );
        grad.addColorStop(0, "hsla(260, 100%, 70%, 0.1)");
        grad.addColorStop(0.5, "hsla(300, 100%, 80%, 0.25)");
        grad.addColorStop(1, "hsla(260, 100%, 70%, 0.1)");
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }
      
      // Draw ship (only if alive)
      if (!isDead) {
        ctx.save();
        ctx.translate(shipX, shipY);
        ctx.rotate(shipAngle);
        
        // Invulnerability flashing effect
        if (invulnerableRef.current) {
          const flashFreq = 8; // flashes per second
          const flashPhase = (currentTime * flashFreq) % 1;
          if (flashPhase < 0.5) {
            ctx.globalAlpha = 0.3; // dim the ship
          }
        }
        
        ctx.strokeStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        
        // Ship body
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-8, 10);
        ctx.lineTo(8, 10);
        ctx.closePath();
        ctx.stroke();
        
        // Landing legs
        ctx.beginPath();
        ctx.moveTo(-6, 8);
        ctx.lineTo(-12, 12);
        ctx.moveTo(6, 8);
        ctx.lineTo(12, 12);
        ctx.stroke();
        
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      
      ctx.restore();
      
      // Screen-space overlays (bonus popups)
      if (bullseyeT >= 0 && bonusText && messageQueueRef.current.length > 0) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const T = 2.0;
        const t = Math.min(1, bullseyeT / T);
        const scaleAmt = 0.85 + Math.sin(Math.PI * t) * 0.6;
        const alpha = 1 - Math.abs(2 * t - 1);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(c.width / 2, c.height / 2);
        ctx.scale(scaleAmt, scaleAmt);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${42 * dpr}px "Orbitron", sans-serif`;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 28;
        ctx.globalAlpha = 0.85 * alpha;
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 4 * dpr;
        ctx.strokeText(bonusText, 0, 0);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      
      // Draw screen flash effect (white → orange → red gradient fade)
      if (flashT > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const flashProgress = 1 - (flashT / 0.6); // Normalize to 0-1
        let flashColor;
        let flashAlpha;
        
        if (flashProgress < 0.15) {
          // Initial bright white flash
          flashColor = 'rgba(255, 255, 255, ';
          flashAlpha = (1 - flashProgress / 0.15) * 0.9;
        } else if (flashProgress < 0.4) {
          // Orange transition
          flashColor = 'rgba(255, 180, 100, ';
          flashAlpha = (1 - (flashProgress - 0.15) / 0.25) * 0.6;
        } else {
          // Red fade out
          flashColor = 'rgba(255, 100, 80, ';
          flashAlpha = (1 - (flashProgress - 0.4) / 0.6) * 0.4;
        }
        
        ctx.fillStyle = flashColor + flashAlpha + ')';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.restore();
      }
    };
    
    raf = requestAnimationFrame(loop);
    
    return () => {
      cancelAnimationFrame(raf);
      audio.current.stopAllAudio();
      // Clear firework timeouts
      fireworkTimeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, [paused, onGameOver]);
  
  return (
    <div ref={containerRef} className="relative w-full h-screen bg-background overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      {isTouch && (
        <div
          className="absolute inset-0 z-10 select-none"
          onTouchStart={(e) => { 
            e.preventDefault(); 
            if (e.touches.length > 0 && !paused) { 
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
      
      <SurvivalHUD
        altitude={altitude}
        vx={vx}
        vy={vy}
        fuel={fuel}
        fuelCap={fuelCap}
        score={score}
        time={time}
        distance={distance}
        landings={landings}
        shieldActive={shieldActive}
        shieldTimer={shieldTimerRef.current}
        showGyroButton={isTouch}
        gyroActive={gyroscope.isActive}
        gyroPermission={gyroscope.permission}
        tiltAngle={gyroscope.tiltAngle}
        onEnableGyro={handleEnableGyro}
        onCalibrateGyro={handleCalibrateGyro}
      />
      
      {/* FPS Counter */}
      <div className="fixed bottom-4 right-4 z-20 pointer-events-none select-none">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded px-3 py-1.5">
          <div className="text-xs font-mono text-muted-foreground">
            {fps} FPS
          </div>
        </div>
      </div>
      
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-accent">PAUSED</h2>
            <Button onClick={() => setPaused(false)} variant="outline">
              Resume
            </Button>
          </div>
        </div>
      )}
      
      {/* Touch Controls */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-3 select-none">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
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
            variant="outline" 
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
        </div>
        <div className="text-xs text-muted-foreground">
          Tap screen: Thrust | Arrows/W: Keys
        </div>
      </div>
      
      {/* Fireworks Display */}
      {showFireworks && landingType && (
        <FireworksDisplay
          landingType={landingType}
          neonColor={getComputedStyle(document.documentElement).getPropertyValue('--neon')}
          fireworkCount={landings}
          onComplete={() => setShowFireworks(false)}
          onSkip={() => setShowFireworks(false)}
          lowGraphics={lowGraphics}
        />
      )}
    </div>
  );
};
