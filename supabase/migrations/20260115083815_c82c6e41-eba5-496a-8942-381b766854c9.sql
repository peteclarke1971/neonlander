-- Add third batch of SFX to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('sfx_metallic_thud_2.mp3', 'Metallic Thud 2', 'sfx', '/audio/sfx_metallic_thud_2.mp3'),
  ('sfx_ominous_1.mp3', 'Ominous 1', 'sfx', '/audio/sfx_ominous_1.mp3'),
  ('sfx_ominous_3.mp3', 'Ominous 3', 'sfx', '/audio/sfx_ominous_3.mp3'),
  ('sfx_lunar_engine.mp3', 'Lunar Lander Engine', 'sfx', '/audio/sfx_lunar_engine.mp3'),
  ('sfx_volcano_eruption.mp3', 'Volcano Eruption', 'sfx', '/audio/sfx_volcano_eruption.mp3'),
  ('sfx_retro_game_1.mp3', 'Retro Game 1', 'sfx', '/audio/sfx_retro_game_1.mp3'),
  ('sfx_retro_game_2.mp3', 'Retro Game 2', 'sfx', '/audio/sfx_retro_game_2.mp3')
ON CONFLICT DO NOTHING;