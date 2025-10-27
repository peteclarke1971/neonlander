import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type GravityWavePreset = "Calm" | "Normal" | "Storm";

export interface GravityWaveParams {
  // Animation
  speed: number; // cycles/sec
  amplitude: number; // geometric ripple height (0-1)
  wavelength: number; // normalized (0-1) relative to minDim
  warpStrength: number; // 0-1
  gridDensity: number; // divisions along radial/azimuth
  noiseAmount: number; // 0-1
  colorMode: "cyan" | "green" | "amber" | "two-tone" | "theme" | "rainbow";
  glow: number; // 0-1
  affectGameplay: boolean;
  // Motion extras (optional)
  tunnelSpeed?: number; // px/sec scale factor for outward flow
  rotateSpeed?: number; // radians/sec, slow spin
  twistStrength?: number; // 0-1 additional curvature
  // Camera alignment
  focalLength?: number; // in px
  cx?: number; // 0..1
  cy?: number; // 0..1
  // Seeding
  baseSeed?: number;
  modeName?: string;
  levelIndex?: number;
  instanceId?: number;
  seedOverride?: number | string;
}

export interface GravityWaveHandle {
  Play: (params?: Partial<GravityWaveParams> | GravityWavePreset) => void;
  Set: <K extends keyof GravityWaveParams>(key: K, value: GravityWaveParams[K]) => void;
  Stop: () => void;
  SetSeed: (seed: number | string) => void;
  PulseNow: () => void;
  CyclePreset: () => void;
}

export interface GravityDistortionWaveProps extends Partial<GravityWaveParams> {
  active?: boolean;
  preset?: GravityWavePreset;
  className?: string;
}

// Mulberry32 PRNG
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// String/number seeding mixer
function mixSeed(...parts: Array<string | number | undefined>) {
  const s = parts.filter(v => v !== undefined).join("::");
  let h = 2166136261 >>> 0; // FNV-1a basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Default presets
const PRESETS: Record<GravityWavePreset, GravityWaveParams> = {
  Calm: {
    speed: 0.22,
    amplitude: 0.35,
    wavelength: 0.35,
    warpStrength: 0.45,
    gridDensity: 24,
    noiseAmount: 0.08,
    colorMode: "cyan",
    glow: 0.6,
    affectGameplay: false,
  },
  Normal: {
    speed: 0.35,
    amplitude: 0.6,
    wavelength: 0.28,
    warpStrength: 0.75,
    gridDensity: 32,
    noiseAmount: 0.15,
    colorMode: "cyan",
    glow: 0.85,
    affectGameplay: false,
  },
  Storm: {
    speed: 0.5,
    amplitude: 0.85,
    wavelength: 0.22,
    warpStrength: 0.95,
    gridDensity: 42,
    noiseAmount: 0.2,
    colorMode: "two-tone",
    glow: 1.0,
    affectGameplay: false,
  },
};

// Helper: prefers-reduced-motion
const motionReduce = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;

export const GravityDistortionWave = forwardRef<GravityWaveHandle, GravityDistortionWaveProps>(function GravityDistortionWave(
  { active = true, preset = "Normal", className, ...overrides },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // final composed output
  const bgRef = useRef<HTMLCanvasElement>(null); // starfield source

  // Internal state (refs only, no per-frame allocations)
  const paramsRef = useRef<GravityWaveParams>({ ...PRESETS[preset], ...overrides });
  const runningRef = useRef<boolean>(false);
  const initialSeed = (() => {
    const p = paramsRef.current;
    const s = p.seedOverride !== undefined ? p.seedOverride : mixSeed(p.baseSeed ?? 0, "GRAVITY_WAVE", p.modeName ?? "", p.levelIndex ?? 0, p.instanceId ?? 0);
    return typeof s === "number" ? (s >>> 0) : mixSeed(String(s));
  })();
  const seedRef = useRef<number>(initialSeed);
  const randRef = useRef(mulberry32(seedRef.current));

  const gridBuiltRef = useRef<boolean>(false);
  const lastTRef = useRef<number>(0);
  const fpsRef = useRef<{ frames: number; last: number; lowSince: number | null }>({ frames: 0, last: performance.now(), lowSince: null });
  const pulseRef = useRef<{ t0: number; dur: number; amp: number; warp: number } | null>(null);
  const nextPulseAtRef = useRef<number>(performance.now() + 4000 + (randRef.current() * 3000));
  const failSoftRef = useRef<{ warpOff: boolean }>({ warpOff: false });
  const rotPhaseRef = useRef<number>(0);
  const huePhaseRef = useRef<number>(0);
  const tunnelOffsetRef = useRef<number>(0);
  const firstBgDrawRef = useRef<boolean>(true);
  const trailUntilRef = useRef<number>(0);
  const nextTrailAtRef = useRef<number>(performance.now() + 3000 + (randRef.current() * 7000));
  // Starfield state (very light-weight)
  const starsRef = useRef<Float32Array | null>(null); // x,y,z triplets in NDC-ish space
  const starCountRef = useRef<number>(1200);
  const starfieldBuiltRef = useRef<boolean>(false);

  // Grid cache (polar lattice positions)
  const gridRef = useRef<{ rings: number; spokes: number; maxR: number; ringRs: Float32Array; spokeAngles: Float32Array } | null>(null);

  // Build/Rebuild grid and starfield on size/params change
  const buildScene = () => {
    const canvas = canvasRef.current!;
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    const minDim = Math.min(w, h);
    const bg = bgRef.current!;

    // Rebuild static starfield ONLY if not built or dimensions changed
    if (!starfieldBuiltRef.current || bg.width !== w || bg.height !== h) {
      bg.width = w;
      bg.height = h;
      
      // Render static starfield once
      const bgCtx = bg.getContext("2d", { alpha: false })!;
      bgCtx.fillStyle = "#000000";
      bgCtx.fillRect(0, 0, w, h);
      
      // Generate and draw all stars once
      const p = paramsRef.current;
      const numStars = motionReduce ? 400 : 1200;
      const rng = randRef.current;
      
      const cx = (p.cx ?? 0.5) * w;
      const cy = (p.cy ?? 0.5) * h;
      
      for (let i = 0; i < numStars; i++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * 1.0;
        const z = 0.2 + rng() * 0.8;
        
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const px = cx + x * (0.45 + 0.55 * z) * (w * 0.5);
        const py = cy + y * (0.45 + 0.55 * z) * (h * 0.5);
        
        const brightness = 0.3 + rng() * 0.7;
        const size = rng() < 0.95 ? 1 : 2;
        
        bgCtx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        bgCtx.fillRect(px, py, size, size);
      }
      
      starfieldBuiltRef.current = true;
    }

    // Grid
    const gd = Math.max(12, Math.floor(paramsRef.current.gridDensity));
    const rings = gd;
    const spokes = gd;
    const maxR = 0.92 * 0.5 * Math.hypot(w, h); // reach near corners by using half-diagonal
    const ringRs = new Float32Array(rings);
    for (let i = 0; i < rings; i++) {
      ringRs[i] = (i / (rings - 1)) * maxR;
    }
    const spokeAngles = new Float32Array(spokes);
    for (let i = 0; i < spokes; i++) {
      spokeAngles[i] = (i / spokes) * Math.PI * 2;
    }
    gridRef.current = { rings, spokes, maxR, ringRs, spokeAngles };

    gridBuiltRef.current = true;
  };

  const colorForMode = (alphaCore: number, alphaGlow: number) => {
    const p = paramsRef.current;
    const css = getComputedStyle(document.documentElement);
    const neon = css.getPropertyValue("--neon").trim() || "180 100% 55%"; // fallback cyan
    const neon2 = css.getPropertyValue("--neon-2").trim() || neon;

    if (p.colorMode === "rainbow") {
      // Parse H S% L% from CSS var to keep S/L anchored to theme
      const parts = neon.split(/\s+/);
      const baseH = parseFloat(parts[0] || "180");
      const s = parts[1] || "100%";
      const l = parts[2] || "55%";
      const h = (baseH + huePhaseRef.current) % 360;
      const h2 = (h + 35) % 360;
      return {
        core: `hsl(${h} ${s} ${l} / ${alphaCore})`,
        glow: `hsl(${h2} ${s} ${l} / ${alphaGlow})`,
      };
    }

    const map: Record<string, string> = {
      cyan: neon,
      green: "140 100% 55%",
      amber: "35 100% 55%",
      "two-tone": neon2,
      theme: neon,
    };
    const hsl = map[p.colorMode] || neon;
    return {
      core: `hsl(${hsl} / ${alphaCore})`,
      glow: `hsl(${hsl} / ${alphaGlow})`,
    };
  };

  const drawStars = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const bg = bgRef.current!;
    
    // Simply copy the static starfield from background canvas
    if (starfieldBuiltRef.current && bg.width === w && bg.height === h) {
      ctx.drawImage(bg, 0, 0);
    } else {
      // Fallback: solid black if starfield not ready
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
    }
  };

  const computePhase = (rPx: number, tSec: number) => {
    const p = paramsRef.current;
    const minDim = Math.min(canvasRef.current!.width, canvasRef.current!.height);
    const lambdaPx = Math.max(8, p.wavelength * minDim);
    const A = p.amplitude * (motionReduce ? 0.7 : 1);

    // Base traveling wave outward
    const phase = 2 * Math.PI * (rPx / lambdaPx - (p.speed * tSec));

    // Seeded phase offset, tiny
    const phi = (seedRef.current % 360) * (Math.PI / 180);

    // Small band-limited radial noise
    const pr = randRef.current();
    const noise = p.noiseAmount * (Math.sin(0.0009 * rPx + 2.3 * pr) + Math.sin(0.0013 * rPx + 1.7 * pr + phi)) * 0.5;

    return A * Math.sin(phase + phi) + noise;
  };

  const displacementVec = (dx: number, dy: number, rPx: number, tSec: number) => {
    const p = paramsRef.current;
    // Analytic gradient in radial direction (theta ignored for speed)
    const minDim = Math.min(canvasRef.current!.width, canvasRef.current!.height);
    const lambdaPx = Math.max(8, p.wavelength * minDim);
    const A = p.amplitude * (motionReduce ? 0.7 : 1);
    const dHdr = (A * (2 * Math.PI / lambdaPx)) * Math.cos(2 * Math.PI * (rPx / lambdaPx - p.speed * tSec));
    const falloff = 1 / (1 + (rPx / (0.35 * minDim)) ** 2); // strong near center
    const k = (motionReduce ? Math.min(0.6, p.warpStrength) : p.warpStrength) * 0.018; // scale to small fraction of screen
    const mag = k * dHdr * falloff;
    const len = Math.hypot(dx, dy) || 1;
    return { x: (dx / len) * mag * minDim, y: (dy / len) * mag * minDim };
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, tSec: number) => {
    const grid = gridRef.current!;
    const p = paramsRef.current;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cx = (p.cx ?? 0.5) * w;
    const cy = (p.cy ?? 0.5) * h;
    const { core, glow } = colorForMode(0.95, 0.28 * p.glow);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx, cy);
    // slow spin
    const ang = rotPhaseRef.current || 0;
    if (ang) ctx.rotate(ang);
    // subtle neon glow trails
    ctx.shadowColor = core as any;
    ctx.shadowBlur = 8 * p.glow;

    // tunnel outward offset (wrap by ring spacing)
    const step = grid.rings > 1 ? grid.ringRs[1] - grid.ringRs[0] : grid.maxR;
    const off = ((tunnelOffsetRef.current || 0) % (step || 1));

    // Rings
    for (let i = 0; i < grid.rings; i++) {
      const r0 = grid.ringRs[i] + off;
      const hgt = computePhase(r0, tSec);
      const wob = 1 + 0.15 * Math.sin(0.6 * tSec + r0 * 0.003 + (seedRef.current % 100) * 0.11);
      const rr = Math.max(1, (r0 + hgt * 22) * wob);

      // Glow ring
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Core ring
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.strokeStyle = core;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Spokes
    for (let i = 0; i < grid.spokes; i++) {
      const ang0 = grid.spokeAngles[i];
      const dx = Math.cos(ang0), dy = Math.sin(ang0);
      const r0 = 0;
      const r1 = grid.maxR + 24;

      // Apply displacement along the spoke for slight curvature + optional twist
      const mid = (r1 - r0) * 0.6 + off * 0.25;
      const hgt = computePhase(mid, tSec);
      const twist = (p.twistStrength ?? 0) * 40; // px
      const bend = hgt * 28 + twist * Math.sin(ang0 * 2 + tSec * 0.7);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dx * mid + (-dy) * bend, dy * mid + (dx) * bend, dx * r1, dy * r1);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dx * mid + (-dy) * bend, dy * mid + (dx) * bend, dx * r1, dy * r1);
      ctx.strokeStyle = core;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  };

  // Screen-space warp (CPU-friendly tile draw)
  const warpBackground = (dst: CanvasRenderingContext2D, src: HTMLCanvasElement, tSec: number) => {
    const p = paramsRef.current;
    if (failSoftRef.current.warpOff || p.warpStrength <= 0.001) {
      dst.drawImage(src, 0, 0);
      return;
    }

    const w = dst.canvas.width;
    const h = dst.canvas.height;
    const cx = (p.cx ?? 0.5) * w;
    const cy = (p.cy ?? 0.5) * h;

    // Tile size scales with resolution
    const tile = Math.max(6, Math.floor(Math.min(w, h) / 120));

    for (let y = 0; y < h; y += tile) {
      const yh = y + tile * 0.5;
      for (let x = 0; x < w; x += tile) {
        const xh = x + tile * 0.5;
        const dx = xh - cx;
        const dy = yh - cy;
        const r = Math.hypot(dx, dy);
        const d = displacementVec(dx, dy, r, tSec);

        // Clamp to <=1.5% of minDim
        const clamp = 0.015 * Math.min(w, h);
        const sx = Math.max(-clamp, Math.min(clamp, x - d.x));
        const sy = Math.max(-clamp, Math.min(clamp, y - d.y));

        dst.drawImage(src, sx, sy, tile, tile, x, y, tile, tile);
      }
    }
  };

  // Perf auto-governor
  const autoGovernor = (now: number) => {
    const fps = fpsRef.current;
    fps.frames++;
    if (now - fps.last >= 1000) {
      const rate = fps.frames / ((now - fps.last) / 1000);
      fps.frames = 0;
      fps.last = now;
      const p = paramsRef.current;
      if (rate < 55) {
        if (fps.lowSince == null) fps.lowSince = now;
        if (now - (fps.lowSince ?? 0) > 300) {
          p.gridDensity = Math.max(12, Math.floor(p.gridDensity * 0.8));
          p.amplitude = Math.max(0.3, p.amplitude * 0.85);
          p.warpStrength = Math.max(0.3, p.warpStrength * 0.85);
        }
      } else {
        fps.lowSince = null;
        // slow restore
        p.gridDensity = Math.min(p.gridDensity + 1, (PRESETS.Normal.gridDensity * 1.3) | 0);
        p.amplitude = Math.min(p.amplitude * 1.01, PRESETS.Storm.amplitude);
        p.warpStrength = Math.min(p.warpStrength * 1.01, PRESETS.Storm.warpStrength);
      }
    }
  };

  const step = (now: number) => {
    if (!runningRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const bg = bgRef.current!;
    const bgCtx = bg.getContext("2d")!;

    const tSec = now * 0.001;

    // Resize handling
    if (!gridBuiltRef.current || canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      buildScene();
    }

    // Draw background stars first and update dynamic phases
    const lastT = lastTRef.current || now;
    const dtSec = Math.min(0.05, (now - lastT) / 1000);
    lastTRef.current = now;

    // Update rainbow hue, rotation and tunnel
    const pDyn = paramsRef.current;
    huePhaseRef.current = (huePhaseRef.current + dtSec * (motionReduce ? 25 : 45)) % 360;
    const rotSpd = pDyn.rotateSpeed ?? 0;
    if (rotSpd) rotPhaseRef.current = (rotPhaseRef.current + dtSec * rotSpd) % (Math.PI * 2);
    const minDim = Math.min(canvas.width, canvas.height);
    const tSpd = pDyn.tunnelSpeed ?? 0;
    if (tSpd) tunnelOffsetRef.current = (tunnelOffsetRef.current + dtSec * tSpd * (minDim * 0.25)) % (gridRef.current?.maxR || (minDim * 0.45));

    drawStars(bgCtx, canvas.width, canvas.height);

    // Warp pass with optional afterimage trails
    if (now < trailUntilRef.current) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    try {
      warpBackground(ctx, bg, tSec);
    } catch {
      failSoftRef.current.warpOff = true;
      ctx.drawImage(bg, 0, 0);
    }

    // Grid pass
    drawGrid(ctx, tSec);

    // Pulses
    if (now >= nextPulseAtRef.current) {
      const dur = 900 + randRef.current() * 600; // 0.9-1.5s
      const amp = 0.2 + randRef.current() * 0.15; // +20-35%
      const warp = 0.2 + randRef.current() * 0.15;
      pulseRef.current = { t0: now, dur, amp, warp };
      nextPulseAtRef.current = now + 4000 + randRef.current() * 3000;
    }

    if (pulseRef.current) {
      const p = paramsRef.current;
      const { t0, dur, amp, warp } = pulseRef.current;
      const tt = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = easeInOut(tt);
      // Apply transient boosts (non-destructive)
      const baseA = PRESETS[preset].amplitude;
      const baseW = PRESETS[preset].warpStrength;
      p.amplitude = Math.min(baseA * (1 + amp * e), 1.2);
      p.warpStrength = Math.min(baseW * (1 + warp * e), 1.2);
      if (tt >= 1) pulseRef.current = null;
    }

    // Occasional neon trail mode
    if (now >= nextTrailAtRef.current) {
      nextTrailAtRef.current = now + 6000 + randRef.current() * 9000;
      trailUntilRef.current = now + 1000 + randRef.current() * 1500;
    }

    autoGovernor(now);

    requestAnimationFrame(step);
  };

  // Public API
  useImperativeHandle(ref, () => ({
    Play(arg?: Partial<GravityWaveParams> | GravityWavePreset) {
      if (typeof arg === "string") {
        paramsRef.current = { ...PRESETS[arg] };
      } else if (arg) {
        paramsRef.current = { ...PRESETS[preset], ...arg };
      }
      runningRef.current = true;
      // Seed from overrides if present
      const p = paramsRef.current;
      const mixed = p.seedOverride !== undefined
        ? (typeof p.seedOverride === "number" ? p.seedOverride : mixSeed(String(p.seedOverride)))
        : mixSeed(p.baseSeed ?? 0, "GRAVITY_WAVE", p.modeName ?? "", p.levelIndex ?? 0, p.instanceId ?? 0);
      seedRef.current = (mixed >>> 0);
      randRef.current = mulberry32(seedRef.current);

      // Seeded randomization for variation per run
      const rng = randRef.current;
      p.speed = Math.max(0.22, Math.min(0.9, p.speed * (0.75 + rng() * 0.8)));
      p.amplitude = Math.max(0.35, Math.min(1.2, p.amplitude * (0.7 + rng() * 0.9)));
      p.wavelength = Math.max(0.16, Math.min(0.45, p.wavelength * (0.7 + rng() * 0.6)));
      p.warpStrength = Math.max(0.4, Math.min(1.25, p.warpStrength * (0.75 + rng() * 0.8)));
      p.gridDensity = Math.max(18, Math.min(60, Math.floor(p.gridDensity * (0.85 + rng() * 0.55))));
      p.noiseAmount = Math.max(0.06, Math.min(0.3, p.noiseAmount * (0.8 + rng() * 0.6)));
      p.twistStrength = (rng() < 0.7) ? (0.2 + rng() * 0.6) : 0;
      p.rotateSpeed = (rng() < 0.8) ? (rng() * 0.6) : 0; // rad/s
      p.tunnelSpeed = 1.4 + rng() * 2.4; // relative speed
      // Alternate rainbow vs single neon (theme)
      // 50% chance to enable rainbow; otherwise stick to theme color
      if (rng() < 0.5) p.colorMode = "rainbow";

      starfieldBuiltRef.current = false; // Force starfield rebuild with new seed
      buildScene();
      requestAnimationFrame(step);
    },
    Set(key, value) {
      (paramsRef.current as any)[key] = value as any;
    },
    Stop() {
      const start = performance.now();
      const p0 = { ...paramsRef.current };
      const fade = () => {
        const t = (performance.now() - start) / 400;
        if (t >= 1) { runningRef.current = false; return; }
        const k = 1 - t;
        paramsRef.current = { ...p0, amplitude: p0.amplitude * k, warpStrength: p0.warpStrength * k };
        requestAnimationFrame(fade);
      };
      fade();
    },
    SetSeed(seed) {
      const v = typeof seed === "number" ? seed : mixSeed(String(seed));
      seedRef.current = v >>> 0;
      randRef.current = mulberry32(seedRef.current);
      starfieldBuiltRef.current = false; // Force starfield rebuild
      buildScene();
    },
    PulseNow() {
      const now = performance.now();
      pulseRef.current = { t0: now, dur: 1000, amp: 0.35, warp: 0.3 };
      nextPulseAtRef.current = now + 5000;
    },
    CyclePreset() {
      const order: GravityWavePreset[] = ["Calm", "Normal", "Storm"];
      const cur = order.findIndex(p => {
        const base = PRESETS[p];
        const curP = paramsRef.current;
        return Math.abs(base.speed - curP.speed) < 1e-3 && Math.abs(base.amplitude - curP.amplitude) < 1e-3;
      });
      const next = order[(cur + 1) % order.length];
      paramsRef.current = { ...PRESETS[next] };
    },
  }));

  // Mount / unmount
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onResize = () => {
      if (!canvas) return;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gridBuiltRef.current = false;
      starfieldBuiltRef.current = false; // Force starfield rebuild on resize
    };
    onResize();
    window.addEventListener("resize", onResize);

    const onKey = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "F8") {
        // Replay with same seed
        console.log("[GW] replay", { seed: seedRef.current });
        randRef.current = mulberry32(seedRef.current);
        buildScene();
      }
      if (e.key === "F9") {
        (ref as any)?.current?.PulseNow?.();
      }
      if (e.key === "F10") {
        const p = paramsRef.current;
        console.log("[GW] perf", { gridDensity: p.gridDensity, warpStrength: p.warpStrength, preset, seed: seedRef.current });
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      runningRef.current = false;
    };
  }, [active]);

  // Auto-start/stop based on active
  useEffect(() => {
    if (active) {
      runningRef.current = true;
      buildScene();
      requestAnimationFrame(step);
    } else {
      runningRef.current = false;
    }
  }, [active, preset]);

  return (
    <div ref={containerRef} className={"absolute inset-0 " + (className || "")}
      aria-hidden>
      <canvas ref={canvasRef} className="block w-full h-full" />
      <canvas ref={bgRef} className="hidden" />
      {/* Fail-soft flag (debug only) */}
      {/* <div className="absolute top-2 right-2 text-[10px] text-foreground/60">{failSoftRef.current.warpOff ? "warp off" : ""}</div> */}
    </div>
  );
});

export default GravityDistortionWave;
