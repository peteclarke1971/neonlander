/**
 * Performance Management System
 * Monitors FPS and automatically adjusts visual quality for 60+ FPS
 */

export interface PerformanceSettings {
  shadowBlur: number;
  particleCount: number;
  maxVolcanoParticles: number;
  backgroundStars: number;
  enableBackgroundSats: boolean;
  updateFrequency: number; // Hz for non-critical updates
  viewportCulling: boolean;
}

export class PerformanceManager {
  private frameTimeAccumulator = 0;
  private lastPerformanceCheck = 0;
  private frameCount = 0;
  private currentFPS = 60;
  private performanceGoverned = false;
  private isMobile: boolean;
  
  // Performance tiers
  private readonly HIGH_PERFORMANCE: PerformanceSettings = {
    shadowBlur: 16,
    particleCount: 50,
    maxVolcanoParticles: 50,
    backgroundStars: 320,
    enableBackgroundSats: true,
    updateFrequency: 60,
    viewportCulling: true
  };
  
  private readonly MEDIUM_PERFORMANCE: PerformanceSettings = {
    shadowBlur: 8,
    particleCount: 30,
    maxVolcanoParticles: 30,
    backgroundStars: 200,
    enableBackgroundSats: true,
    updateFrequency: 30,
    viewportCulling: true
  };
  
  private readonly LOW_PERFORMANCE: PerformanceSettings = {
    shadowBlur: 4,
    particleCount: 15,
    maxVolcanoParticles: 15,
    backgroundStars: 100,
    enableBackgroundSats: false,
    updateFrequency: 20,
    viewportCulling: true
  };
  
  constructor() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  update(dt: number): { fps: number; settings: PerformanceSettings } {
    const currentTime = Date.now();
    
    this.frameTimeAccumulator += dt;
    this.frameCount++;
    
    // Check performance every second
    if (currentTime - this.lastPerformanceCheck > 1000) {
      const avgFrameTime = this.frameTimeAccumulator / this.frameCount;
      this.currentFPS = avgFrameTime > 0 ? 1 / avgFrameTime : 60;
      
      // Update performance tier
      this.performanceGoverned = this.currentFPS < 45;
      
      this.frameTimeAccumulator = 0;
      this.frameCount = 0;
      this.lastPerformanceCheck = currentTime;
    }
    
    return {
      fps: Math.round(this.currentFPS),
      settings: this.getCurrentSettings()
    };
  }
  
  private getCurrentSettings(): PerformanceSettings {
    if (this.performanceGoverned || this.currentFPS < 45) {
      return this.LOW_PERFORMANCE;
    } else if (this.isMobile || this.currentFPS < 55) {
      return this.MEDIUM_PERFORMANCE;
    } else {
      return this.HIGH_PERFORMANCE;
    }
  }
  
  shouldCull(objectX: number, cameraX: number, viewWidth: number, worldWidth: number): boolean {
    const dx = Math.abs(objectX - cameraX);
    const wrappedDx = Math.min(dx, worldWidth - dx);
    return wrappedDx > viewWidth / 2 + 100; // 100px margin
  }
  
  shouldUpdate(lastUpdate: number, frequency: number): boolean {
    return Date.now() - lastUpdate > 1000 / frequency;
  }
}