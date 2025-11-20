import React, { useEffect, useRef, useState, useCallback } from "react";
import { AudioManager } from "./AudioManager";
import { anyGamepad, loadProfile, readGamepad, getLastDeviceId } from "@/hooks/use-gamepad";
import { createCountdownIntro, IntroHandle } from "./intro/CountdownIntro";
import { CountdownOverlay } from "./intro/CountdownOverlay";
import { CursorManager } from "@/lib/cursorManager";
import { DEFAULT_CURSOR_CONFIG } from "@/lib/cursorConfig";
import { RemixStarfield } from "./RemixStarfield";
import { REMIX_STAGES, getStageConfig, mulberry32, mix } from "./systems/stageConfig";
import { RemixEnemy, createEnemy, updateEnemies, renderEnemies, Mine, createMine, updateMines, renderMines } from "./systems/remixEnemies";
import { PowerupItem, ActivePowerup, PowerupState, createPowerup, spawnPowerupInSafeLane, updatePowerups, activatePowerup, updateActivePowerups, getWeaponMultiplier, hasShield, checkPowerupCollision, renderPowerups, renderPowerupHUD } from "./systems/powerups";
import { RemixAsteroid, createAsteroid, splitAsteroid, updateAsteroids, spawnAsteroidSafely, getAsteroidScore, checkAsteroidCollision, renderAsteroids } from "./systems/remixAsteroids";
import { RemixBoss, createBoss, updateBoss, renderBoss, renderBossHUD, BossProjectile } from "./systems/remixBosses";

// Remix-specific types
interface RemixPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  visualLean: number;
  invulnerable: number;
  lastShot?: number;
}

interface RemixProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface RemixGameState {
  player: RemixPlayer;
  projectiles: RemixProjectile[];
  enemyBullets: RemixProjectile[];
  bossProjectiles: BossProjectile[];
  asteroids: RemixAsteroid[];
  enemies: RemixEnemy[];
  boss: RemixBoss | null;
  mines: Mine[];
  powerups: PowerupState;
  particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
  }>;
  score: number;
  lives: number;
  stage: number;
  scrollY: number;
  scrollSpeed: number;
  stageTimer: number;
  gameStarted: boolean;
  gameOver: boolean;
  paused: boolean;
  victory: boolean;
  bossWarning: boolean;
  lastPowerupSpawn: number;
}

interface RemixGameOverData {
  score: number;
  wave: number;
  cause: "destroyed" | "abort" | "victory";
  difficulty: string;
  elapsed: number;
  clearTime?: number;
}

interface AsteroidsRemixEngineProps {
  difficulty: string;
  startLevel?: number;
  onExit: () => void;
  onGameOver: (data: RemixGameOverData) => void;
  swapButtons?: boolean;
}

// Use seeded randomness from stageConfig
let gameSeed = Date.now() % 2147483647;
if (gameSeed <= 0) gameSeed += 2147483646;

export const AsteroidsRemixEngine: React.FC<AsteroidsRemixEngineProps> = ({
  difficulty,
  startLevel = 1,
  onExit,
  onGameOver,
  swapButtons = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<RemixGameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);
  const audioRef = useRef<AudioManager | null>(null);
  const cursorManagerRef = useRef<CursorManager | null>(null);
  const [fps, setFps] = useState(0);
  const fpsCounterRef = useRef({ frames: 0, lastTime: 0 });
  const fpsRef = useRef(0);
  const [isTouch, setIsTouch] = useState(false);
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

  // Touch controls state
  const touchInputRef = useRef({ left: false, right: false, up: false, down: false, fire: false });
  const dpadTouchRef = useRef<{ id: number; startX: number; startY: number } | null>(null);
  const fireTouchRef = useRef<number | null>(null);

  // Difficulty settings
  const difficultySettings = {
    Easy: { lives: 5, scrollSpeedMultiplier: 0.8, enemySpeedMultiplier: 0.8 },
    Normal: { lives: 3, scrollSpeedMultiplier: 1.0, enemySpeedMultiplier: 1.0 },
    Hard: { lives: 2, scrollSpeedMultiplier: 1.2, enemySpeedMultiplier: 1.2 }
  };

  const settings = difficultySettings[difficulty as keyof typeof difficultySettings] || difficultySettings.Normal;

  // Initialize game state
  const initGameState = useCallback((): RemixGameState => {
    gameSeed = Date.now() % 2147483647;
    
    // Initialize countdown intro for Remix with "warp" variant
    if (!introRef.current) {
      introRef.current = createCountdownIntro();
      introRef.current.onDone(() => {
        setWorldPaused(false);
        invulnerabilityTimer.current = 1200; // 1.2 seconds invulnerability
      });
      
      // Start countdown with "warp" variant for remix
      const introSeed = mix(gameSeed, "INTRO");
      introRef.current.start({
        variant: "warp", 
        seed: introSeed,
        onTick: () => { try { audioRef.current?.playIntroTick(); } catch {} },
        onGo: () => { try { audioRef.current?.playIntroGo(); } catch {} },
        onWarp: () => { try { audioRef.current?.playIntroWarp(); } catch {} }
      });
      setWorldPaused(true);
    }
    
    return {
      player: {
        x: 960,
        y: 900,
        vx: 0,
        vy: 0,
        visualLean: 0,
        invulnerable: 0
      },
      projectiles: [],
      enemyBullets: [],
      bossProjectiles: [],
      asteroids: [],
      enemies: [],
      boss: null,
      mines: [],
      powerups: { items: [], active: [], shieldHits: 0 },
      particles: [],
      score: 0,
      lives: settings.lives,
      stage: startLevel,
      scrollY: 0,
      scrollSpeed: 220 * settings.scrollSpeedMultiplier,
      stageTimer: 0,
      gameStarted: true,
      gameOver: false,
      paused: false,
      victory: false,
      bossWarning: false,
      lastPowerupSpawn: 0
    };
  }, [settings.lives, settings.scrollSpeedMultiplier]);

  // Stage director - spawns content based on time
  const updateStageDirector = (state: RemixGameState, dt: number) => {
    const currentRng = mulberry32(mix(gameSeed, "REMIX", state.stage, Math.floor(state.stageTimer)));
    state.stageTimer += dt;
    
    // Get current stage config
    const stageConfig = getStageConfig(state.stage);
    if (!stageConfig) return;
    
    // Update scroll speed based on stage profile
    const timeProgress = Math.min(state.stageTimer / (stageConfig.duration * 1000), 1);
    if (timeProgress < 0.5) {
      const t = timeProgress * 2;
      state.scrollSpeed = (stageConfig.scrollProfile.start * (1 - t) + stageConfig.scrollProfile.mid * t) * settings.scrollSpeedMultiplier;
    } else {
      const t = (timeProgress - 0.5) * 2;
      state.scrollSpeed = (stageConfig.scrollProfile.mid * (1 - t) + stageConfig.scrollProfile.end * t) * settings.scrollSpeedMultiplier;
    }

    // Boss warning at 55s
    if (state.stageTimer > 55000 && !state.bossWarning && !state.boss) {
      state.bossWarning = true;
    }

    // Spawn boss at 60s
    if (state.stageTimer > 60000 && !state.boss) {
      state.boss = createBoss(stageConfig.boss, 960, 200, difficulty);
      state.bossWarning = false;
    }

    // Spawn asteroids based on stage config
    if (currentRng() < 0.02) { // 2% chance per frame
      const asteroid = spawnAsteroidSafely(
        stageConfig.asteroid.kinds[Math.floor(currentRng() * stageConfig.asteroid.kinds.length)] as any,
        1920,
        1080,
        state.player.x,
        state.player.y,
        currentRng
      );
      if (asteroid) {
        state.asteroids.push(asteroid);
      }
    }

    // Spawn enemies based on stage timeline
    const stageTimeS = state.stageTimer / 1000;
    for (const enemySpawn of stageConfig.enemies) {
      if (stageTimeS >= enemySpawn.at && stageTimeS <= enemySpawn.at + 30) { // 30s spawn window
        if (currentRng() < enemySpawn.rate * 0.016) { // Adjust for 60fps
          const enemy = createEnemy(
            enemySpawn.type,
            200 + currentRng() * 1520,
            -50,
            currentRng,
            difficulty
          );
          state.enemies.push(enemy);
        }
      }
    }

    // Spawn power-ups based on stage config
    for (const powerupSpec of stageConfig.powerups) {
      if (stageTimeS >= powerupSpec.tStart && stageTimeS <= powerupSpec.tEnd) {
        if (currentRng() < powerupSpec.chance * 0.016 && stageTimeS - state.lastPowerupSpawn > 2) {
          const powerup = spawnPowerupInSafeLane(
            powerupSpec.kind,
            1920,
            state.player.x,
            currentRng
          );
          state.powerups.items.push(powerup);
          state.lastPowerupSpawn = stageTimeS;
        }
      }
    }
  };

  // Collision detection
  const checkCollision = (x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (r1 + r2);
  };

  // Create particles
  const createParticles = (x: number, y: number, count: number, color: string) => {
    const state = gameStateRef.current;
    if (!state) return;
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1000 + Math.random() * 500,
        maxLife: 1500,
        size: 2 + Math.random() * 3,
        color
      });
    }
  };

  // Create massive explosion like in main asteroids
  const spawnExplosion = (x: number, y: number) => {
    const state = gameStateRef.current;
    if (!state) return;
    
    // Massive particle burst - same as main asteroids
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 240 + Math.random() * 520;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 800 + Math.random() * 700,
        maxLife: 1500,
        size: 1 + Math.random() * 4,
        color: `hsla(${180 + Math.random() * 20},100%,60%,1)`
      });
    }
  };

  // Game update loop
  const updateGame = (dt: number) => {
    const state = gameStateRef.current;
    if (!state || !state.gameStarted || state.gameOver || state.paused) return;

    // Handle input
    const gp = anyGamepad();
    let input = { left: false, right: false, up: false, down: false, fire: false, abort: false };
    
    if (gp) {
      const profile = loadProfile(getLastDeviceId());
      const gamepadInput = readGamepad(gp, profile);
      input.left = gamepadInput.rotation < -0.1;
      input.right = gamepadInput.rotation > 0.1;
      input.up = gamepadInput.thrust < -0.1;
      input.down = gamepadInput.thrust > 0.1;
      input.fire = !!gp.buttons[0]?.pressed;
    }

    // Keyboard input
    input.left = input.left || keysRef.current.has('ArrowLeft') || keysRef.current.has('a') || keysRef.current.has('A');
    input.right = input.right || keysRef.current.has('ArrowRight') || keysRef.current.has('d') || keysRef.current.has('D');
    input.up = input.up || keysRef.current.has('ArrowUp') || keysRef.current.has('w') || keysRef.current.has('W');
    input.down = input.down || keysRef.current.has('ArrowDown') || keysRef.current.has('s') || keysRef.current.has('S');
    input.fire = input.fire || keysRef.current.has(' ');

    // Touch input
    input.left = input.left || touchInputRef.current.left;
    input.right = input.right || touchInputRef.current.right;
    input.up = input.up || touchInputRef.current.up;
    input.down = input.down || touchInputRef.current.down;
    input.fire = input.fire || touchInputRef.current.fire;

    // Update countdown intro
    if (introRef.current?.isActive()) {
      setIntroState(introRef.current.getCurrentState());
    }
    
    // Update invulnerability timer
    if (invulnerabilityTimer.current > 0) {
      invulnerabilityTimer.current -= dt;
    }
    
    // Skip countdown on input
    if (introRef.current?.isActive()) {
      const skipInput = input.fire || input.up || input.down || input.left || input.right;
      if (skipInput && introRef.current.getCurrentState().canSkip) {
        introRef.current.skip();
      }
    }

    // Update scroll - pause during countdown
    if (!worldPaused) {
      state.scrollY += state.scrollSpeed * dt / 1000;
    } else {
      // Keep scroll speed at 0 during countdown  
      state.scrollSpeed = 0;
    }

    // Update stage director - only when not paused
    if (!worldPaused) {
      updateStageDirector(state, dt);
    }

    // Update player
    const player = state.player;
    if (player.invulnerable > 0) {
      player.invulnerable -= dt;
    }

    // Player movement - doubled speeds for remix
    const accelX = 2400;
    const accelY = 1600;
    const maxVX = 1200;
    const maxVY = 800;
    const drag = 0.92;

    let ax = 0, ay = 0;
    if (input.left) ax -= accelX;
    if (input.right) ax += accelX;
    if (input.up) ay -= accelY;
    if (input.down) ay += accelY;

    player.vx += ax * dt / 1000;
    player.vy += ay * dt / 1000;

    // Speed clamps
    player.vx = Math.max(-maxVX, Math.min(maxVX, player.vx));
    player.vy = Math.max(-maxVY, Math.min(maxVY, player.vy));

    // Drag
    player.vx *= Math.pow(drag, dt / 16.67);
    player.vy *= Math.pow(drag, dt / 16.67);

    // Integrate position
    player.x += player.vx * dt / 1000;
    player.y += player.vy * dt / 1000;

    // Clamp to world bounds
    const r = 15;
    player.x = Math.max(r, Math.min(1920 - r, player.x));
    player.y = Math.max(r, Math.min(1080 - r, player.y));

    // Visual lean
    player.visualLean = Math.max(-1, Math.min(1, player.vx / maxVX)) * 4;

    // Player firing with power-ups
    if (input.fire) {
      const now = Date.now();
      if (!state.player.lastShot || now - state.player.lastShot > 150) {
        const weaponMultiplier = getWeaponMultiplier(state.powerups.active);
        
        if (weaponMultiplier === 1) {
          // Single shot
          state.projectiles.push({
            x: player.x,
            y: player.y - 10,
            vx: 0,
            vy: -1200,
            life: 3000
          });
        } else if (weaponMultiplier === 2) {
          // Double shot
          state.projectiles.push({
            x: player.x - 8,
            y: player.y - 10,
            vx: 0,
            vy: -1200,
            life: 3000
          });
          state.projectiles.push({
            x: player.x + 8,
            y: player.y - 10,
            vx: 0,
            vy: -1200,
            life: 3000
          });
        } else if (weaponMultiplier === 3) {
          // Triple shot
          state.projectiles.push({
            x: player.x,
            y: player.y - 10,
            vx: 0,
            vy: -1200,
            life: 3000
          });
          state.projectiles.push({
            x: player.x - 12,
            y: player.y - 10,
            vx: -100,
            vy: -1200,
            life: 3000
          });
          state.projectiles.push({
            x: player.x + 12,
            y: player.y - 10,
            vx: 100,
            vy: -1200,
            life: 3000
          });
        }
        
        state.player.lastShot = now;
        audioRef.current?.click();
      }
    }

  // Convert dt to seconds for physics systems
    const dtSec = dt / 1000;
    // Slow down asteroids and enemies by 30% (0.7x speed)
    const gameplayDtSec = dtSec * 0.7;
    
    // Update systems using new modular functions
    updateAsteroids(state.asteroids, gameplayDtSec, 1920, 1080);
    updateEnemies(state.enemies, gameplayDtSec, 1920, 1080, mulberry32(gameSeed));
    updatePowerups(state.powerups.items, gameplayDtSec, 1080);
    updateActivePowerups(state.powerups.active, dt); // Keep in ms for this one
    
    // Update boss (also slowed down)
    if (state.boss) {
      const bossProjectiles = updateBoss(state.boss, gameplayDtSec, 1920, 1080, state.player.x, state.player.y);
      // Convert boss projectile life back to ms
      for (const bp of bossProjectiles) {
        bp.life *= 1000;
      }
      state.bossProjectiles.push(...bossProjectiles);
    }

    // Update projectiles
    state.projectiles = state.projectiles.filter(p => {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.life -= dt;
      return p.life > 0 && p.y > -100 && p.y < 1180;
    });

    // Update enemy bullets
    state.enemyBullets = state.enemyBullets.filter(p => {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.life -= dt;
      return p.life > 0 && p.y > -100 && p.y < 1180 && p.x > -100 && p.x < 2020;
    });

    // Update boss projectiles
    state.bossProjectiles = state.bossProjectiles.filter(p => {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.life -= dt;
      return p.life > 0 && p.y > -100 && p.y < 1180 && p.x > -100 && p.x < 2020;
    });

    // Update particles
    state.particles = state.particles.filter(p => {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.life -= dt;
      return p.life > 0;
    });

    // Collision detection
    
    // Player vs enemy bullets (with shield protection)
    if (player.invulnerable <= 0) {
      for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = state.enemyBullets[i];
        if (checkCollision(player.x, player.y, 15, bullet.x, bullet.y, 5)) {
          state.enemyBullets.splice(i, 1);
          
          if (hasShield(state.powerups.active)) {
            // Shield blocks hit
            state.powerups.active = state.powerups.active.filter(p => p.type !== "shield");
            createParticles(player.x, player.y, 12, '#0066ff');
          } else {
            state.lives--;
            player.invulnerable = 2000;
            spawnExplosion(player.x, player.y);
            audioRef.current?.explosion();
            
            if (state.lives <= 0) {
              onGameOver({
                score: state.score,
                wave: state.stage,
                cause: "destroyed",
                difficulty,
                elapsed: state.stageTimer / 1000
              });
              return;
            }
          }
        }
      }
    }

    // Player vs asteroids (with shield protection)
    if (player.invulnerable <= 0) {
      for (const asteroid of state.asteroids) {
        if (checkAsteroidCollision(asteroid, player.x, player.y, 15)) {
          if (hasShield(state.powerups.active)) {
            // Shield blocks hit
            state.powerups.active = state.powerups.active.filter(p => p.type !== "shield");
            createParticles(player.x, player.y, 12, '#0066ff');
          } else {
            state.lives--;
            player.invulnerable = 2000;
            spawnExplosion(player.x, player.y);
            audioRef.current?.explosion();
            
            if (state.lives <= 0) {
              onGameOver({
                score: state.score,
                wave: state.stage,
                cause: "destroyed",
                difficulty,
                elapsed: state.stageTimer / 1000
              });
              return;
            }
          }
          break;
        }
      }
    }

    // Projectiles vs asteroids
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      for (let j = state.asteroids.length - 1; j >= 0; j--) {
        const asteroid = state.asteroids[j];
        if (checkAsteroidCollision(asteroid, projectile.x, projectile.y, 2)) {
          state.projectiles.splice(i, 1);
          state.asteroids.splice(j, 1);
          
          // Score
          state.score += getAsteroidScore(asteroid.size);
          
          // Split asteroid
          const splits = splitAsteroid(asteroid, mulberry32(gameSeed));
          state.asteroids.push(...splits);
          
          createParticles(asteroid.x, asteroid.y, 8, '#4fc3f7');
          audioRef.current?.explosion();
          break;
        }
      }
    }

    // Projectiles vs enemies
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const enemy = state.enemies[j];
        if (checkCollision(projectile.x, projectile.y, 4, enemy.x, enemy.y, 30)) {
          state.projectiles.splice(i, 1);
          enemy.hp--;
          
          if (enemy.hp <= 0) {
            state.enemies.splice(j, 1);
            state.score += 200;
            createParticles(enemy.x, enemy.y, 6, '#4fc3f7');
            audioRef.current?.explosion();
          }
          break;
        }
      }
    }

    // Projectiles vs boss
    if (state.boss) {
      for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
        if (checkCollision(projectile.x, projectile.y, 4, state.boss.x, state.boss.y, 96)) {
          state.projectiles.splice(i, 1);
          state.boss.hp -= 10;
          createParticles(state.boss.x, state.boss.y, 3, '#4fc3f7');
          
          if (state.boss.hp <= 0) {
            state.score += state.boss.config.bonusScore;
            state.victory = true;
            createParticles(state.boss.x, state.boss.y, 20, '#ffd700');
            audioRef.current?.playMissionSuccess();
            
            onGameOver({
              score: state.score,
              wave: state.stage,
              cause: "victory",
              difficulty,
              elapsed: state.stageTimer / 1000,
              clearTime: state.stageTimer / 1000
            });
            return;
          }
        }
      }
    }

    // Power-up collection
    const collectedPowerup = checkPowerupCollision(state.powerups.items, player.x, player.y, 15);
    if (collectedPowerup) {
      activatePowerup(collectedPowerup.type, state.powerups.active);
      audioRef.current?.click(); // Power-up pickup sound
    }
  };

  // World constants for cover scaling
  const WORLD_W = 1920;
  const WORLD_H = 1080;

  // Apply cover transform
  const applyCoverTransform = (ctx: CanvasRenderingContext2D, cw: number, ch: number, dpr: number) => {
    const sx = cw / WORLD_W;
    const sy = ch / WORLD_H;
    const scale = Math.max(sx, sy);
    const ox = (cw - WORLD_W * scale) * 0.5;
    const oy = (ch - WORLD_H * scale) * 0.5;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
    return { scale, ox, oy };
  };

  // Render game
  const renderGame = () => {
    const canvas = canvasRef.current;
    const state = gameStateRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Apply cover scaling with proper HiDPI support
      applyCoverTransform(ctx, rect.width, rect.height, dpr);

      // Clear with gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      gradient.addColorStop(0, 'hsl(240, 100%, 2%)');
      gradient.addColorStop(1, 'hsl(260, 100%, 5%)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      // Use imported render functions from systems
      renderAsteroids(ctx, state.asteroids, '#4fc3f7', difficulty);
      renderEnemies(ctx, state.enemies, '#ff4444');
      renderMines(ctx, state.mines);
      renderPowerups(ctx, state.powerups.items);
      
      if (state.boss) {
        renderBoss(ctx, state.boss, '#ff8800');
      }

      // Render player (with shield if active)
      const hasShieldActive = hasShield(state.powerups.active);
      renderPlayer(ctx, state.player, hasShieldActive);

      // Render projectiles
      ctx.fillStyle = '#ffffff';
      for (const p of state.projectiles) {
        ctx.fillRect(p.x - 1, p.y - 2, 2, 4);
      }

      // Render enemy bullets
      ctx.fillStyle = '#ff4444';
      for (const p of state.enemyBullets) {
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }

      // Render boss projectiles
      ctx.fillStyle = '#ff8800';
      for (const p of state.bossProjectiles) {
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }

      // Render particles
      for (const p of state.particles) {
        const alpha = p.life / 1000;
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }

      // Render HUDs after world content
      if (state.boss) {
        renderBossHUD(ctx, state.boss, WORLD_W);
      }
      renderPowerupHUD(ctx, state.powerups.active);
      
      // Render game HUD
      renderGameHUD(ctx, state, WORLD_W, WORLD_H);

    } catch (error) {
      console.error("Render error:", error);
    }
  };

  // Helper render function for player
  const renderPlayer = (ctx: CanvasRenderingContext2D, player: RemixPlayer, hasShield: boolean) => {
    ctx.save();
    ctx.translate(player.x, player.y);
    // Use visual lean instead of rotation for subtle tilt
    ctx.rotate(player.visualLean * 0.1);
    
    // Shield bubble
    if (hasShield) {
      ctx.strokeStyle = '#0066ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Player ship
    ctx.strokeStyle = player.invulnerable > 0 ? '#888888' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(-10, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(10, 10);
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();
  };

  // Helper render function for game HUD
  const renderGameHUD = (ctx: CanvasRenderingContext2D, state: RemixGameState, worldW: number, worldH: number) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px monospace';
    
    // Score
    ctx.fillText(`SCORE: ${state.score.toLocaleString()}`, 20, 40);
    
    // Lives
    ctx.fillText(`LIVES: ${state.lives}`, 20, 70);
    
    // Level
    ctx.fillText(`LEVEL: ${state.stage}`, 20, 100);
    
    // Stage timer
    const stageTime = (state.stageTimer / 1000).toFixed(1);
    ctx.fillText(`TIME: ${stageTime}s`, 20, 130);
    
    // Boss warning
    if (state.bossWarning) {
      ctx.save();
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BOSS INCOMING!', worldW / 2, worldH / 2);
      ctx.restore();
    }
    
    ctx.restore();
  };

  // Game loop
  useEffect(() => {
    let animationId: number;
    
    const gameLoop = (currentTime: number) => {
      const dt = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      // FPS calculation
      const fpsCounter = fpsCounterRef.current;
      fpsCounter.frames++;
      const elapsed = currentTime - fpsCounter.lastTime;
      if (elapsed >= 1000) {
        const computedFps = (fpsCounter.frames * 1000) / elapsed;
        fpsRef.current = computedFps;
        setFps(Math.round(computedFps));
        fpsCounter.frames = 0;
        fpsCounter.lastTime = currentTime;
      }
      
      if (dt < 250) {
        const clampedDt = Math.min(dt, 33.33);
        updateGame(clampedDt);
        renderGame();
      }
      
      animationId = requestAnimationFrame(gameLoop);
    };
    
    const now = performance.now();
    lastTimeRef.current = now;
    fpsCounterRef.current.frames = 0;
    fpsCounterRef.current.lastTime = now;
    animationId = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [difficulty]);

  // Initialize audio, cursor management, and game state
  useEffect(() => {
    audioRef.current = new AudioManager();
    gameStateRef.current = initGameState();
    
    // Initialize cursor management
    const container = canvasRef.current?.parentElement;
    if (container) {
      cursorManagerRef.current = new CursorManager(DEFAULT_CURSOR_CONFIG);
      cursorManagerRef.current.attach(
        container,
        () => true,
        'container'
      );
      cursorManagerRef.current.forceHideCursor();
    }
    
    // Play background music
    audioRef.current.playTitleMusic();
    
    return () => {
      audioRef.current?.stopTitleMusic();
      cursorManagerRef.current?.detach();
    };
  }, [initGameState]);

  // Touch helper functions
  const updateDpadFromTouch = (touchX: number, touchY: number, startX: number, startY: number) => {
    const dx = touchX - startX;
    const dy = touchY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Dead zone
    if (distance < 20) {
      touchInputRef.current.left = false;
      touchInputRef.current.right = false;
      touchInputRef.current.up = false;
      touchInputRef.current.down = false;
      return;
    }
    
    // Normalize to unit circle
    const nx = dx / distance;
    const ny = dy / distance;
    
    // Convert to directional inputs (higher threshold for more precise control)
    touchInputRef.current.left = nx < -0.4;
    touchInputRef.current.right = nx > 0.4;
    touchInputRef.current.up = ny < -0.4;
    touchInputRef.current.down = ny > 0.4;
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    audioRef.current?.resume();
    
    for (const touch of Array.from(e.changedTouches)) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Determine touch areas (using viewport coordinates)
      const isLeftSide = x < rect.width / 2;
      const dpadSide = swapButtons ? rect.width - 140 : 70; // Account for swapping
      const fireSide = swapButtons ? 70 : rect.width - 70;
      
      // D-pad area (movement)
      const dpadCenterX = swapButtons ? rect.width - 70 : 70;
      const dpadCenterY = rect.height - 70;
      const dpadDistance = Math.sqrt((x - dpadCenterX) ** 2 + (y - dpadCenterY) ** 2);
      
      // Fire button area
      const fireCenterX = swapButtons ? 70 : rect.width - 70;
      const fireCenterY = rect.height - 70;
      const fireDistance = Math.sqrt((x - fireCenterX) ** 2 + (y - fireCenterY) ** 2);
      
      if (dpadDistance < 60 && !dpadTouchRef.current) {
        // D-pad touch
        dpadTouchRef.current = { id: touch.identifier, startX: dpadCenterX, startY: dpadCenterY };
        updateDpadFromTouch(x, y, dpadCenterX, dpadCenterY);
      } else if (fireDistance < 50 && !fireTouchRef.current) {
        // Fire button touch
        fireTouchRef.current = touch.identifier;
        touchInputRef.current.fire = true;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    
    for (const touch of Array.from(e.changedTouches)) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Update D-pad if this is the d-pad touch
      if (dpadTouchRef.current && touch.identifier === dpadTouchRef.current.id) {
        updateDpadFromTouch(x, y, dpadTouchRef.current.startX, dpadTouchRef.current.startY);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    
    for (const touch of Array.from(e.changedTouches)) {
      // Release D-pad
      if (dpadTouchRef.current && touch.identifier === dpadTouchRef.current.id) {
        dpadTouchRef.current = null;
        touchInputRef.current.left = false;
        touchInputRef.current.right = false;
        touchInputRef.current.up = false;
        touchInputRef.current.down = false;
      }
      
      // Release fire button
      if (fireTouchRef.current && touch.identifier === fireTouchRef.current) {
        fireTouchRef.current = null;
        touchInputRef.current.fire = false;
      }
    }
  };

  // Touch detection
  useEffect(() => {
    try {
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints ?? 0) > 0 || (navigator as any).msMaxTouchPoints > 0;
      setIsTouch(!!hasTouch);
    } catch {
      setIsTouch(false);
    }
  }, []);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <RemixStarfield
        scrollY={gameStateRef.current?.scrollY || 0}
        scrollSpeed={gameStateRef.current?.scrollSpeed || 220}
        width={WORLD_W}
        height={WORLD_H}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Touch controls overlay for mobile */}
      {isTouch && (
        <div className="absolute inset-0 pointer-events-none z-20 select-none" style={{ opacity: touchOpacity / 10 }}>
          {/* Movement D-pad (swappable with fire button) */}
          <div
            className={`absolute bottom-8 ${swapButtons ? 'right-8' : 'left-8'} w-32 h-32 rounded-full border-2 border-accent/50 bg-accent/10 pointer-events-auto select-none`}
            style={{ 
              background: `radial-gradient(circle, hsl(var(--accent) / 0.1) 0%, hsl(var(--accent) / 0.05) 70%, transparent 100%)`,
              borderColor: 'hsl(var(--accent) / 0.5)'
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              audioRef.current?.resume();
              if (dpadTouchRef.current) return;
              const touch = e.changedTouches[0];
              if (!touch) return;
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const startX = rect.width / 2;
              const startY = rect.height / 2;
              dpadTouchRef.current = { id: touch.identifier, startX, startY };
              const localX = touch.clientX - rect.left;
              const localY = touch.clientY - rect.top;
              updateDpadFromTouch(localX, localY, startX, startY);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              if (!dpadTouchRef.current) return;
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              for (const t of Array.from(e.changedTouches)) {
                if (t.identifier === dpadTouchRef.current.id) {
                  const localX = t.clientX - rect.left;
                  const localY = t.clientY - rect.top;
                  updateDpadFromTouch(localX, localY, dpadTouchRef.current.startX, dpadTouchRef.current.startY);
                }
              }
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              for (const t of Array.from(e.changedTouches)) {
                if (dpadTouchRef.current && t.identifier === dpadTouchRef.current.id) {
                  dpadTouchRef.current = null;
                  touchInputRef.current.left = false;
                  touchInputRef.current.right = false;
                  touchInputRef.current.up = false;
                  touchInputRef.current.down = false;
                }
              }
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              for (const t of Array.from(e.changedTouches)) {
                if (dpadTouchRef.current && t.identifier === dpadTouchRef.current.id) {
                  dpadTouchRef.current = null;
                  touchInputRef.current.left = false;
                  touchInputRef.current.right = false;
                  touchInputRef.current.up = false;
                  touchInputRef.current.down = false;
                }
              }
            }}
          >
            {/* Directional indicators around the circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-20 h-20">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-accent/70 text-xs">▲</div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-accent/70 text-xs">▼</div>
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 text-accent/70 text-xs">◄</div>
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 text-accent/70 text-xs">►</div>
              </div>
            </div>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-accent/80 font-mono">MOVE</span>
            </div>
          </div>
          
          {/* Fire button (swappable with movement) */}
          <div
            className={`absolute bottom-8 ${swapButtons ? 'left-8' : 'right-8'} w-28 h-28 rounded-full border-2 border-red-500/50 bg-red-600/20 flex items-center justify-center pointer-events-auto select-none`}
            onTouchStart={(e) => {
              e.preventDefault();
              audioRef.current?.resume();
              if (fireTouchRef.current !== null) return;
              const touch = e.changedTouches[0];
              if (!touch) return;
              fireTouchRef.current = touch.identifier;
              touchInputRef.current.fire = true;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              for (const t of Array.from(e.changedTouches)) {
                if (fireTouchRef.current !== null && t.identifier === fireTouchRef.current) {
                  fireTouchRef.current = null;
                  touchInputRef.current.fire = false;
                }
              }
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              for (const t of Array.from(e.changedTouches)) {
                if (fireTouchRef.current !== null && t.identifier === fireTouchRef.current) {
                  fireTouchRef.current = null;
                  touchInputRef.current.fire = false;
                }
              }
            }}
          >
            <span className="text-sm text-red-400 font-mono font-bold">FIRE</span>
          </div>
        </div>
      )}
      
      {/* Countdown Overlay */}
      <CountdownOverlay 
        state={introState} 
        canvasRef={canvasRef}
        shipPosition={{ x: 960, y: 900 }} // Remix ship position
      />
      
      {/* Invulnerability indicator */}
      {invulnerabilityTimer.current > 0 && (
        <div className="absolute inset-0 pointer-events-none z-40">
          <div className="absolute" style={{ left: '50%', top: '85%', transform: 'translate(-50%, -50%)' }}>
            <div className="w-20 h-20 border-2 border-dashed border-accent/60 rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
};