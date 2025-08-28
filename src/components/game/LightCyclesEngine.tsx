import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LightCyclesHUD } from "./LightCyclesHUD";
import { 
  LightCycle, 
  LightCyclesDifficulty, 
  LightCyclesGameOverData, 
  LightCyclesHUDSnapshot,
  GameArena,
  TrailSegment
} from "./types/lightcycles";
import { 
  createLightCycle, 
  updateLightCycle, 
  turnLightCycle, 
  checkTrailCollision,
  getSpawnPositions
} from "./systems/lightcycle";
import { updateAI, cleanupAI } from "./systems/lightcycleAI";
import { anyGamepad, loadProfile, readGamepad, setUiMode } from "@/hooks/use-gamepad";
import { CursorManager } from "@/lib/cursorManager";
import { loadCursorConfig } from "@/lib/cursorConfig";

interface Props {
  difficulty: LightCyclesDifficulty;
  startLevel?: number;
  onExit: () => void;
  onGameOver: (data: LightCyclesGameOverData) => void;
}

const GRID_SIZE = 4;
const BASE_SPEED = 120; // pixels per second

const DIFFICULTY_SETTINGS = {
  "Easy": { playerSpeed: 100, aiSpeed: 80, startingOpponents: 1, maxSpeed: 150 },
  "Normal": { playerSpeed: 120, aiSpeed: 100, startingOpponents: 2, maxSpeed: 180 },
  "Hard": { playerSpeed: 140, aiSpeed: 120, startingOpponents: 3, maxSpeed: 220 }
};

const WAVE_COLORS = [
  "hsl(180, 100%, 60%)", // cyan
  "hsl(280, 100%, 60%)", // magenta  
  "hsl(60, 100%, 60%)",  // yellow
  "hsl(120, 100%, 60%)", // green
  "hsl(0, 100%, 60%)",   // red
  "hsl(240, 100%, 60%)", // blue
];

export const LightCyclesEngine: React.FC<Props> = ({ difficulty, startLevel = 1, onExit, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<LightCyclesHUDSnapshot>({
    score: 0,
    wave: 1,
    time: 0,
    difficulty,
    cyclesRemaining: 0,
    speed: BASE_SPEED,
    accelerating: false
  });
  const [paused, setPaused] = useState(false);
  
  // Cursor management
  const cursorManager = useRef<CursorManager | null>(null);

  // Controls - using directional keys
  const keys = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean; accelerate: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
    accelerate: false
  });
  const prevKeys = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({ 
    up: false, down: false, left: false, right: false 
  });
  const acceleratingRef = useRef(false);

  // Canvas setup
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current!;
      const container = containerRef.current!;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      
      const w = container.clientWidth;
      const h = container.clientHeight;
      
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Cursor management setup
  useEffect(() => {
    if (!containerRef.current) return;
    
    const config = loadCursorConfig();
    cursorManager.current = new CursorManager(config);
    
    const isGameplayFn = () => !paused;
    cursorManager.current.attach(containerRef.current, isGameplayFn);
    
    return () => {
      cursorManager.current?.detach();
      cursorManager.current = null;
    };
  }, []);
  
  // Update cursor manager when game state changes
  useEffect(() => {
    if (paused) {
      cursorManager.current?.forceShowCursor();
    }
  }, [paused]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (["w", "arrowup"].includes(k)) keys.current.up = down;
      if (["s", "arrowdown"].includes(k)) keys.current.down = down;
      if (["a", "arrowleft"].includes(k)) keys.current.left = down;
      if (["d", "arrowright"].includes(k)) keys.current.right = down;
      if (k === " ") keys.current.accelerate = down;
      if (k === "escape" && down) setPaused(!paused);
    };
    
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [paused]);

  // Disable UI mode for gamepad
  useEffect(() => {
    try { setUiMode(false); } catch {}
  }, []);

  // Main game loop
  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    
    // Get CSS custom properties for theming
    const styles = getComputedStyle(document.documentElement);
    const neonColor = `hsl(${styles.getPropertyValue('--neon')})`;
    const bgColor = `hsl(${styles.getPropertyValue('--background')})`;
    const accentColor = `hsl(${styles.getPropertyValue('--accent')})`;
    
    // Game state
    let running = true;
    let cycles: LightCycle[] = [];
    let wave = startLevel;
    let score = 0;
    let elapsed = 0;
    let gameStarted = false;
    let deathAt: number | null = null;
    let prevRotAxis = 0;
    
    // Arena setup
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const arena: GameArena = {
      width: canvas.width / dpr,
      height: canvas.height / dpr,
      gridSize: GRID_SIZE,
      bounds: {
        left: 20,
        right: (canvas.width / dpr) - 20,
        top: 20,
        bottom: (canvas.height / dpr) - 20
      }
    };

    // Particle system for explosions
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      color: string;
    };
    const particles: Particle[] = [];

    const spawnExplosion = (x: number, y: number, color: string) => {
      // Massive particle burst like in asteroids
      for (let i = 0; i < 220; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 260;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 0.8 + Math.random() * 0.7,
          color: `hsla(${180 + Math.random() * 20},100%,60%,1)`
        });
      }
    };

    const initWave = () => {
      // Clean up AI states
      cycles.forEach(cycle => cleanupAI(cycle.id));
      cycles = [];
      
      const settings = DIFFICULTY_SETTINGS[difficulty];
      const totalOpponents = settings.startingOpponents + Math.floor(wave / 2);
      const spawns = getSpawnPositions(arena, totalOpponents + 1);
      const waveColor = WAVE_COLORS[(wave - 1) % WAVE_COLORS.length];
      
      // Create player cycle (first spawn)
      cycles.push(createLightCycle(
        spawns[0].x,
        spawns[0].y,
        spawns[0].direction,
        neonColor,
        settings.playerSpeed,
        true,
        "player"
      ));
      
      // Create AI cycles with different colors
      for (let i = 1; i < spawns.length && i <= totalOpponents; i++) {
        // Use different color from wave color for variety
        const aiColorIndex = (wave + i - 1) % WAVE_COLORS.length;
        const aiColor = WAVE_COLORS[aiColorIndex];
        
        cycles.push(createLightCycle(
          spawns[i].x,
          spawns[i].y,
          spawns[i].direction,
          aiColor,
          settings.aiSpeed + (wave * 5),
          false,
          `ai_${i}`
        ));
      }
      
      gameStarted = true;
    };

    const updateHud = () => {
      const aliveCycles = cycles.filter(c => !c.isPlayer && c.alive);
      const playerCycle = cycles.find(c => c.isPlayer);
      
      setHud({
        score,
        wave,
        time: elapsed,
        difficulty,
        cyclesRemaining: aliveCycles.length,
        speed: playerCycle?.speed || BASE_SPEED,
        accelerating: acceleratingRef.current
      });
    };

    const checkGameState = () => {
      const playerCycle = cycles.find(c => c.isPlayer);
      const aliveCycles = cycles.filter(c => !c.isPlayer && c.alive);
      
      if (!playerCycle?.alive) {
        // Delay game over to let explosion play out
        if (deathAt !== null && (elapsed - deathAt) >= 1.5) {
          onGameOver({
            score,
            wave,
            cause: "collision",
            difficulty,
            elapsed,
            cyclesDestroyed: DIFFICULTY_SETTINGS[difficulty].startingOpponents + Math.floor(wave / 2) - aliveCycles.length
          });
          running = false;
        }
        return;
      }
      
      if (aliveCycles.length === 0) {
        // Wave complete
        score += 1000 * wave;
        wave++;
        initWave();
      }
    };

    // Initialize first wave
    initWave();
    
    let last = performance.now();

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      
      if (paused) {
        render();
        return;
      }
      
      elapsed += dt;
      
      // Handle input - directional controls like original Tron
      const playerCycle = cycles.find(c => c.isPlayer);
      if (playerCycle) {
        // Handle keyboard directional input with edge detection
        if (keys.current.up && !prevKeys.current.up) {
          cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 0) : c);
        }
        if (keys.current.right && !prevKeys.current.right) {
          cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 1) : c);
        }
        if (keys.current.down && !prevKeys.current.down) {
          cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 2) : c);
        }
        if (keys.current.left && !prevKeys.current.left) {
          cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 3) : c);
        }
        
        // Update acceleration based on input
        if (keys.current.accelerate) {
          const settings = DIFFICULTY_SETTINGS[difficulty];
          const targetSpeed = Math.min(settings.maxSpeed, playerCycle.speed + 120 * dt);
          cycles = cycles.map(c => c.id === "player" ? { ...c, speed: targetSpeed } : c);
          acceleratingRef.current = true;
        } else {
          // Gradually return to base speed
          const settings = DIFFICULTY_SETTINGS[difficulty];
          const targetSpeed = Math.max(settings.playerSpeed, playerCycle.speed - 160 * dt);
          cycles = cycles.map(c => c.id === "player" ? { ...c, speed: targetSpeed } : c);
          acceleratingRef.current = false;
        }
        
        // Handle gamepad input
        const gp = anyGamepad?.();
        if (gp?.connected) {
          const profile = loadProfile(gp.id);
          const input = readGamepad(gp, profile);
          
          // Gamepad directional controls using D-pad
          if (input.ui.up && !prevKeys.current.up) {
            cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 0) : c);
          }
          if (input.ui.right && !prevKeys.current.right) {
            cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 1) : c);
          }
          if (input.ui.down && !prevKeys.current.down) {
            cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 2) : c);
          }
          if (input.ui.left && !prevKeys.current.left) {
            cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 3) : c);
          }

          // Also allow analog stick directional control
          const rot = (input.rotation ?? 0);
          if (rot <= -0.5 && prevRotAxis > -0.5) {
            cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 3) : c); // left
          }
          if (rot >= 0.5 && prevRotAxis < 0.5) {
            cycles = cycles.map(c => c.id === "player" ? turnLightCycle(c, 1) : c); // right
          }
          prevRotAxis = rot;
          
          // Gamepad acceleration (thrust)
          if (input.thrust > 0.1) {
            const settings = DIFFICULTY_SETTINGS[difficulty];
            const targetSpeed = Math.min(settings.maxSpeed, playerCycle.speed + 120 * dt);
            cycles = cycles.map(c => c.id === "player" ? { ...c, speed: targetSpeed } : c);
            acceleratingRef.current = true;
          } else {
            acceleratingRef.current = acceleratingRef.current || keys.current.accelerate;
          }
          
          // Update previous gamepad state
          prevKeys.current.up = input.ui.up;
          prevKeys.current.down = input.ui.down;
          prevKeys.current.left = input.ui.left;
          prevKeys.current.right = input.ui.right;
        }
        
        // Update previous keys state
        prevKeys.current.up = keys.current.up;
        prevKeys.current.down = keys.current.down;
        prevKeys.current.left = keys.current.left;
        prevKeys.current.right = keys.current.right;
      }
      
      // Update cycles
      cycles = cycles.map(cycle => {
        if (!cycle.alive) return cycle;
        
        // AI decisions
        if (!cycle.isPlayer) {
          const aiDirection = updateAI(cycle, cycles, difficulty, elapsed);
          if (aiDirection !== null && aiDirection !== cycle.direction) {
            return updateLightCycle(turnLightCycle(cycle, aiDirection), dt, arena);
          }
        }
        
        return updateLightCycle(cycle, dt, arena);
      });
      
      // Check collisions
      cycles = cycles.map(cycle => {
        if (cycle.alive && checkTrailCollision(cycle, cycles)) {
          spawnExplosion(cycle.x, cycle.y, cycle.color);
          if (cycle.isPlayer && deathAt === null) {
            deathAt = elapsed;
          }
          return { ...cycle, alive: false };
        }
        return cycle;
      });
      
      // Update particles
      particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life += dt;
        p.vy += 150 * dt; // gravity
      });
      
      // Remove dead particles
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].life >= particles[i].maxLife) {
          particles.splice(i, 1);
        }
      }
      
      updateHud();
      checkGameState();
      render();
    };

    const render = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      
      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, arena.width, arena.height);
      
      // Arena bounds with neon glow
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
      ctx.strokeRect(arena.bounds.left, arena.bounds.top, 
                    arena.bounds.right - arena.bounds.left, 
                    arena.bounds.bottom - arena.bounds.top);
      ctx.shadowBlur = 0;
      
      // Draw trails with chunky glow effect
      cycles.forEach(cycle => {
        if (cycle.trail.length === 0) return;
        
        ctx.strokeStyle = cycle.color;
        ctx.lineWidth = 8; // Chunkier trails
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        if (cycle.isPlayer || cycle.alive) {
          ctx.shadowColor = cycle.color;
          ctx.shadowBlur = 15; // Stronger glow
        }
        
        ctx.beginPath();
        cycle.trail.forEach((segment, i) => {
          if (i === 0) {
            ctx.moveTo(segment.x1, segment.y1);
          }
          ctx.lineTo(segment.x2, segment.y2);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      
      // Draw chunky cycles
      cycles.forEach(cycle => {
        if (!cycle.alive) return;
        
        ctx.fillStyle = cycle.color;
        ctx.shadowColor = cycle.color;
        ctx.shadowBlur = cycle.isPlayer ? 16 : 12;
        
        const size = cycle.isPlayer ? 12 : 8; // Chunkier cycles
        ctx.fillRect(cycle.x - size/2, cycle.y - size/2, size, size);
        ctx.shadowBlur = 0;
      });
      
      // Draw particles
      particles.forEach(p => {
        const alpha = 1 - (p.life / p.maxLife);
        ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      });
      
      // Paused overlay
      if (paused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, arena.width, arena.height);
        
        ctx.fillStyle = neonColor;
        ctx.font = "48px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", arena.width / 2, arena.height / 2);
        ctx.textAlign = "start";
      }
      
      ctx.resetTransform();
    };

    loop();
    
    return () => {
      cancelAnimationFrame(raf);
      cycles.forEach(cycle => cleanupAI(cycle.id));
    };
  }, [difficulty, startLevel, onExit, onGameOver, paused]);

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-background overflow-hidden">
      <LightCyclesHUD {...hud} />
      
      <canvas
        ref={canvasRef}
        className="block"
        style={{ cursor: "none" }}
      />
      
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-accent">PAUSED</h2>
            <div className="space-y-2">
              <Button onClick={() => setPaused(false)} variant="outline">
                Resume
              </Button>
              <Button onClick={onExit} variant="ghost">
                Exit to Menu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};