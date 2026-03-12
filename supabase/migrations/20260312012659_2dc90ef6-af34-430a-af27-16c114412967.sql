
-- Step 1: Delete non-timetrial ghost records
DELETE FROM public.ghost_records WHERE mode != 'timetrial';

-- Step 2: Delete non-timetrial scores
DELETE FROM public.scores WHERE mode != 'timetrial';

-- Step 3: Insert seed scores for classic, fixed, medley, survival
INSERT INTO public.scores (initials, score, difficulty, mode) VALUES
  ('IH',  75000, 'easy', 'classic'),
  ('EWC', 50000, 'easy', 'classic'),
  ('PHI', 30000, 'easy', 'classic'),
  ('FAD', 15000, 'easy', 'classic'),
  ('LUM',  7500, 'easy', 'classic'),
  ('IH',  75000, 'easy', 'fixed'),
  ('EWC', 50000, 'easy', 'fixed'),
  ('PHI', 30000, 'easy', 'fixed'),
  ('FAD', 15000, 'easy', 'fixed'),
  ('LUM',  7500, 'easy', 'fixed'),
  ('IH',  75000, 'easy', 'medley'),
  ('EWC', 50000, 'easy', 'medley'),
  ('PHI', 30000, 'easy', 'medley'),
  ('FAD', 15000, 'easy', 'medley'),
  ('LUM',  7500, 'easy', 'medley'),
  ('IH',  75000, 'easy', 'survival'),
  ('EWC', 50000, 'easy', 'survival'),
  ('PHI', 30000, 'easy', 'survival'),
  ('FAD', 15000, 'easy', 'survival'),
  ('LUM',  7500, 'easy', 'survival');
