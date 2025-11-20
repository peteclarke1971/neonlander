export type WeatherType = "clear" | "neon-rain" | "dust-clouds" | "em-storm" | "plasma-drizzle";

export interface WeatherState {
  currentWeather: WeatherType;
  nextWeather: WeatherType;
  transitionProgress: number; // 0 = fully current, 1 = fully next
  isTransitioning: boolean;
  timeInCurrentWeather: number; // seconds
  nextWeatherChangeTime: number; // seconds until next weather
}

export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
  type: "rain" | "dust" | "spark";
  // For dust clouds
  rotation?: number;
  rotationSpeed?: number;
}

export interface LightningBolt {
  segments: { x: number; y: number }[];
  life: number;
  maxLife: number;
  alpha: number;
  branches: LightningBolt[];
  boltType?: "mega" | "arc" | "fork" | "tendril";
  depth?: number;
}

export interface LightningAfterglow {
  segments: { x: number; y: number }[];
  alpha: number;
  life: number;
  maxLife: number;
}

export interface LightningImpact {
  x: number; // world coordinates
  y: number;
  life: number;
  maxLife: number;
  radius: number;
}

// Weather timing constants
const WEATHER_DURATION_MIN = 30;
const WEATHER_DURATION_MAX = 60;
const CLEAR_DURATION_MIN = 45;
const CLEAR_DURATION_MAX = 90;
const TRANSITION_DURATION = 7; // seconds

// Particle limits
const MAX_RAIN_PARTICLES = 200;
const MAX_RAIN_PARTICLES_LOW = 100;
const MAX_DUST_PARTICLES = 150;
const MAX_DUST_PARTICLES_LOW = 80;
const MAX_PLASMA_PARTICLES = 100;
const MAX_PLASMA_PARTICLES_LOW = 60;
const MAX_LIGHTNING_BOLTS = 5;
const MAX_LIGHTNING_BOLTS_LOW = 3;

// Level 4 lightning constants (constant epic storms)
const LEVEL4_LIGHTNING_INTERVAL_MIN = 0.5; // seconds
const LEVEL4_LIGHTNING_INTERVAL_MAX = 2.0; // seconds
const LEVEL4_BOLT_LIFETIME_MIN = 0.6; // sustained visibility
const LEVEL4_BOLT_LIFETIME_MAX = 1.2; // longer than normal
const LEVEL4_MAX_CONCURRENT_BOLTS = 8;
const LEVEL4_MAX_CONCURRENT_BOLTS_LOW = 5;

/**
 * Select next weather type based on distance traveled (difficulty)
 */
export function selectNextWeather(state: WeatherState, distance: number): void {
  const roll = Math.random();
  
  // Early game (0-2000m): 80% clear, 15% dust, 5% rain
  if (distance < 2000) {
    if (roll < 0.80) {
      state.nextWeather = "clear";
    } else if (roll < 0.95) {
      state.nextWeather = "dust-clouds";
    } else {
      state.nextWeather = "neon-rain";
    }
  }
  // Mid game (2000-5000m): 40% clear, 30% dust, 20% rain, 10% EM storm
  else if (distance < 5000) {
    if (roll < 0.40) {
      state.nextWeather = "clear";
    } else if (roll < 0.70) {
      state.nextWeather = "dust-clouds";
    } else if (roll < 0.90) {
      state.nextWeather = "neon-rain";
    } else {
      state.nextWeather = "em-storm";
    }
  }
  // Late game (5000m+): 20% clear, 30% dust, 25% rain, 20% EM storm, 5% plasma
  else {
    if (roll < 0.20) {
      state.nextWeather = "clear";
    } else if (roll < 0.50) {
      state.nextWeather = "dust-clouds";
    } else if (roll < 0.75) {
      state.nextWeather = "neon-rain";
    } else if (roll < 0.95) {
      state.nextWeather = "em-storm";
    } else {
      state.nextWeather = "plasma-drizzle";
    }
  }
}

/**
 * Update weather state machine
 */
export function updateWeatherTransition(
  state: WeatherState,
  dt: number,
  distance: number
): void {
  if (state.isTransitioning) {
    state.transitionProgress += dt / TRANSITION_DURATION;
    
    if (state.transitionProgress >= 1) {
      // Transition complete
      state.currentWeather = state.nextWeather;
      state.isTransitioning = false;
      state.transitionProgress = 0;
      state.timeInCurrentWeather = 0;
      
      if (state.currentWeather !== "clear") {
        // Schedule next transition to clear
        state.nextWeather = "clear";
        state.nextWeatherChangeTime = 
          WEATHER_DURATION_MIN + 
          Math.random() * (WEATHER_DURATION_MAX - WEATHER_DURATION_MIN);
      } else {
        // Schedule next weather event
        selectNextWeather(state, distance);
        state.nextWeatherChangeTime = 
          CLEAR_DURATION_MIN + 
          Math.random() * (CLEAR_DURATION_MAX - CLEAR_DURATION_MIN);
      }
    }
  } else {
    state.timeInCurrentWeather += dt;
    
    if (state.timeInCurrentWeather >= state.nextWeatherChangeTime) {
      // Start transition
      state.isTransitioning = true;
      state.transitionProgress = 0;
    }
  }
}

/**
 * Get current weather intensity (0-1) accounting for transitions
 */
export function getWeatherIntensity(state: WeatherState): number {
  if (!state.isTransitioning) {
    return state.currentWeather === "clear" ? 0 : 1;
  }
  
  // During transition
  if (state.currentWeather === "clear") {
    // Transitioning from clear to weather
    return state.transitionProgress;
  } else if (state.nextWeather === "clear") {
    // Transitioning from weather to clear
    return 1 - state.transitionProgress;
  } else {
    // Transitioning between two weather types
    return 1;
  }
}

/**
 * Create initial weather state
 */
export function createWeatherState(): WeatherState {
  return {
    currentWeather: "clear",
    nextWeather: "clear",
    transitionProgress: 0,
    isTransitioning: false,
    timeInCurrentWeather: 0,
    nextWeatherChangeTime: CLEAR_DURATION_MIN + Math.random() * (CLEAR_DURATION_MAX - CLEAR_DURATION_MIN)
  };
}

/**
 * Get particle limit for current weather type
 */
export function getParticleLimit(weatherType: WeatherType, lowGraphics: boolean): number {
  switch (weatherType) {
    case "neon-rain":
      return lowGraphics ? MAX_RAIN_PARTICLES_LOW : MAX_RAIN_PARTICLES;
    case "dust-clouds":
      return lowGraphics ? MAX_DUST_PARTICLES_LOW : MAX_DUST_PARTICLES;
    case "plasma-drizzle":
      return lowGraphics ? MAX_PLASMA_PARTICLES_LOW : MAX_PLASMA_PARTICLES;
    default:
      return 0;
  }
}

export function getLightningLimit(lowGraphics: boolean): number {
  return lowGraphics ? MAX_LIGHTNING_BOLTS_LOW : MAX_LIGHTNING_BOLTS;
}

export function selectBoltType(): "mega" | "arc" | "fork" | "tendril" {
  const roll = Math.random();
  if (roll < 0.25) return "mega";    // 25% mega
  if (roll < 0.50) return "arc";     // 25% arc
  if (roll < 0.70) return "fork";    // 20% fork
  return "tendril";                   // 30% tendril
}

/**
 * Generate lightning bolt with branching
 */
export function generateLightningBolt(
  canvasWidth: number,
  canvasHeight: number,
  boltTypeOrSegments?: "mega" | "arc" | "fork" | "tendril" | number,
  currentDepth: number = 0
): LightningBolt {
  // Determine bolt type and params
  let boltType: "mega" | "arc" | "fork" | "tendril";
  let numSegments: number;
  let jitter: number;
  let branchChance: number;
  let maxBranchDepth: number;
  let numBranches: number;
  let maxLife: number;

  if (typeof boltTypeOrSegments === "number") {
    // Legacy: number of segments provided
    boltType = "mega";
    numSegments = boltTypeOrSegments;
    jitter = 80;
    branchChance = 0.7;
    maxBranchDepth = 3;
    numBranches = 2;
    maxLife = LEVEL4_BOLT_LIFETIME_MIN + Math.random() * (LEVEL4_BOLT_LIFETIME_MAX - LEVEL4_BOLT_LIFETIME_MIN);
  } else {
    // Bolt type provided or use default
    boltType = boltTypeOrSegments || selectBoltType();
    
    if (boltType === "mega") {
      numSegments = 20 + Math.floor(Math.random() * 15);
      jitter = 80;
      branchChance = 0.7;
      maxBranchDepth = 3;
      numBranches = 2 + Math.floor(Math.random() * 2); // 2-3 branches
      maxLife = LEVEL4_BOLT_LIFETIME_MIN + Math.random() * (LEVEL4_BOLT_LIFETIME_MAX - LEVEL4_BOLT_LIFETIME_MIN);
    } else if (boltType === "arc") {
      numSegments = 12 + Math.floor(Math.random() * 8);
      jitter = 50;
      branchChance = 0.5;
      maxBranchDepth = 2;
      numBranches = 1 + Math.floor(Math.random() * 2); // 1-2 branches
      maxLife = 0.6 + Math.random() * 0.4;
    } else if (boltType === "fork") {
      numSegments = 8 + Math.floor(Math.random() * 5);
      jitter = 60;
      branchChance = 0.3;
      maxBranchDepth = 1;
      numBranches = 1;
      maxLife = 0.4 + Math.random() * 0.3;
    } else { // tendril
      numSegments = 15 + Math.floor(Math.random() * 11); // 15-25 segments
      jitter = 25; // Very low jitter for delicate appearance
      branchChance = 0.9; // 90% chance to branch
      maxBranchDepth = 4; // Deep recursion
      numBranches = 2 + Math.floor(Math.random() * 3); // 2-4 branches
      maxLife = 0.5 + Math.random() * 0.2; // 0.5-0.7s
    }
  }

  // Generate bolt path
  const segments: { x: number; y: number }[] = [];
  
  // Starting and ending positions
  let startX: number;
  let startY: number;
  let endY: number;
  
  if (boltType === "mega") {
    startX = canvasWidth * (0.2 + Math.random() * 0.6);
    startY = 0;
    endY = canvasHeight * (0.6 + Math.random() * 0.3);
  } else if (boltType === "arc") {
    startX = canvasWidth * (0.1 + Math.random() * 0.8);
    startY = 0;
    endY = canvasHeight * (0.4 + Math.random() * 0.3);
  } else if (boltType === "fork") {
    startX = canvasWidth * (0.1 + Math.random() * 0.8);
    startY = canvasHeight * 0.2;
    endY = canvasHeight * (0.4 + Math.random() * 0.2);
  } else { // tendril
    startX = canvasWidth * (0.15 + Math.random() * 0.7);
    startY = 0;
    endY = canvasHeight * (0.7 + Math.random() * 0.2); // 70-90% of screen
  }

  segments.push({ x: startX, y: startY });

  // Generate jagged path
  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments;
    const prevSeg = segments[i - 1];
    
    // Interpolate y
    const y = startY + (endY - startY) * t;
    
    // Add horizontal jitter
    const x = prevSeg.x + (Math.random() - 0.5) * jitter;
    
    segments.push({ x, y });
  }

  const bolt: LightningBolt = {
    segments,
    life: 0,
    maxLife,
    alpha: 1.0,
    branches: [],
    boltType,
    depth: currentDepth,
  };

  // Generate branches with enhanced recursive logic
  if (currentDepth < maxBranchDepth && numSegments > 5) {
    for (let b = 0; b < numBranches; b++) {
      if (Math.random() < branchChance) {
        const branchStartIdx = Math.floor(numSegments * 0.3 + Math.random() * numSegments * 0.4);
        const branchStart = segments[branchStartIdx];
        
        const branchSegments = Math.max(3, Math.floor(numSegments * 0.4));
        const branchAngle = (Math.random() - 0.5) * Math.PI * 0.6;
        const branchLength = (endY - branchStart.y) * (0.4 + Math.random() * 0.4);
        
        const branchSegs: { x: number; y: number }[] = [{ ...branchStart }];
        
        for (let i = 1; i < branchSegments; i++) {
          const t = i / branchSegments;
          const prev = branchSegs[i - 1];
          
          const baseX = branchStart.x + Math.cos(branchAngle) * branchLength * t;
          const baseY = branchStart.y + Math.sin(Math.PI * 0.5) * branchLength * t;
          
          const x = baseX + (Math.random() - 0.5) * jitter * 0.5;
          const y = baseY;
          
          branchSegs.push({ x, y });
        }
        
        const branch: LightningBolt = {
          segments: branchSegs,
          life: 0,
          maxLife: maxLife * 0.8,
          alpha: 0.8,
          branches: [],
          boltType,
          depth: currentDepth + 1,
        };
        
        // Recursive sub-branching (50% chance for branches to create their own branches)
        if (currentDepth + 1 < maxBranchDepth && Math.random() < 0.5) {
          const subBranchCount = Math.floor(Math.random() * 2) + 1; // 1-2 sub-branches
          for (let sb = 0; sb < subBranchCount; sb++) {
            if (Math.random() < branchChance * 0.7 && branchSegs.length > 3) {
              const subBranchStartIdx = Math.floor(branchSegs.length * 0.3 + Math.random() * branchSegs.length * 0.3);
              const subBranchStart = branchSegs[subBranchStartIdx];
              
              const subBranchSegments = Math.max(2, Math.floor(branchSegs.length * 0.4));
              const subBranchAngle = branchAngle + (Math.random() - 0.5) * Math.PI * 0.4;
              const subBranchLength = branchLength * (0.3 + Math.random() * 0.3);
              
              const subBranchSegs: { x: number; y: number }[] = [{ ...subBranchStart }];
              
              for (let i = 1; i < subBranchSegments; i++) {
                const t = i / subBranchSegments;
                const prev = subBranchSegs[i - 1];
                
                const baseX = subBranchStart.x + Math.cos(subBranchAngle) * subBranchLength * t;
                const baseY = subBranchStart.y + Math.sin(Math.PI * 0.5) * subBranchLength * t;
                
                const x = baseX + (Math.random() - 0.5) * jitter * 0.3;
                const y = baseY;
                
                subBranchSegs.push({ x, y });
              }
              
              branch.branches.push({
                segments: subBranchSegs,
                life: 0,
                maxLife: maxLife * 0.6,
                alpha: 0.6,
                branches: [],
                boltType,
                depth: currentDepth + 2,
              });
            }
          }
        }
        
        bolt.branches.push(branch);
      }
    }
  }

  return bolt;
}

// Export Level 4 constants for use in GameEngine
export const LEVEL4_CONSTANTS = {
  INTERVAL_MIN: LEVEL4_LIGHTNING_INTERVAL_MIN,
  INTERVAL_MAX: LEVEL4_LIGHTNING_INTERVAL_MAX,
  MAX_CONCURRENT: LEVEL4_MAX_CONCURRENT_BOLTS,
  MAX_CONCURRENT_LOW: LEVEL4_MAX_CONCURRENT_BOLTS_LOW
};
