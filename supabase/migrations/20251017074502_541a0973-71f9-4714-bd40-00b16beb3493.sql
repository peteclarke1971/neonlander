-- Add server-side validation constraints to prevent bypassing client validation

-- 1. Add realistic maximum score constraint
ALTER TABLE public.scores 
ADD CONSTRAINT reasonable_score CHECK (score <= 1000000);

-- 2. Ensure initials are alphabetic uppercase only (A-Z, 1-3 characters)
ALTER TABLE public.scores 
ADD CONSTRAINT alphabetic_initials CHECK (initials ~ '^[A-Z]{1,3}$');

-- 3. Create rate limiting function to prevent spam submissions
CREATE OR REPLACE FUNCTION public.validate_score_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent unrealistic scores exceeding the maximum
  IF NEW.score > 1000000 THEN
    RAISE EXCEPTION 'Score exceeds maximum allowed value';
  END IF;
  
  -- Rate limit: maximum 5 submissions per initials per minute
  IF (SELECT COUNT(*) 
      FROM public.scores 
      WHERE initials = NEW.initials 
      AND created_at > NOW() - INTERVAL '1 minute') >= 5 THEN
    RAISE EXCEPTION 'Too many score submissions. Please wait before submitting again.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Attach trigger to scores table
CREATE TRIGGER validate_score_before_insert
BEFORE INSERT ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.validate_score_submission();