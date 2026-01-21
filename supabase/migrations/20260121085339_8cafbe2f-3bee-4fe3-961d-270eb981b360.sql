-- Add "medley" and "timetrial" to the mode check constraint
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_mode_check;

ALTER TABLE public.scores ADD CONSTRAINT scores_mode_check 
CHECK (mode = ANY (ARRAY['classic', 'fixed', 'caverns', 'survival', 'timetrial', 'medley']));