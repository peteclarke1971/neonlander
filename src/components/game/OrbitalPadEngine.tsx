import React, { useEffect, useRef, useState, useCallback } from "react";
import { HUD } from "./HUD";
import { AudioManager } from "./AudioManager";
import { CavernStarfield } from "./CavernStarfield";
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
  const baseRadius = (240 - Math.min(level * 6, 80)) * 0.8; // 20% smaller again (192 down to 128)
  const baseGravity = (80 + level * 3) * 4; // 4x gravity for much faster descent
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
  
  // Physics state - proper orbital mechanics with polar velocities
  const [ship, setShip] = useState({
    r: 0,           // distance from planet center
    theta: 0,       // angle around planet (0 = top)
    vr: 0,          // radial velocity (positive = moving away from planet)
    vtheta: 0,      // tangential velocity (positive = moving counterclockwise)
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
      vr: 0,          // Start with no radial velocity
      vtheta: 0.8,    // Start with small orbital velocity for stability
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

  // Proper orbital mechanics with polar velocity components
  const updatePhysics = useCallback((dt: number) => {
    if (!config || gameEnded || paused) return;

    setShip(prevShip => {
      const newShip = { ...prevShip };
      
      // Handle input
      let leftInput = 0;
      let rightInput = 0;
      let thrustInput = 0;
      
      // Keyboard input
      if (keys.current.ArrowLeft || keys.current.a || keys.current.A) leftInput = 1;
      if (keys.current.ArrowRight || keys.current.d || keys.current.D) rightInput = 1;
      if (keys.current.ArrowUp || keys.current.w || keys.current.W || keys.current[' ']) thrustInput = 1;
      
      // Gamepad input
      const gp = anyGamepad();
      if (gp && gpProfileRef.current) {
        const input = readGamepad(gp, gpProfileRef.current);
        if (input.rotation < 0) leftInput = Math.max(leftInput, -input.rotation);
        if (input.rotation > 0) rightInput = Math.max(rightInput, input.rotation);
        thrustInput = Math.max(thrustInput, input.thrust);
      }
      
      // Set thrust display
      newShip.thrust = thrustInput;
      
      // Apply thrust forces if fuel available (planet-relative directions)
      // 30% heavier feel: reduced thrust effectiveness and higher fuel consumption
      const radialThrust = 140;    // Reduced from 200 (30% less effective)
      const tangentialThrust = 105; // Reduced from 150 (30% less effective)
      
      if (newShip.fuel > 0) {
        // Up key: Radial thrust (away from planet center)
        if (thrustInput > 0) {
          newShip.vr += radialThrust * thrustInput * dt;
          newShip.fuel -= 260 * thrustInput * dt; // 30% more fuel consumption
        }
        
        // Left key: Decrease orbital velocity (move backward in orbit)
        if (leftInput > 0) {
          newShip.vtheta -= tangentialThrust * leftInput * dt;
          newShip.fuel -= 195 * leftInput * dt; // 30% more fuel consumption
        }
        
        // Right key: Increase orbital velocity (move forward in orbit)
        if (rightInput > 0) {
          newShip.vtheta += tangentialThrust * rightInput * dt;
          newShip.fuel -= 195 * rightInput * dt; // 30% more fuel consumption
        }
        
        newShip.fuel = Math.max(0, newShip.fuel);
      }
      
      // Apply orbital mechanics - heavier feel with stronger gravity
      const gravity = config.planet.gravity * 1040; // Increased from 800 (30% stronger gravity feel)
      
      // Gravity acceleration (always pulls inward)
      const gravityAccel = gravity / (newShip.r * newShip.r);
      newShip.vr -= gravityAccel * dt;
      
      // Remove centrifugal force to prevent lateral movement from affecting altitude
      // This creates arcade-style physics where left/right movement doesn't change orbit height
      
      // Apply orbital decay when not thrusting (ensures ship always comes down)
      if (thrustInput === 0) {
        newShip.vr -= 5 * dt; // Gentle decay
        newShip.vtheta *= Math.pow(0.995, dt * 60); // Slight orbital drag
      }
      
      // Velocity limits to prevent escape
      const maxRadialVel = 300;
      const maxTangentialVel = 250;
      newShip.vr = Math.max(-maxRadialVel, Math.min(maxRadialVel, newShip.vr));
      newShip.vtheta = Math.max(-maxTangentialVel, Math.min(maxTangentialVel, newShip.vtheta));
      
      // Update position using polar velocities
      newShip.r += newShip.vr * dt;
      newShip.theta += (newShip.vtheta / newShip.r) * dt;
      
      // Keep theta in range
      while (newShip.theta >= 2 * Math.PI) newShip.theta -= 2 * Math.PI;
      while (newShip.theta < 0) newShip.theta += 2 * Math.PI;
      
      // Prevent going inside planet
      if (newShip.r < config.planet.radius + 5) {
        newShip.r = config.planet.radius + 5;
        newShip.vr = Math.max(0, newShip.vr); // Stop inward velocity
      }
      
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
            // Arcade landing conditions - check polar velocities
            const totalVel = Math.sqrt(ship.vr * ship.vr + ship.vtheta * ship.vtheta);
            
            const softLanding = totalVel < 40;
            
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
        
        // Check fuel depletion - check if moving away from planet
        if (ship.fuel <= 0 && ship.r > config.planet.radius + 50) {
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
    
    // Use larger scale to make elements more visible
    const scale = Math.min(width, height) / 600; // Much larger scale
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    
    // Draw neon planet outline with bright glow - make it bold and visible
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, config.planet.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Reset shadow for craters
    ctx.shadowBlur = 0;
    
    // Draw crater details on planet - 4x more varied craters throughout interior
    ctx.strokeStyle = '#00aaaa';
    ctx.lineWidth = 1.5;
    
    // Generate 16 craters with varied sizes and positions throughout planet interior
    const craterPositions = [
      // Edge craters
      { angle: 0.5, distance: 0.85, size: 8 },
      { angle: 1.2, distance: 0.9, size: 12 },
      { angle: 1.8, distance: 0.8, size: 6 },
      { angle: 2.7, distance: 0.95, size: 10 },
      { angle: 3.4, distance: 0.85, size: 14 },
      { angle: 4.1, distance: 0.9, size: 7 },
      { angle: 4.7, distance: 0.8, size: 9 },
      { angle: 5.5, distance: 0.95, size: 11 },
      // Interior craters  
      { angle: 0.8, distance: 0.6, size: 15 },
      { angle: 1.5, distance: 0.4, size: 18 },
      { angle: 2.2, distance: 0.7, size: 8 },
      { angle: 2.9, distance: 0.5, size: 12 },
      { angle: 3.7, distance: 0.3, size: 20 },
      { angle: 4.4, distance: 0.65, size: 10 },
      { angle: 5.1, distance: 0.45, size: 16 },
      { angle: 5.8, distance: 0.55, size: 13 }
    ];
    
    craterPositions.forEach(crater => {
      const radius = config.planet.radius * crater.distance;
      const craterX = radius * Math.cos(crater.angle);
      const craterY = radius * Math.sin(crater.angle);
      ctx.beginPath();
      ctx.arc(craterX, craterY, crater.size, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // Draw neon landing pad with bright glow
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 15;
    
    const padStart = pad.position - pad.width / 2;
    const padEnd = pad.position + pad.width / 2;
    
    ctx.beginPath();
    ctx.arc(0, 0, config.planet.radius, padStart, padEnd);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Draw debris as small neon dots
    ctx.shadowBlur = 8;
    debris.forEach(d => {
      const debrisX = d.r * Math.cos(d.theta);
      const debrisY = d.r * Math.sin(d.theta);
      
      ctx.shadowColor = '#ff6600';
      ctx.beginPath();
      ctx.arc(debrisX, debrisY, d.size * 2, 0, Math.PI * 2); // Make debris bigger
      ctx.fillStyle = '#ff6600';
      ctx.fill();
    });
    
    // Draw ship (same triangle design as main game)
    const shipX = ship.r * Math.cos(ship.theta);
    const shipY = ship.r * Math.sin(ship.theta);
    
    ctx.save();
    ctx.translate(shipX, shipY);
    
    // Ship rotated 90 degrees right so thruster points toward planet
    const shipAngle = ship.theta + Math.PI / 2;
    ctx.rotate(shipAngle);
    
    // Draw neon ship triangle with bright glow - half size
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -7.5); // Point away from planet - half size
    ctx.lineTo(-5, 5);
    ctx.lineTo(5, 5);
    ctx.closePath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw thrust flame (same style as main game) - half size
    if (ship.thrust > 0) {
      const flameLength = 7.5 + ship.thrust * 7.5; // Half size flame
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.moveTo(-3, 5);
      ctx.lineTo(0, 5 + flameLength);
      ctx.lineTo(3, 5);
      ctx.strokeStyle = '#ff4500';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Inner flame
      ctx.beginPath();
      ctx.moveTo(-1.5, 5);
      ctx.lineTo(0, 5 + flameLength * 0.8);
      ctx.lineTo(1.5, 5);
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    
    ctx.restore();
    
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
    return <div className="w-full h-screen flex items-center justify-center">Loading...</div>;
  }

  const altitude = ship.r - config.planet.radius;

  return (
    <div ref={containerRef} className="w-full h-screen bg-black relative">
      {/* Starfield background */}
      <div className="absolute inset-0 z-0">
        <CavernStarfield />
      </div>
      
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        style={{ imageRendering: 'pixelated' }}
      />
      
      <HUD 
        altitude={altitude}
        vx={ship.vr}         // Use radial velocity for vertical component
        vy={ship.vtheta}     // Use tangential velocity for horizontal component
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
