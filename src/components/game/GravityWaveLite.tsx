import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";

export interface GravityWaveLiteHandle {
  Play: () => void;
  Stop: () => void;
  SetSeed: (_s: number) => void;   // no-op, kept for compat
  PulseNow: () => void;            // no-op, kept for compat
}

interface Props {
  active?: boolean;
  preset?: "Calm" | "Normal" | "Storm";
  cx?: number;
  cy?: number;
  className?: string;
}

interface Ring {
  phase: number;      // radial phase offset
  baseRadius: number; // normalised 0-1
  hueOffset: number;
  speed: number;      // expansion speed multiplier
}

interface Spoke {
  angle: number;
  hueOffset: number;
  pulsePhase: number;
}

const TAU = Math.PI * 2;
const RING_COUNT = 24;
const SPOKE_COUNT = 16;

const PRESET_SPEED: Record<string, number> = { Calm: 0.6, Normal: 1, Storm: 1.5 };

function makeRing(i: number, total: number): Ring {
  return {
    phase: (i / total) * TAU,
    baseRadius: 0.04 + (i / total) * 0.96,
    hueOffset: (i / total) * 360,
    speed: 0.8 + Math.random() * 0.4,
  };
}

function makeSpoke(i: number, total: number): Spoke {
  return {
    angle: (i / total) * TAU,
    hueOffset: (i / total) * 360,
    pulsePhase: Math.random() * TAU,
  };
}

export const GravityWaveLite = forwardRef<GravityWaveLiteHandle, Props>(
  ({ active = false, preset = "Normal", cx = 0.5, cy = 0.5, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef(0);
    const ringsRef = useRef<Ring[]>([]);
    const spokesRef = useRef<Spoke[]>([]);
    const runningRef = useRef(active);
    const startRef = useRef(0);

    // Cache neon hue
    const neonHueRef = useRef(180);
    useEffect(() => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--neon");
      if (raw) {
        const m = raw.match(/(\d+)/);
        if (m) neonHueRef.current = parseInt(m[1], 10);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      Play: () => { runningRef.current = true; },
      Stop: () => { runningRef.current = false; },
      SetSeed: () => {},
      PulseNow: () => {},
    }));

    useEffect(() => { runningRef.current = active; }, [active]);

    const init = useCallback(() => {
      ringsRef.current = Array.from({ length: RING_COUNT }, (_, i) => makeRing(i, RING_COUNT));
      spokesRef.current = Array.from({ length: SPOKE_COUNT }, (_, i) => makeSpoke(i, SPOKE_COUNT));
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      startRef.current = performance.now();
      init();

      const speedMul = PRESET_SPEED[preset] ?? 1;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const p = canvas.parentElement;
        const w = p?.clientWidth || window.innerWidth;
        const h = p?.clientHeight || window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      window.addEventListener("resize", resize);

      let last = performance.now();

      const frame = (now: number) => {
        rafRef.current = requestAnimationFrame(frame);
        if (!runningRef.current) return;

        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const elapsed = (now - startRef.current) / 1000;

        const p = canvas.parentElement;
        const w = p?.clientWidth || window.innerWidth;
        const h = p?.clientHeight || window.innerHeight;
        const maxDim = Math.max(w, h);

        // Wobble center
        const wobbleX = Math.sin(elapsed * 0.55) * 6;
        const wobbleY = Math.cos(elapsed * 0.4) * 5;
        const centerX = w * cx + wobbleX;
        const centerY = h * cy + wobbleY;

        const baseHue = neonHueRef.current;
        const hueTime = elapsed * 25;

        // Clear
        ctx.fillStyle = "#030712";
        ctx.fillRect(0, 0, w, h);

        // Central pulsing glow
        const pulse = 0.65 + 0.35 * Math.sin(elapsed * 2.2);
        const glowR = 90 * pulse;
        const coreHue = (baseHue + hueTime) % 360;

        const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowR * 3);
        glow.addColorStop(0, `hsla(${coreHue}, 85%, 92%, 0.5)`);
        glow.addColorStop(0.2, `hsla(${coreHue}, 90%, 70%, 0.3)`);
        glow.addColorStop(0.5, `hsla(${(coreHue + 40) % 360}, 100%, 55%, 0.1)`);
        glow.addColorStop(1, `hsla(${coreHue}, 100%, 50%, 0)`);
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowR * 3, 0, TAU);
        ctx.fillStyle = glow;
        ctx.fill();

        // Draw spokes — radial lines from center to edges
        const spokeLen = maxDim * 0.75;
        for (let i = 0; i < spokesRef.current.length; i++) {
          const s = spokesRef.current[i];
          const spokeAlpha = 0.06 + 0.08 * Math.sin(elapsed * 1.5 + s.pulsePhase);
          const spokeHue = (s.hueOffset + hueTime) % 360;

          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(
            centerX + Math.cos(s.angle + elapsed * 0.08 * speedMul) * spokeLen,
            centerY + Math.sin(s.angle + elapsed * 0.08 * speedMul) * spokeLen
          );
          ctx.strokeStyle = `hsla(${spokeHue}, 75%, 55%, ${spokeAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Draw rings — expanding concentric circles with ripple
        const rings = ringsRef.current;
        for (let i = 0; i < rings.length; i++) {
          const r = rings[i];

          // Expand outward
          r.baseRadius += 0.12 * r.speed * speedMul * dt;
          if (r.baseRadius > 1.2) {
            r.baseRadius -= 1.16;
            r.hueOffset = Math.random() * 360;
          }

          const radius = r.baseRadius * maxDim * 0.65;
          // Sinusoidal ripple displacement
          const ripple = Math.sin(elapsed * 3 + r.phase) * 8 * speedMul;
          const finalR = Math.max(radius + ripple, 2);

          // Alpha: fade in from center, fade out at edges
          const norm = r.baseRadius;
          const alpha = norm < 0.15
            ? norm / 0.15 * 0.5
            : norm > 0.9
              ? (1.2 - norm) / 0.3 * 0.5
              : 0.12 + 0.38 * (1 - Math.abs(norm - 0.5) * 2);

          const hue = (r.hueOffset + hueTime) % 360;
          const lineW = 1 + (1 - norm) * 2.5;

          ctx.beginPath();
          ctx.arc(centerX, centerY, finalR, 0, TAU);
          ctx.strokeStyle = `hsla(${hue}, 80%, 58%, ${alpha})`;
          ctx.lineWidth = lineW;
          ctx.stroke();
        }

        // Vignette
        const vigR = maxDim * 0.8;
        const vig = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, vigR);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(0.5, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      };

      rafRef.current = requestAnimationFrame(frame);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener("resize", resize);
      };
    }, [cx, cy, preset, init]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        aria-hidden="true"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />
    );
  }
);

GravityWaveLite.displayName = "GravityWaveLite";
export default GravityWaveLite;
