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
  boltType?: "mega" | "arc" | "fork";
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

/**
 * Generate lightning bolt with branching
 */
export function generateLightningBolt(
  canvasWidth: number,
  canvasHeight: number,
  boltTypeOrSegments?: "mega" | "arc" | "fork" | number
): LightningBolt {
  // Determine bolt type and segments
  let boltType: "mega" | "arc" | "fork" = "arc";
  let numSegments = 12;
  
  if (typeof boltTypeOrSegments === "string") {
    boltType = boltTypeOrSegments;
    switch (boltType) {
      case "mega":
        numSegments = 20 + Math.floor(Math.random() * 11); // 20-30
        break;
      case "arc":
        numSegments = 8 + Math.floor(Math.random() * 5); // 8-12
        break;
      case "fork":
        numSegments = 5 + Math.floor(Math.random() * 4); // 5-8
        break;
    }
  } else if (typeof boltTypeOrSegments === "number") {
    numSegments = boltTypeOrSegments;
    boltType = "arc"; // default
  }
  
  // Position based on bolt type
  let startX = Math.random() * canvasWidth;
  let startY = 0;
  let endX = startX;
  let endY = canvasHeight;
  let jitterAmount = 80;
  
  switch (boltType) {
    case "mega":
      // Full screen strikes
      startY = -50;
      endY = canvasHeight + 50;
      endX = startX + (Math.random() - 0.5) * canvasWidth * 0.4;
      jitterAmount = 120;
      break;
    case "arc":
      // Medium strikes (40-70% of screen)
      startY = 0;
      endY = canvasHeight * (0.4 + Math.random() * 0.3);
      endX = startX + (Math.random() - 0.5) * canvasWidth * 0.3;
      jitterAmount = 80;
      break;
    case "fork":
      // Small strikes (20-40% of screen)
      startY = canvasHeight * 0.2;
      endY = canvasHeight * (0.4 + Math.random() * 0.2);
      endX = startX + (Math.random() - 0.5) * canvasWidth * 0.2;
      jitterAmount = 40;
      break;
  }
  
  const boltSegments: { x: number; y: number }[] = [];
  
  for (let i = 0; i < numSegments; i++) {
    const t = i / (numSegments - 1);
    const x = startX + (endX - startX) * t + (Math.random() - 0.5) * jitterAmount;
    const y = startY + (endY - startY) * t;
    boltSegments.push({ x, y });
  }
  
  // Add random branches based on bolt type
  const branches: LightningBolt[] = [];
  let branchChance = 0.3;
  let maxBranchDepth = 1;
  
  switch (boltType) {
    case "mega":
      branchChance = 0.7;
      maxBranchDepth = 4;
      break;
    case "arc":
      branchChance = 0.5;
      maxBranchDepth = 2;
      break;
    case "fork":
      branchChance = 0.3;
      maxBranchDepth = 1;
      break;
  }
  
  if (Math.random() < branchChance && numSegments > 5) {
    const branchIdx = 3 + Math.floor(Math.random() * (numSegments - 6));
    const branchStart = boltSegments[branchIdx];
    const branchSegments: { x: number; y: number }[] = [branchStart];
    const branchLength = Math.floor(numSegments / 3);
    const branchAngle = (Math.random() - 0.5) * Math.PI / 2;
    
    for (let i = 1; i < branchLength; i++) {
      const t = i / branchLength;
      const x = branchStart.x + Math.cos(branchAngle) * canvasWidth * 0.2 * t + (Math.random() - 0.5) * 40;
      const y = branchStart.y + Math.sin(branchAngle + Math.PI / 2) * canvasHeight * 0.3 * t;
      branchSegments.push({ x, y });
    }
    
    const branch: LightningBolt = {
      segments: branchSegments,
      life: 0,
      maxLife: 0.15,
      alpha: 0.7,
      branches: [],
      boltType: "fork"
    };
    
    // Recursive branching for mega bolts
    if (boltType === "mega" && maxBranchDepth > 1 && Math.random() < 0.5) {
      const subBranch = generateLightningBolt(canvasWidth, canvasHeight, "fork");
      branch.branches.push(subBranch);
    }
    
    branches.push(branch);
  }
  
  // Longer lifetime based on bolt type
  let maxLife = 0.2;
  switch (boltType) {
    case "mega":
      maxLife = 0.8 + Math.random() * 0.4; // 0.8-1.2s
      break;
    case "arc":
      maxLife = 0.4 + Math.random() * 0.3; // 0.4-0.7s
      break;
    case "fork":
      maxLife = 0.2 + Math.random() * 0.2; // 0.2-0.4s
      break;
  }
  
  return {
    segments: boltSegments,
    life: 0,
    maxLife,
    alpha: 1.0,
    branches,
    boltType
  };
}

// Helper function to select weighted bolt type for Level 4
export function selectBoltType(): "mega" | "arc" | "fork" {
  const roll = Math.random();
  if (roll < 0.4) return "mega"; // 40% mega bolts
  if (roll < 0.75) return "arc"; // 35% arc bolts
  return "fork"; // 25% fork bolts
}

// Export Level 4 constants for use in GameEngine
export const LEVEL4_CONSTANTS = {
  INTERVAL_MIN: LEVEL4_LIGHTNING_INTERVAL_MIN,
  INTERVAL_MAX: LEVEL4_LIGHTNING_INTERVAL_MAX,
  MAX_CONCURRENT: LEVEL4_MAX_CONCURRENT_BOLTS,
  MAX_CONCURRENT_LOW: LEVEL4_MAX_CONCURRENT_BOLTS_LOW
};
