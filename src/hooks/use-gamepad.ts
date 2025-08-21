// Lightweight gamepad utilities with hot-swap, normalization and persistence
// NOTE: This is intentionally framework-agnostic so it can be used in pages/components

export type GamepadPlatform = "xbox" | "playstation" | "nintendo" | "generic";

export type ControlProfile = {
  deadzone: number; // 0.05 - 0.25
  invertRotation: boolean;
  invertThrust: boolean;
  vibration: boolean;
  // Simple remaps (buttons and axes indices)
  map: {
    rotateLeftBtn?: number; // LB default 4
    rotateRightBtn?: number; // RB default 5
    thrustBtn?: number; // A / Cross default 0
    thrustAxis?: number; // RT default 7 (standard mapping)
    rotationAxis?: number; // LS-X default 0
    abortBtn?: number; // Y / Triangle default 3
    pauseBtn?: number; // Start/Options default 9
    dpadUp?: number; // 12
    dpadDown?: number; // 13
    dpadLeft?: number; // 14
    dpadRight?: number; // 15
  };
};

export type NormalizedInput = {
  thrust: number; // 0..1
  rotation: number; // -1..1
  buttons: { abort: boolean; pause: boolean; rotateLeft: boolean; rotateRight: boolean };
  ui: { up: boolean; down: boolean; left: boolean; right: boolean; select: boolean; back: boolean };
};

const DEFAULT_PROFILE: ControlProfile = {
  deadzone: 0.12,
  invertRotation: false,
  invertThrust: false,
  vibration: true,
  map: {
    rotateLeftBtn: 4,
    rotateRightBtn: 5,
    thrustBtn: 1,
    thrustAxis: 7,
    rotationAxis: 0,
    abortBtn: 3,
    pauseBtn: 9,
    dpadUp: 12,
    dpadDown: 13,
    dpadLeft: 14,
    dpadRight: 15,
  },
};

const STORAGE_KEY_PREFIX = "ll-gp-profile-";
const LAST_DEVICE_KEY = "ll-gp-last-device";

export const getPlatformFromId = (id: string): GamepadPlatform => {
  const s = id.toLowerCase();
  if (s.includes("xbox") || s.includes("xinput")) return "xbox";
  if (s.includes("playstation") || s.includes("dualshock") || s.includes("dualsense") || s.includes("ps")) return "playstation";
  if (s.includes("nintendo") || s.includes("switch") || s.includes("pro controller")) return "nintendo";
  return "generic";
};

export const loadProfile = (deviceId: string | null | undefined): ControlProfile => {
  if (!deviceId) return { ...DEFAULT_PROFILE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + deviceId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PROFILE,
        ...parsed,
        map: { ...DEFAULT_PROFILE.map, ...(parsed.map || {}) },
      } as ControlProfile;
    }
  } catch {}
  return { ...DEFAULT_PROFILE };
};

export const saveProfile = (deviceId: string | null | undefined, profile: ControlProfile) => {
  if (!deviceId) return;
  try { localStorage.setItem(STORAGE_KEY_PREFIX + deviceId, JSON.stringify(profile)); } catch {}
};

export const setLastDeviceId = (id: string) => { try { localStorage.setItem(LAST_DEVICE_KEY, id); } catch {} };
export const getLastDeviceId = (): string | null => { try { return localStorage.getItem(LAST_DEVICE_KEY); } catch { return null; } };

// Thrust gating to prevent carryover from UI "select" into gameplay
let __thrustGate = false; // when true, ignore thrust until released once
let __uiPrevSelect = false;
let __uiMode = false; // true when navigating UI screens

export const gateThrustUntilRelease = () => { __thrustGate = true; };
export const clearThrustGate = () => { __thrustGate = false; };
export const setUiMode = (on: boolean) => { __uiMode = !!on; };

// Utility: apply circular deadzone
const applyDeadzone = (v: number, dz: number) => {
  const a = Math.abs(v);
  if (a < dz) return 0;
  const t = (a - dz) / (1 - dz);
  return Math.sign(v) * t;
};

export const readGamepad = (gp: Gamepad, profile: ControlProfile): NormalizedInput => {
  const m = profile.map;
  const dz = Math.min(0.25, Math.max(0.05, profile.deadzone));

  const axis = (i: number | undefined) => (i == null ? 0 : (gp.axes[i] ?? 0));
  const btn = (i: number | undefined) => (i == null ? false : !!gp.buttons[i]?.pressed);

  // Thrust: prefer digital button if defined, else analog axis
  let rt = 0;
  let thrustBtnPressed = false;
  if (m.thrustBtn != null) {
    thrustBtnPressed = btn(m.thrustBtn);
    rt = thrustBtnPressed ? 1 : 0; // instant on/off
  } else {
    // Triggers are often 0..1, some map -1..1
    let t = axis(m.thrustAxis);
    if (t < 0) t = (t + 1) / 2; // map -1..1 to 0..1
    t = Math.min(1, Math.max(0, t));
    if (profile.invertThrust) t = 1 - t;
    // Ease-in curve (quadratic)
    t = t * t;
    rt = t;
  }

  // Rotation from LS-X
  let rx = axis(m.rotationAxis);
  rx = applyDeadzone(rx, dz);
  // Nonlinear scaling |x|^1.5
  rx = Math.sign(rx) * Math.pow(Math.abs(rx), 1.5);
  if (profile.invertRotation) rx = -rx;

  const left = btn(m.rotateLeftBtn);
  const right = btn(m.rotateRightBtn);
  const abort = btn(m.abortBtn);
  const pause = btn(m.pauseBtn);

  const UI_DZ = 0.1;
  const uiUp = btn(m.dpadUp) || (gp.axes[1] ?? 0) < -UI_DZ;
  const uiDown = btn(m.dpadDown) || (gp.axes[1] ?? 0) > UI_DZ;
  const uiLeft = btn(m.dpadLeft) || (gp.axes[0] ?? 0) < -UI_DZ;
  const uiRight = btn(m.dpadRight) || (gp.axes[0] ?? 0) > UI_DZ;
  // Use bound thrust button for UI select; fallback to A/Cross (0) if unset
  const uiSelect = btn(m.thrustBtn) || (!!gp.buttons[0]?.pressed && m.thrustBtn == null);
  const uiBack = !!gp.buttons[1]?.pressed;

  // Prevent thrust carry-over only while in UI mode
  if (__uiMode && uiSelect && !__uiPrevSelect) { __thrustGate = true; }
  __uiPrevSelect = __uiMode ? uiSelect : false;
  if (__thrustGate) {
    if (m.thrustBtn != null) {
      if (thrustBtnPressed) { rt = 0; } else { __thrustGate = false; }
    } else {
      const tAxis = axis(m.thrustAxis);
      if (Math.abs(tAxis) < 0.05) { __thrustGate = false; } else { rt = 0; }
    }
  }

  return {
    thrust: rt,
    rotation: rx,
    buttons: { abort, pause, rotateLeft: left, rotateRight: right },
    ui: { up: uiUp, down: uiDown, left: uiLeft, right: uiRight, select: uiSelect, back: uiBack },
  };
};

export const anyGamepad = (): Gamepad | null => {
  const list = navigator.getGamepads?.() || [];
  for (const gp of list) if (gp && gp.connected) return gp;
  return null;
};

export const vibrate = async (durationMs: number, weak = 0.2, strong = 0.8) => {
  try {
    const list = navigator.getGamepads?.() || [];
    for (const gp of list) {
      const act = gp && (gp as any).vibrationActuator;
      if (gp && (act?.playEffect)) {
        await act.playEffect("dual-rumble", { startDelay: 0, duration: durationMs, weakMagnitude: weak, strongMagnitude: strong });
      }
    }
  } catch {}
  // Fallback phone vibration
  try { navigator.vibrate?.(durationMs); } catch {}
};
