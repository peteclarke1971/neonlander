/**
 * Object Pool System
 * Reduces garbage collection by reusing objects
 */

export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  
  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }
  
  get(): T {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      this.resetFn(obj);
      return obj;
    }
    return this.createFn();
  }
  
  release(obj: T): void {
    this.pool.push(obj);
  }
  
  clear(): void {
    this.pool.length = 0;
  }
  
  get size(): number {
    return this.pool.length;
  }
}

// Pre-configured pools for common game objects
export interface PooledParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

export interface PooledDebris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  av: number;
  life: number;
  max: number;
  size: number;
  kind: "plate" | "rod" | "chip";
}

export const particlePool = new ObjectPool<PooledParticle>(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, color: '' }),
  (p) => { p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 0; p.max = 0; p.color = ''; }
);

export const debrisPool = new ObjectPool<PooledDebris>(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, av: 0, life: 0, max: 0, size: 0, kind: 'plate' }),
  (d) => { d.x = 0; d.y = 0; d.vx = 0; d.vy = 0; d.angle = 0; d.av = 0; d.life = 0; d.max = 0; d.size = 0; d.kind = 'plate'; }
);