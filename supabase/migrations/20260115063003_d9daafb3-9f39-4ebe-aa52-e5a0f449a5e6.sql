-- Audio Configuration System

-- Table for storing all available audio files in the library
CREATE TABLE public.audio_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('music', 'sfx')),
  duration_seconds NUMERIC,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(filename, file_path)
);

-- Enable RLS with public read access
ALTER TABLE public.audio_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read audio_library" 
ON public.audio_library FOR SELECT USING (true);

CREATE POLICY "Public insert audio_library" 
ON public.audio_library FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update audio_library" 
ON public.audio_library FOR UPDATE USING (true);

CREATE POLICY "Public delete audio_library" 
ON public.audio_library FOR DELETE USING (true);

-- Table for storing event-to-audio assignments per soundtrack
CREATE TABLE public.audio_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  soundtrack TEXT NOT NULL DEFAULT 'default' CHECK (soundtrack IN ('default', 'retro', 'modern', 'hidden')),
  audio_file_id UUID REFERENCES public.audio_library(id) ON DELETE SET NULL,
  volume NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_key, soundtrack)
);

ALTER TABLE public.audio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read audio_config" 
ON public.audio_config FOR SELECT USING (true);

CREATE POLICY "Public insert audio_config" 
ON public.audio_config FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update audio_config" 
ON public.audio_config FOR UPDATE USING (true);

CREATE POLICY "Public delete audio_config" 
ON public.audio_config FOR DELETE USING (true);

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_audio_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_audio_config_updated_at
BEFORE UPDATE ON public.audio_config
FOR EACH ROW
EXECUTE FUNCTION public.update_audio_config_timestamp();

-- Create storage bucket for audio uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio', 'audio', true);

-- Storage policies for audio bucket
CREATE POLICY "Public read audio files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'audio');

CREATE POLICY "Public upload audio files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'audio');

CREATE POLICY "Public update audio files" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'audio');

CREATE POLICY "Public delete audio files" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'audio');