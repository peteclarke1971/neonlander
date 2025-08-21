import { Vec2, vec2 } from './sdf';
import { CavernBakeResult } from './cavernBake';
import { 
  MineralElement, 
  MineralCluster, 
  MineralVein, 
  MineralRings,
  MineralType, 
  MINERAL_TYPES, 
  MINERAL_COLORS,
  MineralRenderers 
} from './mineralElements';

// Seeded PRNG using mulberry32
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mix function for creating deterministic seeds
function mix(a: number, b: string, c: number): number {
  let hash = a;
  for (let i = 0; i < b.length; i++) {
    hash = ((hash << 5) - hash + b.charCodeAt(i)) & 0xffffffff;
  }
  return hash ^ c;
}

export interface CoreCompositionParams {
  theme?: MineralType[];
  density?: number; // 0-1
  seedOverride?: number;
  motionReduction?: boolean;
}

export interface CoreCompositionData {
  clusters: MineralCluster[];
  veins: MineralVein[];
  rings: MineralRings[];
  columns: MineralElement[];
  nodules: MineralElement[];
  shards: MineralElement[];
  pockets: MineralElement[];
  lattices: MineralElement[];
  dust: MineralElement[];
  theme: MineralType[];
  worldBounds: { width: number; height: number };
  collisionGrid: boolean[][];
  cellSize: number;
  marginSize: number;
}

export interface CoreCompositionAnimState {
  glintPhase: number;
  pulsePhase: number;
  driftOffset: Vec2;
}

export class CoreComposition {
  private data: CoreCompositionData | null = null;
  private animState: CoreCompositionAnimState = {
    glintPhase: 0,
    pulsePhase: 0,
    driftOffset: vec2(0, 0)
  };
  private isActive: boolean = false;
  private startTime: number = 0;
  private params: CoreCompositionParams = { density: 0.7, motionReduction: false };
  
  // Performance monitoring
  private frameCount: number = 0;
  private lastPerformanceCheck: number = 0;
  private performanceDegraded: boolean = false;

  play(cavernData: CavernBakeResult, params?: CoreCompositionParams): void {
    this.params = { ...this.params, ...params };
    this.data = this.generateCoreComposition(cavernData);
    this.isActive = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.lastPerformanceCheck = this.startTime;
    this.performanceDegraded = false;
  }

  stop(fadeTime: number = 0.3): void {
    this.isActive = false;
    // Could implement fade-out here if needed
  }

  setTheme(theme: MineralType[]): void {
    this.params.theme = theme;
    // Regenerate if active
    if (this.isActive && this.data) {
      // Would need cavern data to regenerate - store it or make this a deferred operation
    }
  }

  setDensity(density: number): void {
    this.params.density = Math.max(0, Math.min(1, density));
    // Regenerate if active
    if (this.isActive && this.data) {
      // Would need cavern data to regenerate
    }
  }

  update(deltaTime: number): void {
    if (!this.isActive) return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    
    // Update animation phases
    this.animState.glintPhase = (elapsed * 0.5) % 1; // 0.5 Hz glint cycle
    this.animState.pulsePhase = elapsed * Math.PI * 2 * 0.08; // 0.08 Hz pulse (magma)
    
    // Glow dust drift (very subtle)
    if (!this.params.motionReduction) {
      this.animState.driftOffset.x += Math.sin(elapsed * 0.1) * 0.1;
      this.animState.driftOffset.y += Math.cos(elapsed * 0.07) * 0.1;
      
      // Clamp drift to max 0.3px/frame at 60fps
      const maxDrift = 0.3 * (deltaTime / (1000/60));
      this.animState.driftOffset.x = Math.max(-maxDrift, Math.min(maxDrift, this.animState.driftOffset.x));
      this.animState.driftOffset.y = Math.max(-maxDrift, Math.min(maxDrift, this.animState.driftOffset.y));
    }

    // Performance monitoring
    this.frameCount++;
    if (elapsed - this.lastPerformanceCheck > 0.3) { // Check every 300ms
      const fps = this.frameCount / 0.3;
      this.frameCount = 0;
      this.lastPerformanceCheck = elapsed;

      if (fps < 55 && !this.performanceDegraded) {
        this.performanceDegraded = true;
        this.degradePerformance();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: { x: number; y: number; zoom: number }): void {
    if (!this.isActive || !this.data) return;

    // No camera transform here - rely on GameEngine's world transform
    // This locks core composition to the same layer as cavern walls

    // Render each element type
    this.renderClusters(ctx);
    this.renderVeins(ctx);
    this.renderRings(ctx);
    this.renderColumns(ctx);
    this.renderNodules(ctx);
    this.renderShards(ctx);
    this.renderPockets(ctx);
    this.renderLattices(ctx);
    
    // Render glow dust last (if not disabled by performance)
    if (!this.performanceDegraded && this.data.theme.includes(MINERAL_TYPES.GLOW_DUST)) {
      this.renderGlowDust(ctx);
    }
  }

  private generateCoreComposition(cavernData: CavernBakeResult): CoreCompositionData {
    const { worldBounds, collisionGrid, collisionCellSize, seedInfo } = cavernData;
    
    // Generate deterministic theme seed
    const themeSeed = mix(seedInfo.baseSeed, "CORE_THEME", seedInfo.level);
    const rand = mulberry32(themeSeed);

    // Select theme based on level
    const theme = this.params.theme || this.selectThemeForLevel(seedInfo.level, rand);
    
    const marginSize = 12; // Clear margin from air boundaries
    const density = this.params.density || 0.7;

    const data: CoreCompositionData = {
      clusters: [],
      veins: [],
      rings: [],
      columns: [],
      nodules: [],
      shards: [],
      pockets: [],
      lattices: [],
      dust: [],
      theme,
      worldBounds,
      collisionGrid,
      cellSize: collisionCellSize,
      marginSize
    };

    // Generate elements based on theme
    for (const mineralType of theme) {
      const elementSeed = mix(seedInfo.baseSeed, "CORE", this.hashMineralType(mineralType));
      const elementRand = mulberry32(elementSeed);

      switch (mineralType) {
        case MINERAL_TYPES.DIAMOND_FACETS:
          this.generateClusters(data, elementRand, mineralType, density * 0.8);
          break;
        case MINERAL_TYPES.GOLD_VEINS:
          this.generateVeins(data, elementRand, mineralType, density * 0.6);
          break;
        case MINERAL_TYPES.CRYSTAL_SPIKES:
          this.generateClusters(data, elementRand, mineralType, density * 0.7);
          break;
        case MINERAL_TYPES.GEODE_RINGS:
          this.generateRings(data, elementRand, mineralType, density * 0.4);
          break;
        case MINERAL_TYPES.BASALT_COLUMNS:
          this.generateColumns(data, elementRand, mineralType, density * 0.5);
          break;
        case MINERAL_TYPES.IRON_NODULES:
          this.generateNodules(data, elementRand, mineralType, density * 0.6);
          break;
        case MINERAL_TYPES.ICE_SHARDS:
          this.generateShards(data, elementRand, mineralType, density * 0.8);
          break;
        case MINERAL_TYPES.MAGMA_POCKETS:
          this.generatePockets(data, elementRand, mineralType, density * 0.3);
          break;
        case MINERAL_TYPES.ALIEN_LATTICE:
          this.generateLattices(data, elementRand, mineralType, density * 0.1);
          break;
        case MINERAL_TYPES.GLOW_DUST:
          this.generateGlowDust(data, elementRand, mineralType, density * 1.2);
          break;
      }
    }

    return data;
  }

  private selectThemeForLevel(level: number, rand: () => number): MineralType[] {
    const allTypes = Object.values(MINERAL_TYPES);
    
    // Only one element type per level to prevent performance issues
    // Use level as seed to make it deterministic but different per level
    const typeIndex = level % allTypes.length;
    const selectedType = allTypes[typeIndex];
    
    // Level-based filtering - some types only appear at higher levels
    switch (selectedType) {
      case MINERAL_TYPES.DIAMOND_FACETS:
      case MINERAL_TYPES.CRYSTAL_SPIKES:
        if (level < 2) return [MINERAL_TYPES.GOLD_VEINS]; // Fallback for early levels
        break;
      case MINERAL_TYPES.MAGMA_POCKETS:
        if (level < 4) return [MINERAL_TYPES.IRON_NODULES]; // Fallback for early levels
        break;
      case MINERAL_TYPES.ALIEN_LATTICE:
        if (level < 7) return [MINERAL_TYPES.CRYSTAL_SPIKES]; // Fallback for early levels
        break;
      case MINERAL_TYPES.GLOW_DUST:
        if (level < 3) return [MINERAL_TYPES.GOLD_VEINS]; // Fallback for early levels
        break;
      default:
        // Most types are available from level 1
        break;
    }

    return [selectedType];
  }

  private hashMineralType(type: MineralType): number {
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = ((hash << 5) - hash + type.charCodeAt(i)) & 0xffffffff;
    }
    return hash;
  }

  private isInRock(x: number, y: number, data: CoreCompositionData): boolean {
    const gridX = Math.floor(x / data.cellSize);
    const gridY = Math.floor(y / data.cellSize);
    
    return gridY >= 0 && gridY < data.collisionGrid.length &&
           gridX >= 0 && gridX < data.collisionGrid[0].length &&
           data.collisionGrid[gridY][gridX]; // true = rock
  }

  private isOutsideCavern(x: number, y: number, data: CoreCompositionData): boolean {
    const gridX = Math.floor(x / data.cellSize);
    const gridY = Math.floor(y / data.cellSize);
    
    return gridY >= 0 && gridY < data.collisionGrid.length &&
           gridX >= 0 && gridX < data.collisionGrid[0].length &&
           !data.collisionGrid[gridY][gridX]; // false = air/outside cavern
  }

  private getDistanceToAir(x: number, y: number, data: CoreCompositionData): number {
    let minDistance = Infinity;
    const searchRadius = data.marginSize + 10;
    
    for (let dy = -searchRadius; dy <= searchRadius; dy += data.cellSize) {
      for (let dx = -searchRadius; dx <= searchRadius; dx += data.cellSize) {
        const testX = x + dx;
        const testY = y + dy;
        
        if (!this.isInRock(testX, testY, data)) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          minDistance = Math.min(minDistance, distance);
        }
      }
    }
    
    return minDistance;
  }

  private generateClusters(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numClusters = Math.floor(density * 70 * (data.worldBounds.width * data.worldBounds.height) / (1600 * 1200)); // 2x more prevalent
    
    // Poisson-disk sampling for cluster centers
    for (let i = 0; i < numClusters; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const x = rand() * data.worldBounds.width;
        const y = rand() * data.worldBounds.height;
        
        if (this.isInRock(x, y, data) && this.getDistanceToAir(x, y, data) >= data.marginSize) {
          const cluster: MineralCluster = {
            center: vec2(x, y),
            radius: 8 + rand() * 16, // Much smaller clusters
            elements: []
          };
          
          // Generate elements around cluster center
          const numElements = 12 + Math.floor(rand() * 48); // 2x volume: 12-60 elements
          for (let j = 0; j < numElements; j++) {
            const angle = rand() * Math.PI * 2;
            const distance = rand() * cluster.radius;
            const elementX = cluster.center.x + Math.cos(angle) * distance;
            const elementY = cluster.center.y + Math.sin(angle) * distance;
            
            if (this.isInRock(elementX, elementY, data) && this.getDistanceToAir(elementX, elementY, data) >= data.marginSize) {
              cluster.elements.push({
                type,
                x: elementX,
                y: elementY,
                scale: (0.08 + rand() * 0.17) * (3 + rand() * 4), // 3-7x bigger: 0.24-1.75
                rotation: rand() * Math.PI * 2,
                data: { seed: rand() }
              });
            }
          }
          
          if (cluster.elements.length > 0) {
            data.clusters.push(cluster);
          }
          break;
        }
        attempts++;
      }
    }
  }

  private generateVeins(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numVeins = Math.floor(density * 8);
    
    for (let i = 0; i < numVeins; i++) {
      let attempts = 0;
      while (attempts < 30) {
        const startX = rand() * data.worldBounds.width;
        const startY = rand() * data.worldBounds.height;
        
        if (this.isInRock(startX, startY, data) && this.getDistanceToAir(startX, startY, data) >= data.marginSize) {
          const vein: MineralVein = {
            points: [vec2(startX, startY)],
            thickness: 0.4 + rand() * 0.8, // Much thinner: 0.4-1.2
            nuggetPositions: []
          };
          
          // Generate spline path
          let currentX = startX;
          let currentY = startY;
          const numSegments = 3 + Math.floor(rand() * 5);
          
          for (let j = 0; j < numSegments; j++) {
            const angle = rand() * Math.PI * 2;
            const length = 30 + rand() * 70;
            const nextX = currentX + Math.cos(angle) * length;
            const nextY = currentY + Math.sin(angle) * length;
            
            if (this.isInRock(nextX, nextY, data) && this.getDistanceToAir(nextX, nextY, data) >= data.marginSize) {
              vein.points.push(vec2(nextX, nextY));
              currentX = nextX;
              currentY = nextY;
              
              // Chance for nugget
              if (rand() < 0.3) {
                vein.nuggetPositions.push(j / numSegments);
              }
            } else {
              break; // Stop if we hit air
            }
          }
          
          if (vein.points.length > 1) {
            data.veins.push(vein);
          }
          break;
        }
        attempts++;
      }
    }
  }

  private generateRings(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numRings = Math.floor(density * 6);
    
    for (let i = 0; i < numRings; i++) {
      let attempts = 0;
      while (attempts < 30) {
        const x = rand() * data.worldBounds.width;
        const y = rand() * data.worldBounds.height;
        const maxRadius = 10 + rand() * 15; // Much smaller: 10-25
        
        if (this.isInRock(x, y, data) && this.getDistanceToAir(x, y, data) >= data.marginSize) {
          const rings: MineralRings = {
            center: vec2(x, y),
            rings: [],
            rotation: rand() * Math.PI * 2,
            sparklePoints: []
          };
          
          // Generate 2-4 concentric rings
          const numRings = 2 + Math.floor(rand() * 3);
          for (let j = 0; j < numRings; j++) {
            rings.rings.push({
              radius: (j + 1) * maxRadius / numRings,
              thickness: 0.4 + rand() * 0.4 // Much thinner: 0.4-0.8
            });
          }
          
          // Add sparkle points
          const numSparkles = 3 + Math.floor(rand() * 8);
          for (let j = 0; j < numSparkles; j++) {
            const angle = rand() * Math.PI * 2;
            const radius = rand() * maxRadius;
            rings.sparklePoints.push(vec2(
              Math.cos(angle) * radius,
              Math.sin(angle) * radius
            ));
          }
          
          data.rings.push(rings);
          break;
        }
        attempts++;
      }
    }
  }

  // Similar generation methods for other types...
  private generateColumns(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numPatches = Math.floor(density * 8);
    
    for (let i = 0; i < numPatches; i++) {
      let attempts = 0;
      while (attempts < 30) {
        const x = rand() * data.worldBounds.width;
        const y = rand() * data.worldBounds.height;
        
        if (this.isInRock(x, y, data) && this.getDistanceToAir(x, y, data) >= data.marginSize) {
          data.columns.push({
            type,
            x,
            y,
            scale: (0.25 + rand() * 0.3) * (3 + rand() * 4), // 3-7x bigger: 0.75-3.85
            rotation: rand() * Math.PI * 2,
            data: { cols: 2 + Math.floor(rand() * 4), rows: 1 + Math.floor(rand() * 3) }
          });
          break;
        }
        attempts++;
      }
    }
  }

  private generateNodules(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numNodules = Math.floor(density * 25);
    
    for (let i = 0; i < numNodules; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const x = rand() * data.worldBounds.width;
        const y = rand() * data.worldBounds.height;
        
        if (this.isInRock(x, y, data) && this.getDistanceToAir(x, y, data) >= data.marginSize) {
          data.nodules.push({
            type,
            x,
            y,
            scale: (0.15 + rand() * 0.2) * (3 + rand() * 4), // 3-7x bigger: 0.45-2.45
            rotation: 0,
            data: { seed: rand() }
          });
          break;
        }
        attempts++;
      }
    }
  }

  private generateShards(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numShards = Math.floor(density * 30);
    
    for (let i = 0; i < numShards; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const x = rand() * data.worldBounds.width;
        const y = rand() * data.worldBounds.height;
        
        if (this.isInRock(x, y, data) && this.getDistanceToAir(x, y, data) >= data.marginSize) {
          data.shards.push({
            type,
            x,
            y,
            scale: (0.2 + rand() * 0.3) * (3 + rand() * 4), // 3-7x bigger: 0.6-3.5
            rotation: rand() * Math.PI * 2,
            data: { seed: rand() }
          });
          break;
        }
        attempts++;
      }
    }
  }

  private generatePockets(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numPockets = Math.floor(density * 8);
    
    for (let i = 0; i < numPockets; i++) {
      let attempts = 0;
      while (attempts < 30) {
        const x = rand() * data.worldBounds.width;
        const y = rand() * data.worldBounds.height;
        
        // Prefer deeper rock areas
        const distanceToAir = this.getDistanceToAir(x, y, data);
        const deepnessWeight = Math.min(1, distanceToAir / 50);
        
        if (this.isInRock(x, y, data) && this.getDistanceToAir(x, y, data) >= data.marginSize) {
          data.pockets.push({
            type,
            x,
            y,
            scale: (0.2 + rand() * 0.3) * (3 + rand() * 4), // 3-7x bigger: 0.6-3.5
            rotation: 0,
            data: { seed: rand() }
          });
          break;
        }
        attempts++;
      }
    }
  }

  private generateLattices(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numLattices = Math.floor(density * 3); // Very sparse
    
    for (let i = 0; i < numLattices; i++) {
      let attempts = 0;
      while (attempts < 20) {
        const x = rand() * data.worldBounds.width;
        const y = rand() * data.worldBounds.height;
        
        if (this.isInRock(x, y, data) && this.getDistanceToAir(x, y, data) >= data.marginSize) {
          data.lattices.push({
            type,
            x,
            y,
            scale: (0.2 + rand() * 0.3) * (3 + rand() * 4), // 3-7x bigger: 0.6-3.5
            rotation: rand() * Math.PI * 2,
            data: { seed: rand() }
          });
          break;
        }
        attempts++;
      }
    }
  }

  private generateGlowDust(data: CoreCompositionData, rand: () => number, type: MineralType, density: number): void {
    const numDust = Math.floor(density * 80);
    
    for (let i = 0; i < numDust; i++) {
      let attempts = 0;
      while (attempts < 100) {
        const x = rand() * data.worldBounds.width;
        const y = rand() * data.worldBounds.height;
        
        if (this.isInRock(x, y, data) && this.getDistanceToAir(x, y, data) >= data.marginSize) {
          data.dust.push({
            type,
            x,
            y,
            scale: (0.1 + rand() * 0.2) * (3 + rand() * 4), // 3-7x bigger: 0.3-2.1
            rotation: 0,
            data: { seed: rand() }
          });
          break;
        }
        attempts++;
      }
    }
  }

  private renderClusters(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    // Get neon color from CSS variables to match cavern outline
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const cluster of this.data.clusters) {
      for (const element of cluster.elements) {
        const mineralType = element.type as MineralType;
        
        if (mineralType === MINERAL_TYPES.DIAMOND_FACETS) {
          MineralRenderers[MINERAL_TYPES.DIAMOND_FACETS](ctx, element, neonColors, this.animState.glintPhase);
        } else if (mineralType === MINERAL_TYPES.CRYSTAL_SPIKES) {
          MineralRenderers[MINERAL_TYPES.CRYSTAL_SPIKES](ctx, element, neonColors);
        } else if (mineralType === MINERAL_TYPES.BASALT_COLUMNS) {
          MineralRenderers[MINERAL_TYPES.BASALT_COLUMNS](ctx, element, neonColors);
        } else if (mineralType === MINERAL_TYPES.IRON_NODULES) {
          MineralRenderers[MINERAL_TYPES.IRON_NODULES](ctx, element, neonColors);
        } else if (mineralType === MINERAL_TYPES.ICE_SHARDS) {
          MineralRenderers[MINERAL_TYPES.ICE_SHARDS](ctx, element, neonColors);
        } else if (mineralType === MINERAL_TYPES.MAGMA_POCKETS) {
          MineralRenderers[MINERAL_TYPES.MAGMA_POCKETS](ctx, element, neonColors, this.animState.pulsePhase);
        } else if (mineralType === MINERAL_TYPES.ALIEN_LATTICE) {
          MineralRenderers[MINERAL_TYPES.ALIEN_LATTICE](ctx, element, neonColors);
        } else if (mineralType === MINERAL_TYPES.GLOW_DUST) {
          MineralRenderers[MINERAL_TYPES.GLOW_DUST](ctx, element, neonColors, this.animState.driftOffset);
        }
      }
    }
  }

  private renderVeins(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const vein of this.data.veins) {
      MineralRenderers[MINERAL_TYPES.GOLD_VEINS](ctx, vein, neonColors);
    }
  }

  private renderRings(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const rings of this.data.rings) {
      MineralRenderers[MINERAL_TYPES.GEODE_RINGS](ctx, rings, neonColors, this.animState.pulsePhase);
    }
  }

  private renderColumns(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const element of this.data.columns) {
      MineralRenderers[MINERAL_TYPES.BASALT_COLUMNS](ctx, element, neonColors);
    }
  }

  private renderNodules(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const element of this.data.nodules) {
      MineralRenderers[MINERAL_TYPES.IRON_NODULES](ctx, element, neonColors);
    }
  }

  private renderShards(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const element of this.data.shards) {
      MineralRenderers[MINERAL_TYPES.ICE_SHARDS](ctx, element, neonColors);
    }
  }

  private renderPockets(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const element of this.data.pockets) {
      MineralRenderers[MINERAL_TYPES.MAGMA_POCKETS](ctx, element, neonColors, this.animState.pulsePhase);
    }
  }

  private renderLattices(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const element of this.data.lattices) {
      MineralRenderers[MINERAL_TYPES.ALIEN_LATTICE](ctx, element, neonColors);
    }
  }

  private renderGlowDust(ctx: CanvasRenderingContext2D): void {
    if (!this.data) return;
    
    const neonColor = this.getNeonColor();
    const neonColors = { primary: neonColor, secondary: neonColor, glow: neonColor };
    
    for (const element of this.data.dust) {
      MineralRenderers[MINERAL_TYPES.GLOW_DUST](ctx, element, neonColors, this.animState.driftOffset);
    }
  }

  private getNeonColor(): string {
    // Extract neon color from CSS variables to match cavern outline
    const root = document.documentElement;
    const neonHSL = getComputedStyle(root).getPropertyValue('--neon').trim();
    return `hsl(${neonHSL})`;
  }

  private degradePerformance(): void {
    console.log('CoreComposition: Degrading performance due to low FPS');
    
    if (this.data) {
      // Reduce density by 20%
      this.data.clusters.forEach(cluster => {
        cluster.elements = cluster.elements.slice(0, Math.floor(cluster.elements.length * 0.8));
      });
      
      // Disable glow dust
      this.data.dust = [];
      
      // Shorten veins by 30%
      this.data.veins.forEach(vein => {
        vein.points = vein.points.slice(0, Math.floor(vein.points.length * 0.7));
      });
    }
  }

  // Static API methods
  static play(cavernData: CavernBakeResult, params?: CoreCompositionParams): CoreComposition {
    const instance = new CoreComposition();
    instance.play(cavernData, params);
    return instance;
  }

  static setTheme(composition: CoreComposition, theme: MineralType[]): void {
    composition.setTheme(theme);
  }

  static setDensity(composition: CoreComposition, density: number): void {
    composition.setDensity(density);
  }

  static stop(composition: CoreComposition, fadeTime: number = 0.3): void {
    composition.stop(fadeTime);
  }
}