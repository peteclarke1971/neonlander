-- Add mode column to ghost_records to distinguish between fixed and timetrial modes
ALTER TABLE ghost_records 
ADD COLUMN mode TEXT NOT NULL DEFAULT 'fixed';

-- Drop old unique constraint that only used level and difficulty
ALTER TABLE ghost_records 
DROP CONSTRAINT IF EXISTS ghost_records_level_difficulty_key;

-- Add new unique constraint including mode to allow separate ghosts per mode
ALTER TABLE ghost_records 
ADD CONSTRAINT ghost_records_level_difficulty_mode_key 
UNIQUE (level, difficulty, mode);

-- Clean up old mixed-mode data (records with null initials from testing)
DELETE FROM ghost_records WHERE initials IS NULL;

-- Add helpful comment
COMMENT ON COLUMN ghost_records.mode IS 'Game mode: fixed or timetrial';