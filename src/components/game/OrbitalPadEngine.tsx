import React, { useEffect, useRef, useState, useCallback } from "react";
import { HUD } from "./HUD";
import { AudioManager } from "./AudioManager";
import { 
  OrbitalDockingGameOverData, 
  LevelConfig
} from "./types/orbitaldocking";
import { anyGamepad, readGamepad, loadProfile, getLastDeviceId, setUiMode } from "@/hooks/use-gamepad";
import { Button } from "@/components/ui/button";

interface Props {
  level: number;
  onExit: () => void;
  onGameOver: (data: OrbitalDockingGameOverData) => void;
}

// Seeded random number generator
function mulberry32(seed: number): () => number {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate level configuration - arcade style progression
const generateLevelConfig = (level: number, seed: number): LevelConfig => {
  const rng = mulberry32(seed);
  
  // Arcade progression: smaller planet, faster rotation, more challenge
  const baseRadius = 300 - Math.min(level * 6, 100); // 300 down to 200
  const baseGravity = 80 + level * 3; // Moderate gravity increase
  const rotationRate = 0.008 + level * 0.002; // Much faster base rotation for arcade feel
  
  // Landing pad gets smaller for challenge
  const padWidth = Math.max(15 - level * 1.2, 6); // 15 degrees down to 6
  
  // Moderate debris for visual interest without overwhelming
  const debrisCount = Math.min(3 + level, 12);
  const minOrbit = baseRadius + 60;
  const maxOrbit = baseRadius + 200 + level * 15;
  
  return {
    planet: {
      radius: baseRadius,
      gravity: baseGravity,
      rotationRate: rotationRate
    },
    pad: {
      width: padWidth
    },
    startAltitude: 180 + level * 10, // Start closer for faster action
    debris: {
      count: debrisCount,
      minOrbit: minOrbit,
      maxOrbit: maxOrbit
    },
    scoring: {
      baseScore: 100 + level * 50,
      timeBonus: 1000, // Big time bonus for under 10 seconds
      fuelBonus: 5, // Fuel efficiency bonus
      cleanBonus: 500 // Clean landing bonus
    }
  };
};

export const OrbitalPadEngine: React.FC<Props> = ({ level, onExit, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audio = useRef(new AudioManager());
  
  // Game state
  const [paused, setPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  
  // Physics state - simplified for arcade feel
  const [ship, setShip] = useState({
    r: 0,           // distance from planet center
    theta: 0,       // angle around planet (0 = top)
    rdot: 0,        // radial velocity (+ = away from planet)
    thetadot: 0,    // angular velocity 
    fuel: 1000,
    thrust: 0
  });
  
  const [config, setConfig] = useState<LevelConfig | null>(null);
  const [debris, setDebris] = useState<any[]>([]);
  const [pad, setPad] = useState({ position: Math.PI, width: 0.2 }); // Start at bottom
  const [seed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  
  // Game timers
  const [gameTime, setGameTime] = useState(0);
  const [attemptCount, setAttemptCount] = useState(1);
  
  // Input state
  const keys = useRef<Record<string, boolean>>({});
  const gpProfileRef = useRef(loadProfile(getLastDeviceId()));

  // Initialize game state with arcade physics
  useEffect(() => {
    const levelConfig = generateLevelConfig(level, seed);
    setConfig(levelConfig);
    
    // Arcade-style initialization: ship faces outward, simple position
    const startR = levelConfig.planet.radius + levelConfig.startAltitude;
    const startTheta = 0; // Start at top for consistent experience
    
    const newShip = {
      r: startR,
      theta: startTheta,
      rdot: 0,
      thetadot: 0, // Start stationary for easier control
      fuel: 1000,
      thrust: 0
    };
    
    setShip(newShip);
    
    // Initialize debris with simpler orbital patterns
    const debrisArray: any[] = [];
    const rng = mulberry32(seed + 1000);
    
    for (let i = 0; i < levelConfig.debris.count; i++) {
      const r = levelConfig.debris.minOrbit + rng() * (levelConfig.debris.maxOrbit - levelConfig.debris.minOrbit);
      const theta = rng() * Math.PI * 2;
      const orbitalSpeed = 0.01 + rng() * 0.02; // Simplified orbital speed for visual effect
      
      debrisArray.push({
        r,
        theta,
        rdot: 0,
        thetadot: orbitalSpeed,
        size: 1 + rng() * 3 // Smaller debris for cleaner look
      });
    }
    
    setDebris(debrisArray);
    
    // Initialize landing pad
    const newPad = {
      width: levelConfig.pad.width * Math.PI / 180, // Convert to radians
      position: Math.PI // Start at bottom
    };
    
    setPad(newPad);
    
    // Reset game state
    setGameTime(0);
    setGameStarted(true);
    setGameEnded(false);
    setPaused(false);
    setAttemptCount(1);
    
    // Setup audio
    audio.current.stopAllAudio();
    audio.current.playLevelTrackForLevel(level);
    
    // Setup UI mode
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
      
      keys.current[e.key] = true;
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key] = false;
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameEnded, onExit]);

  // Arcade physics update - simplified and responsive
  const updatePhysics = useCallback((dt: number) => {
    if (!config || gameEnded || paused) return;

    setShip(prevShip => {
      const newShip = { ...prevShip };
      
      // Handle input
      let rotInput = 0;
      let thrustInput = 0;
      
      // Keyboard input
      if (keys.current.ArrowLeft || keys.current.a || keys.current.A) rotInput -= 1;
      if (keys.current.ArrowRight || keys.current.d || keys.current.D) rotInput += 1;
      if (keys.current.ArrowUp || keys.current.w || keys.current.W || keys.current[' ']) thrustInput = 1;
      
      // Gamepad input
      const gp = anyGamepad();
      if (gp && gpProfileRef.current) {
        const input = readGamepad(gp, gpProfileRef.current);
        rotInput += input.rotation;
        thrustInput = Math.max(thrustInput, input.thrust);
      }
      
      // Arcade-style rotation: rotate lander around planet orbit
      const rotationSpeed = 2.0; // Fast rotation for arcade feel
      newShip.thetadot += rotInput * rotationSpeed * dt;
      newShip.thetadot *= 0.95; // Some damping for control
      
      // Arcade thrust: simple radial movement
      const thrustPower = 150; // Strong thrust for responsive control
      newShip.thrust = thrustInput;
      
      if (newShip.fuel > 0 && thrustInput > 0) {
        // Thrust moves away from planet (radial outward)
        newShip.rdot += thrustPower * thrustInput * dt;
        
        // Consume fuel at arcade rate
        newShip.fuel -= 200 * thrustInput * dt;
        newShip.fuel = Math.max(0, newShip.fuel);
      }
      
      // Gravity pulls toward planet
      const gravity = config.planet.gravity * 0.6; // Tuned for arcade feel
      newShip.rdot -= gravity * dt;
      
      // Update position
      newShip.r += newShip.rdot * dt;
      newShip.theta += newShip.thetadot * dt;
      
      // Keep theta in range
      while (newShip.theta >= 2 * Math.PI) newShip.theta -= 2 * Math.PI;
      while (newShip.theta < 0) newShip.theta += 2 * Math.PI;
      
      return newShip;
    });
  }, [config, gameEnded, paused]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || !config) return;
    
    let lastTime = performance.now();
    let animationId: number;
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.02); // Cap at 50fps minimum
      lastTime = currentTime;
      
      if (!paused && !gameEnded) {
        setGameTime(prev => prev + deltaTime);
        updatePhysics(deltaTime);
        
        // Update debris with simple rotation
        setDebris(prev => prev.map(d => ({
          ...d,
          theta: d.theta + d.thetadot * deltaTime
        })));
        
        // Update landing pad rotation
        setPad(prev => ({
          ...prev,
          position: (prev.position + config.planet.rotationRate * deltaTime) % (2 * Math.PI)
        }));
        
        // Check for landing/crash
        if (ship.r <= config.planet.radius + 8) {
          // Check if we're over the landing pad
          let angleDiff = Math.abs(ship.theta - pad.position);
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          
          const isOverPad = angleDiff <= pad.width / 2;
          
          if (isOverPad) {
            // Arcade landing conditions - more forgiving
            const radialVel = Math.abs(ship.rdot);
            const tangentialVel = Math.abs(ship.r * ship.thetadot);
            
            const softLanding = radialVel < 30 && tangentialVel < 25;
            
            if (softLanding) {
              // Calculate arcade scoring
              let totalScore = config.scoring.baseScore;
              
              // Fast landing bonus (under 10 seconds)
              if (gameTime < 10) {
                totalScore += config.scoring.timeBonus;
              }
              
              // Fuel efficiency bonus
              const fuelBonus = Math.floor(ship.fuel * config.scoring.fuelBonus);
              totalScore += fuelBonus;
              
              // Clean capture bonus (first attempt)
              if (attemptCount === 1) {
                totalScore += config.scoring.cleanBonus;
              }
              
              // audio.current.playLanding();
              onGameOver({
                score: totalScore,
                time: gameTime,
                fuelRemaining: ship.fuel,
                cause: "success",
                cleanCapture: attemptCount === 1,
                seed
              });
              setGameEnded(true);
              return;
            }
          }
          
          // Crash
          // audio.current.playCrash();
          onGameOver({
            score: 0,
            time: gameTime,
            fuelRemaining: ship.fuel,
            cause: "crash",
            cleanCapture: false,
            seed
          });
          setGameEnded(true);
          return;
        }
        
        // Check fuel depletion
        if (ship.fuel <= 0 && ship.rdot > 0) {
          onGameOver({
            score: 0,
            time: gameTime,
            fuelRemaining: 0,
            cause: "fuel",
            cleanCapture: false,
            seed
          });
          setGameEnded(true);
          return;
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
  }, [gameStarted, config, paused, gameEnded, ship, pad, gameTime, updatePhysics, attemptCount, onGameOver, seed]);

  // Arcade-style rendering with neon graphics
  const renderFrame = useCallback(() => {
    if (!canvasRef.current || !config) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas with space black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Set up coordinate system with planet at center
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / (config.planet.radius * 2.8);
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    
    // Draw neon planet outline with glow
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15 / scale;
    ctx.beginPath();
    ctx.arc(0, 0, config.planet.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3 / scale;
    ctx.stroke();
    
    // Draw crater details on planet
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#004d66';
    ctx.lineWidth = 1 / scale;
    
    // Draw a few craters for visual interest
    const craterPositions = [
      { angle: 0.5, size: 20 },
      { angle: 1.8, size: 15 },
      { angle: 3.4, size: 18 },
      { angle: 4.7, size: 12 }
    ];
    
    craterPositions.forEach(crater => {
      const craterX = (config.planet.radius - crater.size) * Math.cos(crater.angle);
      const craterY = (config.planet.radius - crater.size) * Math.sin(crater.angle);
      ctx.beginPath();
      ctx.arc(craterX, craterY, crater.size, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // Draw neon landing pad with glow
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 10 / scale;
    
    const padStart = pad.position - pad.width / 2;
    const padEnd = pad.position + pad.width / 2;
    
    ctx.beginPath();
    ctx.arc(0, 0, config.planet.radius, padStart, padEnd);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 6 / scale;
    ctx.stroke();
    
    // Draw debris as small neon dots
    ctx.shadowBlur = 5 / scale;
    debris.forEach(d => {
      const debrisX = d.r * Math.cos(d.theta);
      const debrisY = d.r * Math.sin(d.theta);
      
      ctx.shadowColor = '#ff6600';
      ctx.beginPath();
      ctx.arc(debrisX, debrisY, d.size, 0, Math.PI * 2);
      ctx.fillStyle = '#ff6600';
      ctx.fill();
    });
    
    // Draw ship (same triangle design as main game)
    const shipX = ship.r * Math.cos(ship.theta);
    const shipY = ship.r * Math.sin(ship.theta);
    
    ctx.save();
    ctx.translate(shipX, shipY);
    
    // Ship always faces outward from planet
    const shipAngle = ship.theta;
    ctx.rotate(shipAngle);
    
    // Draw neon ship triangle with glow
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8 / scale;
    ctx.beginPath();
    ctx.moveTo(0, -12); // Point away from planet
    ctx.lineTo(-8, 8);
    ctx.lineTo(8, 8);
    ctx.closePath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / scale;
    ctx.stroke();
    
    // Draw thrust flame (same style as main game)
    if (ship.thrust > 0) {
      const flameLength = 12 + ship.thrust * 10;
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur = 12 / scale;
      
      ctx.beginPath();
      ctx.moveTo(-4, 8);
      ctx.lineTo(0, 8 + flameLength);
      ctx.lineTo(4, 8);
      ctx.strokeStyle = '#ff4500';
      ctx.lineWidth = 3 / scale;
      ctx.stroke();
      
      // Inner flame
      ctx.beginPath();
      ctx.moveTo(-2, 8);
      ctx.lineTo(0, 8 + flameLength * 0.8);
      ctx.lineTo(2, 8);
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
    }
    
    ctx.restore();
    
    // Draw velocity vector (arcade style)
    ctx.shadowBlur = 5 / scale;
    ctx.shadowColor = '#ffff00';
    
    const velScale = 3;
    const velX = ship.rdot * Math.cos(ship.theta) - ship.r * ship.thetadot * Math.sin(ship.theta);
    const velY = ship.rdot * Math.sin(ship.theta) + ship.r * ship.thetadot * Math.cos(ship.theta);
    
    if (Math.abs(velX) > 1 || Math.abs(velY) > 1) {
      ctx.beginPath();
      ctx.moveTo(shipX, shipY);
      ctx.lineTo(shipX + velX * velScale, shipY + velY * velScale);
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    }
    
    ctx.restore();
  }, [config, ship, pad, debris]);

  // Canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const container = containerRef.current;
        canvasRef.current.style.width = container.clientWidth + 'px';
        canvasRef.current.style.height = container.clientHeight + 'px';
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!config) {
    return <div className="w-full h-full flex items-center justify-center">Loading...</div>;
  }

  const altitude = ship.r - config.planet.radius;
  const tangentialVel = ship.r * ship.thetadot;

  return (
    <div ref={containerRef} className="w-full h-full bg-black relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      
      <HUD 
        altitude={altitude}
        vx={tangentialVel}
        vy={-ship.rdot}
        fuel={Math.max(0, ship.fuel / 10)} // Convert to 0-100 scale
        score={0} // Will be calculated at landing
        time={gameTime}
        difficulty="hard"
      />
      
      {paused && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold mb-4">PAUSED</h2>
            <p className="text-muted-foreground mb-4">Press ESC to resume</p>
            <div className="space-y-2">
              <Button onClick={() => setPaused(false)} className="w-full">
                Resume
              </Button>
              <Button onClick={onExit} variant="outline" className="w-full">
                Exit to Menu
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {!gameStarted && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold mb-4">Orbital Docking - Level {level}</h2>
            <p className="text-muted-foreground mb-4">
              Use arrow keys or gamepad to control your lander.<br/>
              Left/Right: Rotate around planet<br/>
              Up/Thrust: Move away from planet<br/>
              Land softly on the green pad!
            </p>
            <Button onClick={() => setGameStarted(true)}>
              Start Mission
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
