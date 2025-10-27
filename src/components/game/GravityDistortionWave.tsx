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
  colorMode: "cyan" | "green" | "amber" | "two-tone" | "theme" | "rainbow" | "dual-rainbow";
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
  // Enhanced effects
  energyBursts?: boolean; // default true
  centerVortex?: boolean; // default true
  chromaticPulse?: boolean; // default true
  spokeTwinkle?: boolean; // default true
  trailColorMode?: 'black' | 'hue-tinted'; // default 'hue-tinted'
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
  const trailIntensityRef = useRef<number>(0.18); // Pulsing trail alpha
  const nextTrailAtRef = useRef<number>(performance.now() + 3000 + (randRef.current() * 2000));
  const saturationPhaseRef = useRef<number>(85); // Pulsing saturation 85-100%
  
  // Energy burst system
  const energyBurstsRef = useRef<Array<{ angle: number; distance: number; speed: number; createdAt: number; duration: number; hueOffset: number }>>([]);
  const nextBurstAtRef = useRef<number>(performance.now() + 8000 + (randRef.current() * 4000));
  
  // Spoke twinkle system
  const spokeTwinkleRef = useRef<Map<number, { startTime: number; duration: number }>>(new Map());
  
  // Asymmetric wave direction
  const waveDirRef = useRef<{ x: number; y: number; rotation: number }>({ x: 1, y: 0, rotation: 0 });

  // Grid cache (polar lattice positions)
  const gridRef = useRef<{ rings: number; spokes: number; maxR: number; ringRs: Float32Array; spokeAngles: Float32Array } | null>(null);

  // Build/Rebuild grid on size/params change
  const buildScene = () => {
    const canvas = canvasRef.current!;
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    const bg = bgRef.current!;

    // Simple black background - no starfield needed (obscured by grid/warp)
    if (bg.width !== w || bg.height !== h) {
      bg.width = w;
      bg.height = h;
      const bgCtx = bg.getContext("2d", { alpha: false })!;
      bgCtx.fillStyle = "#000000";
      bgCtx.fillRect(0, 0, w, h);
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

  const colorForMode = (alphaCore: number, alphaGlow: number, ringOrSpoke?: 'ring' | 'spoke') => {
    const p = paramsRef.current;
    const css = getComputedStyle(document.documentElement);
    const neon = css.getPropertyValue("--neon").trim() || "180 100% 55%"; // fallback cyan
    const neon2 = css.getPropertyValue("--neon-2").trim() || neon;

    if (p.colorMode === "rainbow" || p.colorMode === "dual-rainbow") {
      // Parse H S% L% from CSS var to keep S/L anchored to theme
      const parts = neon.split(/\s+/);
      const baseH = parseFloat(parts[0] || "180");
      const baseS = parseFloat(parts[1] || "100");
      const l = parts[2] || "55%";
      
      // Pulsing saturation for breathing effect
      const sat = saturationPhaseRef.current;
      const s = `${sat}%`;
      
      let h = (baseH + huePhaseRef.current) % 360;
      let h2 = (h + 35) % 360;
      
      // Dual-rainbow mode: rings and spokes have offset hues
      if (p.colorMode === "dual-rainbow" && ringOrSpoke) {
        if (ringOrSpoke === 'ring') {
          h = (baseH + huePhaseRef.current) % 360;
          h2 = (h + 35) % 360;
        } else {
          h = (baseH + huePhaseRef.current + 120) % 360;
          h2 = (h + 35) % 360;
        }
      }
      
      return {
        core: `hsl(${h} ${s} ${l} / ${alphaCore})`,
        glow: `hsl(${h2} ${s} ${l} / ${alphaGlow})`,
        hue: h,
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
    const parts = hsl.split(/\s+/);
    const h = parseFloat(parts[0] || "180");
    return {
      core: `hsl(${hsl} / ${alphaCore})`,
      glow: `hsl(${hsl} / ${alphaGlow})`,
      hue: h,
    };
  };

  const drawStars = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Simple black background - grid and warp provide all visual content
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
  };

  const computePhase = (rPx: number, tSec: number, angle?: number) => {
    const p = paramsRef.current;
    const minDim = Math.min(canvasRef.current!.width, canvasRef.current!.height);
    const lambdaPx = Math.max(8, p.wavelength * minDim);
    const A = p.amplitude * (motionReduce ? 0.7 : 1);

    // Asymmetric wave: directional bias based on angle
    let effectiveR = rPx;
    if (angle !== undefined) {
      const waveDir = waveDirRef.current;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const directionality = dx * waveDir.x + dy * waveDir.y;
      // Elliptical propagation: stronger in wave direction
      effectiveR = rPx * (1 + 0.15 * directionality);
    }

    // Base traveling wave outward
    const phase = 2 * Math.PI * (effectiveR / lambdaPx - (p.speed * tSec));

    // Seeded phase offset, tiny
    const phi = (seedRef.current % 360) * (Math.PI / 180);

    // Small band-limited radial noise
    const pr = randRef.current();
    const noise = p.noiseAmount * (Math.sin(0.0009 * effectiveR + 2.3 * pr) + Math.sin(0.0013 * effectiveR + 1.7 * pr + phi)) * 0.5;

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

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx, cy);
    // slow spin
    const ang = rotPhaseRef.current || 0;
    if (ang) ctx.rotate(ang);

    // tunnel outward offset (wrap by ring spacing)
    const step = grid.rings > 1 ? grid.ringRs[1] - grid.ringRs[0] : grid.maxR;
    const off = ((tunnelOffsetRef.current || 0) % (step || 1));

    // Rings with variable glow intensity
    for (let i = 0; i < grid.rings; i++) {
      const r0 = grid.ringRs[i] + off;
      const hgt = computePhase(r0, tSec);
      const wob = 1 + 0.15 * Math.sin(0.6 * tSec + r0 * 0.003 + (seedRef.current % 100) * 0.11);
      const rr = Math.max(1, (r0 + hgt * 22) * wob);
      
      // Variable glow: breathing wave of brightness through rings
      const glowPhase = Math.sin(tSec * 0.7 + i * 0.3);
      const glowMult = 0.8 + 0.4 * glowPhase;
      const ringColors = colorForMode(0.95, (0.28 * p.glow * glowMult), 'ring');
      
      ctx.shadowColor = ringColors.core as any;
      ctx.shadowBlur = 8 * p.glow * glowMult;

      // Glow ring
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.strokeStyle = ringColors.glow;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Core ring
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.strokeStyle = ringColors.core;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Spokes with twinkle effect
    const now = performance.now();
    const spokeTwinkle = p.spokeTwinkle !== false;
    
    for (let i = 0; i < grid.spokes; i++) {
      const ang0 = grid.spokeAngles[i];
      const dx = Math.cos(ang0), dy = Math.sin(ang0);
      const r0 = 0;
      const r1 = grid.maxR + 24;

      // Apply displacement along the spoke for slight curvature + optional twist
      const mid = (r1 - r0) * 0.6 + off * 0.25;
      const hgt = computePhase(mid, tSec, ang0);
      const twist = (p.twistStrength ?? 0) * 40; // px
      const bend = hgt * 28 + twist * Math.sin(ang0 * 2 + tSec * 0.7);
      
      const spokeColors = colorForMode(0.95, 0.28 * p.glow, 'spoke');
      ctx.shadowColor = spokeColors.core as any;
      ctx.shadowBlur = 8 * p.glow;
      
      // Twinkle effect
      let lineWidthGlow = 2;
      let lineWidthCore = 1;
      let extraGlow = 1;
      
      if (spokeTwinkle) {
        // Random chance to start twinkle
        if (!spokeTwinkleRef.current.has(i) && Math.random() < 0.03) {
          spokeTwinkleRef.current.set(i, {
            startTime: now,
            duration: 200 + Math.random() * 200
          });
        }
        
        // Check if currently twinkling
        const twinkle = spokeTwinkleRef.current.get(i);
        if (twinkle) {
          const elapsed = now - twinkle.startTime;
          if (elapsed < twinkle.duration) {
            const progress = elapsed / twinkle.duration;
            // Pulse: 0 → 1 → 0
            const intensity = Math.sin(progress * Math.PI);
            lineWidthGlow = 2 + intensity * 1;
            lineWidthCore = 1 + intensity * 2;
            extraGlow = 1 + intensity;
            ctx.shadowBlur = 8 * p.glow * (1 + intensity);
          } else {
            spokeTwinkleRef.current.delete(i);
          }
        }
      }

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dx * mid + (-dy) * bend, dy * mid + (dx) * bend, dx * r1, dy * r1);
      ctx.strokeStyle = spokeColors.glow;
      ctx.lineWidth = lineWidthGlow;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dx * mid + (-dy) * bend, dy * mid + (dx) * bend, dx * r1, dy * r1);
      ctx.strokeStyle = spokeColors.core;
      ctx.lineWidth = lineWidthCore;
      ctx.stroke();
    }

    ctx.restore();
  };
  
  // Center vortex glow effect
  const drawCenterVortex = (ctx: CanvasRenderingContext2D, tSec: number) => {
    const p = paramsRef.current;
    if (p.centerVortex === false) return;
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cx = (p.cx ?? 0.5) * w;
    const cy = (p.cy ?? 0.5) * h;
    
    // Pulsing radius synced to wave phase
    const baseRadius = 60;
    const radiusPulse = 40 * Math.sin(tSec * 3);
    const radius = baseRadius + radiusPulse;
    
    // Intensity syncs with trail effect
    const intensity = 0.3 + 0.2 * (1 - trailIntensityRef.current / 0.25);
    
    const colors = colorForMode(1, 1);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, colors.core.replace(/[\d.]+\)$/, `${intensity})`));
    gradient.addColorStop(0.5, colors.glow.replace(/[\d.]+\)$/, `${intensity * 0.5})`));
    gradient.addColorStop(1, 'transparent');
    
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  };
  
  // Energy burst particle system
  const drawEnergyBursts = (ctx: CanvasRenderingContext2D, tSec: number, now: number) => {
    const p = paramsRef.current;
    if (p.energyBursts === false) return;
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cx = (p.cx ?? 0.5) * w;
    const cy = (p.cy ?? 0.5) * h;
    
    // Update existing bursts
    energyBurstsRef.current = energyBurstsRef.current.filter(burst => {
      const elapsed = now - burst.createdAt;
      return elapsed < burst.duration;
    });
    
    // Spawn new burst
    if (now >= nextBurstAtRef.current) {
      const numStreaks = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numStreaks; i++) {
        energyBurstsRef.current.push({
          angle: Math.random() * Math.PI * 2,
          distance: 0,
          speed: 300 + Math.random() * 200,
          createdAt: now,
          duration: 800 + Math.random() * 400,
          hueOffset: -20 + Math.random() * 40
        });
      }
      nextBurstAtRef.current = now + 8000 + Math.random() * 4000;
    }
    
    // Draw bursts
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    
    energyBurstsRef.current.forEach(burst => {
      const elapsed = now - burst.createdAt;
      const progress = elapsed / burst.duration;
      
      // Update distance
      burst.distance += (burst.speed / 1000) * 16; // approximate dt
      
      // Fade out as it travels
      const alpha = 1 - progress;
      
      const x = cx + Math.cos(burst.angle) * burst.distance;
      const y = cy + Math.sin(burst.angle) * burst.distance;
      
      const colors = colorForMode(1, 1);
      const hue = (colors.hue || 180) + burst.hueOffset;
      
      // Gradient streak
      const gradient = ctx.createLinearGradient(
        cx + Math.cos(burst.angle) * (burst.distance - 30),
        cy + Math.sin(burst.angle) * (burst.distance - 30),
        x, y
      );
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, `hsl(${hue} 100% 60% / ${alpha * 0.8})`);
      gradient.addColorStop(1, `hsl(${hue} 100% 70% / ${alpha})`);
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2 + alpha * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(burst.angle) * (burst.distance - 30), cy + Math.sin(burst.angle) * (burst.distance - 30));
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    
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

    // Update rainbow hue, rotation, tunnel, and dynamic effects
    const pDyn = paramsRef.current;
    const isPulsing = pulseRef.current !== null;
    
    // Speed up hue cycling during pulses
    const hueSpeed = isPulsing ? 90 : 45;
    huePhaseRef.current = (huePhaseRef.current + dtSec * (motionReduce ? hueSpeed * 0.5 : hueSpeed)) % 360;
    
    // Pulsing saturation: 85% → 100% → 85%
    const satTarget = 85 + 15 * Math.sin(tSec * 1.5);
    saturationPhaseRef.current += (satTarget - saturationPhaseRef.current) * 0.1;
    
    // Wave-based trail intensity: Strong (0.08) → Weak (0.25) → Strong
    const trailWave = 0.08 + 0.17 * (0.5 + 0.5 * Math.sin(tSec * 2));
    trailIntensityRef.current += (trailWave - trailIntensityRef.current) * 0.15;
    
    // Asymmetric wave direction rotation
    waveDirRef.current.rotation += dtSec * 0.1; // Full rotation every ~60 seconds
    waveDirRef.current.x = Math.cos(waveDirRef.current.rotation);
    waveDirRef.current.y = Math.sin(waveDirRef.current.rotation);
    
    const rotSpd = pDyn.rotateSpeed ?? 0;
    if (rotSpd) rotPhaseRef.current = (rotPhaseRef.current + dtSec * rotSpd) % (Math.PI * 2);
    const minDim = Math.min(canvas.width, canvas.height);
    const tSpd = pDyn.tunnelSpeed ?? 0;
    if (tSpd) tunnelOffsetRef.current = (tunnelOffsetRef.current + dtSec * tSpd * (minDim * 0.25)) % (gridRef.current?.maxR || (minDim * 0.45));

    drawStars(bgCtx, canvas.width, canvas.height);

    // Warp pass with wave-based trail effect
    if (now < trailUntilRef.current) {
      // Trail color mode: hue-tinted or black
      const trailMode = pDyn.trailColorMode ?? 'hue-tinted';
      if (trailMode === 'hue-tinted') {
        const colors = colorForMode(1, 1);
        const hue = colors.hue || 180;
        ctx.fillStyle = `hsla(${hue}, 80%, 5%, ${trailIntensityRef.current})`;
      } else {
        ctx.fillStyle = `rgba(0,0,0,${trailIntensityRef.current})`;
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Chromatic aberration during pulses
    const chromatic = pDyn.chromaticPulse !== false && pulseRef.current;
    if (chromatic) {
      const { t0, dur } = pulseRef.current!;
      const tt = Math.min(1, Math.max(0, (now - t0) / dur));
      // Only active during middle 50% of pulse
      const inPeak = tt > 0.25 && tt < 0.75;
      
      if (inPeak) {
        // Draw grid 3 times with RGB separation
        ctx.save();
        
        try {
          // Red channel
          ctx.globalCompositeOperation = "screen";
          ctx.save();
          ctx.translate(-2, 0);
          warpBackground(ctx, bg, tSec);
          ctx.restore();
          
          // Green channel (no offset)
          warpBackground(ctx, bg, tSec);
          
          // Blue channel
          ctx.save();
          ctx.translate(2, 0);
          warpBackground(ctx, bg, tSec);
          ctx.restore();
        } catch {
          failSoftRef.current.warpOff = true;
          ctx.drawImage(bg, 0, 0);
        }
        
        ctx.restore();
      } else {
        try {
          warpBackground(ctx, bg, tSec);
        } catch {
          failSoftRef.current.warpOff = true;
          ctx.drawImage(bg, 0, 0);
        }
      }
    } else {
      try {
        warpBackground(ctx, bg, tSec);
      } catch {
        failSoftRef.current.warpOff = true;
        ctx.drawImage(bg, 0, 0);
      }
    }

    // Grid pass
    drawGrid(ctx, tSec);
    
    // Center vortex glow
    drawCenterVortex(ctx, tSec);
    
    // Energy burst particles
    drawEnergyBursts(ctx, tSec, now);

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

    // Wave-based trail mode (increased frequency: 3-5 seconds)
    if (now >= nextTrailAtRef.current) {
      nextTrailAtRef.current = now + 3000 + randRef.current() * 2000;
      trailUntilRef.current = now + 2000 + randRef.current() * 1000;
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
      
      // Enhanced color modes: 75% rainbow, 15% dual-rainbow, 10% theme
      const colorRoll = rng();
      if (colorRoll < 0.75) {
        p.colorMode = "rainbow";
      } else if (colorRoll < 0.9) {
        p.colorMode = "dual-rainbow";
      } else {
        p.colorMode = "theme";
      }
      
      // Enable enhanced effects by default
      p.energyBursts = p.energyBursts !== false;
      p.centerVortex = p.centerVortex !== false;
      p.chromaticPulse = p.chromaticPulse !== false;
      p.spokeTwinkle = p.spokeTwinkle !== false;
      p.trailColorMode = p.trailColorMode ?? 'hue-tinted';

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
