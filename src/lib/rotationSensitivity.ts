// Rotation sensitivity setting (0.5 to 2.0, default 1.0)
const STORAGE_KEY = 'll-rotation-sensitivity';
const DEFAULT = 1.0;
const MIN = 0.5;
const MAX = 2.0;

export function loadRotationSensitivity(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= MIN && val <= MAX) return val;
    }
  } catch {}
  return DEFAULT;
}

export function saveRotationSensitivity(value: number): void {
  try {
    const clamped = Math.max(MIN, Math.min(MAX, value));
    localStorage.setItem(STORAGE_KEY, clamped.toString());
  } catch {}
}

export function resetRotationSensitivity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export const ROTATION_SENSITIVITY_MIN = MIN;
export const ROTATION_SENSITIVITY_MAX = MAX;
export const ROTATION_SENSITIVITY_DEFAULT = DEFAULT;
