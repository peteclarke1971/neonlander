/**
 * Audio Configuration Service
 * 
 * Handles loading audio configuration from cloud (Supabase) with
 * fallback to hardcoded defaults. Manages soundtrack selection
 * and provides the active audio paths for the game.
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  DEFAULT_AUDIO_CONFIG, 
  type AudioConfig, 
  type SoundtrackType,
  type MusicEventKey,
  type SfxEventKey,
  type AudioEventConfig,
  MUSIC_EVENT_KEYS,
  SFX_EVENT_KEYS,
} from './defaultAudioConfig';

interface AudioLibraryRow {
  id: string;
  filename: string;
  display_name: string;
  type: 'music' | 'sfx';
  duration_seconds: number | null;
  file_path: string;
  created_at: string;
}

interface AudioConfigRow {
  id: string;
  event_key: string;
  soundtrack: SoundtrackType;
  audio_file_id: string | null;
  volume: number;
  is_active: boolean;
  updated_at: string;
  audio_library?: AudioLibraryRow | null;
}

class AudioConfigService {
  private config: AudioConfig | null = null;
  private soundtrack: SoundtrackType = 'default';
  private configLoaded = false;
  private loadPromise: Promise<AudioConfig> | null = null;
  private audioLibrary: AudioLibraryRow[] = [];

  constructor() {
    // Load saved soundtrack preference
    try {
      const saved = localStorage.getItem('ll-soundtrack');
      if (saved && ['default', 'retro', 'modern', 'hidden'].includes(saved)) {
        this.soundtrack = saved as SoundtrackType;
      }
    } catch {}
  }

  /**
   * Get current soundtrack type
   */
  getSoundtrack(): SoundtrackType {
    return this.soundtrack;
  }

  /**
   * Set soundtrack and invalidate cached config
   */
  setSoundtrack(type: SoundtrackType) {
    if (type === this.soundtrack) return;
    
    this.soundtrack = type;
    this.config = null;
    this.configLoaded = false;
    this.loadPromise = null;
    
    try {
      localStorage.setItem('ll-soundtrack', type);
    } catch {}
    
    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('soundtrackChanged', { detail: type }));
  }

  /**
   * Check if hidden soundtrack is unlocked
   */
  isHiddenUnlocked(): boolean {
    try {
      return localStorage.getItem('ll-soundtrack-hidden-unlocked') === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Unlock hidden soundtrack
   */
  unlockHidden() {
    try {
      localStorage.setItem('ll-soundtrack-hidden-unlocked', 'true');
      window.dispatchEvent(new CustomEvent('hiddenSoundtrackUnlocked'));
    } catch {}
  }

  /**
   * Load configuration from cloud with fallback to defaults
   */
  async loadConfig(): Promise<AudioConfig> {
    if (this.configLoaded && this.config) {
      return this.config;
    }
    
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this._doLoadConfig();
    return this.loadPromise;
  }

  private async _doLoadConfig(): Promise<AudioConfig> {
    try {
      // Fetch audio config entries for current soundtrack
      const { data, error } = await supabase
        .from('audio_config')
        .select(`
          *,
          audio_library (*)
        `)
        .eq('soundtrack', this.soundtrack)
        .eq('is_active', true);

      if (error || !data || data.length === 0) {
        console.log('Using default audio config (no cloud config found)');
        this.config = structuredClone(DEFAULT_AUDIO_CONFIG);
        this.configLoaded = true;
        return this.config;
      }

      // Merge cloud config with defaults
      this.config = this.mergeWithDefaults(data as AudioConfigRow[]);
      this.configLoaded = true;
      console.log(`Loaded audio config for soundtrack: ${this.soundtrack}`);
      return this.config;
    } catch (err) {
      console.warn('Failed to load audio config from cloud:', err);
      this.config = structuredClone(DEFAULT_AUDIO_CONFIG);
      this.configLoaded = true;
      return this.config;
    }
  }

  private mergeWithDefaults(cloudData: AudioConfigRow[]): AudioConfig {
    const config = structuredClone(DEFAULT_AUDIO_CONFIG);

    for (const row of cloudData) {
      const eventKey = row.event_key;
      const audioFile = row.audio_library;
      
      if (!audioFile) continue;

      // Check if it's a music event
      if (MUSIC_EVENT_KEYS.includes(eventKey as MusicEventKey)) {
        const key = eventKey as MusicEventKey;
        config.music[key] = {
          path: audioFile.file_path,
          volume: row.volume,
        };
      }
      // Check if it's an SFX event
      else if (SFX_EVENT_KEYS.includes(eventKey as SfxEventKey)) {
        const key = eventKey as SfxEventKey;
        config.sfx[key] = {
          path: audioFile.file_path,
          volume: row.volume,
        };
      }
    }

    return config;
  }

  /**
   * Get path for a specific music event
   */
  async getMusicPath(event: MusicEventKey): Promise<string | null> {
    const config = await this.loadConfig();
    const eventConfig = config.music[event];
    if (!eventConfig?.path) return null;
    return Array.isArray(eventConfig.path) ? eventConfig.path[0] : eventConfig.path;
  }

  /**
   * Get path for a specific SFX event
   */
  async getSfxPath(event: SfxEventKey): Promise<string | string[] | null> {
    const config = await this.loadConfig();
    const eventConfig = config.sfx[event];
    return eventConfig?.path ?? null;
  }

  /**
   * Get volume for an event
   */
  async getVolume(event: MusicEventKey | SfxEventKey): Promise<number> {
    const config = await this.loadConfig();
    const musicConfig = config.music[event as MusicEventKey];
    if (musicConfig) return musicConfig.volume ?? 1.0;
    const sfxConfig = config.sfx[event as SfxEventKey];
    return sfxConfig?.volume ?? 1.0;
  }

  /**
   * Get level music path (1-indexed)
   */
  async getLevelMusicPath(level: number): Promise<string | null> {
    const config = await this.loadConfig();
    const levelIndex = ((level - 1) % 8) + 1;
    const key = `level${levelIndex}` as MusicEventKey;
    const eventConfig = config.music[key];
    if (!eventConfig?.path) return null;
    return Array.isArray(eventConfig.path) ? eventConfig.path[0] : eventConfig.path;
  }

  /**
   * Fetch all audio library entries
   */
  async fetchAudioLibrary(): Promise<AudioLibraryRow[]> {
    try {
      const { data, error } = await supabase
        .from('audio_library')
        .select('*')
        .order('type', { ascending: true })
        .order('display_name', { ascending: true });

      if (error) {
        console.warn('Failed to fetch audio library:', error);
        return [];
      }

      // Cast to proper type since we know the schema
      this.audioLibrary = (data || []) as unknown as AudioLibraryRow[];
      return this.audioLibrary;
    } catch (err) {
      console.warn('Failed to fetch audio library:', err);
      return [];
    }
  }

  /**
   * Get cached audio library
   */
  getAudioLibrary(): AudioLibraryRow[] {
    return this.audioLibrary;
  }

  /**
   * Save an audio assignment to the cloud
   */
  async saveAudioAssignment(
    eventKey: string,
    audioFileId: string | null,
    volume: number = 1.0
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('audio_config')
        .upsert({
          event_key: eventKey,
          soundtrack: this.soundtrack,
          audio_file_id: audioFileId,
          volume,
          is_active: true,
        }, {
          onConflict: 'event_key,soundtrack'
        });

      if (error) {
        console.error('Failed to save audio assignment:', error);
        return false;
      }

      // Invalidate cache
      this.config = null;
      this.configLoaded = false;
      this.loadPromise = null;

      return true;
    } catch (err) {
      console.error('Failed to save audio assignment:', err);
      return false;
    }
  }

  /**
   * Clear all assignments for current soundtrack
   */
  async clearSoundtrackAssignments(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('audio_config')
        .delete()
        .eq('soundtrack', this.soundtrack);

      if (error) {
        console.error('Failed to clear assignments:', error);
        return false;
      }

      // Invalidate cache
      this.config = null;
      this.configLoaded = false;
      this.loadPromise = null;

      return true;
    } catch (err) {
      console.error('Failed to clear assignments:', err);
      return false;
    }
  }

  /**
   * Export current configuration as TypeScript code
   */
  async exportAsTypeScript(): Promise<string> {
    const config = await this.loadConfig();
    const timestamp = new Date().toISOString().split('T')[0];
    
    const musicEntries = Object.entries(config.music)
      .map(([key, val]) => {
        const pathStr = val.path === null 
          ? 'null' 
          : Array.isArray(val.path) 
            ? `[${val.path.map(p => `'${p}'`).join(', ')}]` 
            : `'${val.path}'`;
        return `    ${key}: { path: ${pathStr}, volume: ${val.volume ?? 1.0} }`;
      })
      .join(',\n');

    const sfxEntries = Object.entries(config.sfx)
      .map(([key, val]) => {
        const pathStr = val.path === null 
          ? 'null' 
          : Array.isArray(val.path) 
            ? `[${val.path.map(p => `'${p}'`).join(', ')}]` 
            : `'${val.path}'`;
        return `    ${key}: { path: ${pathStr}, volume: ${val.volume ?? 1.0} }`;
      })
      .join(',\n');

    return `/**
 * Default Audio Configuration
 * Generated from cloud config on ${timestamp}
 * Soundtrack: ${this.soundtrack}
 * 
 * To use: Replace the contents of src/lib/defaultAudioConfig.ts with this file
 */

import type { AudioConfig } from './defaultAudioConfig';

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  music: {
${musicEntries}
  },
  sfx: {
${sfxEntries}
  }
};
`;
  }

  /**
   * Export current configuration as JSON
   */
  async exportAsJSON(): Promise<string> {
    const config = await this.loadConfig();
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      soundtrack: this.soundtrack,
      config
    }, null, 2);
  }

  /**
   * Force reload configuration
   */
  invalidateCache() {
    this.config = null;
    this.configLoaded = false;
    this.loadPromise = null;
  }
}

// Singleton instance
export const audioConfigService = new AudioConfigService();
