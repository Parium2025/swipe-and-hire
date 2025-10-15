-- Fix job_questions question_type constraint issue
-- The table has TWO constraints (inline + named), causing validation failures

-- Drop the entire question_type column and recreate it with correct constraint
ALTER TABLE public.job_questions 
DROP COLUMN question_type;

-- Add question_type column back with correct constraint
ALTER TABLE public.job_questions 
ADD COLUMN question_type TEXT NOT NULL 
CHECK (question_type IN ('text', 'yes_no', 'multiple_choice', 'number', 'date', 'file', 'range', 'video'))
DEFAULT 'text';