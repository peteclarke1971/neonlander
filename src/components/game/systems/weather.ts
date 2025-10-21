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
  segments: number = 8
): LightningBolt {
  const startX = Math.random() * canvasWidth;
  const startY = -canvasHeight * 0.2;
  const endX = startX + (Math.random() - 0.5) * canvasWidth * 0.5;
  const endY = Math.random() * canvasHeight;
  
  const boltSegments: { x: number; y: number }[] = [];
  boltSegments.push({ x: startX, y: startY });
  
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const x = startX + (endX - startX) * t + (Math.random() - 0.5) * 80;
    const y = startY + (endY - startY) * t + (Math.random() - 0.5) * 60;
    boltSegments.push({ x, y });
  }
  
  boltSegments.push({ x: endX, y: endY });
  
  // Generate branches (30% chance per segment)
  const branches: LightningBolt[] = [];
  for (let i = 2; i < boltSegments.length - 2; i++) {
    if (Math.random() < 0.3) {
      const branchStart = boltSegments[i];
      const branchSegs: { x: number; y: number }[] = [branchStart];
      
      const branchLength = 3 + Math.floor(Math.random() * 3);
      let bx = branchStart.x;
      let by = branchStart.y;
      
      for (let j = 0; j < branchLength; j++) {
        bx += (Math.random() - 0.5) * 100;
        by += Math.random() * 80;
        branchSegs.push({ x: bx, y: by });
      }
      
      branches.push({
        segments: branchSegs,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        alpha: 1,
        branches: []
      });
    }
  }
  
  return {
    segments: boltSegments,
    life: 0,
    maxLife: 0.3 + Math.random() * 0.2,
    alpha: 1,
    branches
  };
}
