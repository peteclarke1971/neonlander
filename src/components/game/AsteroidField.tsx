import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type AsteroidFieldHandle = {
  SetActivity: (v: number) => void;
  SetMaxCount: (n: number) => void;
  SetSizeRange: (min: number, max: number) => void;
  SetSpinRange: (minDeg: number, maxDeg: number, allowNoSpin?: boolean) => void;
  TriggerCluster: (count?: number, coneDeg?: number) => void;
  SetSeed: (seed: number) => void;
  AlignToStarfield: (v: boolean) => void;
};

export type AsteroidFieldProps = {
  active?: boolean;
  activity?: number; // 0..1
  maxCount?: number; // pool size
  sizeMin?: number;
  sizeMax?: number;
  spinMinDeg?: number;
  spinMaxDeg?: number;
  allowNoSpin?: boolean;
  clusterFrequency?: number; // 0..1 higher -> more clusters
  occludeStars?: boolean; // drawn over stars by layering
  alignToStarfield?: boolean;
  focalLength?: number;
  cx?: number;
  cy?: number;
  seed?: number;
  style?: "glow" | "vector";
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

type Mesh = { verts: Float32Array; edges: Uint16Array };

function genIcoLike(rngF: () => number, jitter: number, scale = 1): Mesh {
  // Icosahedron base vertices
  const t = (1 + Math.sqrt(5)) / 2;
  const base = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  // Normalize and jitter
  const verts: number[] = [];
  for (const v of base) {
    let [x, y, z] = v as [number, number, number];
    const len = Math.hypot(x, y, z) || 1;
    x = (x / len) * scale; y = (y / len) * scale; z = (z / len) * scale;
    x += (rngF() * 2 - 1) * jitter;
    y += (rngF() * 2 - 1) * jitter;
    z += (rngF() * 2 - 1) * jitter;
    verts.push(x, y, z);
  }
  // Precomputed edge list for icosahedron
  const edges: number[] = [
    0,1, 0,5, 0,7, 0,10, 0,11,
    1,5, 1,7, 1,8, 1,9,
    2,3, 2,4, 2,6, 2,10, 2,11,
    3,4, 3,6, 3,8, 3,9,
    4,5, 4,9, 4,11,
    5,9, 5,11,
    6,7, 6,8, 6,10,
    7,8, 7,10,
    8,9,
    10,11,
  ];
  return { verts: new Float32Array(verts), edges: new Uint16Array(edges) };
}

function quatFromAxisAngle(ax: number, ay: number, az: number, ang: number) {
  const s = Math.sin(ang * 0.5);
  return [ax * s, ay * s, az * s, Math.cos(ang * 0.5)] as const;
}
function quatMul(a: readonly number[], b: readonly number[]) {
  const ax=a[0], ay=a[1], az=a[2], aw=a[3];
  const bx=b[0], by=b[1], bz=b[2], bw=b[3];
  return [
    aw*bx + ax*bw + ay*bz - az*by,
    aw*by - ax*bz + ay*bw + az*bx,
    aw*bz + ax*by - ay*bx + az*bw,
    aw*bw - ax*bx - ay*by - az*bz,
  ] as const;
}

function rotateVec(vx: number, vy: number, vz: number, q: readonly number[]) {
  // q * v * q^-1, optimized using matrix from quaternion
  const x=qx(vx,vy,vz,q,0), y=qx(vx,vy,vz,q,1), z=qx(vx,vy,vz,q,2);
  return [x,y,z] as const;
}
function qx(x: number,y: number,z: number,q: readonly number[], idx: number) {
  const qx=q[0], qy=q[1], qz=q[2], qw=q[3];
  const xx=qx*qx, yy=qy*qy, zz=qz*qz;
  const xy=qx*qy, xz=qx*qz, yz=qy*qz;
  const wx=qw*qx, wy=qw*qy, wz=qw*qz;
  if (idx===0) return (1-2*(yy+zz))*x + 2*(xy-wz)*y + 2*(xz+wy)*z;
  if (idx===1) return 2*(xy+wz)*x + (1-2*(xx+zz))*y + 2*(yz-wx)*z;
  return 2*(xz-wy)*x + 2*(yz+wx)*y + (1-2*(xx+yy))*z;
}

export const AsteroidField = forwardRef<AsteroidFieldHandle, AsteroidFieldProps>(
  ({
    active = true,
    activity = 0.45,
    maxCount = 30,
    sizeMin = 1.6,
    sizeMax = 7.0,
    spinMinDeg = 5,
    spinMaxDeg = 60,
    allowNoSpin = true,
    clusterFrequency = 0.5,
    occludeStars = true,
    alignToStarfield = true,
    focalLength = 560,
    cx,
    cy,
    seed = 1234567,
    style = "glow",
    className,
  }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const warmupRef = useRef(0);

    // runtime options
    const opts = useRef({ activity, maxCount, sizeMin, sizeMax, spinMinDeg, spinMaxDeg, allowNoSpin, clusterFrequency, alignToStarfield, focalLength, cx, cy, style });
    const seedRef = useRef<number>(seed >>> 0);

    // performance
    const fpsWin: number[] = [];
    const perf = useRef({ low: 0, high: 0, target: maxCount, floor: 6, ceil: 120 });

    // pool
    const poolN = useRef(0);
    const poolMax = useRef(maxCount);
    const arr = useRef<any>(null);

    // meshes
    const meshLib = useRef<Mesh[][]>([]); // [LOD][variant]

    // activity
    const activityRef = useRef(activity);
    const actVel = useRef(0);
    const lastBurstAt = useRef(0);

    // alignment
    const vp = useRef({ cx: cx ?? 0.5, cy: cy ?? 0.5 });

    useImperativeHandle(ref, () => ({
      SetActivity: (v) => { activityRef.current = Math.max(0, Math.min(1, v)); },
      SetMaxCount: (n) => { perf.current.target = Math.max(4, Math.min(200, Math.floor(n))); poolResize(); },
      SetSizeRange: (min, max) => { opts.current.sizeMin = Math.max(0.2, Math.min(min, max)); opts.current.sizeMax = Math.max(opts.current.sizeMin + 0.1, max); },
      SetSpinRange: (minDeg, maxDeg, allowNo) => { opts.current.spinMinDeg = Math.max(0, Math.min(minDeg, maxDeg)); opts.current.spinMaxDeg = Math.max(opts.current.spinMinDeg + 1, maxDeg); opts.current.allowNoSpin = !!allowNo; },
      TriggerCluster: (count = 6, coneDeg = 8) => { spawnCluster(count, coneDeg); },
      SetSeed: (s) => { seedRef.current = s >>> 0; initMeshes(); },
      AlignToStarfield: (v) => { opts.current.alignToStarfield = !!v; },
    }));

    const initMeshes = () => {
      const rng = mulberry32(hashMix(seedRef.current, "AST-MESH"));
      const LODs: Mesh[][] = [];
      for (let l = 0; l < 3; l++) {
        const list: Mesh[] = [];
        for (let i = 0; i < 4; i++) {
          const jitter = 0.08 + l * 0.04;
          const scale = 1;
          list.push(genIcoLike(rng, jitter, scale));
        }
        LODs.push(list);
      }
      meshLib.current = LODs;
    };

    const poolResize = () => {
      poolMax.current = Math.max(4, Math.min(200, perf.current.target|0));
      const N = poolMax.current;
      const f32 = (n: number) => new Float32Array(n);
      const u8 = (n: number) => new Uint8Array(n);
      arr.current = {
        x: f32(N), y: f32(N), z: f32(N),
        vx: f32(N), vy: f32(N), vf: f32(N),
        r: f32(N),
        qx: f32(N), qy: f32(N), qz: f32(N), qw: f32(N),
        wx: f32(N), wy: f32(N), wz: f32(N), // angular velocity (rad/s)
        alive: u8(N), fading: u8(N), fade: f32(N),
        lod: u8(N), mesh: u8(N),
        mega: u8(N),
      };
      poolN.current = 0;
    };

    const spawnOne = (rng: () => number, coneDeg = 8, zFar = 1.2) => {
      const A = arr.current; if (!A) return;
      if (poolN.current >= poolMax.current) return;
      // find slot
      let i = -1;
      for (let k = 0; k < poolMax.current; k++) { if (!A.alive[k] && !A.fading[k]) { i = k; break; } }
      if (i < 0) return;
      // direction cone around center
      const cone = (coneDeg * Math.PI) / 180;
      const ax = (Math.random() * 2 - 1) * cone;
      const ay = (Math.random() * 2 - 1) * cone;
      const x = Math.tan(ax) * zFar * 0.8;
      const y = Math.tan(ay) * zFar * 0.8;
      // base radius
      let r = opts.current.sizeMin + rng() * (opts.current.sizeMax - opts.current.sizeMin);
      // XL (2x–8x) twice as often, and rare MEGA (4x XL)
      const u = rng();
      let isMega = false;
      if (u < 0.005) {
        const xl = 2 + rng() * 6; // 2x..8x
        r *= xl * 4;             // MEGA
        isMega = true;
      } else if (u < 0.005 + 0.16) {
        r *= 2 + rng() * 6;      // extra large, more frequent
      }
      // velocity towards camera; small drift keeps on path
      const forward = 2.2 * (0.25 + activityRef.current * 0.75);
      // per-asteroid speed factor (introduces slow and fast movers)
      let sf = 1;
      const rv = rng();
      if (rv < 0.12) { sf = 0.15 + rng() * 0.25; }       // very slow
      else if (rv < 0.55) { sf = 0.4 + rng() * 0.4; }    // moderate
      else { sf = 0.8 + rng() * 0.9; }                   // fast
      const vx = (x / zFar) * 0.08 * sf;
      const vy = (y / zFar) * 0.08 * sf;
      // spin
      const noSpin = opts.current.allowNoSpin && rng() < 0.12;
      const spinMin = (opts.current.spinMinDeg * Math.PI) / 180;
      const spinMax = (opts.current.spinMaxDeg * Math.PI) / 180;
      const wmag = noSpin ? 0 : (spinMin + rng() * (spinMax - spinMin));
      let axx = rng() * 2 - 1, ayy = rng() * 2 - 1, azz = rng() * 2 - 1;
      const len = Math.hypot(axx, ayy, azz) || 1; axx/=len; ayy/=len; azz/=len;
      const wx = axx * wmag, wy = ayy * wmag, wz = azz * wmag;
      // orientation
      const q = quatFromAxisAngle(1,0,0,0);
      // LOD
      const lod = r > 5 ? 2 : r > 3 ? 1 : 0;
      const mesh = (rng() * meshLib.current[lod].length) | 0;

      A.x[i]=x; A.y[i]=y; A.z[i]=zFar;
      A.vx[i]=vx; A.vy[i]=vy; A.vf[i]=sf; A.r[i]=r;
      A.qx[i]=q[0]; A.qy[i]=q[1]; A.qz[i]=q[2]; A.qw[i]=q[3];
      A.wx[i]=wx; A.wy[i]=wy; A.wz[i]=wz;
      A.lod[i]=lod; A.mesh[i]=mesh;
      A.alive[i]=1; A.fading[i]=0; A.fade[i]=1;
      A.mega[i]= isMega ? 1 : 0;
      poolN.current++;
    };

    const spawnCluster = (count = 6, coneDeg = 8) => {
      const rng = mulberry32(hashMix(seedRef.current, "AST-CLUSTER") ^ ((performance.now()|0) >>> 0));
      for (let i = 0; i < count; i++) spawnOne(rng, coneDeg, 1.2 - i * 0.01);
    };

    useEffect(() => { initMeshes(); poolResize(); }, []);

    useEffect(() => {
      const c = canvasRef.current!;
      const ctx = c.getContext("2d")!;
      const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = Math.floor(c.clientWidth * dpr);
        c.height = Math.floor(c.clientHeight * dpr);
      };
      resize();
      const onResize = () => { resize(); };
      window.addEventListener("resize", onResize);

      const rng = mulberry32(hashMix(seedRef.current, "AST-LOOP"));
      let last = performance.now();
      let accum = 0;

      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        // fps window
        fpsWin.push(dt); if (fpsWin.length > 30) fpsWin.shift();
        const avgMs = (fpsWin.reduce((a,b)=>a+b,0) / Math.max(1,fpsWin.length)) * 1000;
        // Defer autoscaling during warmup to avoid pool resets that look like stutter
        warmupRef.current += dt;
        if (warmupRef.current >= 1.6) {
          if (avgMs > 18.2) { perf.current.low += dt; perf.current.high = Math.max(0, perf.current.high - dt); if (perf.current.low > 0.3 && perf.current.target > perf.current.floor) { perf.current.target = Math.max(perf.current.floor, Math.floor(perf.current.target * 0.88)); poolResize(); perf.current.low = 0; } }
          else { perf.current.high += dt; perf.current.low = Math.max(0, perf.current.low - dt*2); if (perf.current.high > 1.2 && perf.current.target < opts.current.maxCount) { perf.current.target = Math.min(opts.current.maxCount, Math.floor(perf.current.target * 1.1 + 2)); poolResize(); perf.current.high = 0; } }
        }

        // clear (transparent to let stars show behind)
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        ctx.setTransform(dpr,0,0,dpr,0,0);
        const w = c.clientWidth, h = c.clientHeight;
        ctx.clearRect(0,0,w,h);

        // activity random walk
        const target = opts.current.activity;
        const a = activityRef.current;
        const drift = (rng() - 0.5) * dt * 0.25; // low-frequency noise
        actVel.current += (target - a) * dt * 1.2 + drift;
        actVel.current *= Math.exp(-dt * 1.5);
        activityRef.current = Math.max(0, Math.min(1, a + actVel.current * dt));

        const cxPx = (opts.current.cx ?? vp.current.cx) * w;
        const cyPx = (opts.current.cy ?? vp.current.cy) * h;
        const fl = opts.current.focalLength;

        // spawn logic: baseline + inhomogeneous via activity
        const baseRate = 0.15 + activityRef.current * 2.0; // per second
        accum += dt * baseRate;
        while (accum >= 1) { accum -= 1; spawnOne(rng, 9, 1.2); }

        // occasional clusters
        const tsec = now / 1000;
        if (activityRef.current > 0.7 && (tsec - lastBurstAt.current) > (6 - 4*opts.current.clusterFrequency)) {
          lastBurstAt.current = tsec;
          const count = 10 + Math.floor(rng() * 18);
          spawnCluster(count, 8);
        }

        // update + draw
        const A = arr.current; if (!A) return;
        // draw order: far to near, so near lines overdraw
        const order: number[] = [];
        for (let i = 0; i < poolMax.current; i++) if (A.alive[i] || A.fading[i]) order.push(i);
        order.sort((i,j)=> (A.z[j]-A.z[i]));

        const color = getComputedStyle(document.documentElement).getPropertyValue("--neon").trim() || "160 100% 60%";
        ctx.strokeStyle = `hsl(${color})` as any;
        if (style === "glow") { ctx.shadowColor = `hsl(${color})` as any; ctx.shadowBlur = 8; } else { ctx.shadowBlur = 0; }
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (const i of order) {
          let x=A.x[i], y=A.y[i], z=A.z[i];
          const vx=A.vx[i], vy=A.vy[i];
          const r=A.r[i];
          let qx=A.qx[i], qy=A.qy[i], qz=A.qz[i], qw=A.qw[i];
          const wx=A.wx[i], wy=A.wy[i], wz=A.wz[i];
          const fading=A.fading[i];

          // advance motion
          const forwardBase = 0.7 * (0.2 + activityRef.current * 0.8);
          const forward = forwardBase * (A.vf[i] || 1);
          z -= forward * dt;
          x += vx * dt; y += vy * dt;

          // rotation integration
          const wmag = Math.hypot(wx,wy,wz);
          if (wmag > 0) {
            const nx=wx/(wmag||1), ny=wy/(wmag||1), nz=wz/(wmag||1);
            const dq = quatFromAxisAngle(nx,ny,nz, wmag * dt);
            const nq = quatMul([qx,qy,qz,qw], dq);
            qx=nq[0]; qy=nq[1]; qz=nq[2]; qw=nq[3];
          }

          // project
          const sx = cxPx + (x / z) * fl;
          const sy = cyPx + (y / z) * fl;

          // choose mesh by lod + slight distance bias
          const lod = A.lod[i];
          const mesh = meshLib.current[lod][A.mesh[i]];

          // draw edges
          const V = mesh.verts; const E = mesh.edges;
          const alpha = (fading ? Math.max(0, A.fade[i]) : 1) * Math.max(0.2, Math.min(1, r/2.5));
          ctx.globalAlpha = alpha;

          const m = r / z; // perspective scale
          if (A.mega[i]) {
            // Intense aura pulse for MEGA asteroids
            const t = now * 0.006 + i * 0.37;
            const pulse = 1 + 0.12 * Math.sin(t);
            ctx.save();
            ctx.globalCompositeOperation = "lighter" as any;
            const colStr = `hsl(${color})` as any;
            ctx.strokeStyle = colStr;
            ctx.shadowColor = colStr;
            ctx.shadowBlur = 16;
            ctx.globalAlpha = 0.22 + 0.18 * Math.abs(Math.sin(t * 0.85));
            ctx.beginPath();
            ctx.arc(sx, sy, m * 12 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            // Slightly thicker lines
            ctx.lineWidth = Math.max(2, ctx.lineWidth * 1.35);
          }
          for (let e=0; e<E.length; e+=2) {
            const a = E[e]*3, b = E[e+1]*3;
            // rotate vertex in 3D by q
            const vax = V[a], vay = V[a+1], vaz = V[a+2];
            const vbx = V[b], vby = V[b+1], vbz = V[b+2];
            const rax = qxfn(vax,vay,vaz,qx,qy,qz,qw,0), ray = qxfn(vax,vay,vaz,qx,qy,qz,qw,1), raz = qxfn(vax,vay,vaz,qx,qy,qz,qw,2);
            const rbx = qxfn(vbx,vby,vbz,qx,qy,qz,qw,0), rby = qxfn(vbx,vby,vbz,qx,qy,qz,qw,1), rbz = qxfn(vbx,vby,vbz,qx,qy,qz,qw,2);
            const ax2 = sx + rax * m;
            const ay2 = sy + ray * m;
            const bx2 = sx + rbx * m;
            const by2 = sy + rby * m;
            ctx.beginPath();
            ctx.moveTo(ax2, ay2);
            ctx.lineTo(bx2, by2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;

          // bounds + lifecycle
          const margin = 100;
          const out = (z <= 0.06) || (sx < -margin || sx > w+margin || sy < -margin || sy > h+margin);
          if (out && !fading) { A.fading[i]=1; A.fade[i]=0.25; }
          if (A.fading[i]) { A.fade[i]-=dt; if (A.fade[i]<=0) { A.fading[i]=0; A.alive[i]=0; poolN.current=Math.max(0,poolN.current-1); } }

          // write back
          A.x[i]=x; A.y[i]=y; A.z[i]=z; A.qx[i]=qx; A.qy[i]=qy; A.qz[i]=qz; A.qw[i]=qw;
        }
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", onResize); };
    }, []);

    // hotkeys / toggles
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'a' || e.key === 'A') { opts.current.activity = opts.current.activity > 0 ? 0 : 0.45; }
        if (e.key === 'f' || e.key === 'F') { spawnCluster(6 + ((Math.random()*6)|0), 8); }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    return <canvas ref={canvasRef} className={"absolute inset-0 w-full h-full pointer-events-none " + (className||"")} style={{ zIndex: occludeStars ? 1 : 0 }} aria-hidden />;
  }
);

function qxfn(x:number,y:number,z:number,qx:number,qy:number,qz:number,qw:number, idx:number){
  const xx=qx*qx, yy=qy*qy, zz=qz*qz; const xy=qx*qy, xz=qx*qz, yz=qy*qz; const wx=qw*qx, wy=qw*qy, wz=qw*qz;
  if (idx===0) return (1-2*(yy+zz))*x + 2*(xy-wz)*y + 2*(xz+wy)*z;
  if (idx===1) return 2*(xy+wz)*x + (1-2*(xx+zz))*y + 2*(yz-wx)*z;
  return 2*(xz-wy)*x + 2*(yz+wx)*y + (1-2*(xx+yy))*z;
}
