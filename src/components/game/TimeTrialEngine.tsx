import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TimeTrialHUD } from "./TimeTrialHUD";
import { AudioManager } from "./AudioManager";
import { generateTerrain } from "./terrain";
import { TimeTrialGameOverData, TimeTrialPad, RespawnState, TimeTrialSnapshot } from "./types/timetrial";
import { getTimeTrialLevelConfig } from "./systems/timeTrialLevels";
import FireworksDisplay from './FireworksDisplay';
import { anyGamepad, loadProfile, readGamepad, setUiMode } from "@/hooks/use-gamepad";

const WORLD_WIDTH = 4000;
const BASE_HEIGHT = 360;
const AMPLITUDE = 180;
const SHIP_WIDTH = 24;
const SHIP_HEIGHT = 24;
const THRUST_POWER = 0.4;
const ROTATE_SPEED = 0.08;
const FUEL_BURN_RATE = 0.5; // Per frame when thrusting
const FUEL_REFILL_AMOUNT = 50; // Fuel gained per pad landing

interface Props {
  level: number;
  difficulty: "easy" | "hard";
  onGameOver: (data: TimeTrialGameOverData) => void;
  onBack: () => void;
}

export const TimeTrialEngine: React.FC<Props> = ({ level, difficulty, onGameOver, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const audio = useRef(new AudioManager());
  
  // Game state refs
  const x = useRef(WORLD_WIDTH / 2);
  const y = useRef(100);
  const vx = useRef(0);
  const vy = useRef(0);
  const angle = useRef(0);
  const fuel = useRef(200);
  const fuelCap = useRef(200);
  const padsLanded = useRef(0);
  const currentTargetPad = useRef(0); // Index of next pad to land on
  
  // Time trial specific state
  const [gameTime, setGameTime] = useState(0);
  const gameTimeRef = useRef(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerStartedRef = useRef(false);
  const [pads, setPads] = useState<TimeTrialPad[]>([]);
  const padsRef = useRef<TimeTrialPad[]>([]);
  
  // Respawn state
  const [respawnState, setRespawnState] = useState<RespawnState | null>(null);
  const respawnRef = useRef<RespawnState | null>(null);
  
  // Level completion state
  const [completed, setCompleted] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [fireworksSkipped, setFireworksSkipped] = useState(false);
  
  // Controls
  const keys = useRef<{ left: boolean; right: boolean; thrust: boolean; abort: boolean }>({
    left: false,
    right: false,
    thrust: false,
    abort: false
  });
  
  // Terrain ref
  const terrainRef = useRef<any>(null);
  
  // Recording state for ghost
  const ghostFrames = useRef<TimeTrialSnapshot[]>([]);
  const recordingActive = useRef(false);
  
  const gravity = difficulty === "easy" ? 0.08 : 0.12;
  
  // Initialize level
  useEffect(() => {
    const config = getTimeTrialLevelConfig(level);
    const seedOffset = difficulty === "hard" ? 500000 : 0;
    const seed = config.seed + seedOffset;
    
    // Generate terrain
    const terrain = generateTerrain(seed, WORLD_WIDTH, BASE_HEIGHT, AMPLITUDE, level, difficulty as any);
    terrainRef.current = terrain;
    
    // Create numbered sequential pads
    const numPads = config.numPads;
    const spacing = WORLD_WIDTH / (numPads + 1);
    const newPads: TimeTrialPad[] = [];
    
    for (let i = 0; i < numPads; i++) {
      const centerX = spacing * (i + 1);
      const padWidth = difficulty === "easy" ? 40 : 30;
      const terrainY = terrain.getHeightAt(centerX);
      
      newPads.push({
        xStart: centerX - padWidth / 2,
        xEnd: centerX + padWidth / 2,
        y: terrainY,
        sequenceNumber: i + 1,
        isActive: true,
        glowIntensity: i === 0 ? 1.0 : 0.3,
        width: padWidth
      });
    }
    
    setPads(newPads);
    padsRef.current = newPads;
    currentTargetPad.current = 0;
    
    // Set spawn position (always same for each level)
    x.current = 200;
    y.current = 100;
    vx.current = 0;
    vy.current = 0;
    angle.current = 0;
    
    // Start audio
    audio.current.preloadSFX();
    
    setUiMode(false);
    
    return () => {
      audio.current.stopAllAudio();
      setUiMode(true);
    };
  }, [level, difficulty]);
  
  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keys.current.left = true;
      if (e.key === "ArrowRight") keys.current.right = true;
      if (e.key === "ArrowUp" || e.key === " ") keys.current.thrust = true;
      if (e.key === "Escape") keys.current.abort = true;
      
      // Skip fireworks with thrust
      if (showFireworks && (e.key === "ArrowUp" || e.key === " ")) {
        setFireworksSkipped(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keys.current.left = false;
      if (e.key === "ArrowRight") keys.current.right = false;
      if (e.key === "ArrowUp" || e.key === " ") keys.current.thrust = false;
      if (e.key === "Escape") keys.current.abort = false;
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [showFireworks]);
  
  // Main game loop
  useEffect(() => {
    if (!canvasRef.current || paused || completed) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let rafId: number;
    let lastTime = performance.now();
    
    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;
      
      // Update game time
      if (timerStartedRef.current && !respawnRef.current) {
        gameTimeRef.current += dt * 1000;
        setGameTime(gameTimeRef.current);
      }
      
      // Handle respawn materialization
      if (respawnRef.current) {
        const elapsed = (currentTime - respawnRef.current.startTime) / 1000;
        const progress = Math.min(elapsed / 3.0, 1.0);
        respawnRef.current.progress = progress;
        setRespawnState({ ...respawnRef.current });
        
        if (progress >= 1.0) {
          // Materialization complete
          respawnRef.current = null;
          setRespawnState(null);
        } else {
          // Still materializing, skip physics
          rafId = requestAnimationFrame(gameLoop);
          render(ctx, canvas);
          return;
        }
      }
      
      // Read gamepad input
      if (anyGamepad()) {
        const gps = navigator.getGamepads();
        const gamepad = gps[0] || gps[1] || gps[2] || gps[3];
        if (gamepad) {
          const profile = loadProfile(gamepad.id);
          const input = readGamepad(gamepad, profile);
          keys.current.left = input.rotation < -0.3 || input.buttons.rotateLeft;
          keys.current.right = input.rotation > 0.3 || input.buttons.rotateRight;
          keys.current.thrust = input.thrust > 0.5;
          keys.current.abort = input.buttons.abort || input.buttons.pause;
          // Skip fireworks
          if (showFireworks && input.thrust > 0.5) {
            setFireworksSkipped(true);
          }
        }
      }
      
      // Handle abort
      if (keys.current.abort) {
        audio.current.stopAllAudio();
        onGameOver({
          cause: "crash",
          completionTime: gameTimeRef.current,
          level,
          difficulty,
          levelSeed: getTimeTrialLevelConfig(level).seed,
          padsLanded: padsLanded.current,
          totalPads: padsRef.current.length
        });
        return;
      }
      
      // Start timer on first thrust
      if (!timerStartedRef.current && keys.current.thrust) {
        timerStartedRef.current = true;
        setTimerStarted(true);
        recordingActive.current = true;
      }
      
      // Physics update
      if (keys.current.left) angle.current -= ROTATE_SPEED;
      if (keys.current.right) angle.current += ROTATE_SPEED;
      
      if (keys.current.thrust && fuel.current > 0) {
        vx.current += Math.sin(angle.current) * THRUST_POWER;
        vy.current -= Math.cos(angle.current) * THRUST_POWER;
        fuel.current = Math.max(0, fuel.current - FUEL_BURN_RATE);
        audio.current.setThruster(1);
      } else {
        audio.current.setThruster(0);
      }
      
      // Apply gravity
      vy.current += gravity;
      
      // Update position
      x.current += vx.current;
      y.current += vy.current;
      
      // World wrap
      if (x.current < 0) x.current += WORLD_WIDTH;
      if (x.current > WORLD_WIDTH) x.current -= WORLD_WIDTH;
      
      // Record ghost frame
      if (recordingActive.current) {
        ghostFrames.current.push({
          x: x.current,
          y: y.current,
          vx: vx.current,
          vy: vy.current,
          angle: angle.current,
          fuel: fuel.current,
          time: gameTimeRef.current,
          padsLanded: padsLanded.current
        });
      }
      
      // Check collisions
      const terrainHeight = terrainRef.current?.getHeightAt(x.current) || BASE_HEIGHT;
      
      if (y.current >= terrainHeight - SHIP_HEIGHT / 2) {
        // Check if landing on current target pad
        const targetPad = padsRef.current[currentTargetPad.current];
        
        if (targetPad && x.current >= targetPad.xStart && x.current <= targetPad.xEnd) {
          // Check landing conditions
          const speed = Math.sqrt(vx.current ** 2 + vy.current ** 2);
          const angleOk = Math.abs(angle.current) < 0.3;
          const speedOk = speed < 3.5;
          
          if (angleOk && speedOk) {
            // Successful landing!
            audio.current.success();
            
            // Mark pad as inactive (vanish it)
            padsRef.current[currentTargetPad.current].isActive = false;
            padsLanded.current++;
            
            // Refill fuel
            fuel.current = Math.min(fuelCap.current, fuel.current + FUEL_REFILL_AMOUNT);
            
            // Move to next pad
            currentTargetPad.current++;
            
            // Update glow intensities
            if (currentTargetPad.current < padsRef.current.length) {
              padsRef.current[currentTargetPad.current].glowIntensity = 1.0;
            }
            
            setPads([...padsRef.current]);
            
            // Check if level complete
            if (currentTargetPad.current >= padsRef.current.length) {
              setCompleted(true);
              recordingActive.current = false;
              setShowFireworks(true);
              audio.current.playMissionSuccess();
              
              // Trigger game over after fireworks (or when skipped)
              setTimeout(() => {
                if (!fireworksSkipped) {
                  onGameOver({
                    cause: "success",
                    completionTime: gameTimeRef.current,
                    level,
                    difficulty,
                    levelSeed: getTimeTrialLevelConfig(level).seed,
                    padsLanded: padsLanded.current,
                    totalPads: padsRef.current.length
                  });
                }
              }, 8000);
            }
            
            // Reset position slightly above pad
            y.current = terrainHeight - SHIP_HEIGHT / 2 - 2;
            vx.current = 0;
            vy.current = 0;
          } else {
            // Crash - respawn at last checkpoint
            handleCrash();
          }
        } else {
          // Crash - wrong pad or terrain
          handleCrash();
        }
      }
      
      // Check fuel depletion
      if (fuel.current <= 0 && vy.current > 0) {
        audio.current.stopAllAudio();
        onGameOver({
          cause: "fuel",
          completionTime: gameTimeRef.current,
          level,
          difficulty,
          levelSeed: getTimeTrialLevelConfig(level).seed,
          padsLanded: padsLanded.current,
          totalPads: padsRef.current.length
        });
        return;
      }
      
      // Render
      render(ctx, canvas);
      
      rafId = requestAnimationFrame(gameLoop);
    };
    
    rafId = requestAnimationFrame(gameLoop);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [paused, completed, level, difficulty, onGameOver, showFireworks, fireworksSkipped]);
  
  const handleCrash = () => {
    audio.current.explosion();
    
    // Find last landed pad as checkpoint
    const lastPadIndex = Math.max(0, currentTargetPad.current - 1);
    
    if (lastPadIndex >= 0 && padsRef.current[lastPadIndex]) {
      const checkpoint = padsRef.current[lastPadIndex];
      const checkpointX = (checkpoint.xStart + checkpoint.xEnd) / 2;
      const checkpointY = checkpoint.y - SHIP_HEIGHT / 2 - 5;
      
      // Start respawn
      respawnRef.current = {
        active: true,
        startTime: performance.now(),
        checkpointPad: checkpoint,
        progress: 0,
        x: checkpointX,
        y: checkpointY
      };
      setRespawnState(respawnRef.current);
      
      // Reset to checkpoint
      x.current = checkpointX;
      y.current = checkpointY;
      vx.current = 0;
      vy.current = 0;
      angle.current = 0;
    } else {
      // No checkpoint, game over
      onGameOver({
        cause: "crash",
        completionTime: gameTimeRef.current,
        level,
        difficulty,
        levelSeed: getTimeTrialLevelConfig(level).seed,
        padsLanded: padsLanded.current,
        totalPads: padsRef.current.length
      });
    }
  };
  
  // Skip fireworks effect
  useEffect(() => {
    if (fireworksSkipped && showFireworks) {
      onGameOver({
        cause: "success",
        completionTime: gameTimeRef.current,
        level,
        difficulty,
        levelSeed: getTimeTrialLevelConfig(level).seed,
        padsLanded: padsLanded.current,
        totalPads: padsRef.current.length
      });
    }
  }, [fireworksSkipped, showFireworks, level, difficulty, onGameOver]);
  
  const render = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    
    // Camera
    const cameraX = x.current;
    const zoom = 1.5;
    const anchor = canvas.height / dpr / 2 + 50;
    
    ctx.save();
    ctx.translate(canvas.width / (2 * dpr), canvas.height / (2 * dpr));
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, anchor);
    
    // Draw terrain
    if (terrainRef.current) {
      ctx.strokeStyle = "#0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const points = terrainRef.current.points;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    
    // Draw pads
    padsRef.current.forEach((pad, index) => {
      if (!pad.isActive) return; // Skip vanished pads
      
      const isTarget = index === currentTargetPad.current;
      const centerX = (pad.xStart + pad.xEnd) / 2;
      
      ctx.save();
      
      // Pulsing glow for target pad
      if (isTarget) {
        const pulse = Math.sin(Date.now() / 300) * 0.25 + 0.75;
        ctx.shadowBlur = 30 * pulse;
        ctx.shadowColor = "#0ff";
      }
      
      // Draw pad base
      ctx.strokeStyle = isTarget ? "#0ff" : "#088";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pad.xStart, pad.y);
      ctx.lineTo(pad.xEnd, pad.y);
      ctx.stroke();
      
      // Draw number
      ctx.fillStyle = "#0ff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      
      // Pulsing scale for target
      if (isTarget) {
        const scale = 1.0 + Math.sin(Date.now() / 400) * 0.2;
        ctx.save();
        ctx.translate(centerX, pad.y - 10);
        ctx.scale(scale, scale);
        ctx.fillText(pad.sequenceNumber.toString(), 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(pad.sequenceNumber.toString(), centerX, pad.y - 10);
      }
      
      ctx.restore();
    });
    
    // Draw respawn effect or ship
    if (respawnRef.current && respawnRef.current.progress < 1.0) {
      drawMaterializationEffect(ctx, respawnRef.current);
    } else {
      drawShip(ctx);
    }
    
    ctx.restore();
  };
  
  const drawMaterializationEffect = (ctx: CanvasRenderingContext2D, respawn: RespawnState) => {
    const progress = respawn.progress;
    const numScanLines = 20;
    
    ctx.save();
    ctx.translate(respawn.x, respawn.y);
    
    // Vertical scan lines converging
    for (let i = 0; i < numScanLines; i++) {
      const y = (i / numScanLines) * SHIP_HEIGHT * (1 - progress) - SHIP_HEIGHT / 2;
      ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 * progress})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-SHIP_WIDTH / 2, y);
      ctx.lineTo(SHIP_WIDTH / 2, y);
      ctx.stroke();
    }
    
    // Particle stream from above
    for (let i = 0; i < 30; i++) {
      const particleProgress = (progress + i / 30) % 1;
      const py = -50 + particleProgress * 70;
      const alpha = Math.sin(particleProgress * Math.PI) * progress;
      ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
      ctx.fillRect(-2 + Math.sin(i) * 5, py, 2, 4);
    }
    
    // Ship with fade-in
    ctx.globalAlpha = progress;
    ctx.rotate(angle.current);
    
    // Ship body
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -SHIP_HEIGHT / 2);
    ctx.lineTo(-SHIP_WIDTH / 2, SHIP_HEIGHT / 2);
    ctx.lineTo(0, SHIP_HEIGHT / 3);
    ctx.lineTo(SHIP_WIDTH / 2, SHIP_HEIGHT / 2);
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();
  };
  
  const drawShip = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.translate(x.current, y.current);
    ctx.rotate(angle.current);
    
    // Ship body
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -SHIP_HEIGHT / 2);
    ctx.lineTo(-SHIP_WIDTH / 2, SHIP_HEIGHT / 2);
    ctx.lineTo(0, SHIP_HEIGHT / 3);
    ctx.lineTo(SHIP_WIDTH / 2, SHIP_HEIGHT / 2);
    ctx.closePath();
    ctx.stroke();
    
    // Thrust flame
    if (keys.current.thrust && fuel.current > 0) {
      const flameLength = 10 + Math.random() * 5;
      ctx.strokeStyle = "#f80";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, SHIP_HEIGHT / 2);
      ctx.lineTo(0, SHIP_HEIGHT / 2 + flameLength);
      ctx.stroke();
    }
    
    ctx.restore();
  };
  
  const altitude = Math.max(0, (terrainRef.current?.getHeightAt(x.current) || BASE_HEIGHT) - y.current);
  const nextPad = currentTargetPad.current + 1;
  const totalPads = pads.length;
  
  return (
    <div className="relative w-full h-screen bg-black">
      <canvas
        ref={canvasRef}
        width={window.innerWidth * (window.devicePixelRatio || 1)}
        height={window.innerHeight * (window.devicePixelRatio || 1)}
        className="w-full h-full"
      />
      
      {!completed && (
        <TimeTrialHUD
          currentPad={nextPad}
          totalPads={totalPads}
          time={gameTime}
          fuel={fuel.current}
          fuelCap={fuelCap.current}
          altitude={altitude}
          vx={Math.floor(vx.current)}
          vy={Math.floor(vy.current)}
        />
      )}
      
      {showFireworks && !fireworksSkipped && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <FireworksDisplay
            landingType="regular"
            neonColor="#00FFFF"
            onSkip={() => setFireworksSkipped(true)}
            onComplete={() => {
              onGameOver({
                cause: "success",
                completionTime: gameTimeRef.current,
                level,
                difficulty,
                levelSeed: getTimeTrialLevelConfig(level).seed,
                padsLanded: padsLanded.current,
                totalPads: padsRef.current.length
              });
            }}
          />
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
            <div className="text-4xl font-bold text-primary mb-4">LEVEL COMPLETE!</div>
            <div className="text-sm text-muted-foreground">Press THRUST to skip</div>
          </div>
        </div>
      )}
      
      {respawnState && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive mb-2">RESPAWNING...</div>
            <div className="text-sm text-muted-foreground">
              {Math.ceil((1 - respawnState.progress) * 3)}s
            </div>
          </div>
        </div>
      )}
      
      <div className="fixed top-4 right-4 z-50 space-x-2">
        <Button onClick={() => setPaused(!paused)} variant="outline">
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button onClick={onBack} variant="destructive">
          Exit
        </Button>
      </div>
    </div>
  );
};
