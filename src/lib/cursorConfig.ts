export interface CursorConfig {
  autoHide: boolean;
  idleMs: number;
  showOnUI: boolean;
  usePointerLock: "off" | "on" | "desktop";
  pointerLockHint: boolean;
}

export const DEFAULT_CURSOR_CONFIG: CursorConfig = {
  autoHide: true,
  idleMs: 1500,
  showOnUI: true,
  usePointerLock: "desktop",
  pointerLockHint: true,
};

const CURSOR_CONFIG_KEY = 'cursor-config';

export function loadCursorConfig(): CursorConfig {
  try {
    const stored = localStorage.getItem(CURSOR_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CURSOR_CONFIG, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load cursor config:', error);
  }
  return DEFAULT_CURSOR_CONFIG;
}

export function saveCursorConfig(config: CursorConfig): void {
  try {
    localStorage.setItem(CURSOR_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn('Failed to save cursor config:', error);
  }
}

export function isDesktop(): boolean {
  return !(/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
}

export function hasPointerLock(): boolean {
  return 'requestPointerLock' in Element.prototype;
}