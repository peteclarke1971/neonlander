import { Vec2, vec2, vec2Distance } from './sdf';
import { CavernBakeResult } from './cavernBake';

export interface CavernFXParams {
  intensity: number;          // 0-1, global gain
  breathDepth: number;        // 0-1, breathing wall intensity
  rippleStrength: number;     // 0-1, gravity ripple strength
  lensWarp: number;          // 0-1, screen displacement strength
  dustDensity: number;       // 0-1, ambient dust particle count
  colorMode: 'cyan' | 'green' | 'amber' | 'two-tone' | 'match';
  glow: number;              // 0-1, edge glow intensity
  motionReduction: boolean;   // accessibility toggle
}

export interface CavernFXPreset {
  name: string;
  params: CavernFXParams;
}

export interface DistanceField {
  width: number;
  height: number;
  data: Float32Array;  // distance to rock boundary (inside air only)
  flowField: Float32Array; // 2 components per pixel: flow direction
}

export interface RippleState {
  phase: number;
  frequency: number;
  lastSpawn: number;
  spawnInterval: number;
}

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  brightness: number;
}

// Seeded PRNG for deterministic effects
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CavernFXPresets: CavernFXPreset[] = [
  {
    name: 'Calm',
    params: {
      intensity: 0.4,
      breathDepth: 0.2,
      rippleStrength: 0.3,
      lensWarp: 0.15,
      dustDensity: 0.1,
      colorMode: 'cyan',
      glow: 0.3,
      motionReduction: false
    }
  },
  {
    name: 'Normal',
    params: {
      intensity: 0.6,
      breathDepth: 0.35,
      rippleStrength: 0.5,
      lensWarp: 0.25,
      dustDensity: 0.3,
      colorMode: 'cyan',
      glow: 0.5,
      motionReduction: false
    }
  },
  {
    name: 'Storm',
    params: {
      intensity: 0.8,
      breathDepth: 0.5,
      rippleStrength: 0.75,
      lensWarp: 0.4,
      dustDensity: 0.6,
      colorMode: 'two-tone',
      glow: 0.7,
      motionReduction: false
    }
  }
];

export class CavernFX {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private distanceField: DistanceField | null = null;
  private distanceTexture: WebGLTexture | null = null;
  private flowTexture: WebGLTexture | null = null;
  
  private cavernData: CavernBakeResult | null = null;
  private params: CavernFXParams;
  private fxSeed: number = 0;
  private rand: () => number = Math.random;
  
  private rippleState: RippleState = {
    phase: 0,
    frequency: 0.08,
    lastSpawn: 0,
    spawnInterval: 4000
  };
  
  private dustParticles: DustParticle[] = [];
  private isActive: boolean = false;
  private startTime: number = 0;
  
  // Performance monitoring
  private frameCount: number = 0;
  private lastFPSCheck: number = 0;
  private currentFPS: number = 60;
  private performanceGoverned: boolean = false;
  
  // Texture support flags
  private supportsFloatTextures: boolean = false;
  private supportsFloatLinear: boolean = false;
  
  constructor() {
    this.params = CavernFXPresets[1].params; // Normal preset
  }
  
  initialize(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { 
      alpha: true, 
      premultipliedAlpha: false,
      antialias: false 
    });
    
    if (!this.gl) {
      console.warn('CavernFX: WebGL not supported');
      return false;
    }
    
    // Check required texture extensions
    this.supportsFloatTextures = !!this.gl.getExtension('OES_texture_float');
    this.supportsFloatLinear = !!this.gl.getExtension('OES_texture_float_linear');
    if (!this.supportsFloatTextures) {
      console.warn('CavernFX: Float textures not supported, falling back to 8-bit textures');
    }
    
    return this.initializeShaders();
  }
  
  private initializeShaders(): boolean {
    if (!this.gl) return false;
    
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      varying vec2 v_screenCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
        v_screenCoord = a_position * 0.5 + 0.5;
      }
    `;
    
    const fragmentShaderSource = `
      precision mediump float;
      
      uniform sampler2D u_distanceField;
      uniform sampler2D u_flowField;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_intensity;
      uniform float u_breathDepth;
      uniform float u_rippleStrength;
      uniform float u_lensWarp;
      uniform float u_glow;
      uniform vec3 u_primaryColor;
      uniform vec3 u_secondaryColor;
      uniform bool u_motionReduction;
      
      // World/view mapping
      uniform vec2 u_worldSize;     // full world (width, height)
      uniform vec2 u_viewOrigin;    // top-left of the current view in world units
      uniform vec2 u_viewSize;      // (viewWidth, viewHeight) in world units
      
      varying vec2 v_texCoord;
      varying vec2 v_screenCoord;
      
      // Noise functions
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = noise(i);
        float b = noise(i + vec2(1.0, 0.0));
        float c = noise(i + vec2(0.0, 1.0));
        float d = noise(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      void main() {
        // Map screen UV -> world UV (flip Y so top of view maps to top of world)
        vec2 worldPos = vec2(
          u_viewOrigin.x + v_screenCoord.x * u_viewSize.x,
          u_viewOrigin.y + (1.0 - v_screenCoord.y) * u_viewSize.y
        );
        vec2 uv = clamp(worldPos / u_worldSize, 0.0, 1.0);
        
        // Sample distance field and inside mask
        vec4 distSample = texture2D(u_distanceField, uv);
        float distance = distSample.r;
        vec2 gradient = distSample.gb * 2.0 - 1.0;
        float insideMask = distSample.a;
        
        // Discard fragments outside the cavern air volume
        if (insideMask < 0.5) {
          discard;
        }
        
        // Sample flow field
        vec2 flow = texture2D(u_flowField, uv).rg * 2.0 - 1.0;
        
        // Breathing walls effect
        float breathPhase = u_time * 0.08 + smoothNoise(uv * 8.0) * 2.0;
        float breathIntensity = sin(breathPhase) * 0.5 + 0.5;
        float wallProximity = 1.0 - clamp(distance * 0.1, 0.0, 1.0);
        float breathing = breathIntensity * wallProximity * u_breathDepth;
        
        // Gravity ripples
        float ripplePhase = u_time * 0.3 + dot(flow, uv * 10.0);
        float ripple = sin(ripplePhase * 6.28) * exp(-distance * 0.05);
        ripple *= u_rippleStrength * wallProximity;
        
        // Edge glow
        float edgeFactor = exp(-distance * 0.3);
        float edgeGlow = edgeFactor * u_glow;
        
        // Lens warp (very subtle screen displacement)
        vec2 warpOffset = gradient * wallProximity * u_lensWarp * 0.006; // Max 0.6% displacement
        if (u_motionReduction) {
          warpOffset *= 0.33; // Reduce for motion sensitivity
        }
        
        // Combine effects
        float totalIntensity = (breathing + ripple * 0.5 + edgeGlow) * u_intensity;
        
        // Color mixing
        vec3 color = mix(u_primaryColor, u_secondaryColor, ripple * 0.5 + 0.5);
        
        // Output with alpha based on proximity to walls
        float alpha = totalIntensity * wallProximity;
        alpha = clamp(alpha, 0.0, 1.2); // 50% brighter cap maximum opacity
        
        gl_FragColor = vec4(color * totalIntensity * 1.5, alpha); // 50% brighter
      }
    `;
    
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return false;
    
    this.program = this.gl.createProgram();
    if (!this.program) return false;
    
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);
    
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('CavernFX: Shader program failed to link');
      return false;
    }
    
    return true;
  }
  
  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('CavernFX: Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  play(cavernData: CavernBakeResult, params?: Partial<CavernFXParams>): void {
    this.cavernData = cavernData;
    if (params) {
      this.params = { ...this.params, ...params };
    }
    
    // Generate deterministic FX seed
    this.fxSeed = cavernData.seedInfo.baseSeed ^ 
                  (cavernData.seedInfo.level * 0x9e3779b9) ^ 
                  0xCAFEBABE; // "CAVERN_FX" hash
    this.rand = mulberry32(this.fxSeed);
    
    // Initialize ripple state with seeded values
    this.rippleState.frequency = 0.07 + this.rand() * 0.05; // 0.07-0.12 Hz
    this.rippleState.spawnInterval = 3000 + this.rand() * 4000; // 3-7 seconds
    
    this.computeDistanceField();
    this.createTextures();
    this.initializeDustParticles();
    
    this.isActive = true;
    this.startTime = performance.now();
    this.lastFPSCheck = this.startTime;
    this.frameCount = 0;
  }
  
  private computeDistanceField(): void {
    if (!this.cavernData) return;
    
    const { worldBounds, collisionGrid, collisionCellSize } = this.cavernData;
    
    // Create lower resolution distance field (512x384 for 4:3 aspect)
    const fieldWidth = 512;
    const fieldHeight = Math.floor(fieldWidth * worldBounds.height / worldBounds.width);
    
    const distanceData = new Float32Array(fieldWidth * fieldHeight * 4); // RGBA
    const flowData = new Float32Array(fieldWidth * fieldHeight * 4); // RGBA
    
    // Compute distance field using simple flood-fill from boundaries
    for (let y = 0; y < fieldHeight; y++) {
      for (let x = 0; x < fieldWidth; x++) {
        const worldX = (x / fieldWidth) * worldBounds.width;
        const worldY = (y / fieldHeight) * worldBounds.height;
        
        // Sample collision grid
        const gridX = Math.floor(worldX / collisionCellSize);
        const gridY = Math.floor(worldY / collisionCellSize);
        
        const isInside = gridY >= 0 && gridY < collisionGrid.length &&
                        gridX >= 0 && gridX < collisionGrid[0].length &&
                        !collisionGrid[gridY][gridX]; // false = air
        
        let distance = 0;
        let gradient = vec2(0, 0);
        
        if (isInside) {
          // Find distance to nearest wall
          distance = this.findNearestWallDistance(worldX, worldY, worldBounds, collisionGrid, collisionCellSize);
          
          // Approximate gradient
          const eps = collisionCellSize;
          const dx = this.findNearestWallDistance(worldX + eps, worldY, worldBounds, collisionGrid, collisionCellSize) - distance;
          const dy = this.findNearestWallDistance(worldX, worldY + eps, worldBounds, collisionGrid, collisionCellSize) - distance;
          gradient = vec2(dx / eps, dy / eps);
          
          // Normalize gradient
          const len = Math.sqrt(gradient.x * gradient.x + gradient.y * gradient.y);
          if (len > 0.001) {
            gradient.x /= len;
            gradient.y /= len;
          }
        }
        
        const idx = (y * fieldWidth + x) * 4;
        distanceData[idx] = Math.min(distance / 100, 1.0); // Normalize distance (only meaningful when inside)
        distanceData[idx + 1] = gradient.x * 0.5 + 0.5; // Store as 0-1
        distanceData[idx + 2] = gradient.y * 0.5 + 0.5; // Store as 0-1
        distanceData[idx + 3] = isInside ? 1.0 : 0.0;   // A channel encodes inside-air mask
        
        // Flow field (simplified - could be enhanced with tunnel centerlines)
        const flowX = gradient.y; // Perpendicular to gradient for circulation
        const flowY = -gradient.x;
        flowData[idx] = flowX * 0.5 + 0.5;
        flowData[idx + 1] = flowY * 0.5 + 0.5;
        flowData[idx + 2] = 0.0;
        flowData[idx + 3] = 1.0;
      }
    }
    
    this.distanceField = {
      width: fieldWidth,
      height: fieldHeight,
      data: distanceData,
      flowField: flowData
    };
  }
  
  private findNearestWallDistance(x: number, y: number, worldBounds: { width: number; height: number }, 
                                  collisionGrid: boolean[][], cellSize: number): number {
    let minDistance = Infinity;
    const searchRadius = 100; // Search within 100 units
    
    const startGridX = Math.max(0, Math.floor((x - searchRadius) / cellSize));
    const endGridX = Math.min(collisionGrid[0].length - 1, Math.floor((x + searchRadius) / cellSize));
    const startGridY = Math.max(0, Math.floor((y - searchRadius) / cellSize));
    const endGridY = Math.min(collisionGrid.length - 1, Math.floor((y + searchRadius) / cellSize));
    
    for (let gy = startGridY; gy <= endGridY; gy++) {
      for (let gx = startGridX; gx <= endGridX; gx++) {
        if (collisionGrid[gy][gx]) { // Solid cell
          const cellCenterX = (gx + 0.5) * cellSize;
          const cellCenterY = (gy + 0.5) * cellSize;
          const distance = vec2Distance(vec2(x, y), vec2(cellCenterX, cellCenterY));
          minDistance = Math.min(minDistance, distance);
        }
      }
    }
    
    return minDistance === Infinity ? searchRadius : minDistance;
  }
  
  private createTextures(): void {
    if (!this.gl || !this.distanceField) return;

    const gl = this.gl;
    const useFloat = this.supportsFloatTextures;

    // Prepare data and type
    let distData: ArrayBufferView = this.distanceField.data;
    let flowData: ArrayBufferView = this.distanceField.flowField;
    let type: number = gl.FLOAT;

    if (!useFloat) {
      type = gl.UNSIGNED_BYTE;
      const srcD = this.distanceField.data;
      const srcF = this.distanceField.flowField;
      const d8 = new Uint8Array(srcD.length);
      const f8 = new Uint8Array(srcF.length);
      for (let i = 0; i < srcD.length; i += 4) {
        d8[i] = Math.min(255, Math.max(0, Math.floor(srcD[i] * 255)));
        d8[i + 1] = Math.min(255, Math.max(0, Math.floor(srcD[i + 1] * 255)));
        d8[i + 2] = Math.min(255, Math.max(0, Math.floor(srcD[i + 2] * 255)));
        d8[i + 3] = Math.min(255, Math.max(0, Math.floor(srcD[i + 3] * 255)));

        f8[i] = Math.min(255, Math.max(0, Math.floor(srcF[i] * 255)));
        f8[i + 1] = Math.min(255, Math.max(0, Math.floor(srcF[i + 1] * 255)));
        f8[i + 2] = Math.min(255, Math.max(0, Math.floor(srcF[i + 2] * 255)));
        f8[i + 3] = 255; // opaque
      }
      distData = d8;
      flowData = f8;
    }

    // Create distance field texture
    this.distanceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.distanceTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.distanceField.width,
      this.distanceField.height,
      0,
      gl.RGBA,
      type,
      distData
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create flow field texture
    this.flowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.flowTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.distanceField.width,
      this.distanceField.height,
      0,
      gl.RGBA,
      type,
      flowData
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  
  private initializeDustParticles(): void {
    if (!this.cavernData || this.params.dustDensity <= 0) return;
    
    const maxParticles = Math.floor(this.params.dustDensity * 100);
    this.dustParticles = [];
    
    for (let i = 0; i < maxParticles; i++) {
      this.dustParticles.push({
        x: this.rand() * this.cavernData.worldBounds.width,
        y: this.rand() * this.cavernData.worldBounds.height,
        vx: (this.rand() - 0.5) * 10,
        vy: (this.rand() - 0.5) * 10,
        life: this.rand() * 1000,
        maxLife: 1000 + this.rand() * 2000,
        brightness: 0.1 + this.rand() * 0.3
      });
    }
  }
  
  update(deltaTime: number): void {
    if (!this.isActive) return;
    
    const currentTime = performance.now();
    this.updatePerformanceMonitoring(currentTime);
    
    // Update ripple state
    this.rippleState.phase += deltaTime * this.rippleState.frequency;
    
    if (currentTime - this.rippleState.lastSpawn > this.rippleState.spawnInterval) {
      this.rippleState.lastSpawn = currentTime;
      // Spawn new ripple (handled in shader)
    }
    
    // Update dust particles
    this.updateDustParticles(deltaTime);
    
    // Apply performance governor if needed
    this.applyPerformanceGovernor();
  }
  
  private updatePerformanceMonitoring(currentTime: number): void {
    this.frameCount++;
    
    if (currentTime - this.lastFPSCheck > 1000) {
      this.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.lastFPSCheck = currentTime;
    }
  }
  
  private applyPerformanceGovernor(): void {
    if (this.currentFPS < 55 && !this.performanceGoverned) {
      console.warn('CavernFX: Performance governor activated');
      this.performanceGoverned = true;
      
      // Reduce expensive effects
      this.params.dustDensity *= 0.5;
      this.params.rippleStrength *= 0.75;
      this.params.lensWarp = Math.min(this.params.lensWarp, 0.2);
    } else if (this.currentFPS > 58 && this.performanceGoverned) {
      // Gradually restore when performance improves
      this.performanceGoverned = false;
    }
  }
  
  private updateDustParticles(deltaTime: number): void {
    if (this.params.motionReduction || this.params.dustDensity <= 0) return;
    
    for (const particle of this.dustParticles) {
      particle.life += deltaTime;
      
      if (particle.life > particle.maxLife) {
        // Respawn particle
        particle.life = 0;
        particle.x = this.rand() * (this.cavernData?.worldBounds.width || 1000);
        particle.y = this.rand() * (this.cavernData?.worldBounds.height || 1000);
      }
      
      // Simple movement
      particle.x += particle.vx * deltaTime * 0.001;
      particle.y += particle.vy * deltaTime * 0.001;
    }
  }
  
  render(canvas: HTMLCanvasElement, cameraX: number, cameraY: number, viewWidth: number, viewHeight: number): void {
    if (!this.isActive || !this.gl || !this.program || !this.distanceTexture || !this.flowTexture) return;
    
    const currentTime = (performance.now() - this.startTime) * 0.001; // Convert to seconds
    
    // Set up WebGL state
    this.gl.viewport(0, 0, canvas.width, canvas.height);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    this.gl.useProgram(this.program);
    
    // Set uniforms
    const resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
    const timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
    const intensityLocation = this.gl.getUniformLocation(this.program, 'u_intensity');
    const breathDepthLocation = this.gl.getUniformLocation(this.program, 'u_breathDepth');
    const rippleStrengthLocation = this.gl.getUniformLocation(this.program, 'u_rippleStrength');
    const lensWarpLocation = this.gl.getUniformLocation(this.program, 'u_lensWarp');
    const glowLocation = this.gl.getUniformLocation(this.program, 'u_glow');
    const motionReductionLocation = this.gl.getUniformLocation(this.program, 'u_motionReduction');
    
    this.gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    this.gl.uniform1f(timeLocation, currentTime);
    
    // Device-specific brightness scaling (1.5x for desktop/laptop)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     ('ontouchstart' in window && window.innerWidth < 1024);
    const deviceBrightnessMultiplier = isMobile ? 1.0 : 1.5;
    const adjustedIntensity = this.params.intensity * deviceBrightnessMultiplier;
    
    this.gl.uniform1f(intensityLocation, adjustedIntensity);
    this.gl.uniform1f(breathDepthLocation, this.params.breathDepth);
    this.gl.uniform1f(rippleStrengthLocation, this.params.rippleStrength);
    this.gl.uniform1f(lensWarpLocation, this.params.lensWarp);
    this.gl.uniform1f(glowLocation, this.params.glow);
    this.gl.uniform1i(motionReductionLocation, this.params.motionReduction ? 1 : 0);
    
    // World/view mapping uniforms
    const worldSizeLocation = this.gl.getUniformLocation(this.program, 'u_worldSize');
    const viewOriginLocation = this.gl.getUniformLocation(this.program, 'u_viewOrigin');
    const viewSizeLocation = this.gl.getUniformLocation(this.program, 'u_viewSize');
    const worldW = this.cavernData?.worldBounds.width || 1.0;
    const worldH = this.cavernData?.worldBounds.height || 1.0;
    const originX = cameraX - viewWidth * 0.5;
    const originY = cameraY - viewHeight * 0.5;
    this.gl.uniform2f(worldSizeLocation, worldW, worldH);
    this.gl.uniform2f(viewOriginLocation, originX, originY);
    this.gl.uniform2f(viewSizeLocation, viewWidth, viewHeight);
    
    // Set color uniforms based on color mode
    const primaryColorLocation = this.gl.getUniformLocation(this.program, 'u_primaryColor');
    const secondaryColorLocation = this.gl.getUniformLocation(this.program, 'u_secondaryColor');
    
    switch (this.params.colorMode) {
      case 'cyan':
        this.gl.uniform3f(primaryColorLocation, 0.0, 0.8, 1.0);
        this.gl.uniform3f(secondaryColorLocation, 0.0, 0.6, 0.8);
        break;
      case 'green':
        this.gl.uniform3f(primaryColorLocation, 0.0, 1.0, 0.3);
        this.gl.uniform3f(secondaryColorLocation, 0.0, 0.8, 0.2);
        break;
      case 'amber':
        this.gl.uniform3f(primaryColorLocation, 1.0, 0.6, 0.0);
        this.gl.uniform3f(secondaryColorLocation, 0.8, 0.4, 0.0);
        break;
      case 'two-tone':
        this.gl.uniform3f(primaryColorLocation, 0.0, 0.8, 1.0);
        this.gl.uniform3f(secondaryColorLocation, 1.0, 0.2, 0.4);
        break;
      case 'match': {
        // Match overlay to theme neon color (level/landscape color)
        let r = 0, g = 0, b = 0;
        try {
          const styles = getComputedStyle(document.documentElement);
          const neon = styles.getPropertyValue('--neon').trim(); // e.g. "210 100% 60%"
          const cssColor = `hsl(${neon})`;
          const tmp = document.createElement('span');
          tmp.style.color = cssColor;
          document.body.appendChild(tmp);
          const rgbStr = getComputedStyle(tmp).color; // "rgb(r, g, b)"
          document.body.removeChild(tmp);
          const m = rgbStr.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
          if (m) {
            r = parseInt(m[1], 10) / 255;
            g = parseInt(m[2], 10) / 255;
            b = parseInt(m[3], 10) / 255;
          }
        } catch {}
        this.gl.uniform3f(primaryColorLocation, r, g, b);
        this.gl.uniform3f(secondaryColorLocation, r * 0.8, g * 0.8, b * 0.8);
        break;
      }
    }
    
    // Bind textures
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.distanceTexture);
    this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'u_distanceField'), 0);
    
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.flowTexture);
    this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'u_flowField'), 1);
    
    // Render full-screen quad
    this.renderFullscreenQuad();
  }
  
  private renderFullscreenQuad(): void {
    if (!this.gl || !this.program) return;
    
    // Create full-screen quad
    const vertices = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
       1,  1, 1, 1
    ]);
    
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    
    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
    
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 16, 0);
    
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 16, 8);
    
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    this.gl.deleteBuffer(buffer);
  }
  
  stop(fadeTime: number = 0.3): void {
    this.isActive = false;
    
    // Clean up WebGL resources
    if (this.gl) {
      if (this.distanceTexture) {
        this.gl.deleteTexture(this.distanceTexture);
        this.distanceTexture = null;
      }
      if (this.flowTexture) {
        this.gl.deleteTexture(this.flowTexture);
        this.flowTexture = null;
      }
      if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null;
      }
    }
    
    this.dustParticles = [];
    this.distanceField = null;
  }
  
  set(param: keyof CavernFXParams, value: any): void {
    if (param in this.params) {
      (this.params as any)[param] = value;
      
      // Apply motion reduction constraints
      if (param === 'motionReduction' && value) {
        this.params.lensWarp = Math.min(this.params.lensWarp, 0.2);
        this.params.dustDensity = 0;
      }
    }
  }
  
  setSeed(seed: number): void {
    this.fxSeed = seed;
    this.rand = mulberry32(seed);
    
    // Re-initialize seeded effects
    this.rippleState.frequency = 0.07 + this.rand() * 0.05;
    this.rippleState.spawnInterval = 3000 + this.rand() * 4000;
    this.initializeDustParticles();
  }
  
  getDebugInfo(): any {
    return {
      fxSeed: this.fxSeed,
      currentFPS: this.currentFPS,
      performanceGoverned: this.performanceGoverned,
      ripplePeriod: 1 / this.rippleState.frequency,
      maxUVDisplacement: this.params.lensWarp * 0.6,
      dustParticleCount: this.dustParticles.length,
      params: { ...this.params }
    };
  }
  
  loadPreset(presetName: string): void {
    const preset = CavernFXPresets.find(p => p.name === presetName);
    if (preset) {
      this.params = { ...preset.params };
    }
  }
  
  get isRunning(): boolean {
    return this.isActive;
  }
}

// Global instance
export const cavernFX = new CavernFX();