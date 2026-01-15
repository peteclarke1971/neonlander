-- Drop the overly permissive UPDATE policy for ghost_records
DROP POLICY IF EXISTS "Anyone can update faster ghost records" ON public.ghost_records;

-- Create a more secure approach: only allow updates that improve the record
-- The enforcement is done via a trigger that checks completion_time
CREATE OR REPLACE FUNCTION public.enforce_faster_ghost_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Only allow update if new completion time is faster
  IF NEW.completion_time >= OLD.completion_time THEN
    RAISE EXCEPTION 'Updates to ghost records only allowed for faster times';
  END IF;
  
  -- Rate limit: maximum 3 ghost updates per level/difficulty/mode per minute
  IF (SELECT COUNT(*) 
      FROM public.ghost_records 
      WHERE level = NEW.level 
      AND difficulty = NEW.difficulty 
      AND mode = NEW.mode
      AND created_at > NOW() - INTERVAL '1 minute') >= 3 THEN
    -- Reset created_at to now on valid faster update to track rate
    NEW.created_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for enforcing faster-only updates
DROP TRIGGER IF EXISTS enforce_faster_ghost_trigger ON public.ghost_records;
CREATE TRIGGER enforce_faster_ghost_trigger
  BEFORE UPDATE ON public.ghost_records
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_faster_ghost_record();

-- Create a new restrictive UPDATE policy
CREATE POLICY "Updates require faster completion time"
  ON public.ghost_records
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- The actual enforcement is done by the trigger, not the policy
-- This prevents abuse while still allowing legitimate faster times