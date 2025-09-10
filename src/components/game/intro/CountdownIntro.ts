export type IntroVariant = "freeze" | "warp";

export interface CountdownOptions {
  variant: IntroVariant;
  durationSec?: number; // default 3.2
  invulnMs?: number; // default 1200
  allowSkipAfterMs?: number; // default 800
  words?: string[]; // default ["3","2","1","GO"]
  seed?: number; // mix(levelSeed,"INTRO")
  onTick?: () => void; // called on each digit
  onGo?: () => void; // called on GO
  onWarp?: () => void; // called on warp effect
}

export interface IntroHandle {
  start(opts?: Partial<CountdownOptions>): void;
  isActive(): boolean;
  isDone(): boolean;
  getCurrentState(): IntroState;
  onDone(cb: () => void): void;
  skip(): void;
}

export interface IntroState {
  phase: "inactive" | "countdown" | "go" | "done";
  currentWord: string;
  wordIndex: number;
  timeInPhase: number;
  totalTime: number;
  canSkip: boolean;
  variant: IntroVariant;
}

// Simple deterministic random number generator
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Mix function for deterministic seeding
export function mix(seed: number, ...parts: (string | number)[]): number {
  let h = seed >>> 0;
  for (const part of parts) {
    const str = String(part);
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995) >>> 0;
    }
  }
  return h >>> 0;
}

export function createCountdownIntro(): IntroHandle {
  let state: IntroState = {
    phase: "inactive",
    currentWord: "",
    wordIndex: 0,
    timeInPhase: 0,
    totalTime: 0,
    canSkip: false,
    variant: "freeze"
  };

  let options: Required<CountdownOptions>;
  let onDoneCallback: (() => void) | null = null;
  let animationFrameId: number | null = null;
  let lastTime = 0;

  const defaultOptions: Required<CountdownOptions> = {
    variant: "freeze",
    durationSec: 3.2,
    invulnMs: 1200,
    allowSkipAfterMs: 800,
    words: ["3", "2", "1", "GO"],
    seed: 0,
    onTick: () => {},
    onGo: () => {},
    onWarp: () => {}
  };

  const updateState = (currentTime: number) => {
    if (state.phase === "inactive" || state.phase === "done") return;

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    state.timeInPhase += deltaTime;
    state.totalTime += deltaTime;

    // Check if skip is allowed
    if (!state.canSkip && state.totalTime >= options.allowSkipAfterMs) {
      state.canSkip = true;
    }

    // Phase transitions
    if (state.phase === "countdown") {
      const timePerWord = (options.durationSec * 1000) / options.words.length;
      const targetWordIndex = Math.floor(state.totalTime / timePerWord);
      
      if (targetWordIndex !== state.wordIndex && targetWordIndex < options.words.length) {
        state.wordIndex = targetWordIndex;
        state.currentWord = options.words[state.wordIndex];
        state.timeInPhase = 0;
        
        // Play tick sound for digits
        if (state.currentWord !== "GO") {
          options.onTick();
        }
      }

      if (targetWordIndex >= options.words.length) {
        state.phase = "go";
        state.timeInPhase = 0;
        options.onGo();
        if (options.variant === "warp") {
          options.onWarp();
        }
        
        // Brief pause for GO display
        setTimeout(() => {
          state.phase = "done";
          if (onDoneCallback) onDoneCallback();
        }, 200);
      }
    }

    if (state.phase === "countdown" || state.phase === "go") {
      animationFrameId = requestAnimationFrame(updateState);
    }
  };

  const handle: IntroHandle = {
    start(opts = {}) {
      options = { ...defaultOptions, ...opts };
      
      state = {
        phase: "countdown",
        currentWord: options.words[0],
        wordIndex: 0,
        timeInPhase: 0,
        totalTime: 0,
        canSkip: false,
        variant: options.variant
      };

      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(updateState);
    },

    isActive() {
      return state.phase !== "inactive" && state.phase !== "done";
    },

    isDone() {
      return state.phase === "done";
    },

    getCurrentState() {
      return { ...state };
    },

    onDone(cb) {
      onDoneCallback = cb;
    },

    skip() {
      if (state.canSkip && handle.isActive()) {
        state.phase = "go";
        state.currentWord = "GO";
        state.timeInPhase = 0;
        
        setTimeout(() => {
          state.phase = "done";
          if (onDoneCallback) onDoneCallback();
        }, 200);
      }
    }
  };

  return handle;
}