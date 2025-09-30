import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AsteroidsColorHUD } from "./AsteroidsColorHUD";
import { AudioManager } from "@/components/game/AudioManager";
import { ColorOrderGameOverData, ColorOrderHUDSnapshot, ColorOrderGameState, ColorProjectile } from "./types/asteroidsColor";
import {
  generateAsteroidField,
  updateAsteroids,
  updateProjectiles,
  checkProjectileAsteroidCollisions,
  checkPlayerAsteroidCollision,
  drawColorAsteroids,
  drawColorProjectiles,
  mulberry32,
  mixSeed,
  ASTEROID_COLORS
} from "./systems/asteroidsColor";
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
import { UFO_DIFFICULTY_PRESETS, getScaledConfig } from "./systems/ufoConfig";
import type { UFOState, UFOEvents } from "./types/ufo";

interface Props {
  difficulty: string;
  onExit: () => void;
  onGameOver: (data: ColorOrderGameOverData) => void;
  swapButtons?: boolean;
}

// Reference resolution for consistent gameplay
const REFERENCE_WIDTH = 800;
const REFERENCE_HEIGHT = 600;

// Get world dimensions and scale factor for consistent gameplay
const getWorldDimensionsAndScale = (canvasWidth: number, canvasHeight: number) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const viewWidth = canvasWidth / dpr;
  const viewHeight = canvasHeight / dpr;
  
  // Calculate scale to fit the world in the viewport
  const scaleX = viewWidth / REFERENCE_WIDTH;
  const scaleY = viewHeight / REFERENCE_HEIGHT;
  const scale = Math.min(scaleX, scaleY); // No minimum - scale down to fit any screen
  
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

export const AsteroidsColorEngine: React.FC<Props> = ({ difficulty, onExit, onGameOver, swapButtons = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<ColorOrderHUDSnapshot>({ 
    score: 0, 
    lives: difficulty === "Easy" ? 5 : 3, 
    wave: 1, 
    ammo: -1, 
    difficulty,
    target: "green"
  });
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [fps, setFps] = useState(0);
  
  // Cursor management
  const cursorManager = useRef<CursorManager | null>(null);

  // Controls state
  const keys = useRef<{ left: boolean; right: boolean; thrust: boolean; fire: boolean }>({ 
    left: false, right: false, thrust: false, fire: false 
  });
  const thrustAnalog = useRef(0);
  const lastThrust = useRef(0);
  const lastFire = useRef(false);
  const audio = useRef<AudioManager>(new AudioManager());
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
      if (k === "escape" && down) {
        e.preventDefault();
        setPaused(!paused);
      }
      
      if (down) audio.current.resume();
    };
    const kd = (e: KeyboardEvent) => { onKey(e, true); try { audio.current.resume(); } catch {} };
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [paused]);

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

  // Game state
  const game = useRef<ColorOrderGameState>({
    player: { x: REFERENCE_WIDTH/2, y: REFERENCE_HEIGHT/2, vx: 0, vy: 0, angle: 0, thrust: 0, invulnerable: 0 },
    asteroids: [],
    projectiles: [],
    score: 0,
    lives: difficulty === "Easy" ? 5 : 3,
    wave: 1,
    ammo: -1,
    target: "green",
    gameStarted: false,
    gameOver: false,
    paused: false,
    elapsed: 0
  });

  const worldSeed = useRef(Math.floor(Math.random() * 1000000));
  const gameStartTime = useRef(Date.now());
  const lastTime = useRef(0);
  const lastFireTime = useRef(0);
  const frameCount = useRef(0);
  const gameOverNotified = useRef(false);

  // Progressive UFO difficulty based on wave
  const getUFOConfig = () => {
    let baseConfig = UFO_DIFFICULTY_PRESETS.easy;
    
    // No UFOs in first 2 waves for Easy/Normal
    if ((difficulty === "Easy" || difficulty === "Normal") && game.current.wave <= 2) {
      return { ...baseConfig, spawnInterval: 999999 }; // Effectively disable
    }
    
    // Start with easy UFOs and gradually increase difficulty
    if (game.current.wave <= 4) {
      baseConfig = UFO_DIFFICULTY_PRESETS.easy;
    } else if (game.current.wave <= 8) {
      baseConfig = UFO_DIFFICULTY_PRESETS.normal;
    } else {
      baseConfig = UFO_DIFFICULTY_PRESETS.hard;
    }
    
    // Apply scaling based on score and wave
    return getScaledConfig(baseConfig, game.current.score, game.current.wave);
  };

  const ufoState = useRef<UFOState>(createUFOState(getUFOConfig(), worldSeed.current, "asteroids-color"));

  // Main game loop with enhanced starfield
  useEffect(() => {
    if (paused) return;

    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    let raf: number;

    // Enhanced starfield with shooting stars (copied from AsteroidsEngine)
    type Star = { x: number; y: number; size: number; baseA: number; tw: number; ph: number; bright: boolean };
    type Shooting = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
    type Shockwave = { x: number; y: number; life: number; max: number };
    type Debris = { x: number; y: number; vx: number; vy: number; angle: number; av: number; life: number; max: number; size: number; color: string };
    const stars: Star[] = [];
    const shooting: Shooting[] = [];
    const particles: Particle[] = [];
    const shockwaves: Shockwave[] = [];
    const debris: Debris[] = [];
    let flashT = 0;
    let cameraShake = 0;
    let nextShooting = 0.6 + Math.random() * 1.6;

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
      
      const side = Math.floor(Math.random() * 4);
      let sx, sy, svx, svy;
      
      const speed = 200 + Math.random() * 300;
      if (side === 0) { // top
        sx = Math.random() * viewWpx;
        sy = -20;
        svx = (Math.random() - 0.5) * speed * 0.5;
        svy = speed;
      } else if (side === 1) { // right
        sx = viewWpx + 20;
        sy = Math.random() * viewHpx;
        svx = -speed;
        svy = (Math.random() - 0.5) * speed * 0.5;
      } else if (side === 2) { // bottom
        sx = Math.random() * viewWpx;
        sy = viewHpx + 20;
        svx = (Math.random() - 0.5) * speed * 0.5;
        svy = -speed;
      } else { // left
        sx = -20;
        sy = Math.random() * viewHpx;
        svx = speed;
        svy = (Math.random() - 0.5) * speed * 0.5;
      }
      
      shooting.push({ x: sx, y: sy, vx: svx, vy: svy, life: 0, max: 1.2 + Math.random() * 0.8 });
    };

    const spawnExplosion = (x: number, y: number) => {
      // Add screen flash and camera shake
      flashT = 0.28;
      cameraShake = 24;
      
      // Spawn explosion particles
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const speed = 80 + Math.random() * 60;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          max: 0.8 + Math.random() * 0.4,
          color: i % 2 ? "hsl(315, 100%, 70%)" : "hsl(210, 100%, 70%)"
        });
      }
      
      // Add shockwave
      shockwaves.push({ x, y, life: 0, max: 0.8 });
    };

    const spawnAsteroidDebris = (asteroid: any, impactX: number, impactY: number) => {
      const colors = ["hsl(120, 100%, 70%)", "hsl(60, 100%, 70%)", "hsl(15, 100%, 70%)"];
      const debrisColor = colors[Math.floor(Math.random() * colors.length)];
      
      // Spawn 8-12 debris pieces at the impact point
      const count = 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 80;
        const size = 2 + Math.random() * 4;
        
        debris.push({
          x: impactX,
          y: impactY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          angle: Math.random() * Math.PI * 2,
          av: (Math.random() - 0.5) * 8,
          life: 0,
          max: 2 + Math.random() * 2,
          size,
          color: debrisColor
        });
      }
    };

    const loop = (timestamp: number) => {
      if (!game.current.gameStarted) {
        raf = requestAnimationFrame(loop);
        return;
      }
      if (game.current.gameOver) {
        if (!gameOverNotified.current) {
          gameOverNotified.current = true;
          const elapsed = (Date.now() - gameStartTime.current) / 1000;
          onGameOver({
            score: game.current.score,
            wave: game.current.wave,
            cause: "destroyed",
            difficulty,
            elapsed,
            seed: worldSeed.current
          });
        }
        return;
      }

      // Delta time calculation
      let dt = lastTime.current ? (timestamp - lastTime.current) / 1000 : 0;
      dt = Math.min(dt, 1/30); // Cap to 30fps minimum
      lastTime.current = timestamp;
      game.current.elapsed = (timestamp - gameStartTime.current) / 1000;

      if (paused) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const { width: WORLD_WIDTH, height: WORLD_HEIGHT, scale, viewWidth, viewHeight } = getWorldDimensionsAndScale(canvas.width, canvas.height);
      const w = viewWidth;
      const h = viewHeight;

      // Clear screen
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, w, h);

      const neonColors = [
        "hsl(315, 100%, 70%)", // magenta
        "hsl(210, 100%, 70%)", // cyan  
        "hsl(120, 100%, 70%)", // green
        "hsl(60, 100%, 70%)",  // yellow
        "hsl(15, 100%, 70%)",  // orange
        "hsl(270, 100%, 70%)", // purple
        "hsl(345, 100%, 70%)"  // hot pink
      ];
      const colorIndex = (game.current.wave - 1) % neonColors.length;
      const neonColor = neonColors[colorIndex];

      // Draw starfield in screen space BEFORE world transform
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wpx = ctx.canvas.width / dpr;
      const hpx = ctx.canvas.height / dpr;
      
      ctx.save();
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = neonColor;
      ctx.scale(dpr, dpr);
      
      // Static twinkling stars in screen space
      for (const s of stars) {
        const a = s.baseA * (0.7 + 0.3 * Math.sin(s.ph + game.current.elapsed * s.tw));
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
        ctx.strokeStyle = neonColor;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Apply world scaling and centering with camera shake
      ctx.save();
      const offsetX = (w - WORLD_WIDTH * scale) / 2;
      const offsetY = (h - WORLD_HEIGHT * scale) / 2;
      const shakeX = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
      const shakeY = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
      ctx.translate(offsetX + shakeX, offsetY + shakeY);
      ctx.scale(scale, scale);

      // Handle input (combine keyboard, gamepad, and touch)
      const gp = anyGamepad();
      if (gp) {
        const profile = gpProfileRef.current;
        const input = readGamepad(gp, profile);
        
        // Map gamepad to keyboard-style controls
        keys.current.left = input.buttons.rotateLeft || input.rotation < -0.3;
        keys.current.right = input.buttons.rotateRight || input.rotation > 0.3;
        keys.current.thrust = input.thrust > 0.1;
        thrustAnalog.current = input.thrust;
        
        // Fire button with exact same logic as main asteroids
        const firePressed = swapButtons ? (input.thrust > 0.5) : (gp.buttons[1]?.pressed || false);
        keys.current.fire = firePressed;
        
        // Pause
        if (input.buttons.pause && !lastPauseDown.current) {
          setPaused(!paused);
        }
        lastPauseDown.current = input.buttons.pause;
      }

      // Touch input is now directly setting keys.current, no need to merge

      const player = game.current.player;
      const now = Date.now();

      // Player rotation
      if (keys.current.left) {
        player.angle -= 5 * dt; // 5 radians/second
      }
      if (keys.current.right) {
        player.angle += 5 * dt;
      }

      // Player thrust with analog support
      if (keys.current.thrust) {
        const thrustPower = thrustAnalog.current > 0 ? thrustAnalog.current : 1.0;
        const thrustInput = thrustPower * 1.2; // Slightly faster than main asteroids
        
        const thrustX = Math.cos(player.angle - Math.PI / 2) * 180 * thrustInput;
        const thrustY = Math.sin(player.angle - Math.PI / 2) * 180 * thrustInput;
        
        player.vx += thrustX * dt;
        player.vy += thrustY * dt;
        
        player.thrust = thrustInput;
        audio.current.setThruster(thrustInput);
      } else {
        player.thrust = 0;
        audio.current.setThruster(0);
      }

      // Apply minimal drag
      const drag = 0.995;
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
      if (game.current.player.invulnerable > 0) {
        game.current.player.invulnerable -= dt;
      }

      // Fire projectiles with rate limiting
      if (keys.current.fire && now - lastFireTime.current > 150) {
        const projectileSpeed = 400;
        const projectile: ColorProjectile = {
          x: player.x + Math.cos(player.angle - Math.PI / 2) * 12,
          y: player.y + Math.sin(player.angle - Math.PI / 2) * 12,
          vx: player.vx + Math.cos(player.angle - Math.PI / 2) * projectileSpeed,
          vy: player.vy + Math.sin(player.angle - Math.PI / 2) * projectileSpeed,
          life: 1.5
        };
        game.current.projectiles.push(projectile);
        lastFireTime.current = now;
        audio.current.click();
      }

      // Update game objects
      updateAsteroids(game.current.asteroids, dt, WORLD_WIDTH, WORLD_HEIGHT);
      updateProjectiles(game.current.projectiles, dt, WORLD_WIDTH, WORLD_HEIGHT);

      // Progressive UFO system
      ufoState.current.config = getUFOConfig();
      updateUFOState(
        ufoState.current,
        dt,
        game.current.elapsed,
        game.current.score,
        game.current.wave,
        game.current.player.x,
        game.current.player.y,
        WORLD_WIDTH,
        WORLD_HEIGHT,
        0,
        worldSeed.current,
        "asteroids-color",
        {
          onSpawn: () => {},
          onDestroyed: (ufo, cause) => {
            if (cause === "player") {
              game.current.score += 500;
              spawnExplosion(ufo.x, ufo.y);
            }
          }
        }
      );

      // Collision detection
      const { destroyedAsteroids, destroyedProjectiles, newAsteroids, score, wrongHits } =
        checkProjectileAsteroidCollisions(
          game.current.projectiles,
          game.current.asteroids,
          game.current.target,
          difficulty,
          player.x,
          player.y,
          mulberry32(worldSeed.current + game.current.score)
        );

      // Handle collision results
      if (destroyedProjectiles.length && destroyedAsteroids.length) {
        for (let i = 0; i < destroyedAsteroids.length; i++) {
          const asteroidIndex = destroyedAsteroids[i];
          const projectileIndex = destroyedProjectiles[i];
          if (asteroidIndex < game.current.asteroids.length && projectileIndex < game.current.projectiles.length) {
            const asteroid = game.current.asteroids[asteroidIndex];
            const projectile = game.current.projectiles[projectileIndex];
            spawnAsteroidDebris(asteroid, projectile.x, projectile.y);
          }
        }
      }
      
      if (destroyedProjectiles.length) {
        for (let i = destroyedProjectiles.length - 1; i >= 0; i--) {
          game.current.projectiles.splice(destroyedProjectiles[i], 1);
        }
      }
      if (destroyedAsteroids.length) {
        for (let i = destroyedAsteroids.length - 1; i >= 0; i--) {
          game.current.asteroids.splice(destroyedAsteroids[i], 1);
        }
        audio.current.explosion();
      }
      if (newAsteroids.length) {
        game.current.asteroids.push(...newAsteroids);
      }
      if (score) {
        game.current.score += score;
      }

      // Player-asteroid collision
      if (game.current.player.invulnerable <= 0) {
        if (checkPlayerAsteroidCollision(player.x, player.y, PLAYER_RADIUS, game.current.asteroids)) {
          game.current.lives--;
          game.current.player.invulnerable = RESPAWN_INVULNERABILITY;
          spawnExplosion(player.x, player.y);
          vibrate(300, 0.5, 0.8);
          
          if (game.current.lives <= 0) {
            game.current.gameOver = true;
          }
        }
      }

      // Check target phase advancement
      const currentTargetAsteroids = game.current.asteroids.filter(a => a.color === game.current.target);
      if (currentTargetAsteroids.length === 0) {
        // Move to next target color
        if (game.current.target === "green") {
          game.current.target = "amber";
        } else if (game.current.target === "amber") {
          game.current.target = "red";  
        } else {
          // All colors cleared, advance to next wave
          game.current.wave++;
          game.current.target = "green";
          game.current.asteroids.push(
            ...generateAsteroidField(
              game.current.wave,
              WORLD_WIDTH,
              WORLD_HEIGHT,
              Math.floor(Math.random() * 1e9)
            )
          );
        }
      }

      // Update shooting stars
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.life > s.max) shooting.splice(i, 1);
      }

      // Spawn shooting stars periodically
      if (game.current.elapsed >= nextShooting) {
        nextShooting = game.current.elapsed + 0.6 + Math.random() * 1.6;
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
        
        d.vx *= Math.pow(0.98, dt);
        d.vy *= Math.pow(0.98, dt);
        d.vy += 100 * dt;
        
        if (d.x < 0) d.x = WORLD_WIDTH;
        if (d.x > WORLD_WIDTH) d.x = 0;
        if (d.y < 0) d.y = WORLD_HEIGHT;
        if (d.y > WORLD_HEIGHT) d.y = 0;
        
        if (d.life > d.max) debris.splice(i, 1);
      }

      // Update flash and camera shake
      if (flashT > 0) flashT -= dt;
      if (cameraShake > 0) cameraShake -= 120 * dt;

      // Draw particles in world space
      ctx.save();
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 8;
      for (const p of particles) {
        const t = p.life / p.max;
        const alpha = Math.max(0, 1 - t);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        const size = 3 * (1 - t * 0.5);
        ctx.fillRect(p.x - size/2, p.y - size/2, size, size);
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // Draw debris
      ctx.save();
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 4;
      for (const d of debris) {
        const t = d.life / d.max;
        const alpha = Math.max(0, 1 - t);
        ctx.globalAlpha = alpha;
        
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        
        ctx.fillStyle = d.color;
        ctx.shadowColor = d.color;
        
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

      // Render game objects
      drawColorAsteroids(ctx, game.current.asteroids);
      drawColorProjectiles(ctx, game.current.projectiles, neonColor);
      drawUFOs(ctx, ufoState.current.ufos);
      drawUFOBullets(ctx, ufoState.current.bullets);

      // Draw player
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;

      // Flicker during invulnerability
      if (game.current.player.invulnerable > 0 && Math.floor(game.current.elapsed * 8) % 2) {
        ctx.globalAlpha = 0.3;
      }

      // Draw ship triangle
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(-7, 10);
      ctx.lineTo(7, 10);
      ctx.closePath();
      ctx.stroke();

      // Draw thrust flame
      if (player.thrust > 0) {
        ctx.strokeStyle = "hsl(15, 100%, 70%)";
        ctx.shadowColor = "hsl(15, 100%, 70%)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-3, 10);
        ctx.lineTo(0, 18 + Math.random() * 5);
        ctx.lineTo(3, 10);
        ctx.stroke();
      }

      ctx.restore();
      ctx.globalAlpha = 1;

      ctx.restore(); // Restore from world transform

      // Flash effect overlay in screen space
      if (flashT > 0) {
        const intensity = flashT / 0.28;
        ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.4})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Update HUD
      setHud({
        score: game.current.score,
        lives: game.current.lives,
        wave: game.current.wave,
        ammo: game.current.ammo,
        difficulty,
        target: game.current.target
      });

      // FPS counter
      frameCount.current++;
      if (frameCount.current % 60 === 0) {
        setFps(Math.round(1000 / (timestamp - lastTime.current + 1)));
      }

      // Check game over - trigger immediately when lives reach 0
      if (game.current.lives <= 0) {
        if (!gameOverNotified.current) {
          game.current.gameOver = true;
          game.current.gameStarted = false; // Stop the game loop
          gameOverNotified.current = true;
          const elapsed = (Date.now() - gameStartTime.current) / 1000;
          
          // Call onGameOver which should trigger the game over screen
          onGameOver({
            score: game.current.score,
            wave: game.current.wave,
            cause: "destroyed",
            difficulty,
            elapsed,
            seed: worldSeed.current
          });
        }
        return; // Exit the game loop immediately
      }

      raf = requestAnimationFrame(loop);
    };

    // Initialize game
    game.current.asteroids = generateAsteroidField(1, REFERENCE_WIDTH, REFERENCE_HEIGHT, worldSeed.current);
    game.current.gameStarted = true;

    // Preload SFX and start level music
    try { (audio.current as any).preloadSFX(); } catch {}
    try { (audio.current as any).stopAllAudio(); } catch {}
    try { (audio.current as any).playLevelTrackByIndex(0); } catch {}

    raf = requestAnimationFrame(loop);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      try { audio.current.stopThruster(); } catch {}
      try { (audio.current as any).stopLevelMusic(); } catch {}
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

      <AsteroidsColorHUD {...hud} />

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

      {/* Exit button */}
      <div className="absolute top-4 right-16 z-20">
        <Button
          onClick={() => {
            try { audio.current.stopAllAudio(); } catch {}
            onExit();
          }}
          variant="outline"
          size="sm"
        >
          EXIT
        </Button>
      </div>

      {/* Touch controls overlay for mobile - 4 button layout matching main Asteroids */}
      {isTouch && (
        <div className="absolute inset-0 pointer-events-none z-10 select-none">
          {/* Right side button - Thrust or Fire based on swapButtons */}
          <div
            className={`absolute bottom-8 right-8 w-28 h-28 rounded-full border-2 border-accent/50 bg-accent/10 flex items-center justify-center pointer-events-auto select-none ${swapButtons ? 'bg-red-600/20 border-red-600/50' : 'bg-blue-600/20 border-blue-600/50'}`}
            onTouchStart={() => { 
              audio.current.resume(); 
              if (swapButtons) { 
                keys.current.fire = true; 
              } else { 
                keys.current.thrust = true; 
              } 
            }}
            onTouchEnd={() => { 
              if (swapButtons) { 
                keys.current.fire = false; 
              } else { 
                keys.current.thrust = false; 
              } 
            }}
            onTouchCancel={() => { 
              if (swapButtons) { 
                keys.current.fire = false; 
              } else { 
                keys.current.thrust = false; 
              } 
            }}
          >
            <span className="text-sm text-accent select-none">{swapButtons ? 'FIRE' : 'THRUST'}</span>
          </div>
          
          {/* Left side button - Fire or Thrust based on swapButtons */}
          <div
            className={`absolute bottom-8 left-8 w-28 h-28 rounded-full border-2 border-accent/50 bg-accent/10 flex items-center justify-center pointer-events-auto select-none ${swapButtons ? 'bg-blue-600/20 border-blue-600/50' : 'bg-red-600/20 border-red-600/50'}`}
            onTouchStart={() => { 
              audio.current.resume(); 
              if (swapButtons) { 
                keys.current.thrust = true; 
              } else { 
                keys.current.fire = true; 
              } 
            }}
            onTouchEnd={() => { 
              if (swapButtons) { 
                keys.current.thrust = false; 
              } else { 
                keys.current.fire = false; 
              } 
            }}
            onTouchCancel={() => { 
              if (swapButtons) { 
                keys.current.thrust = false; 
              } else { 
                keys.current.fire = false; 
              } 
            }}
          >
            <span className="text-sm text-accent select-none">{swapButtons ? 'THRUST' : 'FIRE'}</span>
          </div>
          
          {/* Touch rotation areas - positioned higher to avoid collision */}
          <div
            className="absolute bottom-40 left-8 w-24 h-24 rounded-full border-2 border-accent/50 bg-accent/10 flex items-center justify-center pointer-events-auto select-none"
            onTouchStart={() => { 
              audio.current.resume(); 
              keys.current.left = true; 
            }}
            onTouchEnd={() => { 
              keys.current.left = false; 
            }}
            onTouchCancel={() => { 
              keys.current.left = false; 
            }}
          >
            <span className="text-sm text-accent select-none">←</span>
          </div>
          
          <div
            className="absolute bottom-40 right-8 w-24 h-24 rounded-full border-2 border-accent/50 bg-accent/10 flex items-center justify-center pointer-events-auto select-none"
            onTouchStart={() => { 
              audio.current.resume(); 
              keys.current.right = true; 
            }}
            onTouchEnd={() => { 
              keys.current.right = false; 
            }}
            onTouchCancel={() => { 
              keys.current.right = false; 
            }}
          >
            <span className="text-sm text-accent select-none">→</span>
          </div>
        </div>
      )}
    </div>
  );
};