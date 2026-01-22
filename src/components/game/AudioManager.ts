import { audioConfigService } from '@/lib/audioConfigService';
import type { AudioConfig } from '@/lib/defaultAudioConfig';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master?: GainNode;

  // Audio configuration (loaded once at start)
  private audioConfig: AudioConfig | null = null;
  private configInitPromise: Promise<void> | null = null;

  // Global music mute state (persistent across all modes)
  private musicGloballyMuted = false;

  // Title music
  private titleGain?: GainNode;
  private titleSource?: AudioBufferSourceNode | null;
  private titleBuffer?: AudioBuffer | null;
  private title2Buffer?: AudioBuffer | null;
  private titleMuted = false;
  private currentTitleTrack: 1 | 2 = 1;

  // Thruster sample loop
  private thrusterGain?: GainNode;
  private thrusterSource?: AudioBufferSourceNode | null;
  private thrusterBuffer?: AudioBuffer | null;

  // SFX buffers and state
  private crash1Buffer?: AudioBuffer | null;
  private crash2Buffer?: AudioBuffer | null;
  private landingBuffer?: AudioBuffer | null;
  private fuelLoopBuffer?: AudioBuffer | null;
  private introTickBuffer?: AudioBuffer | null;
  private introGoBuffer?: AudioBuffer | null;
  private introWarpBuffer?: AudioBuffer | null;
  private junkPickupBuffer?: AudioBuffer | null;
  private junkSetCompleteBuffer?: AudioBuffer | null;
  private wormholeOpenBuffer?: AudioBuffer | null;
  private shieldPickupBuffer?: AudioBuffer | null;
  private shieldBreakBuffer?: AudioBuffer | null;
  private sfxGain?: GainNode;
  private fuelGain?: GainNode;
  private fuelSource?: AudioBufferSourceNode | null;
  private fuelAlarmOn = false;
  private crashToggle = false;
  
  // Landing sound tracking for fade-out
  private landingSoundSource: AudioBufferSourceNode | null = null;
  private landingSoundGain: GainNode | null = null;

  // Preloading state
  private isPreloaded = false;
  private preloadPromise?: Promise<void>;

  // Level music playlist (20 tracks)
  private musicGain?: GainNode;
  private musicSource?: AudioBufferSourceNode | null;
  private musicBuffers: (AudioBuffer | null)[] = new Array(20).fill(null);
  
  // Endless mode music (5 tracks, shuffled playlist)
  private endlessBuffers: (AudioBuffer | null)[] = new Array(5).fill(null);
  private endlessPlaylist: number[] = []; // Shuffled order of indices 0-4
  private endlessCurrentIndex = 0;
  private endlessSource?: AudioBufferSourceNode | null;
  private endlessGain?: GainNode;
  
  // Mission success music
  private missionSuccessBuffer?: AudioBuffer | null;
  private missionSuccess2Buffer?: AudioBuffer | null;
  private currentMissionSuccessTrack: 1 | 2 = 1;
  
  // Lightning sound placeholders (will be implemented later)
  private lightningBuffers: {
    rumble?: AudioBuffer | null;
    crack?: AudioBuffer | null;
    impact?: AudioBuffer | null;
  } = {};
  
  // Comet and UFO sound buffers
  private cometArrivalBuffer?: AudioBuffer | null;
  private ufoSmallBuffer?: AudioBuffer | null;
  private ufoMediumBuffer?: AudioBuffer | null;
  private ufoLargeBuffer?: AudioBuffer | null;
  
  // UFO looping sound state
  private ufoSmallSource?: AudioBufferSourceNode | null;
  private ufoMediumSource?: AudioBufferSourceNode | null;
  private ufoLargeSource?: AudioBufferSourceNode | null;
  private ufoSmallGain?: GainNode;
  private ufoMediumGain?: GainNode;
  private ufoLargeGain?: GainNode;
  private ufoSmallActive = false;
  private ufoMediumActive = false;
  private ufoLargeActive = false;
  private ufoSmallTimeout?: ReturnType<typeof setTimeout>;
  private ufoMediumTimeout?: ReturnType<typeof setTimeout>;
  private ufoLargeTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    // Load global music mute state from localStorage
    try {
      const stored = localStorage.getItem('ll-music-muted');
      this.musicGloballyMuted = stored ? JSON.parse(stored) : false;
    } catch {
      this.musicGloballyMuted = false;
    }

    // Listen for soundtrack changes to reload config
    window.addEventListener('soundtrackChanged', () => {
      this.handleSoundtrackChange();
    });
  }

  /**
   * Initialize audio configuration from cloud/defaults
   * Call once at game start to avoid per-level DB calls
   */
  async initializeConfig(): Promise<void> {
    if (this.audioConfig) return;
    if (this.configInitPromise) return this.configInitPromise;

    this.configInitPromise = (async () => {
      this.audioConfig = await audioConfigService.loadConfig();
      console.log('🔊 Audio configuration loaded');
    })();

    return this.configInitPromise;
  }

  /**
   * Handle soundtrack change - clear buffers and reload config
   */
  private async handleSoundtrackChange() {
    console.log('🔊 Soundtrack changed, reloading audio config...');
    
    // Stop all playing audio
    this.stopAllAudio();
    
    // Clear all preloaded buffers
    this.titleBuffer = null;
    this.thrusterBuffer = null;
    this.crash1Buffer = null;
    this.crash2Buffer = null;
    this.landingBuffer = null;
    this.fuelLoopBuffer = null;
    this.introTickBuffer = null;
    this.introGoBuffer = null;
    this.introWarpBuffer = null;
    this.junkPickupBuffer = null;
    this.junkSetCompleteBuffer = null;
    this.wormholeOpenBuffer = null;
    this.shieldPickupBuffer = null;
    this.shieldBreakBuffer = null;
    this.missionSuccessBuffer = null;
    this.missionSuccess2Buffer = undefined; // Reset to undefined so it reloads
    this.cometArrivalBuffer = null;
    this.ufoSmallBuffer = null;
    this.ufoMediumBuffer = null;
    this.ufoLargeBuffer = null;
    this.musicBuffers = new Array(20).fill(null);
    this.endlessBuffers = new Array(5).fill(null);
    this.endlessPlaylist = [];
    this.endlessCurrentIndex = 0;
    this.isPreloaded = false;
    this.preloadPromise = undefined;
    
    // Stop UFO sounds
    this.stopUfoSmallSound();
    this.stopUfoMediumSound();
    this.stopUfoLargeSound();
    
    // Reload config
    this.audioConfig = null;
    this.configInitPromise = null;
    await this.initializeConfig();
  }

  /**
   * Get a path from config with fallback
   */
  private getConfigPath(category: 'music' | 'sfx', key: string): string | string[] | null {
    if (!this.audioConfig) return null;
    
    if (category === 'music') {
      const config = (this.audioConfig.music as any)[key];
      return config?.path ?? null;
    } else {
      const config = (this.audioConfig.sfx as any)[key];
      return config?.path ?? null;
    }
  }

  /**
   * Get volume from config with fallback
   */
  private getConfigVolume(category: 'music' | 'sfx', key: string): number {
    if (!this.audioConfig) return 1.0;
    
    if (category === 'music') {
      const config = (this.audioConfig.music as any)[key];
      return config?.volume ?? 0.5;
    } else {
      const config = (this.audioConfig.sfx as any)[key];
      return config?.volume ?? 1.0;
    }
  }

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.ctx.destination);
    }
  }

  async resume(): Promise<void> {
    this.ensureCtx();
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        try {
          await this.ctx.resume();
        } catch (e) {
          console.warn("AudioContext resume failed:", e);
        }
      }
      // iOS sometimes needs a tiny silent buffer played to truly unlock
      if ((navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) && !this._iosUnlocked) {
        this.playUnlockBuffer();
        this._iosUnlocked = true;
      }
    }
  }

  pause() {
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend();
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    this.ensureCtx();
    if (!this.ctx) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return await this.ctx.decodeAudioData(arr);
    } catch {
      return null;
    }
  }

  // Preload critical SFX to eliminate lag - uses config paths
  async preloadSFX(): Promise<void> {
    if (this.isPreloaded || this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      // Ensure config is loaded first
      await this.initializeConfig();
      
      // Ensure context is resumed before loading
      await this.resume();
      this.ensureCtx();
      if (!this.ctx) return;

      // Get paths from config with fallbacks
      // crash is now a single file (explosion sound), landing is now an array (landing sounds)
      const crashUrl = this.getConfigPath('sfx', 'crash') as string || '/audio/landing_on_pad.mp3';
      const landingPath = this.getConfigPath('sfx', 'landing');
      const landing1Url = Array.isArray(landingPath) ? landingPath[0] : (landingPath || '/audio/crash1.mp3');
      const landing2Url = Array.isArray(landingPath) && landingPath[1] ? landingPath[1] : '/audio/crash2.mp3';
      const fuelUrl = this.getConfigPath('sfx', 'fuelAlarm') as string || '/audio/fuel_10_percent_loop.mp3';
      const thrusterUrl = this.getConfigPath('sfx', 'thruster') as string || '/audio/thruster.mp3';
      const tickUrl = this.getConfigPath('sfx', 'introTick') as string || '/audio/intro_tick.mp3';
      const goUrl = this.getConfigPath('sfx', 'introGo') as string || '/audio/intro_go.mp3';
      const warpUrl = this.getConfigPath('sfx', 'introWarp') as string || '/audio/intro_warp.mp3';
      const successUrl = this.getConfigPath('music', 'missionSuccess') as string || '/audio/mission_success.mp3';
      const junkPickupUrl = this.getConfigPath('sfx', 'junkPickup') as string || null;
      const junkSetCompleteUrl = this.getConfigPath('sfx', 'junkSetComplete') as string || null;
      const wormholeOpenUrl = this.getConfigPath('sfx', 'wormholeOpen') as string || null;
      const shieldPickupUrl = this.getConfigPath('sfx', 'shieldPickup') as string || null;
      const shieldBreakUrl = this.getConfigPath('sfx', 'shieldBreak') as string || null;

      // Load ALL critical SFX in parallel for instant playback
      // crash1Buffer now holds explosion sound, landingBuffer holds landing sounds
      const [crash, landing1, landing2, fuel, thruster, introTick, introGo, introWarp, missionSuccess, junkPickup, junkSetComplete, wormholeOpen, shieldPickup, shieldBreak] = await Promise.all([
        this.loadBuffer(crashUrl),
        this.loadBuffer(landing1Url),
        this.loadBuffer(landing2Url),
        this.loadBuffer(fuelUrl),
        this.loadBuffer(thrusterUrl),
        this.loadBuffer(tickUrl),
        this.loadBuffer(goUrl),
        this.loadBuffer(warpUrl),
        this.loadBuffer(successUrl),
        junkPickupUrl ? this.loadBuffer(junkPickupUrl) : Promise.resolve(null),
        junkSetCompleteUrl ? this.loadBuffer(junkSetCompleteUrl) : Promise.resolve(null),
        wormholeOpenUrl ? this.loadBuffer(wormholeOpenUrl) : Promise.resolve(null),
        shieldPickupUrl ? this.loadBuffer(shieldPickupUrl) : Promise.resolve(null),
        shieldBreakUrl ? this.loadBuffer(shieldBreakUrl) : Promise.resolve(null)
      ]);

      this.crash1Buffer = crash;  // Now contains explosion sound
      this.crash2Buffer = null;   // Not needed for explosions anymore
      this.landingBuffer = landing1;  // Now contains landing sound
      // landing2 available as backup if needed
      this.fuelLoopBuffer = fuel;
      this.thrusterBuffer = thruster;
      this.introTickBuffer = introTick;
      this.introGoBuffer = introGo;
      this.introWarpBuffer = introWarp;
      this.junkPickupBuffer = junkPickup;
      this.junkSetCompleteBuffer = junkSetComplete;
      this.wormholeOpenBuffer = wormholeOpen;
      this.shieldPickupBuffer = shieldPickup;
      this.shieldBreakBuffer = shieldBreak;
      this.missionSuccessBuffer = missionSuccess;
      this.isPreloaded = true;
      console.log('🔊 All sound effects preloaded and ready');
    })();

    return this.preloadPromise;
  }

  private createLoopingSource(buffer: AudioBuffer, output: AudioNode) {
    this.ensureCtx();
    if (!this.ctx) throw new Error("No AudioContext");
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(output);
    src.start(0);
    return src;
  }

  // ========== Title Music API ==========
  async playTitleMusic() {
    // Ensure config is loaded
    await this.initializeConfig();
    
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    const volume = this.getConfigVolume('music', 'title');
    
    if (!this.titleGain) {
      this.titleGain = this.ctx.createGain();
      this.titleGain.gain.value = (this.titleMuted || this.musicGloballyMuted) ? 0 : volume;
      this.titleGain.connect(this.master);
    }
    
    // Load title buffer if needed
    if (!this.titleBuffer) {
      const titleUrl = this.getConfigPath('music', 'title') as string || '/audio/title.mp3';
      this.titleBuffer = await this.loadBuffer(titleUrl);
    }
    
    // Load title2 buffer if configured (and not already loaded)
    if (this.title2Buffer === undefined) {
      const title2Url = this.getConfigPath('music', 'title2') as string | null;
      if (title2Url) {
        this.title2Buffer = await this.loadBuffer(title2Url);
      } else {
        this.title2Buffer = null;
      }
    }

    // Start playing (will cycle between tracks if title2 is configured)
    if (!this.titleSource) {
      this.playCurrentTitleTrack();
    }
  }

  private playCurrentTitleTrack() {
    if (!this.ctx || !this.titleGain) return;
    
    // Stop any existing source
    if (this.titleSource) {
      try { this.titleSource.stop(); } catch {}
      this.titleSource.disconnect();
      this.titleSource = null;
    }

    const buffer = this.currentTitleTrack === 1 ? this.titleBuffer : this.title2Buffer;
    const hasTitle2 = !!this.title2Buffer;

    if (!buffer) {
      // If no buffer for current track, try the other or give up
      if (this.currentTitleTrack === 2 && this.titleBuffer) {
        this.currentTitleTrack = 1;
        this.playCurrentTitleTrack();
      }
      return;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = !hasTitle2; // Only loop if there's no second track
    src.connect(this.titleGain);
    src.start(0);
    this.titleSource = src;

    // If we have two tracks, cycle on end
    if (hasTitle2) {
      src.onended = () => {
        if (this.titleSource === src) { // Make sure it's still our active source
          this.currentTitleTrack = this.currentTitleTrack === 1 ? 2 : 1;
          this.playCurrentTitleTrack();
        }
      };
    }
  }

  setTitleMusicMuted(muted: boolean) {
    this.ensureCtx();
    this.titleMuted = muted;
    if (!this.ctx || !this.titleGain) return;
    const now = this.ctx.currentTime;
    const volume = this.getConfigVolume('music', 'title');
    const target = muted ? 0 : volume;
    this.titleGain.gain.cancelScheduledValues(now);
    this.titleGain.gain.linearRampToValueAtTime(target, now + 0.08);
  }

  stopTitleMusic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.titleGain) {
      this.titleGain.gain.cancelScheduledValues(now);
      this.titleGain.gain.linearRampToValueAtTime(0, now + 0.1);
    }
    if (this.titleSource) {
      try { this.titleSource.stop(now + 0.12); } catch {}
      this.titleSource.disconnect();
      this.titleSource = null;
    }
    // Reset to track 1 for next playback
    this.currentTitleTrack = 1;
  }

  // ========== Thruster (sample-based, loop + gate) ==========
  private async ensureThrusterLoop() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    if (!this.thrusterGain) {
      this.thrusterGain = this.ctx.createGain();
      this.thrusterGain.gain.value = 0.0003; // tiny floor to avoid clicks
      this.thrusterGain.connect(this.master);
    }
    // DC-blocking highpass to avoid low-frequency thumps when gating
    if (!(this as any)._thrusterFilter) {
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 25;
      hp.Q.value = 0.707;
      hp.connect(this.thrusterGain);
      (this as any)._thrusterFilter = hp;
    }
    // Use preloaded buffer if available, otherwise load on demand
    if (!this.thrusterBuffer) {
      const thrusterUrl = this.getConfigPath('sfx', 'thruster') as string || '/audio/thruster.mp3';
      this.thrusterBuffer = await this.loadBuffer(thrusterUrl);
    }
    if (this.thrusterBuffer && !this.thrusterSource) {
      this.thrusterSource = this.createLoopingSource(this.thrusterBuffer, (this as any)._thrusterFilter);
    }
  }

  // level: 0..1 — we gate the looped sample by gain; smoothed to avoid popping
  async setThruster(level: number) {
    this.ensureCtx();
    if (!this.ctx) return;
    await this.ensureThrusterLoop();
    if (!this.thrusterGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const norm = Math.min(1, Math.max(0, level));
    const minFloor = 0.0003;
    const target = norm > 0 ? Math.max(minFloor, norm * 4.8) : minFloor; // doubled volume, keep tiny floor

    const g = this.thrusterGain.gain;
    const lastSet: number = (this as any)._thrusterLastSet || 0;
    const lastTarget: number = (this as any)._thrusterLastTarget ?? g.value;

    // Throttle updates and ignore tiny diffs to prevent zipper noise
    if (Math.abs(target - lastTarget) < 0.01 && now - lastSet < 0.04) return;

    // Do not cancel existing ramps; schedule an exponential glide
    const current = Math.max(minFloor, g.value || minFloor);
    g.setValueAtTime(current, now);
    if (norm <= 0.0001) {
      g.exponentialRampToValueAtTime(minFloor, now + 0.06);
    } else {
      g.exponentialRampToValueAtTime(target, now + 0.08);
    }

    (this as any)._thrusterLastSet = now;
    (this as any)._thrusterLastTarget = target;
  }

  stopThruster() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.thrusterGain) {
      this.thrusterGain.gain.cancelScheduledValues(now);
      this.thrusterGain.gain.linearRampToValueAtTime(0, now + 0.06);
    }
    if (this.thrusterSource) {
      try { this.thrusterSource.stop(now + 0.08); } catch {}
      this.thrusterSource.disconnect();
      this.thrusterSource = null;
    }
  }

  /**
   * Pre-warm the thruster buffer without starting playback.
   * Call this before demo mode to ensure smooth audio without user interaction.
   */
  async prewarmThruster(): Promise<void> {
    await this.initializeConfig();
    this.ensureCtx();
    if (!this.ctx) return;
    
    // Preload thruster buffer if not already loaded
    if (!this.thrusterBuffer) {
      const thrusterUrl = this.getConfigPath('sfx', 'thruster') as string || '/audio/thruster.mp3';
      this.thrusterBuffer = await this.loadBuffer(thrusterUrl);
      console.log('🔊 Thruster buffer pre-warmed for demo mode');
    }
  }

  private playNoise(duration = 0.25, volume = 0.5) {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  private playOneShot(buffer: AudioBuffer, volume = 0.9) {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    if (!this.sfxGain) {
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);
    }
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(this.sfxGain);
    src.start(0);
  }

  private playSpatialOneShot(buffer: AudioBuffer, volume = 0.9, pan = 0) {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    if (!this.sfxGain) {
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);
    }
    
    // Create spatial audio chain: source -> gain -> panner -> sfxGain -> master
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan)); // Clamp between -1 and 1
    
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(panner);
    panner.connect(this.sfxGain);
    src.start(0);
  }

  private playSpatialNoise(duration = 0.25, volume = 0.5, pan = 0) {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    
    src.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    src.start();
  }

  // Spatial audio for volcano eruptions
  spatialExplosion(sourceX: number, listenerX: number, worldWidth: number) {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    // Calculate distance and panning
    const dx = sourceX - listenerX;
    const distance = Math.abs(dx);
    const wrappedDistance = Math.min(distance, worldWidth - distance);
    
    // Determine which direction is shorter (for wrapping)
    const useWrappedDirection = (worldWidth - distance) < distance;
    const finalDx = useWrappedDirection ? (dx > 0 ? -(worldWidth - distance) : (worldWidth - distance)) : dx;
    
    // Pan based on direction (-1 = left, 1 = right)
    const maxPanDistance = worldWidth * 0.3; // 30% of world width for full pan
    const panValue = Math.max(-1, Math.min(1, finalDx / maxPanDistance));
    
    // Volume based on distance (closer = louder)
    const maxHearingDistance = worldWidth * 0.8; // Can hear across 80% of world width
    const distanceRatio = Math.min(1, wrappedDistance / maxHearingDistance);
    const volume = Math.max(0.1, 1 - distanceRatio * 0.8) * 2; // Keep minimum 10% volume
    
    // Use crash buffer for explosion sounds (now correctly mapped)
    if (this.crash1Buffer) {
      this.playSpatialOneShot(this.crash1Buffer, volume, panValue);
    } else {
      this.playSpatialNoise(0.35, volume * 1.6, panValue);
    }
  }

  explosion() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    // Play crash/explosion sound from crashBuffer (now correctly mapped to explosion audio)
    const volume = this.getConfigVolume('sfx', 'crash');
    if (this.crash1Buffer) {
      this.playOneShot(this.crash1Buffer, volume);
    } else {
      // Fallback to noise if buffer not available
      this.playNoise(0.35, 0.8);
    }
  }

  async success() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    // Play landing success sound from landingBuffer (now correctly mapped to landing audio)
    const volume = this.getConfigVolume('sfx', 'landing');
    if (this.landingBuffer) {
      this.playOneShot(this.landingBuffer, volume);
    } else {
      this.playNoise(0.2, 0.4);
    }
  }

  async landingCrash() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    // Stop any previous landing sound
    if (this.landingSoundSource) {
      try { this.landingSoundSource.stop(); } catch {}
      this.landingSoundSource = null;
    }
    
    if (!this.sfxGain) {
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);
    }
    
    // Use landing buffer for landing sounds (now correctly mapped)
    const volume = this.getConfigVolume('sfx', 'landing');
    if (this.landingBuffer) {
      // Create dedicated gain node for fading
      this.landingSoundGain = this.ctx.createGain();
      this.landingSoundGain.gain.value = volume * 1.5;
      
      const src = this.ctx.createBufferSource();
      src.buffer = this.landingBuffer;
      src.connect(this.landingSoundGain);
      this.landingSoundGain.connect(this.sfxGain);
      src.start(0);
      
      this.landingSoundSource = src;
      
      // Auto-cleanup when sound finishes
      src.onended = () => {
        this.landingSoundSource = null;
        this.landingSoundGain = null;
      };
    } else {
      this.playNoise(0.2, 0.4);
    }
  }

  landing() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    // Stop any previous landing sound
    if (this.landingSoundSource) {
      try { this.landingSoundSource.stop(); } catch {}
      this.landingSoundSource = null;
    }
    
    if (!this.sfxGain) {
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);
    }
    
    // Use landing buffer for landing sounds (now correctly mapped)
    const volume = this.getConfigVolume('sfx', 'landing');
    if (this.landingBuffer) {
      // Create dedicated gain node for fading
      this.landingSoundGain = this.ctx.createGain();
      this.landingSoundGain.gain.value = volume * 2;
      
      const src = this.ctx.createBufferSource();
      src.buffer = this.landingBuffer;
      src.connect(this.landingSoundGain);
      this.landingSoundGain.connect(this.sfxGain);
      src.start(0);
      
      this.landingSoundSource = src;
      
      // Auto-cleanup when sound finishes
      src.onended = () => {
        this.landingSoundSource = null;
        this.landingSoundGain = null;
      };
    } else {
      // Fallback to noise if buffer not loaded
      this.playNoise(0.2, 0.4);
    }
  }

  fadeLandingSound(duration = 2.0) {
    if (!this.landingSoundGain || !this.ctx) return;
    
    const now = this.ctx.currentTime;
    this.landingSoundGain.gain.cancelScheduledValues(now);
    this.landingSoundGain.gain.setValueAtTime(this.landingSoundGain.gain.value, now);
    this.landingSoundGain.gain.linearRampToValueAtTime(0, now + duration);
  }

  // ===== Click sound (menu/UI feedback) =====
  click() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    const volume = this.getConfigVolume('sfx', 'click');
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }
  
  // Lightning sound placeholders - ready for future audio files
  playLightningSound(distance: 'far' | 'close', volume: number = 0.5) {
    // TODO: Add lightning sound files
    // far: low rumble sound
    // close: loud crack/boom sound
    // Will use lightningBuffers.rumble and lightningBuffers.crack
  }
  
  playLightningImpactSound(volume: number = 0.8) {
    // TODO: Add terrain impact sound
    // Will use lightningBuffers.impact
  }

  // ===== Shield sounds =====
  shieldPickup() {
    const volume = this.getConfigVolume('sfx', 'shieldPickup');
    
    // Use preloaded buffer if available
    if (this.shieldPickupBuffer) {
      this.playOneShot(this.shieldPickupBuffer, volume);
      return;
    }
    
    // Try to load on demand if path is configured
    const path = this.getConfigPath('sfx', 'shieldPickup');
    if (path && typeof path === 'string') {
      this.loadBuffer(path).then(buffer => {
        if (buffer) {
          this.shieldPickupBuffer = buffer;
          this.playOneShot(buffer, volume);
        } else {
          // Fallback to original synthesized sound
          this.success();
          setTimeout(() => this.click(), 50);
        }
      });
    } else {
      // Fallback for no configured path
      this.success();
      setTimeout(() => this.click(), 50);
    }
  }

  shieldBreak() {
    const volume = this.getConfigVolume('sfx', 'shieldBreak');
    
    // Use preloaded buffer if available
    if (this.shieldBreakBuffer) {
      this.playOneShot(this.shieldBreakBuffer, volume);
      return;
    }
    
    // Try to load on demand if path is configured
    const path = this.getConfigPath('sfx', 'shieldBreak');
    if (path && typeof path === 'string') {
      this.loadBuffer(path).then(buffer => {
        if (buffer) {
          this.shieldBreakBuffer = buffer;
          this.playOneShot(buffer, volume);
        } else {
          // Fallback to synthesized oscillator sweep
          this.playShieldBreakFallback(volume);
        }
      });
    } else {
      // Fallback for no configured path
      this.playShieldBreakFallback(volume);
    }
  }
  
  private playShieldBreakFallback(volume: number) {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.value = 1200;
    gain.gain.value = volume;
    
    osc.connect(gain);
    gain.connect(this.master);
    
    const now = this.ctx.currentTime;
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  abort() {
    // Smooth whoosh sound instead of jarring white noise
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    const now = this.ctx.currentTime;
    const duration = 0.4;
    
    // Create filtered noise for whoosh effect
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    
    // Bandpass filter for smoother whoosh
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 2;
    
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    
    // Sweep filter frequency down for whoosh effect
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + duration);
    
    const volume = this.getConfigVolume('sfx', 'abort');
    // Quick fade in and gradual fade out
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    src.start(now);
    src.stop(now + duration);
  }

  // ===== Fuel alarm loop =====
  async startFuelAlarm() {
    this.ensureCtx();
    if (!this.ctx || !this.master || this.fuelAlarmOn) return;
    if (!this.fuelGain) {
      this.fuelGain = this.ctx.createGain();
      this.fuelGain.gain.value = 0;
      this.fuelGain.connect(this.master);
    }
    if (!this.fuelLoopBuffer && this.isPreloaded) {
      // Should be preloaded, but fallback just in case
      const fuelUrl = this.getConfigPath('sfx', 'fuelAlarm') as string || '/audio/fuel_10_percent_loop.mp3';
      this.fuelLoopBuffer = await this.loadBuffer(fuelUrl);
    } else if (!this.fuelLoopBuffer) {
      const fuelUrl = this.getConfigPath('sfx', 'fuelAlarm') as string || '/audio/fuel_10_percent_loop.mp3';
      this.fuelLoopBuffer = await this.loadBuffer(fuelUrl);
    }
    if (!this.fuelLoopBuffer) return;
    this.fuelSource = this.ctx.createBufferSource();
    this.fuelSource.buffer = this.fuelLoopBuffer;
    this.fuelSource.loop = true;
    this.fuelSource.connect(this.fuelGain);
    this.fuelSource.start(0);
    const now = this.ctx.currentTime;
    const volume = this.getConfigVolume('sfx', 'fuelAlarm');
    this.fuelGain.gain.cancelScheduledValues(now);
    this.fuelGain.gain.linearRampToValueAtTime(volume, now + 0.2);
    this.fuelAlarmOn = true;
  }

  stopFuelAlarm() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.fuelGain) {
      this.fuelGain.gain.cancelScheduledValues(now);
      this.fuelGain.gain.linearRampToValueAtTime(0, now + 0.15);
    }
    if (this.fuelSource) {
      try { this.fuelSource.stop(now + 0.18); } catch {}
      try { this.fuelSource.disconnect(); } catch {}
      this.fuelSource = null;
    }
    this.fuelAlarmOn = false;
  }

  // ===== Level music (uses config paths) =====
  private async ensureMusicGain() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
    }
  }

  async playLevelTrackByIndex(index: number) {
    // Ensure config is loaded
    await this.initializeConfig();
    
    this.ensureCtx();
    if (!this.ctx) return;
    await this.ensureMusicGain();
    
    // Apply global mute state
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicGloballyMuted ? 0 : 0.5;
    }
    
    // Get the level key (level1 through level20, cycling)
    const levelNum = ((index % 20) + 20) % 20 + 1;
    const levelKey = `level${levelNum}`;
    
    // Get URL from config with fallback
    let url = this.getConfigPath('music', levelKey) as string;
    if (!url) {
      // Fallback to cycling through original 8 tracks
      const fallbackNum = ((index % 8) + 8) % 8 + 1;
      url = `/audio/level${fallbackNum}.mp3`;
    }
    
    // Check if buffer needs to be loaded (or reloaded with new URL)
    const bufferIndex = ((index % 20) + 20) % 20;
    if (!this.musicBuffers[bufferIndex]) {
      this.musicBuffers[bufferIndex] = await this.loadBuffer(url);
    }
    
    const buf = this.musicBuffers[bufferIndex];
    if (!buf || !this.musicGain) return;
    const now = this.ctx.currentTime;
    
    // Stop previous
    if (this.musicSource) {
      try { this.musicSource.stop(now); } catch {}
      try { this.musicSource.disconnect(); } catch {}
      this.musicSource = null;
    }
    
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.musicGain);
    src.start(0);
    this.musicSource = src;
  }

  /**
   * Precache the next level's music track in the background (non-blocking).
   * Call this after a successful landing to ensure the next level's music is ready.
   * @param currentLevelIndex - The current level index (0-based). Will precache currentLevelIndex + 1.
   */
  async precacheLevelTrack(currentLevelIndex: number): Promise<void> {
    // Ensure config is loaded
    await this.initializeConfig();
    
    const nextIndex = currentLevelIndex + 1;
    
    // Get the level key (level1 through level20, cycling)
    const levelNum = ((nextIndex % 20) + 20) % 20 + 1;
    const levelKey = `level${levelNum}`;
    
    // Get URL from config with fallback
    let url = this.getConfigPath('music', levelKey) as string;
    if (!url) {
      // Fallback to cycling through original 8 tracks
      const fallbackNum = ((nextIndex % 8) + 8) % 8 + 1;
      url = `/audio/level${fallbackNum}.mp3`;
    }
    
    // Check if already cached
    const bufferIndex = ((nextIndex % 20) + 20) % 20;
    if (this.musicBuffers[bufferIndex]) {
      console.log(`🎵 Level ${levelNum} track already cached`);
      return;
    }
    
    // Load in background
    console.log(`🎵 Precaching level ${levelNum} track...`);
    try {
      this.musicBuffers[bufferIndex] = await this.loadBuffer(url);
      if (this.musicBuffers[bufferIndex]) {
        console.log(`🎵 Level ${levelNum} track cached successfully`);
      }
    } catch (e) {
      console.warn(`🎵 Failed to precache level ${levelNum} track:`, e);
    }
  }

  // ========== Endless Mode Music ==========
  private shuffleEndlessPlaylist() {
    // Fisher-Yates shuffle of indices 0-4
    this.endlessPlaylist = [0, 1, 2, 3, 4];
    for (let i = this.endlessPlaylist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.endlessPlaylist[i], this.endlessPlaylist[j]] = [this.endlessPlaylist[j], this.endlessPlaylist[i]];
    }
    this.endlessCurrentIndex = 0;
  }

  private async ensureEndlessGain() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    if (!this.endlessGain) {
      this.endlessGain = this.ctx.createGain();
      this.endlessGain.gain.value = this.musicGloballyMuted ? 0 : 0.5;
      this.endlessGain.connect(this.master);
    }
  }

  async playEndlessMusic() {
    // Ensure config is loaded
    await this.initializeConfig();
    
    this.ensureCtx();
    if (!this.ctx) return;
    await this.ensureEndlessGain();
    
    // Apply global mute state
    if (this.endlessGain) {
      this.endlessGain.gain.value = this.musicGloballyMuted ? 0 : 0.5;
    }
    
    // Shuffle playlist on first call
    if (this.endlessPlaylist.length === 0) {
      this.shuffleEndlessPlaylist();
    }
    
    // Play the first track in shuffled playlist
    await this.playEndlessTrack(this.endlessPlaylist[this.endlessCurrentIndex]);
  }

  private async playEndlessTrack(trackIndex: number) {
    this.ensureCtx();
    if (!this.ctx || !this.endlessGain) return;
    
    // Get URL from config (endless1 through endless5)
    const trackNum = trackIndex + 1;
    const trackKey = `endless${trackNum}`;
    let url = this.getConfigPath('music', trackKey) as string;
    if (!url) {
      url = `/audio/Endless_Music_${trackNum}.mp3`;
    }
    
    // Load buffer if needed
    if (!this.endlessBuffers[trackIndex]) {
      this.endlessBuffers[trackIndex] = await this.loadBuffer(url);
    }
    
    const buf = this.endlessBuffers[trackIndex];
    if (!buf) {
      console.warn(`Failed to load endless track ${trackNum}`);
      // Try next track
      this.advanceEndlessPlaylist();
      return;
    }
    
    const now = this.ctx.currentTime;
    
    // Stop previous endless source
    if (this.endlessSource) {
      try { this.endlessSource.stop(now); } catch {}
      try { this.endlessSource.disconnect(); } catch {}
      this.endlessSource = null;
    }
    
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = false; // Don't loop - chain to next track when ended
    src.connect(this.endlessGain);
    
    // Set up ended listener to chain to next track
    src.onended = () => {
      if (this.endlessSource === src) {
        this.advanceEndlessPlaylist();
      }
    };
    
    src.start(0);
    this.endlessSource = src;
  }

  private advanceEndlessPlaylist() {
    this.endlessCurrentIndex++;
    
    // If we've played all 5 tracks, reshuffle and start over
    if (this.endlessCurrentIndex >= this.endlessPlaylist.length) {
      this.shuffleEndlessPlaylist();
    }
    
    // Play next track
    this.playEndlessTrack(this.endlessPlaylist[this.endlessCurrentIndex]);
  }

  stopEndlessMusic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    if (this.endlessGain) {
      this.endlessGain.gain.cancelScheduledValues(now);
      this.endlessGain.gain.linearRampToValueAtTime(0, now + 0.1);
    }
    
    if (this.endlessSource) {
      try { this.endlessSource.stop(now + 0.12); } catch {}
      try { this.endlessSource.disconnect(); } catch {}
      this.endlessSource = null;
    }
    
    // Reset playlist state
    this.endlessPlaylist = [];
    this.endlessCurrentIndex = 0;
  }

  async playLevelTrackForLevel(level: number) {
    await this.playLevelTrackByIndex(level);
  }

  stopLevelMusic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.musicSource) {
      try { this.musicSource.stop(now + 0.05); } catch {}
      try { this.musicSource.disconnect(); } catch {}
      this.musicSource = null;
    }
  }

  // Fade out current music
  fadeOutMusic(duration: number = 1.5) {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const currentGain = this.musicGain.gain.value;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(currentGain, now);
    this.musicGain.gain.linearRampToValueAtTime(0, now + duration);
  }

  // Fade in current music
  fadeInMusic(duration: number = 3.0) {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const currentGain = this.musicGain.gain.value;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(currentGain, now);
    this.musicGain.gain.linearRampToValueAtTime(0.5, now + duration);
  }

  // Mission success music source tracking
  private missionSuccessSource?: AudioBufferSourceNode | null;

  async playMissionSuccess() {
    // Ensure config is loaded
    await this.initializeConfig();
    
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    await this.ensureMusicGain();
    
    // Apply global mute state
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicGloballyMuted ? 0 : 0.5;
    }
    
    // Use preloaded buffer if available, otherwise load from config
    if (!this.missionSuccessBuffer) {
      const url = this.getConfigPath('music', 'missionSuccess') as string || '/audio/mission_success.mp3';
      this.missionSuccessBuffer = await this.loadBuffer(url);
    }
    
    // Load missionSuccess2 buffer if configured (and not already loaded)
    if (this.missionSuccess2Buffer === undefined) {
      const url2 = this.getConfigPath('music', 'missionSuccess2') as string | null;
      if (url2) {
        this.missionSuccess2Buffer = await this.loadBuffer(url2);
      } else {
        this.missionSuccess2Buffer = null;
      }
    }
    
    // Determine which buffer to play
    const hasTwoTracks = !!this.missionSuccess2Buffer;
    let bufferToPlay: AudioBuffer | null = null;
    
    if (hasTwoTracks) {
      // Alternate between tracks
      bufferToPlay = this.currentMissionSuccessTrack === 1 
        ? this.missionSuccessBuffer 
        : this.missionSuccess2Buffer;
      // Toggle for next time
      this.currentMissionSuccessTrack = this.currentMissionSuccessTrack === 1 ? 2 : 1;
    } else {
      bufferToPlay = this.missionSuccessBuffer;
    }
    
    if (bufferToPlay && this.musicGain) {
      // Stop any previous mission success music
      this.stopMissionSuccess();
      const src = this.ctx.createBufferSource();
      src.buffer = bufferToPlay;
      src.connect(this.musicGain);
      src.start(0);
      this.missionSuccessSource = src;
    }
  }

  stopMissionSuccess() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.missionSuccessSource) {
      try { this.missionSuccessSource.stop(now); } catch {}
      try { this.missionSuccessSource.disconnect(); } catch {}
      this.missionSuccessSource = null;
    }
  }

  // ========== Global Music Mute API ==========
  setGlobalMusicMute(muted: boolean) {
    this.musicGloballyMuted = muted;
    
    // Persist to localStorage
    try {
      localStorage.setItem('ll-music-muted', JSON.stringify(muted));
    } catch {}
    
    // Apply to currently playing music immediately
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const titleVolume = this.getConfigVolume('music', 'title');
    
    // Title music
    if (this.titleGain) {
      this.titleGain.gain.cancelScheduledValues(now);
      this.titleGain.gain.setValueAtTime(this.titleGain.gain.value, now);
      this.titleGain.gain.linearRampToValueAtTime(muted ? 0 : titleVolume, now + 0.3);
    }
    
    // Level music
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5, now + 0.3);
    }
  }

  isGlobalMusicMuted(): boolean {
    return this.musicGloballyMuted;
  }

  // Stop all audio - useful for level transitions
  stopAllAudio() {
    this.stopTitleMusic();
    this.stopThruster();
    this.stopFuelAlarm();
    this.stopLevelMusic();
    this.stopEndlessMusic();
    this.stopMissionSuccess();
  }

  // ===== Collectibles audio =====
  junkPickup() {
    const volume = this.getConfigVolume('sfx', 'junkPickup');
    
    // Use preloaded buffer if available
    if (this.junkPickupBuffer) {
      this.playOneShot(this.junkPickupBuffer, volume);
    } else {
      // Try to load on demand if path is configured
      const path = this.getConfigPath('sfx', 'junkPickup');
      if (path && typeof path === 'string') {
        this.loadBuffer(path).then(buffer => {
          if (buffer) {
            this.junkPickupBuffer = buffer;
            this.playOneShot(buffer, volume);
          } else {
            this.playNoise(0.15, volume); // Fallback
          }
        });
      } else {
        this.playNoise(0.15, volume); // Fallback for no configured path
      }
    }
  }

  junkSetComplete() {
    // Play a special success stinger for completing the set
    const volume = this.getConfigVolume('sfx', 'junkSetComplete');
    
    // Use preloaded buffer if available
    if (this.junkSetCompleteBuffer) {
      this.playOneShot(this.junkSetCompleteBuffer, volume);
    } else {
      // Try to load on demand if path is configured
      const path = this.getConfigPath('sfx', 'junkSetComplete');
      if (path && typeof path === 'string') {
        this.loadBuffer(path).then(buffer => {
          if (buffer) {
            this.junkSetCompleteBuffer = buffer;
            this.playOneShot(buffer, volume);
          } else {
            // Fallback to triple noise
            this.playNoise(0.4, volume);
            setTimeout(() => this.playNoise(0.4, volume), 100);
            setTimeout(() => this.playNoise(0.4, volume), 200);
          }
        });
      } else {
        // Fallback for no configured path
        this.playNoise(0.4, volume);
        setTimeout(() => this.playNoise(0.4, volume), 100);
        setTimeout(() => this.playNoise(0.4, volume), 200);
      }
    }
  }

  wormholeOpen() {
    // Play a mysterious portal opening sound
    const volume = this.getConfigVolume('sfx', 'wormholeOpen');
    
    // Use preloaded buffer if available
    if (this.wormholeOpenBuffer) {
      this.playOneShot(this.wormholeOpenBuffer, volume);
    } else {
      // Try to load on demand if path is configured
      const path = this.getConfigPath('sfx', 'wormholeOpen');
      if (path && typeof path === 'string') {
        this.loadBuffer(path).then(buffer => {
          if (buffer) {
            this.wormholeOpenBuffer = buffer;
            this.playOneShot(buffer, volume);
          } else {
            this.playNoise(0.8, volume); // Fallback
          }
        });
      } else {
        this.playNoise(0.8, volume); // Fallback for no configured path
      }
    }
  }

  // Intro countdown sound effects - uses preloaded buffers for instant playback
  async playIntroTick() {
    if (!this.ctx || !this.master) return;
    
    const volume = this.getConfigVolume('sfx', 'introTick');
    
    // Use preloaded buffer for instant playback
    if (this.introTickBuffer) {
      this.playOneShot(this.introTickBuffer, volume);
    } else {
      // Fallback: load on demand if not preloaded
      try {
        const url = this.getConfigPath('sfx', 'introTick') as string || '/audio/intro_tick.mp3';
        const buffer = await this.loadBuffer(url);
        if (buffer) {
          this.introTickBuffer = buffer;
          this.playOneShot(buffer, volume);
        }
      } catch (error) {
        console.warn('Failed to play intro tick sound:', error);
        this.click();
      }
    }
  }

  async playIntroGo() {
    if (!this.ctx || !this.master) return;
    
    const volume = this.getConfigVolume('sfx', 'introGo');
    
    // Use preloaded buffer for instant playback
    if (this.introGoBuffer) {
      this.playOneShot(this.introGoBuffer, volume);
    } else {
      // Fallback: load on demand if not preloaded
      try {
        const url = this.getConfigPath('sfx', 'introGo') as string || '/audio/intro_go.mp3';
        const buffer = await this.loadBuffer(url);
        if (buffer) {
          this.introGoBuffer = buffer;
          this.playOneShot(buffer, volume);
        }
      } catch (error) {
        console.warn('Failed to play intro go sound:', error);
        this.playNoise(0.25, 0.7);
      }
    }
  }

  async playIntroWarp() {
    if (!this.ctx || !this.master) return;
    
    const volume = this.getConfigVolume('sfx', 'introWarp');
    
    // Use preloaded buffer for instant playback
    if (this.introWarpBuffer) {
      this.playOneShot(this.introWarpBuffer, volume);
    } else {
      // Fallback: load on demand if not preloaded
      try {
        const url = this.getConfigPath('sfx', 'introWarp') as string || '/audio/intro_warp.mp3';
        const buffer = await this.loadBuffer(url);
        if (buffer) {
          this.introWarpBuffer = buffer;
          this.playOneShot(buffer, volume);
        }
      } catch (error) {
        console.warn('Failed to play intro warp sound:', error);
        this.playNoise(0.5, 0.6);
      }
    }
  }

  wormholeEnter() {
    // Play a warping sound effect
    const volume = this.getConfigVolume('sfx', 'wormholeEnter');
    this.playNoise(1.2, volume);
  }

  // Weather audio
  private weatherLoopGain?: GainNode;
  
  startWeatherAmbient(type: string) {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    this.stopWeatherAmbient();
    
    if (!this.weatherLoopGain) {
      this.weatherLoopGain = this.ctx.createGain();
      this.weatherLoopGain.gain.value = 0;
      this.weatherLoopGain.connect(this.master);
    }
    
    // Synthesize ambient based on type
    const gain = this.weatherLoopGain.gain;
    gain.cancelScheduledValues(this.ctx.currentTime);
    gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 3);
  }
  
  stopWeatherAmbient() {
    if (!this.ctx || !this.weatherLoopGain) return;
    this.weatherLoopGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3);
  }
  
  setMusicWeatherEQ(type: string) {
    if (!this.musicGain) return;
    // Adjust music volume based on weather
    const targetVol = type === "clear" ? 0.5 : type === "em-storm" ? 0.3 : 0.4;
    if (this.ctx) {
      this.musicGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 2);
    }
  }
  
  playLightningCrack() {
    const volume = this.getConfigVolume('sfx', 'lightningCrack');
    this.playNoise(0.1, volume);
  }

  jellyfishBurst() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    const volume = this.getConfigVolume('sfx', 'jellyfishBurst');
    
    // Electric burst sound - use existing crash sound but pitched higher
    if (this.crash1Buffer) {
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      const src = this.ctx.createBufferSource();
      src.buffer = this.crash1Buffer;
      src.playbackRate.value = 1.8; // Higher pitch for electric feel
      src.connect(gain);
      gain.connect(this.master);
      src.start(0);
    } else {
      this.playNoise(0.08, volume);
    }
  }

  jellyfishShock() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    const volume = this.getConfigVolume('sfx', 'jellyfishShock');
    
    // Electric shock on lander - short zap
    if (this.crash2Buffer) {
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      const src = this.ctx.createBufferSource();
      src.buffer = this.crash2Buffer;
      src.playbackRate.value = 2.2; // Very high pitch
      src.connect(gain);
      gain.connect(this.master);
      src.start(0);
    } else {
      this.playNoise(0.05, volume);
    }
  }

  // iOS AudioContext unlock helper
  private _iosUnlocked = false;
  
  private playUnlockBuffer() {
    if (!this.ctx || !this.master) return;
    const buffer = this.ctx.createBuffer(1, 1, 22050);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    source.start(0);
  }

  // Reset audio state between games without destroying context or buffers
  resetForNewGame() {
    // Resume context if iOS suspended it
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    
    // Stop all active sounds but preserve buffers
    this.stopThruster();
    this.stopFuelAlarm();
    this.stopLevelMusic();
    this.stopMissionSuccess();
    this.stopTitleMusic();
    try { this.stopWeatherAmbient(); } catch {}
    this.stopUfoSmallSound();
    this.stopUfoMediumSound();
    this.stopUfoLargeSound();
    
    // Reset state flags
    this.fuelAlarmOn = false;
    this.crashToggle = false;
    this.titleMuted = false;
    
    // Clear thruster tracking
    (this as any)._thrusterLastSet = 0;
    (this as any)._thrusterLastTarget = 0;
    
    // Clear references to allow new sources to be created
    this.thrusterSource = null;
    this.landingSoundSource = null;
    this.landingSoundGain = null;
  }
  
  // ========== Comet Sound (one-shot) ==========
  async playCometArrival(): Promise<void> {
    await this.initializeConfig();
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    const volume = this.getConfigVolume('sfx', 'cometArrival');
    
    // Load buffer if not already loaded
    if (!this.cometArrivalBuffer) {
      const url = this.getConfigPath('sfx', 'cometArrival') as string || '/audio/Comet_coming.mp3';
      this.cometArrivalBuffer = await this.loadBuffer(url);
    }
    
    if (this.cometArrivalBuffer) {
      this.playOneShot(this.cometArrivalBuffer, volume);
      console.log('☄️ Comet arrival sound playing');
    } else {
      // Fallback: synthesized whoosh
      this.playNoise(0.8, volume * 0.5);
    }
  }
  
  // ========== UFO Sounds (looping with 3s pause) ==========
  
  /**
   * Play UFO sound in a loop with a 3-second pause between plays
   */
  private playUfoSoundLoop(
    type: 'small' | 'medium' | 'large',
    buffer: AudioBuffer,
    volume: number
  ): void {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    // Check if still active
    const isActive = type === 'small' ? this.ufoSmallActive : 
                     type === 'medium' ? this.ufoMediumActive : 
                     this.ufoLargeActive;
    if (!isActive) return;
    
    // Create gain node for this UFO type
    let gainNode: GainNode;
    switch (type) {
      case 'small':
        if (!this.ufoSmallGain) {
          this.ufoSmallGain = this.ctx.createGain();
          this.ufoSmallGain.connect(this.master);
        }
        gainNode = this.ufoSmallGain;
        break;
      case 'medium':
        if (!this.ufoMediumGain) {
          this.ufoMediumGain = this.ctx.createGain();
          this.ufoMediumGain.connect(this.master);
        }
        gainNode = this.ufoMediumGain;
        break;
      case 'large':
        if (!this.ufoLargeGain) {
          this.ufoLargeGain = this.ctx.createGain();
          this.ufoLargeGain.connect(this.master);
        }
        gainNode = this.ufoLargeGain;
        break;
    }
    
    gainNode.gain.value = volume;
    
    // Create and play the source
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.start(0);
    
    // Store reference
    switch (type) {
      case 'small': this.ufoSmallSource = source; break;
      case 'medium': this.ufoMediumSource = source; break;
      case 'large': this.ufoLargeSource = source; break;
    }
    
    // Schedule next play after sound ends + 3 second pause
    const duration = buffer.duration * 1000; // ms
    const timeout = setTimeout(() => {
      // Re-check if still active before replaying
      const stillActive = type === 'small' ? this.ufoSmallActive : 
                          type === 'medium' ? this.ufoMediumActive : 
                          this.ufoLargeActive;
      if (stillActive) {
        this.playUfoSoundLoop(type, buffer, volume);
      }
    }, duration + 3000); // 3 second pause
    
    // Store timeout reference
    switch (type) {
      case 'small': this.ufoSmallTimeout = timeout; break;
      case 'medium': this.ufoMediumTimeout = timeout; break;
      case 'large': this.ufoLargeTimeout = timeout; break;
    }
  }
  
  async startUfoSmallSound(): Promise<void> {
    if (this.ufoSmallActive) return; // Already playing
    
    await this.initializeConfig();
    this.ensureCtx();
    if (!this.ctx) return;
    
    // Load buffer if needed
    if (!this.ufoSmallBuffer) {
      const url = this.getConfigPath('sfx', 'ufoSmall') as string || '/audio/sfx_hovering_scifi_1.mp3';
      this.ufoSmallBuffer = await this.loadBuffer(url);
    }
    
    if (this.ufoSmallBuffer) {
      this.ufoSmallActive = true;
      const volume = this.getConfigVolume('sfx', 'ufoSmall');
      this.playUfoSoundLoop('small', this.ufoSmallBuffer, volume);
      console.log('🛸 Small UFO sound started');
    }
  }
  
  stopUfoSmallSound(): void {
    this.ufoSmallActive = false;
    if (this.ufoSmallTimeout) {
      clearTimeout(this.ufoSmallTimeout);
      this.ufoSmallTimeout = undefined;
    }
    if (this.ufoSmallSource) {
      try { this.ufoSmallSource.stop(); } catch {}
      this.ufoSmallSource.disconnect();
      this.ufoSmallSource = null;
    }
  }
  
  async startUfoMediumSound(): Promise<void> {
    if (this.ufoMediumActive) return; // Already playing
    
    await this.initializeConfig();
    this.ensureCtx();
    if (!this.ctx) return;
    
    // Load buffer if needed
    if (!this.ufoMediumBuffer) {
      const url = this.getConfigPath('sfx', 'ufoMedium') as string || '/audio/sfx_hovering_scifi_3.mp3';
      this.ufoMediumBuffer = await this.loadBuffer(url);
    }
    
    if (this.ufoMediumBuffer) {
      this.ufoMediumActive = true;
      const volume = this.getConfigVolume('sfx', 'ufoMedium');
      this.playUfoSoundLoop('medium', this.ufoMediumBuffer, volume);
      console.log('🛸 Medium UFO sound started');
    }
  }
  
  stopUfoMediumSound(): void {
    this.ufoMediumActive = false;
    if (this.ufoMediumTimeout) {
      clearTimeout(this.ufoMediumTimeout);
      this.ufoMediumTimeout = undefined;
    }
    if (this.ufoMediumSource) {
      try { this.ufoMediumSource.stop(); } catch {}
      this.ufoMediumSource.disconnect();
      this.ufoMediumSource = null;
    }
  }
  
  async startUfoLargeSound(): Promise<void> {
    if (this.ufoLargeActive) return; // Already playing
    
    await this.initializeConfig();
    this.ensureCtx();
    if (!this.ctx) return;
    
    // Load buffer if needed
    if (!this.ufoLargeBuffer) {
      const url = this.getConfigPath('sfx', 'ufoLarge') as string || '/audio/sfx_ominous_1.mp3';
      this.ufoLargeBuffer = await this.loadBuffer(url);
    }
    
    if (this.ufoLargeBuffer) {
      this.ufoLargeActive = true;
      const volume = this.getConfigVolume('sfx', 'ufoLarge');
      this.playUfoSoundLoop('large', this.ufoLargeBuffer, volume);
      console.log('🛸 Large UFO (Mothership) sound started');
    }
  }
  
  stopUfoLargeSound(): void {
    this.ufoLargeActive = false;
    if (this.ufoLargeTimeout) {
      clearTimeout(this.ufoLargeTimeout);
      this.ufoLargeTimeout = undefined;
    }
    if (this.ufoLargeSource) {
      try { this.ufoLargeSource.stop(); } catch {}
      this.ufoLargeSource.disconnect();
      this.ufoLargeSource = null;
    }
  }
  
  /**
   * Stop all UFO sounds (convenience method)
   */
  stopAllUfoSounds(): void {
    this.stopUfoSmallSound();
    this.stopUfoMediumSound();
    this.stopUfoLargeSound();
  }
}

// Singleton instance - shared across entire app
let globalAudioManager: AudioManager | null = null;

export function getGlobalAudioManager(): AudioManager {
  if (!globalAudioManager) {
    globalAudioManager = new AudioManager();
  }
  return globalAudioManager;
}
