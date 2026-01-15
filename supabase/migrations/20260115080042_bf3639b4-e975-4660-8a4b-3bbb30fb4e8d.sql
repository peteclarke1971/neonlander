-- Add 10 more music tracks to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('Race_Music_2.mp3', 'Race Music 2', 'music', '/audio/Race_Music_2.mp3'),
  ('Race_Music_3.mp3', 'Race Music 3', 'music', '/audio/Race_Music_3.mp3'),
  ('Race_Music_4.mp3', 'Race Music 4', 'music', '/audio/Race_Music_4.mp3'),
  ('Race_Music_5.mp3', 'Race Music 5', 'music', '/audio/Race_Music_5.mp3'),
  ('Settings_Screen_Music_option.mp3', 'Settings Screen Music Option', 'music', '/audio/Settings_Screen_Music_option.mp3'),
  ('Short_Level_Music_-_Alien_language.mp3', 'Short Level Music - Alien Language', 'music', '/audio/Short_Level_Music_-_Alien_language.mp3'),
  ('Splash_Screen_Music.mp3', 'Splash Screen Music', 'music', '/audio/Splash_Screen_Music.mp3'),
  ('Vocal_Track_1.mp3', 'Vocal Track 1', 'music', '/audio/Vocal_Track_1.mp3'),
  ('Vocal_Track_2.mp3', 'Vocal Track 2', 'music', '/audio/Vocal_Track_2.mp3'),
  ('Vocal_Track_4.mp3', 'Vocal Track 4', 'music', '/audio/Vocal_Track_4.mp3')
ON CONFLICT DO NOTHING;