-- Fix search path for validation function
DROP FUNCTION IF EXISTS validate_ghost_record() CASCADE;

CREATE OR REPLACE FUNCTION validate_ghost_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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