import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { anyGamepad, getLastDeviceId, loadProfile, readGamepad } from "@/hooks/use-gamepad";

export type HyperspaceStarfieldHandle = {
  SetSpeed: (v: number) => void;
  SetDensity: (n: number) => void;
  SetVanishingPoint: (cx: number, cy: number) => void;
  SetSeed: (seed: number) => void;
  PulseWarp: (duration: number, peakSpeed?: number) => void;
};

export type HyperspaceStarfieldProps = {
  speed?: number; // 0..1
  density?: number; // 100..3000
  focalLength?: number; // perspective strength in px
  trail?: number; // 0..1
  style?: "vector" | "glow" | "crt";
  cx?: number; // 0..1 relative
  cy?: number; // 0..1 relative
  allowBoost?: boolean; // allow gamepad/keyboard to trigger warp boost
  className?: string;
  lowGraphics?: boolean; // optimize for performance
};

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HyperspaceStarfield = forwardRef<HyperspaceStarfieldHandle, HyperspaceStarfieldProps>(
  ({ speed = 0.35, density = 1200, focalLength = 560, trail = 0.4, style = "glow", cx, cy, allowBoost = true, className, lowGraphics = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const seedRef = useRef<number>(123456789);
    const boostRef = useRef<{ t: number; d: number; peak: number }>({ t: 0, d: 0, peak: 1 });
    const startTimeRef = useRef<number>(performance.now());
    
    // Reduce initial density for low graphics mode
    const effectiveDensity = lowGraphics ? 400 : density;
    const opts = useRef({ speed, density: effectiveDensity, focalLength, trail, style, cx, cy });

    // internal state
    const starCountRef = useRef(0);
    const arrRef = useRef<{ x: Float32Array; y: Float32Array; z: Float32Array; px: Float32Array; py: Float32Array; tw: Float32Array; ph: Float32Array } | null>(null);
    const vpRef = useRef({ cx: 0.5, cy: 0.5 });
    const perfRef = useRef({ lowMsFor: 0, highMsFor: 0, target: effectiveDensity, floor: 200, ceil: 3200 });
    const smoothSpeedRef = useRef(0);

    useImperativeHandle(ref, () => ({
      SetSpeed: (v) => { opts.current.speed = Math.max(0, Math.min(1, v)); },
      SetDensity: (n) => { perfRef.current.target = Math.max(50, Math.min(4000, Math.floor(n))); reinitStars(); },
      SetVanishingPoint: (x, y) => { vpRef.current.cx = x; vpRef.current.cy = y; },
      SetSeed: (s) => { seedRef.current = s >>> 0; reinitStars(); },
      PulseWarp: (duration, peakSpeed = 1) => { boostRef.current = { t: 0, d: Math.max(0.1, duration), peak: Math.max(0.6, Math.min(1, peakSpeed)) }; },
    }));

    // Resize and (re)init stars
    const reinitStars = (preserveSpeed = false) => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.floor(c.clientWidth * dpr);
      c.height = Math.floor(c.clientHeight * dpr);
      const N = Math.max(50, Math.floor(perfRef.current.target));
      starCountRef.current = N;
      const x = new Float32Array(N);
      const y = new Float32Array(N);
      const z = new Float32Array(N);
      const px = new Float32Array(N);
      const py = new Float32Array(N);
      const tw = new Float32Array(N);
      const ph = new Float32Array(N);
      arrRef.current = { x, y, z, px, py, tw, ph };
      
      // Only reset speed on initial mount, preserve during auto-tune/resize
      if (!preserveSpeed) {
        smoothSpeedRef.current = 0;
      }
      
      const rng = mulberry32(seedRef.current);
      const near = 0.05, far = 1.2; // normalized camera z-range
      const w = c.clientWidth, h = c.clientHeight;
      const cxPx = 0.5 * w, cyPx = 0.5 * h;
      const fl = opts.current.focalLength;
      
      for (let i = 0; i < N; i++) {
        x[i] = (rng() * 2 - 1) * 1.2; // spawn in generous cube
        y[i] = (rng() * 2 - 1) * 1.2;
        z[i] = near + rng() * (far - near);
        // Initialize previous positions to actual projected coords for smooth first-frame trails
        px[i] = cxPx + (x[i] / z[i]) * fl;
        py[i] = cyPx + (y[i] / z[i]) * fl;
        tw[i] = 0.5 + rng() * 1.5;
        ph[i] = rng() * Math.PI * 2;
      }
    };

    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = Math.floor(c.clientWidth * dpr);
        c.height = Math.floor(c.clientHeight * dpr);
      };
      resize();
      
      // Debounced resize to prevent rapid reinits
      let resizeRaf: number | undefined;
      const debouncedResize = () => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          resize();
          reinitStars(true); // preserve speed on resize
        });
      };
      window.addEventListener("resize", debouncedResize);

      reinitStars(false); // initial mount - don't preserve speed

      let last = performance.now();
      let fpsWindow: number[] = [];
      let styleIdx = style === "vector" ? 0 : style === "glow" ? 1 : 2;
      let lastGpId: string | null = getLastDeviceId();
      let gpProfile = loadProfile(lastGpId || undefined);
      // Neon palette from CSS vars for gentle color cycling
      const styles = getComputedStyle(document.documentElement);
      const parseHslVar = (name: string) => {
        try {
          const value = styles.getPropertyValue(name).trim();
          if (!value) return [280, 70, 60]; // fallback neon purple
          const parts = value.split(/\s+/).map(v => parseFloat(v.replace('%','')));
          if (parts.length >= 3 && parts.every(p => !isNaN(p))) return parts;
          return [280, 70, 60]; // fallback on invalid data
        } catch {
          return [280, 70, 60]; // fallback on error
        }
      };
      const neonPalette = ['--neon-p1','--neon-p2','--neon-p3','--neon-p4','--neon-p5','--neon-p6'].map(v => parseHslVar(v));
      const lerpHue = (a: number, b: number, t: number) => { const d = ((b - a + 540) % 360) - 180; return a + d * t; };

      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;

        // Gamepad boost (hold select)
        const gp = anyGamepad?.();
        if (gp && gp.connected) {
          if (lastGpId !== gp.id) { lastGpId = gp.id; gpProfile = loadProfile(gp.id); }
          const input = readGamepad(gp, gpProfile);
          if (allowBoost && input.ui.select) { boostRef.current = { t: 0, d: 0.2, peak: Math.min(0.2, opts.current.speed + 0.03) }; }
        }

        // Keyboard controls
        // Shift/B boosts briefly; S cycles style
        // We use key state via event listeners to keep code light
        // (handled below only on keydown)

        // Performance auto-tune (with startup grace period)
        fpsWindow.push(dt);
        if (fpsWindow.length > 30) fpsWindow.shift();
        const timeSinceStart = now - startTimeRef.current;
        
        // Skip auto-tuning during startup grace period (first 1.5 seconds)
        if (timeSinceStart > 1500) {
          const avgMs = (fpsWindow.reduce((a, b) => a + b, 0) / Math.max(1, fpsWindow.length)) * 1000;
          const p = perfRef.current;
          if (avgMs > 18.2) { // < ~55 fps
            p.lowMsFor += dt;
            p.highMsFor = Math.max(0, p.highMsFor - dt);
            // Less aggressive: wait 0.6s instead of 0.3s before reducing
            if (p.lowMsFor > 0.6 && p.target > p.floor) { p.target = Math.max(p.floor, Math.floor(p.target * 0.9)); reinitStars(true); p.lowMsFor = 0; }
          } else {
            p.highMsFor += dt;
            p.lowMsFor = Math.max(0, p.lowMsFor - dt * 2);
            // Less aggressive: wait 2.0s instead of 1.2s before increasing
            if (p.highMsFor > 2.0 && p.target < opts.current.density) { p.target = Math.min(opts.current.density, Math.floor(p.target * 1.08 + 12)); reinitStars(true); p.highMsFor = 0; }
          }
        }

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = c.clientWidth, h = c.clientHeight;
        const cxPx = (opts.current.cx ?? vpRef.current.cx) * w;
        const cyPx = (opts.current.cy ?? vpRef.current.cy) * h;

        // Warp boost easing
        // Warp boost easing with smoothed base speed to avoid initial bursts
        const boost = boostRef.current;
        const targetSpeed = Math.max(0, Math.min(1, opts.current.speed));
        // Exponential smoothing towards target
        const alpha = 1 - Math.exp(-dt * 3); // ~300ms time constant
        let nextBase = smoothSpeedRef.current + (targetSpeed - smoothSpeedRef.current) * alpha;
        // Additional rate limiting to clamp sudden ramps (prevents initial burst)
        const maxRatePerSec = 0.6; // max change per second
        const delta = nextBase - smoothSpeedRef.current;
        const clampedDelta = Math.sign(delta) * Math.min(Math.abs(delta), maxRatePerSec * dt);
        const baseSpeed = smoothSpeedRef.current + clampedDelta;
        smoothSpeedRef.current = baseSpeed;
        let speed01 = baseSpeed;
        if (boost.d > 0) {
          boost.t += dt;
          const u = Math.min(1, boost.t / boost.d);
          const ease = u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u;
          speed01 = speed01 + (boost.peak - speed01) * ease;
          if (boost.t >= boost.d) boost.d = 0;
        }

        const fl = opts.current.focalLength;
        const trailLen = Math.max(0, Math.min(1, opts.current.trail)) * (0.5 + 0.5 * speed01);
        const arr = arrRef.current;
        if (!arr) return;
        const N = starCountRef.current;

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);

        // subtle vignette
        const vign = ctx.createRadialGradient(cxPx, cyPx, 0, cxPx, cyPx, Math.max(w, h) * 0.75);
        vign.addColorStop(0, "rgba(0,0,0,0)");
        vign.addColorStop(1, "rgba(0,0,0,0.35)");
        ctx.fillStyle = vign;
        ctx.fillRect(0, 0, w, h);

        const near = 0.05, far = 1.2;
        const baseZRate = 1.1; // base units/sec (halved)
        const zRate = baseZRate * (0.25 + speed01 * 1.75);

        // Neon color cycle blended by speed towards brighter/whiter
        const tsec = now / 1000;
        const cycleDur = 18; // seconds for full palette loop
        const uCycle = (tsec / cycleDur) % 1;
        const segF = uCycle * neonPalette.length;
        const segIdx = Math.floor(segF);
        const segT = segF - segIdx;
        const c0 = neonPalette[segIdx];
        const c1 = neonPalette[(segIdx + 1) % neonPalette.length];
        let baseHue = lerpHue(c0[0], c1[0], segT);
        let baseSat = c0[1] + (c1[1] - c0[1]) * segT;
        let baseLight = c0[2] + (c1[2] - c0[2]) * segT;
        const tcol = Math.min(1, Math.max(0, speed01));
        baseSat = baseSat * (1 - 0.5 * tcol);
        baseLight = Math.min(88, baseLight + 10 * tcol);
        const color = `hsl(${baseHue} ${baseSat}% ${baseLight}%)`;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Draw batched
        ctx.save();
        if (styleIdx === 1 && !lowGraphics) {
          // Glow (only if not in low graphics mode)
          ctx.shadowColor = color as any;
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = color as any;
        ctx.globalAlpha = 1;

        const margin = 80;
        for (let i = 0; i < N; i++) {
          let zx = arr.x[i], zy = arr.y[i], zz = arr.z[i];
          // advance
          zz -= zRate * dt;
          // projection
          const sx = cxPx + (zx / zz) * fl;
          const sy = cyPx + (zy / zz) * fl;
          const psx = arr.px[i] || sx;
          const psy = arr.py[i] || sy;
          const dx = sx - psx, dy = sy - psy;
          const len = Math.hypot(dx, dy);
          const maxL = 12 + trailLen * 140;
          const k = len > 1e-3 ? Math.min(1, maxL / len) : 1;
          const ex = sx - dx * (1 - k);
          const ey = sy - dy * (1 - k);

          // draw
          if (styleIdx === 0) {
            ctx.lineWidth = 1;
          } else if (styleIdx === 1) {
            ctx.lineWidth = Math.max(1.5, Math.min(3.5, (1 / zz) * 1.2));
          } else {
            // CRT
            ctx.lineWidth = 1.25;
            // subtle scanline shimmer
            const scan = 0.85 + 0.15 * Math.sin((sy + now * 0.06) * 0.12);
            ctx.globalAlpha = scan;
          }
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.globalAlpha = 1;

          // respawn if too close or off-screen
          if (zz <= near || sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) {
            const rng = mulberry32((seedRef.current + i * 1013904223) >>> 0);
            zx = (rng() * 2 - 1) * 1.1;
            zy = (rng() * 2 - 1) * 1.1;
            zz = far;
            arr.px[i] = cxPx + (zx / zz) * fl;
            arr.py[i] = cyPx + (zy / zz) * fl;
          } else {
            arr.px[i] = sx;
            arr.py[i] = sy;
          }
          arr.x[i] = zx; arr.y[i] = zy; arr.z[i] = zz;
        }
        ctx.restore();
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Shift" || e.key === "b" || e.key === "B") {
          // Limit boost to small nudge only; prevent spikes
          const peak = Math.min(0.22, Math.max(0.05, opts.current.speed + 0.02));
          boostRef.current = { t: 0, d: 0.25, peak };
        }
      };
      window.addEventListener("keydown", onKey);

      rafRef.current = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener("keydown", onKey);
      };
    }, []);

    return <canvas ref={canvasRef} className={"absolute inset-0 w-full h-full " + (className || "")} aria-hidden />;
  }
);
