import React, { useEffect, useRef, useCallback, useState } from "react";
import { DuelOptions, DuelGameState, DuelPlayer, DuelPhase } from "./types";
import { generateArena } from "./arenaGen";
import { createProjectile, updateProjectiles, checkProjectileCollision, checkProjectileTerrainCollision, renderProjectiles } from "./weapons";
import { updatePowerupPads, checkPowerupCollision, activatePowerup, updatePlayerPowerups, handleShieldHit, renderPowerupPads } from "./powerups";
import { updateVolcanoVents, checkVolcanoCollision, renderVolcanoVents } from "./hazards";
import { DuelHUD } from "@/ui/duel/DuelHUD";
import { createCountdownIntro } from "@/components/game/intro/CountdownIntro";
import { CountdownOverlay } from "@/components/game/intro/CountdownOverlay";
import { AudioManager } from "@/components/game/AudioManager";
import { anyGamepad, readGamepad, loadProfile } from "@/hooks/use-gamepad";
import { HyperspaceStarfield } from "@/components/game/HyperspaceStarfield";

interface DuelEngineProps {
  options: DuelOptions;
  onMatchEnd: () => void;
}

export const DuelEngine: React.FC<DuelEngineProps> = ({ options, onMatchEnd }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<DuelGameState | null>(null);
  const audioRef = useRef(new AudioManager());
  const countdownRef = useRef(createCountdownIntro());
  const lastTimeRef = useRef(0);
const animationFrameRef = useRef<number | null>(null);

// Keyboard fire-hold state for continuous firing like Asteroids
const fireHeldRef = useRef<{ 1: boolean; 2: boolean }>({ 1: false, 2: false });

  // Starfield state
  type Star = { x: number; y: number; size: number; baseA: number; tw: number; ph: number; bright: boolean };
  type Shooting = { x: number; y: number; vx: number; vy: number; life: number; max: number };
  const starsRef = useRef<Star[]>([]);
  const shootingRef = useRef<Shooting[]>([]);
  const nextShootingRef = useRef(0.6 + Math.random() * 1.6);
  
  const [gameState, setGameState] = useState<DuelGameState | null>(null);

  // Initialize game state
  const initializeGame = useCallback(() => {
    const arena = generateArena(options.seed, options.hazards);
    
    const createPlayer = (id: 1 | 2, spawnIndex: number): DuelPlayer => ({
      id,
      x: arena.spawnPoints[spawnIndex].x,
      y: arena.spawnPoints[spawnIndex].y,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVel: 0,
      armor: 4,
      fuel: 1000,
      maxFuel: 1000,
      activePowerup: null,
      powerupTimeLeft: 0,
      shieldHitsLeft: 0,
      invulnerable: false,
      invulnTime: 0,
      thrust: false,
      rotateLeft: false,
      rotateRight: false,
      fire: false,
      rotateBoost: false,
      roundsWon: 0
    });

    const initialState: DuelGameState = {
      phase: "countdown",
      players: [createPlayer(1, 0), createPlayer(2, 1)],
      projectiles: [],
      arena,
      currentRound: 1,
      roundTimer: 0,
      suddenDeath: false,
      matchWinner: null,
      phaseTimer: 0,
      wrap: options.wrap,
      hazards: options.hazards,
      seed: options.seed
    };

    gameStateRef.current = initialState;
    setGameState(initialState);

    // Start countdown
    countdownRef.current.start({
      variant: "freeze",
      words: ["3", "2", "1", "FIGHT!"],
      onGo: () => {
        if (gameStateRef.current) {
          gameStateRef.current.phase = "active";
          // Grant invulnerability
          gameStateRef.current.players.forEach(player => {
            player.invulnerable = true;
            player.invulnTime = 1200; // 1.2s
          });
        }
      }
    });

  }, [options]);

  // Input handling
  const updateInput = useCallback(() => {
    if (!gameStateRef.current || gameStateRef.current.phase !== "active") return;

    const gamepads = navigator.getGamepads();
    const [p1, p2] = gameStateRef.current.players;
    
    // Apply keyboard-held fire every frame (for auto-fire)
    p1.fire = p1.fire || fireHeldRef.current[1];
    p2.fire = p2.fire || fireHeldRef.current[2];

    // Player 1 input (Gamepad 0 or keyboard)
    const gp1 = gamepads[0];
    if (gp1?.connected) {
      const profile1 = loadProfile(gp1.id);
      const input1 = readGamepad(gp1, profile1);
      
      p1.rotateLeft = input1.rotation < -0.5;
      p1.rotateRight = input1.rotation > 0.5;
      p1.thrust = input1.thrust > 0.5;
      // Accept A(0), X(2), or Y(3 abort) as fire, plus keyboard hold
      const a1 = !!gp1.buttons?.[0]?.pressed;
      const x1 = !!gp1.buttons?.[2]?.pressed;
      const y1 = !!gp1.buttons?.[3]?.pressed || input1.buttons.abort;
      p1.fire = p1.fire || a1 || x1 || y1;
      p1.rotateBoost = input1.rotateBoost;
    }

    // Player 2 input (Gamepad 1 or keyboard fallback)
    const gp2 = gamepads[1];
    if (gp2?.connected) {
      const profile2 = loadProfile(gp2.id);
      const input2 = readGamepad(gp2, profile2);
      
      p2.rotateLeft = input2.rotation < -0.5;
      p2.rotateRight = input2.rotation > 0.5;
      p2.thrust = input2.thrust > 0.5;
      // Accept A(0), X(2), or Y(3 abort) as fire, plus keyboard hold
      const a2 = !!gp2.buttons?.[0]?.pressed;
      const x2 = !!gp2.buttons?.[2]?.pressed;
      const y2 = !!gp2.buttons?.[3]?.pressed || input2.buttons.abort;
      p2.fire = p2.fire || a2 || x2 || y2;
      p2.rotateBoost = input2.rotateBoost;
    }
  }, []);

  // Physics and game logic update
  const updateGame = useCallback((deltaTime: number) => {
    if (!gameStateRef.current) return;

    const state = gameStateRef.current;
    updateInput();

    // Update countdown state during countdown phase
    if (state.phase === "countdown") {
      // Force update to trigger re-render with latest countdown state
      setGameState({ ...state });
      return; // Countdown handles phase transition
    }

    if (state.phase === "active") {
      state.roundTimer += deltaTime;
      
      // Check for sudden death (90 seconds)
      if (state.roundTimer > 90 && !state.suddenDeath) {
        state.suddenDeath = true;
      }

      // Update players
      updatePlayers(state.players, deltaTime);
      
      // Update powerups
      if (state.hazards) {
        updatePowerupPads(state.arena.powerupPads, deltaTime, state.roundTimer * 1000, state.seed, state.suddenDeath);
      }
      
      // Update hazards
      if (state.hazards) {
        updateVolcanoVents(state.arena.volcanoVents, deltaTime, state.seed, state.suddenDeath, state.arena.worldHeight);
      }
      
      // Handle firing
      handleWeaponFire(state);
      
      // Update projectiles
      state.projectiles = updateProjectiles(
        state.projectiles,
        deltaTime,
        state.arena.worldWidth,
        state.arena.worldHeight,
        state.wrap
      );
      
      // Collision detection
      checkCollisions(state);
      
      // Check for round end
      const alivePlayers = state.players.filter(p => p.armor > 0);
      if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0];
        if (winner) {
          winner.roundsWon++;
        }
        
        // Check for match end
        const matchWinner = state.players.find(p => p.roundsWon >= 2);
        if (matchWinner) {
          state.phase = "match-end";
          state.matchWinner = matchWinner.id;
          state.phaseTimer = 0;
        } else {
          state.phase = "round-end";
          state.phaseTimer = 0;
        }
      }
    }

    if (state.phase === "round-end") {
      state.phaseTimer += deltaTime;
      if (state.phaseTimer > 3) {
        // Start next round
        startNextRound(state);
      }
    }

    if (state.phase === "match-end") {
      state.phaseTimer += deltaTime;
      if (state.phaseTimer > 5) {
        onMatchEnd();
      }
    }

    // Update starfield
    const canvas = canvasRef.current;
    if (canvas) {
      // Update shooting stars
      const shooting = shootingRef.current;
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += deltaTime;
        s.x += s.vx * deltaTime;
        s.y += s.vy * deltaTime;
        if (s.life > s.max) shooting.splice(i, 1);
      }

      // Spawn shooting stars periodically
      if (state.roundTimer >= nextShootingRef.current) {
        nextShootingRef.current = state.roundTimer + 0.6 + Math.random() * 1.6;
        spawnShooting();
      }
    }

    setGameState({ ...state });
  }, [updateInput, onMatchEnd]);

  // Player physics update (Asteroids-style)
  const updatePlayers = (players: DuelPlayer[], deltaTime: number) => {
    const THRUST_FORCE = 600; // px/s²
    const ANGULAR_ACCEL = 8; // rad/s²
    const MAX_ANGULAR_VEL = 4; // rad/s
    const FUEL_DRAIN_RATE = 100; // fuel/s when thrusting
    const ROTATION_BOOST = 2.0; // multiplier when boost held
    const DRAG = 0.98; // Space drag (slight friction per frame)

    for (const player of players) {
      // Update invulnerability
      if (player.invulnerable && player.invulnTime > 0) {
        player.invulnTime -= deltaTime * 1000;
        if (player.invulnTime <= 0) {
          player.invulnerable = false;
        }
      }

      // Update powerups
      updatePlayerPowerups(player, deltaTime);

      // Rotation
      if (player.rotateLeft || player.rotateRight) {
        const direction = player.rotateLeft ? -1 : 1;
        const accel = ANGULAR_ACCEL * (player.rotateBoost ? ROTATION_BOOST : 1);
        player.angularVel += direction * accel * deltaTime;
        player.angularVel = Math.max(-MAX_ANGULAR_VEL, Math.min(MAX_ANGULAR_VEL, player.angularVel));
      } else {
        // Angular friction
        player.angularVel *= Math.pow(0.9, deltaTime * 60);
      }

      player.angle += player.angularVel * deltaTime;

      // Thrust (Asteroids-style)
      if (player.thrust) {
        // If fuel gauge is hidden, make fuel infinite (no drain)
        if (!options.showFuel || player.fuel > 0) {
          const thrustX = Math.cos(player.angle) * THRUST_FORCE * deltaTime;
          const thrustY = Math.sin(player.angle) * THRUST_FORCE * deltaTime;
          player.vx += thrustX;
          player.vy += thrustY;
          if (options.showFuel) {
            player.fuel = Math.max(0, player.fuel - FUEL_DRAIN_RATE * deltaTime);
          }
        }
      }

      // Apply space drag (Asteroids-style light friction)
      player.vx *= 0.995;
      player.vy *= 0.995;

      // Position update
      player.x += player.vx * deltaTime;
      player.y += player.vy * deltaTime;

      // World boundary handling
      if (gameStateRef.current?.wrap) {
        if (player.x < 0) player.x += gameStateRef.current.arena.worldWidth;
        if (player.x > gameStateRef.current.arena.worldWidth) player.x -= gameStateRef.current.arena.worldWidth;
        if (player.y < 0) player.y += gameStateRef.current.arena.worldHeight;
        if (player.y > gameStateRef.current.arena.worldHeight) player.y -= gameStateRef.current.arena.worldHeight;
      } else {
        // Clamp to screen bounds without KO
        player.x = Math.max(20, Math.min(gameStateRef.current?.arena.worldWidth! - 20, player.x));
        player.y = Math.max(20, Math.min(gameStateRef.current?.arena.worldHeight! - 20, player.y));
      }
    }
  };

  // Add fire rate limiting per player
  const lastFireTimeRef = useRef<{ [key: number]: number }>({});

  const handleWeaponFire = (state: DuelGameState) => {
    const FIRE_DELAY = 170; // ms
    const currentTime = Date.now();
    
    for (const player of state.players) {
      if (player.fire) {
        const lastFireTime = lastFireTimeRef.current[player.id] || 0;
        if (currentTime - lastFireTime >= FIRE_DELAY) {
          // Spawn from ship nose and inherit ship velocity (Asteroids-style)
          const noseOffset = 12;
          const sx = player.x + Math.cos(player.angle) * noseOffset;
          const sy = player.y + Math.sin(player.angle) * noseOffset;
          const newProjectiles = createProjectile(
            player.id,
            sx,
            sy,
            player.angle,
            player.activePowerup
          ).map(p => ({ ...p, vx: p.vx + player.vx, vy: p.vy + player.vy }));
          state.projectiles.push(...newProjectiles);
          lastFireTimeRef.current[player.id] = currentTime;
        }
        player.fire = false; // Consume fire input
      }
    }
  };

  const checkCollisions = (state: DuelGameState) => {
    // Projectile vs player collisions
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      
      for (const player of state.players) {
        if (checkProjectileCollision(projectile, player)) {
          // Check if shield blocks the hit
          if (!handleShieldHit(player)) {
            player.armor = Math.max(0, player.armor - projectile.damage);
          }
          state.projectiles.splice(i, 1);
          break;
        }
      }
    }

    // Projectile vs terrain collisions
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      if (checkProjectileTerrainCollision(projectile, state.arena.terrain)) {
        state.projectiles.splice(i, 1);
      }
    }

    // Powerup collisions
    for (const player of state.players) {
      const collectedPad = checkPowerupCollision(player, state.arena.powerupPads);
      if (collectedPad && collectedPad.powerupType) {
        activatePowerup(player, collectedPad.powerupType);
        collectedPad.powerupType = null;
        collectedPad.cooldownTime = 1500; // 1.5s cooldown
      }
    }

    // Volcano hazard collisions
    if (state.hazards) {
      for (const player of state.players) {
        if (checkVolcanoCollision(player, state.arena.volcanoVents)) {
          player.armor = 0; // Lava = instant KO
        }
      }
    }
  };

  const startNextRound = (state: DuelGameState) => {
    state.currentRound++;
    state.roundTimer = 0;
    state.suddenDeath = false;
    state.phase = "countdown";
    state.projectiles = [];
    
    // Reset players
    const spawnOrder = state.currentRound % 2 === 0 ? [1, 0] : [0, 1]; // Swap sides each round
    
    state.players.forEach((player, index) => {
      const spawnIndex = spawnOrder[index];
      player.x = state.arena.spawnPoints[spawnIndex].x;
      player.y = state.arena.spawnPoints[spawnIndex].y;
      player.vx = 0;
      player.vy = 0;
      player.angle = 0;
      player.angularVel = 0;
      player.armor = 4;
      player.fuel = 1000;
      player.activePowerup = null;
      player.powerupTimeLeft = 0;
      player.shieldHitsLeft = 0;
      player.invulnerable = false;
      player.invulnTime = 0;
    });

    // Restart countdown
    countdownRef.current.start({
      variant: "freeze",
      words: ["3", "2", "1", "FIGHT!"],
      onGo: () => {
        if (gameStateRef.current) {
          gameStateRef.current.phase = "active";
          gameStateRef.current.players.forEach(player => {
            player.invulnerable = true;
            player.invulnTime = 1200;
          });
        }
      }
    });
  };

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !gameStateRef.current) return;

    const state = gameStateRef.current;
    
    // Clear canvas
    ctx.fillStyle = "hsl(var(--background))";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Gameplay starfield (same as Asteroids)
    drawStars(ctx, state.roundTimer)

    // Render terrain (simple for now)
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < state.arena.terrain.length; i++) {
      const point = state.arena.terrain[i];
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    // Render powerup pads
    renderPowerupPads(ctx, state.arena.powerupPads);

    // Render hazards
    if (state.hazards) {
      renderVolcanoVents(ctx, state.arena.volcanoVents);
    }

    // Render projectiles
    renderProjectiles(ctx, state.projectiles);

    // Render players
    renderPlayers(ctx, state.players);

  }, []);

  const renderPlayers = (ctx: CanvasRenderingContext2D, players: DuelPlayer[]) => {
    for (const player of players) {
      if (player.armor <= 0) continue;

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // Player tint
      const color = player.id === 1 ? "hsl(165 92% 60%)" : "hsl(120 100% 60%)"; // Green-cyan vs lime
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Invulnerability effect
      if (player.invulnerable) {
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([5, 5]);
      }

      // Shield effect
      if (player.activePowerup === "shield" && player.shieldHitsLeft > 0) {
        ctx.strokeStyle = "hsl(200 100% 60%)";
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ship body (triangle)
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.stroke();

      // Thrust effect
      if (player.thrust) {
        ctx.strokeStyle = "hsl(30 100% 60%)";
        ctx.beginPath();
        ctx.moveTo(-6, -3);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-6, 3);
        ctx.stroke();
      }

      ctx.restore();
    }
  };

  // Initialize starfield
  const initStarfield = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const stars = starsRef.current;
    stars.length = 0; // Clear existing stars
    
    const dprInit = Math.min(2, window.devicePixelRatio || 1);
    const pxW = canvas.width / dprInit;
    const pxH = canvas.height / dprInit;
    
    // Screen-space static stars covering full screen
    for (let i = 0; i < 320; i++) {
      const sx = Math.random() * pxW;
      const sy = Math.random() * pxH;
      const bright = Math.random() < 0.15;
      stars.push({ 
        x: sx, 
        y: sy,
        size: bright ? 2.4 : 1.4, 
        baseA: bright ? 0.95 : 0.6, 
        tw: 0.5 + Math.random() * 1.5, 
        ph: Math.random() * Math.PI * 2, 
        bright 
      });
    }
  }, []);

  const spawnShooting = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const shooting = shootingRef.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewWpx = canvas.width / dpr;
    const viewHpx = canvas.height / dpr;
    const margin = 80;
    const side = Math.floor(Math.random() * 3); // 0:left, 1:right, 2:top
    let sx = 0, sy = 0, vx = 0, vy = 0;
    
    if (side === 0) {
      sx = -margin; 
      sy = Math.random() * (viewHpx * 0.7);
      vx = 180 + Math.random() * 260; 
      vy = (Math.random() - 0.5) * 140;
    } else if (side === 1) {
      sx = viewWpx + margin; 
      sy = Math.random() * (viewHpx * 0.7);
      vx = -180 - Math.random() * 260; 
      vy = (Math.random() - 0.5) * 140;
    } else {
      sx = Math.random() * viewWpx; 
      sy = -margin;
      vx = (Math.random() - 0.5) * 280; 
      vy = 160 + Math.random() * 220;
    }
    
    const life = 0;
    const max = 0.6 + Math.random() * 1.0;
    shooting.push({ x: sx, y: sy, vx, vy, life, max });
  }, []);

  const drawStars = useCallback((ctx: CanvasRenderingContext2D, elapsed: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const stars = starsRef.current;
    const shooting = shootingRef.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const wpx = canvas.width / dpr;
    const hpx = canvas.height / dpr;
    
    // Use primary color as star color (matches duel theme)
    const starColor = "hsl(var(--primary))";
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for screen space
    ctx.shadowColor = starColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = starColor;
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
      ctx.strokeStyle = starColor;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }, []);

  // Game loop
  const gameLoop = useCallback((currentTime: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = currentTime;
    }

    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    updateGame(deltaTime);
    render();

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, render]);

  // Initialize on mount
  useEffect(() => {
    initStarfield();
    initializeGame();
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initStarfield, initializeGame, gameLoop]);

  // Keyboard input handling (always active)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStateRef.current || gameStateRef.current.phase !== "active") return;
      const [p1, p2] = gameStateRef.current.players;

      // P1 controls (arrows + space + shift)
      if (e.code === "ArrowLeft") p1.rotateLeft = true;
      if (e.code === "ArrowRight") p1.rotateRight = true;  
      if (e.code === "ArrowUp") p1.thrust = true;
      if (e.code === "Space") { e.preventDefault(); p1.fire = true; fireHeldRef.current[1] = true; }
      if (e.code === "ShiftRight") p1.rotateBoost = true;

      // P2 controls (WASD + F + left shift)
      if (e.code === "KeyA") p2.rotateLeft = true;
      if (e.code === "KeyD") p2.rotateRight = true;
      if (e.code === "KeyW") p2.thrust = true;
      if (e.code === "KeyF") { p2.fire = true; fireHeldRef.current[2] = true; }
      if (e.code === "ShiftLeft") p2.rotateBoost = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameStateRef.current || gameStateRef.current.phase !== "active") return;
      const [p1, p2] = gameStateRef.current.players;

      // P1 controls
      if (e.code === "ArrowLeft") p1.rotateLeft = false;
      if (e.code === "ArrowRight") p1.rotateRight = false;
      if (e.code === "ArrowUp") p1.thrust = false;
      if (e.code === "Space") { fireHeldRef.current[1] = false; }
      if (e.code === "ShiftRight") p1.rotateBoost = false;

      // P2 controls  
      if (e.code === "KeyA") p2.rotateLeft = false;
      if (e.code === "KeyD") p2.rotateRight = false;
      if (e.code === "KeyW") p2.thrust = false;
      if (e.code === "KeyF") { fireHeldRef.current[2] = false; }
      if (e.code === "ShiftLeft") p2.rotateBoost = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <HyperspaceStarfield allowBoost={false} speed={0.12} density={1200} className="absolute inset-0 z-0 pointer-events-none" />
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="relative z-10 w-full h-full object-contain"
        style={{ imageRendering: "pixelated" }}
      />
      
      {gameState && <DuelHUD gameState={gameState} showFuel={options.showFuel} />}
      
      {gameState?.phase === "countdown" && (
        <CountdownOverlay 
          state={countdownRef.current.getCurrentState()}
          canvasRef={canvasRef}
        />
      )}
    </div>
  );
};