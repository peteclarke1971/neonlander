import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { HyperspaceStarfield, HyperspaceStarfieldHandle } from './HyperspaceStarfield';
import { AsteroidField, AsteroidFieldHandle } from './AsteroidField';
import { VectorWormhole, VectorWormholeHandle } from './VectorWormhole';

export type TransitionType = 
  | "hyperspace-jump"
  | "vector-scanline" 
  | "wormhole-portal"
  | "neon-grid-flip"
  | "asteroid-blast";

export interface GameTransitionHandle {
  startTransition: (type: TransitionType, onComplete: () => void) => void;
}

interface GameTransitionProps {
  isActive: boolean;
  className?: string;
  onReady?: () => void;
}

export const GameTransition = forwardRef<GameTransitionHandle, GameTransitionProps>(
  ({ isActive, className = "", onReady }, ref) => {
    const [currentTransition, setCurrentTransition] = useState<TransitionType | null>(null);
    const [phase, setPhase] = useState<"fade-out" | "effect" | "fade-in" | "complete">("complete");
    const [progress, setProgress] = useState(0);
    
    const starfieldRef = useRef<HyperspaceStarfieldHandle>(null);
    const asteroidRef = useRef<AsteroidFieldHandle>(null);
    const wormholeRef = useRef<VectorWormholeHandle>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const onCompleteRef = useRef<(() => void) | null>(null);
    const animationRef = useRef<number | null>(null);

    // Signal component is ready
    useEffect(() => {
      onReady?.();
    }, [onReady]);

    useImperativeHandle(ref, () => ({
      startTransition: (type: TransitionType, onComplete: () => void) => {
        console.log("🎬 GameTransition.startTransition called:", type, { currentTransition, phase });
        if (currentTransition) {
          console.log("⚠️ Transition already in progress, ignoring");
          return; // Prevent overlapping transitions
        }
        
        console.log("🎨 Setting transition:", type);
        setCurrentTransition(type);
        setPhase("fade-out");
        setProgress(0);
        onCompleteRef.current = onComplete;
        
        // Configure transition-specific effects
        if (type === "hyperspace-jump") {
          starfieldRef.current?.SetSpeed(0.1);
        } else if (type === "asteroid-blast") {
          asteroidRef.current?.SetSeed(Math.random() * 0xffffffff);
        } else if (type === "wormhole-portal") {
          wormholeRef.current?.SetSeed(Math.random() * 0xffffffff);
          wormholeRef.current?.Play("warp-in");
        }
      }
    }));

    // Main transition timer
    useEffect(() => {
      if (!currentTransition || phase === "complete") return;

      const durations = {
        "hyperspace-jump": { fadeOut: 200, effect: 2600, fadeIn: 200 },
        "vector-scanline": { fadeOut: 150, effect: 700, fadeIn: 150 },
        "wormhole-portal": { fadeOut: 500, effect: 4000, fadeIn: 500 },
        "neon-grid-flip": { fadeOut: 200, effect: 500, fadeIn: 200 },
        "asteroid-blast": { fadeOut: 150, effect: 500, fadeIn: 150 }
      };

      const timing = durations[currentTransition];
      let duration = 0;
      let nextPhase: "fade-out" | "effect" | "fade-in" | "complete" = "complete";

      switch (phase) {
        case "fade-out":
          duration = timing.fadeOut;
          nextPhase = "effect";
          break;
        case "effect":
          duration = timing.effect;
          nextPhase = "fade-in";
          // Trigger view change at midpoint of effect
          if (currentTransition === "hyperspace-jump") {
            starfieldRef.current?.SetSpeed(2.0); // Accelerate dramatically
          }
          setTimeout(() => {
            onCompleteRef.current?.();
          }, duration / 2);
          break;
        case "fade-in":
          duration = timing.fadeIn;
          nextPhase = "complete";
          break;
      }

      const timer = setTimeout(() => {
        if (nextPhase === "complete") {
          setCurrentTransition(null);
          setProgress(0);
        }
        setPhase(nextPhase);
      }, duration);

      // Progress animation
      const startTime = performance.now();
      const progressLoop = () => {
        const elapsed = performance.now() - startTime;
        const newProgress = Math.min(elapsed / duration, 1);
        setProgress(newProgress);
        
        if (newProgress < 1) {
          requestAnimationFrame(progressLoop);
        }
      };
      progressLoop();

      return () => clearTimeout(timer);
    }, [currentTransition, phase]);

    // Vector scanline effect
    const drawScanlines = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const scanlineHeight = 4;
      const speed = 800; // pixels per second
      const elapsed = progress * 1000; // convert to ms
      const scanlineY = (elapsed * speed) / 1000;
      
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.fillRect(0, scanlineY - scanlineHeight, canvas.width, scanlineHeight * 2);
      
      // Add static noise above scanline
      if (phase === "effect") {
        const imageData = ctx.getImageData(0, 0, canvas.width, Math.min(scanlineY, canvas.height));
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() > 0.95) {
            const noise = Math.random() * 255;
            data[i] = noise;     // R
            data[i + 1] = noise; // G
            data[i + 2] = noise; // B
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
    };

    // Neon grid flip effect
    const drawNeonGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const gridSize = 50;
      const flipProgress = phase === "effect" ? progress : (phase === "fade-in" ? 1 : 0);
      
      ctx.strokeStyle = `hsl(180 100% 50% / ${0.6 * (1 - Math.abs(flipProgress - 0.5) * 2)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      
      // 3D flip transformation
      const perspective = Math.sin(flipProgress * Math.PI);
      const scaleY = Math.cos(flipProgress * Math.PI);
      
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(1, Math.abs(scaleY) * 0.3 + 0.7);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      
      // Draw grid
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      ctx.restore();
    };

    // Asteroid blast effect
    const drawAsteroidBlast = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      // Particle explosion effect
      const numParticles = 50;
      const blastProgress = phase === "effect" ? progress : (phase === "fade-in" ? 1 : 0);
      
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        const distance = blastProgress * 300 * (0.5 + Math.random() * 0.5);
        const x = canvas.width / 2 + Math.cos(angle) * distance;
        const y = canvas.height / 2 + Math.sin(angle) * distance;
        const size = (1 - blastProgress) * 8 * Math.random();
        
        ctx.fillStyle = `hsl(${30 + Math.random() * 60}, 100%, ${50 + Math.random() * 50}%)`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // White flash effect
      if (phase === "effect" && progress > 0.7) {
        const flashAlpha = Math.sin((progress - 0.7) * Math.PI / 0.3);
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.6})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Canvas effects rendering with continuous animation
    useEffect(() => {
      if (!currentTransition || !canvasRef.current) return;
      if (currentTransition === "hyperspace-jump" || currentTransition === "wormhole-portal") return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const draw = () => {
        if (!currentTransition || phase === "complete") return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        switch (currentTransition) {
          case "vector-scanline":
            drawScanlines(ctx, canvas);
            break;
          case "neon-grid-flip":
            drawNeonGrid(ctx, canvas);
            break;
          case "asteroid-blast":
            drawAsteroidBlast(ctx, canvas);
            break;
        }
        
        // Continue animation loop
        animationRef.current = requestAnimationFrame(draw);
      };

      draw();

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };
    }, [currentTransition, phase]);

    // Show transition when active and transition is set
    if (!isActive) return null;

    const getOpacity = () => {
      switch (phase) {
        case "fade-out":
          return progress;
        case "effect":
          return 1;
        case "fade-in":
          return 1 - progress;
        default:
          return 0;
      }
    };

    return (
      <div 
        className={`fixed inset-0 z-50 pointer-events-none ${className}`}
        style={{ opacity: getOpacity() }}
      >
        {/* Hyperspace Jump */}
        {currentTransition === "hyperspace-jump" && (
          <HyperspaceStarfield
            ref={starfieldRef}
            speed={0.1}
            density={2000}
            focalLength={600}
            trail={0.3}
            style="glow"
            className="w-full h-full"
          />
        )}
        
        {/* Asteroid Blast - handled by canvas now */}
        
        {/* Wormhole Portal */}
        {currentTransition === "wormhole-portal" && (
          <VectorWormhole
            ref={wormholeRef}
            active={true}
            preset="Wormhole"
            loop={false}
            className="w-full h-full"
          />
        )}
        
        {/* Canvas-based effects */}
        {(currentTransition === "vector-scanline" || 
          currentTransition === "neon-grid-flip" ||
          currentTransition === "asteroid-blast") && (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
      </div>
    );
  }
);

GameTransition.displayName = "GameTransition";