import React, { useEffect, useRef, useState, useCallback } from "react";
import { OrbitalDockingGameOverData, OrbitalDockingHUDSnapshot, OrbitalState, ShipState, Planet, LandingPad, OrbitalPhysicsConfig, LevelConfig, DebrisParticle } from "./types/orbitaldocking";
import { OrbitalPadHUD } from "./OrbitalPadHUD";
import { anyGamepad, getLastDeviceId, loadProfile, readGamepad, setUiMode } from "@/hooks/use-gamepad";
import { Button } from "@/components/ui/button";
import { AudioManager } from "./AudioManager";

interface Props {
  level: number;
  onExit: () => void;
  onGameOver: (data: OrbitalDockingGameOverData) => void;
}

// Seeded random number generator
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Level configuration generator
const generateLevelConfig = (level: number, seed: number): LevelConfig => {
  const rng = mulberry32(seed);
  
  // Base difficulty scaling
  const difficultyScale = Math.min(level / 10, 1);
  
  return {
    planet: {
      radius: 150 - (level * 5), // Smaller planets at higher levels
      gravity: 0.8 + (level * 0.1), // Stronger gravity, but slower increase
      rotationRate: 0.05 + (level * 0.05) // Much slower rotation to start
    },
    pad: {
      width: Math.max(8, 20 - (level * 1.2)) // Smaller pads
    },
    startAltitude: 40 + (level * 2), // Start further out
    debris: {
      count: Math.min(level - 1, 5), // More debris
      minOrbit: 160,
      maxOrbit: 220
    },
    scoring: {
      baseScore: 10000,
      timeBonus: 50,
      fuelBonus: 3,
      cleanBonus: 1000
    }
  };
};

export const OrbitalPadEngine: React.FC<Props> = ({ level, onExit, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(new AudioManager());
  
  // Game state
  const [paused, setPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  
  // Physics state
  const [ship, setShip] = useState<ShipState>({
    r: 0, theta: 0, rdot: 0, thetadot: 0,
    psi: 0, fuel: 1000, thrust: 0
  });
  
  const [config, setConfig] = useState<OrbitalPhysicsConfig | null>(null);
  const [debris, setDebris] = useState<DebrisParticle[]>([]);
  const [seed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  
  // Game timers
  const [gameTime, setGameTime] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState(0);
  const [landingTimer, setLandingTimer] = useState(0);
  const [landingAttempts, setLandingAttempts] = useState(0);
  
  // Input state
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [thrustAnalog, setThrustAnalog] = useState(0);
  
  // HUD state
  const [hudSnapshot, setHudSnapshot] = useState<OrbitalDockingHUDSnapshot>({
    altitude: 0, angularDiff: 0, radialVelocity: 0, tangentialVelocity: 0,
    fuel: 1000, time: 90, level: 1, padPosition: 0
  });

  // Initialize game
  useEffect(() => {
    const levelConfig = generateLevelConfig(level, seed);
    const rng = mulberry32(seed + 1000);
    
    const planet: Planet = {
      radius: levelConfig.planet.radius,
      gravity: levelConfig.planet.gravity,
      rotationRate: levelConfig.planet.rotationRate,
      mu: levelConfig.planet.gravity * levelConfig.planet.radius * levelConfig.planet.radius
    };
    
    const pad: LandingPad = {
      width: levelConfig.pad.width * Math.PI / 180, // Convert to radians
      position: rng() * Math.PI * 2,
      basePosition: rng() * Math.PI * 2
    };
    
    const startR = planet.radius + levelConfig.startAltitude;
    const circularVelocity = Math.sqrt(planet.mu / Math.pow(startR, 3));
    
    const initialShip: ShipState = {
      r: startR,
      theta: rng() * Math.PI * 2,
      rdot: 0,
      thetadot: circularVelocity,
      psi: -Math.PI / 2, // Start pointing radially inward  
      fuel: 1000,
      thrust: 0
    };
    
    const physicsConfig: OrbitalPhysicsConfig = {
      planet,
      pad,
      startAltitude: levelConfig.startAltitude,
      landingTolerance: {
        radialVelocity: 2.0,
        tangentialVelocity: 3.0,
        positionTolerance: planet.radius * 0.05,
        angleTolerance: 8
      },
      timeLimit: 90,
      crashTolerance: planet.radius * 0.02
    };
    
    // Generate debris
    const debrisArray: DebrisParticle[] = [];
    for (let i = 0; i < levelConfig.debris.count; i++) {
      const debrisR = levelConfig.debris.minOrbit + rng() * (levelConfig.debris.maxOrbit - levelConfig.debris.minOrbit);
      const debrisTheta = rng() * Math.PI * 2;
      const debrisOrbitalVel = Math.sqrt(planet.mu / Math.pow(debrisR, 3));
      
      debrisArray.push({
        r: debrisR,
        theta: debrisTheta,
        rdot: 0,
        thetadot: debrisOrbitalVel * (0.8 + rng() * 0.4), // Some orbital variation
        size: 3 + rng() * 4
      });
    }
    
    setConfig(physicsConfig);
    setShip(initialShip);
    setDebris(debrisArray);
    setGameStarted(true);
    
    // Initialize audio
    try {
      // AudioManager methods may not exist, skip for now
    } catch {}
    
    setUiMode(false);
  }, [level, seed]);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      
      if (e.key === "Escape") {
        if (gameEnded) {
          onExit();
        } else {
          setPaused(p => !p);
        }
        return;
      }
      
      setKeys(prev => ({ ...prev, [e.key]: true }));
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key]: false }));
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameEnded, onExit]);

  // Physics update function
  const updatePhysics = useCallback((dt: number) => {
    if (!config || paused || gameEnded) return;
    
    setShip(prevShip => {
      let newShip = { ...prevShip };
      
      // Input processing
      let rotationInput = 0;
      let thrustInput = 0;
      
      // Keyboard input
      if (keys["ArrowLeft"] || keys["a"] || keys["A"]) rotationInput -= 1;
      if (keys["ArrowRight"] || keys["d"] || keys["D"]) rotationInput += 1;
      if (keys[" "] || keys["w"] || keys["W"] || keys["ArrowUp"]) thrustInput = 1;
      
      // Gamepad input
      const gp = anyGamepad?.();
      if (gp?.connected) {
        const lastId = getLastDeviceId();
        const profile = loadProfile(lastId || undefined);
        const input = readGamepad(gp, profile);
        
        rotationInput += input.rotation;
        thrustInput = Math.max(thrustInput, input.thrust);
      }
      
      // Apply rotation
      const rotationSpeed = 2.0;
      newShip.psi += rotationInput * rotationSpeed * dt;
      
      // Apply thrust
      const maxThrust = 15.0;
      const fuelConsumption = 100; // units per second at full thrust
      
      thrustInput = Math.max(0, Math.min(1, thrustInput));
      newShip.thrust = thrustInput;
      
      if (thrustInput > 0 && newShip.fuel > 0) {
        newShip.fuel = Math.max(0, newShip.fuel - thrustInput * fuelConsumption * dt);
        
        // Thrust force components in polar coordinates
        const thrustForce = thrustInput * maxThrust;
        const radialThrust = thrustForce * Math.sin(newShip.psi);
        const tangentialThrust = thrustForce * Math.cos(newShip.psi);
        
        // Apply thrust accelerations
        newShip.rdot += radialThrust * dt;
        newShip.thetadot += (tangentialThrust / newShip.r) * dt;
      }
      
      // Gravity acceleration
      const gravityAccel = -config.planet.mu / (newShip.r * newShip.r);
      
      // Centripetal acceleration
      const centripetal = newShip.r * newShip.thetadot * newShip.thetadot;
      
      // Update radial velocity (gravity + centripetal + thrust)
      newShip.rdot += (gravityAccel + centripetal) * dt;
      
      // Coriolis effect for angular momentum conservation
      newShip.thetadot += (-2 * newShip.rdot * newShip.thetadot / newShip.r) * dt;
      
      // Integrate position
      newShip.r += newShip.rdot * dt;
      newShip.theta += newShip.thetadot * dt;
      
      // Normalize angle
      newShip.theta = ((newShip.theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      
      return newShip;
    });
    
    // Update debris
    setDebris(prevDebris => 
      prevDebris.map(d => ({
        ...d,
        theta: d.theta + d.thetadot * dt
      }))
    );
    
    // Update pad position (slow rotation)
    if (config) {
      config.pad.position = config.pad.basePosition + config.planet.rotationRate * gameTime * 0.5;
    }
    
  }, [config, keys, paused, gameEnded, gameTime]);

  // Landing detection
  useEffect(() => {
    if (!config || paused || gameEnded) return;
    
    const planet = config.planet;
    const pad = config.pad;
    const tolerance = config.landingTolerance;
    
    // Check if ship is near surface
    const altitude = ship.r - planet.radius;
    const surfaceRelativeVel = ship.r * ship.thetadot - planet.radius * config.planet.rotationRate;
    
    // Crash detection
    if (altitude < config.crashTolerance) {
      setGameEnded(true);
      onGameOver({
        score: Math.max(0, Math.floor(hudSnapshot.fuel * 3)),
        time: gameTime,
        fuelRemaining: ship.fuel,
        cause: "crash",
        cleanCapture: false,
        seed
      });
      return;
    }
    
    // Landing detection
    const padAngleDiff = Math.abs(((ship.theta - pad.position) % (2 * Math.PI) + Math.PI) % (2 * Math.PI) - Math.PI);
    const onPad = padAngleDiff <= pad.width / 2;
    const angleTolerance = tolerance.angleTolerance * Math.PI / 180;
    const correctOrientation = Math.abs(ship.psi + Math.PI / 2) <= angleTolerance;
    
    const validLanding = 
      altitude <= tolerance.positionTolerance &&
      Math.abs(ship.rdot) <= tolerance.radialVelocity &&
      Math.abs(surfaceRelativeVel) <= tolerance.tangentialVelocity &&
      correctOrientation &&
      onPad;
    
    if (validLanding) {
      setLandingTimer(prev => prev + 0.016); // Assuming ~60fps
      
      if (landingTimer >= 0.12) { // 120ms requirement
        const timeRemaining = Math.max(0, config.timeLimit - gameTime);
        const fuelRemaining = ship.fuel;
        const cleanCapture = landingAttempts === 0;
        
        const levelConfig = generateLevelConfig(level, seed);
        const baseScore = levelConfig.scoring.baseScore;
        const timeBonus = Math.floor(timeRemaining * levelConfig.scoring.timeBonus);
        const fuelBonus = Math.floor(fuelRemaining * levelConfig.scoring.fuelBonus);
        const cleanBonus = cleanCapture ? levelConfig.scoring.cleanBonus : 0;
        
        const totalScore = baseScore + timeBonus + fuelBonus + cleanBonus;
        
        setGameEnded(true);
        onGameOver({
          score: totalScore,
          time: gameTime,
          fuelRemaining,
          cause: "success",
          cleanCapture,
          seed
        });
      }
    } else {
      if (landingTimer > 0) {
        setLandingAttempts(prev => prev + 1);
      }
      setLandingTimer(0);
    }
  }, [ship, config, gameTime, landingTimer, landingAttempts, hudSnapshot.fuel, level, seed, paused, gameEnded, onGameOver]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || !config) return;
    
    let animationId: number;
    
    const gameLoop = (timestamp: number) => {
      if (lastFrameTime === 0) {
        setLastFrameTime(timestamp);
        animationId = requestAnimationFrame(gameLoop);
        return;
      }
      
      const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.02); // Cap at 50fps minimum
      setLastFrameTime(timestamp);
      
      if (!paused && !gameEnded) {
        setGameTime(prev => prev + deltaTime);
        updatePhysics(deltaTime);
        
        // Update HUD
        if (config) {
          const altitude = ship.r - config.planet.radius;
          const padAngleDiff = ((ship.theta - config.pad.position) % (2 * Math.PI) + Math.PI) % (2 * Math.PI) - Math.PI;
          const surfaceRelativeVel = ship.r * ship.thetadot - config.planet.radius * config.planet.rotationRate;
          
          setHudSnapshot({
            altitude,
            angularDiff: padAngleDiff * 180 / Math.PI,
            radialVelocity: ship.rdot,
            tangentialVelocity: surfaceRelativeVel,
            fuel: ship.fuel,
            time: Math.max(0, config.timeLimit - gameTime),
            level,
            padPosition: config.pad.position * 180 / Math.PI
          });
          
          // Check timeout
          if (gameTime >= config.timeLimit) {
            setGameEnded(true);
            onGameOver({
              score: Math.max(0, Math.floor(ship.fuel * 3)),
              time: gameTime,
              fuelRemaining: ship.fuel,
              cause: "timeout",
              cleanCapture: false,
              seed
            });
          }
          
          // Check fuel
          if (ship.fuel <= 0 && ship.rdot > 0 && altitude > config.crashTolerance * 2) {
            setGameEnded(true);
            onGameOver({
              score: 0,
              time: gameTime,
              fuelRemaining: 0,
              cause: "fuel",
              cleanCapture: false,
              seed
            });
          }
        }
      }
      
      // Render
      renderFrame();
      
      animationId = requestAnimationFrame(gameLoop);
    };
    
    animationId = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [gameStarted, config, paused, gameEnded, lastFrameTime, ship, gameTime, updatePhysics, level, seed, onGameOver]);

  // Render function
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Clear canvas with solid color
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);
    
    // Calculate scale (planet should be ~1/3 of screen)
    const scale = Math.min(width, height) / (config.planet.radius * 6);
    
    // Draw planet
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, config.planet.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw planet surface markers (rotating slowly)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI / 4) + (config.planet.rotationRate * gameTime * 0.3); // Slow down rotation
      const x1 = centerX + Math.cos(angle) * config.planet.radius * scale;
      const y1 = centerY + Math.sin(angle) * config.planet.radius * scale;
      const x2 = centerX + Math.cos(angle) * (config.planet.radius + 8) * scale;
      const y2 = centerY + Math.sin(angle) * (config.planet.radius + 8) * scale;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    
    // Draw landing pad
    const padStartAngle = config.pad.position - config.pad.width / 2;
    const padEndAngle = config.pad.position + config.pad.width / 2;
    
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, config.planet.radius * scale, padStartAngle, padEndAngle);
    ctx.stroke();
    
    // Add glow effect to pad
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, config.planet.radius * scale, padStartAngle, padEndAngle);
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Draw debris
    debris.forEach(d => {
      const x = centerX + Math.cos(d.theta) * d.r * scale;
      const y = centerY + Math.sin(d.theta) * d.r * scale;
      
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.arc(x, y, d.size * scale * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw ship
    const shipX = centerX + Math.cos(ship.theta) * ship.r * scale;
    const shipY = centerY + Math.sin(ship.theta) * ship.r * scale;
    
    // Ship orientation
    const shipAngle = ship.theta + ship.psi;
    
    // Ship body
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(shipAngle);
    
    // Ship triangle (larger and filled)
    const shipSize = 12;
    ctx.beginPath();
    ctx.moveTo(shipSize, 0);
    ctx.lineTo(-shipSize * 0.5, -shipSize * 0.4);
    ctx.lineTo(-shipSize * 0.5, shipSize * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Thrust visualization
    if (ship.thrust > 0 && ship.fuel > 0) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      const thrustLength = ship.thrust * 20;
      ctx.beginPath();
      ctx.moveTo(-shipSize * 0.5, 0);
      ctx.lineTo(-shipSize * 0.5 - thrustLength, 0);
      ctx.stroke();
    }
    
    ctx.restore();
    
    // Draw velocity vector (for debugging/assistance)
    const velScale = 10; // Reduce scale to make it less overwhelming
    const velX = ship.rdot * Math.cos(ship.theta) - ship.r * ship.thetadot * Math.sin(ship.theta);
    const velY = ship.rdot * Math.sin(ship.theta) + ship.r * ship.thetadot * Math.cos(ship.theta);
    
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shipX, shipY);
    ctx.lineTo(shipX + velX * velScale, shipY + velY * velScale);
    ctx.stroke();
    
  }, [config, ship, debris, gameTime]);

  if (!config) {
    return <div className="w-full h-screen bg-background flex items-center justify-center">
      <div className="text-accent">Initializing orbital mechanics...</div>
    </div>;
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-background overflow-hidden"
    >
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />
      
      <OrbitalPadHUD hud={hudSnapshot} paused={paused} />
      
      {paused && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-accent">PAUSED</h2>
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
      
      {/* Tutorial hint */}
      {gameTime < 5 && !paused && !gameEnded && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="bg-background/80 border border-accent/50 rounded-lg p-4 space-y-2">
            <div className="text-accent font-semibold">You're in orbit around the planet</div>
            <div className="text-sm text-muted-foreground">
              Burn retrograde (nose opposite to velocity) to lower altitude
            </div>
            <div className="text-sm text-muted-foreground">
              Line up with the glowing pad and touch down gently
            </div>
          </div>
        </div>
      )}
    </div>
  );
};