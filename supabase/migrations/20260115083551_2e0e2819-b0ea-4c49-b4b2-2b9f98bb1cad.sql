-- Add first batch of SFX to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('sfx_retro_sound.mp3', 'Retro Sound', 'sfx', '/audio/sfx_retro_sound.mp3'),
  ('sfx_comet_1.mp3', 'Comet Hurtling 1', 'sfx', '/audio/sfx_comet_1.mp3'),
  ('sfx_comet_2.mp3', 'Comet Hurtling 2', 'sfx', '/audio/sfx_comet_2.mp3'),
  ('sfx_comet_3.mp3', 'Comet Hurtling 3', 'sfx', '/audio/sfx_comet_3.mp3'),
  ('sfx_comet_4.mp3', 'Comet Hurtling 4', 'sfx', '/audio/sfx_comet_4.mp3'),
  ('sfx_distorted_1.mp3', 'Distorted Single 1', 'sfx', '/audio/sfx_distorted_1.mp3'),
  ('sfx_distorted_2.mp3', 'Distorted Single 2', 'sfx', '/audio/sfx_distorted_2.mp3'),
  ('sfx_hovering_scifi_1.mp3', 'Hovering Sci-Fi 1', 'sfx', '/audio/sfx_hovering_scifi_1.mp3'),
  ('sfx_hovering_scifi_2.mp3', 'Hovering Sci-Fi 2', 'sfx', '/audio/sfx_hovering_scifi_2.mp3')
ON CONFLICT DO NOTHING;