import { CursorConfig, isDesktop, hasPointerLock } from './cursorConfig';

export class CursorManager {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isGameplayFn: (() => boolean) | null = null;
  private config: CursorConfig;
  private idleTimer: number | null = null;
  private isAttached = false;
  private pointerLockHintShown = false;
  private listeners: Array<() => void> = [];
  private scope: 'container' | 'global' = 'container';
  private forceHidden = false;
  constructor(config: CursorConfig) {
    this.config = config;
    this.loadPointerLockHintState();
  }

  updateConfig(config: CursorConfig): void {
    this.config = config;
  }

  attach(containerEl: HTMLElement, isGameplayFn: () => boolean, scope: 'container' | 'global' = 'container'): void {
    if (this.isAttached) {
      this.detach();
    }

    this.container = containerEl;
    this.canvas = containerEl.querySelector('canvas');
    this.isGameplayFn = isGameplayFn;
    this.scope = scope;
    this.isAttached = true;

    this.setupEventListeners();
    this.applyInitialVisibility();
  }

  detach(): void {
    if (!this.isAttached) return;

    this.showCursor();
    this.clearIdleTimer();
    this.removeEventListeners();
    
    // Exit pointer lock if active
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

    this.container = null;
    this.canvas = null;
    this.isGameplayFn = null;
    this.isAttached = false;
  }

  forceShowCursor(): void {
    this.forceHidden = false;
    this.showCursor();
    this.clearIdleTimer();
  }

  forceHideCursor(): void {
    this.forceHidden = true;
    this.hideCursor();
    this.clearIdleTimer();
  }

  private setupEventListeners(): void {
    if (!this.container) return;

    const mouseMoveHandler = () => {
      this.forceHidden = false;
      this.showCursor();
      this.scheduleHide();
    };

    const mouseEnterHandler = () => {
      this.showCursor();
    };

    const mouseLeaveHandler = () => {
      this.showCursor();
    };

    const windowBlurHandler = () => {
      this.showCursor();
    };

    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
    };

    const clickHandler = () => {
      if (this.shouldUsePointerLock() && this.isGameplayFn?.()) {
        this.requestPointerLock();
      }
    };

    const pointerLockChangeHandler = () => {
      if (document.pointerLockElement !== this.canvas) {
        this.showCursor();
      }
    };

    this.container.addEventListener('mousemove', mouseMoveHandler);
    this.container.addEventListener('mouseenter', mouseEnterHandler);
    this.container.addEventListener('mouseleave', mouseLeaveHandler);
    window.addEventListener('blur', windowBlurHandler);
    document.addEventListener('keydown', keyDownHandler);
    
    if (this.canvas && this.shouldUsePointerLock()) {
      this.canvas.addEventListener('mousedown', clickHandler);
      document.addEventListener('pointerlockchange', pointerLockChangeHandler);
    }

    // Store cleanup functions
    this.listeners = [
      () => this.container?.removeEventListener('mousemove', mouseMoveHandler),
      () => this.container?.removeEventListener('mouseenter', mouseEnterHandler),
      () => this.container?.removeEventListener('mouseleave', mouseLeaveHandler),
      () => window.removeEventListener('blur', windowBlurHandler),
      () => document.removeEventListener('keydown', keyDownHandler),
      () => this.canvas?.removeEventListener('mousedown', clickHandler),
      () => document.removeEventListener('pointerlockchange', pointerLockChangeHandler),
    ];
  }

  private removeEventListeners(): void {
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];
  }

  private showCursor(): void {
    const el = this.scope === 'global' ? document.documentElement : this.container;
    if (el && !this.forceHidden) {
      el.classList.remove('hide-cursor');
    }
  }

  private hideCursor(): void {
    const el = this.scope === 'global' ? document.documentElement : this.container;
    if (!el) return;
    if (this.forceHidden || (this.config.autoHide && this.isGameplayFn?.())) {
      el.classList.add('hide-cursor');
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleHide(): void {
    this.clearIdleTimer();
    
    if (!this.config.autoHide || !this.isGameplayFn?.()) {
      return;
    }

    this.idleTimer = window.setTimeout(() => {
      if (this.isGameplayFn?.()) {
        this.hideCursor();
      }
    }, this.config.idleMs);
  }

  private applyInitialVisibility(): void {
    // Start hidden until the user moves the mouse, regardless of gameplay state
    this.forceHidden = true;
    this.hideCursor();
  }

  private shouldUsePointerLock(): boolean {
    if (this.config.usePointerLock === 'off') return false;
    if (this.config.usePointerLock === 'desktop' && !isDesktop()) return false;
    return hasPointerLock();
  }

  private requestPointerLock(): void {
    if (!this.canvas || !this.shouldUsePointerLock()) return;
    
    try {
      this.canvas.requestPointerLock();
      this.showPointerLockHint();
    } catch (error) {
      console.warn('Failed to request pointer lock:', error);
    }
  }

  private showPointerLockHint(): void {
    if (!this.config.pointerLockHint || this.pointerLockHintShown || !isDesktop()) {
      return;
    }

    const hint = document.createElement('div');
    hint.className = 'fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg px-4 py-2 text-sm text-foreground z-50 animate-fade-in pointer-events-none';
    hint.textContent = 'Click to lock cursor. Press Esc to release.';
    
    document.body.appendChild(hint);
    
    setTimeout(() => {
      hint.remove();
    }, 3000);

    this.pointerLockHintShown = true;
    this.savePointerLockHintState();
  }

  private loadPointerLockHintState(): void {
    try {
      this.pointerLockHintShown = localStorage.getItem('pointer-lock-hint-shown') === 'true';
    } catch (error) {
      console.warn('Failed to load pointer lock hint state:', error);
    }
  }

  private savePointerLockHintState(): void {
    try {
      localStorage.setItem('pointer-lock-hint-shown', 'true');
    } catch (error) {
      console.warn('Failed to save pointer lock hint state:', error);
    }
  }
}