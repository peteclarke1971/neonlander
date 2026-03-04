import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { HyperspaceStarfield, HyperspaceStarfieldHandle } from './HyperspaceStarfield';
import { AsteroidField, AsteroidFieldHandle } from './AsteroidField';
import { VectorWormhole, VectorWormholeHandle } from './VectorWormhole'; // kept as backup
import { VectorWormholeLite, VectorWormholeLiteHandle } from './VectorWormholeLite';

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

// Durations in ms
const DURATIONS: Record<TransitionType, { fadeOut: number; effect: number; fadeIn: number }> = {
  "hyperspace-jump": { fadeOut: 200, effect: 3200, fadeIn: 200 },
  "vector-scanline": { fadeOut: 150, effect: 700, fadeIn: 150 },
  "wormhole-portal": { fadeOut: 500, effect: 4000, fadeIn: 500 },
  "neon-grid-flip": { fadeOut: 200, effect: 500, fadeIn: 200 },
  "asteroid-blast": { fadeOut: 150, effect: 500, fadeIn: 150 },
};

export const GameTransition = forwardRef<GameTransitionHandle, GameTransitionProps>(
  ({ isActive, className = "", onReady }, ref) => {
    const [currentTransition, setCurrentTransition] = useState<TransitionType | null>(null);
    // phase kept for conditional rendering only — NOT used in animation loop
    const [phase, setPhase] = useState<"fade-out" | "effect" | "fade-in" | "complete">("complete");

    const starfieldRef = useRef<HyperspaceStarfieldHandle>(null);
    const asteroidRef = useRef<AsteroidFieldHandle>(null);
    const wormholeRef = useRef<VectorWormholeLiteHandle>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const onCompleteRef = useRef<(() => void) | null>(null);
    const rafRef = useRef<number>(0);

    // Animation state kept entirely in refs to avoid re-renders
    const animStartRef = useRef(0);
    const typeRef = useRef<TransitionType | null>(null);
    const midFiredRef = useRef(false);

    useEffect(() => { onReady?.(); }, [onReady]);

    useImperativeHandle(ref, () => ({
      startTransition: (type: TransitionType, onComplete: () => void) => {
        console.log("🎬 GameTransition.startTransition called:", type);
        if (typeRef.current) {
          console.log("⚠️ Transition already in progress, ignoring");
          return;
        }

        typeRef.current = type;
        onCompleteRef.current = onComplete;
        midFiredRef.current = false;
        animStartRef.current = performance.now();

        // React state for rendering the correct child component
        setCurrentTransition(type);
        setPhase("fade-out");

        // Configure transition-specific effects
        if (type === "hyperspace-jump") {
          starfieldRef.current?.SetSpeed(0.1);
        } else if (type === "asteroid-blast") {
          asteroidRef.current?.SetSeed(Math.random() * 0xffffffff);
        } else if (type === "wormhole-portal") {
          wormholeRef.current?.Play();
        }

        // Kick off the single RAF loop
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
      },
    }));

    // Easing helper
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // --- Single RAF loop handles the entire lifecycle ---
    const tick = useCallback((now: number) => {
      const type = typeRef.current;
      if (!type) return;

      const timing = DURATIONS[type];
      const totalDur = timing.fadeOut + timing.effect + timing.fadeIn;
      const elapsed = now - animStartRef.current;
      const clamped = Math.min(elapsed, totalDur);

      // Determine which phase we're in and compute opacity
      let opacity = 0;
      let localProgress = 0; // 0..1 within current phase

      if (clamped < timing.fadeOut) {
        // Fade-out
        localProgress = clamped / timing.fadeOut;
        opacity = easeInOutCubic(localProgress);
      } else if (clamped < timing.fadeOut + timing.effect) {
        // Effect phase
        const effElapsed = clamped - timing.fadeOut;
        localProgress = effElapsed / timing.effect;
        opacity = 1;

        // Fire mid-point callback once
        if (!midFiredRef.current && effElapsed >= timing.effect / 2) {
          midFiredRef.current = true;
          onCompleteRef.current?.();
        }

        // Hyperspace speed ramp: smooth ease from 0.1 → 2.0 over first 60%, hold, then ease down
        if (type === "hyperspace-jump") {
          let spd: number;
          if (localProgress < 0.6) {
            spd = 0.1 + 1.9 * easeInOutCubic(localProgress / 0.6);
          } else if (localProgress < 0.85) {
            spd = 2.0;
          } else {
            spd = 2.0 * (1 - easeInOutCubic((localProgress - 0.85) / 0.15));
          }
          starfieldRef.current?.SetSpeed(spd);
        }
      } else {
        // Fade-in (reverse)
        const fiElapsed = clamped - timing.fadeOut - timing.effect;
        localProgress = fiElapsed / timing.fadeIn;
        opacity = 1 - easeInOutCubic(localProgress);
      }

      // Apply opacity directly to DOM — no React re-render
      if (containerRef.current) {
        containerRef.current.style.opacity = String(opacity);
      }

      // Draw canvas-based effects
      if (type === "vector-scanline" || type === "neon-grid-flip" || type === "asteroid-blast") {
        drawCanvasEffect(type, clamped, timing);
      }

      // Continue or finish
      if (clamped < totalDur) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Transition complete — single state update
        typeRef.current = null;
        if (containerRef.current) containerRef.current.style.opacity = "0";
        setCurrentTransition(null);
        setPhase("complete");
      }
    }, []);

    // --- Canvas effect drawing (scanline / grid / asteroid) ---
    const drawCanvasEffect = (type: TransitionType, elapsed: number, timing: typeof DURATIONS["vector-scanline"]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Resize canvas to match viewport
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const inEffect = elapsed >= timing.fadeOut && elapsed < timing.fadeOut + timing.effect;
      const effProgress = inEffect
        ? (elapsed - timing.fadeOut) / timing.effect
        : elapsed >= timing.fadeOut + timing.effect ? 1 : 0;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (type === "vector-scanline") drawScanlines(ctx, canvas, effProgress, inEffect);
      else if (type === "neon-grid-flip") drawNeonGrid(ctx, canvas, effProgress);
      else if (type === "asteroid-blast") drawAsteroidBlast(ctx, canvas, effProgress, inEffect);
    };

    // --- Individual canvas effects (unchanged visuals) ---
    const drawScanlines = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, progress: number, inEffect: boolean) => {
      const scanlineHeight = 4;
      const speed = 800;
      const scanlineY = progress * speed;

      ctx.fillStyle = "rgba(0, 255, 255, 0.8)";
      ctx.fillRect(0, scanlineY - scanlineHeight, canvas.width, scanlineHeight * 2);

      if (inEffect) {
        const imageData = ctx.getImageData(0, 0, canvas.width, Math.min(scanlineY, canvas.height));
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() > 0.95) {
            const noise = Math.random() * 255;
            data[i] = noise;
            data[i + 1] = noise;
            data[i + 2] = noise;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
    };

    const drawNeonGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, flipProgress: number) => {
      const gridSize = 50;
      ctx.strokeStyle = `hsl(180 100% 50% / ${0.6 * (1 - Math.abs(flipProgress - 0.5) * 2)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      const scaleY = Math.cos(flipProgress * Math.PI);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(1, Math.abs(scaleY) * 0.3 + 0.7);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      ctx.restore();
    };

    const drawAsteroidBlast = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, blastProgress: number, inEffect: boolean) => {
      const numParticles = 50;
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
      if (inEffect && blastProgress > 0.7) {
        const flashAlpha = Math.sin((blastProgress - 0.7) * Math.PI / 0.3);
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.6})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Cleanup
    useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

    if (!isActive) return null;

    return (
      <div
        ref={containerRef}
        className={`fixed inset-0 z-50 pointer-events-none ${className}`}
        style={{ opacity: 0 }}
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

        {/* Wormhole Portal */}
        {currentTransition === "wormhole-portal" && (
          <VectorWormholeLite
            ref={wormholeRef}
            active={true}
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
            style={{ imageRendering: "pixelated" }}
          />
        )}
      </div>
    );
  }
);

GameTransition.displayName = "GameTransition";
