ALTER TABLE public.job_postings 
  ADD COLUMN image_focus_position_desktop text NOT NULL DEFAULT 'center',
  ADD COLUMN image_focus_position_card text NOT NULL DEFAULT 'center';