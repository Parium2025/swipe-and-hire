-- Uppdatera job_questions tabellen för att stödja alla frågetyper
ALTER TABLE job_questions 
DROP CONSTRAINT IF EXISTS question_type_check;

-- Lägg till alla frågetyper
ALTER TABLE job_questions 
ADD CONSTRAINT question_type_check 
CHECK (question_type IN ('text', 'yes_no', 'multiple_choice', 'number', 'date', 'file', 'range', 'video'));

-- Lägg till fält för min/max värden för range och number
ALTER TABLE job_questions 
ADD COLUMN IF NOT EXISTS min_value INTEGER,
ADD COLUMN IF NOT EXISTS max_value INTEGER,
ADD COLUMN IF NOT EXISTS placeholder_text TEXT;