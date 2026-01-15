-- Add final batch of SFX to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('sfx_wormhole_1.mp3', 'Wormhole 1', 'sfx', '/audio/sfx_wormhole_1.mp3'),
  ('sfx_wormhole_2.mp3', 'Wormhole 2', 'sfx', '/audio/sfx_wormhole_2.mp3')
ON CONFLICT DO NOTHING;