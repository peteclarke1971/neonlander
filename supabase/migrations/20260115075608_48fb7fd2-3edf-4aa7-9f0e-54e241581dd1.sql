-- Add 10 more music tracks to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('Dark_Level_Music_1.mp3', 'Dark Level Music 1', 'music', '/audio/Dark_Level_Music_1.mp3'),
  ('Dark_Level_Music_2.mp3', 'Dark Level Music 2', 'music', '/audio/Dark_Level_Music_2.mp3'),
  ('Dark_Level_Music_3.mp3', 'Dark Level Music 3', 'music', '/audio/Dark_Level_Music_3.mp3'),
  ('Dark_Level_Music_4.mp3', 'Dark Level Music 4', 'music', '/audio/Dark_Level_Music_4.mp3'),
  ('Dont_think_of_Home_1_-_whispers.mp3', 'Don''t Think of Home 1 - Whispers', 'music', '/audio/Dont_think_of_Home_1_-_whispers.mp3'),
  ('Dramatic_Music_-_Theme_Title_Screen_1.mp3', 'Dramatic Music - Theme Title Screen 1', 'music', '/audio/Dramatic_Music_-_Theme_Title_Screen_1.mp3'),
  ('Endless_Music_1.mp3', 'Endless Music 1', 'music', '/audio/Endless_Music_1.mp3'),
  ('Endless_Music_2.mp3', 'Endless Music 2', 'music', '/audio/Endless_Music_2.mp3'),
  ('Endless_Music_3.mp3', 'Endless Music 3', 'music', '/audio/Endless_Music_3.mp3'),
  ('Endless_Music_4.mp3', 'Endless Music 4', 'music', '/audio/Endless_Music_4.mp3')
ON CONFLICT DO NOTHING;