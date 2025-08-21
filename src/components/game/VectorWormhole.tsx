import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type VectorWormholeHandle = {
  Play: (preset?: "Transit" | "Wormhole" | "Event" | { length?: number; nodes?: number }) => void;
  Stop: () => void;
  SetSpeed: (v: number) => void; // 0..1
  SetSeed: (seed: number) => void;
  SetStyle: (s: "Vector" | "Glow" | "CRT") => void;
  OnReachedNode: (cb: (index: number) => void) => void;
  OnFinished: (cb: () => void) => void;
};

export type VectorWormholeProps = {
  active?: boolean;
  preset?: "Transit" | "Wormhole" | "Event";
  loop?: boolean;
  style?: "vector" | "glow" | "crt";
  focalLength?: number;
  cx?: number; // 0..1
  cy?: number; // 0..1
  speed?: number; // 0..1
  seed?: number;
  motionReduce?: boolean;
  className?: string;
};

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashMix(seed: number, s: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x5bd1e995) >>> 0;
  }
  return h >>> 0;
}

export const VectorWormhole = forwardRef<VectorWormholeHandle, VectorWormholeProps>(
  (
    {
      active = true,
      preset = "Wormhole",
      loop = false,
      style = "glow",
      focalLength = 560,
      cx = 0.5,
      cy = 0.5,
      speed = 0.75,
      seed = 12345678,
      motionReduce = false,
      className,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const raf = useRef<number>(0);

    // options/state
    const opts = useRef({ preset, loop, style, focalLength, cx, cy, speed, seed, motionReduce });
    const speedRef = useRef(speed);
    const styleRef = useRef(style);
     const seedRef = useRef(seed >>> 0);
     const neonRef = useRef("160 100% 60%");
     const neonParsedRef = useRef({ h: 160, s: 100, l: 60 });
     const huePhaseRef = useRef(0);


    // sequence control
    const phase = useRef<"idle" | "approach" | "traverse" | "exit">("idle");
    const tPhase = useRef(0); // seconds within current phase
    const dur = useRef({ approach: 0.7, traverse: 6.5, exit: 0.6 });

    // events
    const onNode = useRef<((i: number) => void) | null>(null);
    const onFinished = useRef<(() => void) | null>(null);

    // path + content pools
    type Ring = { s: number; n: number; }; // param along path and polygon sides
    const rings: Ring[] = [];
    const ribsRef = useRef({ strands: 2, pointsPerStrand: 0 });
    const filaments: { s: number; ang: number; len: number; spd: number; life: number }[] = [];
    const nodes: number[] = []; // s positions
    const apertures: { s: number; rMul: number }[] = [];

    // progress
    const sProgress = useRef(0);

    // performance autoscale with dynamic adjustment
    const fpsWin: number[] = [];
    const lastFrameTime = useRef(performance.now());
    const scaleRef = useRef({ 
      ringSpacing: 0.18, // start smaller for better performance
      maxAhead: 8, // reduced from 12
      maxBehind: 1, 
      filamentCount: 12, // reduced from 16
      renderDistance: 6 // new: limit how far ahead we render
    });
    const perfRef = useRef({ 
      targetFps: 60,
      currentFps: 60,
      adaptiveMode: true,
      frameCount: 0
    });
    const camRef = useRef({ x: 0, y: 0 });

    const presets = (name: VectorWormholeProps["preset"]) => {
      if (name === "Transit") return { traverse: 3.5, nodes: 0, filaments: 18 };
      if (name === "Event") return { traverse: 10.5, nodes: 3, filaments: 48 };
      return { traverse: 6.5, nodes: 2, filaments: 32 };
    };

    useImperativeHandle(ref, () => ({
      Play: (p) => {
        const name = typeof p === "string" ? p : preset;
        const pr = presets(name as any);
        dur.current = { approach: 0.7, traverse: typeof p === "object" && p?.length ? p.length : pr.traverse, exit: 0.6 };
        // schedule nodes
        nodes.length = 0;
        const nNodes = typeof p === "object" && p?.nodes != null ? p.nodes : pr.nodes;
        if (nNodes > 0) {
          for (let i = 0; i < nNodes; i++) {
            const t = (i + 1) / (nNodes + 1);
            nodes.push(t * dur.current.traverse * 1.2 + 0.8);
          }
        }
        // apertures
        apertures.length = 0;
        const rngA = mulberry32(hashMix(seedRef.current, "APERTURES"));
        const count = 2 + ((rngA() * 3) | 0);
        for (let i = 0; i < count; i++) apertures.push({ s: 0.8 + rngA() * (dur.current.traverse + 1.0), rMul: 0.8 + rngA() * 1.6 });

        // filaments
        filaments.length = 0;
        const filTarget = presets(name as any).filaments;
        const rngF = mulberry32(hashMix(seedRef.current, "FILAMENTS"));
        for (let i = 0; i < filTarget; i++) filaments.push({ s: rngF() * 6, ang: rngF() * Math.PI * 2, len: 0.5 + rngF() * 2.5, spd: 2 + rngF() * 6, life: 1 });

        // ribs
        ribsRef.current = { strands: 2 + ((mulberry32(hashMix(seedRef.current, "RIBS"))() * 2) | 0), pointsPerStrand: 0 };

        sProgress.current = 0;
        tPhase.current = 0;
        phase.current = "approach";
      },
      Stop: () => { phase.current = "idle"; },
      SetSpeed: (v) => { speedRef.current = Math.max(0, Math.min(1, v)); },
      SetSeed: (s) => { seedRef.current = s >>> 0; },
      SetStyle: (s) => { styleRef.current = (s.toLowerCase() as any) || "glow"; },
      OnReachedNode: (cb) => { onNode.current = cb; },
      OnFinished: (cb) => { onFinished.current = cb; },
    }));

     useEffect(() => {
       opts.current = { preset, loop, style, focalLength, cx, cy, speed, seed, motionReduce };
       speedRef.current = speed;
       styleRef.current = style;
       seedRef.current = seed >>> 0;
     }, [preset, loop, style, focalLength, cx, cy, speed, seed, motionReduce]);
 
     // cache neon hue (avoids per-frame getComputedStyle)
     useEffect(() => {
       try {
         const neon = getComputedStyle(document.documentElement).getPropertyValue("--neon").trim();
         const str = neon || "160 100% 60%";
         neonRef.current = str;
         const parts = str.split(/\s+/);
         const h = parseFloat(parts[0] || "160");
         const s = parseFloat(parts[1] || "100");
         const l = parseFloat(parts[2] || "60");
         if (!Number.isNaN(h) && !Number.isNaN(s) && !Number.isNaN(l)) neonParsedRef.current = { h, s, l };
       } catch {}
     }, [style]);

    // helpers
    const noise1D = (s: number) => {
      const r1 = mulberry32(hashMix(seedRef.current, "N1"));
      const r2 = mulberry32(hashMix(seedRef.current, "N2"));
      const r3 = mulberry32(hashMix(seedRef.current, "N3"));
      // smooth pseudo-noise via sines
      return (
        Math.sin(s * (0.35 + r1() * 0.2) + r1() * 10) * 0.5 +
        Math.sin(s * (0.8 + r2() * 0.3) + r2() * 10) * 0.3 +
        Math.sin(s * (1.8 + r3() * 0.4) + r3() * 10) * 0.2
      );
    };
    const centerline = (s: number) => {
      const rng = mulberry32(hashMix(seedRef.current, "CENTER"));
      const ax = 0.35 + rng() * 0.45;
      const ay = 0.35 + rng() * 0.45;
      const fx = 0.25 + rng() * 0.35;
      const fy = 0.22 + rng() * 0.33;
      const px = rng() * Math.PI * 2;
      const py = rng() * Math.PI * 2;
      const x = Math.sin(s * fx + px) * ax + Math.sin(s * fx * 0.91 + px * 1.7) * (ax * 0.25);
      const y = Math.sin(s * fy + py) * ay + Math.sin(s * fy * 1.12 + py * 1.2) * (ay * 0.25);
      return { x, y };
    };
    const radiusAt = (s: number) => {
      const R0 = 1.0;
      let R = R0 * (1 + 0.25 * (noise1D(s * 0.6)));
      for (const n of nodes) if (Math.abs(s - n) < 0.6) R *= 1.0 + 0.8 * Math.cos(((s - n) / 0.6) * Math.PI * 0.5) ** 2;
      return R;
    };

    const ensureRings = (maxS: number) => {
      const spacing = scaleRef.current.ringSpacing;
      const last = rings.length ? rings[rings.length - 1].s : -1;
      let s = Math.max(0, last);
      if (s < sProgress.current) s = sProgress.current;
      while (s < maxS) {
        s += spacing;
        const n = 16 + (((s * 13) | 0) % 21); // 16..36
        rings.push({ s, n });
      }
      // prune behind
      const minS = sProgress.current - scaleRef.current.maxBehind;
      while (rings.length && rings[0].s < minS) rings.shift();
    };

    const draw = (ctx: CanvasRenderingContext2D, dt: number) => {
      // Performance monitoring and adaptive scaling
      const currentTime = performance.now();
      const frameDelta = currentTime - lastFrameTime.current;
      lastFrameTime.current = currentTime;
      
      // Calculate FPS and adjust quality
      if (frameDelta > 0) {
        const fps = 1000 / frameDelta;
        fpsWin.push(fps);
        if (fpsWin.length > 30) fpsWin.shift(); // keep 30 frame window
        
        perfRef.current.frameCount++;
        if (perfRef.current.frameCount % 20 === 0 && perfRef.current.adaptiveMode) {
          const avgFps = fpsWin.reduce((a, b) => a + b, 0) / fpsWin.length;
          perfRef.current.currentFps = avgFps;
          
          // Dynamic quality adjustment
          if (avgFps < 45) {
            // Reduce quality for low-end devices
            scaleRef.current.maxAhead = Math.max(4, scaleRef.current.maxAhead - 1);
            scaleRef.current.filamentCount = Math.max(6, scaleRef.current.filamentCount - 2);
            scaleRef.current.ringSpacing = Math.min(0.35, scaleRef.current.ringSpacing + 0.02);
          } else if (avgFps > 55 && scaleRef.current.maxAhead < 10) {
            // Increase quality if we have headroom
            scaleRef.current.maxAhead = Math.min(10, scaleRef.current.maxAhead + 1);
            scaleRef.current.filamentCount = Math.min(16, scaleRef.current.filamentCount + 1);
            scaleRef.current.ringSpacing = Math.max(0.15, scaleRef.current.ringSpacing - 0.01);
          }
        }
      }

      // Use lower DPR for better performance on high-DPI displays
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = canvasRef.current!;
      const w = c.clientWidth, h = c.clientHeight;
      ctx.clearRect(0, 0, w, h);

       const nb = neonParsedRef.current;
       huePhaseRef.current = (huePhaseRef.current + dt * 45) % 360;
       const hBase = (nb.h + huePhaseRef.current) % 360;
       ctx.lineCap = "round";
       ctx.lineJoin = "round";
       ctx.shadowBlur = styleRef.current === "glow" ? 1.5 : 0;
       const cxPx = opts.current.cx * w, cyPx = opts.current.cy * h;
       const fl = opts.current.focalLength;

      // camera follow to keep tunnel centered
      const cam = camRef.current;
      const camTarget = centerline(sProgress.current * 0.15);
      cam.x += (camTarget.x - cam.x) * 0.12;
      cam.y += (camTarget.y - cam.y) * 0.12;

      // camera roll
      const rollAmt = opts.current.motionReduce ? 0 : 0.2;
      const t = sProgress.current * 0.6;
      const roll = rollAmt * Math.sin(t * 1.2);
      const cr = Math.cos(roll), sr = Math.sin(roll);

      // progression speed envelope
      let v = 0.2 + 1.6 * speedRef.current; // base
      if (phase.current === "approach") v *= 0.5 + 0.5 * easeInOut(tPhase.current / dur.current.approach);
      if (phase.current === "traverse") v *= 0.8 + 0.35 * Math.sin(t * 0.7 + 1.1);
      if (phase.current === "exit") v *= 0.9 * (1.0 - Math.min(1, tPhase.current / dur.current.exit));

      // update progress
      sProgress.current += v * dt;

      // ensure content ahead
      ensureRings(sProgress.current + scaleRef.current.maxAhead);

      // ribs and filaments speed cues
       const ribThickness = 1.0 + Math.min(1.2, v * 0.35);
       const ringThickness = 0.8 + Math.min(2.0, v * 0.45);

      // draw rings (with distance culling for performance)
      const nb2 = neonParsedRef.current;
      const pulse = 0.85 + 0.25 * Math.sin(t * 2.3);
      const maxRenderDistance = scaleRef.current.renderDistance;
      for (let i = 0; i < rings.length; i++) {
        const { s, n } = rings[i];
        const local = s - sProgress.current;
        if (local <= 0.05 || local > maxRenderDistance) continue; // behind camera or too far
        // center offset along seeded path
         const offsetRaw = centerline(s * 0.15);
         const offset = { x: offsetRaw.x - cam.x, y: offsetRaw.y - cam.y };
         const R = radiusAt(s);
         // per-pixel transform
        const z = local; // depth units
        const baseX = cxPx + (offset.x / z) * fl;
        const baseY = cyPx + (offset.y / z) * fl;
         const scale = (R / z) * fl;
         if (scale < 1.1) continue;
         // brightness near
         const alpha = Math.max(0.1, Math.min(1, 1.2 - z * 0.08));
         const hue = (hBase + s * 22 + i * 3) % 360;
         const light = Math.min(100, Math.max(40, nb2.l * (0.80 + 0.35 * pulse)));
         const col = `hsl(${hue} ${nb2.s}% ${light}%)`;
        ctx.beginPath();
        // Adaptive polygon complexity based on scale and performance
        const baseSides = perfRef.current.currentFps > 50 ? 16 : 12;
        const m = Math.max(6, Math.min(baseSides, Math.floor(scale * 0.06)));
        for (let k = 0; k <= m; k++) {
          const a = (k / m) * Math.PI * 2;
          const ux = Math.cos(a), uy = Math.sin(a);
          // apply roll
          const rx = ux * cr - uy * sr;
          const ry = ux * sr + uy * cr;
          const x = baseX + rx * scale;
          const y = baseY + ry * scale;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        // bloom pass (selective and performance-aware)
        const shouldBloom = styleRef.current === "glow" && scale > 26 && 
                           (i & (perfRef.current.currentFps > 50 ? 3 : 7)) === 0; // fewer blooms on low fps
        if (shouldBloom) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter" as any;
          ctx.strokeStyle = col as any;
          ctx.shadowColor = col as any;
          ctx.lineWidth = ringThickness * (1.8 + 0.6 * pulse);
          ctx.globalAlpha = alpha * 0.18;
          const prevBlur = ctx.shadowBlur; ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = prevBlur;
          ctx.restore();
        }
        // main stroke
        ctx.strokeStyle = col as any;
        if (styleRef.current === "glow") ctx.shadowColor = col as any;
        ctx.lineWidth = ringThickness * (0.9 + 0.25 * pulse);
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // draw ribs (helical)
      const strands = ribsRef.current.strands;
      const ribBaseAlpha = 0.65 * (0.9 + 0.2 * pulse);
      for (let j = 0; j < strands; j++) {
        const phaseOff = (j / strands) * Math.PI * 2;
        const hue = (hBase + 120 + j * 40 + t * 30) % 360;
        const light = Math.min(100, Math.max(35, nb2.l * (0.75 + 0.3 * pulse)));
        const col = `hsl(${hue} ${nb2.s}% ${light}%)`;
        ctx.strokeStyle = col as any;
        if (styleRef.current === "glow") ctx.shadowColor = col as any;
        ctx.globalAlpha = ribBaseAlpha;
        ctx.lineWidth = ribThickness * (0.95 + 0.2 * pulse);
        ctx.beginPath();
        let has = false;
         // Adaptive step size for performance
         const stepSize = perfRef.current.currentFps > 50 ? 0.18 : 0.25;
         for (let s = sProgress.current + 0.2; s < sProgress.current + Math.min(scaleRef.current.maxAhead, maxRenderDistance); s += stepSize) {
           const local = s - sProgress.current;
           const offsetRaw = centerline(s * 0.15);
           const offset = { x: offsetRaw.x - cam.x, y: offsetRaw.y - cam.y };
           const R = radiusAt(s) * 0.98;
           const z = local;
          const baseX = cxPx + (offset.x / z) * fl;
          const baseY = cyPx + (offset.y / z) * fl;
          const a = s * 1.8 + phaseOff;
          const ux = Math.cos(a), uy = Math.sin(a);
          const rx = ux * cr - uy * sr;
          const ry = ux * sr + uy * cr;
          const scale = (R / z) * fl;
          const x = baseX + rx * scale;
          const y = baseY + ry * scale;
          if (!has) { ctx.moveTo(x, y); has = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // filaments
      ctx.lineWidth = Math.max(1, ribThickness - 0.4);
      const fMax = Math.min(filaments.length, scaleRef.current.filamentCount | 0);
      for (let f = 0; f < fMax; f++) {
        const F = filaments[f];
        F.s += (v * (1.5 + F.spd * 0.2)) * dt;
        F.life -= dt * 0.03;
        if (F.life <= 0) { // respawn
          const r = mulberry32(((seedRef.current + f * 1013904223) >>> 0))();
          F.s = sProgress.current + 0.6 + r * 4;
          F.ang = r * Math.PI * 2;
          F.len = 0.5 + r * 2.5;
          F.spd = 2 + r * 6;
          F.life = 1;
        }
        const s0 = F.s - F.len * 0.5;
        const s1 = F.s + F.len * 0.5;
        const hue = (hBase + (F.ang * 180 / Math.PI) + t * 55) % 360;
        const light = Math.min(100, Math.max(45, nb2.l * (0.8 + 0.35 * pulse)));
        const col = `hsl(${hue} ${nb2.s}% ${light}%)`;
        ctx.strokeStyle = col as any;
        if (styleRef.current === "glow") ctx.shadowColor = col as any;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        let drawn = false;
         // Adaptive step size for filaments
         const filStepSize = perfRef.current.currentFps > 50 ? 0.15 : 0.22;
         for (let s = s0; s <= s1; s += filStepSize) {
           const local = s - sProgress.current;
           if (local <= 0.05) continue;
           const offsetRaw = centerline(s * 0.15);
           const offset = { x: offsetRaw.x - cam.x, y: offsetRaw.y - cam.y };
           const R = radiusAt(s) * 0.9;
          const z = local;
          const baseX = cxPx + (offset.x / z) * fl;
          const baseY = cyPx + (offset.y / z) * fl;
          const ux = Math.cos(F.ang + s * 1.9), uy = Math.sin(F.ang + s * 1.9);
          const rx = ux * cr - uy * sr;
          const ry = ux * sr + uy * cr;
          const scale = (R / z) * fl;
          const x = baseX + rx * scale;
          const y = baseY + ry * scale;
          if (!drawn) { ctx.moveTo(x, y); drawn = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // apertures (Einstein-Rosen discs)
      ctx.lineWidth = Math.max(1, ringThickness + 0.4);
      for (let i = 0; i < apertures.length; i++) {
        const A = apertures[i];
        const local = A.s - sProgress.current;
        if (local <= 0.05) continue;
         const offsetRaw = centerline(A.s * 0.15);
         const offset = { x: offsetRaw.x - cam.x, y: offsetRaw.y - cam.y };
         const R = radiusAt(A.s) * A.rMul;
        const z = local;
        const baseX = cxPx + (offset.x / z) * fl;
        const baseY = cyPx + (offset.y / z) * fl;
        const scale = (R / z) * fl;
        const hue = (hBase + A.s * 18) % 360;
        const light = Math.min(100, Math.max(50, nb2.l * (0.85 + 0.3 * pulse)));
        const col = `hsl(${hue} ${nb2.s}% ${light}%)`;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.strokeStyle = col as any;
        if (styleRef.current === "glow") ctx.shadowColor = col as any;
        ctx.arc(baseX, baseY, scale, 0, Math.PI * 2);
        // selective bloom
        if (styleRef.current === "glow" && scale > 24) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter" as any;
          ctx.lineWidth = (ringThickness + 0.4) * (1.6 + 0.4 * pulse);
          const prevBlur = ctx.shadowBlur; ctx.shadowBlur = 9;
          const prevAlpha = ctx.globalAlpha; ctx.globalAlpha = 0.22;
          ctx.stroke();
          ctx.shadowBlur = prevBlur; ctx.globalAlpha = prevAlpha;
          ctx.restore();
        }
        ctx.lineWidth = Math.max(1, ringThickness + 0.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // phase transitions
      tPhase.current += dt;
      if (phase.current === "approach" && tPhase.current >= dur.current.approach) {
        phase.current = "traverse"; tPhase.current = 0;
      } else if (phase.current === "traverse") {
        // trigger node callbacks
        for (let i = 0; i < nodes.length; i++) if (Math.abs(sProgress.current - nodes[i]) < v * dt * 1.8) onNode.current?.(i);
        if (tPhase.current >= dur.current.traverse) {
          if (opts.current.loop) {
            // Seamless segment rollover: keep traversing and schedule new content ahead
            tPhase.current = 0;
            // nodes ahead
            nodes.length = 0;
            const pr = presets(opts.current.preset as any);
            const nNodes = pr.nodes;
            if (nNodes > 0) {
              for (let i = 0; i < nNodes; i++) {
                const t = (i + 1) / (nNodes + 1);
                nodes.push(sProgress.current + t * dur.current.traverse * 1.2 + 0.8);
              }
            }
            // apertures ahead
            apertures.length = 0;
            const rngA = mulberry32(hashMix(seedRef.current, "APERTURES"));
            const count = 2 + ((rngA() * 3) | 0);
            for (let i = 0; i < count; i++) apertures.push({ s: sProgress.current + 0.8 + rngA() * (dur.current.traverse + 1.0), rMul: 0.8 + rngA() * 1.6 });
            // continue traverse without exit
          } else {
            phase.current = "exit"; tPhase.current = 0;
          }
        }
      } else if (phase.current === "exit" && tPhase.current >= dur.current.exit) {
        if (opts.current.loop) { phase.current = "traverse"; tPhase.current = 0; /* no reset of sProgress for seamless loop */ }
        else { phase.current = "idle"; onFinished.current?.(); }
      }

      // overlay: CRT or vignette
      if (styleRef.current === "crt") {
        // subtle scanlines and vignette
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#000";
        const g = ctx.createRadialGradient(cxPx, cyPx, Math.min(w, h) * 0.1, cxPx, cyPx, Math.max(w, h) * 0.8);
        g.addColorStop(0, "transparent"); g.addColorStop(1, "black");
        ctx.fillStyle = g as any;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    };

    useEffect(() => {
      const c = canvasRef.current!;
      const ctx = c.getContext("2d")!;
      const resize = () => {
        const dpr = Math.min(1.0, window.devicePixelRatio || 1);
        c.width = Math.floor(c.clientWidth * dpr);
        c.height = Math.floor(c.clientHeight * dpr);
      };
      resize();
      const onResize = () => { resize(); };
      window.addEventListener("resize", onResize);

      // start immediately if active
      if (active) {
        requestAnimationFrame(() => {
          // default play
          phase.current = "approach"; tPhase.current = 0; sProgress.current = 0;
        });
      }

      let last = performance.now();
      const loopFn = () => {
        raf.current = requestAnimationFrame(loopFn);
        const now = performance.now();
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        fpsWin.push(dt); if (fpsWin.length > 30) fpsWin.shift();
        const avgMs = (fpsWin.reduce((a,b)=>a+b,0) / Math.max(1,fpsWin.length)) * 1000;
        if (avgMs > 18.2) { // under 55 fps -> reduce
          scaleRef.current.ringSpacing = Math.min(0.28, scaleRef.current.ringSpacing * 1.02 + 0.002);
          scaleRef.current.filamentCount = Math.max(8, (scaleRef.current.filamentCount * 0.98) | 0);
          scaleRef.current.maxAhead = Math.max(10, scaleRef.current.maxAhead * 0.99);
        } else {
          scaleRef.current.ringSpacing = Math.max(0.12, scaleRef.current.ringSpacing * 0.995 - 0.0005);
          scaleRef.current.filamentCount = Math.min(64, (scaleRef.current.filamentCount * 1.01) | 0);
          scaleRef.current.maxAhead = Math.min(18, scaleRef.current.maxAhead * 1.01);
        }
        if (phase.current !== "idle") draw(ctx, dt);
      };
      raf.current = requestAnimationFrame(loopFn);
      return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize", onResize); };
    }, [active]);

    // hotkeys: boost and roll toggle and skip
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (phase.current === "idle") return;
        if (e.key === "b" || e.key === "B" || e.key === "Shift") {
          const base = speedRef.current; speedRef.current = Math.min(1, base + 0.35);
          setTimeout(() => { speedRef.current = base; }, 500);
        }
        if (e.key === "r" || e.key === "R") {
          opts.current.motionReduce = !opts.current.motionReduce;
        }
        if (e.key === "Enter") {
          phase.current = "exit"; tPhase.current = 0;
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    return <canvas ref={canvasRef} className={"absolute inset-0 w-full h-full pointer-events-none " + (className || "")} aria-hidden />;
  }
);

function easeInOut(t: number) {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
