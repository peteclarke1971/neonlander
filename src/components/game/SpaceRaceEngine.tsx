import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SpaceRaceHUD } from "./SpaceRaceHUD";
import { 
  SpaceRaceDifficulty, 
  SpaceRaceGameOverData, 
  SpaceRaceHUDSnapshot,
  RaceMode,
  SpaceShip,
  RaceTrack,
  RaceCamera,
  Vec3,
  RaceAssists,
  RaceAI
} from "./types/spaceracing";
import { generateTrack } from "./systems/raceTrack";
import { updateAI, createAI } from "./systems/raceAI";
import { WireframeRenderer } from "./systems/spaceRaceRenderer";
import { anyGamepad, loadProfile, readGamepad, setUiMode } from "@/hooks/use-gamepad";
import { getGlobalAudioManager } from "./AudioManager";

interface Props {
  difficulty: SpaceRaceDifficulty;
  mode: RaceMode;
  startTrack?: number;
  onExit: () => void;
  onGameOver: (data: SpaceRaceGameOverData) => void;
}

const DIFFICULTY_SETTINGS = {
  "Easy": { playerSpeed: 180, aiSpeed: 45, aiCount: 2, assistsEnabled: true },
  "Normal": { playerSpeed: 240, aiSpeed: 65, aiCount: 3, assistsEnabled: false },
  "Hard": { playerSpeed: 300, aiSpeed: 80, aiCount: 4, assistsEnabled: false }
};

const BASE_SCORE_PER_GATE = 100;
const TRACK_COMPLETE_BONUS = 5000;

export const SpaceRaceEngine: React.FC<Props> = ({ 
  difficulty, 
  mode, 
  startTrack = 1, 
  onExit, 
  onGameOver 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WireframeRenderer | null>(null);
  const audioRef = useRef(getGlobalAudioManager());
  
  const [hud, setHud] = useState<SpaceRaceHUDSnapshot>({
    score: 0,
    track: startTrack,
    time: 0,
    difficulty,
    speed: 0,
    gatesPassed: 0,
    totalGates: 0,
    boostMeter: 0
  });
  const [paused, setPaused] = useState(false);
  const [assists, setAssists] = useState<RaceAssists>({
    gateMagnet: DIFFICULTY_SETTINGS[difficulty].assistsEnabled,
    horizonLock: true,
    autoRoll: DIFFICULTY_SETTINGS[difficulty].assistsEnabled
  });

  // Game state refs
  const gameStateRef = useRef({
    playerShip: null as SpaceShip | null,
    track: null as RaceTrack | null,
    camera: null as RaceCamera | null,
    aiOpponents: [] as RaceAI[],
    currentGate: 0,
    trackStartTime: 0,
    lapStartTime: 0,
    bestLapTime: null as number | null,
    score: 0,
    gameStartTime: 0,
    finished: false
  });

  // Controls
  const keysRef = useRef({
    strafeLeft: false,
    strafeRight: false,
    strafeUp: false,
    strafeDown: false,
    yawLeft: false,
    yawRight: false,
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    throttle: false,
    airbrake: false,
    boost: false,
    pausePressed: false
  });

  // Initialize renderer and canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = container.clientWidth;
      const h = container.clientHeight;
      
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      
      if (rendererRef.current) {
        rendererRef.current.setViewport(w, h);
      }
    };

    // Initialize WebGL renderer (with canvas 2D fallback)
    try {
      rendererRef.current = new WireframeRenderer(canvas);
      console.log("WebGL renderer initialized");
    } catch (error) {
      console.warn("WebGL not available, using canvas 2D fallback:", error);
      rendererRef.current = new WireframeRenderer(canvas, true); // force canvas 2D
    }

    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      rendererRef.current?.dispose();
    };
  }, []);

  // Initialize game state
  const initializeGame = useCallback(() => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    
    // Generate track with seed based on mode and track number
    const seed = mode === "endless" ? 
      `endless_${Date.now()}` : 
      `${mode}_track_${startTrack}_${difficulty}`;
    
    const track = generateTrack(seed, difficulty);
    
    // Create player ship at track start
    const startPos = track.centerline[0] || { x: 0, y: 0, z: 0 };
    const playerShip: SpaceShip = {
      position: { ...startPos, y: startPos.y + 2 }, // slight elevation
      velocity: { x: 0, y: 0, z: settings.playerSpeed },
      rotation: { x: 0, y: 0, z: 0 },
      speed: settings.playerSpeed,
      baseSpeed: settings.playerSpeed,
      maxSpeed: settings.playerSpeed * 1.5,
      alive: true,
      boostMeter: 3,
      isPlayer: true,
      id: "player"
    };

    // Create AI opponents
    const aiOpponents: RaceAI[] = [];
    for (let i = 0; i < settings.aiCount; i++) {
      const aiShip: SpaceShip = {
        position: { 
          x: startPos.x + (i - settings.aiCount/2) * 20, 
          y: startPos.y + 2, 
          z: startPos.z - 50 - i * 30 
        },
        velocity: { x: 0, y: 0, z: settings.aiSpeed },
        rotation: { x: 0, y: 0, z: 0 },
        speed: settings.aiSpeed,
        baseSpeed: settings.aiSpeed,
        maxSpeed: settings.aiSpeed * 1.3,
        alive: true,
        boostMeter: 0,
        isPlayer: false,
        id: `ai_${i}`
      };
      
      aiOpponents.push(createAI(aiShip, difficulty));
    }

    // Initialize camera (chase cam behind player)
    const camera: RaceCamera = {
      position: { x: startPos.x, y: startPos.y + 8, z: startPos.z - 25 },
      target: startPos,
      up: { x: 0, y: 1, z: 0 },
      fov: 75,
      near: 1,
      far: 2000
    };

    // Update game state
    gameStateRef.current = {
      playerShip,
      track,
      camera,
      aiOpponents,
      currentGate: 0,
      trackStartTime: performance.now(),
      lapStartTime: performance.now(),
      bestLapTime: null,
      score: 0,
      gameStartTime: performance.now(),
      finished: false
    };

    // Reset gates
    track.gates.forEach(gate => gate.passed = false);
    
    console.log(`Initialized ${mode} track ${startTrack} with ${track.gates.length} gates`);
  }, [difficulty, mode, startTrack]);

  // Initialize game on mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      switch (key) {
        case 'w': keysRef.current.strafeUp = true; break;
        case 's': keysRef.current.strafeDown = true; break;
        case 'a': keysRef.current.strafeLeft = true; break;
        case 'd': keysRef.current.strafeRight = true; break;
        case 'arrowup': keysRef.current.pitchUp = true; break;
        case 'arrowdown': keysRef.current.pitchDown = true; break;
        case 'arrowleft': keysRef.current.yawLeft = true; break;
        case 'arrowright': keysRef.current.yawRight = true; break;
        case 'q': keysRef.current.rollLeft = true; break;
        case 'e': keysRef.current.rollRight = true; break;
        case 'shift': keysRef.current.boost = true; break;
        case ' ': e.preventDefault(); keysRef.current.airbrake = true; break;
        case 'escape': 
          if (!keysRef.current.pausePressed) {
            keysRef.current.pausePressed = true;
            setPaused(!paused);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      switch (key) {
        case 'w': keysRef.current.strafeUp = false; break;
        case 's': keysRef.current.strafeDown = false; break;
        case 'a': keysRef.current.strafeLeft = false; break;
        case 'd': keysRef.current.strafeRight = false; break;
        case 'arrowup': keysRef.current.pitchUp = false; break;
        case 'arrowdown': keysRef.current.pitchDown = false; break;
        case 'arrowleft': keysRef.current.yawLeft = false; break;
        case 'arrowright': keysRef.current.yawRight = false; break;
        case 'q': keysRef.current.rollLeft = false; break;
        case 'e': keysRef.current.rollRight = false; break;
        case 'shift': keysRef.current.boost = false; break;
        case ' ': keysRef.current.airbrake = false; break;
        case 'escape': keysRef.current.pausePressed = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [paused]);

  // Disable UI mode for gamepad
  useEffect(() => {
    try { setUiMode(false); } catch {}
  }, []);

  // Main game loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      if (!gameStateRef.current.track || !rendererRef.current) {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      const deltaTime = Math.min(0.033, (currentTime - lastTime) / 1000); // Cap at 30fps minimum
      lastTime = currentTime;

      if (!paused && !gameStateRef.current.finished) {
        updateGame(deltaTime);
      }

      render();
      animationId = requestAnimationFrame(gameLoop);
    };

    const updateGame = (dt: number) => {
      const state = gameStateRef.current;
      const { playerShip, track, camera, aiOpponents } = state;
      
      if (!playerShip || !track || !camera) return;

      // Handle player input
      handlePlayerInput(playerShip, dt);
      
      // Handle gamepad input
      const gp = anyGamepad?.();
      if (gp?.connected) {
        handleGamepadInput(playerShip, gp, dt);
      }

      // Update player physics
      updateShipPhysics(playerShip, dt);

      // Update AI opponents
      aiOpponents.forEach(ai => {
        updateAI(ai, track, aiOpponents.map(a => a.ship).concat(playerShip), dt);
        updateShipPhysics(ai.ship, dt);
      });

      // Update camera (chase cam)
      updateCamera(camera, playerShip, dt);

      // Check gate passages
      checkGatePassage(playerShip, track, state);

      // Check collisions
      checkCollisions(playerShip, track, aiOpponents);

      // Update HUD
      updateHUD(state, performance.now());

      // Check win/lose conditions
      checkGameOver(state);
    };

    const render = () => {
      const renderer = rendererRef.current!;
      const state = gameStateRef.current;
      const { track, camera, playerShip, aiOpponents } = state;

      if (!track || !camera) return;

      renderer.clear();
      renderer.setCamera(camera);

      // Render track geometry
      track.segments.forEach(segment => {
        segment.obstacles.forEach(obstacle => {
          renderer.drawWireframe(obstacle.wireframe);
        });
      });

      // Render gates
      track.gates.forEach(gate => {
        if (!gate.passed) {
          renderer.drawWireframe(gate.wireframe);
        }
      });

      // Render player ship
      if (playerShip?.alive) {
        renderer.drawShip(playerShip, true);
      }

      // Render AI ships
      aiOpponents.forEach(ai => {
        if (ai.ship.alive) {
          renderer.drawShip(ai.ship, false);
        }
      });

      // Draw pause overlay
      if (paused) {
        renderer.drawPauseOverlay();
      }
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [paused]);

  const handlePlayerInput = (ship: SpaceShip, dt: number) => {
    const keys = keysRef.current;
    const strafeForce = 100 * dt; // lateral movement force
    const rotationForce = 2.0 * dt; // rotation speed
    
    // Strafe movement
    if (keys.strafeLeft) ship.velocity.x -= strafeForce;
    if (keys.strafeRight) ship.velocity.x += strafeForce;
    if (keys.strafeUp) ship.velocity.y += strafeForce;
    if (keys.strafeDown) ship.velocity.y -= strafeForce;

    // Rotation
    if (keys.yawLeft) ship.rotation.y -= rotationForce;
    if (keys.yawRight) ship.rotation.y += rotationForce;
    if (keys.pitchUp) ship.rotation.x -= rotationForce;
    if (keys.pitchDown) ship.rotation.x += rotationForce;
    if (keys.rollLeft) ship.rotation.z -= rotationForce;
    if (keys.rollRight) ship.rotation.z += rotationForce;

    // Speed control
    if (keys.boost) {
      ship.speed = Math.min(ship.maxSpeed, ship.speed + 60 * dt);
      // Unlimited boosting - no meter drain
    } else if (keys.airbrake) {
      ship.speed = Math.max(ship.baseSpeed * 0.5, ship.speed - 90 * dt);
    } else {
      // Return to base speed gradually
      const targetSpeed = ship.baseSpeed;
      if (ship.speed > targetSpeed) {
        ship.speed = Math.max(targetSpeed, ship.speed - 40 * dt);
      } else if (ship.speed < targetSpeed) {
        ship.speed = Math.min(targetSpeed, ship.speed + 30 * dt);
      }
    }

    // Apply assists
    if (assists.gateMagnet) {
      applyGateMagnetAssist(ship, gameStateRef.current.track!, dt);
    }
  };

  const handleGamepadInput = (ship: SpaceShip, gamepad: Gamepad, dt: number) => {
    const profile = loadProfile(gamepad.id);
    const input = readGamepad(gamepad, profile);
    
    const strafeForce = 100 * dt;
    const rotationForce = 2.0 * dt;

    // Analog strafe with left stick
    ship.velocity.x += (gamepad.axes[0] || 0) * strafeForce * 2; // X-axis
    ship.velocity.y += (gamepad.axes[1] || 0) * strafeForce * 2; // Y-axis (inverted for racing)

    // Analog rotation with right stick  
    ship.rotation.y += (gamepad.axes[2] || 0) * rotationForce * 1.5; // yaw
    ship.rotation.x -= (gamepad.axes[3] || 0) * rotationForce * 1.5; // pitch (inverted)

    // Triggers for speed control
    const throttle = Math.max(0, (gamepad.axes[7] || 0) + 1) / 2; // RT
    const brake = Math.max(0, (gamepad.axes[6] || 0) + 1) / 2; // LT

    if (input.thrust > 0.5) { // Boost with thrust button (unlimited)
      ship.speed = Math.min(ship.maxSpeed, ship.speed + 60 * dt);
      // Unlimited boosting - no meter drain
    } else if (brake > 0.1) {
      ship.speed = Math.max(ship.baseSpeed * 0.5, ship.speed - 90 * brake * dt);
    } else {
      const targetSpeed = ship.baseSpeed * (0.8 + throttle * 0.4); // 80%-120% speed range
      if (ship.speed > targetSpeed) {
        ship.speed = Math.max(targetSpeed, ship.speed - 40 * dt);
      } else if (ship.speed < targetSpeed) {
        ship.speed = Math.min(targetSpeed, ship.speed + 30 * dt);
      }
    }
  };

  const updateShipPhysics = (ship: SpaceShip, dt: number) => {
    // Apply velocity damping
    const damping = 0.92;
    ship.velocity.x *= damping;
    ship.velocity.y *= damping;
    
    // Forward movement based on rotation and speed (positive Z = into screen)
    const cos = Math.cos(ship.rotation.y);
    const sin = Math.sin(ship.rotation.y);
    ship.velocity.z = ship.speed;

    // Update position
    ship.position.x += ship.velocity.x * dt;
    ship.position.y += ship.velocity.y * dt;
    ship.position.z += ship.velocity.z * dt;

    // Rotation damping
    ship.rotation.x *= 0.95;
    ship.rotation.z *= 0.95;
  };

  const updateCamera = (camera: RaceCamera, ship: SpaceShip, dt: number) => {
    const offset = { x: 0, y: 8, z: -25 }; // Camera behind ship (negative Z when ship moves positive Z)
    
    // Target position behind ship
    const targetPos = {
      x: ship.position.x + offset.x,
      y: ship.position.y + offset.y,
      z: ship.position.z + offset.z
    };

    // Smooth camera follow
    const smoothing = 0.1;
    camera.position.x += (targetPos.x - camera.position.x) * smoothing;
    camera.position.y += (targetPos.y - camera.position.y) * smoothing;
    camera.position.z += (targetPos.z - camera.position.z) * smoothing;

    // Look ahead of ship (negative Z direction to make approaching objects bigger)
    const lookAhead = {
      x: ship.position.x,
      y: ship.position.y,
      z: ship.position.z - 50
    };

    camera.target.x += (lookAhead.x - camera.target.x) * smoothing;
    camera.target.y += (lookAhead.y - camera.target.y) * smoothing;
    camera.target.z += (lookAhead.z - camera.target.z) * smoothing;

    // Apply horizon lock assist
    if (assists.horizonLock) {
      camera.up = { x: 0, y: 1, z: 0 };
    }
  };

  const applyGateMagnetAssist = (ship: SpaceShip, track: RaceTrack, dt: number) => {
    const nextGate = track.gates[gameStateRef.current.currentGate];
    if (!nextGate || nextGate.passed) return;

    const distance = Math.sqrt(
      Math.pow(nextGate.position.x - ship.position.x, 2) +
      Math.pow(nextGate.position.z - ship.position.z, 2)
    );

    if (distance < 100) { // Apply assist when close to gate
      const force = (100 - distance) / 100 * 200 * dt; // Gentle centering force
      const dirX = (nextGate.position.x - ship.position.x) / distance;
      
      ship.velocity.x += dirX * force;
    }
  };

  const checkGatePassage = (ship: SpaceShip, track: RaceTrack, state: typeof gameStateRef.current) => {
    const currentGate = track.gates[state.currentGate];
    if (!currentGate || currentGate.passed) return;

    // Simple gate collision check (ship position vs gate bounds)
    const distance = Math.sqrt(
      Math.pow(currentGate.position.x - ship.position.x, 2) +
      Math.pow(currentGate.position.y - ship.position.y, 2) +
      Math.pow(currentGate.position.z - ship.position.z, 2)
    );

    if (distance < currentGate.width / 2) {
      currentGate.passed = true;
      state.score += BASE_SCORE_PER_GATE;
      state.currentGate++;
      
      // Add boost charge for clean gate pass
      if (ship.boostMeter < 3) {
        ship.boostMeter = Math.min(3, ship.boostMeter + 0.5);
      }

      // Play gate pass sound - create a simple beep
      try {
        // Simple audio feedback for gate pass (using Web Audio API)
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } catch {}

      // Check if completed track
      if (state.currentGate >= track.gates.length) {
        completeTrack(state);
      }
    }
  };

  const completeTrack = (state: typeof gameStateRef.current) => {
    const now = performance.now();
    const lapTime = (now - state.lapStartTime) / 1000;
    
    state.score += TRACK_COMPLETE_BONUS;
    
    if (!state.bestLapTime || lapTime < state.bestLapTime) {
      state.bestLapTime = lapTime;
    }

    if (mode === "endless") {
      // Generate next track segment for endless mode
      const newTrack = generateTrack(`endless_${Date.now()}`, difficulty);
      if (state.track) {
        // Extend current track
        state.track.centerline.push(...newTrack.centerline);
        state.track.gates.push(...newTrack.gates);
        state.track.segments.push(...newTrack.segments);
      }
      state.lapStartTime = now;
    } else {
      // Finish race for other modes
      finishRace(state, "success");
    }
  };

  const checkCollisions = (ship: SpaceShip, track: RaceTrack, aiOpponents: RaceAI[]) => {
    if (!ship.alive) return;

    // Check track boundary collisions
    track.segments.forEach(segment => {
      segment.obstacles.forEach(obstacle => {
        if (obstacle.type === "wall" || obstacle.type === "asteroid" || obstacle.type === "debris") {
          const distance = Math.sqrt(
            Math.pow(obstacle.position.x - ship.position.x, 2) +
            Math.pow(obstacle.position.y - ship.position.y, 2) +
            Math.pow(obstacle.position.z - ship.position.z, 2)
          );

          const collisionRadius = Math.max(obstacle.size.x, obstacle.size.y, obstacle.size.z) / 2 + 5;
          
          if (distance < collisionRadius) {
            ship.alive = false;
            finishRace(gameStateRef.current, "crash");
            return;
          }
        }
      });
    });
  };

  const checkGameOver = (state: typeof gameStateRef.current) => {
    if (state.finished) return;

    const { playerShip } = state;
    
    if (!playerShip?.alive) {
      finishRace(state, "crash");
    }

    // Check time limits for time trial mode
    if (mode === "time-trial") {
      const elapsed = (performance.now() - state.gameStartTime) / 1000;
      if (elapsed > 300) { // 5 minute time limit
        finishRace(state, "timeout");
      }
    }
  };

  const finishRace = (state: typeof gameStateRef.current, cause: SpaceRaceGameOverData["cause"]) => {
    if (state.finished) return;
    
    state.finished = true;
    const elapsed = (performance.now() - state.gameStartTime) / 1000;
    
    const gameOverData: SpaceRaceGameOverData = {
      score: state.score,
      tracksCompleted: mode === "endless" ? Math.floor(state.currentGate / 20) : (cause === "success" ? 1 : 0),
      cause,
      difficulty,
      elapsed,
      bestLapTime: state.bestLapTime || undefined,
      gatesPassed: state.currentGate,
      totalGates: state.track?.gates.length || 0
    };

    setTimeout(() => onGameOver(gameOverData), 1000); // Delay for effect
  };

  const updateHUD = (state: typeof gameStateRef.current, currentTime: number) => {
    const { playerShip, track, score, currentGate, gameStartTime, bestLapTime } = state;
    
    if (!playerShip || !track) return;

    const elapsed = (currentTime - gameStartTime) / 1000;
    const nextGate = track.gates[currentGate];
    const nextGateDistance = nextGate ? Math.sqrt(
      Math.pow(nextGate.position.x - playerShip.position.x, 2) +
      Math.pow(nextGate.position.z - playerShip.position.z, 2)
    ) : undefined;

    setHud({
      score,
      track: startTrack,
      time: elapsed,
      difficulty,
      speed: Math.round(playerShip.speed),
      gatesPassed: currentGate,
      totalGates: track.gates.length,
      boostMeter: Math.floor(playerShip.boostMeter),
      nextGateDistance,
      bestLap: bestLapTime || undefined
    });
  };

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      {/* HUD */}
      <SpaceRaceHUD hud={hud} paused={paused} />
      
      {/* 3D Canvas */}
      <div ref={containerRef} className="absolute inset-0">
        <canvas 
          ref={canvasRef}
          className="w-full h-full"
          style={{ background: 'hsl(var(--background))' }}
        />
      </div>

      {/* Pause Menu */}
      {paused && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="text-center space-y-6">
            <h2 className="text-4xl font-bold text-accent">PAUSED</h2>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Assists: Gate Magnet: {assists.gateMagnet ? 'ON' : 'OFF'}</p>
                <p>Horizon Lock: {assists.horizonLock ? 'ON' : 'OFF'}</p>
                <p>Auto Roll: {assists.autoRoll ? 'ON' : 'OFF'}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setPaused(false)} variant="neon">
                  Resume
                </Button>
                <Button onClick={onExit} variant="outline">
                  Exit to Menu
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};