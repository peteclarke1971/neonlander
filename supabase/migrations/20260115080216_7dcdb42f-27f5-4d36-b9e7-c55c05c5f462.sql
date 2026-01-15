-- Add Vocal Track 3 to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('Vocal_Track_3.mp3', 'Vocal Track 3', 'music', '/audio/Vocal_Track_3.mp3')
ON CONFLICT DO NOTHING;