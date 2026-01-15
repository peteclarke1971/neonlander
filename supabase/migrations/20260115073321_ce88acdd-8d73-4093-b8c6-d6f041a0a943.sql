-- Seed audio_library with existing bundled audio files
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  -- Music files
  ('title.mp3', 'Title', 'music', '/audio/title.mp3'),
  ('level1.mp3', 'Level 1', 'music', '/audio/level1.mp3'),
  ('level2.mp3', 'Level 2', 'music', '/audio/level2.mp3'),
  ('level3.mp3', 'Level 3', 'music', '/audio/level3.mp3'),
  ('level4.mp3', 'Level 4', 'music', '/audio/level4.mp3'),
  ('level5.mp3', 'Level 5', 'music', '/audio/level5.mp3'),
  ('level6.mp3', 'Level 6', 'music', '/audio/level6.mp3'),
  ('level7.mp3', 'Level 7', 'music', '/audio/level7.mp3'),
  ('level8.mp3', 'Level 8', 'music', '/audio/level8.mp3'),
  ('mission_success.mp3', 'Mission Success', 'music', '/audio/mission_success.mp3'),
  -- SFX files
  ('thruster.mp3', 'Thruster', 'sfx', '/audio/thruster.mp3'),
  ('crash1.mp3', 'Crash 1', 'sfx', '/audio/crash1.mp3'),
  ('crash2.mp3', 'Crash 2', 'sfx', '/audio/crash2.mp3'),
  ('landing_on_pad.mp3', 'Landing on Pad', 'sfx', '/audio/landing_on_pad.mp3'),
  ('fuel_10_percent_loop.mp3', 'Fuel Alarm Loop', 'sfx', '/audio/fuel_10_percent_loop.mp3'),
  ('intro_tick.mp3', 'Intro Tick', 'sfx', '/audio/intro_tick.mp3'),
  ('intro_go.mp3', 'Intro Go', 'sfx', '/audio/intro_go.mp3'),
  ('intro_warp.mp3', 'Intro Warp', 'sfx', '/audio/intro_warp.mp3')
ON CONFLICT DO NOTHING;