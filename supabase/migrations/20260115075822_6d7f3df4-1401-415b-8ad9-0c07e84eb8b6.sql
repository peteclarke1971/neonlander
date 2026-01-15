-- Add 10 more music tracks to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('Endless_Music_5.mp3', 'Endless Music 5', 'music', '/audio/Endless_Music_5.mp3'),
  ('Endless_Music_6.mp3', 'Endless Music 6', 'music', '/audio/Endless_Music_6.mp3'),
  ('Endless_Music_7.mp3', 'Endless Music 7', 'music', '/audio/Endless_Music_7.mp3'),
  ('Endless_Music_8.mp3', 'Endless Music 8', 'music', '/audio/Endless_Music_8.mp3'),
  ('Endless_Music_9_Maybe.mp3', 'Endless Music 9 Maybe', 'music', '/audio/Endless_Music_9_Maybe.mp3'),
  ('Endless_Music_9.mp3', 'Endless Music 9', 'music', '/audio/Endless_Music_9.mp3'),
  ('High_Score_Entry.mp3', 'High Score Entry', 'music', '/audio/High_Score_Entry.mp3'),
  ('Lunar_Descent_1_-_Longer_Level.mp3', 'Lunar Descent 1 - Longer Level', 'music', '/audio/Lunar_Descent_1_-_Longer_Level.mp3'),
  ('Main_Theme_2.mp3', 'Main Theme 2', 'music', '/audio/Main_Theme_2.mp3'),
  ('Race_Music_1.mp3', 'Race Music 1', 'music', '/audio/Race_Music_1.mp3')
ON CONFLICT DO NOTHING;