import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Play, Square, Upload, Download, RotateCcw, Music, Volume2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { audioConfigService } from '@/lib/audioConfigService';
import { 
  type SoundtrackType,
  type MusicEventKey,
  type SfxEventKey,
  AUDIO_EVENT_LABELS,
  MUSIC_EVENT_KEYS,
  SFX_EVENT_KEYS,
  DEFAULT_AUDIO_CONFIG,
} from '@/lib/defaultAudioConfig';
import { toast } from 'sonner';

interface AudioLibraryItem {
  id: string;
  filename: string;
  display_name: string;
  type: 'music' | 'sfx';
  duration_seconds: number | null;
  file_path: string;
}

interface AudioAssignment {
  audioFileId: string | null;
  volume: number;
}

type Assignments = Record<string, AudioAssignment>;

export default function AudioSettings() {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundtrack, setSoundtrack] = useState<SoundtrackType>('default');
  const [hiddenUnlocked, setHiddenUnlocked] = useState(false);
  const [library, setLibrary] = useState<AudioLibraryItem[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [playingEvent, setPlayingEvent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize
  useEffect(() => {
    const currentSoundtrack = audioConfigService.getSoundtrack();
    setSoundtrack(currentSoundtrack);
    setHiddenUnlocked(audioConfigService.isHiddenUnlocked());
    loadData();
    
    // Listen for hidden unlock
    const handleUnlock = () => setHiddenUnlocked(true);
    window.addEventListener('hiddenSoundtrackUnlocked', handleUnlock);
    return () => window.removeEventListener('hiddenSoundtrackUnlocked', handleUnlock);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load library
      const libraryData = await audioConfigService.fetchAudioLibrary();
      setLibrary(libraryData);
      
      // Load current assignments for this soundtrack
      const { data: configData } = await supabase
        .from('audio_config')
        .select('event_key, audio_file_id, volume')
        .eq('soundtrack', audioConfigService.getSoundtrack())
        .eq('is_active', true);
      
      const loadedAssignments: Assignments = {};
      
      // Initialize with defaults (null = use default)
      [...MUSIC_EVENT_KEYS, ...SFX_EVENT_KEYS].forEach(key => {
        loadedAssignments[key] = { audioFileId: null, volume: 1.0 };
      });
      
      // Override with cloud config
      if (configData) {
        for (const row of configData) {
          loadedAssignments[row.event_key] = {
            audioFileId: row.audio_file_id,
            volume: row.volume ?? 1.0,
          };
        }
      }
      
      setAssignments(loadedAssignments);
    } catch (err) {
      console.error('Failed to load audio data:', err);
      toast.error('Failed to load audio configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSoundtrackChange = useCallback((newSoundtrack: string) => {
    if (!newSoundtrack) return;
    const st = newSoundtrack as SoundtrackType;
    setSoundtrack(st);
    audioConfigService.setSoundtrack(st);
    loadData();
  }, []);

  const handleAssignmentChange = (eventKey: string, audioFileId: string | null) => {
    setAssignments(prev => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], audioFileId }
    }));
    setHasChanges(true);
  };

  const handleVolumeChange = (eventKey: string, volume: number) => {
    setAssignments(prev => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], volume }
    }));
    setHasChanges(true);
  };

  const getAudioPath = (eventKey: string, audioFileId: string | null): string | null => {
    if (audioFileId) {
      const file = library.find(f => f.id === audioFileId);
      return file?.file_path ?? null;
    }
    // Return default path
    const musicKey = eventKey as MusicEventKey;
    const sfxKey = eventKey as SfxEventKey;
    if (MUSIC_EVENT_KEYS.includes(musicKey)) {
      const path = DEFAULT_AUDIO_CONFIG.music[musicKey]?.path;
      return Array.isArray(path) ? path[0] : path;
    }
    if (SFX_EVENT_KEYS.includes(sfxKey)) {
      const path = DEFAULT_AUDIO_CONFIG.sfx[sfxKey]?.path;
      return Array.isArray(path) ? path[0] : path;
    }
    return null;
  };

  const handlePlay = (eventKey: string) => {
    const assignment = assignments[eventKey];
    const path = getAudioPath(eventKey, assignment?.audioFileId ?? null);
    
    if (!path) {
      toast.error('No audio assigned or synthesized sound');
      return;
    }
    
    // Stop current if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (playingEvent === eventKey) {
      setPlayingEvent(null);
      return;
    }
    
    const audio = new Audio(path);
    audio.volume = assignment?.volume ?? 1.0;
    audio.play().catch(() => toast.error('Failed to play audio'));
    audio.onended = () => setPlayingEvent(null);
    audioRef.current = audio;
    setPlayingEvent(eventKey);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingEvent(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save all assignments
      for (const [eventKey, assignment] of Object.entries(assignments)) {
        if (assignment.audioFileId !== null) {
          await audioConfigService.saveAudioAssignment(
            eventKey,
            assignment.audioFileId,
            assignment.volume
          );
        }
      }
      toast.success('Audio configuration saved!');
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save:', err);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all audio assignments for this soundtrack to defaults?')) return;
    
    try {
      await audioConfigService.clearSoundtrackAssignments();
      await loadData();
      toast.success('Reset to defaults');
      setHasChanges(false);
    } catch (err) {
      toast.error('Failed to reset');
    }
  };

  const handleExportJSON = async () => {
    try {
      const json = await audioConfigService.exportAsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio-config-${soundtrack}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Configuration exported!');
    } catch (err) {
      toast.error('Failed to export');
    }
  };

  const handleExportTS = async () => {
    try {
      const ts = await audioConfigService.exportAsTypeScript();
      const blob = new Blob([ts], { type: 'text/typescript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `defaultAudioConfig-${soundtrack}-${new Date().toISOString().split('T')[0]}.ts`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('TypeScript config exported!');
    } catch (err) {
      toast.error('Failed to export');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    let successCount = 0;
    
    try {
      for (const file of Array.from(files)) {
        if (!file.name.endsWith('.mp3') && !file.name.endsWith('.wav') && !file.name.endsWith('.ogg')) {
          toast.error(`Skipped ${file.name}: unsupported format`);
          continue;
        }
        
        // Upload to storage
        const fileName = `${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('audio')
          .upload(fileName, file);
        
        if (uploadError) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('audio')
          .getPublicUrl(fileName);
        
        // Determine type based on file duration (will default to music if >30s)
        // For now, default to music for longer files, sfx for shorter
        const audio = new Audio(publicUrl);
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => resolve();
          audio.onerror = () => resolve();
        });
        const duration = audio.duration || 0;
        const type = duration > 30 ? 'music' : 'sfx';
        
        // Add to library
        const displayName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const { error: insertError } = await supabase
          .from('audio_library')
          .insert({
            filename: fileName,
            display_name: displayName,
            type,
            duration_seconds: duration > 0 ? duration : null,
            file_path: publicUrl,
          });
        
        if (insertError) {
          toast.error(`Failed to register ${file.name}`);
          continue;
        }
        
        successCount++;
      }
      
      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} file(s)`);
        await loadData();
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderEventRow = (eventKey: string, type: 'music' | 'sfx') => {
    const assignment = assignments[eventKey] ?? { audioFileId: null, volume: 1.0 };
    const label = AUDIO_EVENT_LABELS[eventKey as MusicEventKey | SfxEventKey] || eventKey;
    const isPlaying = playingEvent === eventKey;
    const availableFiles = library.filter(f => f.type === type);
    
    return (
      <div 
        key={eventKey}
        className="grid grid-cols-[1fr_2fr_100px_50px] gap-3 items-center py-2 px-3 rounded-md hover:bg-muted/30"
      >
        <span className="text-sm text-foreground/80 truncate">{label}</span>
        
        <Select
          value={assignment.audioFileId || '__default__'}
          onValueChange={(val) => handleAssignmentChange(eventKey, val === '__default__' ? null : val)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Use default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">
              <span className="text-muted-foreground">Use default</span>
            </SelectItem>
            {availableFiles.map(file => (
              <SelectItem key={file.id} value={file.id}>
                {file.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Slider
          value={[assignment.volume * 100]}
          onValueChange={([val]) => handleVolumeChange(eventKey, val / 100)}
          max={100}
          step={5}
          className="w-full"
        />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => isPlaying ? handleStop() : handlePlay(eventKey)}
        >
          {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Audio Settings</h1>
          {hasChanges && (
            <span className="text-xs text-accent ml-auto">Unsaved changes</span>
          )}
        </div>

        {/* Soundtrack Selection */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
            Soundtrack
          </label>
          <ToggleGroup 
            type="single" 
            value={soundtrack} 
            onValueChange={handleSoundtrackChange}
            className="justify-start"
          >
            <ToggleGroupItem value="default" variant="outline">
              🎵 Default
            </ToggleGroupItem>
            <ToggleGroupItem value="retro" variant="outline">
              🎹 Retro
            </ToggleGroupItem>
            <ToggleGroupItem value="modern" variant="outline">
              🎸 Modern
            </ToggleGroupItem>
            {hiddenUnlocked && (
              <ToggleGroupItem value="hidden" variant="outline">
                🔓 ???
              </ToggleGroupItem>
            )}
          </ToggleGroup>
        </div>

        {/* Upload Section */}
        <div className="flex items-center gap-3 mb-6 p-4 border border-dashed border-muted-foreground/30 rounded-lg">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Upload Audio Files</p>
            <p className="text-xs text-muted-foreground">MP3, WAV, or OGG files</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Choose Files'}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-380px)]">
            {/* Music Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Music className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">Music</h2>
                <span className="text-xs text-muted-foreground">
                  ({library.filter(f => f.type === 'music').length} in library)
                </span>
              </div>
              <div className="space-y-1">
                {MUSIC_EVENT_KEYS.map(key => renderEventRow(key, 'music'))}
              </div>
            </div>

            <Separator className="my-6" />

            {/* SFX Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">Sound Effects</h2>
                <span className="text-xs text-muted-foreground">
                  ({library.filter(f => f.type === 'sfx').length} in library)
                </span>
              </div>
              <div className="space-y-1">
                {SFX_EVENT_KEYS.map(key => renderEventRow(key, 'sfx'))}
              </div>
            </div>
          </ScrollArea>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-border mt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex-1"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={handleExportJSON}>
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
          <Button variant="outline" onClick={handleExportTS}>
            <Download className="h-4 w-4 mr-2" />
            TypeScript
          </Button>
        </div>
      </div>
    </main>
  );
}
