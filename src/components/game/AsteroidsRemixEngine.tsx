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
  onExit: () => void;
  onGameOver: (data: RemixGameOverData) => void;
  swapButtons?: boolean;
}

// Use seeded randomness from stageConfig
let gameSeed = Date.now() % 2147483647;
if (gameSeed <= 0) gameSeed += 2147483646;

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
    gameSeed = Date.now() % 2147483647;
    
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

    // Update scroll
    state.scrollY += state.scrollSpeed * dt / 1000;

    // Update stage director
    updateStageDirector(state, dt);

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

    // Update systems using new modular functions
    updateAsteroids(state.asteroids, dt, 1920, 1080);
    updateEnemies(state.enemies, dt, 1920, 1080, mulberry32(gameSeed));
    updatePowerups(state.powerups.items, dt, 1080);
    updateActivePowerups(state.powerups.active, dt);
    
    // Update boss
    if (state.boss) {
      const bossProjectiles = updateBoss(state.boss, dt, 1920, 1080, state.player.x, state.player.y);
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
  const applyCoverTransform = (ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
    const sx = cw / WORLD_W;
    const sy = ch / WORLD_H;
    const scale = Math.max(sx, sy);
    const ox = (cw - WORLD_W * scale) * 0.5;
    const oy = (ch - WORLD_H * scale) * 0.5;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
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
    applyCoverTransform(ctx, rect.width, rect.height);

    // Clear with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    gradient.addColorStop(0, 'hsl(240, 100%, 2%)');
    gradient.addColorStop(1, 'hsl(260, 100%, 5%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Render asteroids
    for (const asteroid of state.asteroids) {
      renderAsteroid(ctx, asteroid);
    }

    // Render enemies
    for (const enemy of state.enemies) {
      renderEnemy(ctx, enemy);
    }

    // Render power-ups
    for (const powerup of state.powerups.items) {
      renderPowerup(ctx, powerup);
    }

    // Render boss
    if (state.boss) {
      renderBoss(ctx, state.boss);
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
  };

  // Helper render functions
  const renderPlayer = (ctx: CanvasRenderingContext2D, player: any, hasShield: boolean) => {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    
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

  const renderAsteroid = (ctx: CanvasRenderingContext2D, asteroid: any) => {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.rotation);
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const radius = asteroid.size === 'giant' ? 72 : asteroid.size === 'large' ? 40 : asteroid.size === 'medium' ? 25 : 15;
    for (let i = 0; i < asteroid.vertices.length; i++) {
      const angle = (i / asteroid.vertices.length) * Math.PI * 2;
      const r = radius * asteroid.vertices[i];
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  const renderEnemy = (ctx: CanvasRenderingContext2D, enemy: any) => {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    
    switch (enemy.type) {
      case 'grunt':
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'saucer':
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
        ctx.beginPath();
        ctx.rect(-10, -10, 20, 20);
        ctx.stroke();
    }
    
    ctx.restore();
  };

  const renderPowerup = (ctx: CanvasRenderingContext2D, powerup: any) => {
    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-8, -8, 16, 16);
    ctx.stroke();
    ctx.restore();
  };

  const renderBoss = (ctx: CanvasRenderingContext2D, boss: any) => {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(-40, -40, 80, 80);
    ctx.stroke();
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
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
};