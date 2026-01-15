-- Add fourth batch of SFX to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('sfx_retro_game_3.mp3', 'Retro Game 3', 'sfx', '/audio/sfx_retro_game_3.mp3'),
  ('sfx_laser_pulse_1.mp3', 'Laser Pulse 1', 'sfx', '/audio/sfx_laser_pulse_1.mp3'),
  ('sfx_laser_pulse_3.mp3', 'Laser Pulse 3', 'sfx', '/audio/sfx_laser_pulse_3.mp3'),
  ('sfx_laser_pulse_4.mp3', 'Laser Pulse 4', 'sfx', '/audio/sfx_laser_pulse_4.mp3'),
  ('sfx_short_retro_1.mp3', 'Short Retro 1', 'sfx', '/audio/sfx_short_retro_1.mp3'),
  ('sfx_short_retro_3.mp3', 'Short Retro 3', 'sfx', '/audio/sfx_short_retro_3.mp3'),
  ('sfx_retro_intro.mp3', 'Retro Intro', 'sfx', '/audio/sfx_retro_intro.mp3'),
  ('sfx_video_game.mp3', 'Video Game', 'sfx', '/audio/sfx_video_game.mp3'),
  ('sfx_success_fanfare_1.mp3', 'Success Fanfare 1', 'sfx', '/audio/sfx_success_fanfare_1.mp3'),
  ('sfx_success_fanfare_4.mp3', 'Success Fanfare 4', 'sfx', '/audio/sfx_success_fanfare_4.mp3')
ON CONFLICT DO NOTHING;