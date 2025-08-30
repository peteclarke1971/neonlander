import React, { useEffect, useRef, useState, useCallback } from "react";
import { AudioManager } from "./AudioManager";
import { anyGamepad, loadProfile, readGamepad, getLastDeviceId } from "@/hooks/use-gamepad";

// Remix-specific types
interface RemixPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lean: number; // visual lean for strafing
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

interface RemixAsteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  av: number;
  size: "large" | "medium" | "small";
  points: { x: number; y: number }[];
}

interface RemixEnemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "grunt" | "saucer" | "sniper";
  hp: number;
  shootTimer: number;
  pattern?: number;
}

interface RemixBoss {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  pattern: number;
  patternTimer: number;
  attackTimer: number;
  telegraphTimer: number;
}

interface RemixGameState {
  player: RemixPlayer;
  projectiles: RemixProjectile[];
  enemyBullets: RemixProjectile[];
  asteroids: RemixAsteroid[];
  enemies: RemixEnemy[];
  boss: RemixBoss | null;
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

// Mulberry32 PRNG for seeded randomness
let seed = Date.now() % 2147483647;
if (seed <= 0) seed += 2147483646;

const mulberry32 = () => {
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

const mix = (...args: (string | number)[]) => {
  const str = args.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

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
        x: 400,
        y: 500,
        vx: 0,
        vy: 0,
        lean: 0,
        invulnerable: 0
      },
      projectiles: [],
      enemyBullets: [],
      asteroids: [],
      enemies: [],
      boss: null,
      particles: [],
      score: 0,
      lives: settings.lives,
      stage: 1,
      scrollY: 0,
      scrollSpeed: 110 * settings.scrollSpeedMultiplier,
      stageTimer: 0,
      gameStarted: true,
      gameOver: false,
      paused: false,
      victory: false,
      bossWarning: false
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
      vx: vx + (mulberry32() - 0.5) * 50,
      vy: vy + 30 + mulberry32() * 40,
      r,
      angle: 0,
      av: (mulberry32() - 0.5) * 4,
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
      const speed = 50 + mulberry32() * 50;
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

  // Create enemy
  const createEnemy = (type: "grunt" | "saucer" | "sniper", x: number, y: number): RemixEnemy => {
    return {
      x,
      y,
      vx: (mulberry32() - 0.5) * 100,
      vy: 50 + mulberry32() * 30,
      type,
      hp: type === "sniper" ? 2 : 1,
      shootTimer: 1000 + mulberry32() * 2000,
      pattern: Math.floor(mulberry32() * 3)
    };
  };

  // Create boss
  const createBoss = (): RemixBoss => {
    return {
      x: 400,
      y: 100,
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
      state.scrollSpeed = (110 + progress * 40) * settings.scrollSpeedMultiplier;
    } else if (state.stageTimer < 55000) {
      state.scrollSpeed = 150 * settings.scrollSpeedMultiplier;
    } else {
      state.scrollSpeed = 130 * settings.scrollSpeedMultiplier;
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
        // Intro: light asteroid field
        if (Math.random() < 0.3) {
          const size = Math.random() < 0.5 ? "large" : "medium";
          state.asteroids.push(createAsteroid(100 + Math.random() * 600, -50, size));
        }
      } else if (state.stageTimer < 40000) {
        // Patterns phase
        if (Math.random() < 0.4) {
          // Create formation patterns
          const pattern = Math.floor(Math.random() * 4);
          if (pattern === 0) {
            // Lanes
            for (let i = 0; i < 2; i++) {
              const x = 200 + i * 400;
              state.asteroids.push(createAsteroid(x, -50, "medium"));
            }
          } else if (pattern === 1) {
            // Wedge
            for (let i = 0; i < 3; i++) {
              const x = 300 + i * 100;
              const y = -50 - i * 30;
              state.asteroids.push(createAsteroid(x, y, "small"));
            }
          }
        }
      }

      // Spawn enemies (15-45s)
      if (state.stageTimer > 15000 && state.stageTimer < 45000 && Math.random() < 0.1) {
        const x = 50 + Math.random() * 700;
        const type = difficulty === "Hard" && Math.random() < 0.3 ? "sniper" : 
                    Math.random() < 0.5 ? "grunt" : "saucer";
        state.enemies.push(createEnemy(type, x, -30));
      }
    }
  };

  // Update boss AI
  const updateBoss = (state: RemixGameState, dt: number) => {
    if (!state.boss) return;

    const boss = state.boss;
    
    // Movement - horizontal oscillation
    boss.vx = Math.sin(state.stageTimer / 2000) * 60;
    boss.x += boss.vx * dt / 1000;
    boss.y += Math.sin(state.stageTimer / 1000) * 0.5;

    // Clamp position
    boss.x = Math.max(100, Math.min(700, boss.x));
    boss.y = Math.max(80, Math.min(150, boss.y));

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
            const speed = 200;
            state.enemyBullets.push({
              x: boss.x,
              y: boss.y + 20,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed + 50,
              life: 5000
            });
          }
        } else if (boss.pattern === 1) {
          // Laser sweep - simplified as bullet stream
          for (let i = 0; i < 5; i++) {
            const offsetX = (i - 2) * 100;
            state.enemyBullets.push({
              x: boss.x + offsetX,
              y: boss.y + 20,
              vx: 0,
              vy: 300,
              life: 3000
            });
          }
        } else if (boss.pattern === 2) {
          // Drone spawns - simplified as homing bullets
          for (let i = 0; i < 3; i++) {
            const angle = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
            const spread = (i - 1) * 0.3;
            const speed = 150;
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
      state.particles.push({
        x,
        y,
        vx: (mulberry32() - 0.5) * 200,
        vy: (mulberry32() - 0.5) * 200,
        life: 1000 + mulberry32() * 1000,
        maxLife: 2000,
        size: 2 + mulberry32() * 4,
        color
      });
    }
  };

  // Game update loop
  const updateGame = (dt: number) => {
    const state = gameStateRef.current;
    if (!state || !state.gameStarted || state.gameOver || state.paused) return;

    // Handle input
    const gp = anyGamepad();
    let input = { left: false, right: false, fire: false, thrust: false, abort: false };
    
    if (gp) {
      const profile = loadProfile(getLastDeviceId());
      const gamepadInput = readGamepad(gp, profile);
      input.abort = gamepadInput.buttons.abort;
      input.left = gamepadInput.buttons.rotateLeft;
      input.right = gamepadInput.buttons.rotateRight;
      input.fire = gamepadInput.thrust > 0.5; // Use thrust axis as fire button
      input.thrust = gamepadInput.thrust > 0.5;
    }

    // Keyboard input
    input.left = input.left || keysRef.current.has('ArrowLeft') || keysRef.current.has('a') || keysRef.current.has('A');
    input.right = input.right || keysRef.current.has('ArrowRight') || keysRef.current.has('d') || keysRef.current.has('D');
    input.fire = input.fire || keysRef.current.has(' ');
    input.abort = input.abort || keysRef.current.has('Escape');

    if (swapButtons) {
      [input.fire, input.thrust] = [input.thrust, input.fire];
    }

    // Handle abort
    if (input.abort) {
      onGameOver({
        score: state.score,
        wave: state.stage,
        cause: "abort",
        difficulty,
        elapsed: state.stageTimer / 1000
      });
      return;
    }

    // Update scroll
    state.scrollY += state.scrollSpeed * dt / 1000;

    // Update stage director
    updateStageDirector(state, dt);

    // Update player
    const player = state.player;
    if (player.invulnerable > 0) {
      player.invulnerable -= dt;
    }

    // Player horizontal movement
    const accel = 500;
    const maxSpeed = 260;
    const drag = 0.92;

    if (input.left) {
      player.vx -= accel * dt / 1000;
    }
    if (input.right) {
      player.vx += accel * dt / 1000;
    }

    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
    player.vx *= Math.pow(drag, dt / 16.67);
    player.x += player.vx * dt / 1000;

    // Clamp player to screen
    player.x = Math.max(20, Math.min(780, player.x));

    // Player lean effect
    player.lean = player.vx * 0.01;

    // Player firing
    if (input.fire) {
      const now = Date.now();
      if (!state.player.lastShot || now - state.player.lastShot > 150) {
        state.projectiles.push({
          x: player.x,
          y: player.y - 10,
          vx: 0,
          vy: -600,
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
      return p.life > 0 && p.y > -50 && p.y < 650;
    });

    // Update enemy bullets
    state.enemyBullets = state.enemyBullets.filter(p => {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.life -= dt;
      return p.life > 0 && p.y > -50 && p.y < 650 && p.x > -50 && p.x < 850;
    });

    // Update asteroids
    state.asteroids = state.asteroids.filter(asteroid => {
      asteroid.x += asteroid.vx * dt / 1000;
      asteroid.y += asteroid.vy * dt / 1000;
      asteroid.angle += asteroid.av * dt / 1000;
      return asteroid.y < 650;
    });

    // Update enemies
    state.enemies = state.enemies.filter(enemy => {
      enemy.x += enemy.vx * dt / 1000;
      enemy.y += enemy.vy * dt / 1000;
      
      // Enemy shooting
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const speed = 200;
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 4000
        });
        enemy.shootTimer = 2000 + Math.random() * 3000;
      }
      
      return enemy.y < 650 && enemy.hp > 0;
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
        if (checkCollision(player.x, player.y, 8, bullet.x, bullet.y, 3)) {
          state.enemyBullets.splice(i, 1);
          state.lives--;
          player.invulnerable = 2000;
          createParticles(player.x, player.y, 10, '#ff6b6b');
          audioRef.current?.abort();
          
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
        if (checkCollision(player.x, player.y, 8, asteroid.x, asteroid.y, asteroid.r)) {
          state.lives--;
          player.invulnerable = 2000;
          createParticles(player.x, player.y, 10, '#ff6b6b');
          audioRef.current?.abort();
          
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
        if (checkCollision(projectile.x, projectile.y, 2, enemy.x, enemy.y, 15)) {
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
        if (checkCollision(projectile.x, projectile.y, 2, state.boss.x, state.boss.y, 48)) {
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
    ctx.scale(dpr, dpr);

    // Clear with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, 'hsl(240, 100%, 2%)');
    gradient.addColorStop(1, 'hsl(260, 100%, 5%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw parallax stars
    ctx.fillStyle = 'hsl(200, 100%, 80%)';
    for (let layer = 0; layer < 3; layer++) {
      const layerSpeed = [0.4, 0.7, 1.0][layer];
      const starCount = [50, 30, 20][layer];
      
      for (let i = 0; i < starCount; i++) {
        const x = (i * 137.5) % rect.width;
        const y = ((state.scrollY * layerSpeed + i * 23.7) % (rect.height + 100)) - 50;
        const size = 1 + layer;
        
        ctx.globalAlpha = 0.3 + layer * 0.3;
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;

    // Draw player
    const player = state.player;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.lean);
    
    // Player ship (simple triangle)
    ctx.strokeStyle = player.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 ? 
      'hsl(0, 100%, 70%)' : 'hsl(120, 100%, 70%)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-8, 8);
    ctx.lineTo(8, 8);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Draw projectiles
    ctx.fillStyle = 'hsl(60, 100%, 80%)';
    for (const p of state.projectiles) {
      ctx.fillRect(p.x - 1, p.y - 3, 2, 6);
    }

    // Draw enemy bullets
    ctx.fillStyle = 'hsl(0, 100%, 70%)';
    for (const p of state.enemyBullets) {
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    // Draw asteroids
    ctx.strokeStyle = 'hsl(200, 100%, 60%)';
    ctx.lineWidth = 2;
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
      ctx.stroke();
      ctx.restore();
    }

    // Draw enemies
    ctx.strokeStyle = 'hsl(300, 100%, 70%)';
    ctx.lineWidth = 2;
    for (const enemy of state.enemies) {
      ctx.strokeRect(enemy.x - 10, enemy.y - 5, 20, 10);
    }

    // Draw boss
    if (state.boss) {
      const boss = state.boss;
      ctx.save();
      ctx.translate(boss.x, boss.y);
      
      // Boss body
      ctx.strokeStyle = boss.telegraphTimer > 0 ? 'hsl(60, 100%, 80%)' : 'hsl(0, 100%, 70%)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.stroke();
      
      // Boss details
      ctx.strokeRect(-30, -10, 60, 20);
      ctx.restore();
      
      // Boss health bar
      const barWidth = 300;
      const barHeight = 10;
      const barX = (rect.width - barWidth) / 2;
      const barY = 30;
      
      ctx.fillStyle = 'hsl(0, 0%, 20%)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      const healthPercent = boss.hp / boss.maxHp;
      ctx.fillStyle = healthPercent > 0.5 ? 'hsl(120, 100%, 50%)' : 
                     healthPercent > 0.2 ? 'hsl(60, 100%, 50%)' : 'hsl(0, 100%, 50%)';
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
      
      ctx.strokeStyle = 'hsl(200, 100%, 60%)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Draw particles
    for (const p of state.particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }

    // Draw HUD
    ctx.fillStyle = 'hsl(200, 100%, 80%)';
    ctx.font = '20px monospace';
    ctx.fillText(`Score: ${state.score.toLocaleString()}`, 20, 30);
    ctx.fillText(`Lives: ${state.lives}`, 20, 55);
    ctx.fillText(`Stage: ${state.stage}`, 20, 80);
    
    // REMIX watermark
    ctx.fillStyle = 'hsl(300, 100%, 60%)';
    ctx.font = '12px monospace';
    ctx.fillText('REMIX', 20, 100);

    // Stage timer
    ctx.fillStyle = 'hsl(200, 100%, 80%)';
    ctx.font = '16px monospace';
    const timeText = `Time: ${(state.stageTimer / 1000).toFixed(1)}s`;
    const timeWidth = ctx.measureText(timeText).width;
    ctx.fillText(timeText, (rect.width - timeWidth) / 2, 30);

    // Boss warning
    if (state.bossWarning) {
      ctx.fillStyle = 'hsl(0, 100%, 70%)';
      ctx.font = 'bold 24px monospace';
      const warningText = '⚠ BOSS APPROACHING ⚠';
      const warningWidth = ctx.measureText(warningText).width;
      ctx.fillText(warningText, (rect.width - warningWidth) / 2, rect.height / 2);
    }
  };

  // Game loop
  useEffect(() => {
    let animationId: number;
    
    const gameLoop = (currentTime: number) => {
      const dt = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      if (dt < 100) { // Cap delta time
        updateGame(dt);
      }
      
      renderGame();
      
      animationId = requestAnimationFrame(gameLoop);
    };
    
    lastTimeRef.current = performance.now();
    animationId = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [difficulty]);

  // Initialize audio and game state
  useEffect(() => {
    audioRef.current = new AudioManager();
    gameStateRef.current = initGameState();
    
    // Play background music
    audioRef.current.playTitleMusic();
    
    return () => {
      audioRef.current?.stopTitleMusic();
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