export class AudioManager {
  private ctx: AudioContext | null = null;
  private master?: GainNode;

  // Title music
  private titleGain?: GainNode;
  private titleSource?: AudioBufferSourceNode | null;
  private titleBuffer?: AudioBuffer | null;
  private titleMuted = false;
  private readonly titleUrl = "/audio/title.mp3";

  // Thruster sample loop
  private thrusterGain?: GainNode;
  private thrusterSource?: AudioBufferSourceNode | null;
  private thrusterBuffer?: AudioBuffer | null;
  private readonly thrusterUrl = "/audio/thruster.mp3";

  // SFX buffers and state
  private crash1Buffer?: AudioBuffer | null;
  private crash2Buffer?: AudioBuffer | null;
  private landingBuffer?: AudioBuffer | null;
  private fuelLoopBuffer?: AudioBuffer | null;
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

  // Intro sound effect sources - will be loaded on demand
  private introSounds = {
    tick: '/audio/intro_tick.mp3',
    go: '/audio/intro_go.mp3', 
    warp: '/audio/intro_warp.mp3'
  };

  // Level music playlist
  private musicGain?: GainNode;
  private musicSource?: AudioBufferSourceNode | null;
  private musicBuffers: (AudioBuffer | null)[] = [null, null, null, null, null, null, null, null];
  private readonly musicUrls = ["/audio/level1.mp3","/audio/level2.mp3","/audio/level3.mp3","/audio/level4.mp3","/audio/level5.mp3","/audio/level6.mp3","/audio/level7.mp3","/audio/level8.mp3"];
  
  // Mission success music
  private missionSuccessBuffer?: AudioBuffer | null;

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.ctx.destination);
    }
  }

  resume() {
    this.ensureCtx();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
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

  // Preload critical SFX to eliminate lag
  async preloadSFX(): Promise<void> {
    if (this.isPreloaded || this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      this.ensureCtx();
      if (!this.ctx) return;

      // Load critical SFX in parallel
      const [crash1, crash2, landing, fuel] = await Promise.all([
        this.loadBuffer("/audio/crash1.mp3"),
        this.loadBuffer("/audio/crash2.mp3"),
        this.loadBuffer("/audio/landing_on_pad.mp3"),
        this.loadBuffer("/audio/fuel_10_percent_loop.mp3")
      ]);

      this.crash1Buffer = crash1;
      this.crash2Buffer = crash2;
      this.landingBuffer = landing;
      this.fuelLoopBuffer = fuel;
      this.isPreloaded = true;
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
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    if (!this.titleGain) {
      this.titleGain = this.ctx.createGain();
      this.titleGain.gain.value = this.titleMuted ? 0 : 0.5;
      this.titleGain.connect(this.master);
    }
    if (!this.titleBuffer) {
      this.titleBuffer = await this.loadBuffer(this.titleUrl);
    }
    if (this.titleBuffer && !this.titleSource) {
      this.titleSource = this.createLoopingSource(this.titleBuffer, this.titleGain!);
    }
  }

  setTitleMusicMuted(muted: boolean) {
    this.ensureCtx();
    this.titleMuted = muted;
    if (!this.ctx || !this.titleGain) return;
    const now = this.ctx.currentTime;
    const target = muted ? 0 : 0.5;
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
    if (!this.thrusterBuffer) {
      this.thrusterBuffer = await this.loadBuffer(this.thrusterUrl);
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
    
    if (this.landingBuffer) {
      this.playSpatialOneShot(this.landingBuffer, volume, panValue);
    } else {
      this.playSpatialNoise(0.35, volume * 1.6, panValue);
    }
  }

  explosion() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    // Now plays landing sound for explosion events - use preloaded buffer for instant playback
    if (this.landingBuffer) {
      this.playOneShot(this.landingBuffer, 0.9);
    } else {
      // Fallback to noise if buffer not available
      this.playNoise(0.35, 0.8);
    }
  }

  async success() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    // Now plays crash sounds for successful landing
    if (!this.crash1Buffer && !this.crash2Buffer) {
      // Load buffers if not available
      await Promise.all([
        this.loadBuffer("/audio/crash1.mp3").then(buf => this.crash1Buffer = buf),
        this.loadBuffer("/audio/crash2.mp3").then(buf => this.crash2Buffer = buf)
      ]);
    }
    
    const useFirst = (this.crashToggle = !this.crashToggle);
    const buf = useFirst ? (this.crash1Buffer || this.crash2Buffer) : (this.crash2Buffer || this.crash1Buffer);
    if (buf) this.playOneShot(buf, 0.7); else this.playNoise(0.2, 0.4);
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
    
    // Use fuel loop sound for successful landings
    if (!this.fuelLoopBuffer) {
      this.fuelLoopBuffer = await this.loadBuffer("/audio/fuel_10_percent_loop.mp3");
    }
    
    if (this.fuelLoopBuffer) {
      // Create dedicated gain node for fading
      this.landingSoundGain = this.ctx.createGain();
      this.landingSoundGain.gain.value = 1.4;
      
      const src = this.ctx.createBufferSource();
      src.buffer = this.fuelLoopBuffer;
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
    
    if (this.fuelLoopBuffer) {
      // Create dedicated gain node for fading
      this.landingSoundGain = this.ctx.createGain();
      this.landingSoundGain.gain.value = 1.8;
      
      const src = this.ctx.createBufferSource();
      src.buffer = this.fuelLoopBuffer;
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
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  // ===== Shield sounds =====
  shieldPickup() {
    this.success();
    setTimeout(() => this.click(), 50);
  }

  shieldBreak() {
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.value = 1200;
    gain.gain.value = 0.2;
    
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
    
    // Quick fade in and gradual fade out
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
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
      this.fuelLoopBuffer = await this.loadBuffer("/audio/fuel_10_percent_loop.mp3");
    } else if (!this.fuelLoopBuffer) {
      this.fuelLoopBuffer = await this.loadBuffer("/audio/fuel_10_percent_loop.mp3");
    }
    if (!this.fuelLoopBuffer) return;
    this.fuelSource = this.ctx.createBufferSource();
    this.fuelSource.buffer = this.fuelLoopBuffer;
    this.fuelSource.loop = true;
    this.fuelSource.connect(this.fuelGain);
    this.fuelSource.start(0);
    const now = this.ctx.currentTime;
    this.fuelGain.gain.cancelScheduledValues(now);
    this.fuelGain.gain.linearRampToValueAtTime(0.6, now + 0.2);
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

  // ===== Level music (simple playlist) =====
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
    this.ensureCtx();
    if (!this.ctx) return;
    await this.ensureMusicGain();
    const i = ((index % this.musicUrls.length) + this.musicUrls.length) % this.musicUrls.length;
    if (!this.musicBuffers[i]) this.musicBuffers[i] = await this.loadBuffer(this.musicUrls[i]);
    const buf = this.musicBuffers[i];
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
    this.ensureCtx();
    if (!this.ctx || !this.master) return;
    await this.ensureMusicGain();
    if (!this.missionSuccessBuffer) this.missionSuccessBuffer = await this.loadBuffer("/audio/mission_success.mp3");
    if (this.missionSuccessBuffer && this.musicGain) {
      // Stop any previous mission success music
      this.stopMissionSuccess();
      const src = this.ctx.createBufferSource();
      src.buffer = this.missionSuccessBuffer;
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

  // Stop all audio - useful for level transitions
  stopAllAudio() {
    this.stopTitleMusic();
    this.stopThruster();
    this.stopFuelAlarm();
    this.stopLevelMusic();
    this.stopMissionSuccess();
  }

  // ===== Collectibles audio =====
  junkPickup() {
    this.playNoise(0.15, Math.random() < 0.5 ? 0.5 : 0.7);
  }

  junkSetComplete() {
    // Play a special success stinger for completing the set
    this.playNoise(0.4, 0.8);
    setTimeout(() => this.playNoise(0.4, 0.8), 100);
    setTimeout(() => this.playNoise(0.4, 0.8), 200);
  }

  wormholeOpen() {
    // Play a mysterious portal opening sound
    this.playNoise(0.8, 0.6);
  }

  // Intro countdown sound effects
  async playIntroTick() {
    if (!this.ctx || !this.master) return;
    
    try {
      const buffer = await this.loadBuffer(this.introSounds.tick);
      if (buffer) {
        this.playOneShot(buffer, 0.6);
      }
    } catch (error) {
      console.warn('Failed to play intro tick sound:', error);
      // Fallback to synthesized tick
      this.click();
    }
  }

  async playIntroGo() {
    if (!this.ctx || !this.master) return;
    
    try {
      const buffer = await this.loadBuffer(this.introSounds.go);
      if (buffer) {
        this.playOneShot(buffer, 0.8);
      }
    } catch (error) {
      console.warn('Failed to play intro go sound:', error);
      // Fallback to synthesized sound
      this.playNoise(0.25, 0.7);
    }
  }

  async playIntroWarp() {
    if (!this.ctx || !this.master) return;
    
    try {
      const buffer = await this.loadBuffer(this.introSounds.warp);
      if (buffer) {
        this.playOneShot(buffer, 0.7);
      }
    } catch (error) {
      console.warn('Failed to play intro warp sound:', error);
      // Fallback to shimmer effect
      this.playNoise(0.5, 0.6);
    }
  }

  wormholeEnter() {
    // Play a warping sound effect
    this.playNoise(1.2, 0.7);
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
    this.playNoise(0.1, 0.9);
  }
}
