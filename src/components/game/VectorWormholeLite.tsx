import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";

export interface VectorWormholeLiteHandle {
  Play: () => void;
  Stop: () => void;
  SetSpeed: (s: number) => void;
}

interface Props {
  active?: boolean;
  loop?: boolean;
  cx?: number;
  cy?: number;
  speed?: number;
  className?: string;
}

interface Ring {
  z: number;
  speed: number;
  hueOffset: number;
  rotAngle: number;
  rotSpeed: number;
}

const TAU = Math.PI * 2;
const RING_COUNT = 28;
const NEAR = 0.06;
const FAR = 3.0;
const FOCAL = 380;
const BASE_RADIUS = 0.55;

function makeRing(i: number, total: number): Ring {
  return {
    z: NEAR + (i / total) * (FAR - NEAR),
    speed: 0.4 + Math.random() * 0.25,
    hueOffset: (i / total) * 360,
    rotAngle: Math.random() * TAU,
    rotSpeed: (0.15 + Math.random() * 0.3) * (Math.random() > 0.5 ? 1 : -1),
  };
}

export const VectorWormholeLite = forwardRef<VectorWormholeLiteHandle, Props>(
  ({ active = false, loop = true, cx = 0.5, cy = 0.5, speed = 1, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef(0);
    const ringsRef = useRef<Ring[]>([]);
    const runningRef = useRef(active);
    const speedRef = useRef(speed);
    const startRef = useRef(0);

    // Cache neon hue from CSS once
    const neonHueRef = useRef(280);
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
      SetSpeed: (s: number) => { speedRef.current = s; },
    }));

    useEffect(() => { runningRef.current = active; }, [active]);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    const initRings = useCallback(() => {
      ringsRef.current = Array.from({ length: RING_COUNT }, (_, i) => makeRing(i, RING_COUNT));
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      startRef.current = performance.now();
      initRings();

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
        const spd = speedRef.current;

        const p = canvas.parentElement;
        const w = p?.clientWidth || window.innerWidth;
        const h = p?.clientHeight || window.innerHeight;

        // Wobble center
        const wobbleX = Math.sin(elapsed * 0.7) * 8;
        const wobbleY = Math.cos(elapsed * 0.5) * 6;
        const centerX = w * cx + wobbleX;
        const centerY = h * cy + wobbleY;

        const baseHue = neonHueRef.current;
        const hueTime = elapsed * 30; // slow rotation through spectrum

        // Clear
        ctx.fillStyle = "#030712";
        ctx.fillRect(0, 0, w, h);

        // Central glow — single radial gradient, pulsing
        const pulse = 0.7 + 0.3 * Math.sin(elapsed * 1.8);
        const glowR = 70 * pulse;
        const coreHue = (baseHue + hueTime) % 360;

        const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowR * 2.5);
        glow.addColorStop(0, `hsla(${coreHue}, 80%, 90%, 0.45)`);
        glow.addColorStop(0.25, `hsla(${coreHue}, 90%, 65%, 0.25)`);
        glow.addColorStop(0.6, `hsla(${coreHue}, 100%, 50%, 0.08)`);
        glow.addColorStop(1, `hsla(${coreHue}, 100%, 50%, 0)`);
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowR * 2.5, 0, TAU);
        ctx.fillStyle = glow;
        ctx.fill();

        // Update & draw rings (far-to-near is natural since we process in z-order)
        const rings = ringsRef.current;
        for (let i = 0; i < rings.length; i++) {
          const r = rings[i];

          // Advance toward viewer
          r.z -= r.speed * spd * dt;
          r.rotAngle += r.rotSpeed * spd * dt;

          // Respawn
          if (r.z < NEAR) {
            if (!loop) continue;
            r.z = FAR - (NEAR - r.z);
            r.hueOffset = Math.random() * 360;
          }

          const scale = FOCAL / r.z;
          const screenR = BASE_RADIUS * scale;

          if (screenR < 3 || screenR > Math.max(w, h) * 1.5) continue;

          // Depth-based alpha: rings closer are brighter
          const depthNorm = 1 - (r.z - NEAR) / (FAR - NEAR); // 0 = far, 1 = near
          const alpha = 0.08 + depthNorm * 0.55;
          const lineW = 1 + depthNorm * 3;

          const hue = (r.hueOffset + hueTime) % 360;

          // Ring stroke
          ctx.beginPath();
          ctx.arc(centerX, centerY, screenR, 0, TAU);
          ctx.strokeStyle = `hsla(${hue}, 85%, 60%, ${alpha})`;
          ctx.lineWidth = lineW;
          ctx.stroke();

          // Draw a few bright dots on ring for sparkle (4 dots, very cheap)
          if (depthNorm > 0.15) {
            const dotAlpha = alpha * 0.9;
            const dotSize = lineW * 1.2;
            for (let d = 0; d < 4; d++) {
              const angle = r.rotAngle + (d / 4) * TAU;
              const dx = centerX + Math.cos(angle) * screenR;
              const dy = centerY + Math.sin(angle) * screenR;
              ctx.beginPath();
              ctx.arc(dx, dy, dotSize, 0, TAU);
              ctx.fillStyle = `hsla(${hue}, 60%, 88%, ${dotAlpha})`;
              ctx.fill();
            }
          }
        }

        // Vignette
        const maxR = Math.max(w, h) * 0.75;
        const vig = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxR);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(0.55, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.7)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      };

      rafRef.current = requestAnimationFrame(frame);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener("resize", resize);
      };
    }, [cx, cy, loop, initRings]);

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

VectorWormholeLite.displayName = "VectorWormholeLite";
export default VectorWormholeLite;
