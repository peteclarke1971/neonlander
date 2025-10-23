// Ghost recording and playback system for both Neon Docking and Lunar Lander
export interface NeonDockingGhostFrame {
  timestamp: number;
  r: number;
  theta: number;
  angle: number;
  thrust: boolean;
}

export interface LunarLanderGhostFrame {
  timestamp: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  thrust: boolean;
  fuel: number;
}

export type GhostFrame = NeonDockingGhostFrame | LunarLanderGhostFrame;

export interface GhostRecording {
  frames: GhostFrame[];
  completionTime: number;
  level: number;
  date: number;
  gameType: "neon-docking" | "lunar-lander";
  initials?: string;
}

export interface NeonDockingGhostState {
  r: number;
  theta: number;
  angle: number;
  thrust: boolean;
  visible: boolean;
}

export interface LunarLanderGhostState {
  x: number;
  y: number;
  angle: number;
  thrust: boolean;
  visible: boolean;
}

export type GhostState = NeonDockingGhostState | LunarLanderGhostState;

export class GhostManager {
  // Save a new ghost recording for Neon Docking
  saveNeonDockingGhost(level: number, frames: NeonDockingGhostFrame[], completionTime: number): void {
    const recording: GhostRecording = {
      frames,
      completionTime,
      level,
      date: Date.now(),
      gameType: "neon-docking"
    };
    
    try {
      const key = `neon-docking-ghost-level-${level}`;
      localStorage.setItem(key, JSON.stringify(recording));
    } catch (error) {
      console.warn('Failed to save neon docking ghost recording:', error);
    }
  }

  // Save a new ghost recording for Lunar Lander
  saveLunarLanderGhost(difficulty: string, level: number, frames: LunarLanderGhostFrame[], completionTime: number): void {
    const recording: GhostRecording = {
      frames,
      completionTime,
      level,
      date: Date.now(),
      gameType: "lunar-lander"
    };
    
    try {
      const key = `lunar-lander-ghost-${difficulty}-level-${level}-fixed`;
      localStorage.setItem(key, JSON.stringify(recording));
    } catch (error) {
      console.warn('Failed to save lunar lander ghost recording:', error);
    }
  }
  
  // Load ghost recording for Neon Docking
  loadNeonDockingGhost(level: number): GhostRecording | null {
    try {
      const key = `neon-docking-ghost-level-${level}`;
      const data = localStorage.getItem(key);
      if (!data) return null;
      
      const recording = JSON.parse(data) as GhostRecording;
      
      // Validate the recording structure
      if (!recording.frames || !Array.isArray(recording.frames) || 
          typeof recording.completionTime !== 'number') {
        return null;
      }
      
      return recording;
    } catch (error) {
      console.warn('Failed to load neon docking ghost recording:', error);
      return null;
    }
  }

  // Load ghost recording for Lunar Lander
  loadLunarLanderGhost(difficulty: string, level: number): GhostRecording | null {
    try {
      const key = `lunar-lander-ghost-${difficulty}-level-${level}-fixed`;
      const data = localStorage.getItem(key);
      if (!data) return null;
      
      const recording = JSON.parse(data) as GhostRecording;
      
      // Validate the recording structure
      if (!recording.frames || !Array.isArray(recording.frames) || 
          typeof recording.completionTime !== 'number') {
        return null;
      }
      
      return recording;
    } catch (error) {
      console.warn('Failed to load lunar lander ghost recording:', error);
      return null;
    }
  }
  
  // Get best time for Neon Docking level
  getNeonDockingBestTime(level: number): number | null {
    const ghost = this.loadNeonDockingGhost(level);
    return ghost ? ghost.completionTime : null;
  }

  // Get best time for Lunar Lander level
  getLunarLanderBestTime(difficulty: string, level: number): number | null {
    const ghost = this.loadLunarLanderGhost(difficulty, level);
    return ghost ? ghost.completionTime : null;
  }
  
  // Check if Neon Docking ghost exists
  hasNeonDockingGhost(level: number): boolean {
    return this.getNeonDockingBestTime(level) !== null;
  }

  // Check if Lunar Lander ghost exists
  hasLunarLanderGhost(difficulty: string, level: number): boolean {
    return this.getLunarLanderBestTime(difficulty, level) !== null;
  }
  
  // Get Neon Docking ghost state at given time
  getNeonDockingGhostState(level: number, gameTime: number): NeonDockingGhostState | null {
    const recording = this.loadNeonDockingGhost(level);
    if (!recording || recording.frames.length === 0) return null;
    
    // If game time exceeds ghost completion time, hide ghost
    if (gameTime > recording.completionTime) {
      return { r: 0, theta: 0, angle: 0, thrust: false, visible: false };
    }
    
    const frames = recording.frames as NeonDockingGhostFrame[];
    
    // Find the two frames to interpolate between
    let prevFrame = frames[0];
    let nextFrame = frames[0];
    
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].timestamp <= gameTime && frames[i + 1].timestamp > gameTime) {
        prevFrame = frames[i];
        nextFrame = frames[i + 1];
        break;
      }
    }
    
    // If we're past the last frame, hide the ghost
    if (gameTime >= frames[frames.length - 1].timestamp) {
      return {
        r: 0,
        theta: 0,
        angle: 0,
        thrust: false,
        visible: false
      };
    }
    
    // If we're before the first frame, use the first frame
    if (gameTime <= frames[0].timestamp) {
      return {
        r: prevFrame.r,
        theta: prevFrame.theta,
        angle: prevFrame.angle,
        thrust: prevFrame.thrust,
        visible: true
      };
    }
    
    // Linear interpolation between frames
    const timeDiff = nextFrame.timestamp - prevFrame.timestamp;
    const factor = timeDiff > 0 ? (gameTime - prevFrame.timestamp) / timeDiff : 0;
    
    // Handle angle wrapping for smooth interpolation
    let angleDiff = nextFrame.angle - prevFrame.angle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Handle theta wrapping for smooth interpolation
    let thetaDiff = nextFrame.theta - prevFrame.theta;
    if (thetaDiff > Math.PI) thetaDiff -= 2 * Math.PI;
    if (thetaDiff < -Math.PI) thetaDiff += 2 * Math.PI;
    
    return {
      r: prevFrame.r + (nextFrame.r - prevFrame.r) * factor,
      theta: prevFrame.theta + thetaDiff * factor,
      angle: prevFrame.angle + angleDiff * factor,
      thrust: factor < 0.5 ? prevFrame.thrust : nextFrame.thrust,
      visible: true
    };
  }

  // Get Lunar Lander ghost state at given time
  getLunarLanderGhostState(difficulty: string, level: number, gameTime: number): LunarLanderGhostState | null {
    const recording = this.loadLunarLanderGhost(difficulty, level);
    if (!recording || recording.frames.length === 0) return null;
    
    // If game time exceeds ghost completion time, hide ghost
    if (gameTime > recording.completionTime) {
      return { x: 0, y: 0, angle: 0, thrust: false, visible: false };
    }
    
    const frames = recording.frames as LunarLanderGhostFrame[];
    
    // Find the two frames to interpolate between
    let prevFrame = frames[0];
    let nextFrame = frames[0];
    
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].timestamp <= gameTime && frames[i + 1].timestamp > gameTime) {
        prevFrame = frames[i];
        nextFrame = frames[i + 1];
        break;
      }
    }
    
    // If we're past the last frame, hide the ghost
    if (gameTime >= frames[frames.length - 1].timestamp) {
      return {
        x: 0,
        y: 0,
        angle: 0,
        thrust: false,
        visible: false
      };
    }
    
    // If we're before the first frame, use the first frame
    if (gameTime <= frames[0].timestamp) {
      return {
        x: prevFrame.x,
        y: prevFrame.y,
        angle: prevFrame.angle,
        thrust: prevFrame.thrust,
        visible: true
      };
    }
    
    // Linear interpolation between frames
    const timeDiff = nextFrame.timestamp - prevFrame.timestamp;
    const factor = timeDiff > 0 ? (gameTime - prevFrame.timestamp) / timeDiff : 0;
    
    // Handle angle wrapping for smooth interpolation
    let angleDiff = nextFrame.angle - prevFrame.angle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    return {
      x: prevFrame.x + (nextFrame.x - prevFrame.x) * factor,
      y: prevFrame.y + (nextFrame.y - prevFrame.y) * factor,
      angle: prevFrame.angle + angleDiff * factor,
      thrust: factor < 0.5 ? prevFrame.thrust : nextFrame.thrust,
      visible: true
    };
  }
  
  // Clear Neon Docking ghost
  clearNeonDockingGhost(level: number): void {
    try {
      const key = `neon-docking-ghost-level-${level}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear neon docking ghost recording:', error);
    }
  }

  // Clear Lunar Lander ghost
  clearLunarLanderGhost(difficulty: string, level: number): void {
    try {
      const key = `lunar-lander-ghost-${difficulty}-level-${level}-fixed`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear lunar lander ghost recording:', error);
    }
  }
  
  // Get available Neon Docking ghost levels
  getAvailableNeonDockingGhostLevels(): number[] {
    const levels: number[] = [];
    try {
      for (let i = 1; i <= 10; i++) {
        if (this.hasNeonDockingGhost(i)) {
          levels.push(i);
        }
      }
    } catch (error) {
      console.warn('Failed to get available neon docking ghost levels:', error);
    }
    return levels;
  }

  // Get available Lunar Lander ghost levels
  getAvailableLunarLanderGhostLevels(difficulty: string): number[] {
    const levels: number[] = [];
    try {
      for (let i = 1; i <= 100; i++) {
        if (this.hasLunarLanderGhost(difficulty, i)) {
          levels.push(i);
        }
      }
    } catch (error) {
      console.warn('Failed to get available lunar lander ghost levels:', error);
    }
    return levels;
  }

  // Legacy methods for backward compatibility
  saveGhost(level: number, frames: NeonDockingGhostFrame[], completionTime: number): void {
    this.saveNeonDockingGhost(level, frames, completionTime);
  }

  loadGhost(level: number): GhostRecording | null {
    return this.loadNeonDockingGhost(level);
  }

  getBestTime(level: number): number | null {
    return this.getNeonDockingBestTime(level);
  }

  hasGhost(level: number): boolean {
    return this.hasNeonDockingGhost(level);
  }

  getGhostState(level: number, gameTime: number): NeonDockingGhostState | null {
    return this.getNeonDockingGhostState(level, gameTime);
  }

  clearGhost(level: number): void {
    this.clearNeonDockingGhost(level);
  }

  getAvailableGhostLevels(): number[] {
    return this.getAvailableNeonDockingGhostLevels();
  }

  // ============= Global Ghost System =============

  /**
   * Check if local time beats global record and upload if so
   */
  async checkAndUploadGlobalGhost(
    difficulty: 'easy' | 'hard',
    level: number,
    completionTime: number,
    frames: LunarLanderGhostFrame[],
    initials: string
  ): Promise<{ uploaded: boolean; wasRecord: boolean; error?: string }> {
    try {
      console.log('📊 checkAndUploadGlobalGhost called', { difficulty, level, completionTime, initials, framesCount: frames.length });
      
      const { checkGlobalRecord, submitGlobalGhost } = await import('@/lib/leaderboard');
      console.log('✅ Leaderboard functions imported');
      
      const { isRecord, error: checkError } = await checkGlobalRecord(level, difficulty, completionTime);
      console.log('📊 Check global record result:', { isRecord, checkError });
      
      if (checkError) {
        console.error('❌ checkGlobalRecord error:', checkError);
        return { uploaded: false, wasRecord: false, error: checkError };
      }
      
      if (!isRecord) {
        console.log('ℹ️ Not a global record (existing time is faster)');
        return { uploaded: false, wasRecord: false };
      }
      
      console.log('🎯 This IS a global record! Preparing to upload...');
      
      const recording: GhostRecording = {
        frames,
        completionTime,
        level,
        date: Date.now(),
        gameType: "lunar-lander"
      };
      
      console.log('📦 Ghost recording prepared:', {
        framesCount: frames.length,
        completionTime,
        level,
        dataSize: JSON.stringify(recording).length
      });
      
      const { ok, error: submitError } = await submitGlobalGhost(
        level,
        difficulty,
        completionTime,
        recording,
        initials
      );
      
      console.log('📤 Submit result:', { ok, submitError });
      
      if (!ok) {
        console.error('❌ submitGlobalGhost error:', submitError);
        return { uploaded: false, wasRecord: true, error: submitError };
      }
      
      console.log(`🌍 New global record uploaded for level ${level}!`);
      return { uploaded: true, wasRecord: true };
    } catch (e: any) {
      console.error('💥 Exception in checkAndUploadGlobalGhost:', e);
      return { uploaded: false, wasRecord: false, error: e?.message || "Unknown error" };
    }
  }

  /**
   * Load global ghost recording (for playback)
   */
  async loadGlobalGhost(
    difficulty: 'easy' | 'hard',
    level: number
  ): Promise<GhostRecording | null> {
    try {
      const { fetchGlobalGhost } = await import('@/lib/leaderboard');
      const { record, error } = await fetchGlobalGhost(level, difficulty);
      
      if (error) {
        console.error('Error loading global ghost:', error);
        return null;
      }
      
      if (!record) {
        return null;
      }
      
      return record.ghost_data as GhostRecording;
    } catch (e: any) {
      console.error('Error loading global ghost:', e);
      return null;
    }
  }

  /**
   * Get global ghost state at given time (for rendering during gameplay)
   */
  getGlobalGhostState(recording: GhostRecording | null, gameTime: number): LunarLanderGhostState | null {
    if (!recording || recording.frames.length === 0) return null;
    
    if (gameTime > recording.completionTime) {
      return { x: 0, y: 0, angle: 0, thrust: false, visible: false };
    }
    
    const frames = recording.frames as LunarLanderGhostFrame[];
    
    let prevFrame = frames[0];
    let nextFrame = frames[0];
    
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].timestamp <= gameTime && frames[i + 1].timestamp > gameTime) {
        prevFrame = frames[i];
        nextFrame = frames[i + 1];
        break;
      }
    }
    
    if (gameTime >= frames[frames.length - 1].timestamp) {
      return { x: 0, y: 0, angle: 0, thrust: false, visible: false };
    }
    
    if (gameTime <= frames[0].timestamp) {
      return {
        x: prevFrame.x,
        y: prevFrame.y,
        angle: prevFrame.angle,
        thrust: prevFrame.thrust,
        visible: true
      };
    }
    
    const timeDiff = nextFrame.timestamp - prevFrame.timestamp;
    const factor = timeDiff > 0 ? (gameTime - prevFrame.timestamp) / timeDiff : 0;
    
    let angleDiff = nextFrame.angle - prevFrame.angle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    return {
      x: prevFrame.x + (nextFrame.x - prevFrame.x) * factor,
      y: prevFrame.y + (nextFrame.y - prevFrame.y) * factor,
      angle: prevFrame.angle + angleDiff * factor,
      thrust: factor < 0.5 ? prevFrame.thrust : nextFrame.thrust,
      visible: true
    };
  }

  // ============= Time Trial Ghost System =============

  /**
   * Save a Time Trial ghost recording
   */
  saveTimeTrialGhost(difficulty: string, level: number, frames: LunarLanderGhostFrame[], completionTime: number): void {
    const recording: GhostRecording = {
      frames,
      completionTime,
      level,
      date: Date.now(),
      gameType: "lunar-lander"
    };
    
    try {
      const key = `time-trial-ghost-${difficulty}-level-${level}`;
      localStorage.setItem(key, JSON.stringify(recording));
    } catch (error) {
      console.warn('Failed to save time trial ghost recording:', error);
    }
  }

  /**
   * Load Time Trial ghost recording
   */
  loadTimeTrialGhost(difficulty: string, level: number): GhostRecording | null {
    try {
      const key = `time-trial-ghost-${difficulty}-level-${level}`;
      const data = localStorage.getItem(key);
      if (!data) return null;
      
      const recording = JSON.parse(data) as GhostRecording;
      
      if (!recording.frames || !Array.isArray(recording.frames) || 
          typeof recording.completionTime !== 'number') {
        return null;
      }
      
      return recording;
    } catch (error) {
      console.warn('Failed to load time trial ghost recording:', error);
      return null;
    }
  }

  /**
   * Get best time for Time Trial level
   */
  getTimeTrialBestTime(difficulty: string, level: number): number | null {
    const ghost = this.loadTimeTrialGhost(difficulty, level);
    return ghost ? ghost.completionTime : null;
  }

  /**
   * Check if Time Trial ghost exists
   */
  hasTimeTrialGhost(difficulty: string, level: number): boolean {
    return this.getTimeTrialBestTime(difficulty, level) !== null;
  }

  /**
   * Get Time Trial ghost state at given time
   */
  getTimeTrialGhostState(difficulty: string, level: number, gameTime: number): LunarLanderGhostState | null {
    const recording = this.loadTimeTrialGhost(difficulty, level);
    if (!recording || recording.frames.length === 0) return null;
    
    if (gameTime > recording.completionTime) {
      return { x: 0, y: 0, angle: 0, thrust: false, visible: false };
    }
    
    const frames = recording.frames as LunarLanderGhostFrame[];
    
    let prevFrame = frames[0];
    let nextFrame = frames[0];
    
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].timestamp <= gameTime && frames[i + 1].timestamp > gameTime) {
        prevFrame = frames[i];
        nextFrame = frames[i + 1];
        break;
      }
    }
    
    if (gameTime >= frames[frames.length - 1].timestamp) {
      return { x: 0, y: 0, angle: 0, thrust: false, visible: false };
    }
    
    if (gameTime <= frames[0].timestamp) {
      return {
        x: prevFrame.x,
        y: prevFrame.y,
        angle: prevFrame.angle,
        thrust: prevFrame.thrust,
        visible: true
      };
    }
    
    const timeDiff = nextFrame.timestamp - prevFrame.timestamp;
    const factor = timeDiff > 0 ? (gameTime - prevFrame.timestamp) / timeDiff : 0;
    
    let angleDiff = nextFrame.angle - prevFrame.angle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    return {
      x: prevFrame.x + (nextFrame.x - prevFrame.x) * factor,
      y: prevFrame.y + (nextFrame.y - prevFrame.y) * factor,
      angle: prevFrame.angle + angleDiff * factor,
      thrust: factor < 0.5 ? prevFrame.thrust : nextFrame.thrust,
      visible: true
    };
  }

  /**
   * Clear Time Trial ghost
   */
  clearTimeTrialGhost(difficulty: string, level: number): void {
    try {
      const key = `time-trial-ghost-${difficulty}-level-${level}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear time trial ghost recording:', error);
    }
  }

  /**
   * Update initials for an existing Time Trial ghost
   */
  updateTimeTrialGhostInitials(difficulty: string, level: number, initials: string): void {
    try {
      const key = `time-trial-ghost-${difficulty}-level-${level}`;
      console.log('🔍 Attempting to update ghost initials:', { difficulty, level, initials, key });
      
      const recording = this.loadTimeTrialGhost(difficulty, level);
      if (!recording) {
        console.error('❌ No ghost found to update initials for:', { difficulty, level, key });
        return;
      }
      
      console.log('📝 Ghost found, updating initials:', { 
        oldInitials: recording.initials, 
        newInitials: initials,
        completionTime: recording.completionTime 
      });
      
      recording.initials = initials.toUpperCase().slice(0, 3);
      localStorage.setItem(key, JSON.stringify(recording));
      
      // Verify the save
      const verification = localStorage.getItem(key);
      const parsed = verification ? JSON.parse(verification) : null;
      console.log('✅ Ghost initials updated and verified:', { 
        difficulty, 
        level, 
        initials: recording.initials,
        verifiedInitials: parsed?.initials,
        saveSuccessful: parsed?.initials === recording.initials
      });
    } catch (error) {
      console.error('❌ Failed to update ghost initials:', error);
    }
  }
}