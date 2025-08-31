import React, { useEffect, useRef, useState, useCallback } from "react";
import { AudioManager } from "./AudioManager";
import { anyGamepad, loadProfile, readGamepad, getLastDeviceId } from "@/hooks/use-gamepad";
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
  visualLean: number; // visual lean for strafing
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

// Using RemixAsteroid from systems/remixAsteroids.ts

// Using RemixEnemy and RemixBoss from systems

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
  onExit: () => void;
  onGameOver: (data: RemixGameOverData) => void;
  swapButtons?: boolean;
}

// Use seeded randomness from stageConfig
let gameSeed = Date.now() % 2147483647;
if (gameSeed <= 0) gameSeed += 2147483646;

const rng = mulberry32(gameSeed);

export const AsteroidsRemixEngine: React.FC<AsteroidsRemixEngineProps> = ({
  difficulty,
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

  // Difficulty settings
  const difficultySettings = {
    Easy: { lives: 5, scrollSpeedMultiplier: 0.8, enemySpeedMultiplier: 0.8 },
    Normal: { lives: 3, scrollSpeedMultiplier: 1.0, enemySpeedMultiplier: 1.0 },
    Hard: { lives: 2, scrollSpeedMultiplier: 1.2, enemySpeedMultiplier: 1.2 }
  };

  const settings = difficultySettings[difficulty as keyof typeof difficultySettings] || difficultySettings.Normal;

  // Initialize game state
  const initGameState = useCallback((): RemixGameState => {
    seed = Date.now() % 2147483647;
    
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
      stage: 1,
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

  // Create asteroid with random shape
  const createAsteroid = (x: number, y: number, size: "large" | "medium" | "small", vx = 0, vy = 0): RemixAsteroid => {
    const sizeMap = { large: 40, medium: 25, small: 15 };
    const r = sizeMap[size];
    const points: { x: number; y: number }[] = [];
    const numPoints = 8 + Math.floor(mulberry32() * 4);
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const radius = r * (0.7 + mulberry32() * 0.6);
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }

    return {
      x,
      y,
      vx: vx + (mulberry32() - 0.5) * 200, // Doubled from 100
      vy: vy + 120 + mulberry32() * 160,   // Doubled from 60+80
      r,
      angle: 0,
      av: (mulberry32() - 0.5) * 8,       // Doubled from 4
      size,
      points
    };
  };

  // Split asteroid
  const splitAsteroid = (asteroid: RemixAsteroid): RemixAsteroid[] => {
    if (asteroid.size === "small") return [];
    
    const newSize = asteroid.size === "large" ? "medium" : "small";
    const count = 2 + Math.floor(mulberry32() * 2);
    const splits: RemixAsteroid[] = [];
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 100 + mulberry32() * 100;
      splits.push(createAsteroid(
        asteroid.x,
        asteroid.y,
        newSize,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      ));
    }
    
    return splits;
  };

  // REMIX UFO tuning - 70% reduction for opening levels
  const OPENING_RATE_SCALE = 0.30; // 30% as many shots (70% reduction)
  const remixUfoTuning = {
    Easy: { fireEveryMs: [2400, 4000], accuracy: 0.20, bulletSpeed: 220 },
    Normal: { fireEveryMs: [1800, 3200], accuracy: 0.25, bulletSpeed: 250 },
    Hard: { fireEveryMs: [1500, 2800], accuracy: 0.30, bulletSpeed: 280 }
  };

  // Create enemy
  const createEnemy = (type: "grunt" | "saucer" | "sniper", x: number, y: number): RemixEnemy => {
    const cfg = remixUfoTuning[difficulty as keyof typeof remixUfoTuning] || remixUfoTuning.Normal;
    let fireCooldownMin = cfg.fireEveryMs[0];
    let fireCooldownMax = cfg.fireEveryMs[1];
    
    // Apply opening level nerfs (70% reduction in fire rate)
    const state = gameStateRef.current;
    if (state && state.stageTimer < 60000) {
      const intervalScale = 1 / OPENING_RATE_SCALE;
      fireCooldownMin *= intervalScale;
      fireCooldownMax *= intervalScale;
    }

    return {
      x,
      y,
      vx: (mulberry32() - 0.5) * 400,     // Doubled from 200
      vy: 200 + mulberry32() * 120,       // Doubled from 100+60
      type,
      hp: type === "sniper" ? 2 : 1,
      shootTimer: fireCooldownMin + mulberry32() * (fireCooldownMax - fireCooldownMin),
      pattern: Math.floor(mulberry32() * 3)
    };
  };

  // Create boss
  const createBoss = (): RemixBoss => {
    return {
      x: 960,  // Center of 1920px world
      y: 200,  // Top area of 1080px world
      vx: 0,
      vy: 0,
      hp: difficulty === "Easy" ? 180 : difficulty === "Normal" ? 240 : 320,
      maxHp: difficulty === "Easy" ? 180 : difficulty === "Normal" ? 240 : 320,
      pattern: 0,
      patternTimer: 0,
      attackTimer: 3000,
      telegraphTimer: 0
    };
  };

  // Stage director - spawns content based on time
  const updateStageDirector = (state: RemixGameState, dt: number) => {
    state.stageTimer += dt;
    
    // Update scroll speed curve
    if (state.stageTimer < 40000) {
      const progress = state.stageTimer / 40000;
      state.scrollSpeed = (220 + progress * 80) * settings.scrollSpeedMultiplier;
    } else if (state.stageTimer < 55000) {
      state.scrollSpeed = 300 * settings.scrollSpeedMultiplier;
    } else {
      state.scrollSpeed = 260 * settings.scrollSpeedMultiplier;
    }

    // Boss warning
    if (state.stageTimer > 55000 && !state.bossWarning && !state.boss) {
      state.bossWarning = true;
    }

    // Spawn boss
    if (state.stageTimer > 60000 && !state.boss) {
      state.boss = createBoss();
      state.bossWarning = false;
    }

    // Spawn content based on time bands
    if (Math.random() < 0.02) { // 2% chance per frame to spawn
      const spawnSeed = mix(seed, "REMIX", Math.floor(state.stageTimer / 1000), state.asteroids.length);
      seed = spawnSeed;
      
      if (state.stageTimer < 10000) {
        // Intro: light asteroid field (scaled for 1920x1080)
        if (Math.random() < 0.3) {
          const size = Math.random() < 0.5 ? "large" : "medium";
          state.asteroids.push(createAsteroid(200 + Math.random() * 1520, -100, size));
        }
      } else if (state.stageTimer < 40000) {
        // Patterns phase
        if (Math.random() < 0.4) {
          // Create formation patterns
          const pattern = Math.floor(Math.random() * 4);
          if (pattern === 0) {
            // Lanes (scaled for 1920x1080)
            for (let i = 0; i < 3; i++) {
              const x = 320 + i * 640;
              state.asteroids.push(createAsteroid(x, -100, "medium"));
            }
          } else if (pattern === 1) {
            // Wedge (scaled for 1920x1080)
            for (let i = 0; i < 4; i++) {
              const x = 700 + i * 160;
              const y = -100 - i * 60;
              state.asteroids.push(createAsteroid(x, y, "small"));
            }
          }
        }
      }

      // Spawn enemies (15-45s, scaled for 1920x1080)
      if (state.stageTimer > 15000 && state.stageTimer < 45000 && Math.random() < 0.1) {
        const x = 100 + Math.random() * 1720;
        const type = difficulty === "Hard" && Math.random() < 0.3 ? "sniper" : 
                    Math.random() < 0.5 ? "grunt" : "saucer";
        state.enemies.push(createEnemy(type, x, -60));
      }
    }
  };

  // Update boss AI
  const updateBoss = (state: RemixGameState, dt: number) => {
    if (!state.boss) return;

    const boss = state.boss;
    
    // Movement - horizontal oscillation
    boss.vx = Math.sin(state.stageTimer / 2000) * 240; // Doubled from 120
    boss.x += boss.vx * dt / 1000;
    boss.y += Math.sin(state.stageTimer / 1000) * 0.5;

    // Clamp position (scaled for 1920x1080)
    boss.x = Math.max(200, Math.min(1720, boss.x));
    boss.y = Math.max(160, Math.min(300, boss.y));

    // Attack patterns
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.pattern = (boss.pattern + 1) % 3;
      boss.attackTimer = 4000;
      boss.telegraphTimer = 600; // Telegraph time
    }

    if (boss.telegraphTimer > 0) {
      boss.telegraphTimer -= dt;
      if (boss.telegraphTimer <= 0) {
        // Execute attack based on pattern
        if (boss.pattern === 0) {
          // Spiral spread
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + state.stageTimer / 500;
            const speed = 400;
            state.enemyBullets.push({
              x: boss.x,
              y: boss.y + 20,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed + 100,
              life: 5000
            });
          }
        } else if (boss.pattern === 1) {
          // Laser sweep - simplified as bullet stream (scaled for 1920x1080)
          for (let i = 0; i < 7; i++) {
            const offsetX = (i - 3) * 200;
            state.enemyBullets.push({
              x: boss.x + offsetX,
              y: boss.y + 40,
              vx: 0,
              vy: 600,
              life: 3000
            });
          }
        } else if (boss.pattern === 2) {
          // Drone spawns - simplified as homing bullets
          for (let i = 0; i < 3; i++) {
            const angle = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
            const spread = (i - 1) * 0.3;
            const speed = 300;
            state.enemyBullets.push({
              x: boss.x,
              y: boss.y + 20,
              vx: Math.cos(angle + spread) * speed,
              vy: Math.sin(angle + spread) * speed,
              life: 4000
            });
          }
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
      const speed = 100 + Math.random() * 200; // Doubled from 50+100
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
      const s = 240 + Math.random() * 520; // Doubled speeds for remix
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

    // Handle input - 2-axis strafe with enhanced D-pad support
    const gp = anyGamepad();
    let input = { left: false, right: false, up: false, down: false, fire: false, abort: false };
    
    if (gp) {
      const profile = loadProfile(getLastDeviceId());
      const gamepadInput = readGamepad(gp, profile);
      input.left = gamepadInput.rotation < -0.1;
      input.right = gamepadInput.rotation > 0.1;
      input.up = gamepadInput.thrust < -0.1;    // Map thrust axis to up/down
      input.down = gamepadInput.thrust > 0.1;
      input.fire = !!gp.buttons[0]?.pressed; // Use direct button access for fire
      // No abort in REMIX gameplay mode
    }

    // Keyboard input
    input.left = input.left || keysRef.current.has('ArrowLeft') || keysRef.current.has('a') || keysRef.current.has('A');
    input.right = input.right || keysRef.current.has('ArrowRight') || keysRef.current.has('d') || keysRef.current.has('D');
    input.up = input.up || keysRef.current.has('ArrowUp') || keysRef.current.has('w') || keysRef.current.has('W');
    input.down = input.down || keysRef.current.has('ArrowDown') || keysRef.current.has('s') || keysRef.current.has('S');
    input.fire = input.fire || keysRef.current.has(' ');
    // No abort binding in REMIX gameplay mode

    // Abort disabled in REMIX gameplay mode

    // Update scroll
    state.scrollY += state.scrollSpeed * dt / 1000;

    // Update stage director
    updateStageDirector(state, dt);

    // Update player
    const player = state.player;
    if (player.invulnerable > 0) {
      player.invulnerable -= dt;
    }

    // Player movement (scaled for 1920x1080, doubled for remix speed)
    const accelX = 2400; // doubled from 1200 (originally 600)
    const accelY = 1600; // doubled from 800 (originally 600, but corrected to accelY)
    const maxVX = 1200;  // doubled from 600 (originally 312)
    const maxVY = 800;   // doubled from 400 (originally 264)
    const drag = 0.92;

    let ax = 0, ay = 0;
    if (input.left) ax -= accelX;
    if (input.right) ax += accelX;
    if (input.up) ay -= accelY;    // move up screen
    if (input.down) ay += accelY;  // move down screen

    player.vx += ax * dt / 1000;
    player.vy += ay * dt / 1000;

    // Speed clamps
    player.vx = Math.max(-maxVX, Math.min(maxVX, player.vx));
    player.vy = Math.max(-maxVY, Math.min(maxVY, player.vy));

    // Drag (frame-rate independent)
    player.vx *= Math.pow(drag, dt / 16.67);
    player.vy *= Math.pow(drag, dt / 16.67);

    // Integrate position
    player.x += player.vx * dt / 1000;
    player.y += player.vy * dt / 1000;

    // Clamp to world bounds (1920x1080 logical world)
    const r = 15; // player radius (scaled for larger world)
    player.x = Math.max(r, Math.min(1920 - r, player.x));
    player.y = Math.max(r, Math.min(1080 - r, player.y));

    // Visual lean proportional to velocity
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    player.visualLean = clamp(player.vx / maxVX, -1, 1) * 4; // ±4px skew

    // Player firing
    if (input.fire) {
      const now = Date.now();
      if (!state.player.lastShot || now - state.player.lastShot > 150) {
        state.projectiles.push({
          x: player.x,
          y: player.y - 10,
          vx: 0,
          vy: -1200,
          life: 3000
        });
        state.player.lastShot = now;
        audioRef.current?.click();
      }
    }

    // Update boss
    updateBoss(state, dt);

    // Update projectiles
    state.projectiles = state.projectiles.filter(p => {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.life -= dt;
      return p.life > 0 && p.y > -100 && p.y < 1180; // Scaled for 1920x1080
    });

    // Update enemy bullets
    state.enemyBullets = state.enemyBullets.filter(p => {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.life -= dt;
      return p.life > 0 && p.y > -100 && p.y < 1180 && p.x > -100 && p.x < 2020; // Scaled for 1920x1080
    });

    // Update asteroids
    state.asteroids = state.asteroids.filter(asteroid => {
      asteroid.x += asteroid.vx * dt / 1000;
      asteroid.y += asteroid.vy * dt / 1000;
      asteroid.angle += asteroid.av * dt / 1000;
      return asteroid.y < 1180; // Scaled for 1920x1080
    });

    // Update enemies
    state.enemies = state.enemies.filter(enemy => {
      enemy.x += enemy.vx * dt / 1000;
      enemy.y += enemy.vy * dt / 1000;
      
      // Enemy shooting with REMIX tuning
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        const cfg = remixUfoTuning[difficulty as keyof typeof remixUfoTuning] || remixUfoTuning.Normal;
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        
        // Apply accuracy with opening level nerfs
        let aimAccuracy = cfg.accuracy;
        if (state.stageTimer < 60000) {
          aimAccuracy *= 0.75; // Even worse accuracy for opening levels
        }
        const spread = (1 - aimAccuracy) * Math.PI * 0.25; // up to 45 degree spread
        const aimAngle = angle + (Math.random() - 0.5) * spread;
        
        const speed = cfg.bulletSpeed;
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(aimAngle) * speed,
          vy: Math.sin(aimAngle) * speed,
          life: 4000
        });
        
        // Reset timer with difficulty-based cooldown
        const cooldownMin = cfg.fireEveryMs[0];
        const cooldownMax = cfg.fireEveryMs[1];
        enemy.shootTimer = cooldownMin + Math.random() * (cooldownMax - cooldownMin);
      }
      
      return enemy.y < 1180 && enemy.hp > 0; // Scaled for 1920x1080
    });

    // Update particles
    state.particles = state.particles.filter(p => {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.life -= dt;
      return p.life > 0;
    });

    // Collision detection
    
    // Player vs enemy bullets
    if (player.invulnerable <= 0) {
      for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = state.enemyBullets[i];
        if (checkCollision(player.x, player.y, 15, bullet.x, bullet.y, 5)) { // Scaled collision
          state.enemyBullets.splice(i, 1);
          state.lives--;
          player.invulnerable = 2000;
          spawnExplosion(player.x, player.y); // Use same explosion as main asteroids
          audioRef.current?.explosion(); // Use explosion sound instead of abort
          
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

    // Player vs asteroids
    if (player.invulnerable <= 0) {
      for (const asteroid of state.asteroids) {
        if (checkCollision(player.x, player.y, 15, asteroid.x, asteroid.y, asteroid.r)) { // Scaled collision
          state.lives--;
          player.invulnerable = 2000;
          spawnExplosion(player.x, player.y); // Use same explosion as main asteroids
          audioRef.current?.explosion(); // Use explosion sound instead of abort
          
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

    // Projectiles vs asteroids
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      for (let j = state.asteroids.length - 1; j >= 0; j--) {
        const asteroid = state.asteroids[j];
        if (checkCollision(projectile.x, projectile.y, 2, asteroid.x, asteroid.y, asteroid.r)) {
          state.projectiles.splice(i, 1);
          state.asteroids.splice(j, 1);
          
          // Score
          const scores = { large: 20, medium: 50, small: 100 };
          state.score += scores[asteroid.size];
          
          // Split asteroid
          const splits = splitAsteroid(asteroid);
          state.asteroids.push(...splits);
          
          createParticles(asteroid.x, asteroid.y, 8, '#4fc3f7');
          audioRef.current?.explosion(); // Keep asteroid destruction sound
          break;
        }
      }
    }

    // Projectiles vs enemies
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const enemy = state.enemies[j];
        if (checkCollision(projectile.x, projectile.y, 4, enemy.x, enemy.y, 30)) { // Scaled collision
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
        if (checkCollision(projectile.x, projectile.y, 4, state.boss.x, state.boss.y, 96)) { // Scaled collision
          state.projectiles.splice(i, 1);
          state.boss.hp -= 10;
          createParticles(state.boss.x, state.boss.y, 3, '#4fc3f7');
          
          if (state.boss.hp <= 0) {
            state.score += 5000;
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
  };

  // World constants for cover scaling - 1920x1080
  const WORLD_W = 1920;
  const WORLD_H = 1080;

  // Apply cover transform (fill screen)
  const applyCoverTransform = (ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
    const sx = cw / WORLD_W;
    const sy = ch / WORLD_H;
    const scale = Math.max(sx, sy); // COVER (fills screen)
    const ox = (cw - WORLD_W * scale) * 0.5; // center
    const oy = (ch - WORLD_H * scale) * 0.5;
    ctx.setTransform(scale, 0, 0, scale, ox, oy); // draws in world units
    return { scale, ox, oy };
  };

  // Render game
  const renderGame = () => {
    const canvas = canvasRef.current;
    const state = gameStateRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Apply cover scaling
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const transform = applyCoverTransform(ctx, canvasWidth, canvasHeight);

    // Clear with gradient background (in world coordinates)
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    gradient.addColorStop(0, 'hsl(240, 100%, 2%)');
    gradient.addColorStop(1, 'hsl(260, 100%, 5%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Draw rich twinkling starfield with shooting stars (based on CavernStarfield)
    for (let layer = 0; layer < 3; layer++) {
      const layerSpeed = [0.3, 0.6, 1.0][layer];
      const starCount = [320, 180, 80][layer]; // Dense starfield like cavern
      const baseAlpha = [0.4, 0.7, 0.9][layer];
      
      for (let i = 0; i < starCount; i++) {
        // Better random distribution using prime multiples
        const seed = (i * 7919 + layer * 2311) % 65536;
        const x = (seed * 1.618033988749) % WORLD_W;
        const y = ((state.scrollY * layerSpeed + seed * 0.7853981634) % (WORLD_H + 400)) - 200;
        
        // Size with more variation for distant stars
        const sizeBase = [0.8, 1.5, 2.2][layer];
        const sizeVar = ((seed * 2.718281828) % 1000) / 1000;
        const size = sizeBase + sizeVar * 1.5;
        
        // Rich twinkling with varying frequencies
        const twinkleSpeed = [0.8, 1.2, 1.8][layer];
        const twinklePhase = (Date.now() * 0.001 * twinkleSpeed + seed * 0.314159) % (Math.PI * 2);
        const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(twinklePhase));
        const alpha = baseAlpha * twinkle;
        
        // Color variation - blue to white spectrum
        const hue = 200 + ((seed * 1.414213562) % 1000) / 1000 * 80;
        const sat = 60 + ((seed * 1.732050808) % 1000) / 1000 * 40;
        const brightness = 60 + ((seed * 1.41421356237) % 1000) / 1000 * 40;
        
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${brightness}%)`;
        ctx.globalAlpha = alpha;
        
        // Draw star with shadow/glow
        if (size > 1.8) {
          ctx.shadowColor = `hsl(${hue}, ${sat}%, ${brightness}%)`;
          ctx.shadowBlur = size * 1.5;
        }
        ctx.fillRect(x - size/2, y - size/2, size, size);
        
        if (size > 1.8) {
          ctx.shadowBlur = 0;
        }
      }
    }
    
    // Add shooting stars
    const shootingStarSeed = Math.floor(Date.now() / 8000) + state.stage; // Change every 8 seconds
    if (shootingStarSeed % 3 === 0) { // 1 in 3 chance
      const starPhase = (Date.now() % 8000) / 8000;
      if (starPhase < 0.6) { // Active for 60% of cycle
        const startX = 100 + (shootingStarSeed * 1.618) % (WORLD_W - 200);
        const startY = -50 + starPhase * WORLD_H * 0.3;
        const endX = startX + 300;
        const endY = startY + 400;
        
        // Draw shooting star trail
        const alpha = Math.sin(starPhase * Math.PI) * 0.8;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'hsl(60, 100%, 80%)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Bright head
        ctx.fillStyle = 'hsl(60, 100%, 90%)';
        ctx.shadowColor = 'hsl(60, 100%, 80%)';
        ctx.shadowBlur = 8;
        ctx.fillRect(endX - 2, endY - 2, 4, 4);
        ctx.shadowBlur = 0;
      }
    }
    
    ctx.globalAlpha = 1;

    // Draw player
    const player = state.player;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.visualLean * 0.1); // Convert to radians
    
    // Player ship (scaled for 1920x1080)
    ctx.strokeStyle = player.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 ? 
      'hsl(0, 100%, 70%)' : 'hsl(120, 100%, 70%)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-16, 16);
    ctx.lineTo(16, 16);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Draw projectiles (scaled for 1920x1080)
    ctx.fillStyle = 'hsl(60, 100%, 80%)';
    for (const p of state.projectiles) {
      ctx.fillRect(p.x - 2, p.y - 6, 4, 12);
    }

    // Draw enemy bullets (scaled for 1920x1080)
    ctx.fillStyle = 'hsl(0, 100%, 70%)';
    for (const p of state.enemyBullets) {
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }

    // Draw asteroids (scaled for 1920x1080) - opaque like main game
    ctx.strokeStyle = 'hsl(200, 100%, 60%)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'hsl(200, 100%, 60%)';
    ctx.shadowBlur = 8;
    
    for (const asteroid of state.asteroids) {
      ctx.save();
      ctx.translate(asteroid.x, asteroid.y);
      ctx.rotate(asteroid.angle);
      ctx.beginPath();
      for (let i = 0; i < asteroid.points.length; i++) {
        const point = asteroid.points[i];
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.closePath();
      
      // Fill to make asteroids opaque (occlude stars behind them)
      ctx.fillStyle = "black";
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.shadowBlur = 0;

    // Draw enemies (scaled for 1920x1080)
    ctx.strokeStyle = 'hsl(300, 100%, 70%)';
    ctx.lineWidth = 3;
    for (const enemy of state.enemies) {
      ctx.strokeRect(enemy.x - 20, enemy.y - 10, 40, 20);
    }

    // Draw boss
    if (state.boss) {
      const boss = state.boss;
      ctx.save();
      ctx.translate(boss.x, boss.y);
      
      // Boss body (scaled for 1920x1080)
      ctx.strokeStyle = boss.telegraphTimer > 0 ? 'hsl(60, 100%, 80%)' : 'hsl(0, 100%, 70%)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 96, 0, Math.PI * 2);
      ctx.stroke();
      
      // Boss details (scaled for 1920x1080)
      ctx.strokeRect(-60, -20, 120, 40);
      ctx.restore();
      
      // Boss health bar (scaled for 1920x1080)
      const barWidth = 600;
      const barHeight = 20;
      const barX = (WORLD_W - barWidth) / 2;
      const barY = 60;
      
      ctx.fillStyle = 'hsl(0, 0%, 20%)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      const healthPercent = boss.hp / boss.maxHp;
      ctx.fillStyle = healthPercent > 0.5 ? 'hsl(120, 100%, 50%)' : 
                     healthPercent > 0.2 ? 'hsl(60, 100%, 50%)' : 'hsl(0, 100%, 50%)';
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
      
      ctx.strokeStyle = 'hsl(200, 100%, 60%)';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Draw particles
    for (const p of state.particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }

    // HUD - Score and Stage (scaled for 1920x1080)
    ctx.fillStyle = 'hsl(200, 100%, 80%)';
    ctx.font = '36px monospace';
    ctx.fillText(`Score: ${state.score.toLocaleString()}`, 40, 80);
    ctx.fillText(`Stage: ${state.stage}`, 40, 140);
    
    // FPS Counter (large, bottom-right)
    ctx.fillStyle = 'hsl(60, 100%, 80%)';
    ctx.font = '48px monospace';
    const fpsValue = fpsRef.current || fps;
    const fpsText = `${Math.round(fpsValue)} FPS`;
    const fpsWidth = ctx.measureText(fpsText).width;
    ctx.fillText(fpsText, WORLD_W - fpsWidth - 40, WORLD_H - 40);
    
    // Lives display - EXACT same as main asteroids (top-right with card background)
    ctx.save();
    
    // Draw backdrop card (like main asteroids HUD)
    const cardX = WORLD_W - 160;
    const cardY = 40;
    const cardW = 120;
    const cardH = 80;
    
    // Card background with border
    ctx.fillStyle = 'hsla(0, 0%, 8%, 0.6)'; // Same as main asteroids card bg
    ctx.strokeStyle = 'hsla(0, 0%, 20%, 0.6)'; // Same border
    ctx.lineWidth = 1;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    
    // "LIVES" label
    ctx.fillStyle = 'hsl(0, 0%, 65%)'; // muted-foreground color
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LIVES', cardX + cardW/2, cardY + 20);
    
    // Mini lander icons (same as AsteroidsHUD)
    ctx.translate(cardX + cardW/2, cardY + 50);
    const spacing = Math.min(20, (cardW - 20) / Math.max(1, state.lives - 1));
    const startX = -(state.lives - 1) * spacing / 2;
    
    for (let i = 0; i < state.lives; i++) {
      ctx.save();
      ctx.translate(startX + i * spacing, 0);
      ctx.scale(1.2, 1.2); // Slightly larger like the main game
      ctx.strokeStyle = 'hsl(200, 100%, 60%)'; // accent color
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Mini lander shape (same as MiniLander component)
      ctx.moveTo(0, -6);    // Top point
      ctx.lineTo(4, 2);     // Right bottom
      ctx.lineTo(-4, 2);    // Left bottom
      ctx.closePath();
      ctx.stroke();
      // Landing legs
      ctx.beginPath();
      ctx.moveTo(-2, 1);
      ctx.lineTo(-5, 3);
      ctx.moveTo(2, 1);
      ctx.lineTo(5, 3);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    
    // REMIX watermark
    ctx.fillStyle = 'hsl(300, 100%, 60%)';
    ctx.font = '24px monospace';
    ctx.fillText('REMIX', 40, 260);

    // Stage timer (scaled for 1920x1080)
    ctx.fillStyle = 'hsl(200, 100%, 80%)';
    ctx.font = '32px monospace';
    const timeText = `Time: ${(state.stageTimer / 1000).toFixed(1)}s`;
    const timeWidth = ctx.measureText(timeText).width;
    ctx.fillText(timeText, (WORLD_W - timeWidth) / 2, 60);

    // Boss warning (scaled for 1920x1080)
    if (state.bossWarning) {
      ctx.fillStyle = 'hsl(0, 100%, 70%)';
      ctx.font = 'bold 48px monospace';
      const warningText = '⚠ BOSS APPROACHING ⚠';
      const warningWidth = ctx.measureText(warningText).width;
      ctx.fillText(warningText, (WORLD_W - warningWidth) / 2, WORLD_H / 2);
    }
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
      
      if (dt < 250) { // Cap delta time to prevent large jumps
        const clampedDt = Math.min(dt, 33.33); // Allow down to ~30 FPS without slowing time
        updateGame(clampedDt);
      }
      
      renderGame();
      
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
        () => true, // Always hide cursor during gameplay
        'container'
      );
      cursorManagerRef.current.forceHideCursor(); // Hide immediately on start
    }
    
    // Play background music
    audioRef.current.playTitleMusic();
    
    return () => {
      audioRef.current?.stopTitleMusic();
      cursorManagerRef.current?.detach();
    };
  }, [initGameState]);

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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
};