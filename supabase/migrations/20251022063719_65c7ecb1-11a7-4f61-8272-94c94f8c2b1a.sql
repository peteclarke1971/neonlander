-- Add time trial support to scores table
ALTER TABLE public.scores 
ADD COLUMN IF NOT EXISTS mode_type text 
CHECK (mode_type IN ('classic', 'fixed', 'caverns', 'survival', 'timetrial'));

ALTER TABLE public.scores 
ADD COLUMN IF NOT EXISTS completion_time integer; -- milliseconds for time trial

ALTER TABLE public.scores 
ADD COLUMN IF NOT EXISTS level integer; -- level number for time trial

-- Update existing records to have mode_type based on mode column
UPDATE public.scores 
SET mode_type = mode 
WHERE mode_type IS NULL;

-- Create index for time trial queries (fastest times first)
CREATE INDEX IF NOT EXISTS idx_timetrial_scores 
ON public.scores (mode_type, level, difficulty, completion_time) 
WHERE mode_type = 'timetrial';

-- Create index for general leaderboard queries
CREATE INDEX IF NOT EXISTS idx_scores_mode_difficulty 
ON public.scores (mode_type, difficulty, score DESC) 
WHERE mode_type != 'timetrial';