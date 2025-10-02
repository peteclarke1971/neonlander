import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SurvivalHUD } from "./SurvivalHUD";
import { AudioManager } from "./AudioManager";
import { SurvivalGameOverData } from "./types/survival";
import { EndlessTerrainGenerator, TerrainChunk } from "./systems/endlessTerrain";
import { movingPadSystem } from "./systems/movingPads";
import { MovingPad } from "./types";
import { anyGamepad, readGamepad, loadProfile, vibrate } from "@/hooks/use-gamepad";

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
  const [fps, setFps] = useState(0);
  
  // Game state
  const [distance, setDistance] = useState(0);
  const [landings, setLandings] = useState(0);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);
  
  // HUD state
  const [altitude, setAltitude] = useState(0);
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [fuel, setFuel] = useState(200);
  const fuelCap = 200;
  
  const keys = useRef({ left: false, right: false, thrust: false });
  const audio = useRef(new AudioManager());
  
  // Gamepad state
  const gamepadRef = useRef<Gamepad | null>(null);
  const profileRef = useRef(loadProfile("default"));
  
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
    
    // Place ship on first landing pad
    const firstPad = chunks[0].pads[0];
    let shipX = firstPad ? (firstPad.xStart + firstPad.xEnd) / 2 : CHUNK_WIDTH / 2;
    let shipY = firstPad ? firstPad.y - 16 : 200;
    let shipVx = 0;
    let shipVy = 0;
    let shipAngle = 0;
    let shipAngularVel = 0;
    let fuelAmount = 200;
    let currentScore = 0;
    let currentLandings = 0;
    let currentDistance = 0;
    let currentTime = 0;
    let isDead = false;
    let isLanded = false;
    let landedPad: any = null;
    let padToClear: any = null; // Track pad to remove after clearing
    
    // Thruster particles
    type ThrusterParticle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
    const thrusterParticles: ThrusterParticle[] = [];
    
    // Starfield system (matching main game) - arrays declared here, initialized later
    type Star = { x: number; y: number; size: number; baseA: number; tw: number; ph: number; bright: boolean };
    type Shooting = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    type BgSat = { x: number; y: number; vx: number; vy: number; life: number; max: number; scale: number; rot: number; rotV: number };
    const stars: Star[] = [];
    const shooting: Shooting[] = [];
    const bgSats: BgSat[] = [];
    let nextShooting = 0.6 + Math.random() * 1.6;
    let nextBgSat = 5 + Math.random() * 7;
    
    // Camera
    let cameraX = 0;
    let cameraShake = 0;
    
    // Camera and zoom system (matching main game)
    let smoothedAnchor = 0;
    let camAnchorInit = true;
    let zoom = 1.0;
    let clearanceEMA = 220;
    let prevTargetZoom = 1.0;
    
    // Start level audio
    audio.current.stopAllAudio();
    audio.current.playLevelTrackForLevel(0);
    
    // Physics constants matching main game (EASY MODE)
    const GRAVITY = 0.02 * 0.75; // 0.015
    const ROTATION_ACCEL = 2.2 * 1.15; // Easy mode rotation
    const THRUST_ACCEL = 9.8 * 0.7; // 6.86
    const FUEL_BURN = 22; // Easy mode fuel consumption
    
    // Performance optimization
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const shouldOptimize = isMobile;
    const THRUSTER_PARTICLE_COUNT = shouldOptimize ? 2 : 25;
    
    const dprInit = Math.min(2, window.devicePixelRatio || 1);
    const getViewWidth = () => c.width / dprInit;
    const getViewHeight = () => c.height / dprInit;
    
    // Initialize starfield (canvas-space stars) - use full canvas dimensions
    const STAR_COUNT = shouldOptimize ? 150 : 320;
    for (let i = 0; i < STAR_COUNT; i++) {
      const sx = Math.random() * c.width;
      const sy = Math.random() * c.height;
      const bright = Math.random() < 0.15;
      stars.push({ 
        x: sx, 
        y: sy, 
        size: bright ? (2.4 * dprInit) : (1.4 * dprInit), 
        baseA: bright ? 0.95 : 0.6, 
        tw: 0.5 + Math.random() * 1.5, 
        ph: Math.random() * Math.PI * 2, 
        bright 
      });
    }
    
    // Shooting star spawner - use full canvas dimensions
    const spawnShooting = () => {
      const margin = 80 * dprInit;
      let sx = 0, sy = 0, vx = 0, vy = 0;
      const side = Math.floor(Math.random() * 3);
      if (side === 0) {
        sx = -margin; sy = Math.random() * (c.height * 0.7);
        vx = (180 + Math.random() * 260) * dprInit; vy = (Math.random() - 0.5) * 140 * dprInit;
      } else if (side === 1) {
        sx = c.width + margin; sy = Math.random() * (c.height * 0.7);
        vx = -(180 + Math.random() * 260) * dprInit; vy = (Math.random() - 0.5) * 140 * dprInit;
      } else {
        sx = Math.random() * c.width; sy = -margin;
        vx = (Math.random() - 0.5) * 280 * dprInit; vy = (160 + Math.random() * 220) * dprInit;
      }
      shooting.push({ x: sx, y: sy, vx, vy, life: 0, max: 0.6 + Math.random() * 1.0 });
    };
    
    // Background satellite spawner - use full canvas dimensions
    const spawnBgSat = () => {
      const scale = 0.25 * dprInit;
      const speed = (40 + Math.random() * 60) * dprInit;
      const fromLeft = Math.random() < 0.5;
      const sx = fromLeft ? -120 * dprInit : c.width + 120 * dprInit;
      const vx = fromLeft ? speed : -speed;
      const sy = c.height * 0.28 + Math.random() * (c.height * 0.34);
      const vy = (Math.random() - 0.5) * speed * 0.25;
      bgSats.push({ 
        x: sx, 
        y: sy, 
        vx, 
        vy, 
        life: 0, 
        max: 9 + Math.random() * 8, 
        scale, 
        rot: Math.random() * Math.PI * 2, 
        rotV: -0.8 + Math.random() * 1.6 
      });
    };
    
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
    let frameCount = 0;
    let lastFpsUpdate = performance.now();
    
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      
      // FPS counter
      frameCount++;
      if (now - lastFpsUpdate >= 500) {
        const elapsed = (now - lastFpsUpdate) / 1000;
        setFps(Math.round(frameCount / elapsed));
        frameCount = 0;
        lastFpsUpdate = now;
      }
      
      if (paused || isDead) return;
      
      // Frame rate limiting with clamped dt (matching main game)
      let dt = (now - lastTime) / 1000;
      lastTime = now;
      
      // Clamp dt to prevent physics issues on lag spikes
      if (dt > 0.1) dt = 0.033; // Cap at ~30fps equivalent
      dt = Math.min(dt, 0.033); // Max 33ms timestep
      
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
        
        // Remove old chunks that are far behind (keep more chunks for smooth disappearing)
        if (chunks.length > 8) {
          chunks.shift();
        }
      }
      
      // Update moving pads
      for (const chunk of chunks) {
        for (const mp of chunk.movingPads) {
          movingPadSystem.updateMovingPad(mp, dt);
        }
      }
      
      // Gamepad input
      const gp = anyGamepad();
      if (gp) {
        gamepadRef.current = gp;
        const input = readGamepad(gp, profileRef.current);
        
        // Analog rotation (left stick X-axis)
        if (Math.abs(input.rotation) > 0.05) {
          shipAngularVel += input.rotation * ROTATION_ACCEL * dt * 1.2;
        }
        
        // Digital rotation (shoulder buttons)
        if (input.buttons.rotateLeft) {
          shipAngularVel -= ROTATION_ACCEL * dt;
        }
        if (input.buttons.rotateRight) {
          shipAngularVel += ROTATION_ACCEL * dt;
        }
        
        // Apply thrust from gamepad
        if (input.thrust > 0.1 && fuelAmount > 0) {
          keys.current.thrust = true;
          vibrate(50, input.thrust * 0.15, input.thrust * 0.3);
        } else {
          keys.current.thrust = false;
        }
        
        // Pause button
        if (input.buttons.pause && !paused) {
          setPaused(true);
        }
      }
      
      // Input handling and physics
      if (!isLanded) {
        // Keyboard rotation controls
        if (keys.current.left) {
          shipAngularVel -= ROTATION_ACCEL * dt;
        }
        if (keys.current.right) {
          shipAngularVel += ROTATION_ACCEL * dt;
        }
        
        // Thrust controls
        if (keys.current.thrust && fuelAmount > 0) {
          const thrustX = Math.sin(shipAngle) * THRUST_ACCEL;
          const thrustY = -Math.cos(shipAngle) * THRUST_ACCEL;
          shipVx += thrustX * dt;
          shipVy += thrustY * dt;
          fuelAmount -= FUEL_BURN * dt;
          audio.current.setThruster(1);
          
          // Spawn thruster particles (matching main game)
          const nozzlePositions = shouldOptimize ? [
            { x: shipX - Math.sin(shipAngle) * 10, y: shipY + Math.cos(shipAngle) * 10 }
          ] : [
            // Center nozzle
            { x: shipX - Math.sin(shipAngle) * 10, y: shipY + Math.cos(shipAngle) * 10 },
            // Left nozzle
            { x: shipX - Math.sin(shipAngle) * 10 - Math.cos(shipAngle) * 3, y: shipY + Math.cos(shipAngle) * 10 + Math.sin(shipAngle) * 3 },
            // Right nozzle
            { x: shipX - Math.sin(shipAngle) * 10 + Math.cos(shipAngle) * 3, y: shipY + Math.cos(shipAngle) * 10 - Math.sin(shipAngle) * 3 }
          ];
          
          for (const nozzle of nozzlePositions) {
            const particlesPerNozzle = Math.ceil(THRUSTER_PARTICLE_COUNT / nozzlePositions.length);
            for (let i = 0; i < particlesPerNozzle; i++) {
              const angleSpread = shouldOptimize ? 0.6 : 1.6;
              const pa = shipAngle + (Math.random() - 0.5) * angleSpread + Math.PI;
              const sp = shouldOptimize ? 
                (60 + Math.random() * 120) : 
                (100 + Math.random() * 200);
              const lifespan = shouldOptimize ? 0.5 : 1.6;
              
              thrusterParticles.push({
                x: nozzle.x,
                y: nozzle.y,
                vx: Math.sin(pa) * sp,
                vy: -Math.cos(pa) * sp,
                life: 0,
                max: lifespan,
                color: neonColor
              });
            }
          }
        } else {
          audio.current.setThruster(0);
        }
        
        // Physics integration (matching main game with 60fps scaling)
        shipVy += GRAVITY * 60 * dt;
        shipX += shipVx * 60 * dt;
        shipY += shipVy * 60 * dt;
        shipAngle += shipAngularVel * dt;
        
        // Angular friction (easy mode - only when no rotation input)
        if (!keys.current.left && !keys.current.right) {
          shipAngularVel *= 0.9;
          if (Math.abs(shipAngularVel) < 0.02) shipAngularVel = 0;
        }
        
        // Update distance (only counts forward progress)
        const newDistance = Math.max(currentDistance, shipX - CHUNK_WIDTH / 2);
        currentDistance = newDistance;
        setDistance(currentDistance);
        
        // Check if we've cleared a pad after takeoff
        if (padToClear) {
          const padY = padToClear.y || padToClear.currentPos?.y;
          const clearanceGap = 20; // Gap needed to clear the pad
          if (shipY < padY - clearanceGap) {
            // Remove the pad from the chunk
            for (const chunk of chunks) {
              const padIndex = chunk.pads.indexOf(padToClear);
              if (padIndex !== -1) {
                chunk.pads.splice(padIndex, 1);
                break;
              }
              const mpIndex = chunk.movingPads.indexOf(padToClear);
              if (mpIndex !== -1) {
                chunk.movingPads.splice(mpIndex, 1);
                break;
              }
            }
            padToClear = null;
          }
        }
        
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
            // Easy mode landing requirements (matching main game)
            const okAngle = Math.abs(shipAngle) < 0.18; // ~10 degrees
            const okVy = Math.abs(shipVy) < 1.8;
            const okVx = Math.abs(shipVx) < 1.5;
            
            if (okAngle && okVy && okVx) {
              // Successful landing!
              isLanded = true;
              landedPad = landingPad;
              shipY = (movingPad ? movingPad.currentPos.y : landingPad.y) - 12;
              shipVy = movingPad ? (movingPad as MovingPad).currentVelocity.y : 0;
              shipVx = movingPad ? (movingPad as MovingPad).currentVelocity.x : 0;
              shipAngularVel = 0;
              
              // Add fuel refill (doubled)
              const refillAmount = 60 - (currentDistance / 5000) * 30; // 60 to 30 fuel
              fuelAmount = Math.min(fuelCap, fuelAmount + refillAmount);
              
              // Add score
              const landingScore = 1000 * (landingPad.multiplier || 1);
              currentScore += landingScore;
              currentLandings++;
              
              setScore(currentScore);
              setLandings(currentLandings);
              setFuel(fuelAmount);
              
              audio.current.success();
              
              // No auto-takeoff - player must thrust to take off
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
        
        // Fuel depletion - ship continues with trajectory until crash
      } else {
        // Landed - move with pad if it's a moving pad
        if (landedPad && (landedPad as MovingPad).currentVelocity) {
          shipX += (landedPad as MovingPad).currentVelocity.x * 60 * dt;
          shipY = (landedPad as MovingPad).currentPos.y - 12;
        }
        
        // Check for takeoff input
        if (keys.current.thrust && fuelAmount > 0) {
          isLanded = false;
          padToClear = landedPad; // Mark this pad to be removed once cleared
          landedPad = null;
          
          // Small upward impulse to help clear the pad
          shipVy = -1.5;
        }
      }
      
      // Update thruster particles
      for (let i = thrusterParticles.length - 1; i >= 0; i--) {
        const p = thrusterParticles[i];
        p.life += dt;
        if (p.life >= p.max) {
          thrusterParticles.splice(i, 1);
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += GRAVITY * 30 * dt; // Particles affected by gravity
        }
      }
      
      // Update starfield (shooting stars and satellites)
      if (currentTime >= nextShooting) {
        spawnShooting();
        nextShooting = currentTime + (0.6 + Math.random() * 1.6);
      }
      if (currentTime >= nextBgSat) {
        spawnBgSat();
        nextBgSat = currentTime + (5 + Math.random() * 7);
      }
      
      // Update shooting stars
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += dt;
        if (s.life >= s.max) {
          shooting.splice(i, 1);
        } else {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
        }
      }
      
      // Update background satellites
      for (let i = bgSats.length - 1; i >= 0; i--) {
        const s = bgSats[i];
        s.life += dt;
        if (s.life >= s.max) {
          bgSats.splice(i, 1);
        } else {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.rot += s.rotV * dt;
        }
      }
      
      // Update HUD (recalculate terrain height for altitude)
      const currentTerrainY = getHeightAt(shipX);
      const currentAltitude = currentTerrainY - shipY;
      setAltitude(currentAltitude);
      setVx(shipVx);
      setVy(shipVy);
      setFuel(fuelAmount);
      
      // Camera follows ship horizontally with predictive centering (matching main game)
      const leadTime = 0.35; // Predictive camera lead
      const targetCameraX = shipX + shipVx * leadTime;
      const camAlpha = 1 - Math.exp(-dt / 0.28); // Smooth interpolation
      cameraX += (targetCameraX - cameraX) * camAlpha;
      
      // Calculate dynamic zoom based on terrain clearance (matching main game)
      const alpha = 0.1;
      clearanceEMA = alpha * currentAltitude + (1 - alpha) * clearanceEMA;
      const effClr = clearanceEMA;
      
      // Zoom range: 1.4x (close to terrain) to 1.0x (far from terrain)
      const near = 0, far = 420;
      const tRaw = Math.min(1, Math.max(0, (effClr - near) / (far - near)));
      const s = tRaw * tRaw * (3 - 2 * tRaw); // Smoothstep
      let targetZoom = 1.4 * (1 - s) + 1.0 * s;
      
      // Check for landing pad proximity enhancement
      let nearestPadDist = Infinity;
      for (const chunk of chunks) {
        for (const pad of chunk.pads) {
          const padCenterX = (pad.xStart + pad.xEnd) / 2;
          const dx = Math.abs(shipX - padCenterX);
          const dy = Math.abs(shipY - pad.y);
          const distance = Math.sqrt(dx * dx + dy * dy);
          nearestPadDist = Math.min(nearestPadDist, distance);
        }
        for (const mp of chunk.movingPads) {
          const dx = Math.abs(shipX - mp.currentPos.x);
          const dy = Math.abs(shipY - mp.currentPos.y);
          const distance = Math.sqrt(dx * dx + dy * dy);
          nearestPadDist = Math.min(nearestPadDist, distance);
        }
      }
      
      const padDetectionRange = 250;
      if (nearestPadDist < padDetectionRange) {
        // Enhanced zoom for landing approach (1.4x to 3.0x)
        const padProximityRatio = 1 - (nearestPadDist / padDetectionRange);
        const enhancedZoom = 1.4 + (1.6 * padProximityRatio * padProximityRatio);
        targetZoom = Math.max(targetZoom, enhancedZoom);
      }
      
      // Apply hysteresis and smooth transitions
      if (Math.abs(targetZoom - prevTargetZoom) < 0.015) targetZoom = prevTargetZoom;
      prevTargetZoom = targetZoom;
      
      const zoomAlpha = 1 - Math.exp(-dt / 1.6);
      const desiredDelta = (targetZoom - zoom) * zoomAlpha;
      const maxRate = 0.28;
      const maxStep = maxRate * dt;
      zoom += Math.max(-maxStep, Math.min(maxStep, desiredDelta));
      
      // Vertical camera anchor (matching main game)
      const viewH = c.height / (zoom * dprInit);
      let groundAtCam = getHeightAt(cameraX);
      const desiredGroundY = viewH * 0.82; // Target ground position from top in view units
      const groundAnchor = -groundAtCam + (desiredGroundY - viewH / 2);
      const desiredLanderY = viewH * 0.45; // Target lander position from top in view units
      const landerAnchor = -shipY + (desiredLanderY - viewH / 2);
      const anchorTarget = Math.max(groundAnchor, landerAnchor);
      
      if (camAnchorInit) {
        smoothedAnchor = anchorTarget;
        camAnchorInit = false;
      }
      const aAlpha = 1 - Math.exp(-dt / 0.35);
      smoothedAnchor += (anchorTarget - smoothedAnchor) * aAlpha;
      const anchor = smoothedAnchor;
      
      // Render
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.scale(dprInit, dprInit);
      
      const shake = cameraShake;
      cameraShake *= 0.9;
      
      // Draw starfield with terrain masking (before world transform)
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      // Create terrain clipping path to mask stars behind terrain
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(c.width, 0);
      const segs = 96;
      for (let i = segs; i >= 0; i--) {
        const sx = (i / segs) * c.width;
        const worldX = cameraX + (sx - c.width / 2) / zoom;
        const worldY = getHeightAt(worldX);
        const sy = c.height / 2 + (worldY + anchor) * zoom * dprInit;
        ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.clip();
      
      // Draw stars
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = shouldOptimize ? 2 : 4;
      ctx.fillStyle = neonColor;
      const starLimit = shouldOptimize ? Math.min(100, stars.length) : stars.length;
      for (let i = 0; i < starLimit; i++) {
        const s = stars[i];
        const a = s.baseA * (0.7 + 0.3 * Math.sin(s.ph + currentTime * s.tw));
        ctx.globalAlpha = Math.min(1, Math.max(0.25, a));
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;
      
      // Draw shooting stars
      for (const sh of shooting) {
        const t = 1 - Math.min(1, sh.life / sh.max);
        ctx.globalAlpha = t;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 0.06, sh.y - sh.vy * 0.06);
        ctx.lineWidth = 2 * dprInit;
        ctx.strokeStyle = neonColor;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      
      // Draw background satellites
      for (const s of bgSats) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.scale(s.scale, s.scale);
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 1.5 * dprInit;
        ctx.beginPath();
        ctx.rect(-6 * dprInit, -2 * dprInit, 12 * dprInit, 4 * dprInit);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(-16 * dprInit, -3 * dprInit, 8 * dprInit, 6 * dprInit);
        ctx.rect(8 * dprInit, -3 * dprInit, 8 * dprInit, 6 * dprInit);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      
      // Apply zoom and camera transform (both horizontal and vertical)
      ctx.translate(c.width / (2 * dprInit), c.height / (2 * dprInit));
      ctx.scale(zoom, zoom);
      ctx.translate(-cameraX + shake, anchor);
      
      // Draw terrain
      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      
      for (const chunk of chunks) {
        // Improved culling: keep terrain visible for half a screen width after passing
        if (chunk.startX > cameraX + viewWidth || chunk.endX < cameraX - viewWidth * 0.5) continue;
        
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
      
      // Draw thruster particles
      for (const p of thrusterParticles) {
        const t = p.life / p.max;
        const alpha = 1 - t;
        const size = shouldOptimize ? 2 : (3 - t * 2);
        ctx.fillStyle = `hsla(${styles.getPropertyValue('--neon')}, ${alpha})`;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 6;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
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
      
      {/* FPS Counter */}
      <div className="fixed bottom-4 right-4 z-20 pointer-events-none select-none">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded px-3 py-1.5">
          <div className="text-xs font-mono text-muted-foreground">
            {fps} FPS
          </div>
        </div>
      </div>
      
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
