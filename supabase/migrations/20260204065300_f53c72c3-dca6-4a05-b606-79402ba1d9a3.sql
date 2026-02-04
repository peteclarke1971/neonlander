-- Fix security vulnerability: Remove public write access from audio_library table
-- This makes the table read-only to prevent unauthorized modification/deletion of game audio files

-- Drop the permissive INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Public insert audio_library" ON public.audio_library;
DROP POLICY IF EXISTS "Public update audio_library" ON public.audio_library;
DROP POLICY IF EXISTS "Public delete audio_library" ON public.audio_library;

-- Keep only the SELECT policy (already exists as "Public read audio_library")

-- Fix security vulnerability: Remove public write access from audio storage bucket
-- Drop permissive storage policies that allow anyone to upload/modify/delete files

DROP POLICY IF EXISTS "Public upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Public update audio files" ON storage.objects;
DROP POLICY IF EXISTS "Public delete audio files" ON storage.objects;

-- Keep public read access for the audio bucket (files can still be served/played)