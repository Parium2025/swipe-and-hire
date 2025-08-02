-- Fix security issue: Add RLS policies for Parium table (correct case)
-- Since this appears to be a system table, we'll add basic policies

-- Enable RLS on Parium table if not already enabled
ALTER TABLE public."Parium" ENABLE ROW LEVEL SECURITY;

-- Create basic policy to allow authenticated users to view
CREATE POLICY "Authenticated users can view Parium data" 
ON public."Parium" 
FOR SELECT 
TO authenticated
USING (true);

-- Add insert policy for system operations
CREATE POLICY "System can insert Parium data" 
ON public."Parium" 
FOR INSERT 
TO authenticated
WITH CHECK (true);