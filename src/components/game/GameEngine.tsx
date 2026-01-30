import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HUD } from "./HUD";
import { InFlightTip } from "./InFlightTip";
import { getGlobalAudioManager } from "./AudioManager";
import { CavernFXRenderer } from "./CavernFXRenderer";
import { WaterFXRenderer } from "./WaterFXRenderer";
import { createCountdownIntro, IntroHandle, mix } from "./intro/CountdownIntro";
import { CountdownOverlay } from "./intro/CountdownOverlay";
import { CavernFXParams } from "./systems/cavernFX";
import { CavernBakeResult } from "./systems/cavernBake";
import { CoreComposition } from "./systems/coreComposition";
import { Difficulty, GameOverData, HUDSnapshot, TerrainData, Mode, Pad, MovingPad, CollectiblesData, SpaceJunk, WormholeDoor, SequencedPad, Jellyfish } from "./types";
import { checkJunkPickup, checkWormholeEntry, collectJunk, generateWormholeDoor } from "./systems/collectibles";
import { renderSpaceJunk, renderWormholeDoor, generateSparkles, updateSparkles, SPACE_JUNK_ASSETS } from "./systems/spaceJunkAssets";
import { generateTerrain } from "./terrain";
import { movingPadSystem } from "./systems/movingPads";
import FireworksDisplay from './FireworksDisplay';
import { BonusMessageDisplay } from './BonusMessageDisplay';
import { getTimeTrialLevelConfig } from "./systems/timeTrialLevels";
import { getDecorationsForLevel, preloadDecorationImages, renderDecorations, BackgroundDecoration } from "./systems/backgroundDecorations";
import { generateLightningBolt, selectBoltType, LEVEL4_CONSTANTS, LightningBolt, LightningAfterglow, LightningImpact } from "./systems/weather";
import { renderLightningBolts, updateLightningBolts } from "./systems/weatherRenderer";
import { renderLightningFlash, renderLightningAfterglow, renderLightningImpact, renderOzoneGlow } from "./systems/weatherRendererExtended";

// Simple seeded PRNG (Mulberry32) - needed for random effects
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
import { generateCavern, CavernData } from "./cavern";
import { getCavernSeed } from "./systems/fixedCavernMode";
import { isWaterLevel, isLightningLevel, isCollectionLevel } from "./systems/levelConfig";
import { getIntroLevelType, getNextIntroName } from "./systems/levelIntroNames";
import { getMedleyLevelType, getMedleySeed, getMedleyDifficulty, countNormalLevelsCompleted, getMedleyUFOConfig, shouldSpawnUFOsInMedley, isEarlyMedleyNormalLevel, getMedleyNormalLevelNumber } from "./systems/medleyConfig";
import { generateWindZones, windAccelAt, drawWindVectors } from "./systems/wind";
import { createStylePointsState, update360Tracking, updateNearMiss, checkPerfectLanding, resetStylePoints, StylePointsState } from "./systems/stylePoints";
import { generateAnomalies, anomalyAccelAt, drawAnomaliesField } from "./systems/anomalies";
import { generateHazards, updateHazards, drawHazards, checkHazardCollision } from "./systems/hazards";
import { updateVolcanoes, drawVolcanoes, checkVolcanoParticleCollision, getVolcanoWarningState, VolcanoParticle } from "./systems/volcano";
import { updateCavernVolcanoParticles, createCavernVolcanoParticles } from "./systems/cavernVolcanoParticles";
import { getCavernVolcanoConfigForLevel } from "./systems/cavernVolcano";
import { 
  spawnUFO, 
  updateUFO, 
  updateProjectiles, 
  checkUFOCollision, 
  checkProjectileCollision,
  checkUFOToUFOCollisions,
  DEFAULT_UFO_CONFIG 
} from "./systems/landerUFO";
import { 
  spawnSmallUFO, 
  spawnLargeUFO, 
  updateSmallUFO, 
  updateLargeUFO, 
  UFO_CONFIGS 
} from "./systems/landerUFOBehaviors";
import { 
  initUFOSpawnState, 
  getActiveUFOCount, 
  type UFOSpawnState 
} from "./systems/landerUFOManager";
import {
  shouldHaveUFOs,
  getUFOConfigForLevel,
  generateUFOSeed,
  generateUFOSpawnSchedule,
  getMedleyUFOConfigForLevel,
  getMaxActiveUFOs,
  type LevelUFOConfig,
  type UFOSpawnEvent
} from "./systems/ufoProgression";
import { drawAllUFOs } from "./systems/landerUFORender";
import type { LanderUFO, UFOProjectile, UFOType, UFOTypeConfig } from "./types/landerUFO";
import { anyGamepad, loadProfile, readGamepad, saveProfile, setLastDeviceId, vibrate, getLastDeviceId, setUiMode } from "@/hooks/use-gamepad";
import { DEFAULT_ROTATION_MOD_CONFIG, updateRotationModifier, applyRotationModifier, RotationModConfig } from "./systems/rotationMod";
import { CursorManager } from "@/lib/cursorManager";
import { loadCursorConfig } from "@/lib/cursorConfig";
import { PerformanceManager } from "./utils/performanceManager";
import { particlePool, debrisPool } from "./utils/objectPool";
import { GhostManager, LunarLanderGhostFrame, LunarLanderGhostState } from "./GhostManager";
import { GraphicsLevel, getGraphicsValue, isOptimizedGraphics } from "@/lib/graphicsConfig";
import { createDemoAI, updateDemoAI, DemoAIState } from "./DemoAI";
import { InitialsEntry } from "./InitialsEntry";
import { fetchGlobalGhost, submitTimeTrialScore, submitGlobalGhost } from "@/lib/leaderboard";
import { hasPCControlsPreference, setPCControlsPreference, isDesktopDevice, isIPadDevice } from "@/lib/deviceDetection";
import { showTipAlways, TipDefinition } from "@/lib/inFlightGuide";

interface Props {
  difficulty: Difficulty;
  onExit: () => void;
  onGameOver: (data: GameOverData) => void;
  initialScore?: number;
  initialLandings?: number;
  level?: number;
  mode: Mode;
  graphicsLevel?: GraphicsLevel;
  showCavernFX?: boolean;
  cavernFXParams?: CavernFXParams;
  seedOverride?: number;
  showGhost?: boolean;
  ghostLevel?: number;
  isDemo?: boolean;
  onRetryLevel?: () => void;
  onContinueLevel?: (nextLevel: number) => void;
  spawnOverride?: { x: number; y: number };
  nebulaFxEnabled?: boolean;
  largeRotateButtons?: boolean;
  showFullHUD?: boolean;
  initialShieldActive?: boolean;
  initialShieldTimer?: number;
}

const WORLD_WIDTH = 4000;
const BASE_HEIGHT = 360; // base ground height
const AMPLITUDE = 180;

// Abort system configuration
const ABORT_ROTATION_DURATION = 0.4; // seconds to smoothly rotate to level
const ABORT_BOOST_VELOCITY = -180; // instant upward velocity change
const ABORT_FUEL_COST = 50; // fixed fuel cost per abort activation
const ABORT_CAMERA_SHAKE = 12; // visual impact intensity

// Jellyfish update and burst logic
function updateJellyfish(
  jellyfish: Jellyfish[],
  dt: number,
  elapsed: number,
  worldWidth: number,
  worldHeight: number
): void {
  for (const jf of jellyfish) {
    // Horizontal drift with world wrapping
    jf.x += jf.vx * dt;
    jf.x = ((jf.x % worldWidth) + worldWidth) % worldWidth;
    
    // Vertical bobbing (sine wave)
    jf.bobbingPhase += jf.bobbingSpeed * dt;
    const targetOffset = Math.sin(jf.bobbingPhase) * jf.bobbingAmplitude;
    jf.targetY = jf.y + targetOffset;
    
    // Smooth interpolation to target Y
    const yDiff = targetOffset - (jf.y - (jf.y - targetOffset));
    jf.vy = yDiff * 0.5; // Smooth following
    jf.y += jf.vy * dt;
    
    // Keep within bounds (no wrapping vertically)
    if (jf.y < 50) jf.y = 50;
    if (jf.y > worldHeight - 50) jf.y = worldHeight - 50;
    
    // Update tentacle animation
    jf.tentaclePhase += dt * 2;
    
    // Electric burst state machine
    if (!jf.isTelegraphing && !jf.isBursting) {
      // Countdown to next burst
      jf.burstTimer -= dt;
      
      if (jf.burstTimer <= 1.5) {
        // Start telegraphing (1.5s warning)
        jf.isTelegraphing = true;
        jf.telegraphTimer = 1.5;
        jf.glowIntensity = 1.5; // Brighten
      }
    } else if (jf.isTelegraphing) {
      // Telegraph warning
      jf.telegraphTimer -= dt;
      jf.glowIntensity = 1.5 + Math.sin(elapsed * 15) * 0.5; // Pulsing glow
      
      if (jf.telegraphTimer <= 0) {
        // Trigger burst!
        jf.isTelegraphing = false;
        jf.isBursting = true;
        jf.burstProgress = 0;
      }
    } else if (jf.isBursting) {
      // Active shockwave
      jf.burstProgress += dt / jf.burstDuration;
      
      if (jf.burstProgress >= 1.0) {
        // Burst complete
        jf.isBursting = false;
        jf.burstProgress = 0;
        jf.glowIntensity = 0.5 + Math.random() * 0.5; // Back to normal
        jf.burstTimer = jf.burstInterval; // Reset timer
      }
    }
  }
}

// Check jellyfish collisions
function checkJellyfishCollision(
  jellyfish: Jellyfish[],
  landerX: number,
  landerY: number,
  landerRadius: number
): {
  directHit: Jellyfish | null;
  shockwaveHit: Jellyfish | null;
} {
  let directHit: Jellyfish | null = null;
  let shockwaveHit: Jellyfish | null = null;
  
  for (const jf of jellyfish) {
    const dx = landerX - jf.x;
    const dy = landerY - jf.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Direct collision with jellyfish body
    const bodyRadius = jf.size * 0.6; // Bell is ~60% of size
    if (dist < landerRadius + bodyRadius) {
      directHit = jf;
      break; // Fatal collision, no need to check more
    }
    
    // Shockwave collision (only during burst)
    if (jf.isBursting) {
      const shockwaveRadius = 75 * jf.burstProgress; // Expands to 75px
      if (dist < shockwaveRadius + landerRadius) {
        shockwaveHit = jf;
        // Don't break - check all jellyfish for closest burst
      }
    }
  }
  
  return { directHit, shockwaveHit };
}

export const GameEngine: React.FC<Props> = ({
  difficulty, 
  onExit, 
  onGameOver, 
  initialScore, 
  initialLandings, 
  level = 0, 
  mode, 
  graphicsLevel = "low", 
  showCavernFX = false, 
  cavernFXParams, 
  seedOverride, 
  showGhost = false, 
  ghostLevel, 
  isDemo = false,
  onRetryLevel,
  onContinueLevel,
  spawnOverride,
  nebulaFxEnabled = true,
  largeRotateButtons = true,
  showFullHUD = true,
  initialShieldActive = false,
  initialShieldTimer = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HUDSnapshot>({ altitude: 0, vx: 0, vy: 0, fuel: 100, score: initialScore ?? 0, time: 0, difficulty });
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const initialSpawnRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isUsingPCControls, setIsUsingPCControls] = useState(() => {
    // Check localStorage first, then check if desktop device
    return hasPCControlsPreference() || isDesktopDevice();
  });
  const [touchOpacity, setTouchOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ll-touch-opacity');
      return saved ? JSON.parse(saved) : 10;
    } catch {
      return 10;
    }
  });
  const [fps, setFps] = useState(0);
  const [showFPSSetting] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-show-fps');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [performanceManager] = useState(() => new PerformanceManager());
  const [showFireworks, setShowFireworks] = useState(false);
  
  // Fireworks system state
  const [fireworksActive, setFireworksActive] = useState(false);
  const [landingType, setLandingType] = useState<'regular' | 'moving' | '2x' | 'ghost-beaten' | null>(null);
  const [fireworkStartTime, setFireworkStartTime] = useState(0);
  const [neonColor, setNeonColor] = useState('#00FFFF');
  const [currentLandings, setCurrentLandings] = useState(0);
  const [isWorldRecord, setIsWorldRecord] = useState(false);
  
  // Screen-space ship position for countdown overlay (CSS pixels)
  const [shipScreenPos, setShipScreenPos] = useState<{ x: number; y: number } | null>(null);
  
  // Countdown intro state
  const introRef = useRef<IntroHandle | null>(null);
  const [introState, setIntroState] = useState<any>({ phase: "inactive" });
  const [worldPaused, setWorldPaused] = useState(false);
  const [playerLocked, setPlayerLocked] = useState(false);
  
  // Bonus message display state (separate from game loop)
  const [bonusMessages, setBonusMessages] = useState<string[]>([]);
  const [showBonusMessages, setShowBonusMessages] = useState(false);
  const [skipCelebration, setSkipCelebration] = useState(false);
  const worldPausedRef = useRef(false);
  const playerLockedRef = useRef(false);
  const invulnerabilityTimer = useRef(0);
  const hasShownBonusThisLanding = useRef(false);
  
  // Timer state for speed bonus calculation
  const [timerActive, setTimerActive] = useState(false);
  const timerActiveRef = useRef(false);
  const timerStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation frame ref for proper cleanup
  const rafRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  
  // Anti-throttling frame marker counter (bypasses Chromium's frame rate throttling)
  const frameMarkerRef = useRef(0);
  
  // Landing bonus tracking state
  const [lastLandingBonuses, setLastLandingBonuses] = useState<{
    bullseye: boolean;
    speedBonus: boolean;
    padBonus2x: boolean;
    lastEarned: number;
  }>({ bullseye: false, speedBonus: false, padBonus2x: false, lastEarned: 0 });
  
  // Special level type refs (blackout and light beam)
  const specialLevelType = useRef<'normal' | 'blackout' | 'lightbeam'>('normal');
  const blackoutActive = useRef(false);
  const lightStormActive = useRef(false);
  const offscreenTerrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenTerrainCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sweepPhaseRef = useRef(0);
  
  // Separate refs for dual ghost support in Fixed/Medley modes
  const fixedLocalGhost = useRef<any>(null);
  const fixedGlobalGhost = useRef<any>(null);
  const sweepTimerRef = useRef(0);
  const sweepXRef = useRef(0);
  const sweepActiveRef = useRef(false);
  const currentBeamWidthRef = useRef(300); // Initial beam width
  const SPOTLIGHT_ANGLE = 25 * (Math.PI / 180); // 25° cone
  const SPOTLIGHT_RANGE = 400; // world units
  const LIGHT_STORM_SWEEP_SPEED = 9.0; // seconds to cross screen
  const LIGHT_STORM_INITIAL_BEAM_WIDTH = 300;
  const LIGHT_STORM_MIN_BEAM_WIDTH = 75;
  
  // Pre-level message state for special levels
  const [specialLevelMessage, setSpecialLevelMessage] = useState<string>("");
  const [showSpecialMessage, setShowSpecialMessage] = useState(false);
  const [waitingForSpecialMessage, setWaitingForSpecialMessage] = useState(false);
  const messageShownForLevel = useRef<number>(-1); // Track which level we showed message for
  
  // Camera and cavern state for FX renderer
  const [cameraState, setCameraState] = useState({ cameraX: 0, cameraY: 0, viewWidth: 800, viewHeight: 600, anchor: 0, zoom: 1 });
  const [cavernBakeResult, setCavernBakeResult] = useState<CavernBakeResult | null>(null);
  const [coreComposition] = useState(() => new CoreComposition());
  
  // Terrain ref for fireworks masking
  const terrainDataRef = useRef<TerrainData | CavernData | null>(null);
  
  // Random effects state for first 5 levels
  const [hasRandomEffects, setHasRandomEffects] = useState(false);
  const [randomEffectParams, setRandomEffectParams] = useState<CavernFXParams | undefined>(undefined);
  
  // Performance monitoring and optimization state
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIPhone = /iPhone/i.test(navigator.userAgent);
  const isIPad = isIPadDevice();
  const shouldOptimizePerformance = isOptimizedGraphics(graphicsLevel);
  const shouldOptimizeLightBeam = isIPad && isOptimizedGraphics(graphicsLevel);
  // iPad thruster optimization: use fast fillRect rendering on mid/high GFX (matches SurvivalEngine approach)
  const useIPadThrusterOptimization = isIPad && !shouldOptimizePerformance;
  const [performanceGoverning, setPerformanceGoverning] = useState(false);
  const frameTimeAccumulator = useRef(0);
  const lastPerformanceCheck = useRef(0);
  
  // Volcano particles state
  const [volcanoParticles, setVolcanoParticles] = useState<VolcanoParticle[]>([]);
  
  // Collectibles state
  const collectiblesRef = useRef<CollectiblesData | null>(null);
  const sparklesRef = useRef<Map<string, any>>(new Map());
  
  // Shield state (from collectibles set completion)
  const SHIELD_DURATION = 75; // seconds (same as Survival mode)
  const shieldActiveRef = useRef(initialShieldActive);
  const [shieldActive, setShieldActive] = useState(initialShieldActive);
  const shieldTimerRef = useRef(initialShieldActive ? (initialShieldTimer > 0 ? initialShieldTimer : SHIELD_DURATION) : 0);
  
  // Track if landing sound has been played for current landing
  const hasPlayedLandingSoundRef = useRef(false);
  
  // Background decorations system
  const bgDecorationsRef = useRef<BackgroundDecoration[]>([]);
  const bgDecorationImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const bgDecorationStartTimeRef = useRef<number>(0);
  
  // Terrain-masked fireworks setting
  const [terrainMaskedFireworks] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-terrain-masked-fireworks');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  
  // In-flight tip state
  const [currentTip, setCurrentTip] = useState<TipDefinition | null>(null);
  const tipShownThisLevel = useRef(false);
  
  // Show contextual tips based on level and mode (shows every time if tips enabled)
  useEffect(() => {
    if (isDemo || tipShownThisLevel.current) return;
    
    // Delay tip to not overlap with countdown
    const tipTimeout = setTimeout(() => {
      let tip: TipDefinition | null = null;
      
      // Time trial specific tip
      if (mode === 'timetrial') {
        tip = showTipAlways('timetrial');
      }
      // Level-specific tips for classic/fixed modes
      else if (mode === 'classic' || mode === 'fixed') {
        if (level === 1 || level === 0) {
          tip = showTipAlways('basic');
        } else if (level === 2) {
          tip = showTipAlways('landing');
        } else if (level === 3) {
          tip = showTipAlways('junk');
        } else if (level === 4) {
          // Level 4 is also a storm level - show shield tip instead
          // (storm tip shows on subsequent storm levels)
          tip = showTipAlways('shield');
        } else if (level === 9) {
          // First blackout level
          tip = showTipAlways('blackout');
        } else if (isLightningLevel(mode, level) && level !== 4) {
          // Storm levels after level 4
          tip = showTipAlways('storm');
        }
      }
      // Basic controls on level 1 for other modes
      else if (level === 1 || level === 0) {
        tip = showTipAlways('basic');
      }
      
      if (tip) {
        setCurrentTip(tip);
        tipShownThisLevel.current = true;
      }
    }, 2500); // Wait for countdown to finish
    
    return () => clearTimeout(tipTimeout);
  }, [level, mode, isDemo]);

  // Time Trial state
  const [timeTrialState, setTimeTrialState] = useState({
    sequencedPads: [] as SequencedPad[],
    currentTarget: 1,
    completedSequence: [] as number[],
    raceStartTime: 0,
    raceEndTime: 0,
    raceActive: false,
    totalPadsRequired: 2
  });
  const timeTrialStateRef = useRef(timeTrialState);
  useEffect(() => { timeTrialStateRef.current = timeTrialState; }, [timeTrialState]);
  
  // Time Trial ghost recording refs
  const timeTrialGhostFrames = useRef<LunarLanderGhostFrame[]>([]);
  const timeTrialLoadedGhost = useRef<any>(null); // Global ghost
  const timeTrialLocalGhost = useRef<any>(null); // Local ghost
  const timeTrialGhostType = useRef<'local' | 'global'>('local');
  
  const timeTrialCompletionDataRef = useRef<{
    completionTime: number;
    level: number;
    difficulty: Difficulty;
    ghostFrames: any[];
  } | null>(null);

  // Controls state
  const keys = useRef<{ left: boolean; right: boolean; thrust: boolean; abort: boolean; rotateBoost: boolean }>({ left: false, right: false, thrust: false, abort: false, rotateBoost: false });
  const thrustAnalog = useRef(0);
  const lastThrust = useRef(0);
  const audio = useRef(getGlobalAudioManager());
  const abortAssist = useRef(false);
  // Gamepad profile/device state
  const gpProfileRef = useRef(loadProfile(getLastDeviceId()));
  const gpDeviceIdRef = useRef<string | null>(getLastDeviceId());
  const lastPauseDown = useRef(false);
  const lastAbortDown = useRef(false);
  
  // Liquid fuel sloshing physics refs (matches SurvivalEngine implementation)
  const liquidFuelEnabledRef = useRef<boolean>((() => {
    try {
      const saved = localStorage.getItem('ll-liquid-fuel-enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  })());
  const liquidTiltAngleRef = useRef(0);        // Current tilt of liquid surface
  const liquidTiltVelocityRef = useRef(0);     // Angular velocity of tilt
  const liquidWavePhaseRef = useRef(0);        // Phase for wave animation
  const liquidWaveAmplitudeRef = useRef(0);    // Current wave amplitude
  const prevShipVxRef = useRef(0);             // Previous frame velocity X
  const prevShipVyRef = useRef(0);             // Previous frame velocity Y  
  const prevShipAngularVelRef = useRef(0);     // Previous frame angular velocity
  const visualFuelRef = useRef(100);           // Smoothed fuel for animation
  const prevFuelPercentRef = useRef(1.0);      // Previous fuel percentage
  const forceSloshingTimerRef = useRef(0);     // Timer for post-refuel sloshing
  
  // Abort animation state
  const abortRotationActive = useRef(false);
  const abortStartAngle = useRef(0);
  const abortRotationProgress = useRef(0);
  const abortPenaltyCharged = useRef(false);
  
  // Rotation modifier state
  const [rotModConfig] = useState<RotationModConfig>(DEFAULT_ROTATION_MOD_CONFIG);
  const rotBoostActive = useRef(1.0); // current interpolated multiplier
  const [showRotBoostHint, setShowRotBoostHint] = useState(false);
  
  // Cursor management
  const cursorManager = useRef<CursorManager | null>(null);
  
  // Ghost recording and playback system
  const ghostManager = useRef(new GhostManager());
  const [ghostRecording, setGhostRecording] = useState<LunarLanderGhostFrame[]>([]);
  const [ghostState, setGhostState] = useState<LunarLanderGhostState | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const lastRecordTime = useRef(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  
  // Demo AI system
  const demoAI = useRef<DemoAIState | null>(null);
  const [demoStartTime, setDemoStartTime] = useState<number>(0);
  
  // Style points tracking
  const stylePointsStateRef = useRef<StylePointsState>(createStylePointsState());
  
  // Lightning system state
  const lightningBolts = useRef<LightningBolt[]>([]);
  const lightningAfterglows = useRef<LightningAfterglow[]>([]);
  const lightningImpacts = useRef<LightningImpact[]>([]);
  const lightningDebris = useRef<any[]>([]);
  const nextLightningTime = useRef<number>(0.5 + Math.random() * 1.5);
  const screenFlashAlpha = useRef<number>(0);
  
  // Level type detection
  const lightningEnabled = isLightningLevel(mode, level);
  const isUnderwater = isWaterLevel(mode, level);
  
  // UFO enemy system
  const ufoSpawnStateRef = useRef<UFOSpawnState>(initUFOSpawnState());
  const allProjectilesRef = useRef<UFOProjectile[]>([]);
  const ufoSpawnScheduleRef = useRef<UFOSpawnEvent[]>([]);
  const ufoLevelConfigRef = useRef<LevelUFOConfig | null>(null);
  
  // Shield invulnerability after shield break (brief immunity)
  const shieldInvulnerableRef = useRef(false);
  const shieldInvulnerableTimerRef = useRef(0);
  const SHIELD_INVULNERABLE_DURATION = 0.75; // seconds (matches SurvivalEngine)
  
  // Hint system: show rotation boost hint on first hard level
  useEffect(() => {
    const hintShown = localStorage.getItem('ll-rotation-boost-hint-shown');
    if (!hintShown && difficulty === "hard" && level === 1) {
      setShowRotBoostHint(true);
      setTimeout(() => {
        setShowRotBoostHint(false);
        localStorage.setItem('ll-rotation-boost-hint-shown', 'true');
      }, 4000);
    }
  }, [difficulty, level]);
  useEffect(() => {
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = canvasRef.current!;
      const parent = containerRef.current!;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;

      // Also compute initial on-screen ship position for the countdown overlay (CSS pixels)
      const yCss = (mode === "caverns") ? h / 2 : h * 0.45;
      setShipScreenPos({ x: w / 2, y: yCss });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      // Skip keyboard input in demo mode
      if (isDemo) return;
      
      const k = e.key.toLowerCase();
      if (["a", "arrowleft"].includes(k)) {
        keys.current.left = down;
        if (down) {
          setIsUsingPCControls(true);
          setPCControlsPreference(true);
        }
      }
      if (["d", "arrowright"].includes(k)) {
        keys.current.right = down;
        if (down) {
          setIsUsingPCControls(true);
          setPCControlsPreference(true);
        }
      }
      if (["w", "arrowup"].includes(k)) {
        keys.current.thrust = down;
        if (down) {
          setIsUsingPCControls(true);
          setPCControlsPreference(true);
        }
      }
      if (k === " " || k === "arrowdown") {
        keys.current.abort = down;
        if (down) {
          abortAssist.current = true;
          setIsUsingPCControls(true);
          setPCControlsPreference(true);
        }
      }
      if (["shift"].includes(k)) {
        keys.current.rotateBoost = down;
        if (down) {
          setIsUsingPCControls(true);
          setPCControlsPreference(true);
        }
      }
      if (down) audio.current.resume();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [isDemo]);

  // Ensure UI mode is off during gameplay
  useEffect(() => { try { setUiMode(false); } catch {} }, []);

  // Sync neonColor state with CSS --neon variable when level changes
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const neonValue = styles.getPropertyValue('--neon').trim();
    if (neonValue) {
      setNeonColor(`hsl(${neonValue})`);
    }
  }, [level]);

  // Cursor management setup
  useEffect(() => {
    if (!containerRef.current) return;
    
    const config = loadCursorConfig();
    cursorManager.current = new CursorManager(config);
    
    // In GameEngine, the game is "active" when not paused and the game loop is running
    const isGameplayFn = () => !paused;
    cursorManager.current.attach(containerRef.current, isGameplayFn);
    cursorManager.current.forceHideCursor();
    
    return () => {
      cursorManager.current?.detach();
      cursorManager.current = null;
    };
  }, []);
  
  // Update cursor manager when game state changes
  useEffect(() => {
    if (paused) {
      cursorManager.current?.forceShowCursor();
    }
  }, [paused]);

  // Hide cursor at level start
  useEffect(() => {
    cursorManager.current?.forceHideCursor();
  }, [level]);

  // Keep refs in sync with state for game loop
  useEffect(() => { worldPausedRef.current = worldPaused; }, [worldPaused]);
  useEffect(() => { playerLockedRef.current = playerLocked; }, [playerLocked]);
  useEffect(() => { timerActiveRef.current = timerActive; }, [timerActive]);

  // Detect touch-capable devices (enable touch-to-thrust overlay)
  useEffect(() => {
    try {
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints ?? 0) > 0 || (navigator as any).msMaxTouchPoints > 0;
      setIsTouch(!!hasTouch);
    } catch {
      setIsTouch(false);
    }
  }, []);
  
  // Setup off-screen canvas for special level effects
  useEffect(() => {
    offscreenTerrainCanvasRef.current = document.createElement('canvas');
    offscreenTerrainCtxRef.current = offscreenTerrainCanvasRef.current.getContext('2d');
    return () => {
      offscreenTerrainCanvasRef.current = null;
      offscreenTerrainCtxRef.current = null;
    };
  }, []);

  // Force unmount bonus messages after calculated duration
  useEffect(() => {
    if (showBonusMessages && bonusMessages.length > 0) {
      const totalDuration = bonusMessages.length * 2000; // 2 seconds per message
      const timer = setTimeout(() => {
        setShowBonusMessages(false);
        setBonusMessages([]);
        hasShownBonusThisLanding.current = false;
      }, totalDuration);
      
      return () => clearTimeout(timer);
    }
  }, [showBonusMessages, bonusMessages]);

  useEffect(() => {
    console.log("🎮 GameEngine mounting with:", { difficulty, mode, level, seedOverride, isDemo });
    mountedRef.current = true; // Reset on mount
    
    // Determine intro level type using the new system
    const introType = getIntroLevelType(mode, level);
    
    // Map intro types back to special level type for internal use
    let levelType: 'normal' | 'blackout' | 'lightbeam' = 'normal';
    if (introType === 'darkside') levelType = 'blackout';
    else if (introType === 'search') levelType = 'lightbeam';
    
    // Show intro names for all level types (null means no intro, e.g., caverns mode)
    const isSpecialLevel = introType !== null;
    
    // If we have a special intro type and haven't shown the message yet, STOP and show message
    if (isSpecialLevel && messageShownForLevel.current !== level && !waitingForSpecialMessage) {
      messageShownForLevel.current = level;
      specialLevelType.current = levelType;
      
      // Set flags for special level types
      if (introType === 'darkside') {
        blackoutActive.current = true;
      } else if (introType === 'search') {
        lightStormActive.current = true;
        sweepTimerRef.current = 0;
        sweepXRef.current = 0;
        sweepActiveRef.current = true;
        currentBeamWidthRef.current = LIGHT_STORM_INITIAL_BEAM_WIDTH;
      }
      
      // Get the rotating intro name for this level type
      const introName = getNextIntroName(introType);
      setSpecialLevelMessage(introName);
      setShowSpecialMessage(true);
      setWaitingForSpecialMessage(true);
      return; // Don't call initializeGame yet - wait for message to complete
    }
    
    // If we're waiting for the message to complete, don't initialize
    if (waitingForSpecialMessage) {
      return;
    }
    
    const initializeGame = async () => {
      const c = canvasRef.current!;
      const ctx = c.getContext("2d")!;
    const styles = getComputedStyle(document.documentElement);
    const currentNeonColor = `hsl(${styles.getPropertyValue('--neon')})`;
    const bgColor = `hsl(${styles.getPropertyValue('--background')})`;
    
    // Update React state so CountdownOverlay receives the correct level-specific color
    setNeonColor(currentNeonColor);
    // Clear volcano particles at start of each level
    setVolcanoParticles([]);
    
    // Special level type was already determined above, just sync the refs
    specialLevelType.current = levelType;
    
    // Sync off-screen canvas size with main canvas
    if (offscreenTerrainCanvasRef.current) {
      offscreenTerrainCanvasRef.current.width = c.width;
      offscreenTerrainCanvasRef.current.height = c.height;
    }
    
    // Initialize demo AI if in demo mode
    if (isDemo) {
      demoAI.current = createDemoAI(level);
      setDemoStartTime(performance.now());
      console.log("🤖 Demo AI initialized for level", level);
    }
    
    // Physics state
    const baseSeed = 873421;
    const fixedSeed = baseSeed + (difficulty === "hard" ? 100000 : 0) + (level | 0) * 9973;
    
    // For medley mode, use effective difficulty (linear with stage)
    let effectiveLevel = level;
    if (mode === "medley") {
      effectiveLevel = getMedleyDifficulty(level);
    }
    
    let levelVar = Math.min(Math.max(0, effectiveLevel), 20);
    
    // Reduce terrain complexity for special levels (make them slightly easier)
    if (specialLevelType.current === 'blackout' || specialLevelType.current === 'lightbeam') {
      levelVar = Math.max(0, levelVar - 1);
    }
    
    // Check if this is a cavern level - only in caverns mode
    const isCavernLevel = mode === "caverns";
    
    // Determine seed based on override/mode and level type
    let seed: number;
    let isTimeTrial = mode === "timetrial" || (mode === "medley" && getMedleyLevelType(level) === 'timetrial');
    let timeTrialConfig;
    
    // ALWAYS retrieve Time Trial config if in Time Trial mode OR medley timetrial stage
    if (mode === "timetrial" || (mode === "medley" && getMedleyLevelType(level) === 'timetrial')) {
      timeTrialConfig = getTimeTrialLevelConfig(level);
      console.log("⏱️ Time Trial level config loaded:", {
        level,
        mode,
        medleyType: mode === "medley" ? getMedleyLevelType(level) : 'N/A',
        configSeed: timeTrialConfig.seed,
        padCount: timeTrialConfig.padCount,
        hasOverride: typeof seedOverride === "number"
      });
    }
    
    // NOW determine which seed to use
    if (typeof seedOverride === "number" && Number.isFinite(seedOverride)) {
      seed = (Math.abs(Math.floor(seedOverride)) >>> 0);
      console.log("🌱 Using seed override:", seed, isTimeTrial ? "(Time Trial mode preserved)" : "");
    } else if (isCavernLevel) {
      seed = getCavernSeed(mode, level, difficulty, baseSeed);
      console.log("🕳️ Using cavern seed:", seed, "for level", level);
    } else if (mode === "medley") {
      // Medley mode uses deterministic seeds
      seed = getMedleySeed(level, difficulty);
      console.log("🎭 Using Medley seed:", seed, "for stage", level, "type:", getMedleyLevelType(level));
    } else if (isTimeTrial && timeTrialConfig) {
      // Use Time Trial's deterministic seed
      seed = timeTrialConfig.seed;
      console.log("⏱️ Using Time Trial seed:", seed, "for level", level, "with", timeTrialConfig.padCount, "pads");
    } else {
      // Classic or fixed mode
      seed = mode === "fixed" ? fixedSeed : ((Math.floor(Math.random() * 1e9) ^ Date.now()) >>> 0);
      console.log("🎲 Using", mode, "mode seed:", seed, "for level", level);
    }
    let levelSeed = seed >>> 0;
    console.log("✅ Final levelSeed:", levelSeed);
    
    const terrain: TerrainData | CavernData = isCavernLevel 
      ? generateCavern(seed, level, difficulty)
      : (() => {
          let terrainAmp = AMPLITUDE * (1 + 0.2 * levelVar);
          
          // MEDLEY MODE: Increase terrain height variation for Regular Landing #2 and #3 in cycle 1
          if (mode === "medley" && isEarlyMedleyNormalLevel(level)) {
            const normalNum = getMedleyNormalLevelNumber(level);
            if (normalNum === 2 || normalNum === 3) {
              terrainAmp *= 1.15; // 15% more height variation for visual interest
            }
          }
          
          const isTimeTrialMode = isTimeTrial; // Use the correct check that includes medley time trial levels
          const timeTrialPadCount = timeTrialConfig?.padCount;
          return generateTerrain(seed, WORLD_WIDTH, BASE_HEIGHT, terrainAmp, levelVar, level, difficulty, isTimeTrialMode, timeTrialPadCount, mode, timeTrialConfig);
         })();
    
    // Store terrain for fireworks masking
    terrainDataRef.current = terrain;
    
    // Setup Time Trial state if in time trial mode
    if (isTimeTrial && !isCavernLevel && terrain.sequencedPads && timeTrialConfig) {
      // Use the sequenced pads from terrain generation (already numbered correctly)
      const sequencedPads = terrain.sequencedPads.map(pad => ({
        ...pad,
        completed: false // Reset completion state for new game
      }));
      
      setTimeTrialState({
        sequencedPads,
        currentTarget: 1,
        completedSequence: [],
        raceStartTime: 0,
        raceEndTime: 0,
        raceActive: false,
        totalPadsRequired: timeTrialConfig.padCount
      });
      
      console.log("⏱️ Time Trial initialized:", {
        level,
        padCount: timeTrialConfig.padCount,
        actualPadCount: sequencedPads.length,
        pads: sequencedPads.map(p => ({ seq: p.sequenceNumber, x: (p.xStart + p.xEnd) / 2 }))
      });
      
      // CRITICAL VALIDATION: Verify we have the correct number of pads
      if (sequencedPads.length !== timeTrialConfig.padCount) {
        console.error(`❌ CRITICAL: Expected ${timeTrialConfig.padCount} pads but got ${sequencedPads.length}!`);
      }
    }
    
    // ===== RUNTIME SANITY CHECKS =====
    if (!isCavernLevel && terrain.pads) {
      let issueCount = 0;
      for (const pad of terrain.pads) {
        const terrainY = terrain.getHeightAt((pad.xStart + pad.xEnd) / 2);
        const padError = Math.abs(pad.y - terrainY);
        if (padError > 1.0) {
          console.warn(`[GameEngine] SANITY CHECK: Static pad misaligned by ${padError.toFixed(1)}px at x=${((pad.xStart + pad.xEnd) / 2).toFixed(1)}`);
          issueCount++;
        }
      }
      if (issueCount > 0) {
        console.warn(`[GameEngine] Found ${issueCount} misaligned static pads`);
      }
    }
    
  // Initialize collectibles
  collectiblesRef.current = terrain.collectibles || null;
  if (collectiblesRef.current) {
    collectiblesRef.current.spaceJunk.forEach(junk => {
      sparklesRef.current.set(junk.id, generateSparkles(junk.seed));
    });
  }
    
    // Debug moving pads presence
    if (!isCavernLevel) {
      const t = terrain as TerrainData;
      const mpCount = t.movingPads?.length ?? 0;
      if (mpCount > 0) {
        const mp = t.movingPads![0];
        console.log("[MovingPad] Generated", { level, difficulty, mode, mp });
      } else {
        console.warn("[MovingPad] None generated", { level, difficulty, mode });
      }
    }
    // Set cavern data for FX renderer and core composition
    if (isCavernLevel) {
      const cavernData = terrain as CavernData;
      setCavernBakeResult(cavernData.bakeResult || null);
      
      // Initialize core composition with mineral formations
      if (cavernData.bakeResult) {
        coreComposition.play(cavernData.bakeResult, {
          density: showCavernFX ? 0.7 : 0.5, // Reduce density if graphics are disabled
          motionReduction: false // Could be tied to accessibility settings
        });
      }
    } else {
      setCavernBakeResult(null);
    }
    
    // Generate random effects for cavern levels (match landscape color)
    // In fixed mode, effects use deterministic seed; in classic mode, they're random per session
    const effectsEnabled = isCavernLevel;
    setHasRandomEffects(effectsEnabled);
    
    if (effectsEnabled) {
      // Use deterministic effects for fixed and caverns modes, random for classic
      const effectSeed = seed + 12345;
      const randFx = mulberry32(effectSeed);
      
      const effectParams: CavernFXParams = {
        intensity: 0.3 + randFx() * 0.4, // 0.3-0.7
        breathDepth: 0.2 + randFx() * 0.3, // 0.2-0.5
        rippleStrength: 0.1 + randFx() * 0.4, // 0.1-0.5
        lensWarp: 0.1 + randFx() * 0.2, // 0.1-0.3
        dustDensity: 0.3 + randFx() * 0.4, // 0.3-0.7
        glow: 0.4 + randFx() * 0.4, // 0.4-0.8
        motionReduction: randFx() > 0.5,
        colorMode: 'match'
      };
      setRandomEffectParams(effectParams);
    } else {
      setRandomEffectParams(undefined);
    }
    // Reset audio for new game and start level music (skip in demo mode - title music keeps playing)
    if (!isDemo) {
      try { audio.current.resetForNewGame(); } catch {}
      try { audio.current.preloadSFX(); } catch {}
      try { audio.current.playLevelTrackForLevel(level || 0); } catch {}
      
      // Ensure thruster is properly initialized after audio reset
      try { 
        // Give audio context a moment to stabilize, then pre-initialize thruster
        setTimeout(() => {
          audio.current.setThruster(0);
        }, 50);
      } catch {}
    }

    // After level 10, keep only small pads (skip for cavern levels AND time trial)
    if (levelVar >= 10 && !isCavernLevel && !isTimeTrial) {
      const widthOf = (p: { xStart: number; xEnd: number }) => (p.xEnd >= p.xStart ? (p.xEnd - p.xStart) : (terrain.worldWidth - p.xStart + p.xEnd));
      const small = terrain.pads.filter((p) => widthOf(p) <= 36);
      if (small.length > 0) {
        terrain.pads.splice(0, terrain.pads.length, ...small);
      } else {
        const sorted = [...terrain.pads].sort((a, b) => widthOf(a) - widthOf(b));
        terrain.pads.splice(0, terrain.pads.length, ...sorted.slice(0, Math.min(2, sorted.length)));
      }
    }

    // Phase 1 systems: wind (disabled), anomalies and moving hazards (seeded)
    const WIND_ENABLED = false;
    const windZones = WIND_ENABLED ? generateWindZones(seed, terrain.worldWidth, levelVar) : [];

    // Anomalies (gravity wells) — appear from level 3, start at 1, +1 every 3 levels, capped at 5.
    // In Time Trial mode, limit to 1 anomaly maximum
    const isTimeTrialMode = isTimeTrial;
    let anomalyCount = levelVar >= 3 ? Math.min(1 + Math.floor((levelVar - 3) / 3), 5) : 0;
    if (isTimeTrialMode) {
      anomalyCount = Math.min(anomalyCount, 1);
    }
    // Create seeded RNG for anomaly radius scaling
    const anomalySizeRng = mulberry32(levelSeed + 777); // Different offset from spawn RNG
    // Challenge multiplier: Level 1: 1.0x safety, Level 10: 0.85x, Level 20: 0.7x (minimum)
    const challengeMultiplier = Math.max(0.7, 1 - (levelVar * 0.015));
    let anomalies = generateAnomalies(seed, terrain.worldWidth, BASE_HEIGHT, terrain.pads, challengeMultiplier, levelVar).slice(0, anomalyCount).map((a) => ({
      ...a,
      // Apply consistent 0.25x scaling for visual size
      radius: a.radius * 0.25,
    }));
    
    // In Time Trial mode, validate anomaly proximity to sequenced pads
    if (isTimeTrialMode && anomalies.length > 0) {
      const MIN_HAZARD_DISTANCE = 200;
      const sequencedPads = terrain.pads.filter((p): p is SequencedPad => 'sequenceNumber' in p && typeof p.sequenceNumber === 'number');
      
      for (const pad of sequencedPads) {
        const padCenterX = (pad.xStart + pad.xEnd) / 2;
        
        for (const anomaly of anomalies) {
          const dx = Math.abs(padCenterX - anomaly.x);
          const wrappedDx = Math.min(dx, terrain.worldWidth - dx);
          const dy = Math.abs(pad.y - anomaly.y);
          const distance = Math.sqrt(wrappedDx * wrappedDx + dy * dy);
          
          if (distance < MIN_HAZARD_DISTANCE) {
            console.warn(`[TimeTrial] ⚠️ Pad ${pad.sequenceNumber} is ${distance.toFixed(0)}px from gravity well (minimum: ${MIN_HAZARD_DISTANCE}px)`);
          }
        }
      }
    }

    // Moving hazards — appear from level 3, start at 1, +1 every 5 levels, capped at 4. Disabled in caverns.
    const hazardCount = isCavernLevel ? 0 : (levelVar >= 3 ? Math.min(1 + Math.floor((levelVar - 3) / 5), 4) : 0);
    const hazards = generateHazards(seed, terrain.worldWidth, BASE_HEIGHT).slice(0, hazardCount);
    
    // UFO spawn system initialization - uses new progression system
    // Check if this level should have UFOs (not time trial, level >= 10, not rest level)
    const ufoTimeTrial = mode === "timetrial" || (mode === "medley" && getMedleyLevelType(level) === "timetrial");
    
    if (shouldHaveUFOs(mode, levelVar, ufoTimeTrial)) {
      // Initialize UFO spawn state
      ufoSpawnStateRef.current = initUFOSpawnState();
      allProjectilesRef.current = [];
      
      // Generate deterministic UFO seed
      const ufoSeed = generateUFOSeed(mode, levelVar, levelSeed);
      
      // Get config for this level (handles medley vs fixed/classic)
      let ufoConfig: LevelUFOConfig | null;
      if (mode === "medley") {
        // For medley, count normal levels completed to determine progression
        const normalCount = countNormalLevelsCompleted(level);
        ufoConfig = getMedleyUFOConfigForLevel(level, normalCount, levelSeed);
      } else {
        ufoConfig = getUFOConfigForLevel(levelVar, mode, levelSeed);
      }
      
      if (ufoConfig) {
        ufoLevelConfigRef.current = ufoConfig;
        ufoSpawnScheduleRef.current = generateUFOSpawnSchedule(ufoConfig, ufoSeed);
        
        console.log("🛸 UFO system initialized:", {
          level: levelVar,
          mode,
          config: ufoConfig,
          schedule: ufoSpawnScheduleRef.current.map(e => ({ time: e.spawnTime.toFixed(1), type: e.ufoType, diff: e.difficulty }))
        });
      } else {
        ufoLevelConfigRef.current = null;
        ufoSpawnScheduleRef.current = [];
      }
    } else {
      ufoLevelConfigRef.current = null;
      ufoSpawnScheduleRef.current = [];
    }
    
    // Choose a safe spawn not over pads and with altitude above terrain
    const pickSpawn = () => {
      if (isCavernLevel) {
        // For cavern levels, spawn exactly flush on the start pad
        const cavernData = terrain as CavernData;
        const padCenterX = (cavernData.startPad.xStart + cavernData.startPad.xEnd) / 2;
        const spawnY = cavernData.startPad.y - 18; // Ensure clear of any terrain collision
        return { x: padCenterX, y: spawnY };
      }
      
      
      
      if (mode === "fixed" || mode === "timetrial" || mode === "medley") {
        const cx = WORLD_WIDTH / 2;
        const gy = terrain.getHeightAt(cx);
        const sy = gy - 520; // fixed safe altitude above ground
        return { x: cx, y: sy };
      }
      // Classic mode: random safe spawn, but SEEDED for consistent retry
      const spawnRng = mulberry32(levelSeed + 999); // Seeded RNG for spawn position
      
      for (let attempt = 0; attempt < 60; attempt++) {
        const cx = spawnRng() * WORLD_WIDTH; // Use seeded RNG instead of Math.random()
        if (!terrain.getPadAt(cx)) {
          const gy = terrain.getHeightAt(cx);
          const sy = gy - 520; // safe altitude above ground
          return { x: cx, y: sy };
        }
      }
      const fallbackX = WORLD_WIDTH / 2;
      return { x: fallbackX, y: terrain.getHeightAt(fallbackX) - 520 };
    };

    const spawn = pickSpawn();
    initialSpawnRef.current = { x: spawn.x, y: spawn.y };
    let x = spawn.x;
    let y = spawn.y;
    let vx = 0, vy = 0;
    let angle = 0; // radians; 0 = up
    let av = 0; // angular velocity

    let baseFuel = difficulty === "easy" ? 100 : 60;
    let fuel = (level < 5 ? baseFuel * 1.5 : baseFuel); // 50% extra for first 5 missions
    fuel *= 2; // doubled fuel per level
    const fuelCap = fuel; // track initial max fuel for HUD scaling

    const fuelConsumption = difficulty === "easy" ? 22 : 30; // units per second at full thrust
    const gravity = 0.02 * 0.75; // unify gravity across difficulties
    const rotAccel = (difficulty === "easy" ? 2.2 : 2.8) * 1.15; // 15% quicker rotation
    const rotFriction = difficulty === "easy"; // easy: friction stops rotation

    let score = initialScore ?? 0;
    let landings = initialLandings ?? 0;
    let elapsed = 0;
    let running = true;
    let crashed = false;
    hasShownBonusThisLanding.current = false; // Reset flag at level start

    // Paralysis state (jellyfish shockwave)
    let isParalyzed = false;
    let paralysisTimer = 0; // seconds
    let electrifiedTimer = 0; // visual effect timer
    let lastShockwaveSource: { x: number; y: number } | null = null;

    // Ghost recording and playback initialization
    let gameTime = 0;
    const isGhostModeFixed = showGhost && mode === "fixed" && !isCavernLevel;
    const isGhostModeMedley = showGhost && mode === "medley";
    const isGhostMode = isGhostModeFixed || isGhostModeMedley;
    const shouldRecord = (mode === "fixed" && !isCavernLevel) || mode === "medley";
    
    // Initialize ghost system - load BOTH local and global ghosts independently
    let localGhostRecording: any = null;
    let globalGhostRecording: any = null;
    
    // Check settings
    const localGhostsEnabled = localStorage.getItem('ll-ghost-mode-enabled') === 'true';
    const globalGhostsEnabled = localStorage.getItem('ll-global-ghosts-enabled') === 'true';

    // Fixed mode ghost loading - load BOTH ghosts when enabled
    if (isGhostModeFixed && ghostLevel !== undefined) {
      const difficultyStr = difficulty;
      
      // Load local ghost if local setting enabled
      if (localGhostsEnabled) {
        const localRecording = ghostManager.current.loadLunarLanderGhost(difficultyStr, ghostLevel);
        if (localRecording) {
          localGhostRecording = localRecording;
          fixedLocalGhost.current = localRecording;
          console.log("👻 Local ghost loaded for", difficultyStr, "level", ghostLevel, "- time:", (localRecording.completionTime / 1000).toFixed(2) + "s");
        }
      }
      
      // Load global ghost if global setting enabled
      if (globalGhostsEnabled) {
        const globalRecording = await ghostManager.current.loadGlobalGhost(difficultyStr, ghostLevel, 'fixed');
        if (globalRecording) {
          globalGhostRecording = globalRecording;
          fixedGlobalGhost.current = globalRecording;
          console.log("🌍 Global ghost loaded for", difficultyStr, "level", ghostLevel, "- time:", (globalRecording.completionTime / 1000).toFixed(2) + "s");
        }
      }
      
      // Skip local ghost if player holds the world record (times within 50ms)
      if (localGhostRecording && globalGhostRecording) {
        const playerHoldsRecord = Math.abs(localGhostRecording.completionTime - globalGhostRecording.completionTime) < 50;
        if (playerHoldsRecord) {
          fixedLocalGhost.current = null;
          localGhostRecording = null;
          console.log("🏆 Player holds world record - showing only gold ghost");
        }
      }
    }
    
    // Medley mode ghost loading - load BOTH ghosts when enabled
    if (isGhostModeMedley) {
      const difficultyStr = difficulty;
      const medleyStage = level;
      
      // Load local ghost if local setting enabled
      if (localGhostsEnabled) {
        const localRecording = ghostManager.current.loadMedleyGhost(difficultyStr, medleyStage);
        if (localRecording) {
          localGhostRecording = localRecording;
          fixedLocalGhost.current = localRecording;
          console.log("👻 Local medley ghost loaded for", difficultyStr, "stage", medleyStage, "- time:", (localRecording.completionTime / 1000).toFixed(2) + "s");
        }
      }
      
      // Load global ghost if global setting enabled
      if (globalGhostsEnabled) {
        const globalRecording = await ghostManager.current.loadGlobalGhost(difficultyStr, medleyStage, 'medley');
        if (globalRecording) {
          globalGhostRecording = globalRecording;
          fixedGlobalGhost.current = globalRecording;
          console.log("🌍 Global medley ghost loaded for", difficultyStr, "stage", medleyStage, "- time:", (globalRecording.completionTime / 1000).toFixed(2) + "s");
        }
      }
      
      // Skip local ghost if player holds the world record
      if (localGhostRecording && globalGhostRecording) {
        const playerHoldsRecord = Math.abs(localGhostRecording.completionTime - globalGhostRecording.completionTime) < 50;
        if (playerHoldsRecord) {
          fixedLocalGhost.current = null;
          localGhostRecording = null;
          console.log("🏆 Player holds world record - showing only gold ghost");
        }
      }
    }
    
    if (shouldRecord) {
      // Record initial frame at timestamp 0 with exact spawn position
      const initialFrame: LunarLanderGhostFrame = {
        timestamp: 0,
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        angle: 0,
        thrust: false,
        fuel: fuelCap
      };
      setGhostRecording([initialFrame]);
      setIsRecording(true);
      lastRecordTime.current = 0;
      console.log("🔴 Ghost recording started for", difficulty, mode === "medley" ? "stage" : "level", level, "at spawn:", spawn.x.toFixed(1), spawn.y.toFixed(1));
    }
    
    // Load Time Trial ghost if in time trial mode
    if (isTimeTrial && showGhost) {
      const challengeGlobal = JSON.parse(localStorage.getItem('ll-global-ghosts-enabled') || 'false');
      
      // ALWAYS load local ghost first
      const localGhost = ghostManager.current.loadTimeTrialGhost(difficulty, level);
      if (localGhost) {
        timeTrialLocalGhost.current = localGhost;
        console.log("👻 Local Time Trial ghost loaded for level", level, "- time to beat:", (localGhost.completionTime / 1000).toFixed(3) + "s");
      }
      
      // Also load global ghost if challenge mode enabled
      if (challengeGlobal) {
        try {
          console.log("🔍 Attempting to fetch global ghost for:", { level, difficulty, mode: 'timetrial' });
          const { record, error } = await fetchGlobalGhost(level, difficulty, 'timetrial');
          
          console.log("🔍 Fetch result:", { 
            hasRecord: !!record, 
            hasGhostData: !!record?.ghost_data,
            ghostDataType: typeof record?.ghost_data,
            ghostDataKeys: record?.ghost_data ? Object.keys(record.ghost_data) : [],
            error 
          });
          
          if (error) {
            console.error("❌ Error fetching global ghost:", error);
          }
          
          if (record && record.ghost_data) {
            // Check if ghost_data has frames property
            const ghostData = record.ghost_data;
            const hasFrames = Array.isArray(ghostData.frames) && ghostData.frames.length > 0;
            
            console.log("🔍 Ghost data structure:", {
              hasFrames,
              frameCount: ghostData.frames?.length,
              completionTime: ghostData.completionTime,
              hasCompletionTime: !!record.completion_time
            });
            
            if (hasFrames) {
              timeTrialLoadedGhost.current = record.ghost_data;
              timeTrialGhostType.current = 'global';
              console.log("🌍 Global Time Trial ghost loaded for level", level, "- time to beat:", (record.completion_time / 1000).toFixed(3) + "s");
            } else {
              console.warn("⚠️ Global ghost record exists but has no frames");
            }
          } else {
            console.log("ℹ️ No global ghost record found for this level");
          }
        } catch (err) {
          console.error("❌ Failed to load global Time Trial ghost:", err);
        }
      }
    }
    
    // Load best time for HUD display
    if (mode === "fixed" && !isCavernLevel) {
      // Prefer global ghost time if available, otherwise use local
      if (fixedGlobalGhost.current) {
        setBestTime(fixedGlobalGhost.current.completionTime);
      } else if (fixedLocalGhost.current) {
        setBestTime(fixedLocalGhost.current.completionTime);
      } else {
        const currentBest = ghostManager.current.getLunarLanderBestTime(difficulty, level);
        setBestTime(currentBest);
      }
    }

    let cameraX = x;
    let cameraShake = 0;
    let zoom = 1;
    let landingCooldown = 0;
    let bullseyeT = -1; // overlay timer for bullseye text
    let fuelAlarmLatched = false;
    let fuelDepletedTime = -1; // track when fuel first hits 0
    let anomaliesDisabled = false; // flag to disable gravity wells
    // Camera smoothing state
    let smoothedAnchor = 0;
    let lastDtForCam = 0;
    let camAnchorInit = true;
    // Camera zoom smoothing helpers
    let clearanceEMA = 220; // smoothed ground clearance
    let prevTargetZoom = 1;
    let loggedMovingPadStart = false;
    
    // Ghost state - separate for local and global ghosts
    let localGhostShip: { x: number; y: number; angle: number; visible: boolean } | null = null;
    let globalGhostShip: { x: number; y: number; angle: number; visible: boolean } | null = null;
    
    // Initialize ghost ships based on which ghosts are loaded
    if ((isGhostModeFixed && ghostLevel !== undefined) || isGhostModeMedley) {
      if (fixedLocalGhost.current) {
        localGhostShip = { x: 0, y: 0, angle: 0, visible: false };
      }
      if (fixedGlobalGhost.current) {
        globalGhostShip = { x: 0, y: 0, angle: 0, visible: false };
      }
    }
    
    // Particles (extended with bubble support)
    type Particle = { 
      x: number; 
      y: number; 
      vx: number; 
      vy: number; 
      life: number; 
      max: number; 
      color: string;
      isBubble?: boolean;  // Flag for underwater bubbles
      size?: number;       // Bubble radius (2-6px range)
    };
    const particles: Particle[] = [];
    
    // Underwater bubble colors - neon cyan/blue palette
    const bubbleColors = [
      'rgba(0, 255, 255, 0.8)',     // Bright cyan
      'rgba(100, 200, 255, 0.8)',   // Light blue
      'rgba(0, 200, 255, 0.9)',     // Cyan-blue
      'rgba(150, 230, 255, 0.7)'    // Pale cyan
    ];
    
    // Style points visual effects (local arrays for immediate rendering)
    type StyleParticle = { 
      id: string; 
      x: number; 
      y: number; 
      vx: number; 
      vy: number; 
      life: number; 
      maxLife: number;
      size: number;
      color: string;
    };
    const styleParticles: StyleParticle[] = [];
    
    type NearMissText = {
      id: string;
      x: number;
      y: number;
      text: string;
      life: number;
      maxLife: number;
    };
    const nearMissTexts: NearMissText[] = [];
    
    type FloatingScoreText = {
      id: string;
      x: number;
      y: number;
      points: number;
      life: number;
      maxLife: number;
    };
    const floatingScoreTexts: FloatingScoreText[] = [];
    

    // Debris (lander shards on crash)
    type Debris = { x: number; y: number; vx: number; vy: number; angle: number; av: number; life: number; max: number; size: number; kind: "plate" | "rod" | "chip" };
    const debris: Debris[] = [];
    // Shockwave rings and flash on big explosions
    type Shockwave = { x: number; y: number; life: number; max: number };
    const shockwaves: Shockwave[] = [];
    let flashT = 0; // screen flash

    // Note: occasional background satellites are rendered in screen-space for ambience (no gameplay effect)

    // Starfield (static twinkles) and shooting stars
    type Star = { x: number; y: number; size: number; baseA: number; tw: number; ph: number; bright: boolean; renderStyle: 'circle' | 'rect' };
    type Shooting = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    type BgSat = { x: number; y: number; vx: number; vy: number; life: number; max: number; scale: number; rot: number; rotV: number };
    const stars: Star[] = [];
    const shooting: Shooting[] = [];
    const bgSats: BgSat[] = [];
    let nextShooting = 0.6 + Math.random() * 1.6;
    let nextBgSat = 5 + Math.random() * 7;

    // Performance-optimized DPR
    const dprInit = shouldOptimizePerformance ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const pxW = c.width / dprInit;
    const pxH = c.height / dprInit;
    
    // Performance optimization constants
    const PARTICLE_COUNT = shouldOptimizePerformance ? 2 : 4;
    // iPhone-optimized particle count: 10 particles for 60fps with impressive effect
    // iPad gets 15 particles with optimized fillRect rendering for 60fps; iPhone gets 10; desktop gets 25
    const THRUSTER_PARTICLE_COUNT = shouldOptimizePerformance ? 2 : (isIPhone ? 10 : (useIPadThrusterOptimization ? 15 : 25));
    // iPad uses fillRect path with shadowBlur:6, not this value; iPhone uses no shadow; desktop uses full 25
    const THRUSTER_SHADOW_BLUR = shouldOptimizePerformance ? 0 : (isIPhone ? 0 : (useIPadThrusterOptimization ? 6 : 25));
    const STAR_COUNT = shouldOptimizePerformance ? 150 : 320;
    const SHADOW_BLUR_DESKTOP = 14;
    const SHADOW_BLUR_MOBILE = 6;
    // Screen-space static stars covering full screen (mobile-optimized count)
    for (let i = 0; i < STAR_COUNT; i++) {
      const sx = Math.random() * pxW;
      const sy = Math.random() * pxH;
      const rand = Math.random();
      
      let size, baseAlpha, bright, renderStyle;
      
      // 30% - Tiny dust stars (barely visible)
      if (rand < 0.30) {
        size = 0.5 + Math.random() * 0.3; // 0.5-0.8
        baseAlpha = 0.075 + Math.random() * 0.075; // 0.075-0.15 (50% of original)
        bright = false;
        renderStyle = Math.random() < 0.4 ? 'rect' : 'circle'; // 40% rectangles
      }
      // 35% - Small dim stars
      else if (rand < 0.65) {
        size = 0.8 + Math.random() * 0.4; // 0.8-1.2
        baseAlpha = 0.15 + Math.random() * 0.1; // 0.15-0.25 (50% of original)
        bright = false;
        renderStyle = Math.random() < 0.3 ? 'rect' : 'circle'; // 30% rectangles
      }
      // 20% - Medium moderate stars
      else if (rand < 0.85) {
        size = 1.2 + Math.random() * 0.6; // 1.2-1.8
        baseAlpha = 0.2 + Math.random() * 0.125; // 0.2-0.325 (50% of original)
        bright = false;
        renderStyle = Math.random() < 0.25 ? 'rect' : 'circle'; // 25% rectangles
      }
      // 10% - Large brighter stars
      else if (rand < 0.95) {
        size = 1.8 + Math.random() * 0.4; // 1.8-2.2
        baseAlpha = 0.3 + Math.random() * 0.1; // 0.3-0.4 (50% of original)
        bright = false;
        renderStyle = 'circle'; // Always circular
      }
      // 5% - Very bright stars
      else {
        size = 2.2 + Math.random() * 0.4; // 2.2-2.6
        baseAlpha = 0.4 + Math.random() * 0.075; // 0.4-0.475 (50% of original)
        bright = true;
        renderStyle = 'circle'; // Always circular for bright stars
      }
      
      stars.push({ 
        x: sx, 
        y: sy, 
        size, 
        baseA: baseAlpha, 
        tw: 0.5 + Math.random() * 1.5, 
        ph: Math.random() * Math.PI * 2, 
        bright,
        renderStyle
      });
    }

    // Background decorations system - load for classic mode only if Nebula FX is enabled
    if (mode !== "caverns" && nebulaFxEnabled) {
      const decorations = getDecorationsForLevel(levelVar, levelSeed);
      bgDecorationsRef.current = decorations;
      
      // Pre-load decoration images asynchronously
      preloadDecorationImages(decorations).then(imageMap => {
        bgDecorationImagesRef.current = imageMap;
        bgDecorationStartTimeRef.current = performance.now() / 1000; // Track start time for rotation
      }).catch(err => {
        console.warn("Failed to load some decoration images:", err);
      });
    }

    const wrapX = (xx: number) => {
      let v = xx % terrain.worldWidth;
      if (v < 0) v += terrain.worldWidth;
      return v;
    };

    let last = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = last;

    const updateHud = () => {
      let altitude: number;
      if (isCavernLevel) {
        const cavernData = terrain as CavernData;
        const floorHeight = cavernData.getHeightAt(x);
        altitude = Math.max(0, floorHeight - y);
      } else {
        altitude = Math.max(0, terrain.getHeightAt(x) - y);
      }
      
      // Calculate ghost time difference
      let ghostTimeDiff: number | undefined;
      if (isGhostMode && ghostLevel !== undefined && bestTime !== null) {
        ghostTimeDiff = elapsed - bestTime;
      }
      
      // Calculate time trial data
      const ttState = timeTrialStateRef.current;
      const timeTrialData = isTimeTrial ? {
        currentTarget: ttState.currentTarget,
        totalPads: ttState.totalPadsRequired,
        raceTime: ttState.raceActive ? (performance.now() - ttState.raceStartTime) : 0,
        raceActive: ttState.raceActive
      } : undefined;
      
      setHud({ 
        altitude, 
        vx, 
        vy, 
        fuel, 
        fuelCap, 
        score: isDemo ? 0 : score, 
        time: elapsed, 
        difficulty, 
        levelSeed, 
        rotateBoostActive: rotBoostActive.current > 1.1, 
        ghostTimeDiff,
        timeTrialTarget: timeTrialData?.currentTarget,
        timeTrialTotalPads: timeTrialData?.totalPads,
        timeTrialRaceTime: timeTrialData?.raceTime,
        timeTrialRaceActive: timeTrialData?.raceActive,
        timeTrialLevel: isTimeTrial ? level : undefined
      });
    };

    const spawnExplosion = () => {
      // Performance-aware particle burst using object pool
      const perfUpdate = performanceManager.update(0);
      const maxParticles = perfUpdate.settings.particleCount * 4; // Explosion gets 4x normal
      
      for (let i = 0; i < maxParticles; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 120 + Math.random() * 260;
        const particle = particlePool.get();
        particle.x = x;
        particle.y = y;
        particle.vx = Math.cos(a) * s;
        particle.vy = Math.sin(a) * s;
        particle.life = 0;
        particle.max = 0.8 + Math.random() * 0.7;
        particle.color = `hsla(${180 + Math.random() * 20},100%,60%,1)`;
        particles.push(particle);
      }
      // Add shockwave ring and screen flash
      shockwaves.push({ x, y, life: 0, max: 0.7 });
      flashT = Math.max(flashT, 0.28);
      cameraShake = Math.max(cameraShake, 36);
    };
    const spawnDebris = () => {
      const pieceCount = 42 + Math.floor(Math.random() * 28);
      for (let i = 0; i < pieceCount; i++) {
        const dir = Math.random() * Math.PI * 2;
        const speed = 220 + Math.random() * 320; // significantly more energetic
        const kind: Debris["kind"] = Math.random() < 0.45 ? "plate" : Math.random() < 0.75 ? "rod" : "chip";
        const size = kind === "rod" ? 2 + Math.random() * 3 : kind === "plate" ? 3 + Math.random() * 7 : 1.5 + Math.random() * 3;
        // Many pieces jet upward strongly (escape to space look)
        const upwardBoost = Math.random() < 0.5 ? -(120 + Math.random() * 260) : 0;
        debris.push({
          x,
          y,
          vx: Math.cos(dir) * speed + vx * 0.5,
          vy: Math.sin(dir) * speed + vy * 0.5 + upwardBoost,
          angle: Math.random() * Math.PI * 2,
          av: (-3 + Math.random() * 6) * (kind === "rod" ? 2.2 : 1.2),
          life: 0,
          max: 3.2 + Math.random() * 5.5, // linger across landscape longer
          size: size,
          kind,
        });
      }
    };
    
    // Shield break effect (prismatic particle burst - matching SurvivalEngine)
    const spawnShieldBreak = (cx: number, cy: number) => {
      // Concentric ring bursts
      for (let ring = 0; ring < 3; ring++) {
        const ringDelay = ring * 30;
        setTimeout(() => {
          shockwaves.push({
            x: cx,
            y: cy,
            life: 0,
            max: 0.4
          });
        }, ringDelay);
      }
      
      // Prismatic particle shards
      const shardCount = shouldOptimizePerformance ? 8 : 40;
      for (let i = 0; i < shardCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 100 + Math.random() * 200;
        const hue = 260 + Math.random() * 60; // Purple to cyan
        
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0,
          max: 0.6 + Math.random() * 0.4,
          color: `hsla(${hue}, 100%, ${60 + Math.random() * 30}%, 1)`
        });
      }
      
      flashT = 0.25;
      cameraShake += 2;
    };
    
    // Style points helper functions
    const spawnStyle360Burst = (px: number, py: number, terrainColor: string) => {
      const count = 48; // More particles for dramatic effect!
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 150 + Math.random() * 100; // 150-250 px/s
        const size = 3 + Math.random() * 5; // 3-8px varying sizes
        styleParticles.push({
          id: `${Date.now()}_${i}`,
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.5,
          maxLife: 1.5,
          size,
          color: terrainColor // Use current terrain neon color
        });
      }
    };

    const spawnNearMissText = (px: number, py: number) => {
      nearMissTexts.push({
        id: `${Date.now()}`,
        x: px,
        y: py,
        text: "NEAR MISS",
        life: 2.0,
        maxLife: 2.0
      });
    };
    
    const spawnFloatingScore = (px: number, py: number, points: number) => {
      floatingScoreTexts.push({
        id: `score_${Date.now()}`,
        x: px,
        y: py,
        points: points,
        life: 0,
        maxLife: 0.5 // 0.5 seconds duration
      });
    };
    
    const spawnShooting = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewWpx = c.width / dpr;
      const viewHpx = c.height / dpr;
      const margin = 80;
      const side = Math.floor(Math.random() * 3); // 0:left, 1:right, 2:top
      let sx = 0, sy = 0, vx = 0, vy = 0;
      if (side === 0) {
        sx = -margin; sy = Math.random() * (viewHpx * 0.7);
        vx = 180 + Math.random() * 260; vy = (Math.random() - 0.5) * 140;
      } else if (side === 1) {
        sx = viewWpx + margin; sy = Math.random() * (viewHpx * 0.7);
        vx = -180 - Math.random() * 260; vy = (Math.random() - 0.5) * 140;
      } else {
        sx = Math.random() * viewWpx; sy = -margin;
        vx = (Math.random() - 0.5) * 280; vy = 160 + Math.random() * 220;
      }
      const life = 0;
      const max = 0.6 + Math.random() * 1.0;
      shooting.push({ x: sx, y: sy, vx, vy, life, max });
    };

    // Background satellite spawner (screen-space). If ensureVisible is true,
    // spawn fully on-screen, horizontally near an edge, at or below the
    // player's starting screen height (~45% of screen), and comfortably above
    // the terrain silhouette.
      const spawnBgSat = (ensureVisible = false, scaleOverride?: number, sideOverride?: "left" | "right") => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewWpx = c.width / dpr;
        const viewHpx = c.height / dpr;
        const scale = scaleOverride ?? 0.25; // distant, small satellite in-game
        const speedBase = 24;
        const speed = speedBase * scale;

        let sx = 0, sy = 0, vx = 0, vy = 0;

        if (ensureVisible) {
          // Start inside the screen so it's visible immediately
          const dirRight = sideOverride ? sideOverride === "right" : Math.random() < 0.5;
          sx = dirRight ? viewWpx * 0.12 : viewWpx * 0.88;
          vx = dirRight ? speed : -speed;
          // Choose a band: not higher than starting lander (~45% of screen)
          // but well above the terrain line (usually ~82%). Use 46%-64%.
          const yMin = viewHpx * 0.46;
          const yMax = viewHpx * 0.64;
          sy = yMin + Math.random() * Math.max(8, (yMax - yMin));
          vy = (Math.random() - 0.5) * speed * 0.2;
        } else {
          // Periodic ambient spawns from off-screen left/right within a safe sky band
          const fromLeft = Math.random() < 0.5;
          sx = fromLeft ? -120 : viewWpx + 120;
          vx = fromLeft ? speed : -speed;
          const yMin = viewHpx * 0.28;
          const yMax = viewHpx * 0.62;
          sy = yMin + Math.random() * (yMax - yMin);
          vy = (Math.random() - 0.5) * speed * 0.25;
        }

        bgSats.push({ x: sx, y: sy, vx, vy, life: 0, max: 9 + Math.random() * 8, scale, rot: Math.random() * Math.PI * 2, rotV: -0.8 + Math.random() * 1.6 });
      };

      // Only spawn satellites in non-cavern levels
      if (mode !== "caverns") {
        // Ensure two satellites visible per level: one standard and one larger (up to 4x)
        spawnBgSat(true, 0.25, "left");
        spawnBgSat(true, 0.25 * (1 + Math.random() * 3), "right");
      }

    // Rumble state for gamepad thrust
    let thrustHold = 0; // seconds held
    let rumbleNext = 0; // next time to send a rumble pulse (ms timestamp)
    
    // Initialize countdown intro
    if (!introRef.current) {
      introRef.current = createCountdownIntro();
      introRef.current.onDone(() => {
        // Gameplay resumes on 'GO' start; ensure overlay clears fully on done
      });
      
      // Start countdown with "freeze" variant for lander
      const introSeed = mix(levelSeed, "INTRO");
      introRef.current.start({
        variant: "freeze",
        seed: introSeed,
        onTick: () => { if (!isDemo) { try { audio.current.playIntroTick(); } catch {} } },
        onGo: () => { 
          setWorldPaused(false); worldPausedRef.current = false;
          setPlayerLocked(false); playerLockedRef.current = false;
          invulnerabilityTimer.current = 1200; // 1.2 seconds invulnerability
          
          // Start Time Trial timer immediately after countdown
          if (isTimeTrial) {
            setTimeTrialState(prev => ({
              ...prev,
              raceStartTime: performance.now(),
              raceActive: true
            }));
            // Initialize ghost recording from the start
            timeTrialGhostFrames.current = [];
            console.log("🏁 Time Trial timer & ghost recording started at countdown end");
          }
          
          // Start timer fallback - if no movement within 2 seconds after GO, start timer anyway
          timerStartTimeoutRef.current = setTimeout(() => {
            setTimerActive(true);
            timerActiveRef.current = true;
          }, 2000);
          if (!isDemo) { try { audio.current.playIntroGo(); } catch {} }
        },
        onWarp: () => { if (!isDemo) { try { audio.current.playIntroWarp(); } catch {} } }
      });
      setWorldPaused(true); worldPausedRef.current = true;
      setPlayerLocked(true); playerLockedRef.current = true;

      // Ensure overlay knows ship screen position from the very start of countdown
      const parent = containerRef.current!;
      if (parent) {
        const wCss = parent.clientWidth;
        const hCss = parent.clientHeight;
        const yCss = (mode === "caverns") ? hCss / 2 : hCss * 0.45;
        setShipScreenPos({ x: wCss / 2, y: yCss });
      }
    }

    const loop = () => {
      // Don't schedule next frame if component unmounted
      if (!mountedRef.current) {
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000); // clamp dt
      lastDtForCam = dt;
      last = now;

      frameCount++;
      if (now - lastFpsUpdate >= 500) {
        setFps((frameCount * 1000) / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;
      }
      if (paused) {
        render();
        return;
      }
      
      // Update countdown intro
      if (introRef.current?.isActive()) {
        setIntroState(introRef.current.getCurrentState());
      }
      
      // Update invulnerability timer
      if (invulnerabilityTimer.current > 0) {
        invulnerabilityTimer.current -= dt * 1000;
      }
      
      // Update shield timer (collectibles-based shield)
      if (shieldActiveRef.current && shieldTimerRef.current > 0) {
        shieldTimerRef.current -= dt;
        if (shieldTimerRef.current <= 0) {
          shieldActiveRef.current = false;
          setShieldActive(false);
          shieldTimerRef.current = 0;
          // Optional: play shield expire sound
          if (!isDemo) { try { audio.current.shieldBreak?.(); } catch {} }
        }
      }
      
      // Update shield invulnerability timer (after shield break)
      if (shieldInvulnerableRef.current) {
        shieldInvulnerableTimerRef.current -= dt;
        if (shieldInvulnerableTimerRef.current <= 0) {
          shieldInvulnerableRef.current = false;
          shieldInvulnerableTimerRef.current = 0;
        }
      }
      
      // Only increment elapsed time when timer is active (after first movement or 2s after GO)
      if (timerActiveRef.current) {
        elapsed += dt;
        gameTime += dt;
      }
      
      // Ghost recording (sample every 50ms when recording)
      if (shouldRecord && gameTime - lastRecordTime.current >= 0.05) {
        const newFrame: LunarLanderGhostFrame = {
          timestamp: gameTime,
          x,
          y,
          vx,
          vy,
          angle,
          thrust: keys.current.thrust,
          fuel
        };
        setGhostRecording(prev => [...prev, newFrame]);
        lastRecordTime.current = gameTime;
      }
      
      // Time Trial ghost recording
      if (mode === "timetrial" && timeTrialStateRef.current.raceActive && running && gameTime - lastRecordTime.current >= 0.05) {
        const raceTime = performance.now() - timeTrialStateRef.current.raceStartTime;
        const ttFrame: LunarLanderGhostFrame = {
          timestamp: raceTime,
          x,
          y,
          vx,
          vy,
          angle,
          thrust: keys.current.thrust,
          fuel
        };
        timeTrialGhostFrames.current.push(ttFrame);
        lastRecordTime.current = gameTime;
      }
      
      // Ghost playback - update BOTH ghost states (fixed and medley modes)
      if (isGhostMode) {
        // Update LOCAL ghost state
        if (fixedLocalGhost.current && localGhostShip) {
          let localState = null;
          if (mode === "medley") {
            localState = ghostManager.current.getMedleyGhostState(difficulty, level, gameTime);
          } else if (mode === "fixed" && ghostLevel !== undefined) {
            localState = ghostManager.current.getLunarLanderGhostState(difficulty, ghostLevel, gameTime);
          }
          
          if (localState) {
            localGhostShip.x = localState.x;
            localGhostShip.y = localState.y;
            localGhostShip.angle = localState.angle;
            localGhostShip.visible = localState.visible;
          } else {
            localGhostShip.visible = false;
          }
        }
        
        // Update GLOBAL ghost state
        if (fixedGlobalGhost.current && globalGhostShip) {
          const globalState = ghostManager.current.getGlobalGhostState(fixedGlobalGhost.current, gameTime);
          
          if (globalState) {
            globalGhostShip.x = globalState.x;
            globalGhostShip.y = globalState.y;
            globalGhostShip.angle = globalState.angle;
            globalGhostShip.visible = globalState.visible;
          } else {
            globalGhostShip.visible = false;
          }
        }
        
        // For backward compatibility, set ghostState to the global ghost if available, else local
        // For backward compatibility, set ghostState to the global ghost if available, else local
        const primaryGhostState = globalGhostShip?.visible ? {
          x: globalGhostShip.x,
          y: globalGhostShip.y,
          angle: globalGhostShip.angle,
          visible: globalGhostShip.visible,
          thrust: false
        } : localGhostShip?.visible ? {
          x: localGhostShip.x,
          y: localGhostShip.y,
          angle: localGhostShip.angle,
          visible: localGhostShip.visible,
          thrust: false
        } : null;
        
        setGhostState(primaryGhostState);
      }
      if (!worldPausedRef.current && elapsed >= nextShooting) { spawnShooting(); nextShooting = elapsed + (0.6 + Math.random() * 1.6); }
      if (elapsed >= nextBgSat && mode !== "caverns") {
        nextBgSat = elapsed + (5 + Math.random() * 7);
        // ensure periodic spawn
        spawnBgSat(false);
      }

      // Demo AI controls override
      if (isDemo && demoAI.current) {
        const demoControls = updateDemoAI(
          demoAI.current,
          { x, y, vx, vy, angle, fuel },
          terrain,
          dt * 1000 // Convert to milliseconds
        );
        
        // Override keys with demo AI input
        keys.current.left = demoControls.left;
        keys.current.right = demoControls.right;
        keys.current.thrust = demoControls.thrust;
        keys.current.abort = false; // Demo doesn't use abort
        keys.current.rotateBoost = false; // Demo doesn't use rotation boost
      }

      // Controls
      // Gamepad hot-swap + read UI/analog
      let gpLeft = false, gpRight = false, gpThrust = 0, gpRotateBoost = false, gpAbort = false;
      {
        const gp = anyGamepad?.();
        if (gp && gp.connected) {
          // Detect gamepad usage for PC controls
          if (!isUsingPCControls) {
            setIsUsingPCControls(true);
            setPCControlsPreference(true);
          }
          if (gpDeviceIdRef.current !== gp.id) {
            gpDeviceIdRef.current = gp.id;
            setLastDeviceId(gp.id);
            gpProfileRef.current = loadProfile(gp.id);
          }
          const input = readGamepad(gp, gpProfileRef.current);
          // Digital thrust is instant
          gpThrust = input.thrust;
          gpRotateBoost = input.rotateBoost;
          // Apply analog rotation only when no digital rotation pressed
          gpLeft = input.buttons.rotateLeft;
          gpRight = input.buttons.rotateRight;
          gpAbort = input.buttons.abort;
          
          if (!gpLeft && !gpRight) {
            if (Math.abs(input.rotation) > 0.0001) {
              av += input.rotation * rotAccel * dt;
            }
          }
          // Pause on rising edge
          if (input.buttons.pause && !lastPauseDown.current) {
            setPaused((p) => !p);
          }
          lastPauseDown.current = input.buttons.pause;
          // Abort assist latch on press
          if (input.buttons.abort && !lastAbortDown.current) {
            abortAssist.current = true;
            keys.current.abort = true;
          }
          if (!input.buttons.abort && lastAbortDown.current) {
            keys.current.abort = false;
          }
          lastAbortDown.current = input.buttons.abort;
        }
      }
      
      // Skip countdown on input (keyboard OR gamepad)
      if (introRef.current?.isActive()) {
        const keyboardSkipInput = keys.current.thrust || keys.current.left || keys.current.right || keys.current.abort;
        const gamepadSkipInput = gpThrust > 0 || gpLeft || gpRight || gpAbort;
        if ((keyboardSkipInput || gamepadSkipInput) && introRef.current.getCurrentState().canSkip) {
          introRef.current.skip();
        }
      }
       
      // Update rotation modifier
      const rotBoostHeld = keys.current.rotateBoost || gpRotateBoost;
      rotBoostActive.current = updateRotationModifier(
        rotBoostActive.current,
        rotBoostHeld,
        dt * 1000, // convert to ms
        rotModConfig
      );

      // Gamepad thrust rumble ramp (0 -> 2.5s -> max)
      const gpThrusting = gpThrust > 0.001;
      if (gpThrusting) thrustHold += dt; else thrustHold = 0;
      if (gpThrusting) {
        const t = Math.min(1, thrustHold / 2.5);
        if (now >= rumbleNext) {
          try { void vibrate(120, 0.05 + 0.35 * t, 0.1 + 0.9 * t); } catch {}
          rumbleNext = now + 100;
        }
      } else {
        rumbleNext = now;
      }

      // Style points tracking (for classic, fixed, and medley modes)
      if ((mode === "classic" || mode === "fixed" || mode === "medley") && running && !crashed && !playerLockedRef.current) {
        // Detect rotation input from keyboard OR gamepad analog stick
        // Gamepad analog: input.rotation is -1 to 1, negative = left, positive = right
        const gp = anyGamepad?.();
        const gpAnalogRotation = gp?.connected ? readGamepad(gp, gpProfileRef.current).rotation : 0;
        const analogThreshold = 0.15; // Analog stick threshold for detecting intentional rotation
        
        const isRotatingLeft = keys.current.left || gpLeft || gpAnalogRotation < -analogThreshold;
        const isRotatingRight = keys.current.right || gpRight || gpAnalogRotation > analogThreshold;
        
        // Update 360° rotation tracking
        const rotation360Result = update360Tracking(
          stylePointsStateRef.current,
          angle,
          isRotatingLeft,
          isRotatingRight,
          dt,
          abortRotationActive.current,
          elapsed
        );
        
        if (rotation360Result?.awarded) {
          const consecutiveCount = rotation360Result.consecutiveCount;
          const pointsAwarded = 360 * consecutiveCount; // 360, 720, or 1080
          
          score += pointsAwarded;
          
          // Spawn particle burst at lander position using current terrain color
          spawnStyle360Burst(x, y, neonColor);
          
          // Spawn floating score text showing points earned
          spawnFloatingScore(x, y, pointsAwarded);
          
          // TODO: Add audio later
        }
        
        // Update near miss tracking
        const nearMissResult = updateNearMiss(
          stylePointsStateRef.current,
          x,
          y,
          vx,
          vy,
          terrain.getHeightAt,
          terrain.getPadAt,
          dt,
          elapsed
        );
        
        if (nearMissResult?.awarded) {
          score += 250;
          // Spawn "NEAR MISS" text at award location
          spawnNearMissText(nearMissResult.awardX, nearMissResult.awardY);
        }
      }

      // Prevent thrust input during countdown intro
      let thrust = 0;
      if (running && !worldPausedRef.current && !playerLockedRef.current && !isParalyzed) {
        thrust = Math.max(
          gpThrust,
          thrustAnalog.current,
          keys.current.thrust ? 1 : 0
        );
      }
      // Start timer on first significant movement after GO (timer not yet active)
      if (running && !timerActiveRef.current && !worldPausedRef.current) {
        const hasMovement = Math.abs(vx) > 0.15 || Math.abs(vy) > 0.15;
        const thrustStarted = thrust > 0.05;
        
        if (hasMovement || thrustStarted) {
          // Clear any pending timeout since player started moving
          if (timerStartTimeoutRef.current) {
            clearTimeout(timerStartTimeoutRef.current);
            timerStartTimeoutRef.current = null;
          }
          setTimerActive(true);
          timerActiveRef.current = true;
        }
      }

      if (running && thrust > 0) {
        if (fuel > 0) {
          // Reset landing sound flag when taking off
          hasPlayedLandingSoundRef.current = false;
          
          // Lift-off assist: when first thrusting from a static start-pad rest in caverns
          if (isCavernLevel) {
            const cav = terrain as CavernData;
            const pad = terrain.getPadAt(x);
            const nearStartPad = (pad === cav.startPad) && Math.abs(y - (cav.startPad.y - 14)) < 3 && Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2;
            if (lastThrust.current <= 0.001 && thrust > 0.05 && nearStartPad) {
              vy -= 1.1; // small upward impulse to clear the pad
              y -= 2;    // nudge up a bit to avoid re-collision
            }
          }
          const underwaterLevel = isWaterLevel(mode, level);
          const thrustPower = underwaterLevel ? 0.6 : 1.0; // Reduced thrust underwater
          const ax = Math.sin(angle) * thrust * (9.8 * 0.7 * thrustPower) * dt;
          const ay = -Math.cos(angle) * thrust * (9.8 * 0.7 * thrustPower) * dt;
          vx += ax;
          vy += ay;
          const fuelMultiplier = underwaterLevel ? 0.25 : 1.0; // 25% fuel consumption underwater
          fuel -= fuelConsumption * thrust * dt * fuelMultiplier;
          if (fuel <= 0) fuel = 0;
          // Spectacular multi-nozzle thruster effect - incredibly impressive for high graphics
          const nozzlePositions = shouldOptimizePerformance ? [
            { x: x - Math.sin(angle) * 10, y: y + Math.cos(angle) * 10 }
          ] : [
            // Center nozzle
            { x: x - Math.sin(angle) * 10, y: y + Math.cos(angle) * 10 },
            // Left nozzle 
            { x: x - Math.sin(angle) * 10 - Math.cos(angle) * 3, y: y + Math.cos(angle) * 10 + Math.sin(angle) * 3 },
            // Right nozzle
            { x: x - Math.sin(angle) * 10 + Math.cos(angle) * 3, y: y + Math.cos(angle) * 10 - Math.sin(angle) * 3 }
          ];
          
          for (const nozzle of nozzlePositions) {
            const particlesPerNozzle = Math.ceil(THRUSTER_PARTICLE_COUNT / nozzlePositions.length);
            for (let i = 0; i < particlesPerNozzle; i++) {
              // Much wider angle spread for dramatic effect
              const angleSpread = shouldOptimizePerformance ? 0.6 : 1.6;
              const pa = angle + (Math.random() - 0.5) * angleSpread + Math.PI;
              
      if (isUnderwater) {
        // UNDERWATER: Spawn bubbles instead of embers
        // Reduce spawn rate by 75% in high GFX mode for performance
        if (shouldOptimizePerformance || Math.random() < 0.25) {
          const bubbleSize = Math.random() < 0.6 ? 
            (2 + Math.random() * 3.25) :  // 60%: small (2-5.25px)
            (3.5 + Math.random() * 5.5);  // 40%: large (3.5-9px)
          
          // Doubled initial speed for longer thrust trail
          const sp = shouldOptimizePerformance ? 
            (80 + Math.random() * 160 * thrust) :     // Low GFX: 80-240 px/s
            (120 + Math.random() * 240 * thrust);     // High GFX: 120-360 px/s
          
          // Shortened lifespan for performance (0.6-1.8s)
          const lifespanMultiplier = 0.5 + Math.random() * 1.0;  // 0.5-1.5x
          const baseLifespan = shouldOptimizePerformance ? 0.6 : 1.2;
          const lifespan = baseLifespan * lifespanMultiplier;
                  
                  particles.push({
                    x: nozzle.x,
                    y: nozzle.y,
                    vx: Math.sin(pa) * sp,
                    vy: -Math.cos(pa) * sp,
                    life: 0,
                    max: lifespan,
                    color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)],
                    isBubble: true,
                    size: bubbleSize
                  });
        }
              } else {
                // REGULAR AIR: Keep existing thruster particle code
                const sp = shouldOptimizePerformance ? 
                  (60 + Math.random() * 120 * thrust) : 
                  (100 + Math.random() * 200 * thrust);
                
                const lifespan = shouldOptimizePerformance ? 0.5 : 1.6;
                
                const particleColor = shouldOptimizePerformance ? neonColor : 
                  (Math.random() > 0.7 ? neonColor.replace(')', ', 0.8)').replace('hsl', 'hsla') : neonColor);
                
                particles.push({ 
                  x: nozzle.x, 
                  y: nozzle.y, 
                  vx: Math.sin(pa) * sp, 
                  vy: -Math.cos(pa) * sp, 
                  life: 0, 
                  max: lifespan, 
                  color: particleColor 
                });
              }
            }
          }
        }
      }
      if (!isDemo) {
        audio.current.setThruster(thrust * (fuel > 0 ? 1 : 0));
      }
      lastThrust.current = thrust;
      if (!isDemo && !fuelAlarmLatched && fuel <= 10) { try { audio.current.startFuelAlarm(); } catch {} fuelAlarmLatched = true; }
      
      // Track when fuel first hits 0 and disable anomalies after 3 seconds
      if (fuel <= 0 && fuelDepletedTime < 0) {
        fuelDepletedTime = elapsed;
      }
      if (fuelDepletedTime >= 0 && elapsed - fuelDepletedTime >= 3 && !anomaliesDisabled) {
        anomaliesDisabled = true;
      }
      // Apply rotation modifier to rotation physics
      const rotationMultiplier = isUnderwater ? 0.7 : 1.0; // Slower rotation underwater
      const { angularAccel: modifiedRotAccel, maxAngularVel } = applyRotationModifier(
        rotAccel * rotationMultiplier,
        8.0, // base max angular velocity
        rotBoostActive.current,
        rotModConfig
      );
      
      if (running) {
        if (keys.current.left || gpLeft) av -= modifiedRotAccel * dt;
        if (keys.current.right || gpRight) av += modifiedRotAccel * dt;
        
        // Apply max angular velocity cap
        av = Math.max(-maxAngularVel, Math.min(maxAngularVel, av));
        if (!keys.current.left && !keys.current.right && !gpLeft && !gpRight) {
          if (rotFriction) {
            // friction towards zero (easy)
            av *= 0.9;
            if (Math.abs(av) < 0.02) av = 0;
          } else {
            // slight damping in hard to aid recovery without removing free-spin feel
            av *= 0.994; // nudged up from 0.992: slightly trickier than now, still easier than original
            if (Math.abs(av) < 0.006) av = 0;
          }
        }
      }

      // Enhanced abort assist: smooth rotation, instant boost, fixed fuel penalty
      if (running && (keys.current.abort || abortAssist.current) && fuel > 0 && !worldPausedRef.current && !playerLockedRef.current) {
        // On first activation frame: charge fuel penalty and apply instant boost
        if (keys.current.abort && !abortPenaltyCharged.current) {
          // Charge fixed fuel penalty once per activation
          fuel -= ABORT_FUEL_COST;
          fuel = Math.max(0, fuel); // Don't go negative
          
          // Rapidly dampen velocities to stabilize (not launch!)
          vx *= 0.5; // Very aggressive horizontal dampening (doubled)
          vy *= 0.4; // Very aggressive vertical dampening (doubled)
          
          // Start smooth rotation animation
          abortRotationActive.current = true;
          abortStartAngle.current = angle;
          abortRotationProgress.current = 0;
          abortPenaltyCharged.current = true;
          
          cameraShake = Math.max(cameraShake, ABORT_CAMERA_SHAKE);
          if (!isDemo) { audio.current.abort(); }
        }
        
        // Animate rotation smoothly with cubic ease-out
        if (abortRotationActive.current) {
          abortRotationProgress.current += dt / ABORT_ROTATION_DURATION;
          const t = Math.min(1, abortRotationProgress.current);
          const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out curve
          angle = abortStartAngle.current * (1 - eased);
          av = 0; // Lock angular velocity during rotation
          
          if (t >= 1) {
            angle = 0; // Ensure exactly level at end
            abortRotationActive.current = false;
          }
        } else {
          // If not animating, keep level
          angle = 0;
          av = 0;
        }
        
        // Apply hover thrust to maintain altitude
        const THRUST_ACCEL = 9.8;
        const hoverThrust = Math.min(1, (gravity * 60) / THRUST_ACCEL);
        thrustAnalog.current = Math.max(thrustAnalog.current, hoverThrust);
        fuel -= 25 * dt; // Hover fuel cost
        
        // Auto turn off when stabilized
        const stabilized = Math.abs(angle) < 0.08 && Math.abs(av) < 0.05 && Math.abs(vx) < 8 && vy < 8;
        if (stabilized) {
          abortAssist.current = false;
          keys.current.abort = false;
          thrustAnalog.current = 0;
          abortRotationActive.current = false;
        }
      }
      
      // Reset penalty flag when abort button released
      if (!keys.current.abort) {
        abortPenaltyCharged.current = false;
      }

      if (running) {
        angle += av * dt;

        // Skip all physics during countdown intro
        if (worldPausedRef.current || playerLockedRef.current) {
          // Keep lander stationary during countdown
          vx = 0;
          vy = 0;
          av = 0;
        } else {
          // Physics integration - only if not resting on start pad
          const onStartPad = isCavernLevel &&
            Math.abs(vx) < 0.15 && Math.abs(vy) < 0.15 && 
            Math.abs(y - (terrain as CavernData).startPad.y + 14) < 2 &&
            x >= (terrain as CavernData).startPad.xStart && 
            x <= (terrain as CavernData).startPad.xEnd &&
            !(keys.current.thrust || thrustAnalog.current > 0.05);

        const underwaterLevel = isWaterLevel(mode, level);
        
        if (!onStartPad) {
          // Apply gravity only when not resting on start pad
          const gravityMultiplier = underwaterLevel ? 0.7 : 1.0; // Increased underwater gravity for faster sinking
          vy += gravity * 60 * dt * gravityMultiplier;
        } else if (underwaterLevel && !(keys.current.thrust || thrustAnalog.current > 0.05)) {
          // Even on start pad, apply gentle gravity when not thrusting underwater
          vy += gravity * 60 * dt * 0.5; // 50% of normal gravity for noticeable sinking
        }
        
        if (!onStartPad) {
          
          // Apply anomaly acceleration (gravity wells) if not disabled
          if (!anomaliesDisabled && anomalies.length > 0) {
            const { ax, ay } = anomalyAccelAt(anomalies, x, y, elapsed);
            vx += ax * dt;
            vy += ay * dt;
          }
          
          // Air resistance (much stronger underwater)
          const drag = underwaterLevel ? 0.985 : 0.998;
          vx *= Math.pow(drag, dt * 60);
          vy *= Math.pow(drag, dt * 60);

          // Update position
          x = wrapX(x + vx * dt * 60);
          y += vy * dt * 60;
        } else {
            // Keep lander perfectly still on start pad
            vx = 0;
            vy = 0;
          }
        }
      }
      
      // Update liquid sloshing physics (if enabled - matches SurvivalEngine)
      if (liquidFuelEnabledRef.current && running && !crashed) {
        const isLanded = !running || crashed;
        
        if (!isLanded && !playerLockedRef.current) {
          // Calculate acceleration from velocity change
          const accelX = dt > 0 ? (vx - prevShipVxRef.current) / dt : 0;
          const accelY = dt > 0 ? (vy - prevShipVyRef.current) / dt : 0;
          prevShipVxRef.current = vx;
          prevShipVyRef.current = vy;
          
          // Lateral acceleration relative to ship orientation
          const lateralAccel = accelX * Math.cos(angle) - accelY * Math.sin(angle);
          
          // Angular acceleration
          const angularAccel = dt > 0 ? (av - prevShipAngularVelRef.current) / dt : 0;
          prevShipAngularVelRef.current = av;
          
          // Spring-damper physics constants (identical to SurvivalEngine)
          const SPRING_K = 15.0;
          const DAMPING = 0.85;
          const SENSITIVITY = 0.008;
          const ANGULAR_INFLUENCE = 0.3;
          
          // External force from ship movement
          let externalForce = -lateralAccel * SENSITIVITY - angularAccel * ANGULAR_INFLUENCE;
          
          // Add forced sloshing after refuel
          if (forceSloshingTimerRef.current > 0) {
            const sloshProgress = 1 - (forceSloshingTimerRef.current / 1.5);
            const sloshIntensity = 150 * (1 - sloshProgress);
            externalForce += Math.sin(elapsed * 3.5) * sloshIntensity;
            forceSloshingTimerRef.current -= dt;
          }
          
          // Spring force (restoring)
          const springForce = -liquidTiltAngleRef.current * SPRING_K;
          
          // Update tilt velocity and angle
          liquidTiltVelocityRef.current += (springForce + externalForce) * dt;
          liquidTiltVelocityRef.current *= Math.pow(DAMPING, dt * 60);
          liquidTiltAngleRef.current += liquidTiltVelocityRef.current * dt;
          liquidTiltAngleRef.current = Math.max(-0.4, Math.min(0.4, liquidTiltAngleRef.current));
          
          // Surface wave animation
          liquidWavePhaseRef.current += dt * 3.5;
          
          // Wave amplitude reacts to acceleration
          const disturbance = Math.abs(lateralAccel) * 0.002 + Math.abs(angularAccel) * 0.5;
          liquidWaveAmplitudeRef.current += disturbance;
          if (forceSloshingTimerRef.current > 0) {
            liquidWaveAmplitudeRef.current += 0.08;
          }
          liquidWaveAmplitudeRef.current *= Math.pow(0.92, dt * 60);
          liquidWaveAmplitudeRef.current = Math.min(liquidWaveAmplitudeRef.current, 3.0);
        } else {
          // Settle when landed or paused
          liquidTiltVelocityRef.current *= Math.pow(0.8, dt * 60);
          liquidTiltAngleRef.current *= Math.pow(0.9, dt * 60);
          liquidWaveAmplitudeRef.current *= Math.pow(0.95, dt * 60);
        }
      }

      // Update moving hazards in non-cavern levels with performance optimization
      if (running && !isCavernLevel) { 
        // Only update hazards that are near the camera
        const viewWidth = c.width / dprInit;
        const nearbyHazards = hazards.filter(h => {
          const dx = Math.abs(h.x - cameraX);
          const wrappedDx = Math.min(dx, terrain.worldWidth - dx);
          return wrappedDx < viewWidth + 200; // Screen width + margin
        });
        updateHazards(nearbyHazards, dt, terrain.worldWidth, BASE_HEIGHT);
      }
      
      // UFO system update - uses new spawn schedule system
      const ufoConfig = ufoLevelConfigRef.current;
      if (running && ufoConfig && ufoSpawnScheduleRef.current.length > 0) {
        const state = ufoSpawnStateRef.current;
        const schedule = ufoSpawnScheduleRef.current;
        
        // Build type configs from level config
        const configs: Record<UFOType, UFOTypeConfig> = {
          small: {
            ...UFO_CONFIGS.small,
            enabled: ufoConfig.smallEnabled,
            difficulty: ufoConfig.difficulty
          },
          medium: {
            ...UFO_CONFIGS.medium,
            enabled: ufoConfig.mediumEnabled,
            difficulty: ufoConfig.difficulty
          },
          large: {
            ...UFO_CONFIGS.large,
            enabled: ufoConfig.largeEnabled,
            difficulty: ufoConfig.difficulty
          }
        };
        
        // Check spawn schedule for spawning
        for (const event of schedule) {
          if (!event.spawned && elapsed >= event.spawnTime) {
            // Check max simultaneous limit
            const activeCount = getActiveUFOCount(state);
            if (activeCount < ufoConfig.maxSimultaneous) {
              // Check if this type's slot is free
              const typeSlotFree = 
                (event.ufoType === "small" && (!state.activeSmall || !state.activeSmall.active)) ||
                (event.ufoType === "medium" && (!state.activeMedium || !state.activeMedium.active)) ||
                (event.ufoType === "large" && (!state.activeLarge || !state.activeLarge.active));
              
              if (typeSlotFree && configs[event.ufoType].enabled) {
                let newUFO: LanderUFO | null = null;
                
                // Use deterministic seed for this spawn
                const spawnSeed = levelSeed + event.seedOffset * 12345;
                
                switch (event.ufoType) {
                  case "small":
                    newUFO = spawnSmallUFO(
                      spawnSeed,
                      event.difficulty,
                      terrain.worldWidth,
                      BASE_HEIGHT,
                      x,
                      y,
                      elapsed,
                      configs.small,
                      terrain.points
                    );
                    state.activeSmall = newUFO;
                    if (!isDemo) { audio.current.startUfoSmallSound(); }
                    break;
                    
                  case "medium":
                    newUFO = spawnUFO(
                      spawnSeed,
                      event.difficulty,
                      terrain.worldWidth,
                      BASE_HEIGHT,
                      x,
                      y,
                      elapsed,
                      DEFAULT_UFO_CONFIG,
                      terrain.points
                    );
                    newUFO.type = "medium";
                    newUFO.scale = 1.0;
                    newUFO.canShoot = true;
                    state.activeMedium = newUFO;
                    if (!isDemo) { audio.current.startUfoMediumSound(); }
                    break;
                    
                  case "large":
                    newUFO = spawnLargeUFO(
                      spawnSeed,
                      event.difficulty,
                      terrain.worldWidth,
                      BASE_HEIGHT,
                      x,
                      y,
                      elapsed,
                      configs.large,
                      terrain.points
                    );
                    state.activeLarge = newUFO;
                    if (!isDemo) { audio.current.startUfoLargeSound(); }
                    break;
                }
                
                if (newUFO) {
                  event.spawned = true;
                  console.log(`🛸 ${event.ufoType.toUpperCase()} UFO spawned at t=${elapsed.toFixed(1)}s (scheduled: ${event.spawnTime.toFixed(1)}s, difficulty: ${event.difficulty})`);
                }
              }
            }
          }
        }
        
        // Update active UFOs
        const newProjectiles: UFOProjectile[] = [];
        
        // Update small UFO
        if (state.activeSmall?.active) {
          updateSmallUFO(
            state.activeSmall,
            dt,
            elapsed,
            x,
            y,
            terrain.worldWidth,
            configs.small,
            terrain.points
          );
          
          if (!state.activeSmall.active) {
            console.log("🛸 Small UFO deactivated");
            if (!isDemo) { audio.current.stopUfoSmallSound(); }
          }
        }
        
        // Update medium UFO
        if (state.activeMedium?.active) {
          const projectile = updateUFO(
            state.activeMedium,
            dt,
            elapsed,
            x,
            y,
            terrain.worldWidth,
            DEFAULT_UFO_CONFIG
          );
          
          if (projectile) {
            newProjectiles.push(projectile);
          }
          
          if (!state.activeMedium.active) {
            console.log("🛸 Medium UFO deactivated");
            if (!isDemo) { audio.current.stopUfoMediumSound(); }
          }
        }
        
        // Update large UFO
        if (state.activeLarge?.active) {
          const burst = updateLargeUFO(
            state.activeLarge,
            dt,
            elapsed,
            x,
            y,
            terrain.worldWidth,
            configs.large
          );
          
          newProjectiles.push(...burst);
          
          if (!state.activeLarge.active) {
            console.log("🛸 Large UFO deactivated");
            if (!isDemo) { audio.current.stopUfoLargeSound(); }
          }
        }
        
        // Add new projectiles
        if (newProjectiles.length > 0) {
          console.log(`  🎯 Adding ${newProjectiles.length} new projectiles to pool (current: ${allProjectilesRef.current.length}, new total: ${allProjectilesRef.current.length + newProjectiles.length})`);
        }
        allProjectilesRef.current.push(...newProjectiles);
        
        // Update all projectiles
        updateProjectiles(allProjectilesRef.current, dt);
        
        // Check UFO-to-UFO collisions
        const activeUFOs = [state.activeSmall, state.activeMedium, state.activeLarge];
        const collisionResult = checkUFOToUFOCollisions(activeUFOs);
        
        if (collisionResult.destroyed.length > 0) {
          console.log(`💥 UFO Collision! Destroyed ${collisionResult.destroyed.length} UFO(s)`);
          
          // Create flash effects for destroyed UFOs
          for (const ufo of collisionResult.destroyed) {
            // Small flash effect using existing particle system
            const flashParticles = 8 + Math.floor(Math.random() * 8);
            for (let i = 0; i < flashParticles; i++) {
              const angle = (i / flashParticles) * Math.PI * 2;
              const speed = 80 + Math.random() * 60;
              const particle = particlePool.get();
              particle.x = ufo.x;
              particle.y = ufo.y;
              particle.vx = Math.cos(angle) * speed;
              particle.vy = Math.sin(angle) * speed;
              particle.life = 0;
              particle.max = 0.4 + Math.random() * 0.3;
              particle.color = neonColor;
              particles.push(particle);
            }
            
            // Deactivate destroyed UFO
            ufo.active = false;
            
            // Clear from state
            if (ufo === state.activeSmall) state.activeSmall = null;
            if (ufo === state.activeMedium) state.activeMedium = null;
            if (ufo === state.activeLarge) state.activeLarge = null;
          }
        }
      }
      
      // Update moving pads
      if (running) {
        const terrainData = terrain as TerrainData;
        if (terrainData.movingPads) {
          for (const movingPad of terrainData.movingPads) {
            movingPadSystem.updateMovingPad(movingPad, dt);
          }
          const mp = terrainData.movingPads[0];
          if (mp && !loggedMovingPadStart && mp.phase === "moving" && (Math.abs(mp.currentVelocity.x) + Math.abs(mp.currentVelocity.y)) > 0.1) {
            console.log("[MovingPad] Movement started", { pos: mp.currentPos, vel: mp.currentVelocity, speed: mp.speed });
          loggedMovingPadStart = true;
          }
        }
      }
      
      // Update volcanoes with performance optimization
      if (running && !isCavernLevel) {
        const terrainData = terrain as TerrainData;
        if (terrainData.volcanoes && terrainData.volcanoes.length > 0) {
          const viewWidth = c.width / dprInit;
          const viewLeft = cameraX - viewWidth / 2;
          const viewRight = cameraX + viewWidth / 2;
          
          const volcanoUpdate = updateVolcanoes(terrainData.volcanoes, volcanoParticles, dt, level, viewLeft, viewRight);
          if (volcanoUpdate.shouldPlayEruptionSound && volcanoUpdate.eruptingVolcanoes.length > 0 && !isDemo) {
            // Play spatial audio for each erupting volcano
            for (const volcano of volcanoUpdate.eruptingVolcanoes) {
              try { 
                audio.current.spatialExplosion(volcano.x, x, terrainData.worldWidth); 
              } catch {} 
            }
          }
          // Update volcano particles state with new particles
          setVolcanoParticles([...volcanoParticles]);
        }
      } else if (running) {
        const cavernData = terrain as CavernData;
        if (cavernData.volcanoes && cavernData.volcanoes.length > 0) {
          const cfg = getCavernVolcanoConfigForLevel(level);
          let playSound = false;
          for (const v of cavernData.volcanoes) {
            if (v.isErupting) {
              v.eruptionTimer -= dt;
              const rate = cfg.particleCount / v.eruptionDuration;
              v.emissionCarry = (v.emissionCarry ?? 0) + rate * dt;
              const particlesThisFrame = Math.floor(v.emissionCarry);
              v.emissionCarry -= particlesThisFrame;
              if (particlesThisFrame > 0) {
                const newParts = createCavernVolcanoParticles(v, cavernData, particlesThisFrame);
                volcanoParticles.push(...newParts);
              }
              if (v.eruptionTimer <= 0) {
                v.isErupting = false;
                v.nextEruption = v.eruptionInterval * (0.8 + Math.random() * 0.4);
              }
            } else {
              v.nextEruption -= dt;
              if (v.nextEruption <= 0) {
                v.isErupting = true;
                v.eruptionTimer = v.eruptionDuration;
                v.emissionCarry = 0;
                playSound = true;
              }
            }
          }
          // Cavern-specific particle physics with wall collision
          updateCavernVolcanoParticles(volcanoParticles, dt, cavernData);
          if (playSound && !isDemo) {
            try {
              const eruptingX = cavernData.volcanoes.reduce((acc, vv) => vv.isErupting ? vv.x : acc, x);
              audio.current.spatialExplosion(eruptingX, x, cavernData.worldWidth);
            } catch {}
          }
          setVolcanoParticles([...volcanoParticles]);
        }
      }
      
      // Update HUD at 8Hz instead of separate timer (integrated into main loop for performance)
      hudUpdateTimer += dt;
      if (hudUpdateTimer >= 0.12) { // 120ms = 8.33 Hz
        updateHud();
        hudUpdateTimer = 0;
      }
      
      // Hazard collisions (airborne) - with bounce physics
      const hazardResult = checkHazardCollision(hazards, x, y, 10);
      if (running && !crashed && !playerLockedRef.current && invulnerabilityTimer.current <= 0 && !shieldInvulnerableRef.current && hazardResult.collided) {
        // Check if shield absorbs the hit
        if (shieldActiveRef.current && hazardResult.hazard) {
          // Shield break effect with bounce physics
          spawnShieldBreak(x, y);
          shieldActiveRef.current = false;
          setShieldActive(false);
          shieldTimerRef.current = 0;
          
          // Bounce away from hazard (physics-based)
          const dx = x - hazardResult.hazard.x;
          const dy = y - hazardResult.hazard.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const bounceStrength = 150;
          vx += (dx / dist) * bounceStrength * dt;
          vy += (dy / dist) * bounceStrength * dt;
          
          // Grant brief invulnerability
          shieldInvulnerableRef.current = true;
          shieldInvulnerableTimerRef.current = SHIELD_INVULNERABLE_DURATION;
          
          if (!isDemo) { try { audio.current.shieldBreak?.(); } catch {} }
          if (gpProfileRef.current?.vibration) { try { void vibrate(150, 0.2, 0.6); } catch {} }
        } else if (!shieldActiveRef.current) {
          running = false;
          crashed = true;
          spawnExplosion();
          spawnDebris();
          if (!isDemo) {
            audio.current.explosion();
            audio.current.stopThruster();
            try { audio.current.stopFuelAlarm(); } catch {}
          }
          cameraShake = 24;
          if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
          setTimeout(() => {
            onGameOver({ score, landings, cause: "crash", difficulty, elapsed, levelSeed, level, initialSpawnX: initialSpawnRef.current.x, initialSpawnY: initialSpawnRef.current.y });
          }, 700);
        }
      }
      
      // UFO collision checks - with shield protection and bounce
      if (running && !crashed && !playerLockedRef.current && invulnerabilityTimer.current <= 0 && !shieldInvulnerableRef.current && ufoLevelConfigRef.current) {
        const state = ufoSpawnStateRef.current;
        const activeUFOs = [state.activeSmall, state.activeMedium, state.activeLarge];
        
        // Check UFO body collision
        const ufoHit = checkUFOCollision(activeUFOs, x, y, 10);
        if (ufoHit) {
          if (shieldActiveRef.current) {
            // Shield break effect with bounce physics
            spawnShieldBreak(x, y);
            shieldActiveRef.current = false;
            setShieldActive(false);
            shieldTimerRef.current = 0;
            
            // Bounce away from UFO
            const dx = x - ufoHit.x;
            const dy = y - ufoHit.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const bounceStrength = 150;
            vx += (dx / dist) * bounceStrength * dt;
            vy += (dy / dist) * bounceStrength * dt;
            
            // Grant brief invulnerability
            shieldInvulnerableRef.current = true;
            shieldInvulnerableTimerRef.current = SHIELD_INVULNERABLE_DURATION;
            
            if (!isDemo) { try { audio.current.shieldBreak?.(); } catch {} }
            if (gpProfileRef.current?.vibration) { try { void vibrate(150, 0.2, 0.6); } catch {} }
          } else {
            running = false;
            crashed = true;
            spawnExplosion();
            spawnDebris();
            if (!isDemo) {
              audio.current.explosion();
              audio.current.stopThruster();
              try { audio.current.stopFuelAlarm(); } catch {}
            }
            cameraShake = 22;
            if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
            
            // Clear UFO on crash
            state.activeSmall = null;
            state.activeMedium = null;
            state.activeLarge = null;
            allProjectilesRef.current = [];
            
            console.log(`💥 Crashed into ${ufoHit.type.toUpperCase()} UFO!`);
            setTimeout(() => {
              onGameOver({ score, landings, cause: "crash", difficulty, elapsed, levelSeed, level, initialSpawnX: initialSpawnRef.current.x, initialSpawnY: initialSpawnRef.current.y });
            }, 700);
          }
        }
        
        // Check UFO projectile collision
        if (running && !crashed && !shieldInvulnerableRef.current) {
          const projectileHit = checkProjectileCollision(allProjectilesRef.current, x, y, 10);
          if (projectileHit) {
            if (shieldActiveRef.current) {
              // Shield break effect with bounce physics
              spawnShieldBreak(x, y);
              shieldActiveRef.current = false;
              setShieldActive(false);
              shieldTimerRef.current = 0;
              
              // Bounce in direction opposite to projectile velocity
              const projSpeed = Math.sqrt(projectileHit.vx * projectileHit.vx + projectileHit.vy * projectileHit.vy) || 1;
              const bounceStrength = 100;
              vx -= (projectileHit.vx / projSpeed) * bounceStrength * dt;
              vy -= (projectileHit.vy / projSpeed) * bounceStrength * dt;
              
              // Remove the projectile
              projectileHit.active = false;
              
              // Grant brief invulnerability
              shieldInvulnerableRef.current = true;
              shieldInvulnerableTimerRef.current = SHIELD_INVULNERABLE_DURATION;
              
              if (!isDemo) { try { audio.current.shieldBreak?.(); } catch {} }
              if (gpProfileRef.current?.vibration) { try { void vibrate(150, 0.2, 0.6); } catch {} }
            } else {
              running = false;
              crashed = true;
              spawnExplosion();
              spawnDebris();
              if (!isDemo) {
                audio.current.explosion();
                audio.current.stopThruster();
                try { audio.current.stopFuelAlarm(); } catch {}
              }
              cameraShake = 18;
              if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
              
              // Remove hit projectile
              projectileHit.active = false;
              
              console.log("💥 Hit by UFO projectile!");
              setTimeout(() => {
                onGameOver({ score, landings, cause: "crash", difficulty, elapsed, levelSeed, level, initialSpawnX: initialSpawnRef.current.x, initialSpawnY: initialSpawnRef.current.y });
              }, 700);
            }
          }
        }
      }
      
      // Volcano particle collisions (airborne) - with bounce physics
      const volcanoResult = checkVolcanoParticleCollision(volcanoParticles, x, y, 10);
      if (running && !crashed && !playerLockedRef.current && invulnerabilityTimer.current <= 0 && !shieldInvulnerableRef.current && volcanoResult.collided) {
        // Check if shield absorbs the hit
        if (shieldActiveRef.current && volcanoResult.particle) {
          // Shield break effect with bounce physics
          spawnShieldBreak(x, y);
          shieldActiveRef.current = false;
          setShieldActive(false);
          shieldTimerRef.current = 0;
          
          // Bounce away from particle
          const dx = x - volcanoResult.particle.x;
          const dy = y - volcanoResult.particle.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const bounceStrength = 150;
          vx += (dx / dist) * bounceStrength * dt;
          vy += (dy / dist) * bounceStrength * dt;
          
          // Remove the particle that was hit
          const particleIndex = volcanoParticles.indexOf(volcanoResult.particle);
          if (particleIndex > -1) {
            volcanoParticles.splice(particleIndex, 1);
          }
          
          // Grant brief invulnerability
          shieldInvulnerableRef.current = true;
          shieldInvulnerableTimerRef.current = SHIELD_INVULNERABLE_DURATION;
          
          if (!isDemo) { try { audio.current.shieldBreak?.(); } catch {} }
          if (gpProfileRef.current?.vibration) { try { void vibrate(150, 0.2, 0.6); } catch {} }
        } else if (!shieldActiveRef.current) {
          running = false;
          crashed = true;
          spawnExplosion();
          spawnDebris();
          if (!isDemo) {
            audio.current.explosion();
            audio.current.stopThruster();
            try { audio.current.stopFuelAlarm(); } catch {}
          }
          cameraShake = 24;
          if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
          setTimeout(() => {
            onGameOver({ score, landings, cause: "crash", difficulty, elapsed, levelSeed, level, initialSpawnX: initialSpawnRef.current.x, initialSpawnY: initialSpawnRef.current.y });
          }, 700);
        }
      }
      
      // Update jellyfish (Level 5 underwater only)
      if (running && isUnderwater && !isCavernLevel && 'jellyfish' in terrain && terrain.jellyfish) {
        updateJellyfish(terrain.jellyfish, dt, elapsed, terrain.worldWidth, 800);
        
        // Check jellyfish collisions
        if (!crashed && invulnerabilityTimer.current <= 0 && !shieldInvulnerableRef.current) {
          const { directHit, shockwaveHit } = checkJellyfishCollision(
            terrain.jellyfish,
            x,
            y,
            10 // lander radius
          );
          
          // Direct hit = instant death (or shield absorbs with bounce)
          if (directHit) {
            // Check if shield absorbs the hit
            if (shieldActiveRef.current) {
              // Shield break effect with bounce physics
              spawnShieldBreak(x, y);
              shieldActiveRef.current = false;
              setShieldActive(false);
              shieldTimerRef.current = 0;
              
              // Bounce away from jellyfish
              const dx = x - directHit.x;
              const dy = y - directHit.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const bounceStrength = 150;
              vx += (dx / dist) * bounceStrength * dt;
              vy += (dy / dist) * bounceStrength * dt;
              
              // Grant brief invulnerability
              shieldInvulnerableRef.current = true;
              shieldInvulnerableTimerRef.current = SHIELD_INVULNERABLE_DURATION;
              
              if (!isDemo) { try { audio.current.shieldBreak?.(); } catch {} }
              if (gpProfileRef.current?.vibration) { try { void vibrate(150, 0.2, 0.6); } catch {} }
            } else {
              running = false;
              crashed = true;
              spawnExplosion();
              spawnDebris();
              if (!isDemo) {
                audio.current.explosion();
                audio.current.stopThruster();
              }
              cameraShake = 24;
              if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
              setTimeout(() => {
                onGameOver({ score, landings, cause: "crash", difficulty, elapsed, levelSeed, level, initialSpawnX: initialSpawnRef.current.x, initialSpawnY: initialSpawnRef.current.y });
              }, 700);
            }
          }
          // Shockwave hit = knockback + paralysis (only if not already paralyzed)
          else if (shockwaveHit && !isParalyzed) {
            isParalyzed = true;
            paralysisTimer = 3.0; // 3 seconds
            electrifiedTimer = 3.0;
            lastShockwaveSource = { x: shockwaveHit.x, y: shockwaveHit.y };
            
            // Knockback away from jellyfish
            const dx = x - shockwaveHit.x;
            const dy = y - shockwaveHit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const knockbackForce = 15; // Reduced knockback (10% of original)
            
            if (dist > 0) {
              vx += (dx / dist) * knockbackForce;
              vy += (dy / dist) * knockbackForce;
            }
            
            cameraShake = 12;
            if (!isDemo) { audio.current.jellyfishShock(); }
            if (gpProfileRef.current?.vibration) { try { void vibrate(150, 0.2, 0.8); } catch {} }
          }
        }
      }

      // Update paralysis state
      if (isParalyzed) {
        paralysisTimer -= dt;
        electrifiedTimer -= dt;
        
        if (paralysisTimer <= 0) {
          isParalyzed = false;
          paralysisTimer = 0;
        }
        
        if (electrifiedTimer <= 0) {
          electrifiedTimer = 0;
        }
      }
      
      // Check collectible pickups
      if (running && collectiblesRef.current && !crashed) {
        for (const junk of collectiblesRef.current.spaceJunk) {
          if (checkJunkPickup({ x, y }, 16, junk)) {
            const result = collectJunk(collectiblesRef.current, junk.id);
            if (result.fuelReward > 0) {
              fuel += result.fuelReward;
              if (!isDemo) { audio.current.junkPickup(); }
            }
            if (result.points > 0) score += result.points;
            if (result.setComplete) {
              if (!isDemo) { audio.current.junkSetComplete(); }
              
              // Award shield for collecting all 3 items!
              if (!shieldActiveRef.current) {
                shieldActiveRef.current = true;
                setShieldActive(true);
                shieldTimerRef.current = SHIELD_DURATION;
                if (!isDemo) { try { audio.current.shieldPickup?.(); } catch {} }
                setBonusMessages(prev => [...prev, "SHIELD ACTIVATED!"]);
              } else {
                // Already have shield - reset timer
                shieldTimerRef.current = SHIELD_DURATION;
                setBonusMessages(prev => [...prev, "SHIELD RECHARGED!"]);
              }
              
              // For collection levels, add visual feedback that pads are now available
              if (isCollectionLevel(mode, level)) {
                setBonusMessages(prev => [...prev, "LANDING PADS ACTIVATED"]);
                screenFlashAlpha.current = 0.5; // Brief flash effect
              }
              
              // Generate wormhole door
              if (!collectiblesRef.current.wormholeDoor) {
                const context = {
                  worldWidth: terrain.worldWidth,
                  worldHeight: isCavernLevel ? (terrain as any).worldHeight : 800,
                  getHeightAt: terrain.getHeightAt,
                  pads: terrain.pads,
                  shipHeight: 32,
                  mode: isCavernLevel ? "caverns" as const : "surface" as const,
                  startPos: { x: terrain.worldWidth / 2, y: 200 },
                  goalPos: { x: terrain.pads[terrain.pads.length - 1]?.xStart || terrain.worldWidth - 100, y: terrain.pads[terrain.pads.length - 1]?.y || 400 },
                  checkCollision: isCavernLevel ? (terrain as any).checkCollision : undefined,
                  chunkNumber: 0, // Not chunk-based (fixed level)
                  level: levelVar || 1 // Pass level for difficulty-based placement
                };
                collectiblesRef.current.wormholeDoor = generateWormholeDoor(seed, context);
                if (collectiblesRef.current.wormholeDoor) {
                  if (!isDemo) { audio.current.wormholeOpen(); }
                }
              }
            }
          }
        }
        
        // Check wormhole entry
        if (collectiblesRef.current.wormholeDoor && checkWormholeEntry({ x, y }, 16, collectiblesRef.current.wormholeDoor)) {
          if (!isDemo) { audio.current.wormholeEnter(); }
          // TODO: Launch bonus game
          score += 2000; // Temporary bonus
        }
      }

      // Collision check against terrain or cavern
      if (running) {
        let collisionDetected = false;
        
        if (isCavernLevel) {
          // Cavern collision using custom collision detection
          const cavernData = terrain as CavernData;
          collisionDetected = cavernData.checkCollision(x, y, 8);
        } else {
          // Normal terrain collision
          const ground = terrain.getHeightAt(x);
          const foot = y + 8; // lander foot approximation
          collisionDetected = foot >= ground;
        }
        
        if (collisionDetected && !playerLockedRef.current && invulnerabilityTimer.current <= 0) {
          const pad = null; // Don't use center-based detection - use feet-based only
          let nearPad: Pad | null = null;
          
          // Check for moving pad collision first
          let movingPadLanding: MovingPad | null = null;
          const terrainData = terrain as TerrainData;
          if (terrainData.movingPads && terrainData.getMovingPadAt) {
            movingPadLanding = terrainData.getMovingPadAt(x, y, level);
          }
          if (!isCavernLevel) {
            const collectionLevel = isCollectionLevel(mode, level);
            const padsActive = !collectionLevel || (collectiblesRef.current?.setComplete ?? false);
            
            if (padsActive) {
              const t = terrain as TerrainData;
              const xx = ((x % t.worldWidth) + t.worldWidth) % t.worldWidth;
            // Lander feet positions (feet are 24px wide total, ±12px from center)
            const leftFoot = ((xx - 12) % t.worldWidth + t.worldWidth) % t.worldWidth;
            const rightFoot = ((xx + 12) % t.worldWidth + t.worldWidth) % t.worldWidth;
            
            for (const p of t.pads) {
              const w = p.width ?? (p.xEnd >= p.xStart ? (p.xEnd - p.xStart) : (t.worldWidth - p.xStart + p.xEnd));
              const margin = 0; // Strict landing - both feet must be on pad
              
              // Check if BOTH feet are within pad boundaries (with margin)
              let bothFeetOnPad = false;
              
              if (p.xStart <= p.xEnd) {
                // Normal pad (doesn't wrap)
                const leftOnPad = (leftFoot >= p.xStart - margin && leftFoot <= p.xEnd + margin);
                const rightOnPad = (rightFoot >= p.xStart - margin && rightFoot <= p.xEnd + margin);
                bothFeetOnPad = leftOnPad && rightOnPad;
              } else {
                // Wrapping pad
                const leftOnPad = (leftFoot >= p.xStart - margin) || (leftFoot <= p.xEnd + margin);
                const rightOnPad = (rightFoot >= p.xStart - margin) || (rightFoot <= p.xEnd + margin);
                bothFeetOnPad = leftOnPad && rightOnPad;
              }
              
              if (bothFeetOnPad) { nearPad = p; break; }
            }
            }
          }
          const okAngle = Math.abs(angle) < (difficulty === "easy" ? 0.18 : 0.12); // ~10deg or ~7deg
          
          // For moving pads, use relative velocity with lenient horizontal thresholds
          let okVy: boolean, okVx: boolean;
          if (movingPadLanding) {
            const relativeVel = movingPadSystem.getRelativeVelocity(vx, vy, movingPadLanding);
            // Base vertical threshold
            let vyThresh = (difficulty === "easy" ? 2.0 : 1.5);
            
            // Progressive level-based forgiveness after level 5
            if (level > 5) {
              const levelForgiveness = (level - 5) * 0.15;
              vyThresh += levelForgiveness;
            }
            
            // Enhanced forgiveness for fast moving pads
            const pWidth = movingPadLanding.width ?? 32;
            const centerDist = Math.abs(x - movingPadLanding.currentPos.x);
            const nearCenter = centerDist <= pWidth * 0.5; // Expanded from 40% to 50%
            const baseSpeed = movingPadLanding.baseSpeed ?? movingPadLanding.speed;
            const isVeryFast = movingPadLanding.speed >= 2 * baseSpeed; // Lowered from 3x to 2x
            if (isVeryFast && nearCenter && okAngle) {
              vyThresh *= 1.6; // Increased from 1.35x to 1.6x forgiveness
            }
            
            okVy = Math.abs(relativeVel.y) < vyThresh;
            
            // Scale horizontal threshold with level and pad speed
            let vxThresh = 25.0; // Base threshold
            
            // Progressive level-based forgiveness after level 5 (same as vertical)
            if (level > 5) {
              const levelForgiveness = (level - 5) * 3.0; // 3.0 px/s per level
              vxThresh += levelForgiveness;
            }
            
            // Additional forgiveness for very fast pads (same logic as vertical)
            if (isVeryFast && nearCenter && okAngle) {
              vxThresh *= 1.6; // 60% increase for very fast pads
            }
            
            okVx = Math.abs(relativeVel.x) < vxThresh;
          } else {
            okVy = Math.abs(vy) < (difficulty === "easy" ? 1.8 : 1.2);
            okVx = Math.abs(vx) < (difficulty === "easy" ? 1.5 : 1.0);
          }

          if (isCavernLevel) {
             const cav = terrain as CavernData;
              // Allow settling on the start pad without completing the mission
              if (pad === cav.startPad && okAngle && okVy && okVx) {
                // Gentle landing on start pad - rest slightly higher for clean lift-off
                if (vy > 0.05) { // Only stop if actually descending
                  y = pad.y - 14;
                  vy = 0; 
                  // Do not lock vx, av, or angle — allow immediate takeoff with light thrust
                }
                // Do NOT end the run here; simply rest on the start pad
            } else if (pad === cav.endPad && okAngle && okVy && okVx && fuel >= 0) {
              // successful landing ONLY on cavern end pad
              y = pad.y - 10;
              vy = 0; vx = 0; av = 0; angle = 0;
              const finesse = Math.floor(200 * (1 - Math.max(Math.abs(vx), Math.abs(vy)) / 2));
              let earned = Math.max(50, Math.floor(pad.multiplier * 150 + finesse));
              const applied2x = !!pad.bonus2x;
              if (applied2x) earned *= 2;
              const pWidth = pad.width ?? (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
              const pCenter = (pad.xEnd >= pad.xStart)
                ? (pad.xStart + pad.xEnd) / 2
                : ((pad.xStart + (pad.xEnd + terrain.worldWidth)) / 2) % terrain.worldWidth;
              let dx = (x - pCenter + terrain.worldWidth / 2) % terrain.worldWidth; dx -= terrain.worldWidth / 2;
              const bullseye = Math.abs(dx) <= pWidth * 0.03;
              const speedBonus = elapsed < 10;
              if (bullseye) { earned += 500; }
              if (speedBonus) { earned += 500; }

              score += earned;
              landings += 1;
              setCurrentLandings(landings);
              
              // Save landing bonus information for cavern landing
              setLastLandingBonuses({
                bullseye,
                speedBonus,
                padBonus2x: applied2x,
                lastEarned: earned
              });
              
              // Build message queue for display
              const messages: string[] = [];
              if (speedBonus) messages.push("500 POINT SPEED BONUS");
              if (bullseye) messages.push("500 POINT BULLSEYE");
              if (messages.length > 0 && !hasShownBonusThisLanding.current) {
                setBonusMessages(messages);
                hasShownBonusThisLanding.current = true;
              }
              
              // Reset style points for next flight (caverns mode doesn't use style points)
              resetStylePoints(stylePointsStateRef.current);
              
              cameraShake = 6;
              audio.current.landing();
              audio.current.stopThruster();
              try { audio.current.stopFuelAlarm(); } catch {}
              if (gpProfileRef.current?.vibration && bullseye) { try { void vibrate(140, 0.2, 0.7); } catch {} }
              running = false;
              setTimeout(() => {
                 // For cavern mode, don't check ghost beating (ghosts are only in fixed mode)
                 const padType = applied2x ? '2x' : 'regular';
                 setLandingType(padType);
                 setShowFireworks(true);
                 
                 // Trigger bonus message display
                 if (messages.length > 0) {
                   setShowBonusMessages(true);
                 }
                 
                 // Precache next level's music in background
                 if (!isDemo) { audio.current.precacheLevelTrack(level); }
                }, 500);
            } else {
              // crash on cavern walls/floor or invalid landing
              // Check if shield absorbs the hit (with bounce physics)
              if (shieldActiveRef.current && !shieldInvulnerableRef.current) {
                // Shield break effect with bounce physics
                spawnShieldBreak(x, y);
                shieldActiveRef.current = false;
                setShieldActive(false);
                shieldTimerRef.current = 0;
                
                // Bounce away from terrain (upward and random horizontal)
                vx += (Math.random() - 0.5) * 100 * dt;
                vy = Math.min(vy, -1.5); // Ensure upward bounce
                
                // Push lander slightly away from collision point
                y -= 5;
                
                // Grant brief invulnerability
                shieldInvulnerableRef.current = true;
                shieldInvulnerableTimerRef.current = SHIELD_INVULNERABLE_DURATION;
                
                cameraShake = 10;
                if (!isDemo) { try { audio.current.shieldBreak?.(); } catch {} }
                if (gpProfileRef.current?.vibration) { try { void vibrate(150, 0.2, 0.6); } catch {} }
              } else if (!shieldActiveRef.current) {
                running = false;
                crashed = true;
                spawnExplosion();
                spawnDebris();
                if (!isDemo) {
                  audio.current.explosion();
                  audio.current.stopThruster();
                  try { audio.current.stopFuelAlarm(); } catch {}
                }
                cameraShake = 24;
                if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
                setTimeout(() => {
                  onGameOver({ score, landings, cause: fuel <= 0 ? "fuel" : "crash", difficulty, elapsed, levelSeed, level, initialSpawnX: initialSpawnRef.current.x, initialSpawnY: initialSpawnRef.current.y });
                }, 700);
              }
            }
          } else if (movingPadLanding && okAngle && okVy && okVx && fuel >= 0) {
            // MEGA! Moving pad landing
            const landedPad = movingPadLanding;
            y = landedPad.currentPos.y - 8;
            vy = landedPad.currentVelocity.y; 
            vx = landedPad.currentVelocity.x; 
            av = 0; angle = 0;
            
            // Calculate relative velocity for finesse bonus
            const relativeVel = movingPadSystem.getRelativeVelocity(vx, vy, landedPad);
            const finesse = Math.floor(200 * (1 - Math.max(Math.abs(relativeVel.x), Math.abs(relativeVel.y)) / 2));
            let earned = Math.max(50, Math.floor(landedPad.multiplier * 150 + finesse));
            
            // Apply MEGA multiplier!
            earned = Math.floor(earned * landedPad.scoreMult);
            
            const pWidth = landedPad.width ?? 32;
              const bullseye = Math.abs(x - landedPad.currentPos.x) <= pWidth * 0.03;
              const speedBonus = elapsed < 10;
              if (bullseye) { earned += Math.floor(500 * landedPad.scoreMult); }
              if (speedBonus) { earned += Math.floor(500 * landedPad.scoreMult); }
              
              // Check for perfect landing (classic and fixed only)
              let perfectLanding = false;
              if (mode === "classic" || mode === "fixed") {
                perfectLanding = checkPerfectLanding(vx, vy, okAngle, okVx, okVy, bullseye);
                if (perfectLanding) {
                  earned += Math.floor(1000 * landedPad.scoreMult);
                }
              }
              
              score += earned;
            landings += 1;
            setCurrentLandings(landings);
            
            // Save landing bonus information for moving pad landing
            setLastLandingBonuses({
              bullseye,
              speedBonus,
              padBonus2x: false, // Moving pads don't have 2x bonus
              lastEarned: earned
            });
            
              // Build message queue for display
              const messages: string[] = [];
              if (speedBonus) messages.push("500 POINT SPEED BONUS");
              if (bullseye) messages.push("500 POINT BULLSEYE");
              if (perfectLanding) messages.push("1000 POINT PERFECT LANDING!");
              if (messages.length > 0 && !hasShownBonusThisLanding.current) {
                setBonusMessages(messages);
                hasShownBonusThisLanding.current = true;
              }
              
              // Reset style points for next flight
              resetStylePoints(stylePointsStateRef.current);
            
            cameraShake = 8; // Extra camera shake for MEGA landing
            if (!isDemo) {
              audio.current.landing();
              audio.current.stopThruster();
              try { audio.current.stopFuelAlarm(); } catch {}
            }
            if (gpProfileRef.current?.vibration) { try { void vibrate(200, 0.3, 0.9); } catch {} } // Extra vibration
            running = false;
            setTimeout(() => {
              setLandingType('moving');
              setShowFireworks(true);
              
              // Trigger bonus message display
              if (messages.length > 0) {
                setShowBonusMessages(true);
              }
              
              // Precache next level's music in background
              if (!isDemo) { audio.current.precacheLevelTrack(level); }
            }, 500);
          } else if (nearPad && okAngle && okVy && okVx && fuel >= 0) {
            // Time Trial Mode: Check for sequenced landing
            if (isTimeTrial && !isCavernLevel) {
              const landedPad = (pad || nearPad)!;
              const ttState = timeTrialStateRef.current;
              
              // Check if this is a sequenced pad
              const sequencedPad = ttState.sequencedPads.find(p => 
                p.xStart === landedPad.xStart && p.y === landedPad.y
              );
              
              if (sequencedPad) {
                // Check if landing on correct pad in sequence
                if (sequencedPad.sequenceNumber === ttState.currentTarget) {
                  // Correct pad! Advance sequence
                  y = landedPad.y - 8;
                  vy = 0; vx = 0; av = 0; angle = 0;
                  
                  // Award fuel bonus for successful landing
                  fuel += 25;
                  fuel = Math.min(fuel, fuelCap); // Don't exceed fuel cap
                  
                  // Mark pad as completed and advance target
                  const updatedPads = ttState.sequencedPads.map(p =>
                    p.sequenceNumber === sequencedPad.sequenceNumber
                      ? { ...p, completed: true }
                      : p
                  );
                  
                  const newTarget = ttState.currentTarget + 1;
                  const completedSeq = [...ttState.completedSequence, sequencedPad.sequenceNumber];
                  
                  setTimeTrialState(prev => ({
                    ...prev,
                    sequencedPads: updatedPads,
                    currentTarget: newTarget,
                    completedSequence: completedSeq
                  }));
                  
                  // Check if all pads completed
                  if (newTarget > ttState.totalPadsRequired) {
                    // Race complete!
                    const completionTime = performance.now() - ttState.raceStartTime;
                    
                    setTimeTrialState(prev => ({
                      ...prev,
                      raceEndTime: completionTime,
                      raceActive: false
                    }));
                    
                    console.log("⏱️ Time Trial Complete!", {
                      completionTime,
                      completedSequence: completedSeq,
                      level
                    });
                    
                    timeTrialCompletionDataRef.current = {
                      completionTime,
                      level,
                      difficulty,
                      ghostFrames: [...timeTrialGhostFrames.current]
                    };
                    
                    cameraShake = 6;
                    if (!isDemo) {
                      audio.current.landingCrash();
                      audio.current.stopThruster();
                      try { audio.current.stopFuelAlarm(); } catch {}
                    }
                    running = false;
                    
                    setTimeout(() => {
                      setLandingType('regular');
                      setShowFireworks(true);
                      
                      // Precache next level's music in background
                      if (!isDemo) { audio.current.precacheLevelTrack(level); }
                    }, 500);
                  } else {
                    // More pads to go - play landing sound once and continue
                    if (!hasPlayedLandingSoundRef.current && !isDemo) {
                      audio.current.landingCrash();
                      hasPlayedLandingSoundRef.current = true;
                      cameraShake = 3;
                    }
                    
                    // Track last velocity to detect takeoff
                    const lastVy = vy;
                    const lastVx = vx;
                    const checkInterval = setInterval(() => {
                      // Detect takeoff from pad
                      if (Math.abs(vy - lastVy) > 0.1 || Math.abs(vx - lastVx) > 0.1) {
                        if (!isDemo) { audio.current.fadeLandingSound(2.0); }
                        clearInterval(checkInterval);
                      }
                    }, 100);
                    
                    // Clear interval after 5 seconds
                    setTimeout(() => clearInterval(checkInterval), 5000);
                  }
                } else {
                  // Wrong pad - currently just warning, no penalty
                  console.warn("⚠️ Wrong pad! Expected", ttState.currentTarget, "but landed on", sequencedPad.sequenceNumber);
                  // For now, allow takeoff without penalty - could add penalty later
                  y = landedPad.y - 8;
                  vy = 0; vx = 0; av = 0; angle = 0;
                  
                  if (!hasPlayedLandingSoundRef.current && !isDemo) {
                    audio.current.landingCrash();
                    hasPlayedLandingSoundRef.current = true;
                    cameraShake = 2;
                  }
                  
                  setTimeout(() => {
                    // Resume
                  }, 100);
                }
              }
            } else {
              // Regular landing logic (non-time-trial)
              // Regular landing logic (non-time-trial)
              const landedPad = (pad || nearPad)!;
              y = landedPad.y - 8;
              vy = 0; vx = 0; av = 0; angle = 0;
              const finesse = Math.floor(200 * (1 - Math.max(Math.abs(vx), Math.abs(vy)) / 2));
              let earned = Math.max(50, Math.floor(landedPad.multiplier * 150 + finesse));
              const applied2x = !!landedPad.bonus2x;
              if (applied2x) earned *= 2;
              const pWidth = landedPad.width ?? (landedPad.xEnd >= landedPad.xStart ? (landedPad.xEnd - landedPad.xStart) : (terrain.worldWidth - landedPad.xStart + landedPad.xEnd));
              const pCenter = (landedPad.xEnd >= landedPad.xStart)
                ? (landedPad.xStart + landedPad.xEnd) / 2
                : ((landedPad.xStart + (landedPad.xEnd + terrain.worldWidth)) / 2) % terrain.worldWidth;
              let dx = (x - pCenter + terrain.worldWidth / 2) % terrain.worldWidth; dx -= terrain.worldWidth / 2;
              const bullseye = Math.abs(dx) <= pWidth * 0.03;
              const speedBonus = elapsed < 10;
              if (bullseye) { earned += 500; }
              if (speedBonus) { earned += 500; }
              
              // Check for perfect landing (classic and fixed only)
              let perfectLanding = false;
              if (mode === "classic" || mode === "fixed") {
                perfectLanding = checkPerfectLanding(vx, vy, okAngle, okVx, okVy, bullseye);
                if (perfectLanding) {
                  earned += 1000;
                }
              }

              score += earned;
              landings += 1;
              setCurrentLandings(landings);
              
              // Save landing bonus information for game over screen
              setLastLandingBonuses({
                bullseye,
                speedBonus,
                padBonus2x: applied2x,
                lastEarned: earned
              });
              
              // Build message queue for display
              const messages: string[] = [];
              if (speedBonus) messages.push("500 POINT SPEED BONUS");
              if (bullseye) messages.push("500 POINT BULLSEYE");
              if (perfectLanding) messages.push("1000 POINT PERFECT LANDING!");
              if (messages.length > 0 && !hasShownBonusThisLanding.current) {
                setBonusMessages(messages);
                hasShownBonusThisLanding.current = true;
              }
              
              // Reset style points for next flight
              resetStylePoints(stylePointsStateRef.current);
              
              cameraShake = 6;
              if (!isDemo) {
                audio.current.landing();
                audio.current.stopThruster();
                try { audio.current.stopFuelAlarm(); } catch {}
              }
              if (gpProfileRef.current?.vibration && bullseye) { try { void vibrate(140, 0.2, 0.7); } catch {} }
              running = false;
              setTimeout(() => {
                // Ghost-beating check: check if ghost is still visible (hasn't landed yet)
                const currentGhostState = isGhostMode ? ghostManager.current.getLunarLanderGhostState(difficulty, level, elapsed) : null;
                const isGhostBeaten = isGhostMode && currentGhostState !== null && currentGhostState.visible;
                
                const padType = isGhostBeaten ? 'ghost-beaten' : applied2x ? '2x' : 'regular';
                
                setLandingType(padType);
                setShowFireworks(true);
                
                // Trigger bonus message display
                if (messages.length > 0) {
                  setShowBonusMessages(true);
                }
                
                // Precache next level's music in background
                if (!isDemo) { audio.current.precacheLevelTrack(level); }
              }, 500);
            }
          } else {
            // crash - check if shield absorbs the hit (with bounce physics)
            if (shieldActiveRef.current && !shieldInvulnerableRef.current) {
              // Shield break effect with bounce physics
              spawnShieldBreak(x, y);
              shieldActiveRef.current = false;
              setShieldActive(false);
              shieldTimerRef.current = 0;
              
              // Bounce away from terrain (upward and random horizontal)
              vx += (Math.random() - 0.5) * 100 * dt;
              vy = Math.min(vy, -1.5); // Ensure upward bounce
              
              // Push lander slightly above terrain
              const ground = terrain.getHeightAt(x);
              y = ground - 15;
              
              // Grant brief invulnerability
              shieldInvulnerableRef.current = true;
              shieldInvulnerableTimerRef.current = SHIELD_INVULNERABLE_DURATION;
              
              cameraShake = 10;
              if (!isDemo) { try { audio.current.shieldBreak?.(); } catch {} }
              if (gpProfileRef.current?.vibration) { try { void vibrate(150, 0.2, 0.6); } catch {} }
            } else if (!shieldActiveRef.current) {
              running = false;
              crashed = true;
              spawnExplosion();
              spawnDebris();
              if (!isDemo) {
                audio.current.explosion();
                audio.current.stopThruster();
                try { audio.current.stopFuelAlarm(); } catch {}
              }
              cameraShake = 24;
              if (gpProfileRef.current?.vibration) { try { void vibrate(220, 0.3, 1); } catch {} }
              setTimeout(() => {
                onGameOver({ score, landings, cause: fuel <= 0 ? "fuel" : "crash", difficulty, elapsed, levelSeed, level, initialSpawnX: initialSpawnRef.current.x, initialSpawnY: initialSpawnRef.current.y });
              }, 700);
            }
          }
        }
      }

      // Camera (smoothed tracking and zoom)
      if (isCavernLevel) {
        // Keep lander centered horizontally in caverns
        cameraX = x;
      } else {
        const leadTime = 0.35;
        const targetCamX = wrapX(x + vx * leadTime);
        const w = terrain.worldWidth;
        let wrappedDelta = (targetCamX - cameraX + w / 2) % w;
        if (wrappedDelta < 0) wrappedDelta += w;
        wrappedDelta -= w / 2;
        const camAlpha = 1 - Math.exp(-dt / 0.28);
        cameraX = wrapX(cameraX + wrappedDelta * camAlpha);
      }
      // Effective clearance sampling ahead/behind to reduce terrain jaggle
      const sampleClearance = () => {
        const leadX = wrapX(x + vx * 0.4);
        const offs = [-120, -60, 0, 60, 120];
        let minClr = Infinity;
        for (const o of offs) {
          const gx = wrapX(leadX + o);
          const gy = terrain.getHeightAt(gx);
          const clr = Math.max(0, gy - y);
          if (clr < minClr) minClr = clr;
        }
        return minClr;
      };
      const rawClr = sampleClearance();
      // Exponential smoothing on clearance
      const tau = 1.2; // seconds
      const alphaC = 1 - Math.exp(-dt / tau);
      clearanceEMA += (rawClr - clearanceEMA) * alphaC;
      const effClr = clearanceEMA;

      // Helper function to find nearest landing pad distance
      const getNearestPadDistance = (): number => {
        let minDistance = Infinity;
        
        // Check static pads
        for (const pad of terrain.pads) {
          const padCenterX = (pad.xStart + pad.xEnd) / 2;
          let dx = Math.abs(x - padCenterX);
          
          // Handle world wrapping for normal levels
          if (!isCavernLevel) {
            dx = Math.min(dx, Math.abs(x - (padCenterX + terrain.worldWidth)), Math.abs(x - (padCenterX - terrain.worldWidth)));
          }
          
          const dy = Math.abs(y - pad.y);
          const distance = Math.sqrt(dx * dx + dy * dy);
          minDistance = Math.min(minDistance, distance);
        }
        
        // Check moving pads if available
        const terrainData = terrain as TerrainData;
        if (terrainData.movingPads) {
          for (const movingPad of terrainData.movingPads) {
            const dx = Math.abs(x - movingPad.currentPos.x);
            const dy = Math.abs(y - movingPad.currentPos.y);
            const distance = Math.sqrt(dx * dx + dy * dy);
            minDistance = Math.min(minDistance, distance);
          }
        }
        
        return minDistance;
      };

      // Calculate enhanced zoom based on terrain clearance AND landing pad proximity
      // Mobile devices start more zoomed out (30% reduction for better visibility)
      const isMobileDevice = !isDesktopDevice();
      const mobileZoomMultiplier = isMobileDevice ? 0.7 : 1.0;
      
      let targetZoom = 1.0;
      
      if (isCavernLevel) {
        // For cavern levels, use base zoom but allow enhancement near pads
        targetZoom = 1.2;
        
        // Check for pad proximity enhancement in caverns too
        const nearestPadDist = getNearestPadDistance();
        const padDetectionRange = 250;
        
        if (nearestPadDist < padDetectionRange) {
          // Enhanced zoom for landing approach (1.2x to 3.0x)
          const padProximityRatio = 1 - (nearestPadDist / padDetectionRange);
          const enhancedZoom = 1.2 + (1.8 * padProximityRatio * padProximityRatio); // Exponential curve
          targetZoom = Math.max(targetZoom, enhancedZoom);
        }
      } else {
        // Normal levels: dynamic terrain-based zoom with pad enhancement
        const near = 0, far = 420;
        const tRaw = Math.min(1, Math.max(0, (effClr - near) / (far - near)));
        const s = tRaw * tRaw * (3 - 2 * tRaw);
        
        // Base terrain zoom (1.0x to 1.4x on desktop, 0.7x to 0.98x on mobile)
        const baseMin = 1.0 * mobileZoomMultiplier;
        const baseMax = 1.4 * mobileZoomMultiplier;
        targetZoom = baseMax * (1 - s) + baseMin * s;
        
        // Check for landing pad proximity enhancement
        const nearestPadDist = getNearestPadDistance();
        const padDetectionRange = 250;
        
        if (nearestPadDist < padDetectionRange) {
          // Enhanced zoom for landing approach (1.4x to 3.0x on desktop, 0.98x to 2.1x on mobile)
          const padProximityRatio = 1 - (nearestPadDist / padDetectionRange);
          const enhancedZoom = (1.4 + (1.6 * padProximityRatio * padProximityRatio)) * mobileZoomMultiplier;
          targetZoom = Math.max(targetZoom, enhancedZoom);
        }
      }
      
      // Special zoom out for level 4 classic mode - DISABLED (was for reflection effect)
      // if (mode === "classic" && level === 4) {
      //   targetZoom = targetZoom / 2;
      // }
      
      // Apply hysteresis and smooth transitions
      if (Math.abs(targetZoom - prevTargetZoom) < 0.015) targetZoom = prevTargetZoom;
      prevTargetZoom = targetZoom;

      const zoomAlpha = 1 - Math.exp(-dt / 1.6);
      const desiredDelta = (targetZoom - zoom) * zoomAlpha;
      const maxRate = 0.28; // units per second
      const maxStep = maxRate * dt;
      zoom += Math.max(-maxStep, Math.min(maxStep, desiredDelta));
      if (cameraShake > 0) cameraShake -= 60 * dt;

      // Spawn ambient bubbles from cavern floor when underwater
      if (isUnderwater && Math.random() < 0.04 * dt * 60) {
        const bubbleSize = Math.random() < 0.7 ? 
          (2 + Math.random() * 4) :    // 70% chance: small (2-6px)
          (4 + Math.random() * 5);     // 30% chance: large (4-9px)
        
        // Spawn bubbles across the world width
        const spawnX = Math.random() * WORLD_WIDTH;
        const spawnY = terrain.getHeightAt(spawnX) - 10; // Just above terrain floor
        
        // Extended lifespan (2-6x longer)
        const lifespanMultiplier = 2 + Math.random() * 4;  // 2-6x
        const baseLifespan = 4 + Math.random() * 3;        // Base: 4-7s
        
        particles.push({
          x: spawnX,
          y: spawnY,
          vx: (Math.random() - 0.5) * 15,  // Gentle horizontal drift
          vy: -25 - Math.random() * 20,    // Float upward (25-45 px/s)
          life: 0,
          max: baseLifespan * lifespanMultiplier,  // 8-42 second lifespan
          color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)],
          isBubble: true,
          size: bubbleSize
        });
      }
      
      // Enhanced particles update with thruster-friendly limits
      // iPad capped at 150 particles to reduce draw calls while maintaining visuals
      const maxParticles = shouldOptimizePerformance ? 30 : (useIPadThrusterOptimization ? 150 : (isUnderwater ? 150 : 300));
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        
      if (p.isBubble && isUnderwater) {
        // BUBBLE PHYSICS
        
        // Increased upward buoyancy force
        p.vy -= 170 * dt;
          
          // Horizontal wobble (sine wave oscillation)
          const wobbleFreq = 3 + (p.size || 3) * 0.5;  // Larger bubbles wobble slower
          p.vx += Math.sin(p.life * wobbleFreq) * 15 * dt;
          
          // Terminal velocity cap (larger bubbles rise faster)
          const terminalVel = -100 - (p.size || 3) * 10;  // -130 to -160 px/s
          if (p.vy < terminalVel) p.vy = terminalVel;
          
          // Extra water drag
          p.vx *= 0.97;
          p.vy *= 0.99;
          
          // Aggressive culling - remove bubbles off-screen in any direction
          const canvasH = c.height;
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const viewHeight = canvasH / (dpr * zoom);
          const viewWidth = c.width / (dpr * zoom);
          const screenTopY = y - (viewHeight / 2);
          const screenLeftX = x - (viewWidth / 2);
          const screenRightX = x + (viewWidth / 2);
          
          if (p.y < screenTopY - 50 || p.x < screenLeftX - 50 || p.x > screenRightX + 50) {  // 50px buffer
            // Spawn pop effect (high graphics only)
            if (!shouldOptimizePerformance) {
              for (let j = 0; j < 4; j++) {
                particles.push({
                  x: p.x,
                  y: p.y,
                  vx: (Math.random() - 0.5) * 50,
                  vy: (Math.random() - 0.5) * 50,
                  life: 0,
                  max: 0.25,
                  color: p.color,
                  isBubble: false,  // Tiny sparkles, not bubbles
                  size: 1
                });
              }
            }
            particlePool.release(p);
            particles.splice(i, 1);
            continue;
          }
        } else {
          // REGULAR PARTICLE PHYSICS
          // Time-based damping: lose 30% speed over the particle's lifetime
          const dampenFactor = Math.pow(0.7, dt / p.max); // Exponential decay, frame-independent
          p.vx *= dampenFactor;
          p.vy *= dampenFactor;
        }
        
        if (p.life > p.max) {
          particlePool.release(p);
          particles.splice(i, 1);
        }
      }
      // Limit total particle count for performance
      while (particles.length > maxParticles) {
        const p = particles.shift();
        if (p) particlePool.release(p);
      }

      // Debris update with wrapping and terrain bounces + performance limiting
      const maxDebris = shouldOptimizePerformance ? 20 : 40;
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.life += dt;
        // air drag
        d.vx *= 0.996;
        d.vy = d.vy * 0.996 + gravity * 60 * dt;
        d.x = wrapX(d.x + d.vx * dt);
        d.y += d.vy * dt;
        d.angle += d.av * dt;
        // ground collision/bounce
        const gy = terrain.getHeightAt(d.x);
        if (d.y >= gy - 2) {
          d.y = gy - 2;
          if (Math.abs(d.vy) > 20 || Math.abs(d.vx) > 20) cameraShake = Math.max(cameraShake, 3);
          d.vy = -Math.abs(d.vy) * (0.35 + Math.random() * 0.25);
          d.vx *= 0.78;
          d.av *= 0.8;
          // settle cutoff
          if (Math.abs(d.vy) < 12) d.vy = 0;
          if (Math.abs(d.vx) < 6) d.vx *= 0.95;
        }
        // lifetime
        if (d.life > d.max) {
          debrisPool.release(d);
          debris.splice(i, 1);
        }
      }
      // Limit debris count for performance
      while (debris.length > maxDebris) {
        const d = debris.shift();
        if (d) debrisPool.release(d);
      }

      // Update style particles (360° burst)
      for (let i = styleParticles.length - 1; i >= 0; i--) {
        const p = styleParticles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) {
          styleParticles.splice(i, 1);
        }
      }
      
      // Update near miss texts
      for (let i = nearMissTexts.length - 1; i >= 0; i--) {
        const t = nearMissTexts[i];
        t.life -= dt;
        if (t.life <= 0) {
          nearMissTexts.splice(i, 1);
        }
      }
      
      // Update floating score texts
      for (let i = floatingScoreTexts.length - 1; i >= 0; i--) {
        const text = floatingScoreTexts[i];
        text.life += dt;
        text.y -= 30 * dt; // Float upward at 30 px/s
        
        if (text.life >= text.maxLife) {
          floatingScoreTexts.splice(i, 1);
        }
      }

      // Shooting stars update
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.life > s.max) shooting.splice(i, 1);
      }
      // Background satellites update (screen-space, no collision)
      for (let i = bgSats.length - 1; i >= 0; i--) {
        const s = bgSats[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.rotV * dt;
        if (s.life > s.max) bgSats.splice(i, 1);
      }
      // Explosion visual timers
      flashT = Math.max(0, flashT - dt);
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life += dt;
        if (sw.life > sw.max) shockwaves.splice(i, 1);
      }
      // Bullseye/Speed bonus overlay timer (no longer needed - handled by BonusMessageDisplay)
      if (bullseyeT >= 0) {
        bullseyeT += dt;
        if (bullseyeT > 2.2) bullseyeT = -1;
      }

      // Update light beam sweep for lightbeam levels
      if (lightStormActive.current && !worldPausedRef.current) {
        sweepTimerRef.current += dt;
        
        // Calculate sweep progress (0 to 1)
        const sweepProgress = (sweepTimerRef.current % LIGHT_STORM_SWEEP_SPEED) / LIGHT_STORM_SWEEP_SPEED;
        
        // Calculate beam position (world-space, left to right)
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewWidth = c.width / (zoom * dpr);
        sweepXRef.current = cameraX - viewWidth / 2 + sweepProgress * viewWidth * 2;
        
        // Narrow beam width over time
        const widthProgress = Math.min(1, sweepTimerRef.current / 30);
        currentBeamWidthRef.current = LIGHT_STORM_INITIAL_BEAM_WIDTH - ((LIGHT_STORM_INITIAL_BEAM_WIDTH - LIGHT_STORM_MIN_BEAM_WIDTH) * widthProgress);
        
        sweepActiveRef.current = true;
      }
      
      // ===== LIGHTNING SYSTEM UPDATE (Level 4 Classic Mode) =====
      if (lightningEnabled && !worldPausedRef.current) {
        const canvasWidth = c.width;
        const canvasHeight = c.height;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const maxConcurrent = getGraphicsValue(graphicsLevel, LEVEL4_CONSTANTS.MAX_CONCURRENT_LOW, LEVEL4_CONSTANTS.MAX_CONCURRENT_LOW, LEVEL4_CONSTANTS.MAX_CONCURRENT);
        
        // Update existing bolts
        updateLightningBolts(lightningBolts.current, dt);
        
        // Update afterglows
        for (let i = lightningAfterglows.current.length - 1; i >= 0; i--) {
          const glow = lightningAfterglows.current[i];
          glow.life += dt;
          glow.alpha = (1 - glow.life / glow.maxLife) * 0.3;
          if (glow.life >= glow.maxLife) lightningAfterglows.current.splice(i, 1);
        }
        
        // Update impacts
        for (let i = lightningImpacts.current.length - 1; i >= 0; i--) {
          const impact = lightningImpacts.current[i];
          impact.life += dt;
          if (impact.life >= impact.maxLife) lightningImpacts.current.splice(i, 1);
        }
        
        // Update debris particles
        for (let i = lightningDebris.current.length - 1; i >= 0; i--) {
          const d = lightningDebris.current[i];
          d.life += dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.vy += 400 * dt; // Gravity
          d.angle += d.av * dt;
          
          const terrainHeight = terrain.getHeightAt(d.x);
          if (d.y >= terrainHeight) {
            d.y = terrainHeight;
            d.vy *= -0.4;
            d.vx *= 0.7;
          }
          
          if (d.life >= d.max) {
            debrisPool.release(d);
            lightningDebris.current.splice(i, 1);
          }
        }
        
        // Spawn new lightning bolts
        nextLightningTime.current -= dt;
        if (nextLightningTime.current <= 0) {
          const boltType = selectBoltType();
          const newBolt = generateLightningBolt(canvasWidth / dpr, canvasHeight / dpr, boltType);
          
          // Check terrain collision
          const endSeg = newBolt.segments[newBolt.segments.length - 1];
          const worldX = (endSeg.x - canvasWidth / (2 * dpr)) / zoom + cameraX;
          const worldY = (endSeg.y - canvasHeight / (2 * dpr)) / zoom;
          const terrainHeight = terrain.getHeightAt(worldX);
          
          if (worldY >= terrainHeight) {
            // Impact! Spawn effects
            const impact: LightningImpact = {
              x: worldX,
              y: terrainHeight,
              life: 0,
              maxLife: 0.3,
              radius: 40 + Math.random() * 40
            };
            lightningImpacts.current.push(impact);
            
            // Spawn debris
            const debrisCount = getGraphicsValue(graphicsLevel, 12, 16, 20);
            for (let i = 0; i < debrisCount; i++) {
              const debris = debrisPool.get();
              debris.x = worldX;
              debris.y = terrainHeight;
              const angle = Math.random() * Math.PI * 2;
              const speed = 100 + Math.random() * 200;
              debris.vx = Math.cos(angle) * speed;
              debris.vy = Math.sin(angle) * speed - 150;
              debris.angle = Math.random() * Math.PI * 2;
              debris.av = (Math.random() - 0.5) * 4;
              debris.life = 0;
              debris.max = 1.5;
              debris.size = 2 + Math.random() * 4;
              debris.kind = ['plate', 'rod', 'chip'][Math.floor(Math.random() * 3)] as any;
              lightningDebris.current.push(debris);
            }
            
            // Shockwave on ship if close
            const dist = Math.sqrt((x - worldX) ** 2 + (y - terrainHeight) ** 2);
            if (dist < 200) {
              const shockStrength = (200 - dist) / 200;
              const pushAngle = Math.atan2(y - terrainHeight, x - worldX);
              vx += Math.cos(pushAngle) * shockStrength * 85;
              vy += Math.sin(pushAngle) * shockStrength * 85;
              cameraShake = Math.max(cameraShake, 0.5 + shockStrength * 1.5);
            }
            
            audio.current.playLightningImpactSound(0.8);
          }
          
          lightningBolts.current.push(newBolt);
          screenFlashAlpha.current = 1.0;
          
          // Create afterglow when bolt spawns
          lightningAfterglows.current.push({
            segments: [...newBolt.segments],
            alpha: 0.3,
            life: 0,
            maxLife: 0.5
          });
          
          nextLightningTime.current = LEVEL4_CONSTANTS.INTERVAL_MIN + Math.random() * (LEVEL4_CONSTANTS.INTERVAL_MAX - LEVEL4_CONSTANTS.INTERVAL_MIN);
          
          if (lightningBolts.current.length > maxConcurrent) {
            lightningBolts.current.shift();
          }
        }
        
        // Fade screen flash
        if (screenFlashAlpha.current > 0) {
          screenFlashAlpha.current -= dt * 10;
          if (screenFlashAlpha.current < 0) screenFlashAlpha.current = 0;
        }
      }

      updateHud();
      render();
      if (!running && !crashed) cancelAnimationFrame(rafRef.current);
    };

    const render = () => {
      const w = c.width, h = c.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.save();
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      // Anti-throttling marker: imperceptible pixel that changes each frame
      // Prevents Chromium's frame rate throttling intervention (4-frame detection)
      frameMarkerRef.current = (frameMarkerRef.current + 1) % 1000;
      ctx.save();
      ctx.globalAlpha = 0.003; // Nearly invisible (0.3% opacity)
      ctx.fillStyle = frameMarkerRef.current % 2 === 0 ? '#FFFFFF' : '#FEFEFE';
      ctx.fillRect(w - 1, h - 1, 1, 1); // Single pixel in bottom-right corner
      ctx.restore();

      const shakeX = (Math.random() - 0.5) * cameraShake;
      const shakeY = (Math.random() - 0.5) * cameraShake;

      ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
      ctx.scale(zoom * dpr, zoom * dpr);

      const viewWidth = w / (zoom * dpr);
      const viewH = h / (zoom * dpr);

      // Account for screen shake so FX aligns exactly with world
      const shakeWorldX = shakeX / (zoom * dpr);
      const shakeWorldY = shakeY / (zoom * dpr);

      // Update camera state for FX renderer (compensate for shake)
      // Note: anchor is set later in this frame, so we update it after computation
      setCameraState(prev => ({
        cameraX: cameraX - shakeWorldX,
        cameraY: y - shakeWorldY, // Use player world Y (not anchor)
        viewWidth: viewWidth,
        viewHeight: viewH,
        anchor: prev.anchor, // Will be updated after anchor computation
        zoom: zoom
      }));

      // Compute world anchor with smoothing (frame ground near bottom; keep lander visible)
      let anchor: number;
      if (isCavernLevel) {
        // For caverns, keep lander centered vertically
        anchor = -y;
      } else {
        // Normal terrain camera behavior
        let groundAtCam = terrain.getHeightAt(cameraX);
        const desiredGroundY = viewH * 0.82; // target from top in view units
        const groundAnchor = -groundAtCam + (desiredGroundY - viewH / 2);
        const desiredLanderY = viewH * 0.45; // target from top in view units
        const landerAnchor = -y + (desiredLanderY - viewH / 2);
        const anchorTarget = Math.max(groundAnchor, landerAnchor);
        if (camAnchorInit) { smoothedAnchor = anchorTarget; camAnchorInit = false; }
        const aAlpha = 1 - Math.exp(-Math.max(1 / 120, lastDtForCam || 1 / 60) / 0.35);
        smoothedAnchor += (anchorTarget - smoothedAnchor) * aAlpha;
        anchor = smoothedAnchor;
      }
      
      // Update anchor in camera state for terrain masking
      setCameraState(prev => ({ ...prev, anchor }));

      // Update ship screen position (CSS pixels) for overlay during intro
      if (introRef.current?.isActive()) {
        const wCss = w / dpr;
        const hCss = h / dpr;
        const shipXCss = (wCss / 2) + (x - cameraX) * zoom;
        const shipYCss = (hCss / 2) + (y + anchor) * zoom;
        setShipScreenPos(prev => {
          if (!prev || Math.abs(prev.x - shipXCss) > 0.5 || Math.abs(prev.y - shipYCss) > 0.5) {
            return { x: shipXCss, y: shipYCss };
          }
          return prev;
        });
      }

      // Viewport culling bounds
      const viewWCull = w / (zoom * dpr);
      const viewLeft = cameraX - viewWCull / 2;
      const viewRight = cameraX + viewWCull / 2;
      
      // Underwater background fill
      if (isUnderwater && !isCavernLevel) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#001a33'; // Deep water blue background
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // Background stars: only for non-cavern levels (not underwater)
      if (!isCavernLevel) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Draw stars WITHOUT clipping (they'll be masked by terrain fill) - skip underwater
        if (!isUnderwater) {
          drawStars(ctx, 0, 0, 0);
        }
        
        // Render background decorations (planets, nebulas, etc.) in screen-space
        if (bgDecorationsRef.current.length > 0) {
          const screenWidth = w;
          const screenHeight = h;
          const currentTime = (performance.now() / 1000) - bgDecorationStartTimeRef.current;
          renderDecorations(ctx, bgDecorationsRef.current, bgDecorationImagesRef.current, screenWidth, screenHeight, currentTime);
        }
        
        // Fill terrain shape with black to mask stars and decorations behind it
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        
        // Apply same camera transform used for terrain
        ctx.translate(w / (2 * dpr), h / (2 * dpr));
        ctx.scale(zoom, zoom);
        ctx.translate(-cameraX + shakeX, anchor + shakeY);
        
        // Fill terrain shape with solid black (or deep water blue if underwater)
        ctx.fillStyle = isUnderwater ? '#003366' : '#000000';
        
        // Sample terrain points across viewport width
        const numSamples = 120;
        const viewWidth = w / (zoom * dpr);
        const startX = cameraX - viewWidth / 2;
        const endX = cameraX + viewWidth / 2;
        
        ctx.beginPath();
        // Start from far below terrain (left side)
        ctx.moveTo(startX, 2000);
        
        // Trace along terrain surface
        for (let i = 0; i <= numSamples; i++) {
          const worldX = startX + (i / numSamples) * (endX - startX);
          const worldY = terrain.getHeightAt(worldX);
          if (i === 0) {
            ctx.lineTo(worldX, worldY);
          } else {
            ctx.lineTo(worldX, worldY);
          }
        }
        
        // Close back down (right side)
        ctx.lineTo(endX, 2000);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        ctx.restore();
        
        // ============= LIQUID REFLECTION EFFECT (Level 4 Classic Mode Only) =============
        // DISABLED - keeping code for potential future use
        // Draw AFTER black terrain fill so it appears on top
        if (false && mode === "classic" && level === 4) {
          ctx.save();
          
          // Fixed water line position in world space (prevents vertical bobbing)
          const waterLineWorldY = 380; // Fixed Y coordinate in world space - closer to terrain
          
          // Convert to screen space
          const waterLineScreenY = (h / (2 * dpr)) + (waterLineWorldY + anchor) * zoom;
          
          // Only render if water line is visible on screen
          if (waterLineScreenY < h / dpr && waterLineScreenY > 0) {
            // Set up world transform for reflection
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.translate(w / (2 * dpr), h / (2 * dpr));
            ctx.scale(zoom, zoom);
            ctx.translate(-cameraX, anchor);
            
            // Create clipping region for reflection (only below water line in world coords)
            ctx.save();
            ctx.beginPath();
            ctx.rect(cameraX - viewWCull, waterLineWorldY, viewWCull * 2, 500);
            ctx.clip();
            
            // Set up vertical flip transformation
            ctx.scale(1, -1);
            ctx.translate(0, -waterLineWorldY * 2);
            
            // Apply transparency for liquid effect
            const reflectionOpacity = shouldOptimizePerformance ? 0.3 : 0.4;
            ctx.globalAlpha = reflectionOpacity;
            
            // Add ripple distortion for moving water effect
            if (!shouldOptimizePerformance) {
              const rippleAmount = 8;
              ctx.translate(Math.sin(elapsed * 1.2) * rippleAmount, 0);
            }
            
            // ===== Re-render Terrain =====
            ctx.strokeStyle = neonColor;
            ctx.shadowColor = neonColor;
            ctx.shadowBlur = shouldOptimizePerformance ? 2 : 6;
            ctx.lineWidth = 2;
            
            const drawTerrainReflection = (offset: number) => {
              if (offset + terrain.worldWidth < viewLeft || offset > viewRight) return;
              ctx.beginPath();
              for (let i = 0; i < terrain.points.length; i++) {
                const p = terrain.points[i];
                if (i === 0) ctx.moveTo(p.x + offset, p.y);
                else ctx.lineTo(p.x + offset, p.y);
              }
              ctx.lineTo(terrain.points[0].x + offset + terrain.worldWidth, terrain.points[0].y);
              ctx.stroke();
            };
            
            const wrapRefl = Math.floor(cameraX / terrain.worldWidth);
            for (let wr = -1; wr <= 1; wr++) drawTerrainReflection((wrapRefl + wr) * terrain.worldWidth);
            
            // ===== Re-render Landing Pads =====
            for (const pad of terrain.pads) {
              const padWidth = (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
              const offsets = [];
              const padLeft = pad.xStart;
              const padRight = pad.xEnd >= pad.xStart ? pad.xEnd : pad.xEnd + terrain.worldWidth;
              
              if (padRight - padLeft > terrain.worldWidth * 0.8) {
                if (cameraX < terrain.worldWidth * 0.4) offsets.push(0);
                else offsets.push(-terrain.worldWidth);
              } else {
                offsets.push(0);
                if (padLeft - viewLeft < -terrain.worldWidth * 0.3) offsets.push(terrain.worldWidth);
                if (viewRight - padRight < -terrain.worldWidth * 0.3) offsets.push(-terrain.worldWidth);
              }
              
              for (const offset of offsets) {
                const px = pad.xStart + offset;
                const py = pad.y;
                
                ctx.strokeStyle = neonColor;
                ctx.shadowColor = neonColor;
                ctx.shadowBlur = shouldOptimizePerformance ? 3 : 8;
                ctx.lineWidth = 2;
                
                const padEndX = pad.xEnd >= pad.xStart ? pad.xEnd : pad.xEnd + terrain.worldWidth;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + (padEndX - pad.xStart), py);
                ctx.stroke();
              }
            }
            
            // ===== Re-render Ship =====
            ctx.shadowBlur = shouldOptimizePerformance ? 3 : 8;
            ctx.strokeStyle = neonColor;
            ctx.shadowColor = neonColor;
            ctx.lineWidth = 2;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            
            // Draw ship triangle
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(-6, 6);
            ctx.lineTo(6, 6);
            ctx.closePath();
            ctx.stroke();
            
            ctx.restore();
            
            // Add dark gradient overlay at bottom of reflection for depth effect
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 1;
            const gradient = ctx.createLinearGradient(0, waterLineWorldY, 0, waterLineWorldY + 300);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(0.4, 'rgba(0,0,0,0.4)');
            gradient.addColorStop(1, 'rgba(0,0,0,1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(cameraX - viewWCull, waterLineWorldY, viewWCull * 2, 300);
            ctx.restore();
          }
          
          ctx.restore();
        }
        // ============= END LIQUID REFLECTION EFFECT =============
      }

      // World transform for terrain and gameplay
      ctx.translate(-cameraX, anchor);

      // Draw core composition (mineral formations) behind terrain
      if (isCavernLevel) {
        coreComposition.render(ctx, { x: cameraX, y: y, zoom: zoom });
      }
      
      // Optimized neon settings with performance-based shadow blur
      ctx.strokeStyle = neonColor as any;
      ctx.shadowColor = neonColor as any;
      ctx.lineWidth = 2;
      const shadowBlur = shouldOptimizePerformance ? 3 : 8; // Significantly reduced shadow blur
      ctx.shadowBlur = shadowBlur;

      // Special rendering for light beam levels
      // iPad mid/low optimization: skip off-screen canvas entirely and draw terrain directly with clipping
      if (lightStormActive.current && sweepActiveRef.current && !isCavernLevel) {
        if (shouldOptimizeLightBeam) {
          // SIMPLIFIED iPad mid/low path: Draw terrain directly within beam clip - no off-screen canvas
          // This avoids expensive drawImage, off-screen rendering, and multiple composite operations
          
          const beamWidth = currentBeamWidthRef.current;
          const beamCenterX = sweepXRef.current;
          
          // Convert beam position from screen to world coordinates for clipping
          const screenCenterX = w / (2 * dpr);
          const beamWorldX = cameraX - shakeX + (beamCenterX - screenCenterX) / zoom;
          const beamWorldWidth = beamWidth / zoom;
          
          // Just draw terrain normally - it will be clipped later in the composite section
          // For now, skip the off-screen rendering entirely
          
        } else if (offscreenTerrainCtxRef.current && offscreenTerrainCanvasRef.current) {
          // Full quality PC/iPhone/high-gfx path: Use off-screen canvas for bloom effects
          const offCtx = offscreenTerrainCtxRef.current;
          const offCanvas = offscreenTerrainCanvasRef.current;
          
          // Clear off-screen canvas
          offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
          
          // Apply same camera transform as main canvas
          offCtx.setTransform(1, 0, 0, 1, 0, 0);
          offCtx.scale(dpr, dpr);
          offCtx.translate(w / (2 * dpr), h / (2 * dpr));
          offCtx.scale(zoom, zoom);
          offCtx.translate(-cameraX + shakeX, anchor);
          
          // Render terrain at FULL BRIGHTNESS to off-screen canvas
          offCtx.globalAlpha = 1.0;
          offCtx.strokeStyle = neonColor;
          offCtx.shadowColor = neonColor;
          offCtx.shadowBlur = shadowBlur * 1.5;
          offCtx.lineWidth = 2;
          
          // Draw terrain to off-screen canvas
          const drawTerrainOffscreen = (offset: number) => {
            if (offset + terrain.worldWidth < viewLeft || offset > viewRight) return;
            
            offCtx.beginPath();
            for (let i = 0; i < terrain.points.length; i++) {
              const p = terrain.points[i];
              if (i === 0) offCtx.moveTo(p.x + offset, p.y);
              else offCtx.lineTo(p.x + offset, p.y);
            }
            offCtx.lineTo(terrain.points[0].x + offset + terrain.worldWidth, terrain.points[0].y);
            offCtx.stroke();
          };
          
          const wrap = Math.floor(cameraX / terrain.worldWidth);
          for (let w = -1; w <= 1; w++) drawTerrainOffscreen((wrap + w) * terrain.worldWidth);
          
          // Draw pads to off-screen canvas
          for (const pad of terrain.pads) {
            const w = (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
            offCtx.fillStyle = pad.bonus2x ? `rgba(255,100,255,0.8)` : `rgba(100,255,255,0.8)`;
            offCtx.fillRect(pad.xStart, pad.y, w, 2);
            offCtx.strokeStyle = neonColor;
            offCtx.strokeRect(pad.xStart, pad.y, w, 2);
          }
          
          offCtx.globalAlpha = 1;
          offCtx.setTransform(1, 0, 0, 1, 0, 0);
        }
        
        // Main canvas stays completely black - no terrain visible (handled in composite section)
        
      } else if (blackoutActive.current && !isCavernLevel && offscreenTerrainCtxRef.current && offscreenTerrainCanvasRef.current) {
        const offCtx = offscreenTerrainCtxRef.current;
        const offCanvas = offscreenTerrainCanvasRef.current;
        
        // Clear off-screen canvas
        offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
        
        // Apply same camera transform as main canvas
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.scale(dpr, dpr);
        offCtx.translate(w / (2 * dpr), h / (2 * dpr));
        offCtx.scale(zoom, zoom);
        offCtx.translate(-cameraX + shakeX, anchor);
        
        // Render terrain at FULL BRIGHTNESS to off-screen canvas
        offCtx.globalAlpha = 1.0;
        offCtx.strokeStyle = neonColor;
        offCtx.shadowColor = neonColor;
        // iPad optimization: disable shadow blur on offscreen canvas for mid/low
        offCtx.shadowBlur = shouldOptimizeLightBeam ? 0 : shadowBlur * 1.5;
        offCtx.lineWidth = 2;
        
        // Draw terrain to off-screen canvas
        const drawTerrainOffscreen = (offset: number) => {
          if (offset + terrain.worldWidth < viewLeft || offset > viewRight) return;
          
          offCtx.beginPath();
          for (let i = 0; i < terrain.points.length; i++) {
            const p = terrain.points[i];
            if (i === 0) offCtx.moveTo(p.x + offset, p.y);
            else offCtx.lineTo(p.x + offset, p.y);
          }
          offCtx.lineTo(terrain.points[0].x + offset + terrain.worldWidth, terrain.points[0].y);
          offCtx.stroke();
        };
        
        const wrap = Math.floor(cameraX / terrain.worldWidth);
        for (let w = -1; w <= 1; w++) drawTerrainOffscreen((wrap + w) * terrain.worldWidth);
        
        // Draw pads to off-screen canvas
        for (const pad of terrain.pads) {
          const w = (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
          offCtx.fillStyle = pad.bonus2x ? `rgba(255,100,255,0.8)` : `rgba(100,255,255,0.8)`;
          offCtx.fillRect(pad.xStart, pad.y, w, 2);
          offCtx.strokeStyle = neonColor;
          offCtx.strokeRect(pad.xStart, pad.y, w, 2);
        }
        
        offCtx.globalAlpha = 1;
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Draw very faint terrain outline on main canvas (alpha 0.05)
        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        
        const drawTerrainFaint = (offset: number) => {
          if (offset + terrain.worldWidth < viewLeft || offset > viewRight) return;
          
          ctx.beginPath();
          for (let i = 0; i < terrain.points.length; i++) {
            const p = terrain.points[i];
            if (i === 0) ctx.moveTo(p.x + offset, p.y);
            else ctx.lineTo(p.x + offset, p.y);
          }
          ctx.stroke();
        };
        
        const wrapFaint = Math.floor(cameraX / terrain.worldWidth);
        for (let w = -1; w <= 1; w++) drawTerrainFaint((wrapFaint + w) * terrain.worldWidth);
        
        ctx.globalAlpha = 1;
        
      } else if (isCavernLevel) {
        // Render cavern walls
        const cavernData = terrain as CavernData;
        ctx.save();
        
        // Render each wall
        for (const wall of cavernData.walls) {
          ctx.beginPath();
          for (let i = 0; i < wall.points.length; i++) {
            const p = wall.points[i];
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        
        // Render obstacles
        for (const obstacle of cavernData.obstacles) {
          ctx.beginPath();
          ctx.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          ctx.stroke();
        }
        
        ctx.restore();
      } else {
        // Regular terrain rendering with viewport culling
        const drawTerrain = (offset: number) => {
          // Cull terrain sections outside viewport
          if (offset + terrain.worldWidth < viewLeft || offset > viewRight) return;
          
          ctx.beginPath();
          for (let i = 0; i < terrain.points.length; i++) {
            const p = terrain.points[i];
            if (i === 0) ctx.moveTo(p.x + offset, p.y);
            else ctx.lineTo(p.x + offset, p.y);
          }
          // Ensure the last segment connects to the first for perfect seam
          ctx.lineTo(terrain.points[0].x + offset + terrain.worldWidth, terrain.points[0].y);
          ctx.stroke();
        };
        drawTerrain(-terrain.worldWidth);
        drawTerrain(0);
        drawTerrain(terrain.worldWidth);
      }

      // Render coral (Level 5 underwater only)
      if (isUnderwater && !isCavernLevel && 'coral' in terrain && terrain.coral) {
        ctx.save();
        
        for (const c of terrain.coral) {
          // Viewport culling
          if (c.x < viewLeft - 100 || c.x > viewRight + 100) continue;
          
          // Animate sway with elapsed time
          const sway = Math.sin(elapsed * 1.5 + c.swayPhase) * 3; // ±3px horizontal sway
          
          const baseX = c.x + sway;
          const baseY = c.y;
          
          // Set coral color and glow
          ctx.strokeStyle = c.color;
          ctx.fillStyle = c.color;
          ctx.lineWidth = shouldOptimizePerformance ? 2 : 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          // Render based on coral type
          switch (c.type) {
            case 'branch': {
              // Branching coral with multiple stems
              const segments = c.segments || 5;
              ctx.shadowColor = c.color;
              ctx.shadowBlur = shouldOptimizePerformance ? 8 : 16;
              
              for (let i = 0; i < segments; i++) {
                const angle = -Math.PI / 2 + (i / segments - 0.5) * 0.8; // Spread branches
                const branchHeight = c.height * (0.6 + Math.random() * 0.4);
                const endX = baseX + Math.cos(angle) * c.width * 0.4;
                const endY = baseY - branchHeight;
                
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.quadraticCurveTo(
                  baseX + Math.cos(angle) * c.width * 0.2,
                  baseY - branchHeight * 0.5,
                  endX,
                  endY
                );
                ctx.stroke();
              }
              break;
            }
            
            case 'frond': {
              // Wavy frond-like structure
              ctx.shadowColor = c.color;
              ctx.shadowBlur = shouldOptimizePerformance ? 8 : 16;
              ctx.beginPath();
              ctx.moveTo(baseX, baseY);
              
              const steps = 8;
              for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const wave = Math.sin(t * Math.PI * 4) * (c.width * 0.3);
                const x = baseX + wave;
                const y = baseY - t * c.height;
                ctx.lineTo(x, y);
              }
              ctx.stroke();
              break;
            }
            
            case 'fan': {
              // Fan-shaped coral
              ctx.shadowColor = c.color;
              ctx.shadowBlur = shouldOptimizePerformance ? 10 : 20;
              ctx.globalAlpha = 0.4;
              ctx.beginPath();
              ctx.moveTo(baseX, baseY);
              ctx.lineTo(baseX - c.width / 2, baseY - c.height);
              ctx.lineTo(baseX + c.width / 2, baseY - c.height);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.stroke();
              break;
            }
            
            case 'tube': {
              // Tube clusters
              const tubes = c.segments || 4;
              ctx.shadowColor = c.color;
              ctx.shadowBlur = shouldOptimizePerformance ? 8 : 16;
              
              for (let i = 0; i < tubes; i++) {
                const offset = (i - tubes / 2) * (c.width / tubes);
                const tubeHeight = c.height * (0.7 + Math.random() * 0.3);
                
                ctx.beginPath();
                ctx.moveTo(baseX + offset, baseY);
                ctx.lineTo(baseX + offset, baseY - tubeHeight);
                ctx.stroke();
                
                // Cap on top
                ctx.beginPath();
                ctx.arc(baseX + offset, baseY - tubeHeight, 3, 0, Math.PI * 2);
                ctx.fill();
              }
              break;
            }
            
            case 'anemone': {
              // Anemone-like tentacles
              const tentacles = c.segments || 6;
              ctx.shadowColor = c.color;
              ctx.shadowBlur = shouldOptimizePerformance ? 8 : 16;
              
              for (let i = 0; i < tentacles; i++) {
                const angle = (i / tentacles) * Math.PI * 2 - Math.PI / 2;
                const tentacleLength = c.height * (0.5 + Math.random() * 0.5);
                const curve = Math.sin(elapsed * 2 + i) * 8; // Waving motion
                
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.quadraticCurveTo(
                  baseX + Math.cos(angle) * c.width * 0.3 + curve,
                  baseY - tentacleLength * 0.5,
                  baseX + Math.cos(angle) * c.width * 0.5,
                  baseY - tentacleLength
                );
                ctx.stroke();
              }
              break;
            }
          }
        }
        
        ctx.restore();
      }

      // Render jellyfish (Level 5 underwater only)
      if (isUnderwater && !isCavernLevel && 'jellyfish' in terrain && terrain.jellyfish) {
        ctx.save();
        
        for (const jf of terrain.jellyfish) {
          // Viewport culling
          if (jf.x < viewLeft - 100 || jf.x > viewRight + 100) continue;
          
          const bellRadius = jf.size * 0.6;
          const tentacleLength = jf.size * 1.2;
          
          // Jellyfish color - shifts from cyan to neon pink-orange when charging
          let baseColor = '#00ddff';
          let glowColor = '#00ffff';
          
          if (jf.isTelegraphing) {
            // Calculate charge progress (0 to 1)
            const chargeProgress = Math.min(1, (1.5 - jf.telegraphTimer) / 1.5);
            
            // Interpolate from cyan (#00ddff) to neon pink-orange (#ff6400)
            const r = Math.floor(0 + (255 - 0) * chargeProgress);
            const g = Math.floor(221 - (221 - 100) * chargeProgress);
            const b = Math.floor(255 - (255 - 0) * chargeProgress);
            baseColor = `rgb(${r}, ${g}, ${b})`;
            glowColor = baseColor;
            
            // Pulsing intensity
            const pulseIntensity = 0.5 + Math.sin(elapsed * 20) * 0.5;
            jf.glowIntensity = Math.max(jf.glowIntensity, pulseIntensity);
          }
          
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = shouldOptimizePerformance ? 10 : (20 * jf.glowIntensity);
          
          // Draw bell
          ctx.strokeStyle = baseColor;
          ctx.fillStyle = baseColor;
          ctx.globalAlpha = 0.4 + (jf.glowIntensity * 0.2);
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          ctx.arc(jf.x, jf.y, bellRadius, Math.PI, Math.PI * 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Draw tentacles
          ctx.globalAlpha = 0.6;
          const tentacleCount = 6;
          
          for (let i = 0; i < tentacleCount; i++) {
            const angle = Math.PI + (i / tentacleCount) * Math.PI;
            const baseX = jf.x + Math.cos(angle) * bellRadius;
            const baseY = jf.y;
            
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            
            const segments = 4;
            for (let s = 1; s <= segments; s++) {
              const t = s / segments;
              const wave = Math.sin(jf.tentaclePhase + i * 0.5 + s) * (jf.size * 0.2);
              ctx.lineTo(baseX + wave, baseY + t * tentacleLength);
            }
            ctx.stroke();
          }
          
          // Draw electric burst shockwave
          if (jf.isBursting) {
            const radius = 75 * jf.burstProgress;
            ctx.globalAlpha = 0.6 * (1 - jf.burstProgress);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = shouldOptimizePerformance ? 15 : 30;
            
            ctx.beginPath();
            ctx.arc(jf.x, jf.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Electric arcs
            const arcCount = 8;
            for (let i = 0; i < arcCount; i++) {
              const angle = (i / arcCount) * Math.PI * 2 + (jf.burstProgress * 2);
              const x1 = jf.x + Math.cos(angle) * (radius * 0.5);
              const y1 = jf.y + Math.sin(angle) * (radius * 0.5);
              const x2 = jf.x + Math.cos(angle) * radius;
              const y2 = jf.y + Math.sin(angle) * radius;
              
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }
          
          // Telegraph warning removed - color shift handles the visual cue
        }
        
        ctx.restore();
      }

      // Pads
      if (isCavernLevel) {
        const cavernData = terrain as CavernData;
        const padsToDraw = [cavernData.startPad, cavernData.endPad];
        for (const pad of padsToDraw) {
          const pulse = 1 + 0.6 * Math.sin(elapsed * 4 + pad.xStart * 0.01);
          // Draw a single instance (no world wrapping in caverns)
          if (pad.xEnd < viewLeft || pad.xStart > viewRight) continue;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pad.xStart, pad.y);
          ctx.lineTo(pad.xEnd, pad.y);
          if (shouldOptimizePerformance) {
            ctx.strokeStyle = neonColor as any;
            ctx.globalAlpha = 0.9;
            ctx.lineWidth = 4 * pulse;
            ctx.shadowBlur = SHADOW_BLUR_MOBILE;
            ctx.stroke();
          } else {
            ctx.strokeStyle = neonColor as any;
            ctx.globalAlpha = 0.6;
            ctx.lineWidth = 6 * pulse;
            ctx.shadowBlur = 36;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 3 * pulse;
            ctx.shadowBlur = 24;
            ctx.stroke();
          }
          ctx.restore();
        }
      } else {
        // Pads (mobile-optimized rendering)
        const collectionLevel = isCollectionLevel(mode, level);
        const padsVisible = !collectionLevel || (collectiblesRef.current?.setComplete ?? false);
        
        if (padsVisible) {
          for (const pad of terrain.pads) {
          const pulse = 1 + 0.6 * Math.sin(elapsed * 4 + pad.xStart * 0.01);
          const width = pad.width ?? (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
          const center = (pad.xEnd >= pad.xStart)
            ? (pad.xStart + pad.xEnd) / 2
            : ((pad.xStart + (pad.xEnd + terrain.worldWidth)) / 2) % terrain.worldWidth;
          for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
            // Viewport culling for pads
            const padLeft = Math.min(pad.xStart, pad.xEnd) + offset;
            const padRight = Math.max(pad.xStart, pad.xEnd) + offset;
            if (padRight < viewLeft || padLeft > viewRight) continue;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pad.xStart + offset, pad.y);
            ctx.lineTo(pad.xEnd + offset, pad.y);
            if (shouldOptimizePerformance) {
              // Simplified mobile rendering
              ctx.strokeStyle = neonColor as any;
              ctx.globalAlpha = 0.8;
              ctx.lineWidth = 4 * pulse;
              ctx.shadowBlur = SHADOW_BLUR_MOBILE;
              ctx.stroke();
            } else {
              // Full quality desktop rendering
              // Outer glow
              ctx.strokeStyle = neonColor as any;
              ctx.globalAlpha = 0.6;
              ctx.lineWidth = 6 * pulse;
              ctx.shadowBlur = 36;
              ctx.stroke();
              // Core line
              ctx.globalAlpha = 1;
              ctx.lineWidth = 3 * pulse;
              ctx.shadowBlur = 24;
              ctx.stroke();
            }
            // Bonus label or Time Trial sequence number
            if (isTimeTrial && !isCavernLevel) {
              // Draw sequence number for Time Trial pads
              const ttState = timeTrialStateRef.current;
              const sequencedPad = ttState.sequencedPads.find(p => 
                p.xStart === pad.xStart && p.y === pad.y
              );
              
              if (sequencedPad) {
                const isTarget = sequencedPad.sequenceNumber === ttState.currentTarget;
                const isCompleted = sequencedPad.completed;
                
                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.font = `bold ${isTarget ? 24 : 18}px "Orbitron", monospace`;
                
                // Color based on status
                const numberColor = isCompleted 
                  ? "#00FF00"  // Green for completed
                  : isTarget 
                    ? "#FFFF00"  // Yellow for current target
                    : "#888888"; // Gray for future pads
                
                ctx.fillStyle = numberColor;
                ctx.shadowColor = numberColor;
                ctx.shadowBlur = isTarget ? 20 : 10;
                ctx.globalAlpha = isTarget ? 1 : 0.7;
                
                // Draw number above pad
                const numberY = pad.y - (isTarget ? 25 : 20);
                ctx.fillText(sequencedPad.sequenceNumber.toString(), center + offset, numberY);
                
                ctx.restore();
              }
            } else if (pad.bonus2x) {
              ctx.save();
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.font = `700 12px \"Orbitron\", sans-serif`;
              ctx.shadowColor = neonColor as any;
              ctx.shadowBlur = 18;
              ctx.strokeStyle = neonColor as any;
              ctx.lineWidth = 2;
              ctx.globalAlpha = 0.95;
              ctx.strokeText("2x", center + offset, pad.y + 8);
              ctx.globalAlpha = 1;
              ctx.restore();
            }
            ctx.restore();
          }
        }
        }
      }

      // Moving pads
      const terrainData = terrain as TerrainData;
      if (terrainData.movingPads) {
        for (const movingPad of terrainData.movingPads) {
          movingPadSystem.renderMovingPad(
            ctx,
            movingPad,
            cameraX,
            anchor,
            zoom,
            viewWCull,
            h / (zoom * dpr),
            neonColor
          );
        }
      }

      // Wind vectors and anomaly hints
      if (WIND_ENABLED) drawWindVectors(ctx, windZones, terrain.worldWidth, elapsed, neonColor);
      drawAnomaliesField(ctx, anomalies, elapsed, neonColor);
      // Moving hazards with viewport culling (generous margin for smooth scroll-in)
      const visibleHazards = hazards.filter(h => {
        const dx = Math.abs(h.x - cameraX);
        const wrappedDx = Math.min(dx, terrain.worldWidth - dx);
        return wrappedDx < viewWCull / 2 + 400;
      });
      drawHazards(ctx, visibleHazards, neonColor, shouldOptimizePerformance ? 4 : 8);
      
      // UFO rendering
      if (ufoLevelConfigRef.current) {
        const state = ufoSpawnStateRef.current;
        const activeUFOs = [state.activeSmall, state.activeMedium, state.activeLarge].filter(u => u?.active) as LanderUFO[];
        
        drawAllUFOs(
          ctx,
          activeUFOs,
          allProjectilesRef.current,
          neonColor,
          shouldOptimizePerformance ? 4 : 8,
          terrain.worldWidth
        );
      }
      
      // Volcanoes and their particles
      if (isCavernLevel) {
        const cavernData = terrain as CavernData;
        if (cavernData.volcanoes && cavernData.volcanoes.length > 0) {
          drawVolcanoes(ctx, cavernData.volcanoes, volcanoParticles, neonColor, viewLeft, viewRight);
        }
      } else {
        const terrainData = terrain as TerrainData;
        if (terrainData.volcanoes && terrainData.volcanoes.length > 0) {
          drawVolcanoes(ctx, terrainData.volcanoes, volcanoParticles, neonColor, viewLeft, viewRight);
        }
      }
      
      // Collectibles (space junk and wormhole door)
      if (collectiblesRef.current) {
        // Update sparkles
        collectiblesRef.current.spaceJunk.forEach(junk => {
          const sparkles = sparklesRef.current.get(junk.id);
          if (sparkles) {
            updateSparkles(sparkles, elapsed);
          }
        });
        
        // Render space junk
        collectiblesRef.current.spaceJunk.forEach(junk => {
          if (junk.collected) return;
          
          // Check if visible in viewport
          const junkLeft = junk.pos.x - 50;
          const junkRight = junk.pos.x + 50;
          if (junkRight < viewLeft || junkLeft > viewRight) return;
          
          const asset = SPACE_JUNK_ASSETS[junk.shape];
          const rotation = (elapsed * junk.spinDegPerSec * Math.PI) / 180;
          const scale = 1.0 + 0.1 * Math.sin(elapsed * 2 + junk.seed * 0.001);
          const sparkles = sparklesRef.current.get(junk.id);
          
          ctx.save();
          ctx.globalAlpha = 0.9;
          renderSpaceJunk(ctx, junk.shape, junk.pos.x, junk.pos.y, rotation, scale, junk.tint, sparkles, elapsed, junk.seed * 0.001);
          ctx.restore();
        });
        
        // Render wormhole door
        if (collectiblesRef.current.wormholeDoor) {
          const wormhole = collectiblesRef.current.wormholeDoor;
          const whLeft = wormhole.pos.x - wormhole.radius;
          const whRight = wormhole.pos.x + wormhole.radius;
          
          if (whRight >= viewLeft && whLeft <= viewRight) {
            ctx.save();
            ctx.globalAlpha = wormhole.open ? 1.0 : 0.3;
            renderWormholeDoor(ctx, wormhole.pos.x, wormhole.pos.y, elapsed, wormhole.open, 1.0);
            ctx.restore();
          }
        }
      }

      // ===== LIGHTNING RENDERING (Level 4 Classic Mode) =====
      if (lightningEnabled) {
        // Render impacts (world space - keep current transform)
        for (const impact of lightningImpacts.current) {
          ctx.save();
          renderLightningImpact(ctx, impact, cameraX, zoom, 0, h / dpr, dpr);
          ctx.restore();
        }
      }
      
      // Ghost ships (render before player) - render BOTH local and global ghosts
      // Local ghost (green)
      if (localGhostShip && localGhostShip.visible) {
        for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
          ctx.save();
          ctx.translate(localGhostShip.x + offset, localGhostShip.y);
          ctx.rotate(localGhostShip.angle);
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(8, 10);
          ctx.lineTo(-8, 10);
          ctx.closePath();
          ctx.strokeStyle = '#00ff80'; // Green for local
          ctx.lineWidth = 2;
          ctx.stroke();
          // Ghost legs
          ctx.beginPath();
          ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);
          ctx.moveTo(6, 8); ctx.lineTo(12, 12);
          ctx.stroke();
          ctx.restore();
        }
      }
      
      // Global ghost (gold)
      if (globalGhostShip && globalGhostShip.visible) {
        for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
          ctx.save();
          ctx.translate(globalGhostShip.x + offset, globalGhostShip.y);
          ctx.rotate(globalGhostShip.angle);
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(8, 10);
          ctx.lineTo(-8, 10);
          ctx.closePath();
          ctx.strokeStyle = '#FFD700'; // Gold for global
          ctx.lineWidth = 2;
          ctx.stroke();
          // Ghost legs
          ctx.beginPath();
          ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);
          ctx.moveTo(6, 8); ctx.lineTo(12, 12);
          ctx.stroke();
          ctx.restore();
        }
      }
      
      // Time Trial ghost rendering - render BOTH local and global ghosts
      if (mode === "timetrial" && timeTrialStateRef.current.raceActive) {
        const raceTime = performance.now() - timeTrialStateRef.current.raceStartTime;
        
        // Render LOCAL ghost (green) if available
        if (timeTrialLocalGhost.current) {
          const localGhostState = ghostManager.current.getTimeTrialGhostState(difficulty, level, raceTime);
          
          if (localGhostState && localGhostState.visible) {
            for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
              ctx.save();
              ctx.translate(localGhostState.x + offset, localGhostState.y);
              ctx.rotate(localGhostState.angle);
              ctx.globalAlpha = 0.4;
              ctx.beginPath();
              ctx.moveTo(0, -10);
              ctx.lineTo(8, 10);
              ctx.lineTo(-8, 10);
              ctx.closePath();
              ctx.strokeStyle = '#00ff80'; // Green for local ghost
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);
              ctx.moveTo(6, 8); ctx.lineTo(12, 12);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
        
        // Render GLOBAL ghost (yellow/gold) if available
        if (timeTrialLoadedGhost.current) {
          const globalGhostState = ghostManager.current.getGlobalGhostState(timeTrialLoadedGhost.current, raceTime);
          
          if (globalGhostState && globalGhostState.visible) {
            for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
              ctx.save();
              ctx.translate(globalGhostState.x + offset, globalGhostState.y);
              ctx.rotate(globalGhostState.angle);
              ctx.globalAlpha = 0.4;
              ctx.beginPath();
              ctx.moveTo(0, -10);
              ctx.lineTo(8, 10);
              ctx.lineTo(-8, 10);
              ctx.closePath();
              ctx.strokeStyle = '#FFD700'; // Gold for global ghost
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);
              ctx.moveTo(6, 8); ctx.lineTo(12, 12);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }

      // Helper function to interpolate between two hex colors
      const lerpColor = (color1: string, color2: string, t: number): string => {
        const r1 = parseInt(color1.slice(1, 3), 16);
        const g1 = parseInt(color1.slice(3, 5), 16);
        const b1 = parseInt(color1.slice(5, 7), 16);
        
        const r2 = parseInt(color2.slice(1, 3), 16);
        const g2 = parseInt(color2.slice(3, 5), 16);
        const b2 = parseInt(color2.slice(5, 7), 16);
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      };

      // ===== LIGHTNING RENDERING (Level 4) =====
      if (lightningEnabled) {
        ctx.save(); // Isolate lightning rendering state
        
        // 1. Render impacts (behind lightning)
        for (const impact of lightningImpacts.current) {
          renderLightningImpact(ctx, impact, cameraX, zoom, anchor, h / dpr, dpr);
        }
        
        // 2. Render debris particles (world space) - convert to screen coordinates
        ctx.save();
        ctx.strokeStyle = neonColor;
        ctx.fillStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = shadowBlur;
        ctx.lineWidth = 1.5;
        
        for (const d of lightningDebris.current) {
          const fadeProgress = d.life / d.max;
          const alpha = 1 - fadeProgress;
          
          for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
            ctx.save();
            ctx.translate(d.x + offset, d.y); // World-space, just like lander
            ctx.rotate(d.angle);
            ctx.globalAlpha = alpha;
            
            // Draw different debris shapes
            ctx.beginPath();
            if (d.kind === 'plate') {
              // Rectangle
              ctx.rect(-d.size / 2, -d.size / 2, d.size, d.size);
            } else if (d.kind === 'rod') {
              // Line
              ctx.moveTo(-d.size, 0);
              ctx.lineTo(d.size, 0);
            } else {
              // Triangle
              ctx.moveTo(0, -d.size);
              ctx.lineTo(d.size, d.size);
              ctx.lineTo(-d.size, d.size);
              ctx.closePath();
            }
            ctx.stroke();
            ctx.restore();
          }
        }
        ctx.restore();
        
        // 3. Render afterglows
        for (const glow of lightningAfterglows.current) {
          renderLightningAfterglow(ctx, glow, dpr, graphicsLevel === "low");
        }
        
        // 4. Render active lightning bolts
        renderLightningBolts(ctx, lightningBolts.current, dpr, graphicsLevel === "low");
        
        // 5. Render ozone glow
        renderOzoneGlow(ctx, lightningBolts.current.length, w / dpr, h / dpr, dpr);
        
        ctx.restore(); // Restore canvas state after lightning
      }

      // Low fuel warning - smooth color fade and pulsing glow (classic/fixed/timetrial only)
      let shipColor = neonColor;
      let shipShadowBlur = shadowBlur;
      
      if (mode === "classic" || mode === "fixed" || mode === "timetrial") {
        const fuelPercent = fuel / fuelCap;
        
        if (fuelPercent <= 0.5) { // Below 50% fuel - start warning
          if (fuelPercent < 0.08) {
            // Below 8% - Solid red with pulsing glow when critically low
            shipColor = "#ff0000";
            // Pulsing glow effect (20-40px) at 5Hz for urgency
            const glowPulse = (Math.sin(elapsed * 5 * Math.PI * 2) + 1) / 2; // 0 to 1
            shipShadowBlur = 20 + glowPulse * 20; // 20-40px pulsing
          } else {
            // 8-50% - Clear pulsing between neon and red
            // Frequency increases as fuel decreases (slowly at first, quicker near empty)
            const fuelRatio = (fuelPercent - 0.08) / 0.42; // 0 to 1 (8% to 50%)
            const pulseFreq = 2 + (1 - fuelRatio) * 6; // 2Hz to 8Hz (slow→fast)
            const pulse = (Math.sin(elapsed * pulseFreq * Math.PI * 2) + 1) / 2; // 0 to 1
            
            // Red influence increases as fuel decreases
            const redInfluence = 0.3 + (1 - fuelRatio) * 0.7; // 30% to 100% red
            
            // Binary switch between neon and red - no blending
            shipColor = pulse > (1 - redInfluence) ? "#ff0000" : neonColor;
          }
        }
      }

      // Lander
      if (!crashed) {
        // Save original shadow settings
        const originalShadowColor = ctx.shadowColor;
        const originalShadowBlur = ctx.shadowBlur;
        
        // Update shadow to match ship color
        ctx.shadowColor = shipColor as any;
        ctx.shadowBlur = shipShadowBlur;
        
        // Ship flashing during shield invulnerability (8Hz flash rate matching SurvivalEngine)
        let shipAlpha = 1;
        if (shieldInvulnerableRef.current) {
          const flashFreq = 8; // flashes per second
          const flashPhase = (elapsed * flashFreq) % 1;
          if (flashPhase < 0.5) {
            shipAlpha = 0.3; // dim the ship
          }
        }
        
        for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
          ctx.save();
          ctx.globalAlpha = shipAlpha;
          ctx.translate(x + offset, y);
          ctx.rotate(angle);
          
          // Draw liquid fuel fill if enabled (before ship outline)
          if (liquidFuelEnabledRef.current && fuel > 0.5) {
            visualFuelRef.current += (fuel - visualFuelRef.current) * 0.15;
            const fuelPercent = visualFuelRef.current / fuelCap;
            const smoothFuelPercent = prevFuelPercentRef.current + 
              (fuelPercent - prevFuelPercentRef.current) * 0.2;
            prevFuelPercentRef.current = smoothFuelPercent;
            
            // Determine fill color based on fuel level
            // Extract hue from neonColor for consistent color construction
            const hueMatch = neonColor.match(/hsl\((\d+)/);
            const neonHue = hueMatch ? parseInt(hueMatch[1]) : 180;
            
            let fillColor: string;
            let baseAlpha: number;
            
            if (smoothFuelPercent > 0.5) {
              // Above 50% - use neon hue at full saturation/lightness with 50% opacity
              fillColor = `hsl(${neonHue}, 100%, 50%)`;
              baseAlpha = 0.5;
            } else if (smoothFuelPercent > 0.25) {
              // 25-50% - bright orange
              fillColor = `hsl(30, 100%, 50%)`;
              baseAlpha = 0.5;
            } else {
              // Below 25% - bright red  
              fillColor = `hsl(0, 100%, 50%)`;
              baseAlpha = 0.5;
            }
            
            // Low fuel flicker (<15%) - use gameTime for consistent timing
            let flickerAlpha = 1;
            if (smoothFuelPercent < 0.15 && smoothFuelPercent > 0) {
              const flickerFreq = shouldOptimizePerformance ? 8 : 16;
              const now = performance.now() / 1000;
              const flickerPhase = Math.sin(now * flickerFreq * Math.PI * 2) * 0.5 + 0.5;
              flickerAlpha = 0.3 + flickerPhase * 0.7; // Flash between 30% and 100% opacity
            }
            
            // Draw fuel fill clipped to triangle
            if (smoothFuelPercent > 0.01) {
              ctx.save();
              
              // Create clipping path (lander triangle shape)
              ctx.beginPath();
              ctx.moveTo(0, -10);
              ctx.lineTo(8, 10);
              ctx.lineTo(-8, 10);
              ctx.closePath();
              ctx.clip();
              
              // Calculate liquid surface
              const fillHeight = 20 * smoothFuelPercent;
              const baseY = 10 - fillHeight;
              const tiltAngle = liquidTiltAngleRef.current;
              const wavePhase = liquidWavePhaseRef.current;
              const waveAmp = liquidWaveAmplitudeRef.current;
              
              // Build polygon points for wavy liquid surface
              const resolution = shouldOptimizePerformance ? 8 : 28;
              const points: {x: number, y: number}[] = [];
              points.push({ x: -8, y: 10 });
              points.push({ x: 8, y: 10 });
              
              for (let i = resolution; i >= 0; i--) {
                const t = i / resolution;
                const px = -8 + 16 * t;
                const tiltOffset = (t - 0.5) * 16 * Math.tan(tiltAngle);
                
                let waveOffset = 0;
                if (!shouldOptimizePerformance) {
                  const edgeDistance = Math.abs(t - 0.5) * 2;
                  const dampening = edgeDistance > 0.7 ? 
                    (1 - Math.pow((edgeDistance - 0.7) / 0.3, 2) * 0.6) : 1;
                  waveOffset = (
                    Math.sin(t * Math.PI * 2 + wavePhase) * waveAmp * 0.40 +
                    Math.sin(t * Math.PI * 4 - wavePhase * 1.3) * waveAmp * 0.25 +
                    Math.sin(t * Math.PI * 6 + wavePhase * 0.7) * waveAmp * 0.15 +
                    Math.sin(t * Math.PI * 8 + wavePhase * 2.1) * waveAmp * 0.10 +
                    Math.sin(t * Math.PI * 12 - wavePhase * 1.7) * waveAmp * 0.06 +
                    Math.sin(t * Math.PI * 16 + wavePhase * 0.9) * waveAmp * 0.04
                  ) * dampening;
                } else {
                  waveOffset = Math.sin(t * Math.PI * 2 + wavePhase) * waveAmp * 0.8;
                }
                
                points.push({ x: px, y: baseY + tiltOffset + waveOffset });
              }
              
              // Draw liquid polygon
              ctx.fillStyle = fillColor;
              if (!shouldOptimizePerformance) {
                ctx.shadowColor = fillColor;
                ctx.shadowBlur = 8;
              }
              ctx.globalAlpha = baseAlpha * flickerAlpha;
              ctx.beginPath();
              ctx.moveTo(points[0].x, points[0].y);
              for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
              }
              ctx.closePath();
              ctx.fill();
              
              ctx.restore();
              
              // Reset globalAlpha for ship outline
              ctx.globalAlpha = shipAlpha;
            }
          }
          
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(8, 10);
          ctx.lineTo(-8, 10);
          ctx.closePath();
          ctx.strokeStyle = shipColor as any;
          ctx.lineWidth = 2;
          ctx.stroke();

          // legs
          ctx.beginPath();
          ctx.moveTo(-6, 8); ctx.lineTo(-12, 12);
          ctx.moveTo(6, 8); ctx.lineTo(12, 12);
          ctx.stroke();

          // engine flame if thrust
          if (lastThrust.current > 0 && fuel > 0) {
            ctx.beginPath();
            ctx.moveTo(-3, 10);
            ctx.lineTo(0, 16 + Math.random() * 8);
            ctx.lineTo(3, 10);
            ctx.stroke();
          }
          ctx.restore();
        }
        
        // Draw electrified effect during paralysis
        if (electrifiedTimer > 0 && !crashed) {
          ctx.save();
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#ffff00';
          ctx.shadowBlur = shouldOptimizePerformance ? 10 : 20;
          ctx.globalAlpha = 0.6;
          
          const arcCount = 4;
          for (let i = 0; i < arcCount; i++) {
            const angle1 = (elapsed * 10 + i * 1.5) % (Math.PI * 2);
            const angle2 = (elapsed * 10 + i * 1.5 + 0.8) % (Math.PI * 2);
            const r1 = 12;
            const r2 = 18;
            
            const x1 = x + Math.cos(angle1) * r1;
            const y1 = y + Math.sin(angle1) * r1;
            const x2 = x + Math.cos(angle2) * r2;
            const y2 = y + Math.sin(angle2) * r2;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 10;
            const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 10;
            ctx.lineTo(midX, midY);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          
          ctx.restore();
        }
        
        // Draw collectibles shield bubble if active
        if (shieldActiveRef.current) {
          for (const offset of [-terrain.worldWidth, 0, terrain.worldWidth]) {
            ctx.save();
            ctx.translate(x + offset, y + 2); // +2 for visual centering (match CountdownOverlay)
            
            // Shimmer animation
            const shimmerPhase = elapsed * 3;
            const shimmerAlpha = 0.3 + Math.sin(shimmerPhase) * 0.1;
            
            // Timer-based fade (last 10 seconds)
            const timerFade = shieldTimerRef.current < 10 
              ? Math.max(0.3, shieldTimerRef.current / 10) 
              : 1;
            
            // Bubble outline with purple glow
            ctx.strokeStyle = `hsla(280, 100%, 85%, ${(shimmerAlpha + 0.3) * timerFade})`;
            ctx.lineWidth = 2;
            if (!shouldOptimizePerformance) {
              ctx.shadowColor = "hsla(280, 100%, 70%, 0.8)";
              ctx.shadowBlur = 15;
            }
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.stroke();
            
            // Prismatic sheen
            ctx.shadowBlur = 0;
            const sheenAngle = shimmerPhase * 0.5;
            const grad = ctx.createLinearGradient(
              Math.cos(sheenAngle) * 25, Math.sin(sheenAngle) * 25,
              -Math.cos(sheenAngle) * 25, -Math.sin(sheenAngle) * 25
            );
            grad.addColorStop(0, `hsla(260, 100%, 70%, ${0.1 * timerFade})`);
            grad.addColorStop(0.5, `hsla(300, 100%, 80%, ${0.25 * timerFade})`);
            grad.addColorStop(1, `hsla(260, 100%, 70%, ${0.1 * timerFade})`);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
          }
        }
        
        // Restore original shadow settings for other elements
        ctx.shadowColor = originalShadowColor;
        ctx.shadowBlur = originalShadowBlur;
      }

      // Lightning screen flash (rendered AFTER lander, on top of everything except HUD)
      if (lightningEnabled && screenFlashAlpha.current > 0) {
        ctx.save();
        renderLightningFlash(ctx, screenFlashAlpha.current, w / dpr, h / dpr, dpr);
        ctx.restore();
      }

      // Spectacular particle rendering with dramatically enhanced thruster effects
      if (particles.length > 0) {
        ctx.save();
        
        for (const p of particles) {
          const ageRatio = p.life / p.max;
          
          if (p.isBubble) {
            // === BUBBLE RENDERING (CIRCLES) - OPTIMIZED ===
            const bubbleSize = p.size || 3;
            
            // Fade out near end of life
            const alpha = 1 - Math.pow(ageRatio, 3);  // Cubic fade
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // HIGH GRAPHICS: Simplified 2-layer neon glow (removed 3rd layer for performance)
            if (!shouldOptimizePerformance) {
              // Outer glow (reduced blur)
              ctx.shadowBlur = bubbleSize * 3;  // Reduced from 4x to 3x
              ctx.shadowColor = p.color;
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, bubbleSize, 0, Math.PI * 2);
              ctx.fill();
              
              // Inner bright core (reduced blur)
              ctx.shadowBlur = bubbleSize * 1.5;  // Reduced from 2x to 1.5x
              ctx.fillStyle = p.color.replace(/[\d.]+\)$/g, '1.0)');  // Full opacity
              ctx.beginPath();
              ctx.arc(p.x, p.y, bubbleSize * 0.7, 0, Math.PI * 2);
              ctx.fill();
              
            } else {
              // LOW GRAPHICS: Simple filled circle with minimal glow
              ctx.shadowBlur = bubbleSize;
              ctx.shadowColor = p.color;
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, bubbleSize, 0, Math.PI * 2);
              ctx.fill();
            }
            
            ctx.restore();
            
          } else if (useIPadThrusterOptimization) {
            // === iPAD OPTIMIZED: Fast fillRect rendering (matches SurvivalEngine) ===
            // Uses fillRect instead of stroke() - much faster on iPad GPU
            // shadowBlur:6 vs 25 = ~17x fewer GPU samples per particle
            const t = p.life / p.max;
            const alpha = 1 - t;
            const size = 3 - t * 2; // Shrinks from 3 to 1 over lifetime
            
            ctx.fillStyle = p.color as any;
            ctx.shadowColor = neonColor as any;
            ctx.shadowBlur = 6; // Moderate glow - key to performance!
            ctx.globalAlpha = alpha;
            ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
          } else {
            // === REGULAR PARTICLE RENDERING (LINES) - Desktop/iPhone ===
            const isThruster = p.color === neonColor || p.color.includes('hsla');
            const alpha = shouldOptimizePerformance ? 1 : (1 - ageRatio * 0.7);
            
            ctx.shadowBlur = shouldOptimizePerformance ? 0 : (isThruster ? THRUSTER_SHADOW_BLUR : 2);
            ctx.shadowColor = isThruster ? neonColor as any : p.color as any;
            
            ctx.beginPath();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = p.color as any;
            
            const lineWidth = shouldOptimizePerformance ? 1.8 : 
              (isThruster ? (isIPhone ? 1.8 + (1 - ageRatio) * 1.0 : 1.5 + (1 - ageRatio) * 1.0) : 1.8);
            ctx.lineWidth = lineWidth;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Render 360° particle burst (style points)
      for (const particle of styleParticles) {
        const alpha = Math.max(0, particle.life / particle.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        const particleColor = (particle as any).color || neonColor;
        const particleSize = (particle as any).size || 5;
        ctx.fillStyle = particleColor as any;
        ctx.shadowBlur = 40;
        ctx.shadowColor = particleColor as any;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particleSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render near miss text (style points)
      for (const text of nearMissTexts) {
        const alpha = text.life / text.maxLife;
        const yOffset = (1 - alpha) * 30; // Float upward
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.fillStyle = neonColor as any;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        const screenX = text.x;
        const screenY = text.y - yOffset;
        ctx.strokeText(text.text, screenX, screenY);
        ctx.fillText(text.text, screenX, screenY);
        ctx.restore();
      }
      
      // Render floating score texts (rotation style points)
      for (const text of floatingScoreTexts) {
        const t = text.life / text.maxLife;
        const alpha = 1 - t; // Fade from 1 to 0
        const scale = 1 + t * 0.3; // Grow slightly as it fades
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${24 * scale}px "Orbitron", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Glowing text effect
        ctx.shadowColor = neonColor as any;
        ctx.shadowBlur = 20;
        ctx.fillStyle = neonColor as any;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        
        ctx.strokeText(text.points.toString(), text.x, text.y);
        ctx.fillText(text.points.toString(), text.x, text.y);
        
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Debris shards (varied shapes)
      for (const d of debris) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.beginPath();
        const s = d.size;
        if (d.kind === "rod") {
          ctx.moveTo(-s * 3, -s * 0.4);
          ctx.lineTo(s * 3, -s * 0.4);
          ctx.lineTo(s * 3, s * 0.4);
          ctx.lineTo(-s * 3, s * 0.4);
          ctx.closePath();
        } else if (d.kind === "plate") {
          ctx.moveTo(-s, -s * 0.8);
          ctx.lineTo(s * 1.2, -s * 0.3);
          ctx.lineTo(s * 0.3, s * 1.3);
          ctx.lineTo(-s * 1.1, s * 0.4);
          ctx.closePath();
        } else {
          // chip - small triangle
          ctx.moveTo(-s, -s * 0.6);
          ctx.lineTo(s * 0.9, -s * 0.2);
          ctx.lineTo(-s * 0.2, s);
          ctx.closePath();
        }
        ctx.strokeStyle = neonColor as any;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
      }
      
      // Composite off-screen terrain using spotlight (during blackout)
      if (blackoutActive.current && !crashed && offscreenTerrainCanvasRef.current) {
        ctx.save();
        
        const spotX = x;
        const spotY = y;
        const spotAngle = angle + Math.PI / 2; // Point downward from ship
        const spotlightIntensity = 1.0;
        
        // Create spotlight cone path
        const leftAngle = spotAngle - SPOTLIGHT_ANGLE / 2;
        const rightAngle = spotAngle + SPOTLIGHT_ANGLE / 2;
        const leftX = spotX + Math.cos(leftAngle) * SPOTLIGHT_RANGE;
        const leftY = spotY + Math.sin(leftAngle) * SPOTLIGHT_RANGE;
        const rightX = spotX + Math.cos(rightAngle) * SPOTLIGHT_RANGE;
        const rightY = spotY + Math.sin(rightAngle) * SPOTLIGHT_RANGE;
        
        // Draw spotlight gradient with additive blending
        const gradient = ctx.createRadialGradient(
          spotX, spotY, 0,
          spotX, spotY, SPOTLIGHT_RANGE
        );
        gradient.addColorStop(0, `rgba(255, 255, 220, ${0.6 * spotlightIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 200, ${0.3 * spotlightIntensity})`);
        gradient.addColorStop(1, `rgba(255, 255, 180, 0)`);
        
        ctx.beginPath();
        ctx.moveTo(spotX, spotY);
        ctx.lineTo(leftX, leftY);
        ctx.arc(spotX, spotY, SPOTLIGHT_RANGE, leftAngle, rightAngle);
        ctx.lineTo(spotX, spotY);
        ctx.closePath();
        
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fill();
        
        // Create clipping path for terrain composite
        ctx.globalCompositeOperation = 'source-over';
        ctx.clip();
        
        // Draw off-screen terrain (only visible inside clip region)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(offscreenTerrainCanvasRef.current, 0, 0);
        
        // Add bloom/glow layer
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.3 * spotlightIntensity;
        ctx.drawImage(offscreenTerrainCanvasRef.current, 0, 0);
        
        ctx.restore();
        
        // Re-apply camera transform for remaining objects
        ctx.scale(dpr, dpr);
        ctx.translate(w / (2 * dpr), h / (2 * dpr));
        ctx.scale(zoom, zoom);
        ctx.translate(-cameraX + shakeX, anchor);
      }
      
      // Composite off-screen terrain using vertical sweep beam (during Light Storm)
      if (lightStormActive.current && sweepActiveRef.current && !crashed) {
        const beamWidth = currentBeamWidthRef.current;
        const beamCenterX = sweepXRef.current;
        const beamLeftX = beamCenterX - beamWidth / 2;
        const beamRightX = beamCenterX + beamWidth / 2;
        
        if (shouldOptimizeLightBeam) {
          // SIMPLIFIED iPad mid/low path: Draw terrain directly with simple rect clip
          // No off-screen canvas, no composite operations, no bloom
          ctx.save();
          
          // sweepXRef.current (beamCenterX) is ALREADY in world coordinates
          // beamWidth is also already in world units - use directly!
          const beamWorldLeft = beamCenterX - beamWidth / 2;
          
          // Simple clip rect in world space
          ctx.beginPath();
          ctx.rect(beamWorldLeft, -10000, beamWidth, 20000);
          ctx.clip();
          
          // Draw terrain directly - no glow, no bloom, just solid lines
          ctx.strokeStyle = neonColor as any;
          ctx.shadowColor = neonColor as any;
          ctx.shadowBlur = 2; // Minimal glow
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1.0;
          
          // Draw terrain
          const drawTerrainDirect = (offset: number) => {
            if (offset + terrain.worldWidth < viewLeft || offset > viewRight) return;
            ctx.beginPath();
            for (let i = 0; i < terrain.points.length; i++) {
              const p = terrain.points[i];
              if (i === 0) ctx.moveTo(p.x + offset, p.y);
              else ctx.lineTo(p.x + offset, p.y);
            }
            ctx.lineTo(terrain.points[0].x + offset + terrain.worldWidth, terrain.points[0].y);
            ctx.stroke();
          };
          
          const wrapVal = Math.floor(cameraX / terrain.worldWidth);
          for (let ww = -1; ww <= 1; ww++) drawTerrainDirect((wrapVal + ww) * terrain.worldWidth);
          
          // Draw pads WITH world wrapping (like terrain)
          for (let ww = -1; ww <= 1; ww++) {
            const worldOffset = (wrapVal + ww) * terrain.worldWidth;
            for (const pad of terrain.pads) {
              const padW = (pad.xEnd >= pad.xStart ? (pad.xEnd - pad.xStart) : (terrain.worldWidth - pad.xStart + pad.xEnd));
              ctx.fillStyle = pad.bonus2x ? `rgba(255,100,255,0.8)` : `rgba(100,255,255,0.8)`;
              ctx.fillRect(pad.xStart + worldOffset, pad.y, padW, 2);
            }
          }
          
          ctx.restore();
          
          // Draw faint terrain outline (always visible for navigation)
          ctx.save();
          ctx.globalAlpha = 0.05;
          ctx.strokeStyle = neonColor as any;
          ctx.shadowBlur = 0;
          ctx.lineWidth = 1;
          for (let ww = -1; ww <= 1; ww++) {
            const offset = (wrapVal + ww) * terrain.worldWidth;
            if (offset + terrain.worldWidth < viewLeft || offset > viewRight) continue;
            ctx.beginPath();
            for (let i = 0; i < terrain.points.length; i++) {
              const p = terrain.points[i];
              if (i === 0) ctx.moveTo(p.x + offset, p.y);
              else ctx.lineTo(p.x + offset, p.y);
            }
            ctx.stroke();
          }
          
          ctx.restore();
          
          // Draw simple beam glow overlay (no composite operations)
          // Convert world coords to screen coords for the beam visual
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
          
          // Convert beam from world coords to screen coords
          const screenCenterX = w / (2 * dpr);
          const beamScreenCenterX = screenCenterX + (beamCenterX - cameraX + shakeX) * zoom;
          const beamScreenWidth = beamWidth * zoom;
          const beamScreenLeft = beamScreenCenterX - beamScreenWidth / 2;
          const beamScreenRight = beamScreenCenterX + beamScreenWidth / 2;
          
          const gradient = ctx.createLinearGradient(beamScreenLeft, 0, beamScreenRight, 0);
          gradient.addColorStop(0, `rgba(200, 220, 255, 0)`);
          gradient.addColorStop(0.3, `rgba(200, 220, 255, 0.12)`);
          gradient.addColorStop(0.5, `rgba(220, 240, 255, 0.25)`);
          gradient.addColorStop(0.7, `rgba(200, 220, 255, 0.12)`);
          gradient.addColorStop(1, `rgba(200, 220, 255, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.globalAlpha = 1.0;
          ctx.fillRect(beamScreenLeft, 0, beamScreenWidth, h / dpr);
          ctx.restore();
          
          // Re-apply camera transform
          ctx.scale(dpr, dpr);
          ctx.translate(w / (2 * dpr), h / (2 * dpr));
          ctx.scale(zoom, zoom);
          ctx.translate(-cameraX + shakeX, anchor);
          
        } else if (offscreenTerrainCanvasRef.current) {
          // Full quality PC/iPhone/high-gfx path: Use off-screen canvas for bloom effects
          ctx.save();
          
          const stormFadeAlpha = 1.0;
          
          // Create vertical beam clipping path
          ctx.beginPath();
          ctx.rect(
            beamLeftX,
            -viewH * 2,
            beamWidth,
            viewH * 4
          );
          ctx.closePath();
          
          // Draw beam gradient glow (additive blending)
          const gradient = ctx.createLinearGradient(beamLeftX, 0, beamRightX, 0);
          gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
          gradient.addColorStop(0.3, `rgba(200, 220, 255, ${0.3 * stormFadeAlpha})`);
          gradient.addColorStop(0.5, `rgba(220, 240, 255, ${0.5 * stormFadeAlpha})`);
          gradient.addColorStop(0.7, `rgba(200, 220, 255, ${0.3 * stormFadeAlpha})`);
          gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fill();
          
          // Clip to beam area
          ctx.clip();
          
          // Draw off-screen terrain (only visible inside beam)
          ctx.globalCompositeOperation = 'source-over';
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1.0 * stormFadeAlpha;
          ctx.drawImage(offscreenTerrainCanvasRef.current, 0, 0);
          
          // Add bloom/glow layer
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.2 * stormFadeAlpha;
          ctx.drawImage(offscreenTerrainCanvasRef.current, 0, 0);
          
          ctx.restore();
          
          // Re-apply camera transform for remaining objects
          ctx.scale(dpr, dpr);
          ctx.translate(w / (2 * dpr), h / (2 * dpr));
          ctx.scale(zoom, zoom);
          ctx.translate(-cameraX + shakeX, anchor);
        }
      }

      // ============= END OF TERRAIN RENDERING =============

      // Screen-space overlays removed - now handled by BonusMessageDisplay component

      ctx.restore();
    };

    const drawStars = (ctx: CanvasRenderingContext2D, _offsetX: number, _viewW: number, _viewH: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wpx = ctx.canvas.width / dpr;
      const hpx = ctx.canvas.height / dpr;
      ctx.save();
      ctx.shadowColor = neonColor as any;
      ctx.fillStyle = neonColor as any;
      // Map CSS px to device px
      ctx.scale(dpr, dpr);
      // Static twinkling stars in screen space - render more stars even in low graphics
      const starLimit = shouldOptimizePerformance ? Math.min(200, stars.length) : stars.length;
      for (let i = 0; i < starLimit; i++) {
        const s = stars[i];
        const a = s.baseA * (0.7 + 0.3 * Math.sin(s.ph + elapsed * s.tw));
        ctx.globalAlpha = Math.min(1, Math.max(0.1, a)); // Lower minimum from 0.25 to 0.1 for fainter stars
        
        // Adjust shadowBlur based on star size and type
        if (s.bright && !shouldOptimizePerformance) {
          ctx.shadowBlur = 8;
        } else if (s.bright && shouldOptimizePerformance) {
          ctx.shadowBlur = 4;
        } else if (s.size < 0.9) {
          // Tiny stars get minimal or no glow for subtlety
          ctx.shadowBlur = shouldOptimizePerformance ? 0 : 1;
        } else {
          ctx.shadowBlur = shouldOptimizePerformance ? 2 : 4;
        }
        
        const x = (s.x % wpx + wpx) % wpx;
        const y = Math.max(0, Math.min(hpx, s.y));
        
        // Render based on style - mix circles and rectangles
        if (s.renderStyle === 'rect') {
          ctx.fillRect(x - s.size / 2, y - s.size / 2, s.size, s.size);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, s.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0; // Reset shadow blur
      ctx.globalAlpha = 1;
      // Shooting stars with enhanced glow
      for (const sh of shooting) {
        const t = 1 - Math.min(1, sh.life / sh.max);
        ctx.globalAlpha = t;
        
        // Add glow even in low graphics
        ctx.shadowBlur = shouldOptimizePerformance ? 4 : 6;
        ctx.shadowColor = neonColor as any;
        
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 0.06, sh.y - sh.vy * 0.06);
        ctx.lineWidth = 2;
        ctx.strokeStyle = neonColor as any;
        ctx.stroke();
        
        ctx.shadowBlur = 0; // Reset for next iteration
      }
      ctx.globalAlpha = 1;
      // Background small satellites with subtle glow
      for (const s of bgSats) {
        const tScale = s.scale;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.scale(tScale, tScale);
        
        // Add subtle glow in low graphics
        if (shouldOptimizePerformance) {
          ctx.shadowBlur = 3;
          ctx.shadowColor = neonColor as any;
        }
        
        ctx.strokeStyle = neonColor as any;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(-6, -2, 12, 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(-16, -3, 8, 6);
        ctx.rect(8, -3, 8, 6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.shadowBlur = 0; // Reset shadow blur
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    // HUD update timer integrated into main loop
    let hudUpdateTimer = 0;
    
    // Only start game loop if component is still mounted
    if (mountedRef.current) {
      rafRef.current = requestAnimationFrame(loop);
    }
    }; // End of initializeGame async function
    
    initializeGame();

    return () => { 
      mountedRef.current = false; // Prevent initializeGame from starting loop
      cancelAnimationFrame(rafRef.current);
      if (!isDemo) {
        audio.current.stopThruster(); 
        try { audio.current.stopFuelAlarm(); } catch {} 
        try { audio.current.stopLevelMusic(); } catch {}
      }
    };
  }, [difficulty, onGameOver, paused, level, mode, seedOverride, waitingForSpecialMessage]);


  return (
    <section className="relative h-[calc(100vh-0px)] w-full select-none">
      <div ref={containerRef} className="absolute inset-0 select-none">
        <canvas ref={canvasRef} className="block w-full h-full select-none" />
        {((showCavernFX && mode === "caverns") || hasRandomEffects) && (
          <CavernFXRenderer
            cavernData={cavernBakeResult}
            enabled={showCavernFX || hasRandomEffects}
            cameraX={cameraState.cameraX}
            cameraY={cameraState.cameraY}
            viewWidth={cameraState.viewWidth}
            viewHeight={cameraState.viewHeight}
            params={randomEffectParams || cavernFXParams}
          />
        )}
        
        <WaterFXRenderer enabled={isUnderwater && !paused} />
      </div>

      {isTouch && !isDemo && (
        <div
          className="absolute inset-0 z-10 touch-none select-none"
          onTouchStart={(e) => { 
            e.preventDefault(); 
            if (e.touches.length > 0 && !worldPaused && !playerLocked) { 
              keys.current.thrust = true; 
              audio.current.resume(); 
            } 
          }}
          onTouchEnd={(e) => { 
            e.preventDefault(); 
            keys.current.thrust = false; 
          }}
          onTouchCancel={(e) => { 
            e.preventDefault(); 
            keys.current.thrust = false; 
          }}
        />
      )}

      <HUD {...hud} collectibles={collectiblesRef.current || undefined} bestTime={bestTime} mode={mode} showFullHUD={showFullHUD} />

      {showFPSSetting && (
        <div className="pointer-events-none absolute bottom-2 right-3 z-40">
          <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded px-2 py-1 text-[20px] font-mono text-muted-foreground">
            FPS: {Math.round(fps)}{showFullHUD && <> • Seed: {hud.levelSeed ?? "-"}{mode === "fixed" || mode === "caverns" ? `:${level}` : ""}</>}
          </div>
        </div>
      )}

      {/* Controls overlay - Only show if not using PC controls and not in demo mode */}
      {!isUsingPCControls && !isDemo && (
        <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-3 select-none" style={{ opacity: 0.025 + (touchOpacity - 1) * 0.108333 }}>
          <div className="flex gap-2">
            <Button 
              variant="neon" 
              className={`select-none ${largeRotateButtons ? 'text-5xl px-8 py-9 min-w-[80px] flex items-center justify-center' : ''}`}
              onMouseDown={() => (keys.current.left = true)} 
              onMouseUp={() => (keys.current.left = false)} 
              onMouseLeave={() => (keys.current.left = false)}
              onTouchStart={(e) => { e.preventDefault(); keys.current.left = true; }} 
              onTouchEnd={(e) => { e.preventDefault(); keys.current.left = false; }}
              onTouchCancel={(e) => { e.preventDefault(); keys.current.left = false; }}
            >
              <span className="select-none">{largeRotateButtons ? '◄' : 'Rotate ◄'}</span>
            </Button>
            <Button 
              variant="neon" 
              className={`select-none ${largeRotateButtons ? 'text-5xl px-8 py-9 min-w-[80px] flex items-center justify-center' : ''}`}
              onMouseDown={() => (keys.current.right = true)} 
              onMouseUp={() => (keys.current.right = false)} 
              onMouseLeave={() => (keys.current.right = false)}
              onTouchStart={(e) => { e.preventDefault(); keys.current.right = true; }} 
              onTouchEnd={(e) => { e.preventDefault(); keys.current.right = false; }}
              onTouchCancel={(e) => { e.preventDefault(); keys.current.right = false; }}
            >
              <span className="select-none">{largeRotateButtons ? '►' : 'Rotate ►'}</span>
            </Button>
            <Button 
              variant="destructive" 
              className="select-none"
              onMouseDown={() => { keys.current.abort = true; abortAssist.current = true; }} 
              onMouseUp={() => (keys.current.abort = false)} 
              onMouseLeave={() => (keys.current.abort = false)}
              onTouchStart={(e) => { e.preventDefault(); keys.current.abort = true; abortAssist.current = true; }} 
              onTouchEnd={(e) => { e.preventDefault(); keys.current.abort = false; }}
              onTouchCancel={(e) => { e.preventDefault(); keys.current.abort = false; }}
            >
              <span className="select-none">Abort</span>
            </Button>
          </div>
        </div>
      )}

      {/* Rotation boost hint */}
      {showRotBoostHint && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-card/90 backdrop-blur-sm border border-accent/60 rounded-lg p-4 text-center shadow-neon">
          <div className="text-accent text-sm font-semibold mb-1">💡 Pro Tip</div>
          <div className="text-foreground">Hold RT / Shift for 2× rotate</div>
          <div className="text-muted-foreground text-xs mt-1">Great for tight tunnels!</div>
        </div>
      )}

      {/* Top controls */}
      {showFullHUD && (
        <div className="absolute top-4 right-4 z-20 flex gap-2 select-none">
          <Button variant="hero" className="select-none" onClick={() => setPaused((p) => !p)}><span className="select-none">{paused ? "Resume" : "Pause"}</span></Button>
          <Button variant="outline" className="select-none" onClick={onExit}><span className="select-none">Exit</span></Button>
        </div>
      )}
      
      
      {/* Countdown Overlay */}
      <CountdownOverlay 
        state={introState} 
        canvasRef={canvasRef}
        lowGraphics={graphicsLevel === "low"}
        shipPosition={shipScreenPos ?? undefined}
        shieldColor={neonColor}
      />
      
      {/* Fireworks overlay for successful landing */}
      {showFireworks && (
        <FireworksDisplay 
          landingType={landingType}
          neonColor={neonColor}
          isWorldRecord={isWorldRecord}
          isHighScore={isWorldRecord}
          lowGraphics={graphicsLevel === "low"}
          terrainMaskEnabled={terrainMaskedFireworks}
          terrainPoints={terrainDataRef.current?.points}
          terrainWorldWidth={terrainDataRef.current?.worldWidth}
          cameraX={cameraState.cameraX}
          cameraAnchor={cameraState.anchor}
          zoom={cameraState.zoom}
        onComplete={async () => {
          setShowFireworks(false);
          
              // Handle Time Trial completion
              if (mode === "timetrial" && timeTrialCompletionDataRef.current) {
                const { completionTime, level, difficulty, ghostFrames } = timeTrialCompletionDataRef.current;
                
      console.log('⏱️ Time Trial completion check:', {
        completionTime,
        level,
        difficulty
      });
      
      // Check local record BEFORE saving (critical: compare against OLD best time)
      const previousBest = ghostManager.current.getTimeTrialBestTime(difficulty, level);
      const isNewLocalRecord = !previousBest || completionTime < previousBest;
      
      console.log('📊 Local record check:', {
        previousBest,
        completionTime,
        isNewLocalRecord
      });
      
      // Now save ghost locally (after we've checked the old record)
      ghostManager.current.saveTimeTrialGhost(difficulty, level, ghostFrames, completionTime);
                
                // Check global record
                let isNewGlobalRecord = false;
                try {
                  const { checkGlobalRecord } = await import('@/lib/leaderboard');
                  const { isRecord } = await checkGlobalRecord(level, difficulty, 'timetrial', completionTime);
                  isNewGlobalRecord = isRecord;
                  console.log('🌍 Global record check:', {
                    isNewGlobalRecord
                  });
                } catch (error) {
                  console.error('Error checking global record:', error);
                }
                
                console.log('🎯 Calling onGameOver with:', {
                  isNewBestTime: isNewLocalRecord,
                  isWorldRecord: isNewGlobalRecord,
                  completionTime,
                  level
                });
                
                // Call onGameOver to show Mission Successful screen
                onGameOver({
              score: hud.score,
              landings: currentLandings,
              cause: "success",
              difficulty,
              elapsed: completionTime / 1000,
              levelSeed: hud.levelSeed,
              level,
              initialSpawnX: initialSpawnRef.current.x,
              initialSpawnY: initialSpawnRef.current.y,
              isNewBestTime: isNewLocalRecord,
              isWorldRecord: isNewGlobalRecord,
              timeTrialCompletionTime: completionTime,
              timeTrialGhostFrames: ghostFrames,
              lastEarned: lastLandingBonuses.lastEarned,
              padBonus2x: lastLandingBonuses.padBonus2x,
              bullseye: lastLandingBonuses.bullseye,
              speedBonus: lastLandingBonuses.speedBonus
            });
            
            timeTrialCompletionDataRef.current = null;
            return;
          }
          
          // Check if this is a new best time and save ghost
          let isNewBestTime = false;
          let ghostTimeDiff: number | undefined;
          
          if ((mode === "fixed" || mode === "medley") && ghostRecording.length > 0) {
            try {
              const currentTimeMs = hud.time * 1000; // Convert seconds to milliseconds
              let existingBestTime: number | null = null;
              
              if (mode === "fixed") {
                existingBestTime = ghostManager.current.getLunarLanderBestTime(difficulty, level);
              } else if (mode === "medley") {
                existingBestTime = ghostManager.current.getMedleyBestTime(difficulty, level);
              }
              
              console.log('🕐 Best time check:', {
                mode,
                existingBestTime,
                currentTime: currentTimeMs,
                isNewBest: !existingBestTime || currentTimeMs < existingBestTime
              });
              
              if (!existingBestTime || currentTimeMs < existingBestTime) {
                isNewBestTime = true;
                
                // Save local ghost
                if (mode === "fixed") {
                  ghostManager.current.saveLunarLanderGhost(difficulty, level, ghostRecording, currentTimeMs);
                } else if (mode === "medley") {
                  ghostManager.current.saveMedleyGhost(difficulty, level, ghostRecording, currentTimeMs);
                }
                console.log('💾 Local ghost saved');
                
                // Try to upload to global ghosts
                try {
                  const initials = localStorage.getItem('ll-player-initials') || '';
                  console.log('🌍 Attempting to upload global ghost...', {
                    difficulty,
                    level,
                    mode,
                    time: currentTimeMs,
                    initials: initials || '(empty)',
                    frameCount: ghostRecording.length
                  });
                  
                  const uploadResult = await ghostManager.current.checkAndUploadGlobalGhost(
                    difficulty,
                    level,
                    currentTimeMs,
                    ghostRecording,
                    initials,
                    mode as 'fixed' | 'medley'
                  );
                  
                  console.log('🌍 Upload result:', uploadResult);
                  
                  if (uploadResult.error) {
                    console.error('❌ Failed to upload global ghost:', uploadResult.error);
                  }
                  
                  if (uploadResult.uploaded && uploadResult.wasRecord) {
                    console.log('🏆 NEW GLOBAL RECORD SET!');
                    setIsWorldRecord(true); // Set flag for UI to display message
                  }
                  
                  // Submit score to leaderboard
                  try {
                    const { submitScore } = await import('@/lib/leaderboard');
                    await submitScore({
                      initials,
                      score: hud.score,
                      difficulty,
                      mode,
                      level,
                      completion_time: currentTimeMs
                    });
                    console.log(`✅ ${mode} mode score submitted to leaderboard`);
                  } catch (scoreError) {
                    console.error(`❌ Error submitting ${mode} mode score:`, scoreError);
                  }
                } catch (uploadError) {
                  console.error('💥 Exception during global ghost upload:', uploadError);
                }
              } else {
                console.log('⏱️ Not a new best time, skipping ghost save');
              }
              
              if (existingBestTime) {
                ghostTimeDiff = currentTimeMs - existingBestTime;
              }
            } catch (ghostError) {
              console.error('💥 Exception during ghost processing:', ghostError);
            }
          } else {
            console.log('❌ Skipping ghost logic:', {
              mode,
              modeIsFixedOrMedley: mode === "fixed" || mode === "medley",
              hasRecording: ghostRecording.length > 0
            });
          }
          
          onGameOver({ 
            score: hud.score, 
            landings: currentLandings, 
            cause: "success", 
            difficulty, 
            elapsed: hud.time,
            levelSeed: hud.levelSeed,
            level,
            initialSpawnX: initialSpawnRef.current.x,
            initialSpawnY: initialSpawnRef.current.y,
            isNewBestTime,
            ghostTimeDiff,
            isWorldRecord,
            lastEarned: lastLandingBonuses.lastEarned,
            padBonus2x: lastLandingBonuses.padBonus2x,
            bullseye: lastLandingBonuses.bullseye,
            speedBonus: lastLandingBonuses.speedBonus,
            shieldActive: shieldActiveRef.current,
            shieldTimer: shieldTimerRef.current
          });
          setIsWorldRecord(false); // Reset for next level
        }}
          onSkip={async () => {
            console.log('⏭️ FireworksDisplay onSkip called', {
              mode,
              hasGhostRecording: ghostRecording.length > 0,
              difficulty,
              level
            });
            
            // Immediately hide all celebration components
            setShowFireworks(false);
            setShowBonusMessages(false);
            setBonusMessages([]);
            setSkipCelebration(true);
            
            // Check if this is a new best time and save ghost
            let isNewBestTime = false;
            let ghostTimeDiff: number | undefined;
            
            if ((mode === "fixed" || mode === "medley") && ghostRecording.length > 0) {
              try {
                const currentTimeMs = hud.time * 1000; // Convert seconds to milliseconds
                let existingBestTime: number | null = null;
                
                if (mode === "fixed") {
                  existingBestTime = ghostManager.current.getLunarLanderBestTime(difficulty, level);
                } else if (mode === "medley") {
                  existingBestTime = ghostManager.current.getMedleyBestTime(difficulty, level);
                }
                
                console.log('🕐 Best time check (skip):', {
                  mode,
                  existingBestTime,
                  currentTime: currentTimeMs,
                  isNewBest: !existingBestTime || currentTimeMs < existingBestTime
                });
                
                if (!existingBestTime || currentTimeMs < existingBestTime) {
                  isNewBestTime = true;
                  
                  // Save local ghost
                  if (mode === "fixed") {
                    ghostManager.current.saveLunarLanderGhost(difficulty, level, ghostRecording, currentTimeMs);
                  } else if (mode === "medley") {
                    ghostManager.current.saveMedleyGhost(difficulty, level, ghostRecording, currentTimeMs);
                  }
                  console.log('💾 Local ghost saved (skip)');
                  
                  // Try to upload to global ghosts
                  try {
                    const initials = localStorage.getItem('ll-player-initials') || '';
                    console.log('🌍 Attempting to upload global ghost (skip)...', {
                      difficulty,
                      level,
                      mode,
                      time: currentTimeMs,
                      initials: initials || '(empty)',
                      frameCount: ghostRecording.length
                    });
                    
                    const uploadResult = await ghostManager.current.checkAndUploadGlobalGhost(
                      difficulty,
                      level,
                      currentTimeMs,
                      ghostRecording,
                      initials,
                      mode as 'fixed' | 'medley'
                    );
                    
                    console.log('🌍 Upload result (skip):', uploadResult);
                    
                    if (uploadResult.error) {
                      console.error('❌ Failed to upload global ghost (skip):', uploadResult.error);
                    }
                    
                    if (uploadResult.uploaded && uploadResult.wasRecord) {
                      console.log('🏆 NEW GLOBAL RECORD SET (skip)!');
                    }
                    
                    // Submit score to leaderboard
                    try {
                      const { submitScore } = await import('@/lib/leaderboard');
                      await submitScore({
                        initials,
                        score: hud.score,
                        difficulty,
                        mode,
                        level,
                        completion_time: currentTimeMs
                      });
                      console.log(`✅ ${mode} mode score submitted to leaderboard (skip)`);
                    } catch (scoreError) {
                      console.error(`❌ Error submitting ${mode} mode score (skip):`, scoreError);
                    }
                  } catch (uploadError) {
                    console.error('💥 Exception during global ghost upload (skip):', uploadError);
                  }
                } else {
                  console.log('⏱️ Not a new best time (skip), skipping ghost save');
                }
                
                if (existingBestTime) {
                  ghostTimeDiff = currentTimeMs - existingBestTime;
                }
              } catch (ghostError) {
                console.error('💥 Exception during ghost processing (skip):', ghostError);
              }
            } else {
              console.log('❌ Skipping ghost logic (skip):', {
                mode,
                modeIsFixedOrMedley: mode === "fixed" || mode === "medley",
                hasRecording: ghostRecording.length > 0
              });
            }
            
            onGameOver({ 
              score: hud.score, 
              landings: currentLandings, 
              cause: "success", 
              difficulty, 
              elapsed: hud.time, 
              levelSeed: hud.levelSeed,
              level,
              initialSpawnX: initialSpawnRef.current.x,
              initialSpawnY: initialSpawnRef.current.y,
              isNewBestTime,
              ghostTimeDiff,
              isWorldRecord,
              lastEarned: lastLandingBonuses.lastEarned,
              padBonus2x: lastLandingBonuses.padBonus2x,
              bullseye: lastLandingBonuses.bullseye,
              speedBonus: lastLandingBonuses.speedBonus,
              shieldActive: shieldActiveRef.current,
              shieldTimer: shieldTimerRef.current
            });
            setIsWorldRecord(false); // Reset for next level
          }}
        />
      )}
      
      {/* Bonus message overlay */}
      {showBonusMessages && bonusMessages.length > 0 && (
        <BonusMessageDisplay
          messages={bonusMessages}
          neonColor={neonColor}
          delayMs={0}
          skipRequested={skipCelebration}
          onComplete={() => {
            setShowBonusMessages(false);
            setBonusMessages([]);
            hasShownBonusThisLanding.current = false;
          }}
        />
      )}
      
      {/* Special level message display */}
      {showSpecialMessage && specialLevelMessage && (
        <BonusMessageDisplay
          messages={[specialLevelMessage]}
          neonColor={neonColor}
          delayMs={0}
          skipRequested={false}
          onComplete={() => {
            setShowSpecialMessage(false);
            setSpecialLevelMessage("");
            setWaitingForSpecialMessage(false); // Signal to continue initialization
          }}
        />
      )}
      
      {/* In-Flight Tips */}
      {currentTip && (
        <InFlightTip
          message={currentTip.message}
          neonColor={neonColor}
          duration={currentTip.duration}
          onComplete={() => setCurrentTip(null)}
        />
      )}
      
    </section>
  );
};
