-- Create table for global ghost records
CREATE TABLE public.ghost_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level integer NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'hard')),
  completion_time numeric NOT NULL,
  ghost_data jsonb NOT NULL,
  initials text NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(level, difficulty)
);

-- Index for fast lookups
CREATE INDEX idx_ghost_records_level_difficulty ON public.ghost_records(level, difficulty);

-- Enable RLS
ALTER TABLE public.ghost_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view ghost records"
  ON public.ghost_records
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can submit ghost records"
  ON public.ghost_records
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update faster ghost records"
  ON public.ghost_records
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Validation function
CREATE OR REPLACE FUNCTION validate_ghost_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.completion_time < 1000 OR NEW.completion_time > 1800000 THEN
    RAISE EXCEPTION 'Completion time out of valid range';
  END IF;
  
  IF octet_length(NEW.ghost_data::text) > 512000 THEN
    RAISE EXCEPTION 'Ghost data exceeds maximum size';
  END IF;
  
  IF NEW.initials !~ '^[A-Z0-9]{3}$' THEN
    RAISE EXCEPTION 'Invalid initials format';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_ghost_record_trigger
  BEFORE INSERT OR UPDATE ON public.ghost_records
  FOR EACH ROW
  EXECUTE FUNCTION validate_ghost_record();