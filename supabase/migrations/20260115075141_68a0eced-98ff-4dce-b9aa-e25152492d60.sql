-- Add 10 more music tracks to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('8_bit_High_Score_Music.mp3', '8-bit High Score Music', 'music', '/audio/8_bit_High_Score_Music.mp3'),
  ('8_bit_music_1.mp3', '8-bit Music 1', 'music', '/audio/8_bit_music_1.mp3'),
  ('8_bit_music_2.mp3', '8-bit Music 2', 'music', '/audio/8_bit_music_2.mp3'),
  ('8_bit_Music_3.mp3', '8-bit Music 3', 'music', '/audio/8_bit_Music_3.mp3'),
  ('8_bit_Theme_Tune.mp3', '8-bit Theme Tune', 'music', '/audio/8_bit_Theme_Tune.mp3'),
  ('Between_Level_Music_1.mp3', 'Between Level Music 1', 'music', '/audio/Between_Level_Music_1.mp3'),
  ('Between_Level_Music_2.mp3', 'Between Level Music 2', 'music', '/audio/Between_Level_Music_2.mp3'),
  ('Bonus_Mode_1.mp3', 'Bonus Mode 1', 'music', '/audio/Bonus_Mode_1.mp3'),
  ('Bonus_Mode_2.mp3', 'Bonus Mode 2', 'music', '/audio/Bonus_Mode_2.mp3'),
  ('Comet_coming.mp3', 'Comet Coming', 'music', '/audio/Comet_coming.mp3')
ON CONFLICT DO NOTHING;