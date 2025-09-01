import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { UFO_DIFFICULTY_PRESETS } from "./systems/ufoConfig";
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
  
  // Calculate scale to maintain consistent gameplay
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
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = w + "px";
      c.style.height = h + "px";
      
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
    };
    
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
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
    paused: false
  });

  const ufoState = useRef<UFOState>(createUFOState(UFO_DIFFICULTY_PRESETS[difficulty] || UFO_DIFFICULTY_PRESETS.Normal, REFERENCE_WIDTH, REFERENCE_HEIGHT));
  const worldSeed = useRef(Math.floor(Math.random() * 1000000));
  const gameStartTime = useRef(Date.now());
  const lastTime = useRef(0);
  const lastFireTime = useRef(0);
  const frameCount = useRef(0);

  // Game loop
  useEffect(() => {
    let animationId: number;
    
    const gameLoop = (timestamp: number) => {
      if (!game.current.gameStarted || game.current.gameOver) {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      // Delta time calculation with 30% slowdown for everything except player and bullets
      let dt = lastTime.current ? (timestamp - lastTime.current) / 1000 : 0;
      dt = Math.min(dt, 1/30); // Cap to 30fps minimum
      lastTime.current = timestamp;

      if (paused) {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d")!;
      const { width: worldWidth, height: worldHeight, scale, viewWidth, viewHeight } = getWorldDimensionsAndScale(canvas.width, canvas.height);

      // Clear screen
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      // Apply world scaling and centering
      ctx.save();
      const offsetX = (viewWidth - worldWidth * scale) / 2;
      const offsetY = (viewHeight - worldHeight * scale) / 2;
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Update physics with slowdown (30% slower for asteroids, UFOs, etc.)
      const slowedDt = dt * 0.7; // 30% slowdown

      // Update asteroids (with slowdown)
      updateAsteroids(game.current.asteroids, slowedDt, worldWidth, worldHeight);

      // Update projectiles (no slowdown)
      updateProjectiles(game.current.projectiles, dt, worldWidth, worldHeight);

      // Update UFO (with slowdown)
      const ufoEvents: UFOEvents = { explosions: [], score: 0 };
      updateUFOState(ufoState.current, slowedDt, game.current.player.x, game.current.player.y, worldWidth, worldHeight, 
        game.current.score, game.current.wave, Date.now(), ufoEvents, audio.current.click, () => {}, mulberry32(worldSeed.current));

      // Handle input
      handleInput(dt);

      // Update player (no slowdown for movement)
      updatePlayer(dt, worldWidth, worldHeight);

      // Check collisions and apply color order logic
      handleCollisions(worldWidth, worldHeight);

      // Check target phase advancement
      checkPhaseAdvancement();

      // Render starfield (stationary twinkling stars)
      drawStarfield(ctx, worldWidth, worldHeight);

      // Render game objects
      drawColorAsteroids(ctx, game.current.asteroids);
      drawColorProjectiles(ctx, game.current.projectiles, "#00ff00");
      drawUFOs(ctx, ufoState.current.ufos, "#00ff00");
      drawUFOBullets(ctx, ufoState.current.bullets, "#00ff00");
      drawPlayer(ctx);

      // Render effects
      drawEffects(ctx);

      ctx.restore();

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

      // Check game over
      if (game.current.lives <= 0 && !game.current.gameOver) {
        game.current.gameOver = true;
        const elapsed = (Date.now() - gameStartTime.current) / 1000;
        onGameOver({
          score: game.current.score,
          wave: game.current.wave,
          cause: "destroyed",
          difficulty,
          elapsed,
          seed: worldSeed.current
        });
        return;
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [paused, difficulty, onGameOver]);

  const handleInput = (dt: number) => {
    // Gamepad input
    const gp = anyGamepad();
    if (gp) {
      const profile = gpProfileRef.current;
      const input = readGamepad(gp, profile);
      
      // Map gamepad to keyboard-style controls
      keys.current.left = input.buttons.rotateLeft || input.rotation < -0.3;
      keys.current.right = input.buttons.rotateRight || input.rotation > 0.3;
      keys.current.thrust = input.thrust > 0.1;
      thrustAnalog.current = input.thrust;
      
      // Fire button with swap
      const firePressed = swapButtons ? (input.thrust > 0.5) : (gp.buttons[1]?.pressed || false);
      keys.current.fire = firePressed;
      
      // Pause
      if (input.buttons.pause && !lastPauseDown.current) {
        setPaused(!paused);
      }
      lastPauseDown.current = input.buttons.pause;
    }

    // Fire rate limiting
    const now = Date.now();
    const canFire = now - lastFireTime.current > 150; // 150ms minimum between shots

    if (keys.current.fire && !lastFire.current && canFire) {
      fireProjectile();
      lastFireTime.current = now;
    }
    lastFire.current = keys.current.fire;
  };

  const updatePlayer = (dt: number, worldWidth: number, worldHeight: number) => {
    const player = game.current.player;
    
    // Rotation
    if (keys.current.left) {
      player.angle -= 5 * dt; // 5 radians/second
    }
    if (keys.current.right) {
      player.angle += 5 * dt;
    }

    // Thrust
    if (keys.current.thrust) {
      const thrustPower = thrustAnalog.current > 0 ? thrustAnalog.current : 1;
      const thrust = 400 * thrustPower; // pixels/second²
      player.vx += Math.cos(player.angle) * thrust * dt;
      player.vy += Math.sin(player.angle) * thrust * dt;
      player.thrust = thrustPower;
    } else {
      player.thrust = 0;
    }

    // Apply drag
    player.vx *= 0.995;
    player.vy *= 0.995;

    // Update position
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Screen wrapping
    if (player.x < 0) player.x += worldWidth;
    if (player.x > worldWidth) player.x -= worldWidth;
    if (player.y < 0) player.y += worldHeight;
    if (player.y > worldHeight) player.y -= worldHeight;

    // Update invulnerability
    if (player.invulnerable > 0) {
      player.invulnerable -= dt;
    }
  };

  const fireProjectile = () => {
    const player = game.current.player;
    const speed = 500; // pixels/second
    
    const projectile: ColorProjectile = {
      x: player.x + Math.cos(player.angle) * 12,
      y: player.y + Math.sin(player.angle) * 12,
      vx: Math.cos(player.angle) * speed + player.vx,
      vy: Math.sin(player.angle) * speed + player.vy,
      life: 2 // 2 seconds
    };
    
    game.current.projectiles.push(projectile);
    
    // Play sound
    audio.current.click();
  };

  const handleCollisions = (worldWidth: number, worldHeight: number) => {
    const rng = mulberry32(mixSeed(worldSeed.current, "COLLISION", game.current.wave, Date.now()));
    
    // Projectile-asteroid collisions with color logic
    const collisionResult = checkProjectileAsteroidCollisions(
      game.current.projectiles,
      game.current.asteroids,
      game.current.target,
      difficulty,
      game.current.player.x,
      game.current.player.y,
      rng
    );

    // Remove destroyed projectiles and asteroids
    for (let i = collisionResult.destroyedProjectiles.length - 1; i >= 0; i--) {
      game.current.projectiles.splice(collisionResult.destroyedProjectiles[i], 1);
    }
    for (let i = collisionResult.destroyedAsteroids.length - 1; i >= 0; i--) {
      game.current.asteroids.splice(collisionResult.destroyedAsteroids[i], 1);
    }

    // Add new asteroids (splits or penalties)
    game.current.asteroids.push(...collisionResult.newAsteroids);

    // Update score
    game.current.score = Math.max(0, game.current.score + collisionResult.score);

    // Handle wrong hits visual feedback
    if (collisionResult.wrongHits.length > 0) {
      for (const hit of collisionResult.wrongHits) {
        game.current.wrongHitEffect = {
          startTime: Date.now(),
          x: hit.x,
          y: hit.y
        };
        // Play error sound
        audio.current.click(); // Use click for now, could add error sound
      }
    }

    // Player-asteroid collision
    if (game.current.player.invulnerable <= 0) {
      if (checkPlayerAsteroidCollision(game.current.player.x, game.current.player.y, PLAYER_RADIUS, game.current.asteroids)) {
        // Player destroyed
        game.current.lives--;
        if (game.current.lives > 0) {
          respawnPlayer();
        }
      }
    }

    // UFO collisions (unchanged from classic)
    // Player-UFO collision
    if (game.current.player.invulnerable <= 0 && checkUFOPlayerCollision(ufoState.current.ufos, game.current.player.x, game.current.player.y)) {
      game.current.lives--;
      if (game.current.lives > 0) {
        respawnPlayer();
      }
    }

    // UFO bullet collisions
    if (game.current.player.invulnerable <= 0 && checkUFOBulletPlayerCollision(ufoState.current.bullets, game.current.player.x, game.current.player.y)) {
      game.current.lives--;
      if (game.current.lives > 0) {
        respawnPlayer();
      }
    }
  };

  const checkPhaseAdvancement = () => {
    const targetColor = game.current.target;
    const hasTargetColor = game.current.asteroids.some(asteroid => asteroid.color === targetColor);
    
    if (!hasTargetColor && game.current.asteroids.length > 0) {
      // Advance to next color
      const colorOrder: ("green" | "amber" | "red")[] = ["green", "amber", "red"];
      const currentIndex = colorOrder.indexOf(targetColor);
      const nextIndex = (currentIndex + 1) % colorOrder.length;
      game.current.target = colorOrder[nextIndex];
      
      // Phase completion bonus
      const bonuses = { Easy: 250, Normal: 500, Hard: 750 };
      game.current.score += bonuses[difficulty as keyof typeof bonuses] || 500;
      
      // Visual effect
      game.current.phaseAdvanceEffect = {
        startTime: Date.now(),
        color: ASTEROID_COLORS[game.current.target]
      };
      
      // Play phase advance sound
      audio.current.click(); // Use click for now, could add phase advance sound
    }
    
    // Check if wave is complete (all asteroids destroyed)
    if (game.current.asteroids.length === 0) {
      startNextWave();
    }
  };

  const startNextWave = () => {
    game.current.wave++;
    game.current.target = "green"; // Reset to green for new wave
    
    // Generate new asteroid field
    const newAsteroids = generateAsteroidField(
      game.current.wave,
      REFERENCE_WIDTH,
      REFERENCE_HEIGHT,
      mixSeed(worldSeed.current, "WAVE", game.current.wave, 0)
    );
    game.current.asteroids = newAsteroids;
  };

  const respawnPlayer = () => {
    const player = game.current.player;
    player.x = REFERENCE_WIDTH / 2;
    player.y = REFERENCE_HEIGHT / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = 0;
    player.thrust = 0;
    player.invulnerable = RESPAWN_INVULNERABILITY;
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const player = game.current.player;
    
    // Skip drawing if invulnerable and blinking
    if (player.invulnerable > 0 && Math.floor(Date.now() / 100) % 2) {
      return;
    }

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ff00";
    ctx.shadowBlur = 8;
    
    // Draw ship
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.stroke();
    
    // Draw thrust
    if (player.thrust > 0) {
      ctx.strokeStyle = "#ff6600";
      ctx.shadowColor = "#ff6600";
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-12 - player.thrust * 8, 0);
      ctx.stroke();
    }
    
    ctx.restore();
  };

  const drawStarfield = (ctx: CanvasRenderingContext2D, worldWidth: number, worldHeight: number) => {
    // Static twinkling stars
    const starCount = 200;
    const time = Date.now() * 0.001;
    
    for (let i = 0; i < starCount; i++) {
      const x = (i * 127) % worldWidth;
      const y = (i * 311) % worldHeight;
      const brightness = 0.3 + 0.7 * Math.sin(time + i) * 0.5 + 0.5;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
      ctx.fillRect(x, y, 1, 1);
    }
  };

  const drawEffects = (ctx: CanvasRenderingContext2D) => {
    const now = Date.now();
    
    // Phase advance effect
    if (game.current.phaseAdvanceEffect) {
      const elapsed = now - game.current.phaseAdvanceEffect.startTime;
      if (elapsed < 1000) { // 1 second effect
        const progress = elapsed / 1000;
        const radius = 50 + progress * 100;
        const alpha = 1 - progress;
        
        ctx.strokeStyle = game.current.phaseAdvanceEffect.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3;
        ctx.shadowColor = game.current.phaseAdvanceEffect.color;
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(REFERENCE_WIDTH / 2, REFERENCE_HEIGHT / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.globalAlpha = 1;
      } else {
        game.current.phaseAdvanceEffect = undefined;
      }
    }
    
    // Wrong hit effect
    if (game.current.wrongHitEffect) {
      const elapsed = now - game.current.wrongHitEffect.startTime;
      if (elapsed < 300) { // 300ms effect
        const progress = elapsed / 300;
        const alpha = 1 - progress;
        
        ctx.strokeStyle = "#ff0000";
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 4;
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 8;
        
        // Draw X
        const size = 15;
        const x = game.current.wrongHitEffect.x;
        const y = game.current.wrongHitEffect.y;
        
        ctx.beginPath();
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.stroke();
        
        ctx.globalAlpha = 1;
      } else {
        game.current.wrongHitEffect = undefined;
      }
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          keys.current.left = true;
          break;
        case "ArrowRight":
        case "KeyD":
          keys.current.right = true;
          break;
        case "ArrowUp":
        case "KeyW":
          keys.current.thrust = true;
          break;
        case "Space":
          e.preventDefault();
          keys.current.fire = true;
          break;
        case "Escape":
          e.preventDefault();
          setPaused(!paused);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          keys.current.left = false;
          break;
        case "ArrowRight":
        case "KeyD":
          keys.current.right = false;
          break;
        case "ArrowUp":
        case "KeyW":
          keys.current.thrust = false;
          break;
        case "Space":
          e.preventDefault();
          keys.current.fire = false;
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [paused]);

  // Start game
  useEffect(() => {
    if (!game.current.gameStarted) {
      // Initialize first wave
      const initialAsteroids = generateAsteroidField(
        1,
        REFERENCE_WIDTH,
        REFERENCE_HEIGHT,
        mixSeed(worldSeed.current, "WAVE", 1, 0)
      );
      game.current.asteroids = initialAsteroids;
      game.current.gameStarted = true;
      gameStartTime.current = Date.now();
    }
  }, []);

  // Initialize cursor manager
  useEffect(() => {
    cursorManager.current = new CursorManager(loadCursorConfig());
    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onContextMenu={(e) => e.preventDefault()}
      />
      
      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="flex justify-between items-start p-4 text-green-400 font-mono">
          <div className="space-y-1">
            <div>SCORE: {hud.score.toLocaleString()}</div>
            <div>LIVES: {hud.lives}</div>
            <div>WAVE: {hud.wave}</div>
          </div>
          
          {/* Target indicator */}
          <div className="text-center">
            <div className="text-sm opacity-60">TARGET:</div>
            <div 
              className="text-xl font-bold border-2 px-3 py-1 rounded"
              style={{ 
                color: ASTEROID_COLORS[hud.target],
                borderColor: ASTEROID_COLORS[hud.target],
                textShadow: `0 0 8px ${ASTEROID_COLORS[hud.target]}`
              }}
            >
              {hud.target.toUpperCase()}
            </div>
          </div>
          
          <div className="text-right space-y-1">
            <div>FPS: {fps}</div>
            <div className="text-xs opacity-60">{difficulty.toUpperCase()}</div>
          </div>
        </div>
        
        {/* Instructions (first 10 seconds) */}
        {game.current.gameStarted && (Date.now() - gameStartTime.current) < 10000 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center text-green-400 text-sm">
            <div className="bg-black/70 px-4 py-2 rounded border border-green-400/30">
              Destroy <span style={{ color: ASTEROID_COLORS.green }}>GREEN</span> first, then{" "}
              <span style={{ color: ASTEROID_COLORS.amber }}>AMBER</span>, then{" "}
              <span style={{ color: ASTEROID_COLORS.red }}>RED</span>
            </div>
          </div>
        )}
      </div>

      {/* Pause overlay */}
      {paused && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-green-400">PAUSED</h2>
            <p className="text-green-400/70">Press ESC to resume</p>
          </div>
        </div>
      )}

      {/* Exit button */}
      <Button
        onClick={onExit}
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 text-green-400 hover:bg-green-400/10 pointer-events-auto"
      >
        ← Exit
      </Button>
    </div>
  );
};
