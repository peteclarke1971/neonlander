-- Add 10 new Short Level Music tracks to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('Short_Level_Music_1.mp3', 'Short Level Music 1', 'music', '/audio/Short_Level_Music_1.mp3'),
  ('Short_Level_Music_2.mp3', 'Short Level Music 2', 'music', '/audio/Short_Level_Music_2.mp3'),
  ('Short_Level_Music_3.mp3', 'Short Level Music 3', 'music', '/audio/Short_Level_Music_3.mp3'),
  ('Short_Level_Music_4.mp3', 'Short Level Music 4', 'music', '/audio/Short_Level_Music_4.mp3'),
  ('Short_Level_Music_5.mp3', 'Short Level Music 5', 'music', '/audio/Short_Level_Music_5.mp3'),
  ('Short_Level_Music_6.mp3', 'Short Level Music 6', 'music', '/audio/Short_Level_Music_6.mp3'),
  ('Short_Level_Music_7.mp3', 'Short Level Music 7', 'music', '/audio/Short_Level_Music_7.mp3'),
  ('Short_Level_Music_8.mp3', 'Short Level Music 8', 'music', '/audio/Short_Level_Music_8.mp3'),
  ('Short_Level_Music_9.mp3', 'Short Level Music 9', 'music', '/audio/Short_Level_Music_9.mp3'),
  ('Short_Level_Music_10.mp3', 'Short Level Music 10', 'music', '/audio/Short_Level_Music_10.mp3')
ON CONFLICT DO NOTHING;