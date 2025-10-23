-- Clear all ghost records (world record ghosts with replay data)
DELETE FROM ghost_records;

-- Clear all scores (leaderboard entries)
DELETE FROM scores;

-- Add comments for clarity
COMMENT ON TABLE ghost_records IS 'Stores world record ghost replays - cleared for fresh testing';
COMMENT ON TABLE scores IS 'Stores leaderboard scores - cleared for fresh testing';