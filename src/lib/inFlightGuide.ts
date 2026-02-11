/**
 * In-Flight Guide System
 * Progressive tip system for contextual gameplay instructions
 */

export interface TipDefinition {
  id: string;
  message: string;
  duration?: number; // ms, default 4000
}

// All available tips (durations increased by 2s for better readability)
export const TIPS: Record<string, TipDefinition> = {
  basic: {
    id: 'basic',
    message: 'THRUST to ascend, ROTATE to aim. Land gently on pads!',
    duration: 7000,
  },
  landing: {
    id: 'landing',
    message: 'Land on the glowing pads. 2x gives double points',
    duration: 6000,
  },
  junk: {
    id: 'junk',
    message: 'Collect SPACE JUNK for fuel, getting it all awards shield!',
    duration: 6500,
  },
  shield: {
    id: 'shield',
    message: 'SHIELDS can take one hit and bounce you to safety.',
    duration: 6000,
  },
  volcano: {
    id: 'volcano',
    message: 'VOLCANOES erupt! Avoid lava particles.',
    duration: 6000,
  },
  ufo: {
    id: 'ufo',
    message: 'UFO ALERT! Dodge projectiles or use shield.',
    duration: 6000,
  },
  timetrial: {
    id: 'timetrial',
    message: 'Land on pads IN ORDER!',
    duration: 5000,
  },
  survival: {
    id: 'survival',
    message: 'Travel as far as you can! Land on pads to refuel.',
    duration: 7000,
  },
  blackout: {
    id: 'blackout',
    message: 'BLACKOUT! Use your spotlight to navigate.',
    duration: 6000,
  },
  storm: {
    id: 'storm',
    message: 'LIGHTNING STORM! Watch for strikes.',
    duration: 6000,
  },
  comet: {
    id: 'comet',
    message: 'COMET! Land when active for bonus points.',
    duration: 5500,
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

/**
 * Show a tip every time if guide is enabled (ignores shown state)
 * Use this for tips that should appear on every level/mode start
 */
export function showTipAlways(tipId: string): TipDefinition | null {
  if (!isGuideEnabled()) return null;
  return TIPS[tipId] || null;
}
