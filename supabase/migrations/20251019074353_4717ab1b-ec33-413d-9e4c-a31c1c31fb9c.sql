-- Drop the existing validation function and trigger
DROP FUNCTION IF EXISTS validate_ghost_record() CASCADE;

-- Recreate the validation function WITHOUT initials validation
CREATE OR REPLACE FUNCTION validate_ghost_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate completion time is reasonable (1 second to 30 minutes)
  IF NEW.completion_time < 1000 OR NEW.completion_time > 1800000 THEN
    RAISE EXCEPTION 'Completion time out of valid range';
  END IF;
  
  -- Validate ghost data size doesn't exceed 500KB
  IF octet_length(NEW.ghost_data::text) > 512000 THEN
    RAISE EXCEPTION 'Ghost data exceeds maximum size';
  END IF;
  
  -- Removed: Initials validation (no longer required)
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER validate_ghost_record_trigger
  BEFORE INSERT OR UPDATE ON public.ghost_records
  FOR EACH ROW
  EXECUTE FUNCTION validate_ghost_record();

-- Make the initials column nullable
ALTER TABLE ghost_records 
ALTER COLUMN initials DROP NOT NULL;