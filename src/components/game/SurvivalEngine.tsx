import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SurvivalHUD } from "./SurvivalHUD";
import { AudioManager } from "./AudioManager";
import { SurvivalGameOverData } from "./types/survival";
import { EndlessTerrainGenerator, TerrainChunk } from "./systems/endlessTerrain";
import { movingPadSystem } from "./systems/movingPads";
import { MovingPad } from "./types";

interface Props {
  onGameOver: (data: SurvivalGameOverData) => void;
}

const BASE_HEIGHT = 360;
const AMPLITUDE = 180;
const CHUNK_WIDTH = 2000;

export const SurvivalEngine: React.FC<Props> = ({ onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  
  // Game state
  const [distance, setDistance] = useState(0);
  const [landings, setLandings] = useState(0);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);
  
  // HUD state
  const [altitude, setAltitude] = useState(0);
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [fuel, setFuel] = useState(100);
  const fuelCap = 100;
  
  const keys = useRef({ left: false, right: false, thrust: false });
  const audio = useRef(new AudioManager());
  
  // Detect touch-capable devices
  useEffect(() => {
    try {
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints ?? 0) > 0 || (navigator as any).msMaxTouchPoints > 0;
      setIsTouch(!!hasTouch);
    } catch {
      setIsTouch(false);
    }
  }, []);
  
  useEffect(() => {
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = canvasRef.current!;
      const parent = containerRef.current!;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (["a", "arrowleft"].includes(k)) keys.current.left = down;
      if (["d", "arrowright"].includes(k)) keys.current.right = down;
      if (["w", "arrowup", " "].includes(k)) keys.current.thrust = down;
      if (down) audio.current.resume();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);
  
  useEffect(() => {
    let raf = 0;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const styles = getComputedStyle(document.documentElement);
    const neonColor = `hsl(${styles.getPropertyValue('--neon')})`;
    
    // Initialize endless terrain generator
    const seed = Math.floor(Math.random() * 1e9);
    const terrainGen = new EndlessTerrainGenerator({
      chunkWidth: CHUNK_WIDTH,
      baseHeight: BASE_HEIGHT,
      amplitude: AMPLITUDE,
      seed
    });
    
    // Generate initial chunks
    const chunks: TerrainChunk[] = [];
    for (let i = 0; i < 3; i++) {
      chunks.push(terrainGen.generateChunk(0));
    }
    
    // Physics state
    let shipX = CHUNK_WIDTH / 2;
    let shipY = 200;
    let shipVx = 0;
    let shipVy = 0;
    let shipAngle = 0;
    let shipAngularVel = 0;
    let fuelAmount = 100;
    let currentScore = 0;
    let currentLandings = 0;
    let currentDistance = 0;
    let currentTime = 0;
    let isDead = false;
    let isLanded = false;
    let landedPad: any = null;
    
    // Camera
    let cameraX = 0;
    let cameraShake = 0;
    
    // Start level audio
    audio.current.stopAllAudio();
    audio.current.playLevelTrackForLevel(0);
    
    const GRAVITY = 120;
    const ROTATION_SPEED = 3.5;
    const THRUST_POWER = 180;
    const FUEL_BURN = 8;
    
    const dprInit = Math.min(2, window.devicePixelRatio || 1);
    const getViewWidth = () => c.width / dprInit;
    const getViewHeight = () => c.height / dprInit;
    
    const getHeightAt = (x: number): number => {
      // Find the chunk this x belongs to
      for (const chunk of chunks) {
        if (x >= chunk.startX && x <= chunk.endX) {
          const localX = x - chunk.startX;
          const segmentWidth = (chunk.endX - chunk.startX) / (chunk.points.length - 1);
          const idx = Math.floor(localX / segmentWidth);
          if (idx >= 0 && idx < chunk.points.length - 1) {
            const t = (localX - idx * segmentWidth) / segmentWidth;
            return chunk.points[idx].y * (1 - t) + chunk.points[idx + 1].y * t;
          }
        }
      }
      return BASE_HEIGHT;
    };
    
    const getPadAt = (x: number, y: number) => {
      for (const chunk of chunks) {
        for (const pad of chunk.pads) {
          if (x >= pad.xStart && x <= pad.xEnd && Math.abs(y - pad.y) < 20) {
            return pad;
          }
        }
      }
      return null;
    };
    
    const getMovingPadAt = (x: number, y: number) => {
      for (const chunk of chunks) {
        for (const mp of chunk.movingPads) {
          if (movingPadSystem.isOnMovingPad(x, y, mp)) {
            return mp;
          }
        }
      }
      return null;
    };
    
    let lastTime = performance.now();
    
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      
      if (paused || isDead) return;
      
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      
      currentTime += dt;
      setTime(currentTime);
      
      const viewWidth = getViewWidth();
      const viewHeight = getViewHeight();
      
      // Update terrain chunks - generate new chunks as ship moves right
      const rightmostChunk = chunks[chunks.length - 1];
      if (shipX > rightmostChunk.endX - CHUNK_WIDTH) {
        // Calculate difficulty based on distance traveled
        const difficulty = Math.min(1, currentDistance / 5000);
        const newChunk = terrainGen.generateChunk(difficulty);
        chunks.push(newChunk);
        
        // Remove old chunks that are far behind
        if (chunks.length > 5) {
          chunks.shift();
        }
      }
      
      // Update moving pads
      for (const chunk of chunks) {
        for (const mp of chunk.movingPads) {
          movingPadSystem.updateMovingPad(mp, dt);
        }
      }
      
      // Input handling
      if (!isLanded) {
        if (keys.current.left) {
          shipAngularVel -= ROTATION_SPEED * dt;
        }
        if (keys.current.right) {
          shipAngularVel += ROTATION_SPEED * dt;
        }
        
        if (keys.current.thrust && fuelAmount > 0) {
          const thrustX = Math.sin(shipAngle) * THRUST_POWER;
          const thrustY = -Math.cos(shipAngle) * THRUST_POWER;
          shipVx += thrustX * dt;
          shipVy += thrustY * dt;
          fuelAmount -= FUEL_BURN * dt;
          audio.current.setThruster(1);
        } else {
          audio.current.setThruster(0);
        }
        
        // Physics
        shipVy += GRAVITY * dt;
        shipX += shipVx * dt;
        shipY += shipVy * dt;
        shipAngle += shipAngularVel * dt;
        shipAngularVel *= 0.98;
        
        // Update distance (only counts forward progress)
        const newDistance = Math.max(currentDistance, shipX - CHUNK_WIDTH / 2);
        currentDistance = newDistance;
        setDistance(currentDistance);
        
        // Prevent going too far left
        if (shipX < CHUNK_WIDTH / 2) {
          shipX = CHUNK_WIDTH / 2;
          shipVx = Math.max(0, shipVx);
        }
        
        // Collision detection
        let terrainY = getHeightAt(shipX);
        const shipBottom = shipY + 12;
        
        if (shipBottom >= terrainY) {
          // Check for pad landing
          const pad = getPadAt(shipX, shipY);
          const movingPad = getMovingPadAt(shipX, shipY);
          const landingPad = pad || movingPad;
          
          if (landingPad) {
            const speed = Math.sqrt(shipVx * shipVx + shipVy * shipVy);
            const angleOk = Math.abs(Math.sin(shipAngle)) < 0.3;
            
            if (speed < 45 && angleOk && Math.abs(shipVy) < 30) {
              // Successful landing!
              isLanded = true;
              landedPad = landingPad;
              shipY = landingPad.y - 12;
              shipVy = 0;
              shipVx = movingPad ? (movingPad as MovingPad).currentVelocity.x : 0;
              shipAngularVel = 0;
              
              // Add fuel refill
              const refillAmount = 30 - (currentDistance / 5000) * 15; // 30 to 15 fuel
              fuelAmount = Math.min(fuelCap, fuelAmount + refillAmount);
              
              // Add score
              const landingScore = 1000 * (landingPad.multiplier || 1);
              currentScore += landingScore;
              currentLandings++;
              
              setScore(currentScore);
              setLandings(currentLandings);
              setFuel(fuelAmount);
              
              audio.current.success();
              
              // Auto-takeoff after 0.5 seconds
              setTimeout(() => {
                if (!isDead) {
                  isLanded = false;
                  landedPad = null;
                }
              }, 500);
            } else {
              // Crash!
              isDead = true;
              audio.current.explosion();
              setTimeout(() => {
                onGameOver({
                  cause: "crash",
                  distance: currentDistance,
                  time: currentTime,
                  score: currentScore,
                  landings: currentLandings
                });
              }, 1000);
            }
          } else {
            // Hit terrain - crash!
            isDead = true;
            audio.current.explosion();
            setTimeout(() => {
              onGameOver({
                cause: "crash",
                distance: currentDistance,
                time: currentTime,
                score: currentScore,
                landings: currentLandings
              });
            }, 1000);
          }
        }
        
        // Out of fuel check
        terrainY = getHeightAt(shipX); // Recalculate for fuel check
        if (fuelAmount <= 0 && shipBottom >= terrainY - 50) {
          isDead = true;
          setTimeout(() => {
            onGameOver({
              cause: "fuel",
              distance: currentDistance,
              time: currentTime,
              score: currentScore,
              landings: currentLandings
            });
          }, 1000);
        }
      } else {
        // Landed - move with pad if it's a moving pad
        if (landedPad && (landedPad as MovingPad).currentVelocity) {
          shipX += (landedPad as MovingPad).currentVelocity.x * dt;
        }
      }
      
      // Update HUD (recalculate terrain height for altitude)
      const currentTerrainY = getHeightAt(shipX);
      setAltitude(currentTerrainY - shipY);
      setVx(shipVx);
      setVy(shipVy);
      setFuel(fuelAmount);
      
      // Camera follows ship with smooth motion, keeping ship slightly left of center
      const targetCameraX = shipX - viewWidth * 0.4;
      cameraX += (targetCameraX - cameraX) * dt * 4;
      
      // Render
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.scale(dprInit, dprInit);
      
      const shake = cameraShake;
      cameraShake *= 0.9;
      ctx.translate(-cameraX + shake, 0);
      
      // Draw terrain
      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      
      for (const chunk of chunks) {
        if (chunk.startX > cameraX + viewWidth || chunk.endX < cameraX) continue;
        
        ctx.beginPath();
        for (let i = 0; i < chunk.points.length; i++) {
          const pt = chunk.points[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        
        // Draw pads
        for (const pad of chunk.pads) {
          ctx.fillStyle = pad.bonus2x ? `rgba(255,100,255,0.3)` : `rgba(100,255,255,0.3)`;
          ctx.fillRect(pad.xStart, pad.y - 2, pad.xEnd - pad.xStart, 4);
          ctx.strokeStyle = neonColor;
          ctx.strokeRect(pad.xStart, pad.y - 2, pad.xEnd - pad.xStart, 4);
        }
        
        // Draw moving pads
        for (const mp of chunk.movingPads) {
          const w = mp.xEnd - mp.xStart;
          ctx.fillStyle = `rgba(255,200,100,0.3)`;
          ctx.fillRect(mp.currentPos.x - w / 2, mp.currentPos.y - 2, w, 4);
          ctx.strokeStyle = "#FFC864";
          ctx.strokeRect(mp.currentPos.x - w / 2, mp.currentPos.y - 2, w, 4);
        }
      }
      
      // Draw ship
      ctx.save();
      ctx.translate(shipX, shipY);
      ctx.rotate(shipAngle);
      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      
      // Ship body
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(-8, 10);
      ctx.lineTo(8, 10);
      ctx.closePath();
      ctx.stroke();
      
      // Landing legs
      ctx.beginPath();
      ctx.moveTo(-6, 8);
      ctx.lineTo(-12, 12);
      ctx.moveTo(6, 8);
      ctx.lineTo(12, 12);
      ctx.stroke();
      
      ctx.restore();
      
      ctx.restore();
    };
    
    raf = requestAnimationFrame(loop);
    
    return () => {
      cancelAnimationFrame(raf);
      audio.current.stopAllAudio();
    };
  }, [paused, onGameOver]);
  
  return (
    <div ref={containerRef} className="relative w-full h-screen bg-background overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      {isTouch && (
        <div
          className="absolute inset-0 z-10 select-none"
          onTouchStart={(e) => { 
            e.preventDefault(); 
            if (e.touches.length > 0 && !paused) { 
              keys.current.thrust = true; 
              audio.current.resume(); 
            } 
          }}
          onTouchEnd={(e) => { 
            e.preventDefault(); 
            keys.current.thrust = false; 
          }}
          onTouchCancel={(e) => { 
            e.preventDefault(); 
            keys.current.thrust = false; 
          }}
        />
      )}
      
      <SurvivalHUD
        altitude={altitude}
        vx={vx}
        vy={vy}
        fuel={fuel}
        fuelCap={fuelCap}
        score={score}
        time={time}
        distance={distance}
        landings={landings}
      />
      
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-accent">PAUSED</h2>
            <Button onClick={() => setPaused(false)} variant="outline">
              Resume
            </Button>
          </div>
        </div>
      )}
      
      {/* Touch Controls */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-3 select-none">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="select-none"
            onMouseDown={() => (keys.current.left = true)} 
            onMouseUp={() => (keys.current.left = false)} 
            onMouseLeave={() => (keys.current.left = false)}
            onTouchStart={(e) => { e.preventDefault(); keys.current.left = true; }} 
            onTouchEnd={(e) => { e.preventDefault(); keys.current.left = false; }}
            onTouchCancel={(e) => { e.preventDefault(); keys.current.left = false; }}
          >
            <span className="select-none">Rotate ◄</span>
          </Button>
          <Button 
            variant="outline" 
            className="select-none"
            onMouseDown={() => (keys.current.right = true)} 
            onMouseUp={() => (keys.current.right = false)} 
            onMouseLeave={() => (keys.current.right = false)}
            onTouchStart={(e) => { e.preventDefault(); keys.current.right = true; }} 
            onTouchEnd={(e) => { e.preventDefault(); keys.current.right = false; }}
            onTouchCancel={(e) => { e.preventDefault(); keys.current.right = false; }}
          >
            <span className="select-none">Rotate ►</span>
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Tap screen: Thrust | Arrows/W: Keys
        </div>
      </div>
    </div>
  );
};
