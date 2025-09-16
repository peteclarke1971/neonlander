// Ghost recording and playback system for Neon Docking levels
export interface GhostFrame {
  timestamp: number;
  r: number;
  theta: number;
  angle: number;
  thrust: boolean;
}

export interface GhostRecording {
  frames: GhostFrame[];
  completionTime: number;
  level: number;
  date: number;
}

export interface GhostState {
  r: number;
  theta: number;
  angle: number;
  thrust: boolean;
  visible: boolean;
}

export class GhostManager {
  private storagePrefix = "neon-docking-ghost-level-";
  
  // Save a new ghost recording for a level
  saveGhost(level: number, frames: GhostFrame[], completionTime: number): void {
    const recording: GhostRecording = {
      frames,
      completionTime,
      level,
      date: Date.now()
    };
    
    try {
      const key = `${this.storagePrefix}${level}`;
      localStorage.setItem(key, JSON.stringify(recording));
    } catch (error) {
      console.warn('Failed to save ghost recording:', error);
    }
  }
  
  // Load ghost recording for a level
  loadGhost(level: number): GhostRecording | null {
    try {
      const key = `${this.storagePrefix}${level}`;
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
      console.warn('Failed to load ghost recording:', error);
      return null;
    }
  }
  
  // Get best time for a level (if ghost exists)
  getBestTime(level: number): number | null {
    const ghost = this.loadGhost(level);
    return ghost ? ghost.completionTime : null;
  }
  
  // Check if ghost exists for a level
  hasGhost(level: number): boolean {
    return this.getBestTime(level) !== null;
  }
  
  // Interpolate ghost state at a given time
  getGhostState(level: number, gameTime: number): GhostState | null {
    const recording = this.loadGhost(level);
    if (!recording || recording.frames.length === 0) return null;
    
    // If game time exceeds ghost completion time, hide ghost
    if (gameTime > recording.completionTime) {
      return { r: 0, theta: 0, angle: 0, thrust: false, visible: false };
    }
    
    const frames = recording.frames;
    
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
    
    // If we're past the last frame, use the last frame
    if (gameTime >= frames[frames.length - 1].timestamp) {
      const lastFrame = frames[frames.length - 1];
      return {
        r: lastFrame.r,
        theta: lastFrame.theta,
        angle: lastFrame.angle,
        thrust: lastFrame.thrust,
        visible: true
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
  
  // Clear ghost for a level
  clearGhost(level: number): void {
    try {
      const key = `${this.storagePrefix}${level}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear ghost recording:', error);
    }
  }
  
  // Get all available ghost levels
  getAvailableGhostLevels(): number[] {
    const levels: number[] = [];
    try {
      for (let i = 1; i <= 10; i++) {
        if (this.hasGhost(i)) {
          levels.push(i);
        }
      }
    } catch (error) {
      console.warn('Failed to get available ghost levels:', error);
    }
    return levels;
  }
}