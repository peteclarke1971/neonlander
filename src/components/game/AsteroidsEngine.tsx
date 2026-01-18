import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AsteroidsHUD } from "./AsteroidsHUD";
import { getGlobalAudioManager } from "@/components/game/AudioManager";
import { createCountdownIntro, IntroHandle, mix } from "./intro/CountdownIntro";
import { CountdownOverlay } from "./intro/CountdownOverlay";
import { AsteroidsGameOverData, AsteroidsHUDSnapshot, AsteroidsGameState, Projectile } from "./types/asteroids";
import {
  generateAsteroidField,
  updateAsteroids,
  updateProjectiles,
  checkProjectileAsteroidCollisions,
  checkPlayerAsteroidCollision,
  drawAsteroids,
  drawProjectiles
} from "./systems/asteroids";
import { anyGamepad, loadProfile, readGamepad, saveProfile, setLastDeviceId, vibrate, getLastDeviceId, setUiMode } from "@/hooks/use-gamepad";
import { CursorManager } from "@/lib/cursorManager";
import { loadCursorConfig } from "@/lib/cursorConfig";
import { 
  createUFOState, 
  updateUFOState, 
  checkUFOPlayerCollision,
  checkUFOBulletPlayerCollision,
  checkPlayerBulletUFOCollision,
  checkUFOBulletAsteroidCollision,
  drawUFOs,
  drawUFOBullets
} from "./systems/ufo";
import { UFO_DIFFICULTY_PRESETS } from "./systems/ufoConfig";
import type { UFOState, UFOEvents } from "./types/ufo";

interface Props {
  difficulty: string;
  onExit: () => void;
  onGameOver: (data: AsteroidsGameOverData) => void;
  swapButtons?: boolean;
}

// Reference resolution for consistent gameplay
// NOTE: To revert zoom scaling, replace this function with the original getWorldDimensions:
// const getWorldDimensions = (canvasWidth: number, canvasHeight: number) => {
//   const dpr = Math.min(2, window.devicePixelRatio || 1);
//   return { width: canvasWidth / dpr, height: canvasHeight / dpr };
// };
const REFERENCE_WIDTH = 800;
const REFERENCE_HEIGHT = 600;

// Get world dimensions and scale factor for consistent gameplay
const getWorldDimensionsAndScale = (canvasWidth: number, canvasHeight: number) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const viewWidth = canvasWidth / dpr;
  const viewHeight = canvasHeight / dpr;
  
  // Calculate scale to maintain consistent gameplay
  // Use the smaller scale factor to ensure everything fits
  const scaleX = viewWidth / REFERENCE_WIDTH;
  const scaleY = viewHeight / REFERENCE_HEIGHT;
  const scale = Math.max(1, Math.min(scaleX, scaleY));
  
  return {
    width: REFERENCE_WIDTH,
    height: REFERENCE_HEIGHT,
    scale: scale,
    viewWidth: viewWidth,
    viewHeight: viewHeight
  };
};
const PLAYER_RADIUS = 8;
const RESPAWN_INVULNERABILITY = 3; // seconds

export const AsteroidsEngine: React.FC<Props> = ({ difficulty, onExit, onGameOver, swapButtons = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<AsteroidsHUDSnapshot>({ score: 0, lives: 3, wave: 1, ammo: -1, difficulty });
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [fps, setFps] = useState(0);
  const [touchOpacity, setTouchOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-touch-opacity');
      return saved ? JSON.parse(saved) : 10;
    } catch {
      return 10;
    }
  });
  
  // Countdown intro state
  const introRef = useRef<IntroHandle | null>(null);
  const [introState, setIntroState] = useState<any>({ phase: "inactive" });
  const [worldPaused, setWorldPaused] = useState(false);
  const invulnerabilityTimer = useRef(0);
  
  // Cursor management
  const cursorManager = useRef<CursorManager | null>(null);

  // Controls state
  const keys = useRef<{ left: boolean; right: boolean; thrust: boolean; fire: boolean }>({ 
    left: false, right: false, thrust: false, fire: false 
  });
  const thrustAnalog = useRef(0);
  const lastThrust = useRef(0);
  const lastFire = useRef(false);
  const audio = useRef(getGlobalAudioManager());
  // Gamepad profile/device state
  const gpProfileRef = useRef(loadProfile(getLastDeviceId()));
  const gpDeviceIdRef = useRef<string | null>(getLastDeviceId());
  const lastPauseDown = useRef(false);

  // Resize canvas
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

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (["a", "arrowleft"].includes(k)) keys.current.left = down;
      if (["d", "arrowright"].includes(k)) keys.current.right = down;
      if (["w", "arrowup"].includes(k)) keys.current.thrust = down;
      if (k === " ") { 
        e.preventDefault();
        keys.current.fire = down; 
      }
      
      if (down) audio.current.resume();
    };
    const kd = (e: KeyboardEvent) => { onKey(e, true); try { audio.current.resume(); } catch {} };
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  // Ensure UI mode is off during gameplay
  useEffect(() => { try { setUiMode(false); } catch {} }, []);

  // Cursor management setup
  useEffect(() => {
    if (!containerRef.current) return;
    
    const config = loadCursorConfig();
    cursorManager.current = new CursorManager(config);
    
    const isGameplayFn = () => !paused;
    cursorManager.current.attach(containerRef.current, isGameplayFn, 'global');
    cursorManager.current.forceHideCursor();
    
    return () => {
      cursorManager.current?.detach();
      cursorManager.current = null;
    };
  }, []);

  // Detect touch-capable devices
  useEffect(() => {
    try {
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints ?? 0) > 0 || (navigator as any).msMaxTouchPoints > 0;
      setIsTouch(!!hasTouch);
    } catch {
      setIsTouch(false);
    }
  }, []);

  // Main game loop
  useEffect(() => {
    if (paused) return;

    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    let raf: number;

    // Starfield (static twinkles) and shooting stars
    type Star = { x: number; y: number; size: number; baseA: number; tw: number; ph: number; bright: boolean };
    type Shooting = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
    type Shockwave = { x: number; y: number; life: number; max: number };
    type Debris = { x: number; y: number; vx: number; vy: number; angle: number; av: number; life: number; max: number; size: number; color: string };
    type ThrusterParticle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number };
    const stars: Star[] = [];
    const shooting: Shooting[] = [];
    const particles: Particle[] = [];
    const shockwaves: Shockwave[] = [];
    const debris: Debris[] = [];
    const thrusterParticles: ThrusterParticle[] = [];
    let flashT = 0;
    let cameraShake = 0;
    let nextShooting = 0.6 + Math.random() * 1.6;
    
    // Optimized thruster constants
    const THRUSTER_PARTICLE_COUNT = 3;

    const dprInit = Math.min(2, window.devicePixelRatio || 1);
    const pxW = c.width / dprInit;
    const pxH = c.height / dprInit;
    // Screen-space static stars covering full screen
    for (let i = 0; i < 320; i++) {
      const sx = Math.random() * pxW;
      const sy = Math.random() * pxH;
      const bright = Math.random() < 0.15;
      stars.push({ x: sx, y: sy, size: bright ? 2.4 : 1.4, baseA: bright ? 0.95 : 0.6, tw: 0.5 + Math.random() * 1.5, ph: Math.random() * Math.PI * 2, bright });
    }

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

    const spawnExplosion = (x: number, y: number) => {
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

    const spawnAsteroidDebris = (asteroid: { x: number; y: number; vx: number; vy: number; size: "large" | "medium" | "small" }, impactX: number, impactY: number) => {
      // Determine particle count based on asteroid size
      const particleCount = asteroid.size === "large" ? 30 : asteroid.size === "medium" ? 18 : 10;
      
      for (let i = 0; i < particleCount; i++) {
        // Random spread velocity with some inheritance from asteroid
        const spreadAngle = Math.random() * Math.PI * 2;
        const spreadSpeed = 50 + Math.random() * 100;
        const inheritFactor = 0.3;
        
        const vx = asteroid.vx * inheritFactor + Math.cos(spreadAngle) * spreadSpeed;
        const vy = asteroid.vy * inheritFactor + Math.sin(spreadAngle) * spreadSpeed;
        
        // Random debris properties
        const size = 1 + Math.random() * 3;
        const angle = Math.random() * Math.PI * 2;
        const av = (Math.random() - 0.5) * 8; // Angular velocity for tumbling
        const life = 0;
        const max = 1.5 + Math.random() * 1.0; // 1.5-2.5 seconds
        
        // Vary debris colors (grays and browns with slight neon tint)
        const hue = 20 + Math.random() * 40; // Brown/orange range
        const sat = 15 + Math.random() * 25; // Low saturation for rocky look
        const light = 40 + Math.random() * 30; // Medium lightness
        const color = `hsla(${hue}, ${sat}%, ${light}%, 1)`;
        
        // Small random offset from impact point
        const offsetX = (Math.random() - 0.5) * 15;
        const offsetY = (Math.random() - 0.5) * 15;
        
        debris.push({
          x: impactX + offsetX,
          y: impactY + offsetY,
          vx,
          vy,
          angle,
          av,
          life,
          max,
          size,
          color
        });
      }
    };

    // Get world dimensions and scale factor
    const worldInfo = getWorldDimensionsAndScale(c.width, c.height);
    const WORLD_WIDTH = worldInfo.width;
    const WORLD_HEIGHT = worldInfo.height;
    const scale = worldInfo.scale;

    // Game state
    const gameState = {
      player: {
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        vx: 0,
        vy: 0,
        angle: 0,
        thrust: 0,
        invulnerable: 0
      },
      asteroids: generateAsteroidField(1, WORLD_WIDTH, WORLD_HEIGHT, Math.floor(Math.random() * 1e9)),
      projectiles: [] as Projectile[],
      score: 0,
      lives: difficulty === "Easy" ? 5 : 3,
      wave: 1,
      ammo: -1,
      gameStarted: true,
      gameOver: false,
      paused: false,
      difficulty,
      elapsed: 0
    };

    // Initialize UFO system
    const baseSeed = Math.floor(Math.random() * 1e9);
    const ufoConfig = difficulty === "Easy" ? UFO_DIFFICULTY_PRESETS.easy : UFO_DIFFICULTY_PRESETS.normal;
    const ufoState = createUFOState(ufoConfig, baseSeed, "asteroids");
    
    // Initialize countdown intro
    if (!introRef.current) {
      introRef.current = createCountdownIntro();
      introRef.current.onDone(() => {
        setWorldPaused(false);
        invulnerabilityTimer.current = 1200; // 1.2 seconds invulnerability
        try { audio.current.playIntroGo(); } catch {}
      });
      
      // Start countdown with "freeze" variant for classic asteroids
      const introSeed = mix(baseSeed, "INTRO");
      introRef.current.start({
        variant: "freeze", 
        seed: introSeed,
        onTick: () => { try { audio.current.playIntroTick(); } catch {} },
        onGo: () => { try { audio.current.playIntroGo(); } catch {} }
      });
      setWorldPaused(true);
    }
    
    // UFO events
    const ufoEvents: UFOEvents = {
      onSpawn: (ufo) => {
        // Could add spawn sound here
        console.log(`UFO spawned: ${ufo.type}`);
      },
      onShotFired: (ufo, bullet) => {
        // UFO firing sound
        audio.current.click(); // Reuse existing sound for now
      },
      onDestroyed: (ufo, destroyedBy) => {
        // UFO destruction explosion
        spawnExplosion(ufo.x, ufo.y);
        gameState.score += ufo.type === "large" ? ufoConfig.largePoints : ufoConfig.smallPoints;
        audio.current.explosion();
      },
      onPing: (ufo) => {
        // UFO ping sound - could add specific UFO ping sound here
      }
    };

    let lastTime = performance.now();
    let lastFireTime = 0;
    let frameCount = 0;
    let lastFpsUpdate = lastTime;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 1/30);
      lastTime = now;

      frameCount++;
      if (now - lastFpsUpdate >= 500) {
        setFps((frameCount * 1000) / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;
      }

      gameState.elapsed += dt;
      
      // Update countdown intro
      if (introRef.current?.isActive()) {
        setIntroState(introRef.current.getCurrentState());
      }
      
      // Update invulnerability timer
      if (invulnerabilityTimer.current > 0) {
        invulnerabilityTimer.current -= dt * 1000;
      }
      
      // Handle gamepad input first to include it in skip logic
      const gp = anyGamepad();
      let rotInput = 0;
      let thrustInput = 0;
      let fireInput = false;

      if (gp) {
        const gpId = gp.id;
        if (gpDeviceIdRef.current !== gpId) {
          gpDeviceIdRef.current = gpId;
          setLastDeviceId(gpId);
          gpProfileRef.current = loadProfile(gpId);
        }

        const input = readGamepad(gp, gpProfileRef.current);
        rotInput = input.rotation;
        thrustInput = input.thrust;
        fireInput = input.buttons.abort; // Use abort button for fire
        
        // Also check d-pad for rotation
        if (input.ui.left) rotInput -= 1;
        if (input.ui.right) rotInput += 1;
      }

      // Handle gamepad pause input
      if (gp) {
        const input = readGamepad(gp, gpProfileRef.current);
        const pauseDown = input.buttons.pause;
        if (pauseDown && !lastPauseDown.current) setPaused(!paused);
        lastPauseDown.current = pauseDown;
      }

      // Skip countdown on input (keyboard OR gamepad)
      if (introRef.current?.isActive()) {
        const keyboardSkipInput = keys.current.fire || keys.current.thrust || keys.current.left || keys.current.right;
        const gamepadSkipInput = fireInput || thrustInput > 0 || Math.abs(rotInput) > 0;
        if ((keyboardSkipInput || gamepadSkipInput) && introRef.current.getCurrentState().canSkip) {
          introRef.current.skip();
        }
      }

      // Keyboard input
      if (keys.current.left) rotInput -= 1;
      if (keys.current.right) rotInput += 1;
      if (keys.current.thrust) thrustInput = 1;
      if (keys.current.fire) fireInput = true;

      // Player input
      const player = gameState.player;

      // Rotation
      const rotSpeed = 5; // radians per second
      player.angle += rotInput * rotSpeed * dt;

      // Thrust - no speed limit like lander
      if (thrustInput > 0) {
        const thrustPower = 400; // pixels per second squared
        const thrustX = Math.cos(player.angle - Math.PI / 2) * thrustPower * thrustInput;
        const thrustY = Math.sin(player.angle - Math.PI / 2) * thrustPower * thrustInput;
        player.vx += thrustX * dt;
        player.vy += thrustY * dt;
        
        // Set thrust state for both keyboard and controller
        player.thrust = thrustInput;
        
        // Optimized thruster particles - single nozzle
        for (let i = 0; i < THRUSTER_PARTICLE_COUNT; i++) {
          const spreadAngle = (Math.random() - 0.5) * 0.6;
          const thrustAngle = player.angle + Math.PI / 2 + spreadAngle;
          const baseSpeed = 80 + Math.random() * 40;
          
          const px = player.x + Math.cos(player.angle - Math.PI / 2) * -12;
          const py = player.y + Math.sin(player.angle - Math.PI / 2) * -12;
          
          thrusterParticles.push({
            x: px,
            y: py,
            vx: Math.cos(thrustAngle) * baseSpeed + player.vx * 0.3,
            vy: Math.sin(thrustAngle) * baseSpeed + player.vy * 0.3,
            life: 0,
            maxLife: 1.0
          });
        }
        
        audio.current.setThruster(thrustInput);
      } else {
        player.thrust = 0;
        audio.current.setThruster(0);
      }

      // Apply minimal drag
      const drag = 0.995; // Very light drag
      player.vx *= Math.pow(drag, dt);
      player.vy *= Math.pow(drag, dt);

      // Update player position with screen wrapping
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      if (player.x < 0) player.x = WORLD_WIDTH;
      if (player.x > WORLD_WIDTH) player.x = 0;
      if (player.y < 0) player.y = WORLD_HEIGHT;
      if (player.y > WORLD_HEIGHT) player.y = 0;

      // Update invulnerability
      if (gameState.player.invulnerable > 0) {
        gameState.player.invulnerable -= dt;
      }

      // Fire projectiles
      if (fireInput && now - lastFireTime > 150) { // 150ms fire rate limit
        const projectileSpeed = 400;
        const projectile: Projectile = {
          x: player.x + Math.cos(player.angle - Math.PI / 2) * 12,
          y: player.y + Math.sin(player.angle - Math.PI / 2) * 12,
          vx: player.vx + Math.cos(player.angle - Math.PI / 2) * projectileSpeed,
          vy: player.vy + Math.sin(player.angle - Math.PI / 2) * projectileSpeed,
          life: 1.5
        };
        gameState.projectiles.push(projectile);
        lastFireTime = now;
        audio.current.click();
      }

      // Shooting stars update
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.life > s.max) shooting.splice(i, 1);
      }

      // Spawn shooting stars periodically
      if (gameState.elapsed >= nextShooting) {
        nextShooting = gameState.elapsed + 0.6 + Math.random() * 1.6;
        spawnShooting();
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt; // gravity
        if (p.life > p.max) particles.splice(i, 1);
      }
      
      // Update thruster particles
      for (let i = thrusterParticles.length - 1; i >= 0; i--) {
        const p = thrusterParticles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life > p.maxLife) thrusterParticles.splice(i, 1);
      }

      // Update shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life += dt;
        if (sw.life > sw.max) shockwaves.splice(i, 1);
      }

      // Update debris particles
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.life += dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.angle += d.av * dt;
        
        // Apply light drag and gravity
        d.vx *= Math.pow(0.98, dt);
        d.vy *= Math.pow(0.98, dt);
        d.vy += 100 * dt; // Light gravity
        
        // Screen wrapping for debris
        if (d.x < 0) d.x = WORLD_WIDTH;
        if (d.x > WORLD_WIDTH) d.x = 0;
        if (d.y < 0) d.y = WORLD_HEIGHT;
        if (d.y > WORLD_HEIGHT) d.y = 0;
        
        // Remove expired debris
        if (d.life > d.max) debris.splice(i, 1);
      }

      // Update flash and camera shake
      if (flashT > 0) flashT -= dt;
      if (cameraShake > 0) cameraShake -= 120 * dt;

      // Check for new waves
      if (gameState.asteroids.length === 0) {
        gameState.wave++;
        setHud(prev => ({ ...prev, wave: gameState.wave }));
        gameState.asteroids.push(
          ...generateAsteroidField(
            gameState.wave,
            WORLD_WIDTH,
            WORLD_HEIGHT,
            Math.floor(Math.random() * 1e9)
          )
        );
      }

      // Update projectiles
      updateProjectiles(gameState.projectiles, dt, WORLD_WIDTH, WORLD_HEIGHT);

      // Update asteroids
      updateAsteroids(gameState.asteroids, dt, WORLD_WIDTH, WORLD_HEIGHT);

      // Update UFO system
      const smallAsteroidCount = gameState.asteroids.filter(a => a.size === "small").length;
      updateUFOState(
        ufoState,
        dt,
        gameState.elapsed,
        gameState.score,
        gameState.wave,
        gameState.player.x,
        gameState.player.y,
        WORLD_WIDTH,
        WORLD_HEIGHT,
        smallAsteroidCount,
        baseSeed,
        "asteroids",
        ufoEvents
      );

      // Collision detection
      const { destroyedAsteroids, destroyedProjectiles, newAsteroids, score } =
        checkProjectileAsteroidCollisions(
          gameState.projectiles,
          gameState.asteroids,
          Math.random
        );

      // Apply collision outcomes and spawn debris
      if (destroyedProjectiles.length && destroyedAsteroids.length) {
        // Spawn debris for each destroyed asteroid
        for (let i = 0; i < destroyedAsteroids.length; i++) {
          const asteroidIndex = destroyedAsteroids[i];
          const projectileIndex = destroyedProjectiles[i];
          if (asteroidIndex < gameState.asteroids.length && projectileIndex < gameState.projectiles.length) {
            const asteroid = gameState.asteroids[asteroidIndex];
            const projectile = gameState.projectiles[projectileIndex];
            // Spawn debris at the impact point (projectile position)
            spawnAsteroidDebris(asteroid, projectile.x, projectile.y);
          }
        }
      }
      
      if (destroyedProjectiles.length) {
        for (let i = destroyedProjectiles.length - 1; i >= 0; i--) {
          gameState.projectiles.splice(destroyedProjectiles[i], 1);
        }
      }
      if (destroyedAsteroids.length) {
        for (let i = destroyedAsteroids.length - 1; i >= 0; i--) {
          gameState.asteroids.splice(destroyedAsteroids[i], 1);
        }
        // Play explosion SFX when an asteroid is destroyed
        try { audio.current.explosion(); } catch {}
      }
      if (newAsteroids.length) {
        gameState.asteroids.push(...newAsteroids);
      }
      if (score) {
        gameState.score += score;
      }

      // UFO collision detection
      // Check player vs UFO collision
      if (gameState.player.invulnerable <= 0) {
        const hitUFO = checkUFOPlayerCollision(ufoState.ufos, gameState.player.x, gameState.player.y, PLAYER_RADIUS);
        if (hitUFO) {
          // Remove the UFO and destroy player
          const ufoIndex = ufoState.ufos.indexOf(hitUFO);
          if (ufoIndex !== -1) {
            ufoState.ufos.splice(ufoIndex, 1);
            ufoEvents.onDestroyed?.(hitUFO, "player");
          }
          
          // Player hit - lose a life
          gameState.lives--;
          gameState.player.invulnerable = RESPAWN_INVULNERABILITY;
          
          // Spawn explosion at player position
          spawnExplosion(gameState.player.x, gameState.player.y);
          
          // Reset player position and velocity
          gameState.player.x = WORLD_WIDTH / 2;
          gameState.player.y = WORLD_HEIGHT / 2;
          gameState.player.vx = 0;
          gameState.player.vy = 0;
          gameState.player.angle = 0;

          audio.current.explosion();
          
          if (gameState.lives <= 0) {
            onGameOver({
              score: gameState.score,
              wave: gameState.wave,
              difficulty: gameState.difficulty,
              elapsed: gameState.elapsed,
              cause: "destroyed"
            });
            return;
          }
        }
      }

      // Check player vs UFO bullet collision
      if (gameState.player.invulnerable <= 0) {
        const hitBullet = checkUFOBulletPlayerCollision(ufoState.bullets, gameState.player.x, gameState.player.y, PLAYER_RADIUS);
        if (hitBullet) {
          // Remove the bullet
          const bulletIndex = ufoState.bullets.indexOf(hitBullet);
          if (bulletIndex !== -1) {
            ufoState.bullets.splice(bulletIndex, 1);
          }
          
          // Player hit - lose a life
          gameState.lives--;
          gameState.player.invulnerable = RESPAWN_INVULNERABILITY;
          
          // Spawn explosion at player position
          spawnExplosion(gameState.player.x, gameState.player.y);
          
          // Reset player position and velocity
          gameState.player.x = WORLD_WIDTH / 2;
          gameState.player.y = WORLD_HEIGHT / 2;
          gameState.player.vx = 0;
          gameState.player.vy = 0;
          gameState.player.angle = 0;

          audio.current.explosion();
          
          if (gameState.lives <= 0) {
            onGameOver({
              score: gameState.score,
              wave: gameState.wave,
              difficulty: gameState.difficulty,
              elapsed: gameState.elapsed,
              cause: "destroyed"
            });
            return;
          }
        }
      }

      // Check player bullet vs UFO collision
      const playerBulletUFOHit = checkPlayerBulletUFOCollision(gameState.projectiles, ufoState.ufos);
      if (playerBulletUFOHit) {
        // Remove bullet and UFO
        gameState.projectiles.splice(playerBulletUFOHit.bulletIndex, 1);
        const ufoIndex = ufoState.ufos.indexOf(playerBulletUFOHit.ufo);
        if (ufoIndex !== -1) {
          ufoState.ufos.splice(ufoIndex, 1);
          ufoEvents.onDestroyed?.(playerBulletUFOHit.ufo, "player");
        }
      }

      // Check UFO bullet vs asteroid collision
      const ufoBulletAsteroidHit = checkUFOBulletAsteroidCollision(ufoState.bullets, gameState.asteroids, Math.random);
      if (ufoBulletAsteroidHit) {
        // Remove bullet and asteroid, add fragments
        ufoState.bullets.splice(ufoBulletAsteroidHit.bulletIndex, 1);
        gameState.asteroids.splice(ufoBulletAsteroidHit.asteroidIndex, 1);
        gameState.asteroids.push(...ufoBulletAsteroidHit.newAsteroids);
        audio.current.explosion();
      }

      // Keep HUD in sync (score/lives) minimally
      setHud(prev => ({ ...prev, score: gameState.score, lives: gameState.lives }));
      
      if (gameState.player.invulnerable <= 0) {
        if (checkPlayerAsteroidCollision(gameState.player.x, gameState.player.y, PLAYER_RADIUS, gameState.asteroids)) {
          // Player hit - lose a life
          gameState.lives--;
          gameState.player.invulnerable = RESPAWN_INVULNERABILITY;
          
          // Spawn explosion at player position
          spawnExplosion(gameState.player.x, gameState.player.y);
          
          // Reset player position and velocity
          gameState.player.x = WORLD_WIDTH / 2;
          gameState.player.y = WORLD_HEIGHT / 2;
          gameState.player.vx = 0;
          gameState.player.vy = 0;
          gameState.player.angle = 0;

          audio.current.explosion();
          
          if (gameState.lives <= 0) {
            onGameOver({
              score: gameState.score,
              wave: gameState.wave,
              difficulty: gameState.difficulty,
              elapsed: gameState.elapsed,
              cause: "destroyed"
            });
            return;
          }
        }
      }

      render();
    };

    const render = () => {
      const w = c.width;
      const h = c.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      
      ctx.clearRect(0, 0, w, h);
      
      // Black background
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, w, h);

      // Draw starfield in screen space first
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawStars(ctx);
      ctx.restore();

      // Set up viewport with camera shake and zoom scale
      ctx.save();
      ctx.scale(dpr, dpr);
      
      // Center the scaled game world on the screen
      const offsetX = (worldInfo.viewWidth - WORLD_WIDTH * scale) / 2;
      const offsetY = (worldInfo.viewHeight - WORLD_HEIGHT * scale) / 2;
      ctx.translate(offsetX, offsetY);
      
      // Apply zoom scale to maintain consistent gameplay
      ctx.scale(scale, scale);
      
      const shakeX = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
      const shakeY = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
      ctx.translate(shakeX, shakeY);

      // Draw game objects
      const neonColors = [
        "hsl(315, 100%, 70%)", // magenta
        "hsl(210, 100%, 70%)", // cyan  
        "hsl(120, 100%, 70%)", // green
        "hsl(60, 100%, 70%)",  // yellow
        "hsl(15, 100%, 70%)",  // orange
        "hsl(270, 100%, 70%)", // purple
        "hsl(345, 100%, 70%)"  // hot pink
      ];
      const colorIndex = (gameState.wave - 1) % neonColors.length;
      const neonColor = neonColors[colorIndex];

      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 8;

      // Draw asteroids
      drawAsteroids(ctx, gameState.asteroids, neonColor);

      // Draw projectiles  
      drawProjectiles(ctx, gameState.projectiles, neonColor);

      // Draw UFOs and their bullets
      drawUFOs(ctx, ufoState.ufos);
      drawUFOBullets(ctx, ufoState.bullets);

      // Draw player ship if not invulnerable or blinking
      if (gameState.player.invulnerable <= 0 || Math.floor(gameState.elapsed * 8) % 2 === 0) {
        drawPlayer(ctx, gameState.player, neonColor, gameState.player.thrust > 0);
      }
      
      // Draw shield bubble during invulnerability period
      if (invulnerabilityTimer.current > 0) {
        const currentTime = performance.now() / 1000;
        const bubbleRadius = 25;
        
        ctx.save();
        ctx.translate(gameState.player.x, gameState.player.y);
        
        // Shimmer animation
        const shimmerPhase = currentTime * 3;
        const shimmerAlpha = 0.3 + Math.sin(shimmerPhase) * 0.1;
        
        // Fade out as invulnerability expires (last 300ms)
        const fadeAlpha = Math.min(1, invulnerabilityTimer.current / 300);
        
        // Bubble outline with purple glow
        ctx.strokeStyle = `hsla(280, 100%, 85%, ${(shimmerAlpha + 0.3) * fadeAlpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = "hsla(280, 100%, 70%, 0.8)";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, bubbleRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Prismatic sheen
        const sheenAngle = shimmerPhase * 0.5;
        const grad = ctx.createLinearGradient(
          Math.cos(sheenAngle) * bubbleRadius, Math.sin(sheenAngle) * bubbleRadius,
          -Math.cos(sheenAngle) * bubbleRadius, -Math.sin(sheenAngle) * bubbleRadius
        );
        grad.addColorStop(0, `hsla(260, 100%, 70%, ${0.1 * fadeAlpha})`);
        grad.addColorStop(0.5, `hsla(300, 100%, 80%, ${0.25 * fadeAlpha})`);
        grad.addColorStop(1, `hsla(260, 100%, 70%, ${0.1 * fadeAlpha})`);
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, bubbleRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }

      // Draw particles
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const t = 1 - p.life / p.max;
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      
      // Draw thruster particles
      for (const p of thrusterParticles) {
        const age = p.life / p.maxLife;
        const alpha = 1 - age;
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = `hsl(30, 100%, ${70 - age * 20}%)`;
        ctx.shadowColor = `hsl(30, 100%, ${70 - age * 20}%)`;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Draw debris particles
      ctx.save();
      ctx.shadowBlur = 4;
      for (const d of debris) {
        const t = d.life / d.max;
        const alpha = Math.max(0, 1 - t);
        ctx.globalAlpha = alpha;
        
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        
        // Draw small irregular debris pieces
        ctx.fillStyle = d.color;
        ctx.shadowColor = d.color;
        
        // Slightly shrink as it fades
        const scale = 1 - t * 0.3;
        ctx.scale(scale, scale);
        
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // Draw shockwaves
      for (const sw of shockwaves) {
        const t = sw.life / sw.max;
        const radius = t * 180;
        ctx.strokeStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 6 * (1 - t);
        ctx.globalAlpha = 1 - t;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // Flash effect overlay
      if (flashT > 0) {
        const intensity = flashT / 0.28;
        ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.4})`;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const drawStars = (ctx: CanvasRenderingContext2D) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wpx = ctx.canvas.width / dpr;
      const hpx = ctx.canvas.height / dpr;
      
      const neonColors = [
        "hsl(315, 100%, 70%)", // magenta
        "hsl(210, 100%, 70%)", // cyan  
        "hsl(120, 100%, 70%)", // green
        "hsl(60, 100%, 70%)",  // yellow
        "hsl(15, 100%, 70%)",  // orange
        "hsl(270, 100%, 70%)", // purple
        "hsl(345, 100%, 70%)"  // hot pink
      ];
      const colorIndex = (gameState.wave - 1) % neonColors.length;
      const starColor = neonColors[colorIndex];
      
      ctx.save();
      ctx.shadowColor = starColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = starColor;
      // Map CSS px to device px
      ctx.scale(dpr, dpr);
      
      // Static twinkling stars in screen space
      for (const s of stars) {
        const a = s.baseA * (0.7 + 0.3 * Math.sin(s.ph + gameState.elapsed * s.tw));
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
        ctx.strokeStyle = starColor;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, player: { x: number; y: number; angle: number }, color: string, thrusting: boolean) => {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;

      // Draw ship triangle
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(-8, 10);
      ctx.lineTo(8, 10);
      ctx.closePath();
      ctx.stroke();

      // Landing legs (same as lunar lander)
      ctx.beginPath();
      ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);  // Left leg
      ctx.moveTo(6, 8); ctx.lineTo(12, 12);    // Right leg
      ctx.stroke();

      ctx.restore();
    };

    // Update HUD
    setHud({
      score: gameState.score,
      lives: gameState.lives,
      wave: gameState.wave,
      ammo: -1,
      difficulty: gameState.difficulty
    });

    // Reset audio and preload SFX, then start level music for Asteroids
    try { audio.current.resetForNewGame(); } catch {}
    try { audio.current.preloadSFX(); } catch {}
    try { audio.current.playLevelTrackByIndex(0); } catch {}

    raf = requestAnimationFrame(loop);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      try { audio.current.stopThruster(); } catch {}
      try { (audio.current as any).stopLevelMusic(); } catch {}
      try { (audio.current as any).stopFuelAlarm(); } catch {}
      try { (audio.current as any).stopMissionSuccess(); } catch {}
      try { (audio.current as any).stopTitleMusic(); } catch {}
      try { (audio.current as any).stopAllAudio(); } catch {}
    };
  }, [difficulty, onExit, onGameOver, paused]);

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-background overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full select-none"
        style={{ imageRendering: "pixelated" }}
      />

      <AsteroidsHUD {...hud} />

      <div className="pointer-events-none absolute bottom-2 right-3 z-40">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded px-2 py-1 text-[10px] font-mono text-muted-foreground">
          FPS: {Math.round(fps)}
        </div>
      </div>

      {paused && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-card border border-border rounded-lg p-6 text-center space-y-4">
            <h2 className="text-2xl font-bold text-accent">PAUSED</h2>
            <p className="text-muted-foreground">Press ESC or gamepad Start to resume</p>
            <Button onClick={() => { try { audio.current.resume(); } catch {}; setPaused(false); }} variant="outline">
              Resume Game
            </Button>
          </div>
        </div>
      )}

      {/* Touch controls overlay for mobile */}
      {isTouch && (
        <div className="absolute inset-0 pointer-events-none z-10 select-none" style={{ opacity: 0.025 + (touchOpacity - 1) * 0.108333 }}>
          {/* Right side button - moved in from corner */}
          <div
            className={`absolute bottom-8 right-8 w-28 h-28 rounded-full border-2 border-accent/50 bg-accent/10 flex items-center justify-center pointer-events-auto select-none ${swapButtons ? 'bg-red-600/20 border-red-600/50' : 'bg-blue-600/20 border-blue-600/50'}`}
            onTouchStart={() => { audio.current.resume(); if (swapButtons) { keys.current.fire = true; } else { keys.current.thrust = true; } }}
            onTouchEnd={() => { if (swapButtons) { keys.current.fire = false; } else { keys.current.thrust = false; } }}
          >
            <span className="text-sm text-accent select-none">{swapButtons ? 'FIRE' : 'THRUST'}</span>
          </div>
          
          {/* Left side button - moved in from corner */}
          <div
            className={`absolute bottom-8 left-8 w-28 h-28 rounded-full border-2 border-accent/50 bg-accent/10 flex items-center justify-center pointer-events-auto select-none ${swapButtons ? 'bg-blue-600/20 border-blue-600/50' : 'bg-red-600/20 border-red-600/50'}`}
            onTouchStart={() => { audio.current.resume(); if (swapButtons) { keys.current.thrust = true; } else { keys.current.fire = true; } }}
            onTouchEnd={() => { if (swapButtons) { keys.current.thrust = false; } else { keys.current.fire = false; } }}
          >
            <span className="text-sm text-accent select-none">{swapButtons ? 'THRUST' : 'FIRE'}</span>
          </div>
          
          {/* Touch rotation areas - positioned higher to avoid collision */}
          <div
            className="absolute bottom-40 left-8 w-24 h-24 rounded-full border-2 border-accent/50 bg-accent/10 flex items-center justify-center pointer-events-auto select-none"
            onTouchStart={() => { audio.current.resume(); keys.current.left = true; }}
            onTouchEnd={() => { keys.current.left = false; }}
          >
            <span className="text-sm text-accent select-none">←</span>
          </div>
          
          <div
            className="absolute bottom-40 right-8 w-24 h-24 rounded-full border-2 border-accent/50 bg-accent/10 flex items-center justify-center pointer-events-auto select-none"
            onTouchStart={() => { audio.current.resume(); keys.current.right = true; }}
            onTouchEnd={() => { keys.current.right = false; }}
          >
            <span className="text-sm text-accent select-none">→</span>
          </div>
        </div>
      )}
      
      {/* Countdown Overlay */}
      <CountdownOverlay 
        state={introState} 
        canvasRef={canvasRef}
        shipPosition={{ x: 400, y: 300 }} // Will be updated with actual position
      />
      
      {/* Invulnerability shield bubble - rendered on canvas in game loop */}
    </div>
  );
};