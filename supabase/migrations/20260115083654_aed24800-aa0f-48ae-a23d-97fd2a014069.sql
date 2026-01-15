-- Add second batch of SFX to audio_library
INSERT INTO public.audio_library (filename, display_name, type, file_path)
VALUES
  ('sfx_hovering_scifi_3.mp3', 'Hovering Sci-Fi 3', 'sfx', '/audio/sfx_hovering_scifi_3.mp3'),
  ('sfx_hovering_scifi_3b.mp3', 'Hovering Sci-Fi 3B', 'sfx', '/audio/sfx_hovering_scifi_3b.mp3'),
  ('sfx_hovering_scifi_4.mp3', 'Hovering Sci-Fi 4', 'sfx', '/audio/sfx_hovering_scifi_4.mp3'),
  ('sfx_hovering_scifi_4b.mp3', 'Hovering Sci-Fi 4B', 'sfx', '/audio/sfx_hovering_scifi_4b.mp3'),
  ('sfx_alien_landing.mp3', 'Alien Landing', 'sfx', '/audio/sfx_alien_landing.mp3'),
  ('sfx_calm_confirmation.mp3', 'Calm Confirmation', 'sfx', '/audio/sfx_calm_confirmation.mp3'),
  ('sfx_oscillating_warning_1.mp3', 'Oscillating Warning 1', 'sfx', '/audio/sfx_oscillating_warning_1.mp3'),
  ('sfx_oscillating_warning_2.mp3', 'Oscillating Warning 2', 'sfx', '/audio/sfx_oscillating_warning_2.mp3'),
  ('sfx_oscillating_warning_3.mp3', 'Oscillating Warning 3', 'sfx', '/audio/sfx_oscillating_warning_3.mp3'),
  ('sfx_metallic_thud.mp3', 'Metallic Thud', 'sfx', '/audio/sfx_metallic_thud.mp3')
ON CONFLICT DO NOTHING;