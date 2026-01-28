/**
 * In-Flight Guide System
 * Progressive tip system for contextual gameplay instructions
 */

export interface TipDefinition {
  id: string;
  message: string;
  duration?: number; // ms, default 4000
}

// All available tips
export const TIPS: Record<string, TipDefinition> = {
  basic: {
    id: 'basic',
    message: 'THRUST to ascend, ROTATE to aim. Land gently on pads!',
    duration: 5000,
  },
  landing: {
    id: 'landing',
    message: 'Green pads = safe. Land at low speed with level angle.',
    duration: 4000,
  },
  junk: {
    id: 'junk',
    message: 'Collect SPACE JUNK for fuel! 3 items opens WORMHOLE.',
    duration: 4500,
  },
  shield: {
    id: 'shield',
    message: 'SHIELD protects from one crash. Bounces you to safety.',
    duration: 4000,
  },
  volcano: {
    id: 'volcano',
    message: 'VOLCANOES erupt! Avoid lava particles.',
    duration: 4000,
  },
  ufo: {
    id: 'ufo',
    message: 'UFO ALERT! Dodge projectiles or use shield.',
    duration: 4000,
  },
  timetrial: {
    id: 'timetrial',
    message: 'Land on pads IN ORDER! Timer starts at first takeoff.',
    duration: 5000,
  },
  survival: {
    id: 'survival',
    message: 'Travel as far as you can! Land on pads to refuel.',
    duration: 5000,
  },
  blackout: {
    id: 'blackout',
    message: 'BLACKOUT! Use your spotlight to navigate.',
    duration: 4000,
  },
  storm: {
    id: 'storm',
    message: 'LIGHTNING STORM! Watch for strikes.',
    duration: 4000,
  },
  comet: {
    id: 'comet',
    message: 'COMET! Catch it for bonus points.',
    duration: 3500,
  },
};

const STORAGE_PREFIX = 'll-guide-';

/**
 * Check if in-flight tips are enabled
 */
export function isGuideEnabled(): boolean {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}enabled`);
    // Default to true for new players
    return saved === null ? true : JSON.parse(saved);
  } catch {
    return true;
  }
}

/**
 * Set the guide enabled state
 */
export function setGuideEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}enabled`, JSON.stringify(enabled));
  } catch {}
}

/**
 * Check if a specific tip has been shown
 */
export function hasTipBeenShown(tipId: string): boolean {
  try {
    const key = `${STORAGE_PREFIX}${tipId}-shown`;
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark a tip as shown
 */
export function markTipAsShown(tipId: string): void {
  try {
    const key = `${STORAGE_PREFIX}${tipId}-shown`;
    localStorage.setItem(key, 'true');
  } catch {}
}

/**
 * Reset all tip shown flags (for testing or new player experience)
 */
export function resetAllTips(): void {
  try {
    Object.keys(TIPS).forEach(tipId => {
      localStorage.removeItem(`${STORAGE_PREFIX}${tipId}-shown`);
    });
  } catch {}
}

/**
 * Get a tip if it should be shown (enabled and not previously shown)
 */
export function getTipIfNeeded(tipId: string): TipDefinition | null {
  if (!isGuideEnabled()) return null;
  if (hasTipBeenShown(tipId)) return null;
  return TIPS[tipId] || null;
}

/**
 * Show a tip and mark it as shown
 * Returns the tip definition if it should be shown, null otherwise
 */
export function showTip(tipId: string): TipDefinition | null {
  const tip = getTipIfNeeded(tipId);
  if (tip) {
    markTipAsShown(tipId);
    return tip;
  }
  return null;
}
