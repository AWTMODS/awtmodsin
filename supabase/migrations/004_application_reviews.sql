-- =====================================================
-- Migration 004: Application Reviews & Ratings System
-- Creates application_reviews table and automatic triggers
-- to keep applications.rating and applications.reviews_count in sync.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.application_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy retrieval by application
CREATE INDEX IF NOT EXISTS idx_application_reviews_app_id 
ON public.application_reviews (application_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.application_reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all reviews
DROP POLICY IF EXISTS "Public read reviews" ON public.application_reviews;
CREATE POLICY "Public read reviews" 
ON public.application_reviews FOR SELECT 
USING (true);

-- Allow anyone to post a review (with rating constraint enforced)
DROP POLICY IF EXISTS "Public insert reviews" ON public.application_reviews;
CREATE POLICY "Public insert reviews" 
ON public.application_reviews FOR INSERT 
WITH CHECK (
  rating >= 1 AND rating <= 5 AND 
  length(trim(user_name)) >= 2 AND 
  length(trim(comment)) >= 3
);

-- Function to update application average rating and reviews_count
CREATE OR REPLACE FUNCTION public.fn_sync_application_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_app_id UUID;
  v_avg_rating NUMERIC(3, 1);
  v_total_reviews INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_app_id := OLD.application_id;
  ELSE
    v_app_id := NEW.application_id;
  END IF;

  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0.0),
    COUNT(*)
  INTO 
    v_avg_rating,
    v_total_reviews
  FROM public.application_reviews
  WHERE application_id = v_app_id;

  UPDATE public.applications
  SET 
    rating = v_avg_rating,
    reviews_count = v_total_reviews,
    updated_at = NOW()
  WHERE id = v_app_id;

  RETURN NULL;
END;
$$;

-- Trigger on insert, update, or delete of reviews
DROP TRIGGER IF EXISTS trg_sync_application_rating ON public.application_reviews;
CREATE TRIGGER trg_sync_application_rating
AFTER INSERT OR UPDATE OR DELETE ON public.application_reviews
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_application_rating();
